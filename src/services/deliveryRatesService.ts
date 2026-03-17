import { supabase } from './supabaseClient';

export type WeightBand = '10-18' | 'over18';
export type DistanceBand = '50-250' | '251-1000' | '1001-2999' | '3000+';

// ── Legacy per-row interface (delivery_rates table) ──────────────────────────
export interface DeliveryRate {
  id: string;
  weight_band: WeightBand;
  distance_band: DistanceBand;
  rate: number;
}

export type DeliveryRatesMap = Record<WeightBand, Record<DistanceBand, number>>;

// ── New per-company flat interface (company_delivery_rates table) ─────────────
export interface CompanyDeliveryRate {
  id: string;
  be: string;
  company_name: string | null;
  rate_10_18_50_250: number;
  rate_10_18_251_1000: number;
  rate_10_18_1001_2999: number;
  rate_10_18_3000plus: number;
  rate_over18_50_250: number;
  rate_over18_251_1000: number;
  rate_over18_1001_2999: number;
  rate_over18_3000plus: number;
}

/** Maps each flat column to its weight_band / distance_band pair. */
export const COMPANY_RATE_COLS: Array<{
  col: keyof Omit<CompanyDeliveryRate, 'id' | 'be' | 'company_name'>;
  weight_band: WeightBand;
  distance_band: DistanceBand;
}> = [
  { col: 'rate_10_18_50_250',    weight_band: '10-18',  distance_band: '50-250'    },
  { col: 'rate_10_18_251_1000',  weight_band: '10-18',  distance_band: '251-1000'  },
  { col: 'rate_10_18_1001_2999', weight_band: '10-18',  distance_band: '1001-2999' },
  { col: 'rate_10_18_3000plus',  weight_band: '10-18',  distance_band: '3000+'     },
  { col: 'rate_over18_50_250',    weight_band: 'over18', distance_band: '50-250'    },
  { col: 'rate_over18_251_1000',  weight_band: 'over18', distance_band: '251-1000'  },
  { col: 'rate_over18_1001_2999', weight_band: 'over18', distance_band: '1001-2999' },
  { col: 'rate_over18_3000plus',  weight_band: 'over18', distance_band: '3000+'     },
];

export const DEFAULT_RATES: DeliveryRatesMap = {
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

/** Convert a CompanyDeliveryRate row into a DeliveryRatesMap. */
export function companyRateToMap(row: CompanyDeliveryRate): DeliveryRatesMap {
  const map: DeliveryRatesMap = JSON.parse(JSON.stringify(DEFAULT_RATES));
  for (const { col, weight_band, distance_band } of COMPANY_RATE_COLS) {
    map[weight_band][distance_band] = Number(row[col]);
  }
  return map;
}

function toRatesMap(rows: DeliveryRate[]): DeliveryRatesMap {
  const map: DeliveryRatesMap = JSON.parse(JSON.stringify(DEFAULT_RATES));
  for (const row of rows) {
    if (map[row.weight_band] && row.distance_band in map[row.weight_band]) {
      map[row.weight_band][row.distance_band] = Number(row.rate);
    }
  }
  return map;
}

export const deliveryRatesService = {
  // ── Legacy functions (delivery_rates table) ────────────────────────────────
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
    return JSON.parse(JSON.stringify(DEFAULT_RATES));
  },

  // ── Per-company functions (company_delivery_rates table) ──────────────────
  async getAllCompanyRates(): Promise<CompanyDeliveryRate[]> {
    const { data, error } = await supabase
      .from('company_delivery_rates')
      .select('*')
      .order('be');
    if (error) throw new Error(error.message);
    return (data || []) as CompanyDeliveryRate[];
  },

  async getCompanyRateForBe(be: string): Promise<CompanyDeliveryRate | null> {
    const { data, error } = await supabase
      .from('company_delivery_rates')
      .select('*')
      .eq('be', be)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as CompanyDeliveryRate | null;
  },

  /** Upsert all 8 rate values for a given БЕ. */
  async upsertCompanyRate(
    be: string,
    companyName: string,
    values: Omit<CompanyDeliveryRate, 'id' | 'be' | 'company_name'>
  ): Promise<CompanyDeliveryRate> {
    const { data, error } = await supabase
      .from('company_delivery_rates')
      .upsert(
        { be, company_name: companyName, ...values, updated_at: new Date().toISOString() },
        { onConflict: 'be' }
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as CompanyDeliveryRate;
  },
};
