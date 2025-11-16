import { mockUsers, MockUser } from '../features/auth/data/mockUsers';

// In a real app, this would use an API
// For now, we'll use localStorage to persist changes to mockUsers
const STORAGE_KEY = 'admin_users';

// Get users from storage or use mock data
const getUsers = (): MockUser[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return mockUsers;
    }
  }
  return mockUsers;
};

// Save users to storage
const saveUsers = (users: MockUser[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
};

export interface UserFormData {
  username: string;
  fullName: string;
  password: string;
  company: string;
  branch: string;
  companyId: string;
  email: string;
  warehouses: Array<{ address: string }>;
  role: 'admin' | 'user' | 'manager';
}

export const userService = {
  /**
   * Get all users
   */
  async getAllUsers(): Promise<MockUser[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    return getUsers();
  },

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<MockUser | null> {
    await new Promise(resolve => setTimeout(resolve, 300));
    const users = getUsers();
    return users.find(user => user.id === id) || null;
  },

  /**
   * Create a new user
   */
  async createUser(userData: UserFormData): Promise<MockUser> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const users = getUsers();
    const newUser: MockUser = {
      id: Date.now().toString(),
      ...userData,
    };
    users.push(newUser);
    saveUsers(users);
    return newUser;
  },

  /**
   * Update an existing user
   */
  async updateUser(id: string, userData: Partial<UserFormData>): Promise<MockUser> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const users = getUsers();
    const index = users.findIndex(user => user.id === id);
    
    if (index === -1) {
      throw new Error('User not found');
    }

    users[index] = {
      ...users[index],
      ...userData,
    };
    saveUsers(users);
    return users[index];
  },

  /**
   * Delete a user
   */
  async deleteUser(id: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const users = getUsers();
    const filtered = users.filter(user => user.id !== id);
    
    if (filtered.length === users.length) {
      throw new Error('User not found');
    }

    saveUsers(filtered);
  },
};

