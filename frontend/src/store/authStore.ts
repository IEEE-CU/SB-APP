import { create } from "zustand";
import type { User, Permission, AccessLevel } from "@/types/models";
import { authService } from "@/services/auth";
import api from "@/lib/api";

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
  updateUserProfile: (data: Partial<User>) => void;
}

const safeParseJSON = <T>(key: string, fallback: T): T => {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
};

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem("token"),
  user: safeParseJSON<User | null>("user", null),
  permissions: safeParseJSON<Permission[]>("permissions", []),
  isAuthenticated: !!localStorage.getItem("token"),

  login: async (email, password) => {
    try {
      const res = await authService.login(email, password);
      const payload = res.data.data || res.data;
      const { token, user } = payload;
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      set({ token, user: user as User, isAuthenticated: true });
      await get().fetchPermissions();
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  },

  register: async (name, email, password) => {
    try {
      const res = await authService.register(name, email, password);
      const payload = res.data.data || res.data;
      const { token, user } = payload;
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      set({ token, user: user as User, isAuthenticated: true });
      await get().fetchPermissions();
    } catch (error) {
      console.error("Registration failed:", error);
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("permissions");
    set({ token: null, user: null, permissions: [], isAuthenticated: false });
  },

  fetchPermissions: async () => {
    try {
      const res = await api.get("/user/permissions");
      const payload = res.data.data || res.data;
      const permissions = payload.permissions || [];
      localStorage.setItem("permissions", JSON.stringify(permissions));
      set({ permissions });
    } catch {
      // Keep existing permissions if fetch fails (e.g. offline) unless unauthenticated
    }
  },

  getAccessLevel: (module) => {
    const perm = get().permissions.find((p) => p.module === module);
    return perm?.accessLevel || "none";
  },

  updateUserProfile: (data) => {
    const currentUser = get().user;
    if (currentUser) {
      const updatedUser = { ...currentUser, ...data };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      set({ user: updatedUser });
    }
  },
}));
