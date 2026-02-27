import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { MappedInventoryRow } from '../services/inventoryService';

export interface ChartItem {
  id: string;
  row: MappedInventoryRow;
  quantity: number;
}

interface ChartContextType {
  items: ChartItem[];
  addToChart: (row: MappedInventoryRow, quantity?: number) => void;
  updateQuantity: (id: string, quantity: number) => void;
  removeFromChart: (id: string) => void;
  getQuantity: (id: string) => number | null;
}

const ChartContext = createContext<ChartContextType | null>(null);

export function ChartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ChartItem[]>([]);

  const addToChart = useCallback((row: MappedInventoryRow, quantity?: number) => {
    const maxQty = parseFloat(String(row.quantity || '0').replace(/\s/g, '')) || 1;
    const qty = quantity ?? maxQty;
    setItems((prev) => {
      const exists = prev.find((i) => i.id === row.id);
      if (exists) {
        return prev.map((i) => (i.id === row.id ? { ...i, quantity: qty } : i));
      }
      return [...prev, { id: row.id, row, quantity: Math.min(qty, maxQty) }];
    });
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity: Math.max(0, quantity) } : i)).filter((i) => i.quantity > 0)
    );
  }, []);

  const removeFromChart = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const getQuantity = useCallback(
    (id: string) => {
      const item = items.find((i) => i.id === id);
      return item ? item.quantity : null;
    },
    [items]
  );

  return (
    <ChartContext.Provider value={{ items, addToChart, updateQuantity, removeFromChart, getQuantity }}>
      {children}
    </ChartContext.Provider>
  );
}

export function useChart() {
  const ctx = useContext(ChartContext);
  if (!ctx) throw new Error('useChart must be used within ChartProvider');
  return ctx;
}
