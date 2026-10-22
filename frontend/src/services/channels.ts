import api from "@/lib/api";
import type { ApiResponse } from "@/types/api";
import type { Channel, Message } from "@/types/models";
import { reactionRequest } from "@/lib/reactionRequest";

export const channelsService = {
  /**
   * Lists channels for the given society. When societyId is omitted the
   * backend falls back to the authenticated user's own society scope.
   */
  getChannels: (societyId?: string) =>
    api.get<ApiResponse<Channel[]>>("/channels", {
      params: societyId ? { societyId } : undefined,
    }),

  getChannel: (channelId: string) =>
    api.get<ApiResponse<Channel>>(`/channels/${channelId}`),

  createChannel: (data: {
    name: string;
    description?: string;
    isPrivate?: boolean;
    societyId?: string;
  }) => api.post<ApiResponse<Channel>>("/channels", data),

  updateChannel: (
    channelId: string,
    data: { name?: string; description?: string; isPrivate?: boolean },
  ) => api.put<ApiResponse<Channel>>(`/channels/${channelId}`, data),

  deleteChannel: (channelId: string) =>
    api.delete<ApiResponse<null>>(`/channels/${channelId}`),

  getChannelMessages: (channelId: string) =>
    api.get<ApiResponse<Message[]>>(`/channels/${channelId}/messages`),

  sendChannelMessage: (
    channelId: string,
    content: string,
    parentId?: string,
    attachments?: string[],
    poll?: any,
  ) =>
    api.post<ApiResponse<Message>>(`/channels/${channelId}/messages`, {
      content,
      parentId,
      attachments,
      poll,
    }),

  // Adds the reaction, or removes it if this user already has it: the server has one toggling
  // endpoint and no DELETE route (see lib/reactionRequest.ts). The response is the message's
  // list of reaction records; convert it with groupReactions before showing it.
  toggleReaction: (messageId: string, emoji: string) => {
    const { url, body } = reactionRequest(messageId, emoji);
    return api.post<ApiResponse<unknown>>(url, body);
  },

  addMember: (channelId: string, userId: string) =>
    api.post<ApiResponse<Channel>>(`/channels/${channelId}/members`, {
      userId,
    }),

  removeMember: (channelId: string, userId: string) =>
    api.delete<ApiResponse<Channel>>(`/channels/${channelId}/members`, {
      data: { userId },
    }),

  castVote: (messageId: string, optionIndex: number) =>
    api.post<ApiResponse<Message>>(
      `/channels/messages/${messageId}/poll/vote`,
      { optionIndex },
    ),
};
