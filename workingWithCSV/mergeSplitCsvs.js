/**
 * Merges all CSV files in the split folder into one CSV file.
 * Uses the header from the first file; concatenates all data rows.
 */

const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

const SPLIT_DIR = path.join(__dirname, 'split');
const OUTPUT_CSV = path.join(__dirname, 'merged.csv');

function main() {
  const files = fs.readdirSync(SPLIT_DIR).filter((f) => f.endsWith('.csv')).sort();
  if (!files.length) {
    console.error('No CSV files found in', SPLIT_DIR);
    process.exit(1);
  }

  let header = null;
  const allRows = [];

  for (const file of files) {
    const filePath = path.join(SPLIT_DIR, file);
    const csvText = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''); // strip BOM
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    const rows = parsed.data;
    if (!rows.length) continue;
    if (!header) header = parsed.meta.fields;
    allRows.push(...rows);
  }

  const csvContent = Papa.unparse(allRows, { columns: header, header: true });
  fs.writeFileSync(OUTPUT_CSV, '\uFEFF' + csvContent, 'utf8');
  console.log(`Merged ${files.length} files, ${allRows.length} rows → ${path.basename(OUTPUT_CSV)}`);
}

main();
