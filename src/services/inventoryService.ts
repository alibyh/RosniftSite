import { supabase } from './supabaseClient';

// Database row interface matching Supabase table structure
export interface InventoryRow {
  id: string;
  БЕ: string | null;
  'Наименование дочернего Общества': string | null;
  'Дата поступления': string | null;
  'Адрес склада': string | null;
  'Классы МТР': number | null;
  'Наименование класса': string | null;
  'Подклассы МТР': string | null;
  'Наименование подкласса': string | null;
  'КСМ (код материала)': number | null;
  'Наименование материала': string | null;
  'БЕИ (единица измерения)': string | null;
  Количество: string | null;
  'Стоимость запасов': string | null;
  'Плановая рентабельность': number | null;
  'Цена запаса': string | null;
}

// Mapped interface for UI (Цена запаса and Плановая рентабельность are hidden, not exposed)
export interface MappedInventoryRow {
  id: string;
  balanceUnit: string;
  companyName: string;
  receiptDate: string;
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

const mapInventoryRow = (row: InventoryRow): MappedInventoryRow => {
  return {
    id: row.id,
    balanceUnit: row.БЕ || '',
    companyName: row['Наименование дочернего Общества'] || '',
    receiptDate: row['Дата поступления'] || '',
    warehouseAddress: row['Адрес склада'] || '',
    materialClass: row['Классы МТР']?.toString() ?? '',
    className: row['Наименование класса'] || '',
    materialSubclass: row['Подклассы МТР'] ?? '',
    subclassName: row['Наименование подкласса'] || '',
    materialCode: row['КСМ (код материала)']?.toString() ?? '',
    materialName: row['Наименование материала'] || '',
    unit: row['БЕИ (единица измерения)'] || '',
    quantity: row.Количество ?? '',
    cost: row['Стоимость запасов'] ?? '',
  };
};

export const inventoryService = {
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

  async updateInventory(id: string, updates: Partial<MappedInventoryRow>): Promise<MappedInventoryRow> {
    try {
      const dbUpdates: Partial<InventoryRow> = {};

      if (updates.balanceUnit !== undefined) dbUpdates.БЕ = updates.balanceUnit;
      if (updates.companyName !== undefined) dbUpdates['Наименование дочернего Общества'] = updates.companyName;
      if (updates.receiptDate !== undefined) dbUpdates['Дата поступления'] = updates.receiptDate;
      if (updates.warehouseAddress !== undefined) dbUpdates['Адрес склада'] = updates.warehouseAddress;
      if (updates.materialClass !== undefined) dbUpdates['Классы МТР'] = parseInt(updates.materialClass, 10) || null;
      if (updates.className !== undefined) dbUpdates['Наименование класса'] = updates.className;
      if (updates.materialSubclass !== undefined) dbUpdates['Подклассы МТР'] = updates.materialSubclass;
      if (updates.subclassName !== undefined) dbUpdates['Наименование подкласса'] = updates.subclassName;
      if (updates.materialCode !== undefined) dbUpdates['КСМ (код материала)'] = parseInt(updates.materialCode, 10) || null;
      if (updates.materialName !== undefined) dbUpdates['Наименование материала'] = updates.materialName;
      if (updates.unit !== undefined) dbUpdates['БЕИ (единица измерения)'] = updates.unit;
      if (updates.quantity !== undefined) dbUpdates.Количество = updates.quantity;
      if (updates.cost !== undefined) dbUpdates['Стоимость запасов'] = updates.cost;

      const { data, error } = await supabase
        .from('inventory')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating inventory:', error);
        throw new Error(`Ошибка обновления данных: ${error.message}`);
      }

      if (!data) {
        throw new Error('Данные не найдены после обновления');
      }

      return mapInventoryRow(data);
    } catch (error) {
      console.error('Error in updateInventory:', error);
      throw error;
    }
  },

  async deleteInventory(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting inventory:', error);
        throw new Error(`Ошибка удаления данных: ${error.message}`);
      }
    } catch (error) {
      console.error('Error in deleteInventory:', error);
      throw error;
    }
  },

  async createInventory(item: Omit<MappedInventoryRow, 'id'>): Promise<MappedInventoryRow> {
    try {
      const dbItem: Omit<InventoryRow, 'id'> = {
        БЕ: item.balanceUnit || null,
        'Наименование дочернего Общества': item.companyName || null,
        'Дата поступления': item.receiptDate || null,
        'Адрес склада': item.warehouseAddress || null,
        'Классы МТР': item.materialClass ? parseInt(item.materialClass, 10) : null,
        'Наименование класса': item.className || null,
        'Подклассы МТР': item.materialSubclass || null,
        'Наименование подкласса': item.subclassName || null,
        'КСМ (код материала)': item.materialCode ? parseInt(item.materialCode, 10) : null,
        'Наименование материала': item.materialName || null,
        'БЕИ (единица измерения)': item.unit || null,
        Количество: item.quantity || null,
        'Стоимость запасов': item.cost || null,
        'Плановая рентабельность': null,
        'Цена запаса': null,
      };

      const { data, error } = await supabase
        .from('inventory')
        .insert(dbItem)
        .select()
        .single();

      if (error) {
        console.error('Error creating inventory:', error);
        throw new Error(`Ошибка создания данных: ${error.message}`);
      }

      if (!data) {
        throw new Error('Данные не созданы');
      }

      return mapInventoryRow(data);
    } catch (error) {
      console.error('Error in createInventory:', error);
      throw error;
    }
  },
};
