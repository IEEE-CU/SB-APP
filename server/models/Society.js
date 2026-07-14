const mongoose = require('mongoose');
const toJson = require('./plugins/toJson');

const societySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Society name is required'],
    unique: true,
    trim: true
  },
  code: {
    type: String,
    required: [true, 'Society code is required'],
    unique: true,
    uppercase: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  logoUrl: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

societySchema.plugin(toJson);

const Society = mongoose.model('Society', societySchema);
module.exports = Society;
