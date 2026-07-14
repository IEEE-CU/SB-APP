import api from '@/lib/api';
import type { ApiResponse, PaginatedResponse } from '@/types/api';
import type { Announcement } from '@/types/models';

export const announcementService = {
  getAnnouncements: (page = 1, limit = 20) =>
    api.get('/announcements', { params: { page, limit } }).then(res => {
      if (res.data && res.data.data) {
        res.data.data = res.data.data.map((a: any) => ({
          ...a,
          content: a.content || a.message,
          priority: a.priority || 'medium'
        }));
      }
      return res;
    }) as Promise<import('axios').AxiosResponse<PaginatedResponse<Announcement>>>,
  getAnnouncement: (id: string) =>
    api.get(`/announcements/${id}`).then(res => {
      if (res.data && res.data.data) {
        res.data.data.content = res.data.data.content || res.data.data.message;
        res.data.data.priority = res.data.data.priority || 'medium';
      }
      return res;
    }) as Promise<import('axios').AxiosResponse<ApiResponse<Announcement>>>,
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
