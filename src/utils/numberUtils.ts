/**
 * Allow only digits and at most one decimal point (for quantity input).
 * Returns sanitized string; strips letters and other symbols.
 */
export function sanitizeQuantityInput(value: string): string {
  let s = value.replace(/[^\d.]/g, '');
  const parts = s.split('.');
  if (parts.length > 2) {
    s = parts[0] + '.' + parts.slice(1).join('');
  }
  return s;
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
