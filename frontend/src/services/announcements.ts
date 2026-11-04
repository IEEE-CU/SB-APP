import api from '@/lib/api';
import type { ApiResponse, PaginatedResponse } from '@/types/api';
import type { Announcement } from '@/types/models';

export type AnnouncementAudience = NonNullable<Announcement['targetAudience']>;

export interface AnnouncementPayload extends Pick<Announcement, 'title' | 'content' | 'priority'> {
  targetAudience: AnnouncementAudience;
  societyId?: string;
}

export const announcementService = {
  getAnnouncements: (page = 1, limit = 20) =>
    api.get<PaginatedResponse<Announcement>>('/announcements', {
      params: { page, limit },
    }),
  getAnnouncement: (id: string) =>
    api.get<ApiResponse<Announcement>>(`/announcements/${id}`),
  // The backend requires targetAudience, and a societyId for SOCIETY; it decides who
  // may use which audience.
  createAnnouncement: (data: AnnouncementPayload) =>
    api.post<ApiResponse<Announcement>>('/announcements', data),
  updateAnnouncement: (id: string, data: Partial<AnnouncementPayload>) => api.patch<ApiResponse<Announcement>>(`/announcements/${id}`, data),
  deleteAnnouncement: (id: string) =>
    api.delete<ApiResponse<null>>(`/announcements/${id}`),
};
