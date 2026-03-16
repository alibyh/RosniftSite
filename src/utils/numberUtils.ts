export function sanitizeQuantityInput(value: string): string {
  // Allow digits and at most one decimal separator (either comma or dot).
  let s = value.replace(/[^\d.,]/g, '');
  const firstSepIndex = s.search(/[.,]/);
  if (firstSepIndex !== -1) {
    const before = s.slice(0, firstSepIndex + 1);
    const after = s.slice(firstSepIndex + 1).replace(/[.,]/g, '');
    s = before + after;
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
