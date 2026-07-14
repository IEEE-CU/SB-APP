import { create } from "zustand";
import type { User, Permission, AccessLevel } from "@/types/models";
import { authService } from "@/services/auth";
import api from "@/lib/api";

interface AuthState {
  token: string | null;
  user: User | null;
  permissions: Permission[];
  userRole: string;
  userScope: { type: string; societyId: string | null } | null;
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
  userRole: localStorage.getItem("userRole") || "",
  userScope: safeParseJSON<{ type: string; societyId: string | null } | null>(
    "userScope",
    null,
  ),
  isAuthenticated: !!localStorage.getItem("token"),

  login: async (email, password) => {
    const res = await authService.login(email, password);
    const { token, user } = res.data.data;
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    set({ token, user: user as User, isAuthenticated: true });
    await get().fetchPermissions();
  },

  register: async (name, email, password) => {
    const res = await authService.register(name, email, password);
    const { token, user } = res.data.data;
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    set({ token, user: user as User, isAuthenticated: true });
    await get().fetchPermissions();
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("permissions");
    localStorage.removeItem("userRole");
    localStorage.removeItem("userScope");
    set({
      token: null,
      user: null,
      permissions: [],
      userRole: "",
      userScope: null,
      isAuthenticated: false,
    });
  },

  fetchPermissions: async () => {
    try {
      const res = await api.get("/user/permissions");
      const {
        permissions: perms = [],
        role = "",
        scope = null,
      } = res.data.data;
      localStorage.setItem("permissions", JSON.stringify(perms));
      localStorage.setItem("userRole", role);
      localStorage.setItem("userScope", JSON.stringify(scope));
      set({ permissions: perms, userRole: role, userScope: scope });
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
