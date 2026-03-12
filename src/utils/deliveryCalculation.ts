/**
 * Delivery cost calculation per deliveryCalculation.md
 * S = weight (tons) * distance (km) * rate (RUB per ton*km)
 * If cargo < 10 tons, weight is taken as 10 tons for the formula.
 */

import type { DeliveryRatesMap } from '../services/deliveryRatesService';
import { deliveryRatesService } from '../services/deliveryRatesService';

export type DistanceBand = '50-250' | '251-1000' | '1001-2999' | '3000+';

export function getDistanceBand(distanceKm: number): DistanceBand {
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
 * Uses rates from context when provided, else falls back to defaults.
 */
export function getDeliveryRate(
  effectiveWeightTons: number,
  distanceKm: number,
  rates?: DeliveryRatesMap | null
): number {
  const band = getDistanceBand(distanceKm);
  const map = rates ?? deliveryRatesService.getDefaultRates();
  const weightBand = effectiveWeightTons <= 18 ? '10-18' : 'over18';
  return map[weightBand]?.[band] ?? 0;
}

/**
 * Cost for one leg: S = weight * distance * rate
 */
export function legDeliveryCostRub(
  weightTons: number,
  distanceKm: number,
  rates?: DeliveryRatesMap | null
): number {
  if (distanceKm <= 0 || weightTons <= 0) return 0;
  const effective = effectiveWeightTons(weightTons);
  const rate = getDeliveryRate(effective, distanceKm, rates);
  return effective * distanceKm * rate;
}
