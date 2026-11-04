// The messages API and the real-time events all send a message in the server's shape:
//
//   { id, body, plainText, authorId: { id, name, email } | null, channelId | null,
//     conversationId | null, parentMessageId | null, createdAt, updatedAt, reactions, poll?, ... }
//
// The UI's Message type is { id, sender: { id, name }, content, parentId, reactions: [{ emoji,
// users }], ... }. Components used to store the server's payload as if it were that type, so the
// first incoming message made the Community page throw (`msg.sender` was undefined) and message
// text never showed in channel feeds. This is the ONE place the two are reconciled. Only the
// documented server shape is accepted - there is no guessing between alternative field names:
// a payload that does not match is rejected (null) and the caller ignores it instead of
// rendering something half-formed.
//
// One documented case: `authorId` is null when the author's account no longer exists (the
// server's populate yields null). Such a message is kept and shown as "Unknown member" with an
// empty id, which never equals the signed-in user's id.
//
// Reactions arrive as one record per (user, emoji) - { value, userId } - and are grouped here
// into the UI's { emoji, users } form. Other fields (for example `poll`) are passed through.
//
// Only a type is imported (erased at build time), so this runs under Node's test runner.

import type { Message, Reaction } from '@/types/models';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null => (typeof value === 'string' ? value : null);

function normalizeSender(authorId: unknown): Message['sender'] | null {
  if (authorId === null) return { id: '', name: 'Unknown member' };
  if (isObject(authorId) && typeof authorId.id === 'string' && typeof authorId.name === 'string') {
    return { id: authorId.id, name: authorId.name };
  }
  return null;
}

/** Server reaction records ({ value, userId }) -> the UI's grouped { emoji, users }. */
export function groupReactions(raw: unknown): Reaction[] {
  if (!Array.isArray(raw)) return [];
  const byEmoji = new Map<string, string[]>();
  for (const entry of raw) {
    if (!isObject(entry)) continue;
    const emoji = text(entry.value);
    const user = isObject(entry.userId) ? text(entry.userId.id) : text(entry.userId);
    if (!emoji || !user) continue;
    const users = byEmoji.get(emoji) ?? [];
    if (!users.includes(user)) users.push(user);
    byEmoji.set(emoji, users);
  }
  return [...byEmoji].map(([emoji, users]) => ({ emoji, users }));
}

/** A server message -> the UI's Message, or null if it does not match the server's contract. */
export function normalizeMessage(raw: unknown): Message | null {
  if (!isObject(raw)) return null;
  const id = text(raw.id);
  const body = text(raw.body);
  const createdAt = text(raw.createdAt);
  const updatedAt = text(raw.updatedAt);
  const sender = normalizeSender(raw.authorId);
  if (!id || body === null || !createdAt || !updatedAt || !sender) return null;

  return {
    ...raw,
    id,
    channelId: text(raw.channelId) ?? undefined,
    conversationId: text(raw.conversationId) ?? undefined,
    sender,
    content: body,
    parentId: text(raw.parentMessageId) ?? undefined,
    reactions: groupReactions(raw.reactions),
    createdAt,
    updatedAt,
  } as Message;
}

/** A list of server messages; entries that do not match the contract are left out. */
export function normalizeMessages(raw: unknown): Message[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeMessage).filter((message): message is Message => message !== null);
}
