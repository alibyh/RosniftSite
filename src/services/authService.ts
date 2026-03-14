// src/services/authService.ts
import { userService } from './userService';
import { verifyPassword } from '../utils/passwordUtils';

export type UserRole = 'admin' | 'manager';

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
    email: string;
    company: string;
    branch?: string;
    companyId: string;
    warehouses: Array<{ id?: string; address?: string }>;
    role: UserRole;
  };
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const row = await userService.getUserByUsername(credentials.username);
    if (!row) {
      throw new Error('INVALID_CREDENTIALS');
    }

    const valid = await verifyPassword(credentials.password, row.password_hash);
    if (!valid) {
      throw new Error('INVALID_CREDENTIALS');
    }

    const warehouses = Array.isArray(row.warehouses) ? row.warehouses : [];
    const user = {
      id: row.id,
      username: row.username,
      fullName: row.full_name,
      email: row.email,
      company: row.company_name ?? '',
      branch: row.branch ?? '',
      companyId: row.company_id ?? '',
      warehouses: warehouses.map((w: unknown) =>
        typeof w === 'object' && w !== null && 'address' in (w as object)
          ? { address: (w as { address?: string }).address }
          : { address: String(w) }
      ),
      role: (row.role === 'admin' ? 'admin' : 'manager') as UserRole,
    };

    const token = `sb-${row.id}-${Date.now()}`;
    return { token, user };
  },

  async validateToken(token: string): Promise<boolean> {
    // Client-side app: trust locally stored SB tokens so refresh / new tabs stay logged in
    return !!token && token.startsWith('sb-');
  },

  getStoredToken(): string | null {
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
    localStorage.setItem('authToken', token);
    localStorage.setItem('userSession', JSON.stringify(user));
    if (rememberMe) {
      localStorage.setItem('rememberMe', 'true');
    } else {
      localStorage.removeItem('rememberMe');
    }
  },

  getRememberMe(): boolean {
    return localStorage.getItem('rememberMe') === 'true';
  },

  persistSessionToLocalStorage(token?: string, user?: AuthResponse['user']): void {
    const t = token ?? sessionStorage.getItem('authToken');
    const u =
      user ??
      (() => {
        const s = sessionStorage.getItem('userSession');
        if (!s) return null;
        try {
          return JSON.parse(s) as AuthResponse['user'];
        } catch {
          return null;
        }
      })();
    if (t && u) {
      localStorage.setItem('authToken', t);
      localStorage.setItem('userSession', JSON.stringify(u));
    }
  },
};
