"use strict";

/**
 * URL safety for content that comes from outside the application (AUD-030).
 *
 * Two separate problems, two sets of helpers:
 *
 *  1. A URL that is only STORED and later shown to users (a scraped link): it must be
 *     a plain web link - http or https, no embedded credentials, a real host, a sane
 *     length. `javascript:`, `data:`, `file:` and friends run code or read local
 *     resources when a user clicks them. -> safeWebUrl / isSafeWebUrl.
 *
 *  2. A URL the SERVER fetches: the destination must not be an internal one. Host-name
 *     checks alone are not enough (names resolve to anything, and can change between a
 *     check and the connection), so the address actually connected to is checked, for
 *     the first request and for every redirect hop. -> createSafeFetchOptions.
 *
 * No dependencies: the WHATWG URL parser (which also canonicalizes decimal, octal and
 * hexadecimal IPv4 forms) and net.BlockList from Node.
 */

const dns = require("dns");
const http = require("http");
const https = require("https");
const net = require("net");

const MAX_URL_LENGTH = 2048;
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

// Ranges the server must never connect to when fetching an external page: loopback,
// private networks, link-local (including the cloud metadata address 169.254.169.254),
// carrier-grade NAT, documentation and benchmarking ranges, multicast and reserved.
const BLOCKED = new net.BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
]) {
  BLOCKED.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 128], // unspecified
  ["::1", 128], // loopback
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["ff00::", 8], // multicast
  ["2001:db8::", 32], // documentation
  ["100::", 64], // discard-only
]) {
  BLOCKED.addSubnet(network, prefix, "ipv6");
}

/** Bare host form: the URL parser keeps the brackets of an IPv6 literal. */
function bareHost(hostname) {
  return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
}

/**
 * True when an IP address is one the server must not connect to. Anything that is not a
 * valid IP address is treated as blocked (fail closed). IPv4-mapped IPv6 addresses
 * (::ffff:127.0.0.1) are checked as the IPv4 address they carry, and so are NAT64
 * addresses (64:ff9b::/96) - a way to reach an IPv4 target through an IPv6 literal.
 */
function isBlockedAddress(address) {
  const family = net.isIP(address);
  if (family === 0) return true;
  if (family === 4) return BLOCKED.check(address, "ipv4");

  const lower = address.toLowerCase();
  // An IPv4 address embedded in the last 32 bits of ::ffff:0:0/96 or 64:ff9b::/96.
  const embedded = lower.match(/^(?:::ffff:|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/);
  if (embedded) return isBlockedAddress(embedded[1]);
  const mappedHex = lower.match(/^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const high = parseInt(mappedHex[1], 16);
    const low = parseInt(mappedHex[2], 16);
    return isBlockedAddress(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
  }
  return BLOCKED.check(address, "ipv6");
}

/**
 * Parses `value` (relative to `base` when given) and returns the URL object only if it is
 * a plain web URL; otherwise null. Rejects: non-http(s) schemes (the parser has already
 * removed tabs and newlines hidden inside a scheme such as "java\tscript:"), embedded
 * credentials, an empty host, and anything longer than 2048 characters.
 */
function parseWebUrl(value, base) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.length > MAX_URL_LENGTH) return null;
  let url;
  try {
    url = base === undefined ? new URL(trimmed) : new URL(trimmed, base);
  } catch {
    return null;
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) return null;
  if (url.username !== "" || url.password !== "") return null;
  if (url.hostname === "") return null;
  if (url.href.length > MAX_URL_LENGTH) return null;
  return url;
}

/** The normalized string of a plain web URL, or null. */
function safeWebUrl(value, base) {
  const url = parseWebUrl(value, base);
  return url ? url.href : null;
}

const isSafeWebUrl = (value) => parseWebUrl(value) !== null;

/**
 * Throws if a URL the server is about to request is not allowed: a plain web URL whose
 * host is not an internal name or a blocked IP literal. Names that merely RESOLVE to a
 * blocked address are caught later, at connection time, by the lookup below.
 */
function assertFetchableUrl(value, { isBlocked = isBlockedAddress } = {}) {
  const url = parseWebUrl(value);
  if (!url) throw new Error("Blocked URL: only http(s) URLs without credentials are allowed");
  const host = bareHost(url.hostname).toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) {
    throw new Error("Blocked URL: loopback host name");
  }
  if (net.isIP(host) !== 0 && isBlocked(host)) {
    throw new Error("Blocked URL: internal address");
  }
  return url;
}

/**
 * A `lookup` for http(s).Agent that resolves a name and refuses to connect when ANY of
 * the addresses it resolves to is blocked. The address that is validated is the one the
 * socket then uses, so a name cannot pass a check and then connect somewhere else (DNS
 * rebinding). Literal IP hosts do not go through lookup; assertFetchableUrl covers them.
 */
function createSafeLookup({ resolve = dns.lookup, isBlocked = isBlockedAddress } = {}) {
  return (hostname, options, callback) => {
    const done = typeof options === "function" ? options : callback;
    const opts = typeof options === "function" ? {} : options || {};
    resolve(hostname, { ...opts, all: true }, (error, addresses) => {
      if (error) return done(error);
      const list = Array.isArray(addresses) ? addresses : [{ address: addresses, family: net.isIP(addresses) }];
      if (list.length === 0 || list.some(({ address }) => isBlocked(address))) {
        const blocked = new Error("Blocked URL: host resolves to an internal address");
        blocked.code = "EBLOCKEDADDRESS";
        return done(blocked);
      }
      if (opts.all) return done(null, list);
      return done(null, list[0].address, list[0].family);
    });
  };
}

const PROXY_VARIABLES = ["http_proxy", "https_proxy", "all_proxy"];

/**
 * Names (never values: a proxy URL can carry credentials) of the proxy variables set in
 * the environment. These are exactly the variables the HTTP client (axios, through
 * proxy-from-env) reads, in either letter case. NO_PROXY is deliberately not consulted:
 * it only decides which hosts skip the proxy, and a mismatch between its matching rules
 * and ours must not open a bypass.
 */
function configuredProxyVariables(env = process.env) {
  const names = [];
  for (const name of PROXY_VARIABLES) {
    for (const variant of [name, name.toUpperCase()]) {
      if (typeof env[variant] === "string" && env[variant].trim() !== "") names.push(variant);
    }
  }
  return names;
}

/**
 * A proxy resolves host names itself, so the connect-time address check cannot see where
 * a request really goes. When one is configured the fetch is refused before any request
 * is made, rather than silently ignoring the proxy (which may be the only route out).
 */
function assertNoProxy(env = process.env) {
  const names = configuredProxyVariables(env);
  if (names.length > 0) {
    throw new Error(
      "Blocked URL: an outbound proxy is configured (" +
        names.join(", ") +
        "); destination checks cannot be enforced through a proxy, so scraping is disabled",
    );
  }
}

/**
 * Request options (for axios) that make a server-side GET safe against SSRF:
 *   - the first URL and every redirect hop must pass assertFetchableUrl;
 *   - the address actually connected to must not be blocked (safe lookup);
 *   - a configured HTTP(S) proxy refuses the fetch (assertNoProxy) and axios is told not
 *     to use one (proxy: false);
 *   - a bounded number of redirects and a bounded response size.
 * `resolve`, `isBlocked` and `env` exist so tests can supply a fake resolver, policy and
 * environment.
 */
function createSafeFetchOptions({
  resolve,
  isBlocked = isBlockedAddress,
  maxRedirects = 3,
  maxContentLength = 5 * 1024 * 1024,
  env = process.env,
} = {}) {
  const lookup = createSafeLookup({ resolve, isBlocked });
  return {
    assertUrl: (value) => {
      // The environment is read on every call: it can change after start-up.
      assertNoProxy(env);
      assertFetchableUrl(value, { isBlocked });
    },
    axiosOptions: {
      // Never let axios pick a proxy from the environment on its own (assertNoProxy
      // already refuses to start a fetch when one is configured).
      proxy: false,
      httpAgent: new http.Agent({ lookup }),
      httpsAgent: new https.Agent({ lookup }),
      maxRedirects,
      maxContentLength,
      beforeRedirect: (options) => {
        // follow-redirects hands over the next hop as request options.
        assertNoProxy(env);
        const next = options.href || `${options.protocol}//${options.hostname}${options.path || ""}`;
        assertFetchableUrl(next, { isBlocked });
      },
    },
  };
}

module.exports = {
  MAX_URL_LENGTH,
  isBlockedAddress,
  parseWebUrl,
  safeWebUrl,
  isSafeWebUrl,
  assertFetchableUrl,
  createSafeLookup,
  createSafeFetchOptions,
  configuredProxyVariables,
  assertNoProxy,
};
