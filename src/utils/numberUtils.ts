export function sanitizeQuantityInput(value: string): string {
  // Allow only digits and at most one comma as decimal separator.
  // Convert dot to comma (users often type '.' on keyboard).
  let s = value.replace(/\./g, ',').replace(/[^\d,]/g, '');
  const parts = s.split(',');
  if (parts.length > 2) {
    s = parts[0] + ',' + parts.slice(1).join('');
  }
  return s;
}

/** Format number for display: comma as decimal separator, space as thousands. Trims trailing zeros. */
export function formatForDisplay(value: number, decimals = 3): string {
  const s = value.toFixed(decimals);
  const [intPart, decPart] = s.split('.');
  const withSpaces = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const trimmedDec = decPart ? decPart.replace(/0+$/, '') : '';
  return trimmedDec ? `${withSpaces},${trimmedDec}` : withSpaces;
}

/**
 * Parse numeric string from CSV/UI that may use comma as thousands (855,875.46)
 * or comma as decimal (1 192,93). If both comma and period exist, comma is treated as thousands.
 */
export function parseDecimalStr(str: string): number {
  let s = String(str ?? '').trim().replace(/\s/g, '');
  if (!s) return NaN;
  const hasPeriod = s.includes('.');
  const hasComma = s.includes(',');
  if (hasPeriod && hasComma) {
    s = s.replace(/,/g, ''); // comma is thousands separator
  } else if (hasComma) {
    s = s.replace(',', '.'); // comma is decimal separator
  }
  return parseFloat(s);
}
