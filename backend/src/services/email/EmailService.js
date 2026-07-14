const emailConfig = require("../../config/email");

// Placeholder: implement email transport selection and message dispatch here.
class EmailService {
  constructor(config = emailConfig) {
    this.config = config;
  }

  async send() {
    throw new Error("TODO: implement email delivery service");
  }
}

module.exports = new EmailService();
