"use strict";

const Message = require("../models/Message");

const PREVIEW_MAX_LENGTH = 200;

const idOf = (ref) => (ref && ref._id ? String(ref._id) : ref ? String(ref) : "");

/**
 * Reduce stored message text to plain text for a sidebar preview. Messages keep their rich text
 * in `body` (may be HTML) and a plain version in `plainText`, but a client may send HTML in either,
 * so tags are always stripped here. Only harmless entities are decoded; &lt; and &gt; stay
 * encoded so the result can never turn back into markup.
 */
function toPlainPreview(message) {
  const source = typeof message?.plainText === "string" && message.plainText.trim() ? message.plainText : message?.body;
  if (typeof source !== "string") return "";
  let text = source;
  // Repeat until stable so nested fragments like "<<b>script>" cannot reassemble into a tag.
  for (let previous = null; previous !== text; ) {
    previous = text;
    text = text.replace(/<[^>]*>?/g, " ");
  }
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > PREVIEW_MAX_LENGTH ? `${text.slice(0, PREVIEW_MAX_LENGTH - 1)}…` : text;
}

/**
 * Shape one stored message as the frontend `Message` the sidebar reads. `participants` are the
 * conversation's already-populated users, which always include the author.
 */
function toLastMessage(message, conversation) {
  const authorId = idOf(message.authorId);
  const author = [conversation.userOneId, conversation.userTwoId].find((user) => idOf(user) === authorId);
  return {
    id: String(message._id),
    conversationId: String(message.conversationId),
    sender: { id: authorId, name: author?.name || "" },
    content: toPlainPreview(message),
    reactions: [],
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
}

/**
 * Add `lastMessage` to each conversation (as plain JSON objects) with ONE aggregate, no matter how
 * many conversations there are. Only top-level messages count, the same set GET /:id/messages
 * lists. Callers must pass only conversations the requester participates in; ids come from
 * those documents and from nowhere else. A conversation with no messages gets no lastMessage key.
 */
async function withLastMessages(conversations) {
  if (!conversations.length) return [];
  const latest = await Message.aggregate([
    { $match: { conversationId: { $in: conversations.map((c) => c._id) }, parentMessageId: null } },
    { $sort: { createdAt: -1, _id: -1 } },
    { $group: { _id: "$conversationId", message: { $first: "$$ROOT" } } },
    { $project: { "message._id": 1, "message.conversationId": 1, "message.authorId": 1, "message.body": 1, "message.plainText": 1, "message.createdAt": 1, "message.updatedAt": 1 } },
  ]);
  const byConversation = new Map(latest.map((row) => [String(row._id), row.message]));
  return conversations.map((conversation) => {
    const json = typeof conversation.toJSON === "function" ? conversation.toJSON() : { ...conversation };
    const message = byConversation.get(String(conversation._id));
    return message ? { ...json, lastMessage: toLastMessage(message, conversation) } : json;
  });
}

module.exports = { toPlainPreview, toLastMessage, withLastMessages, PREVIEW_MAX_LENGTH };
