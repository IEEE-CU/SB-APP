// Team 4 placeholder configuration for Gemini integration.
// Placeholder: validate API key, model name, and future tuning options here.

const geminiConfig = {
  apiKey: process.env.GEMINI_API_KEY || '',
  model: process.env.GEMINI_MODEL || 'gemini-1.5-pro'
};

module.exports = geminiConfig;
