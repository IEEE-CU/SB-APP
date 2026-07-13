const geminiService = require("../services/ai/GeminiService");

// Thin controller shell. Placeholder: delegate request handling to the AI service.
const aiController = {
  async analyze(req, res, next) {
    return geminiService.analyze(req, res, next);
  },

  async summarize(req, res, next) {
    return geminiService.summarize(req, res, next);
  },
};

module.exports = aiController;
