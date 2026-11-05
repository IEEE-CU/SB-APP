import axios, {
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";

// In-memory cache for GET requests, so returning to a page shows its data straight away.
// Any write (POST/PUT/PATCH/DELETE) empties the cache, so lists never show stale data after a
// change made here. Live data (messages, presence, notifications, auth) is never cached.

const TTL_MS = 60_000;
const SKIP =
  /\/(auth|user\/permissions|messages|notifications|presence|conversations|channels|community|ai|storage)(\/|\?|$)/;

interface Entry {
  at: number;
  response: AxiosResponse;
}

const cache = new Map<string, Entry>();
const inFlight = new Map<string, Promise<AxiosResponse>>();

const keyOf = (config: InternalAxiosRequestConfig) =>
  [
    String(config.headers?.Authorization ?? ""),
    config.baseURL ?? "",
    config.url ?? "",
    JSON.stringify(config.params ?? {}),
  ].join("|");

export function clearApiCache() {
  cache.clear();
  inFlight.clear();
}

export function withCache(base: AxiosAdapter): AxiosAdapter {
  return async (config) => {
    const method = (config.method || "get").toLowerCase();
    if (method !== "get") {
      clearApiCache();
      return base(config);
    }
    if (SKIP.test(config.url ?? "")) return base(config);

    const key = keyOf(config);
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) {
      return {
        ...hit.response,
        config,
        data: structuredClone(hit.response.data),
      };
    }

    const pending = inFlight.get(key);
    if (pending)
      return pending.then((r) => ({
        ...r,
        config,
        data: structuredClone(r.data),
      }));

    const request = base(config)
      .then((response) => {
        cache.set(key, { at: Date.now(), response });
        return response;
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, request);
    return request;
  };
}

export const defaultAdapter = (config: InternalAxiosRequestConfig) =>
  axios.getAdapter(axios.defaults.adapter)(config);
