import type { User } from './user.model';

/**
 * Auth response from login/refresh endpoints
 */
export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  email: string;
  password: string;
  tenantSlug?: string;
}
