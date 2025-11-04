import Papa from 'papaparse';

export interface InventoryRow {
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

export const parseCSV = async (): Promise<InventoryRow[]> => {
  try {
    // Import CSV file using Vite's ?raw suffix
    const csvModule = await import('../assets/Таблица_для_отображения_на_сайте.csv?raw');
    const csvText = csvModule.default;
    
    return new Promise((resolve, reject) => {
      Papa.parse<any>(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          // Map CSV headers to our interface
          const headerMap: Record<string, keyof InventoryRow> = {
            'БЕ (балансовая единица) держателя запаса': 'balanceUnit',
            "Наименование дочернего Общества'": 'companyName',
            'Филиал Общества (при наличии)': 'branch',
            'Адрес склада (Город, район)': 'warehouseAddress',
            '"Адрес склада (Город, район)"': 'warehouseAddress',
            'Классы МТР': 'materialClass',
            "Наименование класса'": 'className',
            'Подклассы МТР ': 'materialSubclass',
            'Подклассы МТР': 'materialSubclass',
            'Наименование подкласса': 'subclassName',
            'КСМ (код материала)': 'materialCode',
            'Наименование материала': 'materialName',
            'БЕИ (единица измерения)': 'unit',
            'Количество': 'quantity',
            'Стоимость запасов, руб (показывается сумма для продажи)': 'cost',
            '"Стоимость запасов, руб (показывается сумма для продажи)"': 'cost',
          };

          const mappedData: InventoryRow[] = results.data
            .map((row: any) => {
              const mappedRow: Partial<InventoryRow> = {};
              
              // Map each column
              Object.keys(row).forEach((key) => {
                const mappedKey = headerMap[key] || headerMap[key.trim()];
                if (mappedKey) {
                  (mappedRow as any)[mappedKey] = row[key] || '';
                }
              });

              return mappedRow as InventoryRow;
            })
            .filter((row: InventoryRow) => {
              // Filter out completely empty rows
              return row.balanceUnit && row.balanceUnit.trim() !== '';
            });

          resolve(mappedData);
        },
        error: (error: any) => {
          reject(error);
        },
      });
    });
  } catch (error) {
    console.error('Error parsing CSV:', error);
    throw error;
  }
};

