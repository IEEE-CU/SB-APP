const mongoose = require("mongoose");

const PermissionSchema = new mongoose.Schema({
  module: {
    type: String,
    enum: [
      "finance",
      "events",
      "projects",
      "reports",
      "community_hub",
      "members",
      "announcements",
      "dashboard",
      "settings",
      "roles_access",
    ],
    required: true,
  },
  action: {
    type: String,
    enum: [
      "view",
      "create",
      "edit",
      "delete",
      "approve",
      "export",
      "manage_settings",
    ],
    required: true,
  },
  key: {
    type: String,
    unique: true,
  },
  description: {
    type: String,
    trim: true,
  },
});

// Automatically derive the unique key before saving
PermissionSchema.pre("save", function (next) {
  this.key = `${this.module}:${this.action}`;
  next();
});

// Serialize _id to id and remove __v in API responses
PermissionSchema.set("toJSON", {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model("Permission", PermissionSchema);
