const mongoose = require("mongoose");
const toJson = require("./plugins/toJson");

const permissionSchema = new mongoose.Schema(
  {
    module: {
      type: String,
      required: true,
      trim: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

// Compound unique index to prevent duplicate permissions
permissionSchema.index({ module: 1, action: 1 }, { unique: true });
permissionSchema.plugin(toJson);

const Permission = mongoose.model("Permission", permissionSchema);
module.exports = Permission;
