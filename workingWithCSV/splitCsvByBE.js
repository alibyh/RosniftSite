/**
 * Splits a CSV file into multiple files by БЕ (balance unit).
 * Each file is named: БЕ + Наименование дочернего Общества.csv
 * All files keep the same header row.
 */

const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

const INPUT_CSV = path.join(__dirname, 'Таблица_для_отображения_на_сайте обнвCSV.csv');
const OUTPUT_DIR = path.join(__dirname, 'split');

// Column names from the CSV (first is БЕ, second is Наименование дочернего Общества)
const COL_BE = 'БЕ (балансовая единица) держателя запаса';
const COL_SOCIETY = "Наименование дочернего Общества'"; // exact header (with trailing quote)

function sanitizeFileName(str) {
  if (str == null || str === '') return 'unknown';
  return String(str)
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}

function main() {
  const csvText = fs.readFileSync(INPUT_CSV, 'utf8');
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });

  if (parsed.errors.length > 0) {
    console.warn('Parse warnings:', parsed.errors);
  }

  const rows = parsed.data;
  const header = parsed.meta.fields;

  if (!rows.length) {
    console.error('No data rows found.');
    process.exit(1);
  }

  // Resolve BE and Society column names (in case header differs slightly)
  const firstRow = rows[0];
  const beKey = header.find((h) => h.includes('БЕ') && h.includes('балансовая'));
  const societyKey = header.find((h) => h.includes('Наименование дочернего'));
  const colBe = beKey || header[0];
  const colSociety = societyKey || header[1];

  const groups = new Map(); // key: BE value, value: array of row objects

  for (const row of rows) {
    const be = row[colBe] != null ? String(row[colBe]).trim() : '';
    if (!be) continue;
    if (!groups.has(be)) groups.set(be, []);
    groups.get(be).push(row);
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Exclude "Наименование склада" column from output
  const warehouseCol = header.find((h) => h.trim() === 'Наименование склада' || (h.includes('Наименование склада') && !h.includes('Общества')));
  const outputColumns = warehouseCol ? header.filter((h) => h !== warehouseCol) : header;

  let written = 0;
  for (const [be, groupRows] of groups) {
    const societyName = groupRows[0][colSociety] != null ? String(groupRows[0][colSociety]).trim() : '';
    const fileName = sanitizeFileName(be + societyName) + '.csv';
    const filePath = path.join(OUTPUT_DIR, fileName);

    const csvContent = Papa.unparse(groupRows, { columns: outputColumns, header: true });
    fs.writeFileSync(filePath, '\uFEFF' + csvContent, 'utf8'); // BOM for Excel
    written++;
    console.log(`Written: ${fileName} (${groupRows.length} rows)`);
  }

  console.log(`\nDone. ${written} files in ${OUTPUT_DIR}`);
}

main();
