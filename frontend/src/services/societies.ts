import api from '@/lib/api';
import type { ApiResponse, PaginatedResponse } from '@/types/api';
import type { Society } from '@/types/models';

export const societyService = {
  getSocieties: (page = 1, limit = 20) =>
    api.get<PaginatedResponse<Society>>('/societies', {
      params: { page, limit },
    }),
  getSociety: (id: string) =>
    api.get<ApiResponse<Society>>(`/societies/${id}`),
  createSociety: (data: Pick<Society, 'name' | 'description'>) =>
    api.post<ApiResponse<Society>>('/societies', data),
  updateSociety: (
    id: string,
    data: Partial<Pick<Society, 'name' | 'description'>>,
  ) => api.patch<ApiResponse<Society>>(`/societies/${id}`, data),
};
