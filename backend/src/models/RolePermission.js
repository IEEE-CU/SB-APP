const mongoose = require("mongoose");

const RolePermissionSchema = new mongoose.Schema(
  {
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },
    permission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Permission",
      required: true,
    },
    accessLevel: {
      type: String,
      enum: ["full", "limited_own_scope", "approval", "none"],
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Compound unique index on (role, permission)
RolePermissionSchema.index({ role: 1, permission: 1 }, { unique: true });

// Serialize _id to id and remove __v in API responses
RolePermissionSchema.set("toJSON", {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model("RolePermission", RolePermissionSchema);
