const mongoose = require('mongoose');

const PermissionSchema = new mongoose.Schema({
  module: {
    type: String,
    enum: [
      'finance',
      'events',
      'projects',
      'reports',
      'community_hub',
      'members',
      'announcements',
      'dashboard',
      'settings',
      'roles_access'
    ],
    required: true
  },
  action: {
    type: String,
    enum: [
      'view',
      'create',
      'edit',
      'delete',
      'approve',
      'export',
      'manage_settings'
    ],
    required: true
  },
  key: {
    type: String,
    unique: true
  },
  description: {
    type: String,
    trim: true
  }
});

// Automatically derive the unique key before saving
PermissionSchema.pre('save', function (next) {
  this.key = `${this.module}:${this.action}`;
  next();
});

module.exports = mongoose.model('Permission', PermissionSchema);
