/**
 * Normalizes CSV with Рентабельность for DB import:
 * - Deletes "Наименование склада" column
 * - Trims trailing " ," from cells
 * - Renames headers to match inventory table schema
 * - Maps "Рентабельность" -> "Плановая рентабельность"
 */

const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

const INPUT = path.join(__dirname, 'csv', 'csvWithProfit', 'Таблица_для_отображения_на_сайте_обнв withProfit.csv');
const OUTPUT = path.join(__dirname, 'csv', 'csvWithProfit', 'Таблица_для_отображения_на_сайте_обнв withProfit.csv');

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
  'рентабельность': 'Рентабельность',
};

function mapHeader(name) {
  const key = (name || '').replace(/'/g, '').replace(/"/g, '').trim().toLowerCase();
  if (HEADER_MAP[key] !== undefined) return HEADER_MAP[key];
  for (const [k, v] of Object.entries(HEADER_MAP)) {
    if (key.startsWith(k)) return v;
  }
  return name;
}

function trimCell(val) {
  if (val == null) return '';
  let s = String(val).trim();
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
      return meaningful.length >= 3;
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
  outCsv = outCsv.replace(/,\s*$/gm, '');
  fs.writeFileSync(OUTPUT, '\uFEFF' + outCsv, 'utf8');
  console.log(`Normalized: ${rows.length} rows, Рентабельность → ${path.basename(OUTPUT)}`);
}

main();
