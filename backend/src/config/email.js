// Team 4 placeholder configuration for email delivery.
// Placeholder: centralize mail provider settings and runtime limits here.

const emailConfig = {
  fromAddress: process.env.EMAIL_FROM || "",
  replyToAddress: process.env.EMAIL_REPLY_TO || "",
  provider: process.env.EMAIL_PROVIDER || "smtp",
};

module.exports = emailConfig;
