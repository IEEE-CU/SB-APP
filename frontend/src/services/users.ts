import api from '@/lib/api';
import type { ApiResponse, PaginatedResponse } from '@/types/api';
import type { User } from '@/types/models';

export const userService = {
  getUsers: (page = 1, limit = 20) =>
    api.get<PaginatedResponse<User>>('/users', { params: { page, limit } }),
  getUser: (id: string) => api.get<ApiResponse<User>>(`/users/${id}`),
  updateUser: (
    id: string,
    data: Partial<Pick<User, 'name' | 'avatarUrl'>>,
  ) => api.patch<ApiResponse<User>>(`/users/${id}`, data),
};
