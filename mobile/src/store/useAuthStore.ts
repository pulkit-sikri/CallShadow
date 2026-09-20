import { create } from 'zustand';
import { authService } from '../services/authService';
import { setApiAuthToken } from '../services/apiClient';
import { AuthState, LoginCredentials, RegisterCredentials } from '../types';

interface AuthActions {
  login: (credentials: LoginCredentials) => Promise<boolean>;
  register: (credentials: RegisterCredentials) => Promise<boolean>;
  loginWithSSO: (provider: 'google' | 'microsoft') => Promise<boolean>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  user: null,
  isAuthenticated: false,
  token: null,
  isLoading: false,
  error: null,

  login: async (credentials) => {
    // Guard: prevent duplicate requests while one is in-flight
    if (get().isLoading) {
      console.warn('[AUTH] login() called while already loading — ignoring duplicate tap');
      return false;
    }
    set({ isLoading: true, error: null });
    try {
      const response = await authService.login(credentials);
      setApiAuthToken(response.token);
      set({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      return true;
    } catch (err: any) {
      set({ error: err.message || 'Failed to log in', isLoading: false });
      return false;
    }
  },


  register: async (credentials) => {
    // Guard: prevent duplicate requests while one is in-flight
    if (get().isLoading) {
      console.warn('[AUTH] register() called while already loading — ignoring duplicate tap');
      return false;
    }
    set({ isLoading: true, error: null });
    try {
      const response = await authService.register(credentials);
      setApiAuthToken(response.token);
      set({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      return true;
    } catch (err: any) {
      set({ error: err.message || 'Failed to create account', isLoading: false });
      return false;
    }
  },


  loginWithSSO: async (provider) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.loginWithProvider(provider);
      setApiAuthToken(response.token);
      set({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      return true;
    } catch (err: any) {
      set({ error: err.message || 'SSO Login failed', isLoading: false });
      return false;
    }
  },

  logout: async () => {
    // 1. Attempt backend logout notification
    try {
      await authService.logout();
    } catch (err) {
      // Ignore network errors on logout
    }

    // 2. Clear global token holder and local store state unconditionally
    setApiAuthToken(null);
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      error: null,
      isLoading: false,
    });
  },

  checkSession: async () => {
    const { token } = get();
    if (!token) {
      setApiAuthToken(null);
      set({ user: null, isAuthenticated: false });
      return;
    }

    try {
      setApiAuthToken(token);
      const user = await authService.getCurrentSession(token);
      if (user) {
        set({ user, isAuthenticated: true });
      } else {
        setApiAuthToken(null);
        set({ user: null, token: null, isAuthenticated: false });
      }
    } catch {
      setApiAuthToken(null);
      set({ user: null, token: null, isAuthenticated: false });
    }
  },

  clearError: () => set({ error: null }),
}));
