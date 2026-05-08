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
  Popover,
} from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { inventoryService, xlsxToCsv, MappedInventoryRow } from '../services/inventoryService';
import { useChart } from '../contexts/ChartContext';
import { parseDecimalStr, sanitizeQuantityInput, formatForDisplay } from '../utils/numberUtils';
import './Marketplace.css';

interface ColumnWidths {
  [key: string]: number;
}

type SortDirection = 'asc' | 'desc' | null;
type ColumnFilters = {
  [key: string]: string[];
};
type RangeFilter = { min?: number; max?: number };
type RangeFilters = { [key: string]: RangeFilter };

type DateFilter = {
  year?: string;
  month?: string; // '01'..'12'
  day?: string;   // '01'..'31'
};

const NUMERIC_COLUMN_KEYS = new Set(['quantity', 'cost', 'unitPrice']);
const COLUMN_WIDTHS_STORAGE_KEY = 'marketplace.columnWidths.v1';

const RU_MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

/** Parse a date string in common formats into {y,m,d} (zero-padded strings). Returns null if unparseable. */
function parseReceiptDate(input: string | null | undefined): { y: string; m: string; d: string } | null {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;
  // ISO YYYY-MM-DD or YYYY/MM/DD
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) {
    return { y: m[1], m: m[2].padStart(2, '0'), d: m[3].padStart(2, '0') };
  }
  // DD.MM.YYYY / DD/MM/YYYY / DD-MM-YYYY
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) {
    return { y: m[3], m: m[2].padStart(2, '0'), d: m[1].padStart(2, '0') };
  }
  return null;
}

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
  const defaultColumnWidths = useMemo<ColumnWidths>(() => ({
    balanceUnit: 120,
    companyName: 380,
    receiptDate: 140,
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
  }), []);
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(() => {
    try {
      const saved = localStorage.getItem(COLUMN_WIDTHS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...defaultColumnWidths, ...parsed };
      }
    } catch {
      /* ignore */
    }
    return defaultColumnWidths;
  });

  useEffect(() => {
    try {
      localStorage.setItem(COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(columnWidths));
    } catch {
      /* ignore */
    }
  }, [columnWidths]);
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [tabIndex, setTabIndex] = useState(0); // 0 = Складские запасы, 1 = Мои запасы
  // Filters are kept per-tab so switching tabs preserves each tab's filter state.
  const [columnFiltersByTab, setColumnFiltersByTab] = useState<Record<number, ColumnFilters>>({});
  const [rangeFiltersByTab, setRangeFiltersByTab] = useState<Record<number, RangeFilters>>({});
  const [dateFilterByTab, setDateFilterByTab] = useState<Record<number, DateFilter>>({});
  const columnFilters = columnFiltersByTab[tabIndex] ?? {};
  const rangeFilters = rangeFiltersByTab[tabIndex] ?? {};
  const dateFilter = dateFilterByTab[tabIndex] ?? {};
  const setColumnFilters = useCallback(
    (updater: ColumnFilters | ((prev: ColumnFilters) => ColumnFilters)) => {
      setColumnFiltersByTab((all) => {
        const prev = all[tabIndex] ?? {};
        const next = typeof updater === 'function' ? (updater as (p: ColumnFilters) => ColumnFilters)(prev) : updater;
        return { ...all, [tabIndex]: next };
      });
    },
    [tabIndex]
  );
  const setRangeFilters = useCallback(
    (updater: RangeFilters | ((prev: RangeFilters) => RangeFilters)) => {
      setRangeFiltersByTab((all) => {
        const prev = all[tabIndex] ?? {};
        const next = typeof updater === 'function' ? (updater as (p: RangeFilters) => RangeFilters)(prev) : updater;
        return { ...all, [tabIndex]: next };
      });
    },
    [tabIndex]
  );
  const setDateFilter = useCallback(
    (updater: DateFilter | ((prev: DateFilter) => DateFilter)) => {
      setDateFilterByTab((all) => {
        const prev = all[tabIndex] ?? {};
        const next = typeof updater === 'function' ? (updater as (p: DateFilter) => DateFilter)(prev) : updater;
        return { ...all, [tabIndex]: next };
      });
    },
    [tabIndex]
  );
  const [dateFilterAnchor, setDateFilterAnchor] = useState<HTMLElement | null>(null);
  const justResizedRef = useRef<boolean>(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
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

  /** Apply column, range, and date filters. `skipColumnKey` excludes that column's filter (used when computing its own dropdown options). */
  const applyFilters = useCallback(
    (rows: MappedInventoryRow[], skipColumnKey?: string) => {
      let out = rows;
      // Multi-select column filters
      Object.entries(columnFilters).forEach(([columnKey, values]) => {
        if (skipColumnKey === columnKey) return;
        if (values && values.length > 0) {
          const field = columns.find((col) => col.key === columnKey)?.field || columnKey;
          const set = new Set(values.map((v) => v.trim()));
          out = out.filter((row) => {
            const rowValue = String((row as any)[field] || '').trim();
            return set.has(rowValue);
          });
        }
      });
      // Numeric range filters
      Object.entries(rangeFilters).forEach(([columnKey, range]) => {
        if (skipColumnKey === columnKey) return;
        if (!range) return;
        const hasMin = range.min !== undefined && !isNaN(range.min);
        const hasMax = range.max !== undefined && !isNaN(range.max);
        if (!hasMin && !hasMax) return;
        const field = columns.find((col) => col.key === columnKey)?.field || columnKey;
        out = out.filter((row) => {
          const num = parseDecimalStr(String((row as any)[field] ?? ''));
          if (isNaN(num)) return false;
          if (hasMin && num < (range.min as number)) return false;
          if (hasMax && num > (range.max as number)) return false;
          return true;
        });
      });
      // Date filter (treated as filter on receiptDate column)
      if (skipColumnKey !== 'receiptDate' && (dateFilter.year || dateFilter.month || dateFilter.day)) {
        out = out.filter((row) => {
          const parsed = parseReceiptDate((row as any).receiptDate);
          if (!parsed) return false;
          if (dateFilter.year && parsed.y !== dateFilter.year) return false;
          if (dateFilter.month && parsed.m !== dateFilter.month) return false;
          if (dateFilter.day && parsed.d !== dateFilter.day) return false;
          return true;
        });
      }
      return out;
    },
    [columnFilters, rangeFilters, dateFilter, columns]
  );

  // Per-column unique values reflect all OTHER active filters (Excel-style).
  const getUniqueColumnValues = useCallback(
    (columnKey: string) => {
      const field = columns.find((col) => col.key === columnKey)?.field || columnKey;
      const base = applyFilters(dataForTab, columnKey);
      const uniqueValues = new Set<string>();
      base.forEach((row) => {
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
    },
    [applyFilters, dataForTab, columns]
  );

  // Date filter dropdown options: years/months/days available given the OTHER active column filters.
  const dateFilterOptions = useMemo(() => {
    const baseRows = applyFilters(dataForTab, 'receiptDate');
    const years = new Set<string>();
    const months = new Set<string>();
    const days = new Set<string>();
    baseRows.forEach((row) => {
      const p = parseReceiptDate((row as any).receiptDate);
      if (!p) return;
      years.add(p.y);
      if (!dateFilter.year || p.y === dateFilter.year) {
        months.add(p.m);
        if (!dateFilter.month || p.m === dateFilter.month) {
          days.add(p.d);
        }
      }
    });
    return {
      years: Array.from(years).sort(),
      months: Array.from(months).sort(),
      days: Array.from(days).sort(),
    };
  }, [applyFilters, dataForTab, dateFilter]);

  const filteredData = useMemo(() => {
    let filtered = applyFilters(dataForTab);

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
  }, [applyFilters, dataForTab, sortColumn, sortDirection]);

  // Calculate paginated data
  const paginatedData = useMemo(() => {
    const startIndex = page * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, page, rowsPerPage]);

  // Reset to first page when filters change
  useEffect(() => {
    setPage(0);
  }, [columnFilters, rangeFilters, dateFilter, sortColumn, sortDirection]);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
    console.log(event);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSort = (columnKey: string) => {
    // Suppress sort if the click was the tail of a column resize.
    if (justResizedRef.current) return;
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
    e.stopPropagation();
    setResizingColumn(columnKey);
    const startX = e.pageX;
    const startWidth = columnWidths[columnKey];
    let moved = false;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const diff = moveEvent.pageX - startX;
      if (Math.abs(diff) > 1) moved = true;
      const newWidth = Math.max(50, startWidth + diff); // Minimum width of 50px
      setColumnWidths((prev) => ({
        ...prev,
        [columnKey]: newWidth,
      }));
    };

    const handleMouseUp = () => {
      setResizingColumn(null);
      // Block the click that bubbles to the TableCell after mouseup so it
      // doesn't trigger a sort. Cleared on the next tick.
      if (moved) {
        justResizedRef.current = true;
        setTimeout(() => {
          justResizedRef.current = false;
        }, 0);
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleColumnFilterChange = (columnKey: string, values: string[]) => {
    setColumnFilters((prev) => {
      if (!values || values.length === 0) {
        const newFilters = { ...prev };
        delete newFilters[columnKey];
        return newFilters;
      }
      return { ...prev, [columnKey]: values };
    });
  };

  const handleRangeFilterChange = (columnKey: string, next: RangeFilter) => {
    setRangeFilters((prev) => {
      const hasMin = next.min !== undefined && !isNaN(next.min);
      const hasMax = next.max !== undefined && !isNaN(next.max);
      if (!hasMin && !hasMax) {
        const out = { ...prev };
        delete out[columnKey];
        return out;
      }
      return { ...prev, [columnKey]: next };
    });
  };

  const clearAllFilters = () => {
    setColumnFilters({});
    setRangeFilters({});
    setDateFilter({});
  };

  const activeFilterCount =
    Object.keys(columnFilters).length +
    Object.keys(rangeFilters).length +
    (dateFilter.year || dateFilter.month || dateFilter.day ? 1 : 0);

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
              setDateFilterAnchor(null);
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
                  {dataForTab[0]?.profitability ? `${String(dataForTab[0]?.profitability).replace('.', ',')}%` : '-'}
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
              {activeFilterCount > 0 && (
                <span style={{ marginLeft: '16px' }}>
                  Активных фильтров: {activeFilterCount}
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
          {activeFilterCount > 0 && (
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
                  if (column.key === 'receiptDate') {
                    const hasFilter = !!(dateFilter.year || dateFilter.month || dateFilter.day);
                    const summary = hasFilter
                      ? [dateFilter.year, dateFilter.month, dateFilter.day].filter(Boolean).join('-')
                      : 'Все';
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
                        <Box
                          onClick={(e) => setDateFilterAnchor(e.currentTarget)}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 1,
                            px: 1,
                            height: 32,
                            borderRadius: '4px',
                            cursor: 'pointer',
                            backgroundColor: 'rgba(42,42,42,0.99)',
                            color: hasFilter ? '#FED208' : '#fff',
                            border: `1px solid ${hasFilter ? '#FED208' : 'rgba(255,255,255,0.23)'}`,
                            fontSize: '0.875rem',
                            '&:hover': { borderColor: '#FED208' },
                          }}
                        >
                          <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {summary}
                          </Box>
                          <Box sx={{ fontSize: '0.7rem', opacity: 0.7 }}>▾</Box>
                        </Box>
                      </TableCell>
                    );
                  }
                  if (NUMERIC_COLUMN_KEYS.has(column.key)) {
                    const range = rangeFilters[column.key] ?? {};
                    const hasRange = range.min !== undefined || range.max !== undefined;
                    const rangeFieldSx = {
                      flex: 1,
                      minWidth: 0,
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: 'rgba(42,42,42,0.99)',
                        color: '#fff',
                        '& fieldset': { borderColor: hasRange ? '#FED208' : 'rgba(255,255,255,0.23)' },
                        '&:hover fieldset': { borderColor: '#FED208' },
                      },
                      '& .MuiInputBase-input': { color: '#fff' },
                    };
                    const parseInput = (raw: string): number | undefined => {
                      const v = raw.trim();
                      if (!v) return undefined;
                      const n = parseDecimalStr(v);
                      return isNaN(n) ? undefined : n;
                    };
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
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <TextField
                            size="small"
                            placeholder="Мин"
                            defaultValue={range.min !== undefined ? String(range.min).replace('.', ',') : ''}
                            onBlur={(e) =>
                              handleRangeFilterChange(column.key, { ...range, min: parseInput(e.target.value) })
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            }}
                            sx={rangeFieldSx}
                          />
                          <TextField
                            size="small"
                            placeholder="Макс"
                            defaultValue={range.max !== undefined ? String(range.max).replace('.', ',') : ''}
                            onBlur={(e) =>
                              handleRangeFilterChange(column.key, { ...range, max: parseInput(e.target.value) })
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            }}
                            sx={rangeFieldSx}
                          />
                        </Box>
                      </TableCell>
                    );
                  }
                  const uniqueValues = getUniqueColumnValues(column.key);
                  const selected = columnFilters[column.key] ?? [];
                  const hasFilter = selected.length > 0;
                  // Drop selections that no longer exist in current uniqueValues (avoid Autocomplete warnings).
                  const validSelected = selected.filter((v) => uniqueValues.includes(v));
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
                        multiple
                        disableCloseOnSelect
                        size="small"
                        options={uniqueValues}
                        value={validSelected}
                        onChange={(_e, newValue) => handleColumnFilterChange(column.key, newValue)}
                        getOptionLabel={(opt) => String(opt)}
                        limitTags={1}
                        renderInput={(params) => (
                          <TextField {...params} placeholder={hasFilter ? '' : 'Все'} />
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
                          '& .MuiChip-root': {
                            backgroundColor: 'rgba(254,210,8,0.18)',
                            color: '#FED208',
                            border: '1px solid rgba(254,210,8,0.5)',
                            height: 22,
                            '& .MuiChip-deleteIcon': { color: '#FED208' },
                          },
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
                    {activeFilterCount > 0 ? 'Записи не найдены по заданным фильтрам' : 'Данные отсутствуют'}
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
                          value={
                            chartQtyEditing?.id === row.id
                              ? chartQtyEditing.value
                              : (chartQty != null ? formatForDisplay(chartQty, 3) : '')
                          }
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
                          onFocus={() => setChartQtyEditing({ id: row.id, value: sanitizeQuantityInput(String(chartQty ?? '')) })}
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

        <Popover
          open={!!dateFilterAnchor}
          anchorEl={dateFilterAnchor}
          onClose={() => setDateFilterAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          slotProps={{
            paper: {
              sx: {
                p: 1.5,
                backgroundColor: 'rgba(30,30,30,0.98)',
                border: '1px solid rgba(254,210,8,0.3)',
                minWidth: 360,
              },
            },
          }}
        >
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Autocomplete
              size="small"
              options={dateFilterOptions.years}
              value={dateFilter.year ?? null}
              onChange={(_e, v) =>
                setDateFilter((prev) => {
                  const next: DateFilter = { ...prev, year: v ?? undefined };
                  if (!v) { next.month = undefined; next.day = undefined; }
                  return next;
                })
              }
              renderInput={(params) => <TextField {...params} placeholder="Год" />}
              sx={{
                flex: 1,
                minWidth: 100,
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'rgba(42,42,42,0.99)',
                  color: '#fff',
                  '& fieldset': { borderColor: dateFilter.year ? '#FED208' : 'rgba(255,255,255,0.23)' },
                  '&:hover fieldset': { borderColor: '#FED208' },
                },
                '& .MuiInputBase-input': { color: '#fff' },
                '& .MuiAutocomplete-clearIndicator': { color: 'rgba(255,255,255,0.54)' },
                '& .MuiAutocomplete-popupIndicator': { color: 'rgba(255,255,255,0.54)' },
              }}
              slotProps={{ paper: { className: 'marketplace-table-filter-menu' } }}
            />
            <Autocomplete
              size="small"
              disabled={!dateFilter.year}
              options={dateFilterOptions.months}
              value={dateFilter.month ?? null}
              getOptionLabel={(m) => `${m} — ${RU_MONTHS[parseInt(m, 10) - 1] ?? ''}`}
              onChange={(_e, v) =>
                setDateFilter((prev) => {
                  const next: DateFilter = { ...prev, month: v ?? undefined };
                  if (!v) next.day = undefined;
                  return next;
                })
              }
              renderInput={(params) => <TextField {...params} placeholder="Месяц" />}
              sx={{
                flex: 1.4,
                minWidth: 130,
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'rgba(42,42,42,0.99)',
                  color: '#fff',
                  '& fieldset': { borderColor: dateFilter.month ? '#FED208' : 'rgba(255,255,255,0.23)' },
                  '&:hover fieldset': { borderColor: '#FED208' },
                },
                '& .MuiInputBase-input': { color: '#fff' },
                '& .MuiAutocomplete-clearIndicator': { color: 'rgba(255,255,255,0.54)' },
                '& .MuiAutocomplete-popupIndicator': { color: 'rgba(255,255,255,0.54)' },
              }}
              slotProps={{ paper: { className: 'marketplace-table-filter-menu' } }}
            />
            <Autocomplete
              size="small"
              disabled={!dateFilter.month}
              options={dateFilterOptions.days}
              value={dateFilter.day ?? null}
              onChange={(_e, v) => setDateFilter((prev) => ({ ...prev, day: v ?? undefined }))}
              renderInput={(params) => <TextField {...params} placeholder="День" />}
              sx={{
                flex: 1,
                minWidth: 90,
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'rgba(42,42,42,0.99)',
                  color: '#fff',
                  '& fieldset': { borderColor: dateFilter.day ? '#FED208' : 'rgba(255,255,255,0.23)' },
                  '&:hover fieldset': { borderColor: '#FED208' },
                },
                '& .MuiInputBase-input': { color: '#fff' },
                '& .MuiAutocomplete-clearIndicator': { color: 'rgba(255,255,255,0.54)' },
                '& .MuiAutocomplete-popupIndicator': { color: 'rgba(255,255,255,0.54)' },
              }}
              slotProps={{ paper: { className: 'marketplace-table-filter-menu' } }}
            />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.5 }}>
            <Button
              size="small"
              onClick={() => setDateFilter({})}
              sx={{ color: 'rgba(255,255,255,0.7)', textTransform: 'none' }}
            >
              Сбросить
            </Button>
            <Button
              size="small"
              onClick={() => setDateFilterAnchor(null)}
              sx={{ color: '#FED208', textTransform: 'none' }}
            >
              Готово
            </Button>
          </Box>
        </Popover>
      </Container>
    </Box>
  );
};

export default Marketplace;
