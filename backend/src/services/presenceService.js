const { resolvePermissions } = require("./resolvePermissions");

const userSockets = new Map(); // userId -> Set of socketIds
const socketUserMap = new Map(); // socketId -> { userId, activeChannel, lastSeen }

function setupPresenceHandlers(io) {
  io.on("connection", (socket) => {
    const userId = socket.user?.id || socket.user?._id;
    if (!userId) return;

    // Track active connection
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);
    socketUserMap.set(socket.id, {
      userId,
      activeChannel: null,
      lastSeen: new Date(),
    });

    // Join the caller's own society room so society-scoped broadcasts reach
    // only that society's sockets. Users with no society scope join no room.
    resolvePermissions(userId)
      .then((resolved) => {
        if (resolved?.scope?.societyId) {
          socket.join(`society:${resolved.scope.societyId}`);
        }
      })
      .catch(() => {
        /* leave the socket out of any society room on failure */
      });

    // Notify user is online
    io.emit("presence:update", {
      userId,
      status: "online",
      socketCount: userSockets.get(userId).size,
    });

    // Handle channel room joining
    socket.on("room:join", ({ channelId }) => {
      socket.join(`channel:${channelId}`);
      const info = socketUserMap.get(socket.id);
      if (info) info.activeChannel = channelId;
    });

    socket.on("room:leave", ({ channelId }) => {
      socket.leave(`channel:${channelId}`);
      const info = socketUserMap.get(socket.id);
      if (info && info.activeChannel === channelId) info.activeChannel = null;
    });

    // Typing Indicators
    socket.on("typing:start", ({ channelId, user }) => {
      if (!socket.rooms.has(`channel:${channelId}`)) return;
      socket.to(`channel:${channelId}`).emit("typing:start", {
        channelId,
        user: user || { id: userId },
      });
    });

    socket.on("typing:stop", ({ channelId, user }) => {
      if (!socket.rooms.has(`channel:${channelId}`)) return;
      socket.to(`channel:${channelId}`).emit("typing:stop", {
        channelId,
        user: user || { id: userId },
      });
    });

    // Canvas stroke broadcasting
    socket.on("canvas:draw", ({ channelId, stroke }) => {
      if (!socket.rooms.has(`channel:${channelId}`)) return;
      socket.to(`channel:${channelId}`).emit("canvas:draw", {
        channelId,
        stroke,
      });
    });

    // Heartbeat for status updates (online / idle / dnd)

    socket.on("presence:heartbeat", ({ status }) => {
      const info = socketUserMap.get(socket.id);
      if (info) {
        info.lastSeen = new Date();
      }
      io.emit("presence:update", {
        userId,
        status: status || "online",
      });
    });

    // Handle Disconnect
    socket.on("disconnect", () => {
      const info = socketUserMap.get(socket.id);
      if (info) {
        socketUserMap.delete(socket.id);
      }

      const userSet = userSockets.get(userId);
      if (userSet) {
        userSet.delete(socket.id);
        if (userSet.size === 0) {
          userSockets.delete(userId);
          // Broadcast user offline status
          io.emit("presence:update", {
            userId,
            status: "offline",
            lastSeen: new Date(),
          });
        } else {
          io.emit("presence:update", {
            userId,
            status: "online",
            socketCount: userSet.size,
          });
        }
      }
    });
  });
}

function getOnlineUsers() {
  const online = [];
  for (const [userId, sockets] of userSockets.entries()) {
    if (sockets.size > 0) {
      online.push(userId);
    }
  }
  return online;
}

function sendNotificationToUser(io, userId, notification) {
  const sockets = userSockets.get(String(userId));
  if (sockets) {
    for (const socketId of sockets) {
      io.to(socketId).emit("notification:new", notification);
    }
  }
}

module.exports = {
  setupPresenceHandlers,
  getOnlineUsers,
  sendNotificationToUser,
  userSockets,
  socketUserMap,
};
