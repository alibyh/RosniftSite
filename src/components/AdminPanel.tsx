import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { MockUser } from '../features/auth/data/mockUsers';
import { inventoryService, MappedInventoryRow } from '../services/inventoryService';
import { userService, UserFormData } from '../services/userService';
import './AdminPanel.css';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index, ...other }: TabPanelProps) {
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
  const [savingProfitForBe, setSavingProfitForBe] = useState<string | null>(null);
  const [profitabilityByBe, setProfitabilityByBe] = useState<Record<string, string>>({});
  const [profitFilterBe, setProfitFilterBe] = useState('');
  const [profitFilterCompany, setProfitFilterCompany] = useState('');

  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<MockUser | null>(null);
  const [userFormData, setUserFormData] = useState<Partial<UserFormData>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [inventoryData, usersData] = await Promise.all([
        inventoryService.getAllInventory(),
        userService.getAllUsers(),
      ]);
      setProducts(inventoryData);
      setUsers(usersData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const profitRows = useMemo(() => {
    const map = new Map<string, { be: string; companyName: string; profitability: string }>();
    products.forEach((p) => {
      if (!map.has(p.balanceUnit)) {
        map.set(p.balanceUnit, {
          be: p.balanceUnit,
          companyName: p.companyName,
          profitability: p.profitability || '',
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.be.localeCompare(b.be));
  }, [products]);

  const filteredProfitRows = useMemo(() => {
    return profitRows.filter((row) => {
      const beOk = !profitFilterBe || row.be === profitFilterBe;
      const companyOk = !profitFilterCompany || row.companyName === profitFilterCompany;
      return beOk && companyOk;
    });
  }, [profitRows, profitFilterBe, profitFilterCompany]);

  const beFilterOptions = useMemo(
    () => Array.from(new Set(profitRows.map((r) => r.be))).sort((a, b) => a.localeCompare(b)),
    [profitRows]
  );
  const companyFilterOptions = useMemo(
    () => Array.from(new Set(profitRows.map((r) => r.companyName))).sort((a, b) => a.localeCompare(b)),
    [profitRows]
  );

  useEffect(() => {
    const initial: Record<string, string> = {};
    profitRows.forEach((r) => {
      initial[r.be] = r.profitability;
    });
    setProfitabilityByBe(initial);
  }, [profitRows]);

  const handleSaveProfitability = async (be: string) => {
    const value = profitabilityByBe[be] ?? '';
    try {
      setSavingProfitForBe(be);
      await inventoryService.updateProfitabilityForBalanceUnit(be, value);
      setProducts((prev) =>
        prev.map((p) => (p.balanceUnit === be ? { ...p, profitability: value } : p))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения рентабельности');
    } finally {
      setSavingProfitForBe(null);
    }
  };

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
    if (!window.confirm('Вы уверены, что хотите удалить этого пользователя?')) return;
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
            <Tabs value={tabValue} onChange={(_e, n) => setTabValue(n)} className="admin-tabs">
              <Tab label="Рентабельность" />
              <Tab label="Пользователи" />
            </Tabs>
          </Box>

          <TabPanel value={tabValue} index={0}>
            <Box className="admin-section-header">
              <Typography variant="h6">Управление рентабельностью по БЕ</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
              <FormControl
                size="small"
                sx={{
                  minWidth: 180,
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.75)' },
                  '& .MuiInputLabel-root.Mui-focused': { color: '#fff' },
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.55)' },
                    '&:hover fieldset': { borderColor: '#fff' },
                    '&.Mui-focused fieldset': { borderColor: '#fff' },
                  },
                }}
              >
                <InputLabel>Фильтр БЕ</InputLabel>
                <Select
                  value={profitFilterBe}
                  label="Фильтр БЕ"
                  onChange={(e) => setProfitFilterBe(e.target.value)}
                >
                  <MenuItem value="">Все</MenuItem>
                  {beFilterOptions.map((be) => (
                    <MenuItem key={be} value={be}>
                      {be}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl
                size="small"
                sx={{
                  minWidth: 320,
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.75)' },
                  '& .MuiInputLabel-root.Mui-focused': { color: '#fff' },
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.55)' },
                    '&:hover fieldset': { borderColor: '#fff' },
                    '&.Mui-focused fieldset': { borderColor: '#fff' },
                  },
                }}
              >
                <InputLabel>Фильтр Общество</InputLabel>
                <Select
                  value={profitFilterCompany}
                  label="Фильтр Общество"
                  onChange={(e) => setProfitFilterCompany(e.target.value)}
                >
                  <MenuItem value="">Все</MenuItem>
                  {companyFilterOptions.map((company) => (
                    <MenuItem key={company} value={company}>
                      {company}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <TableContainer className="admin-table-container">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>БЕ</TableCell>
                    <TableCell>Общество</TableCell>
                    <TableCell>Рентабельность, %</TableCell>
                    <TableCell align="right">Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredProfitRows.map((row) => (
                    <TableRow key={row.be}>
                      <TableCell>{row.be}</TableCell>
                      <TableCell>{row.companyName}</TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          value={profitabilityByBe[row.be] ?? ''}
                          onChange={(e) =>
                            setProfitabilityByBe((prev) => ({ ...prev, [row.be]: e.target.value }))
                          }
                          sx={{
                            width: 130,
                            '& .MuiOutlinedInput-root': {
                              color: '#fff',
                              '& fieldset': { borderColor: 'rgba(255,255,255,0.65)' },
                              '&:hover fieldset': { borderColor: '#fff' },
                              '&.Mui-focused fieldset': { borderColor: '#fff' },
                            },
                          }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => handleSaveProfitability(row.be)}
                          className="admin-save-button"
                          disabled={savingProfitForBe === row.be}
                        >
                          {savingProfitForBe === row.be ? 'Сохранение...' : 'Сохранить'}
                        </Button>
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
                          label={
                            user.role === 'admin'
                              ? 'Администратор'
                              : user.role === 'manager'
                                ? 'Менеджер'
                                : 'Пользователь'
                          }
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

        <Dialog
          open={userDialogOpen}
          onClose={() => setUserDialogOpen(false)}
          maxWidth="md"
          fullWidth
          className="admin-dialog"
        >
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
                  onChange={(e) =>
                    setUserFormData({
                      ...userFormData,
                      role: e.target.value as 'admin' | 'user' | 'manager',
                    })
                  }
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

