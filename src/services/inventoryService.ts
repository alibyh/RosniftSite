import { supabase } from './supabaseClient';

// Database row interface matching Supabase table structure
export interface InventoryRow {
  id: string;
  БЕ: string | null;
  'Наименование дочернего Общества': string | null;
  'Филиал Общества (при наличии)': string | null;
  'Адрес склада (Город, район)': string | null;
  'Классы МТР': number | null;
  'Наименование класса': string | null;
  'Подклассы МТР': string | null;
  'Наименование подкласса': string | null;
  'КСМ (код материала)': number | null;
  'Наименование материала': string | null;
  'БЕИ (единица измерения)': string | null;
  'Количество': number | null;
  'Стоимость запасов': string | null;
}

// Mapped interface for easier use in components (matching old CSV structure)
export interface MappedInventoryRow {
  id: string;
  balanceUnit: string;
  companyName: string;
  branch: string;
  warehouseAddress: string;
  materialClass: string;
  className: string;
  materialSubclass: string;
  subclassName: string;
  materialCode: string;
  materialName: string;
  unit: string;
  quantity: string;
  cost: string;
}

// Map database row to component-friendly format
const mapInventoryRow = (row: InventoryRow): MappedInventoryRow => {
  return {
    id: row.id,
    balanceUnit: row.БЕ || '',
    companyName: row['Наименование дочернего Общества'] || '',
    branch: row['Филиал Общества (при наличии)'] || '',
    warehouseAddress: row['Адрес склада (Город, район)'] || '',
    materialClass: row['Классы МТР']?.toString() || '',
    className: row['Наименование класса'] || '',
    materialSubclass: row['Подклассы МТР'] || '',
    subclassName: row['Наименование подкласса'] || '',
    materialCode: row['КСМ (код материала)']?.toString() || '',
    materialName: row['Наименование материала'] || '',
    unit: row['БЕИ (единица измерения)'] || '',
    quantity: row['Количество']?.toString() || '',
    cost: row['Стоимость запасов'] || '',
  };
};

export const inventoryService = {
  /**
   * Fetch all inventory items from Supabase
   */
  async getAllInventory(): Promise<MappedInventoryRow[]> {
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .order('id', { ascending: true });

      if (error) {
        console.error('Error fetching inventory:', error);
        throw new Error(`Ошибка загрузки данных: ${error.message}`);
      }

      if (!data) {
        return [];
      }

      return data.map(mapInventoryRow);
    } catch (error) {
      console.error('Error in getAllInventory:', error);
      throw error;
    }
  },

  /**
   * Fetch a single inventory item by ID
   */
  async getInventoryById(id: string): Promise<MappedInventoryRow | null> {
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching inventory item:', error);
        throw new Error(`Ошибка загрузки данных: ${error.message}`);
      }

      if (!data) {
        return null;
      }

      return mapInventoryRow(data);
    } catch (error) {
      console.error('Error in getInventoryById:', error);
      throw error;
    }
  },
};

