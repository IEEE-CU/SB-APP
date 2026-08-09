import api from '@/lib/api';
import type { ApiResponse } from '@/types/api';
import type { Channel, Message } from '@/types/models';

export const channelsService = {
  getChannels: () =>
    api.get<ApiResponse<Channel[]>>('/channels'),

  getChannel: (channelId: string) =>
    api.get<ApiResponse<Channel>>(`/channels/${channelId}`),

  createChannel: (data: { name: string; description?: string; isPrivate?: boolean; societyId?: string }) =>
    api.post<ApiResponse<Channel>>('/channels', data),

  updateChannel: (channelId: string, data: { name?: string; description?: string; isPrivate?: boolean }) =>
    api.put<ApiResponse<Channel>>(`/channels/${channelId}`, data),

  deleteChannel: (channelId: string) =>
    api.delete<ApiResponse<null>>(`/channels/${channelId}`),

  getChannelMessages: (channelId: string) =>
    api.get<ApiResponse<Message[]>>(`/channels/${channelId}/messages`),

  sendChannelMessage: (channelId: string, content: string, parentId?: string, attachments?: string[], poll?: any) =>
    api.post<ApiResponse<Message>>(`/channels/${channelId}/messages`, {
      content,
      parentId,
      attachments,
      poll,
    }),

  addReaction: (messageId: string, emoji: string) =>
    api.post<ApiResponse<Message>>(`/messages/${messageId}/reactions`, { emoji }),

  removeReaction: (messageId: string, emoji: string) =>
    api.delete<ApiResponse<Message>>(`/messages/${messageId}/reactions`, { data: { emoji } }),

  addMember: (channelId: string, userId: string) =>
    api.post<ApiResponse<Channel>>(`/channels/${channelId}/members`, { userId }),

  removeMember: (channelId: string, userId: string) =>
    api.delete<ApiResponse<Channel>>(`/channels/${channelId}/members`, { data: { userId } }),

  castVote: (messageId: string, optionIndex: number) =>
    api.post<ApiResponse<Message>>(`/channels/messages/${messageId}/poll/vote`, { optionIndex }),
};
