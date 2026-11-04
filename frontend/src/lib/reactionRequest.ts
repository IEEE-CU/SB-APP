// The server has exactly ONE reaction endpoint:
//
//   POST /api/v1/channels/messages/:messageId/reactions    body { value: <emoji> }
//
// It toggles: the first request by a user for an emoji adds the reaction, the next one removes
// it (there is no DELETE route), and the response is the message's full list of reaction
// records. The client used to call POST /messages/:id/reactions with { emoji } (and DELETE for
// removal), neither of which exists. This is the single place the URL and body are built, so the
// contract can be tested without a browser. No imports.

export interface ReactionRequest {
  /** Relative to the API base URL (/api/v1). */
  url: string;
  body: { value: string };
}

export function reactionRequest(messageId: string, emoji: string): ReactionRequest {
  return {
    url: `/channels/messages/${encodeURIComponent(messageId)}/reactions`,
    body: { value: emoji },
  };
}
