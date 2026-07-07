import api from '@/lib/api';
import type { ApiResponse, PaginatedResponse } from '@/types/api';
import type { Report } from '@/types/models';

export const reportService = {
  getReports: (page = 1, limit = 20) =>
    api.get<PaginatedResponse<Report>>('/reports', {
      params: { page, limit },
    }),
  getReport: (id: string) => api.get<ApiResponse<Report>>(`/reports/${id}`),
  createReport: (data: Pick<Report, 'title' | 'content' | 'type'>) =>
    api.post<ApiResponse<Report>>('/reports', data),
  updateReport: (
    id: string,
    data: Partial<Pick<Report, 'title' | 'content' | 'type'>>,
  ) => api.patch<ApiResponse<Report>>(`/reports/${id}`, data),
  deleteReport: (id: string) =>
    api.delete<ApiResponse<null>>(`/reports/${id}`),
};
