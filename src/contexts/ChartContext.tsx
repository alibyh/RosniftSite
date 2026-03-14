import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { MappedInventoryRow } from '../services/inventoryService';
import { parseDecimalStr } from '../utils/numberUtils';

const CART_STORAGE_KEY = 'rosneft_cart';

export interface ChartItem {
  id: string;
  row: MappedInventoryRow;
  quantity: number;
  /** Weight in tons for delivery calculation */
  tons?: number;
}

interface ChartContextType {
  items: ChartItem[];
  addToChart: (row: MappedInventoryRow, quantity?: number) => void;
  updateQuantity: (id: string, quantity: number) => void;
  updateTons: (id: string, tons: number) => void;
  removeFromChart: (id: string) => void;
  clearChart: () => void;
  getQuantity: (id: string) => number | null;
}

function loadCartFromStorage(): ChartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ChartItem =>
        item &&
        typeof item === 'object' &&
        typeof (item as ChartItem).id === 'string' &&
        typeof (item as ChartItem).quantity === 'number' &&
        typeof (item as ChartItem).row === 'object'
    );
  } catch {
    return [];
  }
}

const ChartContext = createContext<ChartContextType | null>(null);

export function ChartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ChartItem[]>(() => loadCartFromStorage());

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore quota or other storage errors
    }
  }, [items]);

  const addToChart = useCallback((row: MappedInventoryRow, quantity?: number) => {
    const maxQty = parseDecimalStr(String(row.quantity || '0')) || 1;
    const qty = quantity ?? maxQty;
    const unit = (row.unit || '').trim().toLowerCase();
    const isTon = /^(т|тонн|тонна|тонны|t|ton|tonne)s?$/.test(unit);
    const initialTons = isTon ? Math.min(qty, maxQty) : 0;
    setItems((prev) => {
      const exists = prev.find((i) => i.id === row.id);
      if (exists) {
        return prev.map((i) => (i.id === row.id ? { ...i, quantity: qty, ...(isTon && { tons: initialTons }) } : i));
      }
      return [...prev, { id: row.id, row, quantity: Math.min(qty, maxQty), tons: initialTons }];
    });
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity: Math.max(0, quantity) } : i)).filter((i) => i.quantity > 0)
    );
  }, []);

  const updateTons = useCallback((id: string, tons: number) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, tons: Math.max(0, tons) } : i))
    );
  }, []);

  const removeFromChart = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clearChart = useCallback(() => {
    setItems([]);
  }, []);

  const getQuantity = useCallback(
    (id: string) => {
      const item = items.find((i) => i.id === id);
      return item ? item.quantity : null;
    },
    [items]
  );

  return (
    <ChartContext.Provider value={{ items, addToChart, updateQuantity, updateTons, removeFromChart, clearChart, getQuantity }}>
      {children}
    </ChartContext.Provider>
  );
}

export function useChart() {
  const ctx = useContext(ChartContext);
  if (!ctx) throw new Error('useChart must be used within ChartProvider');
  return ctx;
}
