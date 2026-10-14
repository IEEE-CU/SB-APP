const { resolvePermissions } = require("./resolvePermissions");
const Channel = require("../models/Channel");
const Conversation = require("../models/Conversation");
const User = require("../models/User");
const {
  attachScope,
  isSocietyInScope,
  isGrantingLevel,
} = require("../middleware/rbac");

const userSockets = new Map(); // userId -> Set of socketIds
const socketUserMap = new Map(); // socketId -> { userId, activeChannel, lastSeen }

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

// A typer is dropped this long after their last `typing:start` unless they
// send `typing:stop` (ChannelChatFeed never sends one; CommunityPage uses the
// same 3 s window on the client).
const TYPING_TTL_MS = 3000;

/**
 * Resolves a typing payload to exactly one delivery room. The payload must
 * carry either a channelId or a conversationId (a well-formed id), never both.
 * Typing is relayed through the same authorized delivery rooms as messages.
 */
const typingTarget = (payload) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const hasChannel = payload.channelId !== undefined && payload.channelId !== null;
  const hasConversation =
    payload.conversationId !== undefined && payload.conversationId !== null;
  if (hasChannel === hasConversation) return null;

  if (hasChannel) {
    const id = idFromPayload(payload, "channelId");
    return id ? { key: "channelId", id, room: `channel_${id}` } : null;
  }
  const id = idFromPayload(payload, "conversationId");
  return id ? { key: "conversationId", id, room: `conversation_${id}` } : null;
};

/**
 * Extracts an identifier from a socket payload that is either the id itself
 * (CommunityPage sends the raw id) or an object carrying it under `key`
 * (ChannelChatFeed and the canvas send `{ channelId }`). Returns null for
 * anything that is not a well-formed id.
 */
const idFromPayload = (payload, key) => {
  let value;
  if (typeof payload === "string") {
    value = payload;
  } else if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    value = payload[key];
  }
  return typeof value === "string" && OBJECT_ID_PATTERN.test(value) ? value : null;
};

const safeAck = (ack, result) => {
  if (typeof ack !== "function") return;
  try {
    ack(result);
  } catch {
    /* a misbehaving acknowledgement callback must not break the handler */
  }
};

/**
 * Same rule the REST channel routes apply: the caller needs the community hub
 * view permission and the channel's society must be within their scope.
 * Never trusts the room name alone.
 */
async function canAccessChannel(userId, channelId) {
  const resolved = await resolvePermissions(userId);
  if (!resolved || !resolved.permissions) return false;
  if (!isGrantingLevel(resolved.permissions["community_hub:view"])) return false;
  if (
    resolved.scope?.type === "society" &&
    !resolved.scope.societyId &&
    resolved.role !== "sb_faculty_advisor"
  ) {
    return false;
  }

  const channel = await Channel.findById(channelId);
  if (!channel) return false;

  // Reuse the existing scope computation instead of re-implementing it.
  const scopeRequest = {
    user: { _id: userId },
    userScope: resolved.scope || {},
    userRole: resolved.role,
  };
  const inertResponse = { status: () => inertResponse, json: () => inertResponse };
  let failure = null;
  await attachScope("societyId")(scopeRequest, inertResponse, (err) => {
    failure = err || null;
  });
  if (failure) return false;

  return isSocietyInScope(scopeRequest, channel.societyId);
}

/** Direct messages are limited to the two participants (as in the REST routes). */
async function isConversationParticipant(userId, conversationId) {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) return false;
  const uid = String(userId);
  return (
    String(conversation.userOneId) === uid ||
    String(conversation.userTwoId) === uid
  );
}

function setupPresenceHandlers(io) {
  // room -> Map(userId -> { name, socketId, timer }) of users currently typing
  const typing = new Map();

  // Tells every member of the room who is typing, excluding the recipient.
  const emitTypingUpdate = (target) => {
    const members = io.sockets?.adapter?.rooms?.get(target.room);
    if (!members) return;
    const active = typing.get(target.room);
    for (const socketId of members) {
      const recipient = String(socketUserMap.get(socketId)?.userId);
      const activeTypingUsers = [];
      if (active) {
        for (const [typerId, entry] of active) {
          if (typerId !== recipient) activeTypingUsers.push(entry.name);
        }
      }
      io.to(socketId).emit("typing:update", {
        [target.key]: target.id,
        activeTypingUsers,
      });
    }
  };

  // Removes a typer (explicit stop, expiry, leaving the room, disconnect).
  const clearTyper = (target, typerId) => {
    const active = typing.get(target.room);
    const entry = active?.get(typerId);
    if (!entry) return false;
    clearTimeout(entry.timer);
    active.delete(typerId);
    if (active.size === 0) typing.delete(target.room);
    emitTypingUpdate(target);
    return true;
  };

  io.on("connection", (socket) => {
    const userId = socket.user?.id || socket.user?._id;
    if (!userId) return;

    // The token was verified once, at the handshake. Treat it like the REST
    // middleware does (an expired token is no longer authentication): once
    // `exp` passes, protected actions are refused and the socket is
    // disconnected, which releases its rooms and typing state through the
    // disconnect handler below. Tokens without an `exp` are not time-limited.
    const tokenExpiresAtMs =
      typeof socket.user?.exp === "number" ? socket.user.exp * 1000 : null;
    const tokenExpired = () =>
      tokenExpiresAtMs !== null && tokenExpiresAtMs <= Date.now();

    if (tokenExpired()) {
      socket.disconnect(true);
      return;
    }

    let expiryTimer = null;
    const armExpiry = () => {
      const delay = tokenExpiresAtMs - Date.now();
      if (delay <= 0) {
        socket.disconnect(true);
        return;
      }
      // setTimeout cannot exceed 2^31-1 ms; re-arm when it fires early.
      expiryTimer = setTimeout(armExpiry, Math.min(delay, 2147483647));
      if (typeof expiryTimer.unref === "function") expiryTimer.unref();
    };
    if (tokenExpiresAtMs !== null) armExpiry();

    // Registers an event handler that refuses to run on an expired token.
    const onEvent = (event, handler) => {
      socket.on(event, (...args) => {
        if (event !== "disconnect" && tokenExpired()) {
          const ack = args[args.length - 1];
          safeAck(ack, { success: false });
          socket.disconnect(true);
          return undefined;
        }
        return handler(...args);
      });
    };

    // The typing identity comes from the authenticated socket. The JWT only
    // carries the id, so the display name is read once per connection from
    // the user record.
    let cachedName = null;
    const displayName = async () => {
      if (cachedName) return cachedName;
      try {
        const doc = await User.findById(userId).select("name").lean();
        const name = doc && typeof doc.name === "string" ? doc.name.trim() : "";
        cachedName = name || null;
      } catch {
        cachedName = null;
      }
      return cachedName;
    };

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
    //
    // Presence is delivered only through this room: it is visible to the
    // user's own society and to nobody else. There is no global fallback; if
    // the society cannot be established nothing is emitted. Payloads carry
    // only `userId` and `status`.
    let societyRoom = null;
    let socketClosed = false;
    const emitPresence = (payload) => {
      if (societyRoom && !socketClosed) {
        io.to(societyRoom).emit("presence:update", payload);
      }
    };

    resolvePermissions(userId)
      .then((resolved) => {
        const societyId = resolved?.scope?.societyId;
        if (!societyId || socketClosed) return;
        societyRoom = `society:${societyId}`;
        socket.join(societyRoom);

        // Notify the society that the user is online (once the room is known)
        emitPresence({ userId, status: "online" });
      })
      .catch(() => {
        /* leave the socket out of any society room on failure */
      });

    // Joining a room is authorized against the persisted channel/conversation
    // and the caller's permissions; the id in the payload proves nothing.

    // Typing/canvas relay room (`channel:<id>`)
    onEvent("room:join", async (payload, ack) => {
      try {
        const channelId = idFromPayload(payload, "channelId");
        if (!channelId || !(await canAccessChannel(userId, channelId))) {
          return safeAck(ack, { success: false });
        }
        socket.join(`channel:${channelId}`);
        const info = socketUserMap.get(socket.id);
        if (info) info.activeChannel = channelId;
        safeAck(ack, { success: true });
      } catch {
        safeAck(ack, { success: false });
      }
    });

    onEvent("room:leave", (payload, ack) => {
      const channelId = idFromPayload(payload, "channelId");
      if (!channelId) return safeAck(ack, { success: false });
      socket.leave(`channel:${channelId}`);
      const info = socketUserMap.get(socket.id);
      if (info && info.activeChannel === channelId) info.activeChannel = null;
      safeAck(ack, { success: true });
    });

    // Message delivery rooms: the REST routes emit message:* events into
    // `channel_<id>` and `conversation_<id>`.
    onEvent("channel:join", async (payload, ack) => {
      try {
        const channelId = idFromPayload(payload, "channelId");
        if (!channelId || !(await canAccessChannel(userId, channelId))) {
          return safeAck(ack, { success: false });
        }
        socket.join(`channel_${channelId}`);
        safeAck(ack, { success: true });
      } catch {
        safeAck(ack, { success: false });
      }
    });

    onEvent("channel:leave", (payload, ack) => {
      const channelId = idFromPayload(payload, "channelId");
      if (!channelId) return safeAck(ack, { success: false });
      socket.leave(`channel_${channelId}`);
      clearTyper(
        { key: "channelId", id: channelId, room: `channel_${channelId}` },
        String(userId),
      );
      safeAck(ack, { success: true });
    });

    onEvent("conversation:join", async (payload, ack) => {
      try {
        const conversationId = idFromPayload(payload, "conversationId");
        if (
          !conversationId ||
          !(await isConversationParticipant(userId, conversationId))
        ) {
          return safeAck(ack, { success: false });
        }
        socket.join(`conversation_${conversationId}`);
        safeAck(ack, { success: true });
      } catch {
        safeAck(ack, { success: false });
      }
    });

    onEvent("conversation:leave", (payload, ack) => {
      const conversationId = idFromPayload(payload, "conversationId");
      if (!conversationId) return safeAck(ack, { success: false });
      socket.leave(`conversation_${conversationId}`);
      clearTyper(
        {
          key: "conversationId",
          id: conversationId,
          room: `conversation_${conversationId}`,
        },
        String(userId),
      );
      safeAck(ack, { success: true });
    });

    // Typing indicators for channels and conversations. The sender must be a
    // member of the corresponding delivery room (`channel_<id>` /
    // `conversation_<id>`); those rooms are only ever joined through the
    // authorized channel:join / conversation:join handlers above. Any identity
    // fields in the payload are ignored.
    onEvent("typing:start", async (payload) => {
      try {
        const target = typingTarget(payload);
        if (!target || !socket.rooms.has(target.room)) return;

        const name = await displayName();
        // Fail closed without a server-known identity, and re-check
        // membership because the lookup was asynchronous.
        if (!name || !socket.rooms.has(target.room)) return;

        const typerId = String(userId);
        let active = typing.get(target.room);
        if (!active) {
          active = new Map();
          typing.set(target.room, active);
        }
        const existing = active.get(typerId);
        if (existing) clearTimeout(existing.timer);

        const timer = setTimeout(
          () => clearTyper(target, typerId),
          TYPING_TTL_MS,
        );
        if (typeof timer.unref === "function") timer.unref();
        active.set(typerId, { name, socketId: socket.id, timer });

        socket.to(target.room).emit("typing:start", {
          [target.key]: target.id,
          userId,
          userName: name,
          user: { id: userId, name },
        });
        emitTypingUpdate(target);
      } catch {
        /* a failed typing notification must never affect the socket */
      }
    });

    onEvent("typing:stop", (payload) => {
      try {
        const target = typingTarget(payload);
        if (!target || !socket.rooms.has(target.room)) return;

        clearTyper(target, String(userId));
        socket.to(target.room).emit("typing:stop", {
          [target.key]: target.id,
          userId,
          user: { id: userId },
        });
      } catch {
        /* ignore */
      }
    });

    // Canvas stroke broadcasting
    onEvent("canvas:draw", (payload) => {
      const channelId = idFromPayload(payload, "channelId");
      if (!channelId || typeof payload !== "object") return;
      if (!socket.rooms.has(`channel:${channelId}`)) return;
      socket.to(`channel:${channelId}`).emit("canvas:draw", {
        channelId,
        stroke: payload.stroke,
      });
    });

    // Heartbeat for status updates (online / idle / dnd)

    onEvent("presence:heartbeat", (payload) => {
      const status =
        payload && typeof payload === "object" && typeof payload.status === "string"
          ? payload.status
          : undefined;
      const info = socketUserMap.get(socket.id);
      if (info) {
        info.lastSeen = new Date();
      }
      emitPresence({
        userId,
        status: status || "online",
      });
    });

    // Handle Disconnect
    onEvent("disconnect", () => {
      if (expiryTimer) clearTimeout(expiryTimer);

      // Drop this socket's typing entries (and tell the rooms) before its
      // membership data disappears.
      for (const [room, active] of [...typing]) {
        for (const [typerId, entry] of [...active]) {
          if (entry.socketId !== socket.id) continue;
          const isChannel = room.startsWith("channel_");
          const id = room.slice(isChannel ? "channel_".length : "conversation_".length);
          clearTyper(
            { key: isChannel ? "channelId" : "conversationId", id, room },
            typerId,
          );
        }
      }

      const info = socketUserMap.get(socket.id);
      if (info) {
        socketUserMap.delete(socket.id);
      }

      // Stop any in-flight society resolution from emitting or joining.
      const room = societyRoom;
      socketClosed = true;

      const userSet = userSockets.get(userId);
      if (userSet) {
        userSet.delete(socket.id);
        const status = userSet.size === 0 ? "offline" : "online";
        if (userSet.size === 0) {
          userSockets.delete(userId);
        }
        // Tell only the user's own society (never a global broadcast).
        if (room) {
          io.to(room).emit("presence:update", { userId, status });
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
