import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useSelector } from 'react-redux';
import { MappedInventoryRow } from '../services/inventoryService';
import { parseDecimalStr } from '../utils/numberUtils';
import { cartService } from '../services/cartService';
import type { RootState } from '../store/store';

const LEGACY_CART_STORAGE_KEY = 'rosneft_cart';
const USER_CART_STORAGE_KEY_PREFIX = 'rosneft_cart_user_';

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

function parseCart(raw: unknown): ChartItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is ChartItem =>
      item &&
      typeof item === 'object' &&
      typeof (item as ChartItem).id === 'string' &&
      typeof (item as ChartItem).quantity === 'number' &&
      typeof (item as ChartItem).row === 'object'
  );
}

function loadLegacyCartFromStorage(): ChartItem[] {
  try {
    const raw = localStorage.getItem(LEGACY_CART_STORAGE_KEY);
    if (!raw) return [];
    return parseCart(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

function getUserCartStorageKey(userId: string): string {
  return `${USER_CART_STORAGE_KEY_PREFIX}${userId}`;
}

function loadUserCartCache(userId: string): ChartItem[] {
  try {
    const raw = localStorage.getItem(getUserCartStorageKey(userId));
    if (!raw) return [];
    return parseCart(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

const ChartContext = createContext<ChartContextType | null>(null);

export function ChartProvider({ children }: { children: ReactNode }) {
  const user = useSelector((state: RootState) => state.auth.user);
  const userId = user?.id ?? null;
  const [items, setItems] = useState<ChartItem[]>([]);
  const [isHydrating, setIsHydrating] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const hydrateCart = async () => {
      setIsHydrating(true);

      if (!userId) {
        setItems([]);
        setIsHydrating(false);
        return;
      }

      const cached = loadUserCartCache(userId);
      if (cached.length > 0) {
        setItems(cached);
      } else {
        setItems([]);
      }

      const remoteItems = await cartService.getUserCart(userId);
      if (cancelled) return;

      if (remoteItems.length > 0) {
        setItems(remoteItems);
        try {
          localStorage.setItem(getUserCartStorageKey(userId), JSON.stringify(remoteItems));
        } catch {
          // ignore quota or other storage errors
        }
      } else if (cached.length === 0) {
        const legacyItems = loadLegacyCartFromStorage();
        if (legacyItems.length > 0) {
          setItems(legacyItems);
          await cartService.saveUserCart(userId, legacyItems);
          if (cancelled) return;
          try {
            localStorage.setItem(getUserCartStorageKey(userId), JSON.stringify(legacyItems));
            localStorage.removeItem(LEGACY_CART_STORAGE_KEY);
          } catch {
            // ignore quota or other storage errors
          }
        }
      }

      setIsHydrating(false);
    };

    hydrateCart();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || isHydrating) return;
    const saveTimer = window.setTimeout(() => {
      void cartService.saveUserCart(userId, items);
      try {
        localStorage.setItem(getUserCartStorageKey(userId), JSON.stringify(items));
      } catch {
        // ignore quota or other storage errors
      }
    }, 250);

    return () => {
      window.clearTimeout(saveTimer);
    };
  }, [items, userId, isHydrating]);

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
