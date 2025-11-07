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
import FilterListIcon from '@mui/icons-material/FilterList';
import { inventoryService, MappedInventoryRow } from '../services/inventoryService';
import { RootState } from '../store/store';
import './Marketplace.css';

interface ColumnWidths {
  [key: string]: number;
}

type SortDirection = 'asc' | 'desc' | null;
type SearchField = 'all' | 'balanceUnit' | 'companyName' | 'branch' | 'warehouseAddress' | 'materialClass' | 'className' | 'materialSubclass' | 'subclassName' | 'materialCode' | 'materialName' | 'unit' | 'quantity' | 'cost';
type ColumnFilters = {
  [key: string]: string;
};

const Marketplace: React.FC = () => {
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.auth.user);
  const [data, setData] = useState<MappedInventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState<SearchField>('all');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>({
    balanceUnit: 120,
    companyName: 380,
    branch: 180,
    warehouseAddress: 350,
    materialClass: 130,
    className: 300,
    materialSubclass: 150,
    subclassName: 330,
    materialCode: 180,
    materialName: 380,
    unit: 160,
    quantity: 140,
    cost: 180,
  });
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const tableRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const inventoryData = await inventoryService.getAllInventory();
        setData(inventoryData);
      } catch (err) {
        setError('Ошибка загрузки данных. Пожалуйста, обновите страницу.');
        console.error('Error loading inventory:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Get unique values for a column (after user filtering)
  const getUniqueColumnValues = useMemo(() => {
    let baseFiltered = data;
    
    // Apply user-based filtering first
    if (user) {
      baseFiltered = baseFiltered.filter((row) => {
        if (user.companyId && row.balanceUnit === user.companyId) {
          return false;
        }
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

    return (columnKey: string) => {
      const field = columns.find(col => col.key === columnKey)?.field || columnKey;
      const uniqueValues = new Set<string>();
      
      baseFiltered.forEach((row) => {
        const value = (row as any)[field];
        if (value !== null && value !== undefined && value !== '') {
          uniqueValues.add(String(value));
        }
      });
      
      return Array.from(uniqueValues).sort((a, b) => {
        // Sort numbers numerically if possible
        const aNum = parseFloat(a.replace(/\s/g, ''));
        const bNum = parseFloat(b.replace(/\s/g, ''));
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return aNum - bNum;
        }
        return a.localeCompare(b);
      });
    };
  }, [data, user, columns]);

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

    // Apply column filters
    Object.entries(columnFilters).forEach(([columnKey, filterValue]) => {
      if (filterValue && filterValue.trim()) {
        const field = columns.find(col => col.key === columnKey)?.field || columnKey;
        filtered = filtered.filter((row) => {
          const rowValue = String((row as any)[field] || '').trim();
          return rowValue === filterValue.trim();
        });
      }
    });

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
  }, [data, user, searchTerm, searchField, sortColumn, sortDirection, columnFilters]);

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

  const handleColumnFilterChange = (columnKey: string, value: string) => {
    setColumnFilters((prev) => {
      if (value === '') {
        const newFilters = { ...prev };
        delete newFilters[columnKey];
        return newFilters;
      }
      return {
        ...prev,
        [columnKey]: value,
      };
    });
  };

  const clearAllFilters = () => {
    setColumnFilters({});
  };

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
      <Box className="marketplace-loading">
        <CircularProgress className="marketplace-loading-spinner" />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" className="marketplace-error-container">
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Box className="marketplace-container">
      <Container maxWidth="xl" className="marketplace-content">
        <Typography variant="h4" component="h1" className="marketplace-title">
          Складские запасы
        </Typography>

        <Paper className="marketplace-search-paper">
          <Box className="marketplace-search-box">
            <FormControl className="marketplace-form-control" size="small">
              <InputLabel>Фильтр поиска</InputLabel>
              <Select
                value={searchField}
                onChange={(e) => setSearchField(e.target.value as SearchField)}
                label="Фильтр поиска"
                className="marketplace-select"
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
              className="marketplace-textfield"
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
                    <SearchIcon style={{ color: '#FED208' }} />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        </Paper>

        <Box className="marketplace-info-box">
          <Typography variant="body2" className="marketplace-info-text">
            Найдено записей: {filteredData.length}
            {sortColumn && (
              <span style={{ marginLeft: '16px' }}>
                Сортировка: {columns.find((col) => col.key === sortColumn)?.label}{' '}
                {sortDirection === 'asc' ? '↑' : '↓'}
              </span>
            )}
            {Object.keys(columnFilters).length > 0 && (
              <span style={{ marginLeft: '16px' }}>
                Активных фильтров: {Object.keys(columnFilters).length}
              </span>
            )}
          </Typography>
          {Object.keys(columnFilters).length > 0 && (
            <Typography variant="body2" onClick={clearAllFilters} className="marketplace-clear-filters">
              Очистить все фильтры
            </Typography>
          )}
        </Box>

        <TableContainer
          ref={tableRef}
          component={Paper}
          className="marketplace-table-container"
        >
          <Table stickyHeader style={{ tableLayout: 'fixed', width: Object.values(columnWidths).reduce((a, b) => a + b, 0) }}>
            <TableHead>
              <TableRow>
                {columns.map((column) => {
                  const isSorted = sortColumn === column.key;
                  const isAsc = sortDirection === 'asc';
                  return (
                    <TableCell
                      key={column.key}
                      className="marketplace-table-header"
                      style={{
                        width: `${columnWidths[column.key]}px`,
                        minWidth: `${columnWidths[column.key]}px`,
                      }}
                      onClick={() => handleSort(column.key)}
                    >
                      <Box className="marketplace-table-header-content">
                        <Box className="marketplace-table-header-label" title={column.label}>
                          {column.label}
                          {isSorted && (
                            <Box style={{ display: 'flex', alignItems: 'center', marginLeft: '4px' }}>
                              {isAsc ? (
                                <ArrowUpwardIcon style={{ fontSize: 16, color: '#FED208' }} />
                              ) : (
                                <ArrowDownwardIcon style={{ fontSize: 16, color: '#FED208' }} />
                              )}
                            </Box>
                          )}
                        </Box>
                        <Box
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            handleMouseDown(column.key, e);
                          }}
                          className={`marketplace-table-header-resizer ${resizingColumn === column.key ? 'resizing' : ''}`}
                        />
                      </Box>
                    </TableCell>
                  );
                })}
              </TableRow>
              <TableRow>
                {columns.map((column) => {
                  const uniqueValues = getUniqueColumnValues(column.key);
                  const hasFilter = columnFilters[column.key];
                  return (
                    <TableCell
                      key={`filter-${column.key}`}
                      className="marketplace-table-filter-cell"
                      style={{
                        width: `${columnWidths[column.key]}px`,
                        minWidth: `${columnWidths[column.key]}px`,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Select
                        value={columnFilters[column.key] || ''}
                        onChange={(e) => handleColumnFilterChange(column.key, e.target.value)}
                        displayEmpty
                        size="small"
                        className={`marketplace-table-filter-select ${hasFilter ? 'has-filter' : ''}`}
                        MenuProps={{
                          PaperProps: {
                            className: "marketplace-table-filter-menu",
                          },
                        }}
                      >
                        <MenuItem value="">
                          <Box style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <FilterListIcon style={{ fontSize: '0.875rem', color: '#FED208' }} />
                            <span style={{ fontStyle: 'italic', color: '#aaa' }}>Все</span>
                          </Box>
                        </MenuItem>
                        {uniqueValues.map((value) => (
                          <MenuItem key={value} value={value}>
                            {value}
                          </MenuItem>
                        ))}
                      </Select>
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} align="center" className="marketplace-table-empty-cell">
                    {searchTerm ? 'Записи не найдены' : 'Данные отсутствуют'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((row, index) => (
                  <TableRow key={index} className="marketplace-table-row">
                    {columns.map((column) => {
                      const value = (row as any)[column.field] || '-';
                      const isBalanceUnit = column.key === 'balanceUnit';
                      return (
                        <TableCell
                          key={column.key}
                          className={`marketplace-table-cell ${isBalanceUnit ? 'clickable' : ''}`}
                          style={{
                            width: `${columnWidths[column.key]}px`,
                            minWidth: `${columnWidths[column.key]}px`,
                          }}
                          onClick={() => {
                            if (isBalanceUnit) {
                              navigate('/product-details', { state: { product: row } });
                            }
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
