import { supabase } from './supabaseClient';

export type WeightBand = '10-18' | 'over18';
export type DistanceBand = '50-250' | '251-1000' | '1001-2999' | '3000+';

export interface DeliveryRate {
  id: string;
  weight_band: WeightBand;
  distance_band: DistanceBand;
  rate: number;
}

export type DeliveryRatesMap = Record<WeightBand, Record<DistanceBand, number>>;

const DEFAULT_RATES: DeliveryRatesMap = {
  '10-18': {
    '50-250': 23.03,
    '251-1000': 13.73,
    '1001-2999': 11.82,
    '3000+': 11.76,
  },
  'over18': {
    '50-250': 12.58,
    '251-1000': 9.67,
    '1001-2999': 8.92,
    '3000+': 8.89,
  },
};

function toRatesMap(rows: DeliveryRate[]): DeliveryRatesMap {
  const map: DeliveryRatesMap = {
    '10-18': { '50-250': 23.03, '251-1000': 13.73, '1001-2999': 11.82, '3000+': 11.76 },
    'over18': { '50-250': 12.58, '251-1000': 9.67, '1001-2999': 8.92, '3000+': 8.89 },
  };
  for (const row of rows) {
    if (map[row.weight_band] && row.distance_band in map[row.weight_band]) {
      map[row.weight_band][row.distance_band] = Number(row.rate);
    }
  }
  return map;
}

export const deliveryRatesService = {
  async getAllRates(): Promise<DeliveryRate[]> {
    const { data, error } = await supabase
      .from('delivery_rates')
      .select('*')
      .order('weight_band')
      .order('distance_band');
    if (error) throw new Error(error.message);
    return (data || []) as DeliveryRate[];
  },

  async getRatesMap(): Promise<DeliveryRatesMap> {
    try {
      const rows = await this.getAllRates();
      return rows.length > 0 ? toRatesMap(rows) : DEFAULT_RATES;
    } catch {
      return DEFAULT_RATES;
    }
  },

  async updateRate(id: string, rate: number): Promise<DeliveryRate> {
    const { data, error } = await supabase
      .from('delivery_rates')
      .update({ rate, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as DeliveryRate;
  },

  getDefaultRates(): DeliveryRatesMap {
    return DEFAULT_RATES;
  },
};
