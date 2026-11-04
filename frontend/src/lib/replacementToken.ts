// A password change makes the server end every session issued before it, including the one
// that made the request, and return a replacement token in the response. This validates that
// response field before it is allowed to replace the stored token: only a string shaped like a
// JWT (three base64url segments) is accepted, so an absent, empty or malformed field can never
// overwrite a working token. No imports: plain logic that can be tested without React.

const SEGMENT = /^[A-Za-z0-9_-]+$/;

export function acceptReplacementToken(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const token = (data as { token?: unknown }).token;
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3 || !parts.every((part) => SEGMENT.test(part))) return null;
  return token;
}
