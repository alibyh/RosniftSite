/**
 * Delivery cost calculation per deliveryCalculation.md
 * S = weight (tons) * distance (km) * rate (RUB per ton*km)
 * If cargo < 10 tons, weight is taken as 10 tons for the formula.
 *
 * Rate table (RUB per 1 ton*km):
 * Vehicle load 10-18 t:  50-250 km → 23.03, 251-1000 → 13.73, 1001-2999 → 11.82, 3000+ → 11.76
 * Vehicle load >18 t:   50-250 km → 12.58, 251-1000 → 9.67,  1001-2999 → 8.92, 3000+ → 8.89
 */

const RATES_10_18 = {
  '50-250': 23.03,
  '251-1000': 13.73,
  '1001-2999': 11.82,
  '3000+': 11.76,
} as const;

const RATES_OVER_18 = {
  '50-250': 12.58,
  '251-1000': 9.67,
  '1001-2999': 8.92,
  '3000+': 8.89,
} as const;

type DistanceBand = keyof typeof RATES_10_18;

function getDistanceBand(distanceKm: number): DistanceBand {
  if (distanceKm < 50) return '50-250';
  if (distanceKm <= 250) return '50-250';
  if (distanceKm <= 1000) return '251-1000';
  if (distanceKm <= 2999) return '1001-2999';
  return '3000+';
}

/**
 * Effective weight for tariff: minimum 10 tons.
 */
export function effectiveWeightTons(tons: number): number {
  return tons < 10 ? 10 : tons;
}

/**
 * Rate in RUB per 1 ton*km for given effective weight and distance.
 */
export function getDeliveryRate(effectiveWeightTons: number, distanceKm: number): number {
  const band = getDistanceBand(distanceKm);
  const rates = effectiveWeightTons <= 18 ? RATES_10_18 : RATES_OVER_18;
  return rates[band];
}

/**
 * Cost for one leg: S = weight * distance * rate
 */
export function legDeliveryCostRub(weightTons: number, distanceKm: number): number {
  if (distanceKm <= 0 || weightTons <= 0) return 0;
  const effective = effectiveWeightTons(weightTons);
  const rate = getDeliveryRate(effective, distanceKm);
  return effective * distanceKm * rate;
}
