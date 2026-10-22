const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false, // Don't include password in queries by default
    },
    role: {
      type: String,
      enum: ["ADMIN", "OFFICE_BEARER"],
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    societyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Society",
      default: null,
    },
    avatarUrl: {
      type: String,
      default: "",
    },
    // Set (atomically with the new hash) whenever an existing account's password changes -
    // by the user or by an administrator reset. Tokens issued at or before this moment are
    // refused (utils/authTokens.js). Absent for accounts whose password never changed.
    passwordChangedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  // A new account has no earlier sessions to revoke; any later password change does.
  if (!this.isNew) this.passwordChangedAt = new Date();
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Transform output
userSchema.set("toJSON", {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    delete ret.password;
    delete ret.passwordChangedAt;
    return ret;
  },
});

module.exports = mongoose.model("User", userSchema);
