const mongoose = require("mongoose");
const toJson = require("./plugins/toJson");

const rolePermissionSchema = new mongoose.Schema(
  {
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },
    permissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Permission",
      required: true,
    },
    accessLevel: {
      type: String,
      enum: ["none", "own", "society", "all"],
      default: "none",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Ensure a role only has one entry per permission
rolePermissionSchema.index({ roleId: 1, permissionId: 1 }, { unique: true });
rolePermissionSchema.plugin(toJson);

const RolePermission = mongoose.model("RolePermission", rolePermissionSchema);
module.exports = RolePermission;
