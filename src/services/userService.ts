import { supabase } from './supabaseClient';
import { hashPassword } from '../utils/passwordUtils';

export type UserRole = 'admin' | 'manager';

export interface AppUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  balanceUnit: string | null;
  company: string;
  branch: string;
  companyId: string;
  warehouses: Array<{ id?: string; address?: string }>;
  role: UserRole;
}

interface AppUserRow {
  id: string;
  username: string;
  full_name: string;
  email: string;
  password_hash: string;
  balance_unit: string | null;
  company_name: string | null;
  branch: string | null;
  company_id: string | null;
  warehouses: unknown;
  role: string;
}

function mapRowToUser(row: AppUserRow): AppUser {
  const wh = Array.isArray(row.warehouses) ? row.warehouses : [];
  const warehouses = wh.map((w: unknown) =>
    typeof w === 'object' && w !== null && 'address' in (w as object)
      ? { address: (w as { address?: string }).address }
      : { address: String(w) }
  );
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    email: row.email,
    balanceUnit: row.balance_unit ?? null,
    company: row.company_name ?? '',
    branch: row.branch ?? '',
    companyId: row.company_id ?? '',
    warehouses,
    role: row.role === 'admin' ? 'admin' : 'manager',
  };
}

export interface UserFormData {
  username: string;
  fullName: string;
  password: string;
  email: string;
  balanceUnit: string;
  company: string;
  branch: string;
  companyId: string;
  warehouses: Array<{ address: string }>;
  role: UserRole;
}

export const userService = {
  async getAllUsers(): Promise<AppUser[]> {
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .order('username', { ascending: true });

    if (error) {
      throw new Error(`Ошибка загрузки пользователей: ${error.message}`);
    }
    return (data ?? []).map(mapRowToUser);
  },

  async getUserById(id: string): Promise<AppUser | null> {
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return mapRowToUser(data as AppUserRow);
  },

  async getUserByUsername(username: string): Promise<(AppUserRow & { password_hash: string }) | null> {
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !data) return null;
    return data as AppUserRow & { password_hash: string };
  },

  async createUser(userData: UserFormData): Promise<AppUser> {
    const hash = await hashPassword(userData.password);
    const warehouses = userData.warehouses ?? [];
    const { data, error } = await supabase
      .from('app_users')
      .insert({
        username: userData.username,
        full_name: userData.fullName,
        email: userData.email,
        password_hash: hash,
        balance_unit: userData.balanceUnit || null,
        company_name: userData.company || null,
        branch: userData.branch || null,
        company_id: userData.companyId || null,
        warehouses: warehouses.map((w) => ({ address: w.address })),
        role: userData.role,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Ошибка создания пользователя: ${error.message}`);
    }
    return mapRowToUser(data as AppUserRow);
  },

  async updateUser(id: string, userData: Partial<UserFormData>): Promise<AppUser> {
    const updates: Record<string, unknown> = {};
    if (userData.username != null) updates.username = userData.username;
    if (userData.fullName != null) updates.full_name = userData.fullName;
    if (userData.email != null) updates.email = userData.email;
    if (userData.balanceUnit != null) updates.balance_unit = userData.balanceUnit || null;
    if (userData.company != null) updates.company_name = userData.company || null;
    if (userData.branch != null) updates.branch = userData.branch || null;
    if (userData.companyId != null) updates.company_id = userData.companyId || null;
    if (userData.role != null) updates.role = userData.role;
    if (userData.warehouses != null) updates.warehouses = userData.warehouses.map((w) => ({ address: w.address }));
    if (userData.password && userData.password.trim()) {
      updates.password_hash = await hashPassword(userData.password);
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('app_users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Ошибка обновления пользователя: ${error.message}`);
    }
    return mapRowToUser(data as AppUserRow);
  },

  async deleteUser(id: string): Promise<void> {
    const { error } = await supabase.from('app_users').delete().eq('id', id);
    if (error) {
      throw new Error(`Ошибка удаления пользователя: ${error.message}`);
    }
  },
};
