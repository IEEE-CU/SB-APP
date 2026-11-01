const geminiConfig = require("../../config/gemini");

// AUD-013: the only place that holds the Gemini API key and talks to Google. The key comes from
// backend configuration, travels in a request header (never in the URL), and appears in no
// message, log line or response. Errors carry a generic message and a status number only.

const REQUEST_TIMEOUT_MS = 20_000;

class GeminiNotConfiguredError extends Error {
  constructor() {
    super("The AI service is not configured.");
    this.name = "GeminiNotConfiguredError";
  }
}

class GeminiProviderError extends Error {
  constructor(status) {
    super("The AI service could not produce a response.");
    this.name = "GeminiProviderError";
    this.status = status;
  }
}

/**
 * Sends one prompt to Gemini and returns the generated text.
 * `config` and `fetchImpl` can be replaced in tests; production uses the defaults.
 */
async function generate(prompt, { config = geminiConfig, fetchImpl = globalThis.fetch } = {}) {
  if (!config.apiKey) throw new GeminiNotConfiguredError();

  let response;
  try {
    response = await fetchImpl(`${config.baseUrl}/models/${encodeURIComponent(config.model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": config.apiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new GeminiProviderError(undefined);
  }
  if (!response.ok) throw new GeminiProviderError(response.status);

  let data;
  try {
    data = await response.json();
  } catch {
    throw new GeminiProviderError(response.status);
  }
  const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
  const text = Array.isArray(parts) ? parts.map((part) => (typeof part.text === "string" ? part.text : "")).join("").trim() : "";
  if (!text) throw new GeminiProviderError(response.status);
  return text;
}

module.exports = { generate, GeminiNotConfiguredError, GeminiProviderError };
