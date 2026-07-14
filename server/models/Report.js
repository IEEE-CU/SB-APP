const mongoose = require('mongoose');
const toJson = require('./plugins/toJson');

const reportSchema = new mongoose.Schema({
  societyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Society',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['financial', 'event', 'annual'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'approved', 'rejected'],
    default: 'draft',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  fileUrl: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

reportSchema.index({ societyId: 1, type: 1 });
reportSchema.plugin(toJson);

const Report = mongoose.model('Report', reportSchema);
module.exports = Report;
