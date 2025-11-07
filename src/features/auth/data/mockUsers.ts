export interface MockUser {
    id: string;
    username: string;
    fullName: string;
    password: string; // In production, this would be hashed
    company: string;
    branch: string;
    companyId: string;
    warehouses: Array<{address: string }>;
    role: 'admin' | 'user' | 'manager';
  }
  
  export const mockUsers: MockUser[] = [
    {
      id: '1',
      username: 'alibyh',
      password: 'popopo',
      company: 'ООО "РН-Туапсинский НПЗ',
      branch: '',
      fullName: 'Али Б',
      companyId: '1221',
      warehouses: [
        { address: 'край Красноярский, Ул Борисова 14а' },
        { address: 'АО "Самара-Волго г. Самара, Московское ш., д. 55' },
        { address: 'край Краснодарский р-н Туапсинский х Греческий ул Майкопская' },
      ],
      role: 'admin'
    },
  ];
  
  // Helper function to find user by credentials
  export const findUserByCredentials = (username: string, password: string): MockUser | null => {
    return mockUsers.find(
      user => user.username === username && user.password === password
    ) || null;
  };