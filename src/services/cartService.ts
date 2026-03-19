import type { ChartItem } from '../contexts/ChartContext';
import { supabase } from './supabaseClient';

interface AppUserCartRow {
  cart_items: unknown;
}

function parseCartItems(raw: unknown): ChartItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is ChartItem =>
      !!item &&
      typeof item === 'object' &&
      typeof (item as ChartItem).id === 'string' &&
      typeof (item as ChartItem).quantity === 'number' &&
      typeof (item as ChartItem).row === 'object'
  );
}

export const cartService = {
  async getUserCart(userId: string): Promise<ChartItem[]> {
    if (!userId?.trim()) return [];
    const { data, error } = await supabase
      .from('app_users')
      .select('cart_items')
      .eq('id', userId)
      .single<AppUserCartRow>();

    if (error || !data) {
      console.error('Error loading user cart:', error);
      return [];
    }

    return parseCartItems(data.cart_items);
  },

  async saveUserCart(userId: string, items: ChartItem[]): Promise<void> {
    if (!userId?.trim()) return;

    const { error } = await supabase
      .from('app_users')
      .update({
        cart_items: items,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      console.error('Error saving user cart:', error);
    }
  },
};
