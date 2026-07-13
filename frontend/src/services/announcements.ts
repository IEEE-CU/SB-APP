import api from '@/lib/api';
import type { ApiResponse, PaginatedResponse } from '@/types/api';
import type { Announcement } from '@/types/models';

export const announcementService = {
  getAnnouncements: (page = 1, limit = 20) =>
    api.get<PaginatedResponse<Announcement>>('/announcements', {
      params: { page, limit },
    }),
  getAnnouncement: (id: string) =>
    api.get<ApiResponse<Announcement>>(`/announcements/${id}`),
  createAnnouncement: (
    data: Pick<Announcement, 'title' | 'content' | 'priority'>,
  ) => api.post<ApiResponse<Announcement>>('/announcements', { ...data, message: data.content }),
  updateAnnouncement: (
    id: string,
    data: Partial<Pick<Announcement, 'title' | 'content' | 'priority'>>,
  ) => api.patch<ApiResponse<Announcement>>(`/announcements/${id}`, { ...data, message: data.content }),
  deleteAnnouncement: (id: string) =>
    api.delete<ApiResponse<null>>(`/announcements/${id}`),
};
