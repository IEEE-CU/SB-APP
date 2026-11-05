import api from "@/lib/api";
import type { ApiResponse } from "@/types/api";
import type { Conversation, Message } from "@/types/models";

export const conversationsService = {
  getConversations: () =>
    api.get<ApiResponse<Conversation[]>>("/conversations"),

  // The members of the caller's own society, as { id, name } only (GET /users is admin-only).
  getRecipients: () =>
    api.get<ApiResponse<Array<{ id: string; name: string }>>>(
      "/conversations/recipients",
    ),

  // An administrator belongs to no society, so the conversation names the society it lives in.
  createConversation: (participantIds: string[], societyId?: string) =>
    api.post<ApiResponse<Conversation>>("/conversations", {
      participantIds,
      societyId,
    }),

  getConversationMessages: (conversationId: string) =>
    api.get<ApiResponse<Message[]>>(
      `/conversations/${conversationId}/messages`,
    ),

  sendConversationMessage: (
    conversationId: string,
    content: string,
    parentId?: string,
    attachments?: string[],
  ) =>
    api.post<ApiResponse<Message>>(
      `/conversations/${conversationId}/messages`,
      {
        content,
        parentId,
        attachments,
      },
    ),
};
