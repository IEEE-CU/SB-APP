const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { authenticate, adminOnly } = require("../middleware/auth");
const { signAuthToken } = require("../utils/authTokens");
const { disconnectUserSockets } = require("../services/presenceService");
const {
  authLimiter,
  registrationLimiter,
} = require("../middleware/rateLimiter");

const router = express.Router();

// AUTH-CLOSE-01: one public answer for "no such account" and "wrong password", so the
// endpoint cannot be used to find out which e-mail addresses have accounts.
const INVALID_CREDENTIALS = "Invalid email or password";
const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 1024;

// When the account does not exist a password hash is still compared (against this
// throw-away hash, computed once at start-up with the same cost as real passwords), so the
// failure takes about as long as a wrong password. Response equality alone is not timing
// equality; this narrows the gap, it does not claim to remove it.
const timingHash = bcrypt.hash("timing-equalizer-not-a-real-password", 12);

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and get token
 * @access  Public
 */
router.post("/login", authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body && typeof req.body === "object" ? req.body : {};

    // Only strings reach the string methods and the database query: objects, arrays,
    // numbers and null are malformed requests, not authentication failures.
    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password ||
      email.length > MAX_EMAIL_LENGTH ||
      password.length > MAX_PASSWORD_LENGTH
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() })
      .select("+password")
      .populate("societyId");

    if (!user) {
      await bcrypt.compare(password, await timingHash);
      return res.status(401).json({
        success: false,
        message: INVALID_CREDENTIALS,
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: INVALID_CREDENTIALS,
      });
    }

    // Generate JWT
    const token = signAuthToken(user);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          societyId: user.societyId
            ? user.societyId._id || user.societyId
            : undefined,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/auth/register
 * @desc    Create a new user account (role is always OFFICE_BEARER, no society)
 * @access  Administrator only (SEC-CLOSE-02)
 */
// SEC-CLOSE-02: accounts are created by an administrator, never by the public. The
// server enforces it here (not by hiding the page): the caller must present a valid
// token and be an ADMIN, so an anonymous or ordinary caller creates no user and receives
// no token (and unauthorized probes do not use up the administrator's registration
// allowance, which is why the rate limiter comes after the authorization checks). The
// role of the new account is always fixed server-side below; nothing in the request body
// can choose a role, society or approval state.
router.post("/register", authenticate, adminOnly, registrationLimiter, async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      !name ||
      !email ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide name, email and password",
      });
    }

    if (password.length < 15) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 15 characters",
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: "OFFICE_BEARER",
    });

    const token = signAuthToken(user);

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get("/me", authenticate, async (req, res) => {
  res.json({
    success: true,
    user: req.user,
  });
});

/**
 * @route   POST /api/auth/change-password
 * @desc    Change current user's password
 * @access  Private
 */
router.post(
  "/change-password",
  authenticate,
  authLimiter,
  async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (
        typeof currentPassword !== "string" ||
        typeof newPassword !== "string" ||
        !currentPassword ||
        !newPassword
      ) {
        return res.status(400).json({
          success: false,
          message: "Please provide current and new password",
        });
      }

      if (newPassword.length < 15) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 15 characters",
        });
      }

      // Get user with password
      const user = await User.findById(req.user._id).select("+password");

      // Verify current password
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: "Current password is incorrect",
        });
      }

      // Update password. The save also stamps passwordChangedAt, which ends every session
      // issued before now - including the one making this request.
      user.password = newPassword;
      await user.save();

      // Close the user's live sockets on every device; they reconnect with the new token.
      try {
        const io = req.app && typeof req.app.get === "function" ? req.app.get("io") : null;
        if (io) disconnectUserSockets(io, user._id);
      } catch (socketError) {
        console.error("Could not close the user's sockets after a password change:", socketError.message);
      }

      // A replacement token keeps the current client signed in (additive response field).
      res.json({
        success: true,
        message: "Password updated successfully",
        data: { token: signAuthToken(user) },
      });
    } catch (error) {
      next(error);
    }
  },
);

module.exports = router;
