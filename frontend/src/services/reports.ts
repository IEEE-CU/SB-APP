import api from '@/lib/api';
import type { ApiResponse, PaginatedResponse } from '@/types/api';
import type { Report } from '@/types/models';

export const reportService = {
  getReports: (page = 1, limit = 20) =>
    api.get<PaginatedResponse<Report>>('/project-reports', {
      params: { page, limit },
    }),
  getReport: (id: string) => api.get<ApiResponse<Report>>(`/project-reports/${id}`),
  createReport: (data: Pick<Report, 'title' | 'content' | 'type'>) =>
    api.post<ApiResponse<Report>>('/project-reports', data),
  updateReport: (
    id: string,
    data: Partial<Pick<Report, 'title' | 'content' | 'type'>>,
  ) => api.patch<ApiResponse<Report>>(`/project-reports/${id}`, data),
  deleteReport: (id: string) =>
    api.delete<ApiResponse<null>>(`/project-reports/${id}`),
};
