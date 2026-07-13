import api from '@/lib/api';
import type { ApiResponse, PaginatedResponse } from '@/types/api';
import type { Project } from '@/types/models';

export const projectService = {
  getProjects: (page = 1, limit = 20) =>
    api.get<PaginatedResponse<Project>>('/projects', {
      params: { page, limit },
    }),
  getProject: (id: string) =>
    api.get<ApiResponse<Project>>(`/projects/${id}`),
  createProject: (data: Pick<Project, 'title' | 'description' | 'status'>) =>
    api.post<ApiResponse<Project>>('/projects', data),
  updateProject: (
    id: string,
    data: Partial<Pick<Project, 'title' | 'description' | 'status'>>,
  ) => api.put<ApiResponse<Project>>(`/projects/${id}`, data),
  deleteProject: (id: string) =>
    api.delete<ApiResponse<null>>(`/projects/${id}`),
};
