import api from '@/lib/api';
import type { ApiResponse, PaginatedResponse } from '@/types/api';
import type { Event } from '@/types/models';

export const eventService = {
  getEvents: (page = 1, limit = 20) =>
    api.get<PaginatedResponse<Event>>('/events', { params: { page, limit } }),
  getEvent: (id: string) => api.get<ApiResponse<Event>>(`/events/${id}`),
  createEvent: (
    data: Pick<Event, 'title' | 'description' | 'date' | 'location' | 'status'>,
  ) => api.post<ApiResponse<Event>>('/events', data),
  updateEvent: (
    id: string,
    data: Partial<
      Pick<Event, 'title' | 'description' | 'date' | 'location' | 'status'>
    >,
  ) => api.patch<ApiResponse<Event>>(`/events/${id}`, data),
  deleteEvent: (id: string) => api.delete<ApiResponse<null>>(`/events/${id}`),
};
