const mongoose = require('mongoose');

const RolePermissionSchema = new mongoose.Schema({
  role: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    required: true
  },
  permission: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Permission',
    required: true
  },
  accessLevel: {
    type: String,
    enum: ['full', 'limited_own_scope', 'approval', 'none'],
    required: true
  }
}, {
  timestamps: true
});

// Compound unique index on (role, permission)
RolePermissionSchema.index({ role: 1, permission: 1 }, { unique: true });

module.exports = mongoose.model('RolePermission', RolePermissionSchema);
