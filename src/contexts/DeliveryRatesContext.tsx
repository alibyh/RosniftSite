import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import {
  deliveryRatesService,
  DeliveryRatesMap,
  DeliveryRate,
} from '../services/deliveryRatesService';

interface DeliveryRatesContextType {
  rates: DeliveryRatesMap;
  ratesList: DeliveryRate[];
  loading: boolean;
  refreshRates: () => Promise<void>;
  updateRate: (id: string, rate: number) => Promise<void>;
}

const DeliveryRatesContext = createContext<DeliveryRatesContextType | null>(null);

export function DeliveryRatesProvider({ children }: { children: ReactNode }) {
  const [rates, setRates] = useState<DeliveryRatesMap>(() =>
    deliveryRatesService.getDefaultRates()
  );
  const [ratesList, setRatesList] = useState<DeliveryRate[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    refreshRates();
  }, [refreshRates]);

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

  return (
    <DeliveryRatesContext.Provider
      value={{ rates, ratesList, loading, refreshRates, updateRate }}
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
