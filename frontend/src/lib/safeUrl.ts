// Links built from server data (scraped or imported) are untrusted: an `href` of
// "javascript:..." runs script when clicked. This returns the URL only when it is a plain
// http(s) URL without embedded credentials, otherwise null so the caller renders no link.
// No imports: plain logic that can be tested without React.

const MAX_URL_LENGTH = 2048;

export function safeExternalUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > MAX_URL_LENGTH) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password || !url.hostname) return null;
    return url.href;
  } catch {
    return null;
  }
}
