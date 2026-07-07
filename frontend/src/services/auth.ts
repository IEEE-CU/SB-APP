import api from '@/lib/api';
import type { ApiResponse } from '@/types/api';

export interface AuthResponse {
  token: string;
  user: { id: string; name: string; email: string };
}

export const authService = {
  login: (email: string, password: string) =>
    api.post<ApiResponse<AuthResponse>>('/auth/login', { email, password }),
  register: (name: string, email: string, password: string) =>
    api.post<ApiResponse<AuthResponse>>('/auth/register', {
      name,
      email,
      password,
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<ApiResponse<null>>('/auth/change-password', {
      currentPassword,
      newPassword,
    }),
};
