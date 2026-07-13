const emailService = require("../services/email/EmailService");

// Thin controller shell. Placeholder: delegate request handling to the email service.
const emailController = {
  async send(req, res, next) {
    return emailService.send(req, res, next);
  },
};

module.exports = emailController;
