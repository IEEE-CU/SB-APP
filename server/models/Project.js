const mongoose = require('mongoose');
const toJson = require('./plugins/toJson');

const projectSchema = new mongoose.Schema({
  societyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Society',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['proposed', 'active', 'completed', 'on_hold'],
    default: 'proposed',
    required: true
  },
  budget: {
    type: Number,
    default: 0,
    min: 0
  },
  teamMembers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true
});

projectSchema.index({ societyId: 1, status: 1 });
projectSchema.plugin(toJson);

const Project = mongoose.model('Project', projectSchema);
module.exports = Project;
