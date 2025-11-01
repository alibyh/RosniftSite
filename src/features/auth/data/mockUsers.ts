export interface MockUser {
    id: string;
    username: string;
    password: string; // In production, this would be hashed
    company: string;
    companyId: string;
    warehouses: Array<{ id: string; address: string }>;
    role: 'admin' | 'user' | 'manager';
  }
  
  export const mockUsers: MockUser[] = [
    {
      id: '1',
      username: 'alibyh',
      password: 'popopo', // Change this for security!
      company: 'Роснефть',
      companyId: 'rosneft-001',
      warehouses: [
        { id: 'wh-1', address: 'Москва, ул. Нефтяная, д. 1' },
        { id: 'wh-2', address: 'Санкт-Петербург, пр. Нефтяников, д. 15' }
      ],
      role: 'admin'
    },
    // Add more users here...
  ];
  
  // Helper function to find user by credentials
  export const findUserByCredentials = (username: string, password: string): MockUser | null => {
    return mockUsers.find(
      user => user.username === username && user.password === password
    ) || null;
  };