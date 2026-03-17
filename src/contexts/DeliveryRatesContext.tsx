import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import {
  deliveryRatesService,
  DeliveryRatesMap,
  DeliveryRate,
  CompanyDeliveryRate,
  companyRateToMap,
} from '../services/deliveryRatesService';

interface DeliveryRatesContextType {
  // ── Legacy (global delivery_rates table) ──────────────────────────────────
  rates: DeliveryRatesMap;
  ratesList: DeliveryRate[];
  loading: boolean;
  refreshRates: () => Promise<void>;
  updateRate: (id: string, rate: number) => Promise<void>;

  // ── Per-company (company_delivery_rates table) ────────────────────────────
  companyRates: CompanyDeliveryRate[];
  /** Returns the DeliveryRatesMap for a specific БЕ, falling back to global defaults. */
  getRatesForBe: (be: string) => DeliveryRatesMap;
  upsertCompanyRate: (
    be: string,
    companyName: string,
    values: Omit<CompanyDeliveryRate, 'id' | 'be' | 'company_name'>
  ) => Promise<void>;
  refreshCompanyRates: () => Promise<void>;
}

const DeliveryRatesContext = createContext<DeliveryRatesContextType | null>(null);

export function DeliveryRatesProvider({ children }: { children: ReactNode }) {
  const [rates, setRates] = useState<DeliveryRatesMap>(() =>
    deliveryRatesService.getDefaultRates()
  );
  const [ratesList, setRatesList] = useState<DeliveryRate[]>([]);
  const [loading, setLoading] = useState(true);

  const [companyRates, setCompanyRates] = useState<CompanyDeliveryRate[]>([]);

  const refreshRates = useCallback(async () => {
    try {
      setLoading(true);
      const map = await deliveryRatesService.getRatesMap();
      const list = await deliveryRatesService.getAllRates();
      setRates(map);
      setRatesList(list.length > 0 ? list : []);
    } catch {
      setRates(deliveryRatesService.getDefaultRates());
      setRatesList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshCompanyRates = useCallback(async () => {
    try {
      const rows = await deliveryRatesService.getAllCompanyRates();
      setCompanyRates(rows);
    } catch {
      setCompanyRates([]);
    }
  }, []);

  useEffect(() => {
    refreshRates();
    refreshCompanyRates();
  }, [refreshRates, refreshCompanyRates]);

  const updateRate = useCallback(async (id: string, rate: number) => {
    const updated = await deliveryRatesService.updateRate(id, rate);
    setRatesList((prev) =>
      prev.map((r) => (r.id === id ? updated : r))
    );
    setRates((prev) => ({
      ...prev,
      [updated.weight_band]: {
        ...prev[updated.weight_band],
        [updated.distance_band]: Number(updated.rate),
      },
    }));
  }, []);

  const getRatesForBe = useCallback(
    (be: string): DeliveryRatesMap => {
      const row = companyRates.find((r) => r.be === be);
      if (row) return companyRateToMap(row);
      return deliveryRatesService.getDefaultRates();
    },
    [companyRates]
  );

  const upsertCompanyRate = useCallback(
    async (
      be: string,
      companyName: string,
      values: Omit<CompanyDeliveryRate, 'id' | 'be' | 'company_name'>
    ) => {
      const saved = await deliveryRatesService.upsertCompanyRate(be, companyName, values);
      setCompanyRates((prev) => {
        const exists = prev.find((r) => r.be === be);
        if (exists) return prev.map((r) => (r.be === be ? saved : r));
        return [...prev, saved];
      });
    },
    []
  );

  return (
    <DeliveryRatesContext.Provider
      value={{
        rates,
        ratesList,
        loading,
        refreshRates,
        updateRate,
        companyRates,
        getRatesForBe,
        upsertCompanyRate,
        refreshCompanyRates,
      }}
    >
      {children}
    </DeliveryRatesContext.Provider>
  );
}

export function useDeliveryRates() {
  const ctx = useContext(DeliveryRatesContext);
  if (!ctx) throw new Error('useDeliveryRates must be used within DeliveryRatesProvider');
  return ctx;
}
