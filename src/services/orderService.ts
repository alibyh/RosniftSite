import { supabase } from './supabaseClient';
import type { ChartItem } from '../contexts/ChartContext';
import { parseDecimalStr } from '../utils/numberUtils';

export interface OrderEmailItemPayload {
  id: string;
  balanceUnit: string;
  companyName: string;
  materialCode: string;
  materialName: string;
  quantity: number;
  unit: string;
  costRub: number;
  warehouseAddress: string;
}

export interface SubmitOrderPayload {
  requester: {
    id: string;
    fullName: string;
    email: string;
    companyId: string;
    companyName: string;
  };
  destinationWarehouse: string;
  items: OrderEmailItemPayload[];
}

function parsePrice(str: string): number {
  return parseDecimalStr(str) || 0;
}

export function mapCartItemsToOrderPayload(items: ChartItem[]): OrderEmailItemPayload[] {
  return items.map((item) => {
    const rowQty = parseDecimalStr(String(item.row.quantity || '1')) || 1;
    const totalCost = parsePrice(item.row.cost || '0');
    const pricePerUnit = rowQty > 0 ? totalCost / rowQty : totalCost;

    return {
      id: item.id,
      balanceUnit: item.row.balanceUnit || '',
      companyName: item.row.companyName || '',
      materialCode: item.row.materialCode || '',
      materialName: item.row.materialName || '',
      quantity: item.quantity,
      unit: item.row.unit || '',
      costRub: pricePerUnit * item.quantity,
      warehouseAddress: item.row.warehouseAddress || '',
    };
  });
}

export const orderService = {
  async submitOrder(payload: SubmitOrderPayload): Promise<{
    success: boolean;
    sentCount: number;
    skipped: Array<{ balanceUnit: string; reason: string }>;
  }> {
    const { data, error } = await supabase.functions.invoke('send-order-emails', {
      body: payload,
    });

    if (data?.success) {
      return data as {
        success: boolean;
        sentCount: number;
        skipped: Array<{ balanceUnit: string; reason: string }>;
      };
    }

    const msg = data?.error || error?.message || 'Ошибка отправки заявки';
    const hint = (data as { hint?: string })?.hint;
    throw new Error(hint ? `${msg}. ${hint}` : msg);
  },
};
