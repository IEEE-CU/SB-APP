const geminiConfig = require("../../config/gemini");

// Placeholder: implement Gemini request orchestration here.
class GeminiService {
  constructor(config = geminiConfig) {
    this.config = config;
  }

  async analyze() {
    throw new Error("TODO: implement Gemini analysis service");
  }

  async summarize() {
    throw new Error("TODO: implement Gemini summarization service");
  }
}

module.exports = new GeminiService();
