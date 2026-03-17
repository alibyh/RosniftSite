import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
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
import { inventoryService, MappedInventoryRow } from '../services/inventoryService';
import { userService, type AppUser, type UserFormData, type UserRole } from '../services/userService';
import {
  COMPANY_RATE_COLS,
  type CompanyDeliveryRate,
  type DistanceBand,
  type WeightBand,
} from '../services/deliveryRatesService';
import { useDeliveryRates } from '../contexts/DeliveryRatesContext';
import './AdminPanel.css';

const WEIGHT_LABELS: Record<WeightBand, string> = {
  '10-18': 'От 10 до 18 тонн включительно',
  over18: 'Более 18 тонн',
};

const DISTANCE_LABELS: Record<DistanceBand, string> = {
  '50-250': 'От 50 до 250',
  '251-1000': 'От 251 до 1000',
  '1001-2999': 'От 1001 до 2999',
  '3000+': 'От 3000 и более',
};

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
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingAllProfit, setSavingAllProfit] = useState(false);
  const [profitabilityByBe, setProfitabilityByBe] = useState<Record<string, string>>({});
  const [profitFilterBe, setProfitFilterBe] = useState('');
  const [profitFilterCompany, setProfitFilterCompany] = useState('');

  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [userFormData, setUserFormData] = useState<Partial<UserFormData>>({});

  const [selectedRatesBe, setSelectedRatesBe] = useState<string>('');
  const [editingRates, setEditingRates] = useState<Record<string, string>>({});
  const [savingRates, setSavingRates] = useState(false);
  const { companyRates, upsertCompanyRate, refreshCompanyRates } = useDeliveryRates();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (tabValue === 2) refreshCompanyRates();
  }, [tabValue]);

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
      const msg = err instanceof Error ? err.message : 'Ошибка загрузки данных';
      setError(
        msg.includes('app_users') || msg.includes('RLS') || msg.includes('policy')
          ? `${msg} Выполните миграцию в Supabase: supabase/migrations/20250309_app_users.sql`
          : msg
      );
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
      initial[r.be] = String(r.profitability ?? '').replace('.', ',');
    });
    setProfitabilityByBe(initial);
  }, [profitRows]);

  const handleSaveAllProfitability = async () => {
    try {
      setSavingAllProfit(true);
      setError(null);
      for (const row of profitRows) {
        const value = profitabilityByBe[row.be] ?? '';
        await inventoryService.updateProfitabilityForBalanceUnit(row.be, value);
        setProducts((prev) =>
          prev.map((p) => (p.balanceUnit === row.be ? { ...p, profitability: value } : p))
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения рентабельности');
    } finally {
      setSavingAllProfit(false);
    }
  };

  const openRatesTabForBe = (be: string) => {
    setSelectedRatesBe(be);
    setTabValue(1);
  };

  // ── Rates tab helpers ────────────────────────────────────────────────────

  // Populate editing fields whenever the selected BE or loaded companyRates changes
  useEffect(() => {
    if (!selectedRatesBe) return;
    const existing = companyRates.find((r) => r.be === selectedRatesBe);
    const initial: Record<string, string> = {};
    COMPANY_RATE_COLS.forEach(({ col }) => {
      const raw = existing ? String(existing[col]) : '';
      initial[col] = raw.replace('.', ',');
    });
    setEditingRates(initial);
  }, [selectedRatesBe, companyRates]);

  const handleSaveCompanyRates = async () => {
    if (!selectedRatesBe) return;
    const parsedValues: Omit<CompanyDeliveryRate, 'id' | 'be' | 'company_name'> = {
      rate_10_18_50_250: 0,
      rate_10_18_251_1000: 0,
      rate_10_18_1001_2999: 0,
      rate_10_18_3000plus: 0,
      rate_over18_50_250: 0,
      rate_over18_251_1000: 0,
      rate_over18_1001_2999: 0,
      rate_over18_3000plus: 0,
    };
    for (const { col } of COMPANY_RATE_COLS) {
      const raw = editingRates[col] ?? '';
      const v = parseFloat(String(raw).replace(',', '.'));
      if (isNaN(v) || v < 0) {
        setError(`Некорректное значение ставки: ${raw}`);
        return;
      }
      (parsedValues as Record<string, number>)[col] = v;
    }
    const row = profitRows.find((r) => r.be === selectedRatesBe);
    const companyName = row?.companyName ?? '';
    try {
      setSavingRates(true);
      setError(null);
      await upsertCompanyRate(selectedRatesBe, companyName, parsedValues);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения тарифов');
    } finally {
      setSavingRates(false);
    }
  };

  const handleEditUser = (user: AppUser) => {
    setEditingUser(user);
    setUserFormData({
      username: user.username,
      fullName: user.fullName,
      password: '',
      balanceUnit: user.balanceUnit ?? '',
      company: user.company,
      branch: user.branch,
      companyId: user.companyId ?? user.balanceUnit ?? '',
      email: user.email,
      warehouses: user.warehouses.map((w) => ({ address: typeof w === 'string' ? w : w?.address ?? '' })),
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
      balanceUnit: '',
      company: '',
      branch: '',
      companyId: '',
      email: '',
      warehouses: [],
      role: 'manager',
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
              <Tab label="Тарифы доставки" />
              <Tab label="Пользователи" />
            </Tabs>
          </Box>

          <TabPanel value={tabValue} index={0}>
            <Box className="admin-section-header">
              <Typography variant="h6">Управление рентабельностью по БЕ</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <Autocomplete
                  size="small"
                  options={beFilterOptions}
                  value={profitFilterBe || null}
                  onChange={(_e, newValue) => setProfitFilterBe(newValue ?? '')}
                  getOptionLabel={(opt) => String(opt)}
                  renderInput={(params) => (
                    <TextField {...params} placeholder="Все" label="БЕ" />
                  )}
                  sx={{
                    minWidth: 180,
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: 'rgba(42,42,42,0.99)',
                      color: '#fff',
                      '& fieldset': { borderColor: profitFilterBe ? '#FED208' : 'rgba(255,255,255,0.23)' },
                      '&:hover fieldset': { borderColor: '#FED208' },
                    },
                    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.75)' },
                    '& .MuiInputLabel-root.Mui-focused': { color: '#fff' },
                    '& .MuiInputBase-input': { color: '#fff' },
                    '& .MuiAutocomplete-clearIndicator': { color: 'rgba(255,255,255,0.54)' },
                    '& .MuiAutocomplete-popupIndicator': { color: 'rgba(255,255,255,0.54)' },
                  }}
                />
                <Autocomplete
                  size="small"
                  options={companyFilterOptions}
                  value={profitFilterCompany || null}
                  onChange={(_e, newValue) => setProfitFilterCompany(newValue ?? '')}
                  getOptionLabel={(opt) => String(opt)}
                  renderInput={(params) => (
                    <TextField {...params} placeholder="Все" label="Общество" />
                  )}
                  sx={{
                    minWidth: 320,
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: 'rgba(42,42,42,0.99)',
                      color: '#fff',
                      '& fieldset': { borderColor: profitFilterCompany ? '#FED208' : 'rgba(255,255,255,0.23)' },
                      '&:hover fieldset': { borderColor: '#FED208' },
                    },
                    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.75)' },
                    '& .MuiInputLabel-root.Mui-focused': { color: '#fff' },
                    '& .MuiInputBase-input': { color: '#fff' },
                    '& .MuiAutocomplete-clearIndicator': { color: 'rgba(255,255,255,0.54)' },
                    '& .MuiAutocomplete-popupIndicator': { color: 'rgba(255,255,255,0.54)' },
                  }}
                />
              </Box>
              {(profitFilterBe || profitFilterCompany) && (
                <Typography
                  variant="body2"
                  onClick={() => {
                    setProfitFilterBe('');
                    setProfitFilterCompany('');
                  }}
                  sx={{
                    color: '#FED208',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    '&:hover': { opacity: 0.9 },
                  }}
                >
                  Очистить все фильтры
                </Typography>
              )}
            </Box>
            <Box sx={{ mb: 2 }}>
              <Button
                variant="contained"
                className="admin-save-button"
                onClick={handleSaveAllProfitability}
                disabled={savingAllProfit}
              >
                {savingAllProfit ? 'Сохранение...' : 'Сохранить все изменения'}
              </Button>
            </Box>
            <TableContainer className="admin-table-container">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>БЕ</TableCell>
                    <TableCell>Общество</TableCell>
                    <TableCell>Рентабельность, %</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredProfitRows.map((row) => (
                    <TableRow key={row.be}>
                      <TableCell>
                        <Typography
                          component="span"
                          onClick={() => openRatesTabForBe(row.be)}
                          sx={{
                            color: '#FED208',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            '&:hover': { opacity: 0.9 },
                          }}
                        >
                          {row.be}
                        </Typography>
                      </TableCell>
                      <TableCell>{row.companyName}</TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          value={profitabilityByBe[row.be] ?? ''}
                          onChange={(e) => {
                            let v = e.target.value.replace(/\./g, ',').replace(/[^\d,]/g, '');
                            const parts = v.split(',');
                            if (parts.length > 2) v = parts[0] + ',' + parts.slice(1).join('');
                            setProfitabilityByBe((prev) => ({ ...prev, [row.be]: v }));
                          }}
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
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
                              : 'Менеджер'
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

          <TabPanel value={tabValue} index={1}>
            <Box className="admin-section-header">
              <Typography variant="h6">Тарифы доставки</Typography>
            </Box>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 2 }}>
              Выберите БЕ и отредактируйте ставки. Если тарифы для БЕ не заданы, используются значения по умолчанию.
            </Typography>

            {/* BE selector */}
            <FormControl size="small" sx={{ minWidth: 320, mb: 3 }}>
              <InputLabel sx={{ color: 'rgba(255,255,255,0.7)' }}>БЕ</InputLabel>
              <Select
                value={selectedRatesBe}
                label="БЕ"
                onChange={(e) => setSelectedRatesBe(e.target.value)}
                sx={{
                  color: '#fff',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
                  '& .MuiSvgIcon-root': { color: '#fff' },
                }}
              >
                {profitRows.map((r) => (
                  <MenuItem key={r.be} value={r.be}>
                    {r.be}{r.companyName ? ` — ${r.companyName}` : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {selectedRatesBe ? (
              <>
                <TableContainer className="admin-table-container" sx={{ maxWidth: 600 }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Загрузка, тонн</TableCell>
                        <TableCell>Расстояние, км</TableCell>
                        <TableCell>Ставка, ₽ за 1 т·км</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {COMPANY_RATE_COLS.map(({ col, weight_band, distance_band }) => (
                        <TableRow key={col}>
                          <TableCell>{WEIGHT_LABELS[weight_band]}</TableCell>
                          <TableCell>{DISTANCE_LABELS[distance_band]}</TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              value={editingRates[col] ?? ''}
                              onChange={(e) => {
                                let v = e.target.value.replace(/\./g, ',').replace(/[^\d,]/g, '');
                                const parts = v.split(',');
                                if (parts.length > 2) v = parts[0] + ',' + parts.slice(1).join('');
                                setEditingRates((prev) => ({ ...prev, [col]: v }));
                              }}
                              sx={{
                                width: 120,
                                '& .MuiOutlinedInput-root': {
                                  color: '#fff',
                                  '& fieldset': { borderColor: 'rgba(255,255,255,0.65)' },
                                  '&:hover fieldset': { borderColor: '#fff' },
                                  '&.Mui-focused fieldset': { borderColor: '#fff' },
                                },
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Box sx={{ mt: 2 }}>
                  <Button
                    variant="contained"
                    className="admin-save-button"
                    onClick={handleSaveCompanyRates}
                    disabled={savingRates}
                  >
                    {savingRates ? 'Сохранение...' : 'Сохранить тарифы для выбранной БЕ'}
                  </Button>
                </Box>
              </>
            ) : (
              <Typography sx={{ color: 'rgba(255,255,255,0.5)' }}>
                Выберите БЕ из списка выше.
              </Typography>
            )}
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
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                    '&:hover fieldset': { borderColor: '#fff' },
                    '&.Mui-focused fieldset': { borderColor: '#fff' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.75)' },
                  '& .MuiInputLabel-root.Mui-focused': { color: '#fff' },
                }}
              />
              <TextField
                label="Полное имя"
                value={userFormData.fullName || ''}
                onChange={(e) => setUserFormData({ ...userFormData, fullName: e.target.value })}
                fullWidth
                margin="normal"
                required
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                    '&:hover fieldset': { borderColor: '#fff' },
                    '&.Mui-focused fieldset': { borderColor: '#fff' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.75)' },
                  '& .MuiInputLabel-root.Mui-focused': { color: '#fff' },
                }}
              />
              <TextField
                label="Email"
                type="email"
                value={userFormData.email || ''}
                onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                fullWidth
                margin="normal"
                required
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                    '&:hover fieldset': { borderColor: '#fff' },
                    '&.Mui-focused fieldset': { borderColor: '#fff' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.75)' },
                  '& .MuiInputLabel-root.Mui-focused': { color: '#fff' },
                }}
              />
              <TextField
                label="Пароль"
                type="password"
                value={userFormData.password || ''}
                onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                fullWidth
                margin="normal"
                required={!editingUser}
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                    '&:hover fieldset': { borderColor: '#fff' },
                    '&.Mui-focused fieldset': { borderColor: '#fff' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.75)' },
                  '& .MuiInputLabel-root.Mui-focused': { color: '#fff' },
                }}
              />
              <FormControl
                fullWidth
                margin="normal"
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                    '&:hover fieldset': { borderColor: '#fff' },
                    '&.Mui-focused fieldset': { borderColor: '#fff' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.75)' },
                  '& .MuiInputLabel-root.Mui-focused': { color: '#fff' },
                  '& .MuiSelect-icon': { color: '#fff' },
                }}
              >
                <InputLabel>БЕ</InputLabel>
                <Select
                  value={userFormData.companyId ?? ''}
                  onChange={(e) => {
                    const be = e.target.value;
                    const row = profitRows.find((r) => r.be === be);
                    setUserFormData({
                      ...userFormData,
                      companyId: be,
                      company: row?.companyName ?? '',
                    });
                  }}
                  label="БЕ"
                >
                  <MenuItem value="">
                    <em>— Не выбрано</em>
                  </MenuItem>
                  {profitRows.map((row) => (
                    <MenuItem key={row.be} value={row.be}>
                      {row.be} — {row.companyName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Компания"
                value={userFormData.company || ''}
                fullWidth
                margin="normal"
                disabled
                size="small"
                helperText="Заполняется автоматически при выборе БЕ"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                    '&:hover fieldset': { borderColor: '#fff' },
                    '&.Mui-focused fieldset': { borderColor: '#fff' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.75)' },
                  '& .MuiInputLabel-root.Mui-focused': { color: '#fff' },
                  '& .MuiFormHelperText-root': { color: 'rgba(255,255,255,0.7)' },
                }}
              />
              <FormControl
                fullWidth
                margin="normal"
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                    '&:hover fieldset': { borderColor: '#fff' },
                    '&.Mui-focused fieldset': { borderColor: '#fff' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.75)' },
                  '& .MuiInputLabel-root.Mui-focused': { color: '#fff' },
                  '& .MuiSelect-icon': { color: '#fff' },
                }}
              >
                <InputLabel>Роль</InputLabel>
                <Select
                  value={userFormData.role || 'manager'}
                  onChange={(e) =>
                    setUserFormData({
                      ...userFormData,
                      role: e.target.value as UserRole,
                    })
                  }
                  label="Роль"
                >
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

