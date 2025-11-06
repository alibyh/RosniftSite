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
        // Properly handle quoted fields with commas
        quoteChar: '"',
        escapeChar: '"',
        delimiter: ',',
        newline: '\n',
        // Handle unquoted fields that might contain commas
        transformHeader: (header) => header.trim(),
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
              
              // Get all keys in order to detect split addresses
              const allKeys = Object.keys(row);
              
              // Map each column
              Object.keys(row).forEach((key) => {
                const mappedKey = headerMap[key] || headerMap[key.trim()];
                if (mappedKey) {
                  let value = row[key] || '';
                  
                  // Special handling for warehouseAddress - merge split fields
                  if (mappedKey === 'warehouseAddress') {
                    const addressKeyIndex = allKeys.indexOf(key);
                    
                    // Check if the next column might be part of the address
                    // Addresses with commas might be split into multiple columns
                    if (addressKeyIndex < allKeys.length - 1) {
                      const nextKey = allKeys[addressKeyIndex + 1];
                      const nextValue = row[nextKey] || '';
                      
                      // If next column is not mapped to any field and looks like address continuation
                      if (nextValue && !headerMap[nextKey] && !headerMap[nextKey.trim()]) {
                        // Check if it looks like an address part (contains street indicators, regions, etc.)
                        const looksLikeAddress = 
                          nextValue.toLowerCase().includes('ул') ||
                          nextValue.toLowerCase().includes('улица') ||
                          nextValue.toLowerCase().includes('край') ||
                          nextValue.toLowerCase().includes('обл') ||
                          nextValue.toLowerCase().includes('г ') ||
                          nextValue.toLowerCase().includes('г.') ||
                          nextValue.match(/\d/); // Contains numbers (like house numbers)
                        
                        if (looksLikeAddress) {
                          // Merge the address parts
                          value = `${value}, ${nextValue}`.trim();
                          // Mark this key as processed so it doesn't get mapped separately
                          delete row[nextKey];
                        }
                      }
                    }
                  }
                  
                  (mappedRow as any)[mappedKey] = value;
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

