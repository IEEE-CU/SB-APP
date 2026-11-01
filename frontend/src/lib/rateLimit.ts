// NEW-09: one consistent, user-readable message for HTTP 429 (Too Many Requests).
// Pure helpers, no imports, so they can be unit tested with Node's runner.

export const RATE_LIMIT_MESSAGE = "Too many requests. Please wait a moment and try again.";

/** Message for a 429: mentions the wait only when the server sent a usable Retry-After (seconds). */
export function rateLimitMessage(retryAfter?: unknown): string {
  const seconds = Number(retryAfter);
  if (retryAfter !== undefined && retryAfter !== null && retryAfter !== "" && Number.isFinite(seconds) && seconds > 0) {
    const s = Math.ceil(seconds);
    return `Too many requests. Please wait ${s} second${s === 1 ? "" : "s"} and try again.`;
  }
  return RATE_LIMIT_MESSAGE;
}

interface ErrorLike {
  message?: string;
  response?: { status?: number; headers?: Record<string, unknown>; data?: unknown };
}

/**
 * If the error is a 429, rewrite err.message and err.response.data.message to the readable text.
 * Never retries and never changes any other status. Returns the same error object.
 */
export function applyRateLimitMessage<T extends ErrorLike>(err: T): T {
  const res = err?.response;
  if (!res || res.status !== 429) return err;
  const text = rateLimitMessage(res.headers?.["retry-after"]);
  err.message = text;
  const data = res.data && typeof res.data === "object" ? (res.data as Record<string, unknown>) : {};
  res.data = { ...data, message: text };
  return err;
}
