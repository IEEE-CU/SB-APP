const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Socket.IO handshake authentication.
 *
 * Mirrors the REST `authenticate` middleware: the JWT must verify and the
 * user it names must still exist. Failure messages are unchanged from the
 * previous inline middleware so clients see the same errors.
 *
 * @param {import("socket.io").Socket} socket
 * @param {(err?: Error) => void} next
 */
const authenticateSocket = async (socket, next) => {
  const token = socket.handshake?.auth?.token;
  if (!token) {
    return next(new Error("Authentication error: Token required"));
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || typeof decoded !== "object" || !decoded.id) {
      throw new Error("Token has no subject");
    }
    const user = await User.findById(decoded.id).select("_id").lean();
    if (!user) {
      throw new Error("User not found");
    }
  } catch {
    // Same message for a bad token and a missing user, and for lookup
    // failures (fail closed).
    return next(new Error("Authentication error: Invalid token"));
  }

  socket.user = decoded;
  return next();
};

module.exports = { authenticateSocket };
