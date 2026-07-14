const pdfService = require("../services/pdf/PdfService");

// Thin controller shell. Placeholder: delegate request handling to the PDF service.
const pdfController = {
  async generate(req, res, next) {
    return pdfService.generate(req, res, next);
  },

  async preview(req, res, next) {
    return pdfService.preview(req, res, next);
  },
};

module.exports = pdfController;
