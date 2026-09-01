const mongoose = require("mongoose");
const toJson = require("./plugins/toJson");

const eventRegistrationSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    required: true,
    index: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ["REGISTERED", "WAITLISTED", "CANCELLED", "ATTENDED"],
    default: "REGISTERED",
  },
  registeredAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

eventRegistrationSchema.index({ event: 1, user: 1 }, { unique: true });
eventRegistrationSchema.plugin(toJson);

module.exports = mongoose.model("EventRegistration", eventRegistrationSchema);
