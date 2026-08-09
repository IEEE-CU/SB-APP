import api from '@/lib/api';
import type { ApiResponse } from '@/types/api';
import type { Conversation, Message } from '@/types/models';

export const conversationsService = {
  getConversations: () =>
    api.get<ApiResponse<Conversation[]>>('/conversations'),

  getConversation: (conversationId: string) =>
    api.get<ApiResponse<Conversation>>(`/conversations/${conversationId}`),

  createConversation: (participantIds: string[]) =>
    api.post<ApiResponse<Conversation>>('/conversations', { participantIds }),

  getConversationMessages: (conversationId: string) =>
    api.get<ApiResponse<Message[]>>(`/conversations/${conversationId}/messages`),

  sendConversationMessage: (conversationId: string, content: string, parentId?: string, attachments?: string[]) =>
    api.post<ApiResponse<Message>>(`/conversations/${conversationId}/messages`, {
      content,
      parentId,
      attachments,
    }),
};
