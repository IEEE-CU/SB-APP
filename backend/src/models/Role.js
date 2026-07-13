const mongoose = require("mongoose");
const toJson = require("./plugins/toJson");

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
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

roleSchema.plugin(toJson);

const Role = mongoose.model("Role", roleSchema);
module.exports = Role;
