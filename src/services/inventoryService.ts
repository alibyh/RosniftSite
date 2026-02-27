import Papa from 'papaparse';
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
  'Рентабельность': number | null;
  'Цена запаса': string | null;
}

// Mapped interface for UI (Цена запаса hidden; profitability shown only in Мои запасы)
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
  /** Плановая рентабельность - shown and editable in Мои запасы tab */
  profitability: string;
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
    profitability: row['Рентабельность'] != null ? String(row['Рентабельность']) : '',
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
      if (updates.profitability !== undefined) {
        const v = parseFloat(String(updates.profitability).replace(/\s/g, ''));
        dbUpdates['Рентабельность'] = isNaN(v) ? null : v;
      }

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

  /** Update Рентабельность for all rows of a given БЕ */
  async updateProfitabilityForBalanceUnit(balanceUnit: string, value: string): Promise<void> {
    const v = parseFloat(String(value).replace(/\s/g, ''));
    const numVal = isNaN(v) ? null : v;
    const { error } = await supabase
      .from('inventory')
      .update({ Рентабельность: numVal })
      .eq('БЕ', balanceUnit);
    if (error) {
      console.error('Error updating profitability:', error);
      throw new Error(`Ошибка обновления рентабельности: ${error.message}`);
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
        'Рентабельность': item.profitability ? parseFloat(String(item.profitability).replace(/\s/g, '')) || null : null,
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

  /**
   * Update inventory from CSV file: delete existing rows for the given БЕ, then insert new rows.
   * CSV must have columns matching the inventory table (БЕ, Наименование дочернего Общества, etc.).
   */
  async updateInventoryFromFile(
    companyId: string,
    csvText: string
  ): Promise<{ deleted: number; inserted: number }> {
    const parsed = Papa.parse<Record<string, string>>(csvText.replace(/^\uFEFF/, ''), {
      header: true,
      skipEmptyLines: true,
    });

    if (!parsed.data?.length) {
      throw new Error('Файл пуст или не содержит данных');
    }

    const header = parsed.meta.fields || [];
    const getCol = (row: Record<string, string>, names: string[]) => {
      for (const n of names) {
        const key = header.find((h) => h.trim().toLowerCase().replace(/'/g, '') === n.trim().toLowerCase().replace(/'/g, ''));
        if (key && row[key] != null) return String(row[key]).trim();
      }
      return '';
    };

    const rows = parsed.data.map((row) => {
      const clsMtr = getCol(row, ['Классы МТР', 'Классы МТР ']);
      const ksm = getCol(row, ['КСМ (код материала)']);
      const quantity = getCol(row, ['Количество']);
      const cost = getCol(row, ['Стоимость запасов', 'Стоимость запасов , руб (показывается во вкладке "Складские запасы")']);
      const rent = getCol(row, ['Рентабельность', 'Плановая рентабельность', 'Плановая рентабельность ', 'Рентабельность (на сайте НЕ показывать)']);
      const price = getCol(row, ['Цена запаса', 'Цена запаса, руб (показывается во вкладке "Мои запасы")']);

      return {
        БЕ: companyId,
        'Наименование дочернего Общества': getCol(row, ['Наименование дочернего Общества', "Наименование дочернего Общества'"]) || null,
        'Дата поступления': getCol(row, ['Дата поступления']) || null,
        'Адрес склада': getCol(row, ['Адрес склада']) || null,
        'Классы МТР': clsMtr ? parseInt(clsMtr, 10) || null : null,
        'Наименование класса': getCol(row, ['Наименование класса', "Наименование класса '"]) || null,
        'Подклассы МТР': getCol(row, ['Подклассы МТР', 'Подклассы МТР ']) || null,
        'Наименование подкласса': getCol(row, ['Наименование подкласса']) || null,
        'КСМ (код материала)': ksm ? parseInt(ksm, 10) || null : null,
        'Наименование материала': getCol(row, ['Наименование материала']) || null,
        'БЕИ (единица измерения)': getCol(row, ['БЕИ (единица измерения)']) || null,
        Количество: quantity || null,
        'Стоимость запасов': cost || null,
        'Рентабельность': rent ? parseFloat(rent.replace(/\s/g, '')) || null : null,
        'Цена запаса': price || null,
      };
    });

    const { data: deletedRows, error: deleteError } = await supabase
      .from('inventory')
      .delete()
      .eq('БЕ', companyId)
      .select('id');

    if (deleteError) {
      console.error('Error deleting inventory:', deleteError);
      throw new Error(`Ошибка удаления данных: ${deleteError.message}`);
    }

    const deletedCount = deletedRows?.length ?? 0;

    if (rows.length === 0) {
      return { deleted: deletedCount, inserted: 0 };
    }

    const BATCH_SIZE = 500;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await supabase.from('inventory').insert(batch);
      if (insertError) {
        console.error('Error inserting inventory:', insertError);
        throw new Error(`Ошибка загрузки данных: ${insertError.message}`);
      }
      inserted += batch.length;
    }

    return { deleted: deletedCount, inserted };
  },
};
