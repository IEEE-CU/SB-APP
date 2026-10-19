"use strict";

/**
 * Authenticated HTTP access for integration tests.
 *
 * Credentials come from the shared fixture module; nothing is duplicated in
 * test files. Tokens are held in memory only and are never printed. Successful
 * logins are not counted by the application's login rate limiter.
 */

const { TEST_PASSWORD, USERS } = require("./fixtures");

function createSession(target) {
  const tokens = new Map();

  async function tokenFor(userKey) {
    if (!USERS[userKey]) {
      throw new Error(`unknown fixture user "${userKey}"`);
    }
    if (tokens.has(userKey)) return tokens.get(userKey);

    const res = await target.api("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: USERS[userKey].email, password: TEST_PASSWORD }),
    });
    const body = await res.json();
    if (res.status !== 200 || !body?.data?.token) {
      throw new Error(`fixture login failed for "${userKey}" (status ${res.status})`);
    }
    tokens.set(userKey, body.data.token);
    return body.data.token;
  }

  /**
   * @param {string|null} userKey  fixture user, or null for an anonymous request
   * @param {string} method
   * @param {string} route         path below /api/v1 (or a full /api/... path)
   * @param {object} [options]     { body, headers, raw }
   * @returns {Promise<{status:number, body:any, text:string}>}
   */
  async function request(userKey, method, route, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (userKey) headers.Authorization = `Bearer ${await tokenFor(userKey)}`;

    let body;
    if (options.raw !== undefined) {
      body = options.raw;
    } else if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }

    const url = route.startsWith("/api/")
      ? `${target.baseUrl}${route}`
      : `${target.baseUrl}/api/v1${route}`;
    const res = await fetch(url, { method, headers, body });
    const text = await res.text();
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* non-JSON body */
    }
    return { status: res.status, body: parsed, text };
  }

  return { request, tokenFor };
}

module.exports = { createSession };
