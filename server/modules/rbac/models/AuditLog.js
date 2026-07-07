const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // Can be null if the user is not authenticated yet or for public route checks (if any)
  },
  action: {
    type: String,
    required: true
  },
  module: {
    type: String,
    required: true
  },
  route: {
    type: String,
    required: true
  },
  method: {
    type: String,
    required: true
  },
  result: {
    type: String,
    enum: ['allowed', 'denied'],
    required: true
  },
  reason: {
    type: String
  },
  ipAddress: {
    type: String
  },
  metadata: {
    type: mongoose.Schema.Types.Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

module.exports = mongoose.model('AuditLog', AuditLogSchema);
