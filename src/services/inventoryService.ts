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

  /**
   * Update an inventory item
   */
  async updateInventory(id: string, updates: Partial<MappedInventoryRow>): Promise<MappedInventoryRow> {
    try {
      // Map back to database format
      const dbUpdates: Partial<InventoryRow> = {};
      
      if (updates.balanceUnit !== undefined) dbUpdates.БЕ = updates.balanceUnit;
      if (updates.companyName !== undefined) dbUpdates['Наименование дочернего Общества'] = updates.companyName;
      if (updates.branch !== undefined) dbUpdates['Филиал Общества (при наличии)'] = updates.branch;
      if (updates.warehouseAddress !== undefined) dbUpdates['Адрес склада (Город, район)'] = updates.warehouseAddress;
      if (updates.materialClass !== undefined) dbUpdates['Классы МТР'] = parseInt(updates.materialClass) || null;
      if (updates.className !== undefined) dbUpdates['Наименование класса'] = updates.className;
      if (updates.materialSubclass !== undefined) dbUpdates['Подклассы МТР'] = updates.materialSubclass;
      if (updates.subclassName !== undefined) dbUpdates['Наименование подкласса'] = updates.subclassName;
      if (updates.materialCode !== undefined) dbUpdates['КСМ (код материала)'] = parseInt(updates.materialCode) || null;
      if (updates.materialName !== undefined) dbUpdates['Наименование материала'] = updates.materialName;
      if (updates.unit !== undefined) dbUpdates['БЕИ (единица измерения)'] = updates.unit;
      if (updates.quantity !== undefined) dbUpdates['Количество'] = parseFloat(updates.quantity.replace(/\s/g, '')) || null;
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

  /**
   * Delete an inventory item
   */
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

  /**
   * Create a new inventory item
   */
  async createInventory(item: Omit<MappedInventoryRow, 'id'>): Promise<MappedInventoryRow> {
    try {
      // Map to database format
      const dbItem: Omit<InventoryRow, 'id'> = {
        БЕ: item.balanceUnit || null,
        'Наименование дочернего Общества': item.companyName || null,
        'Филиал Общества (при наличии)': item.branch || null,
        'Адрес склада (Город, район)': item.warehouseAddress || null,
        'Классы МТР': item.materialClass ? parseInt(item.materialClass) : null,
        'Наименование класса': item.className || null,
        'Подклассы МТР': item.materialSubclass || null,
        'Наименование подкласса': item.subclassName || null,
        'КСМ (код материала)': item.materialCode ? parseInt(item.materialCode) : null,
        'Наименование материала': item.materialName || null,
        'БЕИ (единица измерения)': item.unit || null,
        'Количество': item.quantity ? parseFloat(item.quantity.replace(/\s/g, '')) : null,
        'Стоимость запасов': item.cost || null,
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




