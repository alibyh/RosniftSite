export interface MockUser {
    id: string;
    username: string;
    fullName: string;
    password: string; // In production, this would be hashed
    company: string;
    branch: string;
    companyId: string;
    email: string;
    warehouses: Array<{address: string }>;
    role: 'admin' | 'user' | 'manager';
  }
  
  export const mockUsers: MockUser[] = [
    {
      id: '1',
      username: 'alibyh',
      password: 'popopo',
      company: 'ООО "РН-Бурение"',
      branch: '',
      fullName: 'Али Б',
      email: 'alibyh@icloud.com',
      companyId: '1244',
      warehouses: [
        { address: 'край Красноярский, Ул Борисова 14а' },
        { address: 'АО "Самара-Волго г. Самара, Московское ш., д. 55' },
        { address: 'край Краснодарский р-н Туапсинский х Греческий ул Майкопская' },
      ],
      role: 'admin'
    },
    {
      id: '2',
      username: 'yuliya',
      password: 'popopo',
      company: 'АО "Куйбышевский НПЗ"',
      branch: '',
      fullName: 'Yuliya',
      email: 'alibyh@gmail.com',
      companyId: '1329',
      warehouses: [
        { address: 'Самара, Московское шоссе 55, Самарская область, Россия' },
      ],
      role: 'manager'
    },
  ];
  
  // Helper function to find user by credentials
  export const findUserByCredentials = (username: string, password: string): MockUser | null => {
    return mockUsers.find(
      user => user.username === username && user.password === password
    ) || null;
  };