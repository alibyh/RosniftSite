import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Tabs,
  Tab,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { inventoryService, MappedInventoryRow } from '../services/inventoryService';
import { userService, UserFormData } from '../services/userService';
import { MockUser } from '../features/auth/data/mockUsers';
import './AdminPanel.css';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`admin-tabpanel-${index}`}
      aria-labelledby={`admin-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const AdminPanel: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [products, setProducts] = useState<MappedInventoryRow[]>([]);
  const [users, setUsers] = useState<MockUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Product dialog state
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<MappedInventoryRow | null>(null);
  const [productFormData, setProductFormData] = useState<Partial<MappedInventoryRow>>({});
  
  // User dialog state
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<MockUser | null>(null);
  const [userFormData, setUserFormData] = useState<Partial<UserFormData>>({});

  useEffect(() => {
    loadData();
  }, [tabValue]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      if (tabValue === 0) {
        const data = await inventoryService.getAllInventory();
        setProducts(data);
      } else {
        const data = await userService.getAllUsers();
        setUsers(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Product handlers
  const handleEditProduct = (product: MappedInventoryRow) => {
    setEditingProduct(product);
    setProductFormData(product);
    setProductDialogOpen(true);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот продукт?')) {
      return;
    }
    try {
      await inventoryService.deleteInventory(id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления продукта');
    }
  };

  const handleAddProduct = () => {
    setEditingProduct(null);
    setProductFormData({});
    setProductDialogOpen(true);
  };

  const handleSaveProduct = async () => {
    try {
      if (editingProduct) {
        await inventoryService.updateInventory(editingProduct.id, productFormData);
      } else {
        await inventoryService.createInventory(productFormData as Omit<MappedInventoryRow, 'id'>);
      }
      setProductDialogOpen(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения продукта');
    }
  };

  // User handlers
  const handleEditUser = (user: MockUser) => {
    setEditingUser(user);
    setUserFormData({
      username: user.username,
      fullName: user.fullName,
      password: '',
      company: user.company,
      branch: user.branch,
      companyId: user.companyId,
      email: user.email,
      warehouses: user.warehouses,
      role: user.role,
    });
    setUserDialogOpen(true);
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm('Вы уверены, что хотите удалить этого пользователя?')) {
      return;
    }
    try {
      await userService.deleteUser(id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления пользователя');
    }
  };

  const handleAddUser = () => {
    setEditingUser(null);
    setUserFormData({
      username: '',
      fullName: '',
      password: '',
      company: '',
      branch: '',
      companyId: '',
      email: '',
      warehouses: [],
      role: 'user',
    });
    setUserDialogOpen(true);
  };

  const handleSaveUser = async () => {
    try {
      if (editingUser) {
        await userService.updateUser(editingUser.id, userFormData);
      } else {
        await userService.createUser(userFormData as UserFormData);
      }
      setUserDialogOpen(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения пользователя');
    }
  };

  if (loading && products.length === 0 && users.length === 0) {
    return (
      <Box className="admin-loading">
        <CircularProgress className="admin-loading-spinner" />
      </Box>
    );
  }

  return (
    <Box className="admin-container">
      <Container maxWidth="xl" className="admin-content">
        <Typography variant="h4" component="h1" className="admin-title">
          Панель администратора
        </Typography>

        {error && (
          <Alert severity="error" onClose={() => setError(null)} className="admin-error">
            {error}
          </Alert>
        )}

        <Paper className="admin-paper">
          <Box className="admin-tabs-container">
            <Tabs value={tabValue} onChange={handleTabChange} className="admin-tabs">
              <Tab label="Продукты" />
              <Tab label="Пользователи" />
            </Tabs>
          </Box>

          <TabPanel value={tabValue} index={0}>
            <Box className="admin-section-header">
              <Typography variant="h6">Управление продуктами</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddProduct}
                className="admin-add-button"
              >
                Добавить продукт
              </Button>
            </Box>

            <TableContainer className="admin-table-container">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>БЕ</TableCell>
                    <TableCell>Общество</TableCell>
                    <TableCell>Адрес склада</TableCell>
                    <TableCell>Материал</TableCell>
                    <TableCell>Количество</TableCell>
                    <TableCell>Стоимость</TableCell>
                    <TableCell align="right">Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>{product.balanceUnit}</TableCell>
                      <TableCell>{product.companyName}</TableCell>
                      <TableCell>{product.warehouseAddress}</TableCell>
                      <TableCell>{product.materialName}</TableCell>
                      <TableCell>{product.quantity}</TableCell>
                      <TableCell>{product.cost}</TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={() => handleEditProduct(product)}
                          className="admin-edit-button"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteProduct(product.id)}
                          className="admin-delete-button"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Box className="admin-section-header">
              <Typography variant="h6">Управление пользователями</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddUser}
                className="admin-add-button"
              >
                Добавить пользователя
              </Button>
            </Box>

            <TableContainer className="admin-table-container">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Имя пользователя</TableCell>
                    <TableCell>Полное имя</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Компания</TableCell>
                    <TableCell>Роль</TableCell>
                    <TableCell align="right">Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.username}</TableCell>
                      <TableCell>{user.fullName}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.company}</TableCell>
                      <TableCell>
                        <Chip
                          label={user.role === 'admin' ? 'Администратор' : user.role === 'manager' ? 'Менеджер' : 'Пользователь'}
                          size="small"
                          className={`admin-role-chip admin-role-${user.role}`}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={() => handleEditUser(user)}
                          className="admin-edit-button"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteUser(user.id)}
                          className="admin-delete-button"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>
        </Paper>

        {/* Product Dialog */}
        <Dialog open={productDialogOpen} onClose={() => setProductDialogOpen(false)} maxWidth="md" fullWidth className="admin-dialog">
          <DialogTitle>{editingProduct ? 'Редактировать продукт' : 'Добавить продукт'}</DialogTitle>
          <DialogContent>
            <Box>
              <TextField
                label="БЕ"
                value={productFormData.balanceUnit || ''}
                onChange={(e) => setProductFormData({ ...productFormData, balanceUnit: e.target.value })}
                fullWidth
                margin="normal"
              />
              <TextField
                label="Наименование дочернего Общества"
                value={productFormData.companyName || ''}
                onChange={(e) => setProductFormData({ ...productFormData, companyName: e.target.value })}
                fullWidth
                margin="normal"
              />
              <TextField
                label="Филиал"
                value={productFormData.branch || ''}
                onChange={(e) => setProductFormData({ ...productFormData, branch: e.target.value })}
                fullWidth
                margin="normal"
              />
              <TextField
                label="Адрес склада"
                value={productFormData.warehouseAddress || ''}
                onChange={(e) => setProductFormData({ ...productFormData, warehouseAddress: e.target.value })}
                fullWidth
                margin="normal"
              />
              <TextField
                label="Наименование материала"
                value={productFormData.materialName || ''}
                onChange={(e) => setProductFormData({ ...productFormData, materialName: e.target.value })}
                fullWidth
                margin="normal"
              />
              <TextField
                label="Количество"
                value={productFormData.quantity || ''}
                onChange={(e) => setProductFormData({ ...productFormData, quantity: e.target.value })}
                fullWidth
                margin="normal"
              />
              <TextField
                label="Стоимость"
                value={productFormData.cost || ''}
                onChange={(e) => setProductFormData({ ...productFormData, cost: e.target.value })}
                fullWidth
                margin="normal"
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setProductDialogOpen(false)}>Отмена</Button>
            <Button onClick={handleSaveProduct} variant="contained" className="admin-save-button">
              Сохранить
            </Button>
          </DialogActions>
        </Dialog>

        {/* User Dialog */}
        <Dialog open={userDialogOpen} onClose={() => setUserDialogOpen(false)} maxWidth="md" fullWidth className="admin-dialog">
          <DialogTitle>{editingUser ? 'Редактировать пользователя' : 'Добавить пользователя'}</DialogTitle>
          <DialogContent>
            <Box>
              <TextField
                label="Имя пользователя"
                value={userFormData.username || ''}
                onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
                fullWidth
                margin="normal"
                required
              />
              <TextField
                label="Полное имя"
                value={userFormData.fullName || ''}
                onChange={(e) => setUserFormData({ ...userFormData, fullName: e.target.value })}
                fullWidth
                margin="normal"
                required
              />
              <TextField
                label="Email"
                type="email"
                value={userFormData.email || ''}
                onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                fullWidth
                margin="normal"
                required
              />
              <TextField
                label="Пароль"
                type="password"
                value={userFormData.password || ''}
                onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                fullWidth
                margin="normal"
                required={!editingUser}
              />
              <TextField
                label="Компания"
                value={userFormData.company || ''}
                onChange={(e) => setUserFormData({ ...userFormData, company: e.target.value })}
                fullWidth
                margin="normal"
              />
              <TextField
                label="ID компании"
                value={userFormData.companyId || ''}
                onChange={(e) => setUserFormData({ ...userFormData, companyId: e.target.value })}
                fullWidth
                margin="normal"
              />
              <FormControl fullWidth margin="normal">
                <InputLabel>Роль</InputLabel>
                <Select
                  value={userFormData.role || 'user'}
                  onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value as 'admin' | 'user' | 'manager' })}
                  label="Роль"
                >
                  <MenuItem value="user">Пользователь</MenuItem>
                  <MenuItem value="manager">Менеджер</MenuItem>
                  <MenuItem value="admin">Администратор</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setUserDialogOpen(false)}>Отмена</Button>
            <Button onClick={handleSaveUser} variant="contained" className="admin-save-button">
              Сохранить
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
};

export default AdminPanel;

