export interface User {
  id: string;
  email: string;
  fullName: string;
  organization?: string;
  role?: string;
  avatarUrl?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password?: string;
  rememberMe?: boolean;
}

export interface RegisterCredentials {
  fullName: string;
  email: string;
  password?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  expiresIn: number;
}
