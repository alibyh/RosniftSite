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
  CircularProgress,
  Alert,
  TablePagination,
  Tabs,
  Tab,
  Autocomplete,
} from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { inventoryService, MappedInventoryRow } from '../services/inventoryService';
import { RootState } from '../store/store';
import './Marketplace.css';

interface ColumnWidths {
  [key: string]: number;
}

type SortDirection = 'asc' | 'desc' | null;
type ColumnFilters = {
  [key: string]: string;
};

const Marketplace: React.FC = () => {
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.auth.user);
  const [data, setData] = useState<MappedInventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>({
    balanceUnit: 120,
    companyName: 380,
    receiptDate: 110,
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
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [tabIndex, setTabIndex] = useState(0); // 0 = Складские запасы, 1 = Мои запасы
  const tableRef = useRef<HTMLDivElement>(null);

  const columns = [
    { key: 'balanceUnit', label: 'БЕ', field: 'balanceUnit' },
    { key: 'companyName', label: 'Наименование дочернего Общества', field: 'companyName' },
    { key: 'receiptDate', label: 'Дата поступления', field: 'receiptDate' },
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

  // Base data for current tab: Складские запасы = exclude user's; Мои запасы = only by companyId
  const dataForTab = useMemo(() => {
    if (!user) return data;
    if (tabIndex === 1) {
      // Мои запасы: filter by companyId only
      return user.companyId
        ? data.filter((row) => row.balanceUnit === user.companyId)
        : [];
    }
    // Складские запасы: exclude user's (by companyId and by warehouse)
    const userWarehouseAddresses = (user.warehouses || []).map((wh) =>
      typeof wh === 'string' ? wh : (wh as { address?: string }).address || ''
    );
    const isUserRow = (row: MappedInventoryRow) => {
      if (user.companyId && row.balanceUnit === user.companyId) return true;
      if (userWarehouseAddresses.some((addr) => addr && row.warehouseAddress?.toLowerCase().includes(addr.trim().toLowerCase()))) return true;
      return false;
    };
    return data.filter((row) => !isUserRow(row));
  }, [data, user, tabIndex]);

  // Get unique values for a column (based on current tab data)
  const getUniqueColumnValues = useMemo(() => {
    const baseFiltered = dataForTab;

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
  }, [dataForTab, columns]);

  const filteredData = useMemo(() => {
    let filtered = dataForTab;

    // Apply column filters (advanced filter by column)
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
  }, [dataForTab, sortColumn, sortDirection, columnFilters]);

  // Calculate paginated data
  const paginatedData = useMemo(() => {
    const startIndex = page * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, page, rowsPerPage]);

  // Reset to first page when filters change
  useEffect(() => {
    setPage(0);
  }, [columnFilters, sortColumn, sortDirection]);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
    console.log(event);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

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
        <Box sx={{ borderBottom: 1, borderColor: 'divider', marginBottom: 2 }}>
          <Tabs
            value={tabIndex}
            onChange={(_e, newValue: number) => {
              setTabIndex(newValue);
              setPage(0);
            }}
            sx={{
              minHeight: 56,
              '& .MuiTab-root': {
                fontWeight: 600,
                color: 'rgba(255,255,255,0.85)',
                fontSize: '1rem',
                minHeight: 56,
                padding: '12px 20px',
                textTransform: 'none',
              },
              '& .Mui-selected': { color: '#FED208' },
              '& .MuiTabs-indicator': { backgroundColor: '#FED208' },
            }}
          >
            <Tab label="Складские запасы" id="marketplace-tab-0" aria-controls="marketplace-tabpanel-0" />
            <Tab label="Мои запасы" id="marketplace-tab-1" aria-controls="marketplace-tabpanel-1" />
          </Tabs>
        </Box>

        <Box className="marketplace-info-box">
          <Box className="marketplace-info-left">
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
            <TablePagination
              component="div"
              count={filteredData.length}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[10, 25, 50, 100]}
              labelRowsPerPage="Строк на странице:"
              labelDisplayedRows={({ from, to, count }) => `${from}–${to} из ${count !== -1 ? count : `более чем ${to}`}`}
              className="marketplace-pagination-top"
            />
          </Box>
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
                  const rawValue = columnFilters[column.key] || null;
                  const filterValue = rawValue && uniqueValues.includes(rawValue) ? rawValue : null;
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
                      <Autocomplete
                        size="small"
                        options={uniqueValues}
                        value={filterValue}
                        onChange={(_e, newValue) => handleColumnFilterChange(column.key, newValue ?? '')}
                        getOptionLabel={(opt) => String(opt)}
                        renderInput={(params) => (
                          <TextField {...params} placeholder="Все" />
                        )}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            backgroundColor: 'rgba(42,42,42,0.99)',
                            color: '#fff',
                            '& fieldset': { borderColor: hasFilter ? '#FED208' : 'rgba(255,255,255,0.23)' },
                            '&:hover fieldset': { borderColor: '#FED208' },
                          },
                          '& .MuiInputBase-input': { color: '#fff' },
                          '& .MuiAutocomplete-clearIndicator': { color: 'rgba(255,255,255,0.54)' },
                          '& .MuiAutocomplete-popupIndicator': { color: 'rgba(255,255,255,0.54)' },
                        }}
                        className={`marketplace-table-filter-select ${hasFilter ? 'has-filter' : ''}`}
                        slotProps={{
                          paper: { className: 'marketplace-table-filter-menu' },
                        }}
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} align="center" className="marketplace-table-empty-cell">
                    {Object.keys(columnFilters).length > 0 ? 'Записи не найдены по заданным фильтрам' : 'Данные отсутствуют'}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((row, index) => (
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
