import { create } from 'zustand';
import type { User, Permission, AccessLevel } from '@/types/models';
import { authService } from '@/services/auth';
import api from '@/lib/api';

interface AuthState {
  token: string | null;
  user: User | null;
  permissions: Permission[];
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchPermissions: () => Promise<void>;
  getAccessLevel: (module: string) => AccessLevel;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('token'),
  user: null,
  permissions: [],
  isAuthenticated: !!localStorage.getItem('token'),

  login: async (email, password) => {
    const res = await authService.login(email, password);
    const { token, user } = res.data.data;
    localStorage.setItem('token', token);
    set({ token, user: user as User, isAuthenticated: true });
    await get().fetchPermissions();
  },

  register: async (name, email, password) => {
    const res = await authService.register(name, email, password);
    const { token, user } = res.data.data;
    localStorage.setItem('token', token);
    set({ token, user: user as User, isAuthenticated: true });
    await get().fetchPermissions();
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ token: null, user: null, permissions: [], isAuthenticated: false });
  },

  fetchPermissions: async () => {
    try {
      const res = await api.get('/user/permissions');
      set({ permissions: res.data.data.permissions || [] });
    } catch {
      set({ permissions: [] });
    }
  },

  getAccessLevel: (module) => {
    const perm = get().permissions.find((p) => p.module === module);
    return perm?.accessLevel || 'none';
  },
}));
