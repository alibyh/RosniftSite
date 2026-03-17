import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAppSelector } from '../store/store';
import type { RootState } from '../store/store';
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
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { inventoryService, xlsxToCsv, MappedInventoryRow } from '../services/inventoryService';
import { useChart } from '../contexts/ChartContext';
import { parseDecimalStr, sanitizeQuantityInput } from '../utils/numberUtils';
import './Marketplace.css';

interface ColumnWidths {
  [key: string]: number;
}

type SortDirection = 'asc' | 'desc' | null;
type ColumnFilters = {
  [key: string]: string;
};

/** Format number: space as thousands separator, comma as decimal separator. If decimals is provided, number is rounded to that precision. */
function formatNumber(value: string | number, decimals?: number): string {
  const str = String(value ?? '').trim();
  if (!str || str === '-') return str;
  const num = parseDecimalStr(str);
  if (isNaN(num)) return str;
  const raw = decimals !== undefined ? num.toFixed(decimals) : num.toString();
  const parts = raw.split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const decPart = parts[1] ? ',' + parts[1] : '';
  return intPart + decPart;
}

const Marketplace: React.FC = () => {
  const user = useAppSelector((state: RootState) => state.auth.user);
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
    unitPrice: 160,
    profitability: 150,
    cost: 200,
    chartActions: 200,
  });
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [tabIndex, setTabIndex] = useState(0); // 0 = Складские запасы, 1 = Мои запасы
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [uploadPreview, setUploadPreview] = useState<{
    rows: Record<string, string | number | null>[];
    columns: string[];
    be: string;
    companyName: string;
    profitability: string;
    csvText: string;
  } | null>(null);
  const [chartQtyEditing, setChartQtyEditing] = useState<{ id: string; value: string } | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addToChart, updateQuantity, removeFromChart, getQuantity } = useChart();

  const loadData = useCallback(async () => {
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
  }, []);

  const warehouseColumns = [
    { key: 'balanceUnit', label: 'БЕ', field: 'balanceUnit' },
    { key: 'companyName', label: 'Наименование общества', field: 'companyName' },
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

  const myInventoryColumns = [
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
    { key: 'unitPrice', label: 'Цена запаса, руб', field: 'unitPrice' },
    { key: 'cost', label: 'Стоимость запасов, руб', field: 'cost' },
  ];

  const columns = tabIndex === 1 ? myInventoryColumns : warehouseColumns;

  const tableWidth = useMemo(
    () => columns.reduce((sum, c) => sum + (columnWidths[c.key] ?? 0), 0),
    [columnWidths, columns]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Base data for current tab: Складские запасы = exclude user's; Мои запасы = only by companyId
  const dataForTab = useMemo(() => {
    if (!user) return data;
    if (tabIndex === 1) {
      const myRows = user.companyId
        ? data.filter((row) => row.balanceUnit === user.companyId)
        : [];
      return myRows.map((row) => {
        const qty = parseDecimalStr(row.quantity) || 0;
        const price = parseDecimalStr(row.unitPrice) || 0;
        const profitPct = parseDecimalStr(row.profitability) || 0;
        const computed = qty * price * (1 + profitPct / 100);
        return {
          ...row,
          cost: computed > 0 ? String(computed) : '',
        };
      });
    }
    // Складские запасы: exclude user's (by companyId and by warehouse)
    const userWarehouseAddresses = (user.warehouses || []).map((wh: string | { address?: string }) =>
      typeof wh === 'string' ? wh : wh.address || ''
    );
    const isUserRow = (row: MappedInventoryRow) => {
      if (user.companyId && row.balanceUnit === user.companyId) return true;
      if (userWarehouseAddresses.some((addr: string) => addr && row.warehouseAddress?.toLowerCase().includes(addr.trim().toLowerCase()))) return true;
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
        const aNum = parseDecimalStr(a);
        const bNum = parseDecimalStr(b);
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

        // Handle numeric values
        if (sortColumn === 'quantity' || sortColumn === 'cost' || sortColumn === 'unitPrice' || sortColumn === 'profitability') {
          const aNum = parseDecimalStr(aValue ?? '') || 0;
          const bNum = parseDecimalStr(bValue ?? '') || 0;
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.companyId) return;
    e.target.value = '';
    setUploadMessage(null);
    setUploading(true);
    try {
      let text: string;
      const isXlsx = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');
      if (isXlsx) {
        const buffer = await file.arrayBuffer();
        text = xlsxToCsv(buffer);
      } else {
        text = await file.text();
      }
      const parsed = inventoryService.parseCsvForPreview(text);
      if (parsed.rows.length === 0) {
        setUploadMessage({ type: 'error', text: 'Файл пуст или не содержит данных' });
        return;
      }
      // Get existing profitability from already-loaded data for this company
      const existingRow = data.find((r) => r.balanceUnit === user.companyId && r.profitability);
      const profitability = existingRow?.profitability ?? '';
      setUploadPreview({
        rows: parsed.rows,
        columns: parsed.columns,
        be: parsed.be,
        companyName: parsed.companyName,
        profitability,
        csvText: text,
      });
    } catch (err) {
      setUploadMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Ошибка при чтении файла',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmUpload = async () => {
    if (!uploadPreview || !user?.companyId) return;
    const { csvText, profitability } = uploadPreview;
    setUploading(true);
    setUploadMessage(null);
    try {
      const result = await inventoryService.updateInventoryFromFile(user.companyId, csvText, {
        defaultProfitability: profitability || undefined,
      });
      setUploadMessage({
        type: 'success',
        text: `Обновлено: удалено ${result.deleted} записей, добавлено ${result.inserted} записей`,
      });
      setUploadPreview(null);
      await loadData();
      setTimeout(() => setUploadMessage(null), 5000);
    } catch (err) {
      setUploadMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Ошибка при загрузке файла',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleCancelPreview = () => {
    setUploadPreview(null);
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

        {uploadMessage && (
          <Alert
            severity={uploadMessage.type}
            onClose={() => setUploadMessage(null)}
            sx={{ marginBottom: 2 }}
          >
            {uploadMessage.text}
          </Alert>
        )}

        <Dialog
          open={!!uploadPreview}
          onClose={handleCancelPreview}
          maxWidth='xl'
          fullWidth
          PaperProps={{
            sx: {
              backgroundColor: 'rgba(30,30,30,0.98)',
              border: '1px solid rgba(254,210,8,0.3)',
            },
          }}
        >
          {uploadPreview && (
            <>
              <DialogTitle sx={{ color: '#FED208', borderBottom: '1px solid rgba(254,210,8,0.3)' }}>
                Проверка данных перед загрузкой
              </DialogTitle>
              <DialogContent sx={{ pt: 2 }}>
                <Box sx={{ mb: 2, p: 2, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 1 }}>
                  <Typography variant="subtitle2" sx={{ color: '#FED208', fontWeight: 600, mb: 1.5 }}>
                    БЕ и Наименование дочернего Общества
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'baseline' }}>
                    <Box>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: 'block' }}>
                        БЕ
                      </Typography>
                      <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '1rem' }}>
                        {uploadPreview.be || '—'}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: '1 1 300px', minWidth: 0 }}>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: 'block' }}>
                        Наименование дочернего Общества
                      </Typography>
                      <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '1rem' }} noWrap title={uploadPreview.companyName || ''}>
                        {uploadPreview.companyName || '—'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: 'block' }}>
                        Рентабельность
                      </Typography>
                      <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '1rem' }}>
                        {uploadPreview.profitability ? `${uploadPreview.profitability}%` : '—'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: 'block' }}>
                        Рентабельность
                      </Typography>
                      <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '1rem' }}>
                        {uploadPreview.profitability ? `${uploadPreview.profitability}%` : '—'}
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 1 }}>
                  Предпросмотр данных ({uploadPreview.rows.length} записей)
                </Typography>
                <TableContainer component={Paper} sx={{ maxHeight: 400, overflow: 'auto', mb: 2 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        {uploadPreview.columns.map((col) => (
                          <TableCell key={col} sx={{ color: '#FED208', fontWeight: 700, bgcolor: 'rgba(42,42,42,0.99)' }}>
                            {col}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {uploadPreview.rows.slice(0, 50).map((row, idx) => (
                        <TableRow key={idx}>
                          {uploadPreview.columns.map((col) => {
                            let display: string;
                            if (col === 'Стоимость запасов') {
                              const qty = parseDecimalStr(String(row['Количество'] ?? '')) || 0;
                              const price = parseDecimalStr(String(row['Цена запаса'] ?? '')) || 0;
                              const profitPct = parseDecimalStr(uploadPreview.profitability) || 0;
                              const computed = qty * price * (1 + profitPct / 100);
                              display = computed > 0 ? formatNumber(computed, 2) : '—';
                            } else if (col === 'Количество' || col === 'Цена запаса') {
                              display = formatNumber(row[col] ?? '');
                            } else {
                              display = String(row[col] ?? '-');
                            }
                            return (
                              <TableCell key={col} sx={{ color: 'black' }}>
                                {display}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                {uploadPreview.rows.length > 50 && (
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                    Показаны первые 50 из {uploadPreview.rows.length} записей
                  </Typography>
                )}
              </DialogContent>
              <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(254,210,8,0.2)' }}>
                <Button onClick={handleCancelPreview} sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  Отмена
                </Button>
                <Button
                  variant="contained"
                  onClick={handleConfirmUpload}
                  disabled={uploading}
                  sx={{
                    backgroundColor: '#FED208',
                    color: 'black !important',
                    '&:hover': { backgroundColor: '#F6D106', color:'red !important' },
                  }}
                >
                  {uploading ? 'Загрузка...' : 'Подтвердить загрузку'}
                </Button>
              </DialogActions>
            </>
          )}
        </Dialog>

        {tabIndex === 1 && user?.companyId && dataForTab.length > 0 && (
          <Paper
            sx={{
              p: 2,
              mb: 2,
              backgroundColor: 'rgba(42,42,42,0.95)',
              border: '1px solid rgba(254,210,8,0.3)',
            }}
            >
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 3 }}>
              <Box>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>БЕ</Typography>
                <Typography sx={{ color: '#fff', fontWeight: 500 }}>
                  {dataForTab[0]?.balanceUnit || user.companyId}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                  Наименование дочернего Общества
                </Typography>
                <Typography sx={{ color: '#fff', fontWeight: 500 }} noWrap title={dataForTab[0]?.companyName}>
                  {dataForTab[0]?.companyName || '-'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                  Рентабельность
                </Typography>
                <Typography sx={{ color: '#fff', fontWeight: 500 }}>
                  {dataForTab[0]?.profitability ? `${dataForTab[0]?.profitability}%` : '-'}
                </Typography>
              </Box>
            </Box>
          </Paper>
        )}

        <Box className="marketplace-info-box">
          <Box className="marketplace-info-left">
            {tabIndex === 1 && user?.companyId && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />
                <Button
                  variant="outlined"
                  startIcon={<CloudUploadIcon />}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  sx={{
                    marginRight: 2,
                    borderColor: '#FED208',
                    color: '#FED208',
                    '&:hover': { borderColor: '#FED208', backgroundColor: 'rgba(254,210,8,0.08)' },
                  }}
                >
                  {uploading ? 'Загрузка...' : 'Обновить данные'}
                </Button>
              </>
            )}
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
          <Box
            component="div"
            sx={{
              display: 'inline-flex',
              width: 'auto',
            }}
          >
            <Table stickyHeader style={{ tableLayout: 'fixed', width: tableWidth }}>
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
                        getOptionLabel={(opt) =>
                          column.key === 'cost'
                            ? formatNumber(opt, 2)
                            : (column.key === 'quantity' || column.key === 'unitPrice')
                            ? formatNumber(opt)
                            : String(opt)
                        }
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
                        const rawValue = (row as any)[column.field] ?? '';
                        const value = rawValue === '' || rawValue == null ? '-' : rawValue;
                        const isNumericCol = column.key === 'quantity' || column.key === 'cost' || column.key === 'unitPrice';
                        const displayValue = isNumericCol
                          ? (column.key === 'cost' ? formatNumber(value, 2) : formatNumber(value))
                          : value;
                        return (
                          <TableCell
                            key={column.key}
                            className="marketplace-table-cell"
                            style={{
                              width: `${columnWidths[column.key]}px`,
                              minWidth: `${columnWidths[column.key]}px`,
                            }}
                            title={typeof displayValue === 'string' ? displayValue : String(displayValue)}
                          >
                            {displayValue}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {tabIndex === 0 && (
            <Box
              className="marketplace-chart-panel"
              sx={{ width: 'auto' }}
            >
              <Box className="marketplace-chart-panel-header">
                В корзину
              </Box>
              <Box className="marketplace-chart-panel-filter" />
              {paginatedData.map((row) => {
                const inChart = getQuantity(row.id) !== null;
                const chartQty = getQuantity(row.id);
                return (
                  <Box key={row.id} className="marketplace-chart-panel-row">
                    {!inChart ? (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<AddShoppingCartIcon />}
                        onClick={() => addToChart(row)}
                        sx={{
                          borderColor: '#FED208',
                          color: '#FED208',
                          '&:hover': { borderColor: '#FED208', backgroundColor: 'rgba(254,210,8,0.08)' },
                        }}
                      >
                      </Button>
                    ) : (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <TextField
                          type="text"
                          inputMode="decimal"
                          size="small"
                          value={chartQtyEditing?.id === row.id ? chartQtyEditing.value : String(chartQty ?? '')}
                          onChange={(e) =>
                            setChartQtyEditing({ id: row.id, value: sanitizeQuantityInput(e.target.value) })
                          }
                          onBlur={() => {
                            const raw = chartQtyEditing?.id === row.id ? chartQtyEditing.value : String(chartQty ?? '');
                            const parsed = parseDecimalStr(raw);
                            const maxQty = parseDecimalStr(String(row.quantity || '0')) || 0;
                            const valid = !isNaN(parsed) && parsed > 0;
                            const clamped = valid
                              ? Math.min(parsed, maxQty)
                              : Math.min(1, maxQty);
                            updateQuantity(row.id, clamped);
                            setChartQtyEditing(null);
                          }}
                          onFocus={() => setChartQtyEditing({ id: row.id, value: String(chartQty ?? '') })}
                          inputProps={{ min: 0, step: 0.001 }}
                          sx={{
                            width: 110,
                            '& .MuiOutlinedInput-root': {
                              color: '#fff',
                              '& fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                            },
                          }}
                        />
                        <IconButton
                          size="small"
                          onClick={() => removeFromChart(row.id)}
                          sx={{ color: '#FED208' }}
                          aria-label="удалить"
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>
          )}
          </Box>
        </TableContainer>
      </Container>
    </Box>
  );
};

export default Marketplace;
