const mongoose = require('mongoose');

const RoleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  displayName: {
    type: String,
    required: true,
    trim: true
  },
  level: {
    type: String,
    enum: ['super_admin', 'faculty_advisor', 'office_bearer', 'member'],
    required: true
  },
  scope: {
    type: String,
    enum: ['global', 'society', 'student_branch', 'none'],
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  isSystemRole: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Prevent deletion of system roles
RoleSchema.pre('findOneAndDelete', async function (next) {
  try {
    const doc = await this.model.findOne(this.getQuery());
    if (doc && doc.isSystemRole) {
      const error = new Error('Cannot delete a system role');
      error.status = 403;
      error.code = 'FORBIDDEN';
      return next(error);
    }
    next();
  } catch (err) {
    next(err);
  }
});

RoleSchema.pre('deleteOne', { document: true, query: false }, function (next) {
  if (this.isSystemRole) {
    const error = new Error('Cannot delete a system role');
    error.status = 403;
    error.code = 'FORBIDDEN';
    return next(error);
  }
  next();
});

RoleSchema.pre('deleteOne', { document: false, query: true }, async function (next) {
  try {
    const doc = await this.model.findOne(this.getQuery());
    if (doc && doc.isSystemRole) {
      const error = new Error('Cannot delete a system role');
      error.status = 403;
      error.code = 'FORBIDDEN';
      return next(error);
    }
    next();
  } catch (err) {
    next(err);
  }
});

RoleSchema.pre('deleteMany', async function (next) {
  try {
    const docs = await this.model.find(this.getQuery());
    if (docs.some(doc => doc.isSystemRole)) {
      const error = new Error('Cannot delete system roles');
      error.status = 403;
      error.code = 'FORBIDDEN';
      return next(error);
    }
    next();
  } catch (err) {
    next(err);
  }
});

// Serialize _id to id and remove __v in API responses
RoleSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Role', RoleSchema);


