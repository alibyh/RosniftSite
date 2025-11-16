// src/services/authService.ts
import { findUserByCredentials } from '../features/auth/data/mockUsers';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    username: string;
    fullName: string;
    company: string;
    branch?: string;
    companyId: string;
    warehouses: Array<{ id: string; address: string }>;
    role: 'admin' | 'user' | 'manager';
  };
}

export const authService = {
    async login(credentials: LoginCredentials): Promise<AuthResponse> {
        // For development: Use mock users if API is not available
        if (import.meta.env.DEV || !import.meta.env.VITE_API_URL) {
          const user = findUserByCredentials(credentials.username, credentials.password);
          
          if (!user) {
            throw new Error('INVALID_CREDENTIALS');
          }
    
          // Simulate API delay
          await new Promise(resolve => setTimeout(resolve, 1000));
    
          // Return mock response
          return {
            token: `mock-token-${user.id}-${Date.now()}`,
            user: {
              id: user.id,
              username: user.username,
              fullName: user.fullName,
              company: user.company,
              branch: user.branch,
              companyId: user.companyId,
              warehouses: user.warehouses.map((warehouse, index) => ({
                id: `${user.id}-warehouse-${index}`,
                address: warehouse.address
              })),
              role: user.role
            }
          };
        }
    
        // Production: Use real API
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(credentials),
        });
    
        if (!response.ok) {
          const error = await response.json();
          // Return error code that can be translated
          if (error.message) {
            throw new Error(error.message);
          } else if (response.status === 401) {
            throw new Error('INVALID_CREDENTIALS');
          } else if (response.status >= 500) {
            throw new Error('SERVER_ERROR');
          } else {
            throw new Error('LOGIN_FAILED');
          }
        }
    
        return response.json();
  },

  async validateToken(token: string): Promise<boolean> {
    // For development: Always return true for mock tokens
    if (import.meta.env.DEV || !import.meta.env.VITE_API_URL) {
      return token.startsWith('mock-token-');
    }
    
    // Production: Validate token with backend
    try {
      const response = await fetch(`${API_BASE_URL}/auth/validate`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  },

  // Token storage helpers
  getStoredToken(): string | null {
    // Check localStorage first (remember me), then sessionStorage
    return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
  },

  getStoredUser(): AuthResponse['user'] | null {
    const userStr = localStorage.getItem('userSession') || sessionStorage.getItem('userSession');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  getStorageType(): 'localStorage' | 'sessionStorage' | null {
    if (localStorage.getItem('authToken')) return 'localStorage';
    if (sessionStorage.getItem('authToken')) return 'sessionStorage';
    return null;
  },

  clearStoredAuth(): void {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userSession');
    localStorage.removeItem('rememberMe');
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('userSession');
  },

  storeAuth(token: string, user: AuthResponse['user'], rememberMe: boolean): void {
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem('authToken', token);
    storage.setItem('userSession', JSON.stringify(user));
    if (rememberMe) {
      localStorage.setItem('rememberMe', 'true');
    } else {
      localStorage.removeItem('rememberMe');
    }
  },

  getRememberMe(): boolean {
    return localStorage.getItem('rememberMe') === 'true';
  },
};