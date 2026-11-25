import { create } from "zustand";

import { login as loginApi, logout as logoutApi } from "../lib/auth-api";

import { clearTokens, getAccessToken } from "../lib/auth-storage";

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  mobile: string | null;
  role: "admin" | "technician";
  organizationId: string;
  isActive: boolean;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;

  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearLocalSession: () => Promise<void>;
  setUser: (user: AuthUser) => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,

  signIn: async (email, password) => {
    set({ isLoading: true });

    try {
      const user = await loginApi(email, password);

      set({
        user,
        isAuthenticated: true,
      });
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    try {
      await logoutApi();
    } finally {
      set({
        user: null,
        isAuthenticated: false,
      });
    }
  },

  clearLocalSession: async () => {
    await clearTokens();

    set({
      user: null,
      isAuthenticated: false,
    });
  },

  setUser: (user) => {
    set({ user });
  },

  initialize: async () => {
    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        set({
          isAuthenticated: false,
          user: null,
        });
        return;
      }

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/auth/me`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!response.ok) {
        await clearTokens();

        set({
          user: null,
          isAuthenticated: false,
        });

        return;
      }

      const result = await response.json();

      set({
        user: result.data,
        isAuthenticated: true,
      });
    } catch {
      await clearTokens();

      set({
        user: null,
        isAuthenticated: false,
      });
    } finally {
      set({ isInitialized: true });
    }
  },
}));
