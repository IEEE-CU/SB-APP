// Server-side Gemini configuration (AUD-013). The key is read only here, from the backend
// environment; nothing in the frontend needs it.

const geminiConfig = {
  apiKey: process.env.GEMINI_API_KEY || "",
  model: process.env.GEMINI_MODEL || "gemini-1.5-pro",
  baseUrl: (process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, ""),
};

module.exports = geminiConfig;
