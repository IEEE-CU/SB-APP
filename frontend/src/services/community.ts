import api from '@/lib/api';
import type { ApiResponse, PaginatedResponse } from '@/types/api';
import type { CommunityMessage } from '@/types/models';

export const communityService = {
  getMessages: (page = 1, limit = 50) =>
    api.get<PaginatedResponse<CommunityMessage>>('/community/messages', {
      params: { page, limit },
    }),
  sendMessage: (content: string) =>
    api.post<ApiResponse<CommunityMessage>>('/community/messages', {
      content,
    }),
};
