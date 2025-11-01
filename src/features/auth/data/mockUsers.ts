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
      username: 'admin',
      password: 'admin123', // Change this for security!
      company: 'Роснефть',
      companyId: 'rosneft-001',
      warehouses: [
        { id: 'wh-1', address: 'Москва, ул. Нефтяная, д. 1' },
        { id: 'wh-2', address: 'Санкт-Петербург, пр. Нефтяников, д. 15' }
      ],
      role: 'admin'
    },
    {
      id: '2',
      username: 'alibyh',
      password: 'popopo',
      company: 'Дочерняя компания А',
      companyId: 'subsidiary-a',
      warehouses: [
        { id: 'wh-3', address: 'Новосибирск, ул. Складская, д. 5' }
      ],
      role: 'user'
    },
    // Add more users here...
  ];
  
  // Helper function to find user by credentials
  export const findUserByCredentials = (username: string, password: string): MockUser | null => {
    return mockUsers.find(
      user => user.username === username && user.password === password
    ) || null;
  };