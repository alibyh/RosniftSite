/**
 * Normalizes CSV for DB import:
 * - Deletes "Наименование склада" column
 * - Trims trailing " ," from cells
 * - Renames headers to match inventory table schema
 */

const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

const INPUT = path.join(__dirname, 'csv', 'Таблица_для_отображения_на_сайте_обнв newData.csv');
const OUTPUT = path.join(__dirname, 'csv', 'Таблица_для_отображения_на_сайте_обнв newData.csv');

// CSV column name (normalized) -> DB column name; ___DELETE___ = drop column
const HEADER_MAP = {
  'бе (балансовая единица) держателя запаса': 'БЕ',
  'наименование дочернего общества': 'Наименование дочернего Общества',
  'наименование склада': '___DELETE___',
  'адрес склада': 'Адрес склада',
  'дата поступления': 'Дата поступления',
  'классы мтр': 'Классы МТР',
  'наименование класса': 'Наименование класса',
  'подклассы мтр': 'Подклассы МТР',
  'наименование подкласса': 'Наименование подкласса',
  'ксм (код материала)': 'КСМ (код материала)',
  'наименование материала': 'Наименование материала',
  'беи (единица измерения)': 'БЕИ (единица измерения)',
  'количество': 'Количество',
  'стоимость запасов': 'Стоимость запасов',
  'цена запаса': 'Цена запаса',
};

function mapHeader(name) {
  const key = (name || '').replace(/'/g, '').replace(/"/g, '').trim().toLowerCase();
  if (HEADER_MAP[key] !== undefined) return HEADER_MAP[key];
  for (const [k, v] of Object.entries(HEADER_MAP)) {
    if (key.startsWith(k)) return v; // e.g. "стоимость запасов , руб..." -> Стоимость запасов
  }
  return name;
}

function trimCell(val) {
  if (val == null) return '';
  let s = String(val).trim();
  // Remove trailing comma and spaces
  s = s.replace(/[,\s]+$/, '');
  return s;
}

function main() {
  const csvText = fs.readFileSync(INPUT, 'utf8').replace(/^\uFEFF/, '');
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: false });

  const oldFields = parsed.meta.fields || [];
  const newFields = [];
  const dropIndices = new Set();

  oldFields.forEach((f, i) => {
    const mapped = mapHeader(f);
    if (mapped === '___DELETE___') {
      dropIndices.add(i);
    } else {
      newFields.push(mapped);
    }
  });

  const rows = parsed.data
    .filter((row) => {
      const vals = Object.values(row);
      const meaningful = vals.filter((v) => v != null && String(v).replace(/[,\s\\]+/g, '').length > 0);
      return meaningful.length >= 3; // skip empty/garbage rows
    })
    .map((row) => {
      const arr = oldFields.map((field) => row[field]);
      const filtered = arr.filter((_, i) => !dropIndices.has(i));
      const trimmed = filtered.map(trimCell);
      const obj = {};
      newFields.forEach((name, i) => {
        obj[name] = trimmed[i] ?? '';
      });
      return obj;
    });

  let outCsv = Papa.unparse(rows, { columns: newFields, header: true });
  outCsv = outCsv.replace(/,\s*$/gm, ''); // remove trailing comma from each line
  fs.writeFileSync(OUTPUT, '\uFEFF' + outCsv, 'utf8');
  console.log(`Normalized: ${rows.length} rows, removed "Наименование склада", trimmed cells → ${path.basename(OUTPUT)}`);
}

main();
