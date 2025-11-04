import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Box,
  Container,
  TextField,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  InputAdornment,
  CircularProgress,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { parseCSV, InventoryRow } from '../utils/csvParser';
import { RootState } from '../store/store';

interface ColumnWidths {
  [key: string]: number;
}

type SortDirection = 'asc' | 'desc' | null;
type SearchField = 'all' | 'balanceUnit' | 'companyName' | 'branch' | 'warehouseAddress' | 'materialClass' | 'className' | 'materialSubclass' | 'subclassName' | 'materialCode' | 'materialName' | 'unit' | 'quantity' | 'cost';

const Marketplace: React.FC = () => {
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.auth.user);
  const [data, setData] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState<SearchField>('all');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>({
    balanceUnit: 100,
    companyName: 250,
    branch: 150,
    warehouseAddress: 300,
    materialClass: 80,
    className: 200,
    materialSubclass: 120,
    subclassName: 250,
    materialCode: 150,
    materialName: 350,
    unit: 120,
    quantity: 120,
    cost: 150,
  });
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const csvData = await parseCSV();
        setData(csvData);
      } catch (err) {
        setError('Ошибка загрузки данных. Пожалуйста, обновите страницу.');
        console.error('Error loading CSV:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const filteredData = useMemo(() => {
    let filtered = data;

    // Filter out user's own products
    // Don't show products where balanceUnit matches user's companyId
    // or where warehouseAddress matches user's warehouses
    if (user) {
      filtered = filtered.filter((row) => {
        // Exclude if balanceUnit matches user's companyId
        if (user.companyId && row.balanceUnit === user.companyId) {
          return false;
        }
        
        // Exclude if warehouseAddress matches any of user's warehouses
        if (user.warehouses && user.warehouses.length > 0) {
          const userWarehouseAddresses = user.warehouses.map((wh) => {
            return typeof wh === 'string' ? wh : wh.address || '';
          });
          if (userWarehouseAddresses.some(addr => 
            row.warehouseAddress && row.warehouseAddress.trim() && 
            addr && addr.trim() && 
            row.warehouseAddress.toLowerCase().includes(addr.toLowerCase())
          )) {
            return false;
          }
        }
        
        return true;
      });
    }

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((row) => {
        if (searchField === 'all') {
          return (
            row.companyName?.toLowerCase().includes(searchLower) ||
            row.materialName?.toLowerCase().includes(searchLower) ||
            row.warehouseAddress?.toLowerCase().includes(searchLower) ||
            row.materialCode?.toLowerCase().includes(searchLower) ||
            row.className?.toLowerCase().includes(searchLower) ||
            row.subclassName?.toLowerCase().includes(searchLower) ||
            row.branch?.toLowerCase().includes(searchLower) ||
            row.balanceUnit?.toLowerCase().includes(searchLower) ||
            row.materialClass?.toLowerCase().includes(searchLower) ||
            row.materialSubclass?.toLowerCase().includes(searchLower) ||
            row.unit?.toLowerCase().includes(searchLower) ||
            row.quantity?.toLowerCase().includes(searchLower) ||
            row.cost?.toLowerCase().includes(searchLower)
          );
        } else {
          const fieldValue = (row as any)[searchField];
          return fieldValue?.toLowerCase().includes(searchLower);
        }
      });
    }

    // Apply sorting
    if (sortColumn && sortDirection) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = (a as any)[sortColumn];
        const bValue = (b as any)[sortColumn];

        // Handle numeric values (quantity, cost)
        if (sortColumn === 'quantity' || sortColumn === 'cost') {
          const aNum = parseFloat(aValue?.replace(/\s/g, '') || '0');
          const bNum = parseFloat(bValue?.replace(/\s/g, '') || '0');
          return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
        }

        // Handle string values
        const aStr = String(aValue || '').toLowerCase();
        const bStr = String(bValue || '').toLowerCase();

        if (sortDirection === 'asc') {
          return aStr.localeCompare(bStr);
        } else {
          return bStr.localeCompare(aStr);
        }
      });
    }

    return filtered;
  }, [data, user, searchTerm, searchField, sortColumn, sortDirection]);

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  const handleMouseDown = (columnKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    setResizingColumn(columnKey);
    const startX = e.pageX;
    const startWidth = columnWidths[columnKey];

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const diff = moveEvent.pageX - startX;
      const newWidth = Math.max(50, startWidth + diff); // Minimum width of 50px
      setColumnWidths((prev) => ({
        ...prev,
        [columnKey]: newWidth,
      }));
    };

    const handleMouseUp = () => {
      setResizingColumn(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const columns = [
    { key: 'balanceUnit', label: 'БЕ', field: 'balanceUnit' },
    { key: 'companyName', label: 'Наименование дочернего Общества', field: 'companyName' },
    { key: 'branch', label: 'Филиал', field: 'branch' },
    { key: 'warehouseAddress', label: 'Адрес склада', field: 'warehouseAddress' },
    { key: 'materialClass', label: 'Класс МТР', field: 'materialClass' },
    { key: 'className', label: 'Наименование класса', field: 'className' },
    { key: 'materialSubclass', label: 'Подкласс МТР', field: 'materialSubclass' },
    { key: 'subclassName', label: 'Наименование подкласса', field: 'subclassName' },
    { key: 'materialCode', label: 'Код материала', field: 'materialCode' },
    { key: 'materialName', label: 'Наименование материала', field: 'materialName' },
    { key: 'unit', label: 'Ед. измерения', field: 'unit' },
    { key: 'quantity', label: 'Количество', field: 'quantity' },
    { key: 'cost', label: 'Стоимость, руб', field: 'cost' },
  ];

  const searchFieldOptions = [
    { value: 'all', label: 'Все поля' },
    { value: 'balanceUnit', label: 'БЕ' },
    { value: 'companyName', label: 'Общество' },
    { value: 'branch', label: 'Филиал' },
    { value: 'warehouseAddress', label: 'Адрес склада' },
    { value: 'materialClass', label: 'Класс МТР' },
    { value: 'className', label: 'Наименование класса' },
    { value: 'materialSubclass', label: 'Подкласс МТР' },
    { value: 'subclassName', label: 'Наименование подкласса' },
    { value: 'materialCode', label: 'Код материала' },
    { value: 'materialName', label: 'Наименование материала' },
    { value: 'unit', label: 'Ед. измерения' },
    { value: 'quantity', label: 'Количество' },
    { value: 'cost', label: 'Стоимость' },
  ];

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px',
        }}
      >
        <CircularProgress sx={{ color: '#FED208' }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Box sx={{ backgroundColor: '#1a1a1a', minHeight: '100vh', pb: 4 }}>
      <Container maxWidth="xl" sx={{ pt: 4 }}>
        <Typography
          variant="h4"
          component="h1"
          sx={{
            color: '#FED208',
            mb: 3,
            fontWeight: 'bold',
          }}
        >
          Складские запасы
        </Typography>

        <Paper
          sx={{
            mb: 3,
            p: 2,
            backgroundColor: '#2a2a2a',
            border: '1px solid #444',
          }}
        >
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <FormControl
              sx={{
                minWidth: 200,
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  '& fieldset': {
                    borderColor: '#555',
                  },
                  '&:hover fieldset': {
                    borderColor: '#FED208',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#FED208',
                  },
                },
                '& .MuiInputLabel-root': {
                  color: '#aaa',
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: '#FED208',
                },
              }}
              size="small"
            >
              <InputLabel>Фильтр поиска</InputLabel>
              <Select
                value={searchField}
                onChange={(e) => setSearchField(e.target.value as SearchField)}
                label="Фильтр поиска"
                sx={{
                  color: '#fff',
                  '& .MuiSvgIcon-root': {
                    color: '#FED208',
                  },
                }}
              >
                {searchFieldOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              placeholder={
                searchField === 'all'
                  ? 'Поиск по всем полям...'
                  : `Поиск по ${searchFieldOptions.find((opt) => opt.value === searchField)?.label.toLowerCase()}...`
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#FED208' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  '& fieldset': {
                    borderColor: '#555',
                  },
                  '&:hover fieldset': {
                    borderColor: '#FED208',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#FED208',
                  },
                },
                '& .MuiInputBase-input::placeholder': {
                  color: '#aaa',
                  opacity: 1,
                },
              }}
            />
          </Box>
        </Paper>

        <Typography
          variant="body2"
          sx={{ color: '#aaa', mb: 2 }}
        >
          Найдено записей: {filteredData.length}
          {sortColumn && (
            <span style={{ marginLeft: '16px' }}>
              Сортировка: {columns.find((col) => col.key === sortColumn)?.label}{' '}
              {sortDirection === 'asc' ? '↑' : '↓'}
            </span>
          )}
        </Typography>

        <TableContainer
          ref={tableRef}
          component={Paper}
          sx={{
            backgroundColor: '#2a2a2a',
            border: '1px solid #444',
            maxHeight: 'calc(100vh - 280px)',
            overflowY: 'auto',
            overflowX: 'auto',
            '&::-webkit-scrollbar': {
              width: '12px',
              height: '12px',
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: '#1a1a1a',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: '#555',
              borderRadius: '6px',
              '&:hover': {
                backgroundColor: '#666',
              },
            },
          }}
        >
          <Table stickyHeader sx={{ tableLayout: 'fixed', width: Object.values(columnWidths).reduce((a, b) => a + b, 0) }}>
            <TableHead>
              <TableRow>
                {columns.map((column) => {
                  const isSorted = sortColumn === column.key;
                  const isAsc = sortDirection === 'asc';
                  return (
                    <TableCell
                      key={column.key}
                      sx={{
                        backgroundColor: '#1a1a1a',
                        color: '#FED208',
                        fontWeight: 'bold',
                        borderRight: '1px solid #444',
                        width: `${columnWidths[column.key]}px`,
                        minWidth: `${columnWidths[column.key]}px`,
                        position: 'relative',
                        padding: '12px 8px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        cursor: 'pointer',
                        userSelect: 'none',
                        '&:hover': {
                          backgroundColor: '#222',
                        },
                      }}
                      onClick={() => handleSort(column.key)}
                    >
                      <Box
                        sx={{
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'center',
                          width: '100%',
                        }}
                      >
                        <Box
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                          }}
                          title={column.label}
                        >
                          {column.label}
                          {isSorted && (
                            <Box sx={{ display: 'flex', alignItems: 'center', ml: 0.5 }}>
                              {isAsc ? (
                                <ArrowUpwardIcon sx={{ fontSize: 16, color: '#FED208' }} />
                              ) : (
                                <ArrowDownwardIcon sx={{ fontSize: 16, color: '#FED208' }} />
                              )}
                            </Box>
                          )}
                        </Box>
                        <Box
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            handleMouseDown(column.key, e);
                          }}
                          sx={{
                            position: 'absolute',
                            right: 0,
                            top: 0,
                            bottom: 0,
                            width: '4px',
                            cursor: 'col-resize',
                            backgroundColor: resizingColumn === column.key ? '#FED208' : 'transparent',
                            '&:hover': {
                              backgroundColor: '#FED208',
                              opacity: 0.5,
                            },
                            transition: 'background-color 0.2s',
                          }}
                        />
                      </Box>
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredData.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    align="center"
                    sx={{ color: '#aaa', py: 4 }}
                  >
                    {searchTerm
                      ? 'Записи не найдены'
                      : 'Данные отсутствуют'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((row, index) => (
                  <TableRow
                    key={index}
                    sx={{
                      '&:nth-of-type(odd)': {
                        backgroundColor: '#222',
                      },
                      '&:hover': {
                        backgroundColor: '#333',
                      },
                    }}
                  >
                    {columns.map((column) => {
                      const value = (row as any)[column.field] || '-';
                      const isBalanceUnit = column.key === 'balanceUnit';
                      return (
                        <TableCell
                          key={column.key}
                          onClick={() => {
                            if (isBalanceUnit) {
                              navigate('/product-details', { state: { product: row } });
                            }
                          }}
                          sx={{
                            color: '#fff',
                            borderRight: '1px solid #444',
                            width: `${columnWidths[column.key]}px`,
                            minWidth: `${columnWidths[column.key]}px`,
                            padding: '12px 8px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            position: 'relative',
                            cursor: isBalanceUnit ? 'pointer' : 'default',
                            ...(isBalanceUnit && {
                              '&:hover': {
                                backgroundColor: 'rgba(254, 210, 8, 0.2)',
                                color: '#FED208',
                                fontWeight: 'bold',
                              },
                            }),
                          }}
                          title={typeof value === 'string' ? value : String(value)}
                        >
                          {value}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Container>
    </Box>
  );
};

export default Marketplace;
