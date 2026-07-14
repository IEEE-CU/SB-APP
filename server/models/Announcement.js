const mongoose = require('mongoose');
const toJson = require('./plugins/toJson');

const announcementSchema = new mongoose.Schema({
  societyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Society',
    default: null // null indicates a global announcement
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'low',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

announcementSchema.index({ societyId: 1, createdAt: -1 });
announcementSchema.plugin(toJson);

const Announcement = mongoose.model('Announcement', announcementSchema);
module.exports = Announcement;
