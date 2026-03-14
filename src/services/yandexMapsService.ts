// Yandex Maps service: geocoding via Yandex Geocoder API, routing via Yandex Router API
// Yandex uses separate keys per product: one for "JavaScript API + Geocoder", one for "Retrieving Route Details".

const YANDEX_API_KEY = import.meta.env.VITE_YANDEX_MAPS_API_KEY || '';
/** Optional. Create a second key at developer.tech.yandex.ru for "Матрица расстояний и построение маршрута" / Retrieving Route Details API. */
const YANDEX_ROUTER_API_KEY = import.meta.env.VITE_YANDEX_ROUTER_API_KEY || YANDEX_API_KEY;

/**
 * Calculate straight-line distance between two coordinates (Haversine formula)
 * @param coord1 - [longitude, latitude]
 * @param coord2 - [longitude, latitude]
 * @returns Distance in kilometers
 */
export const calculateStraightLineDistance = (
  coord1: [number, number],
  coord2: [number, number]
): number => {
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Geocode an address using Yandex Geocoder API.
 * Returns [longitude, latitude] or null.
 * Yandex Point.pos format is "longitude latitude".
 */
export const geocodeAddress = async (address: string): Promise<[number, number] | null> => {
  if (!address?.trim()) return null;
  if (!YANDEX_API_KEY) {
    console.error('⚠️ VITE_YANDEX_MAPS_API_KEY is not set');
    return null;
  }
  try {
    const url =
      `https://geocode-maps.yandex.ru/v1/?apikey=${YANDEX_API_KEY}` +
      `&geocode=${encodeURIComponent(address)}&format=json&lang=ru_RU&results=5`;
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error('Yandex Geocoder error:', resp.status, resp.statusText);
      return null;
    }
    const data = await resp.json();
    const members = data?.response?.GeoObjectCollection?.featureMember;
    if (!members?.length) {
      console.warn('No geocoding results for:', address);
      return null;
    }
    // Point.pos is "longitude latitude"
    const pos: string = members[0].GeoObject.Point.pos;
    const [lon, lat] = pos.split(' ').map(Number);
    console.log(`Geocoded "${address}" → [${lon}, ${lat}]`);
    return [lon, lat];
  } catch (err) {
    console.error('Geocoding error for address:', address, err);
    return null;
  }
};

export interface RouteLeg {
  distance: number; // meters
  duration: number; // seconds
}

/**
 * Build a fallback route using straight-line segments between waypoints.
 * Used when Yandex Router API is unavailable (e.g. 401 - key not enabled for Routes API).
 */
function buildStraightLineRoute(
  coordinates: [number, number][]
): { geometry: GeoJSON.LineString; distance: number; duration: number; legs: RouteLeg[] } {
  const legs: RouteLeg[] = [];
  for (let i = 0; i < coordinates.length - 1; i++) {
    const distM = calculateStraightLineDistance(coordinates[i], coordinates[i + 1]) * 1000;
    legs.push({ distance: distM, duration: distM / 15 }); // assume ~15 m/s for rough duration
  }
  return {
    geometry: { type: 'LineString', coordinates: [...coordinates] },
    distance: legs.reduce((s, l) => s + l.distance, 0),
    duration: legs.reduce((s, l) => s + l.duration, 0),
    legs,
  };
}

/**
 * Get route through multiple waypoints using Yandex Router API.
 * On 401 or other Router API failure, returns a straight-line fallback so the map and delivery estimate still work.
 *
 * Yandex Router API:
 *   - waypoints: "lat,lon|lat,lon" (latitude first, pipe-separated)
 *   - polyline.points: [[lat, lon], ...] (latitude first)
 */
export const getRouteWithWaypoints = async (
  coordinates: [number, number][]
): Promise<{ geometry: GeoJSON.LineString; distance: number; duration: number; legs: RouteLeg[] } | null> => {
  if (!coordinates || coordinates.length < 2) return null;
  if (!YANDEX_ROUTER_API_KEY) return null;

  try {
    const waypoints = coordinates.map(([lon, lat]) => `${lat},${lon}`).join('|');
    const url =
      `https://api.routing.yandex.net/v2/route?apikey=${YANDEX_ROUTER_API_KEY}` +
      `&waypoints=${waypoints}&mode=driving&lang=ru_RU`;

    const resp = await fetch(url);
    if (!resp.ok) {
      if (resp.status === 401) {
        console.warn(
          'Yandex Router API 401: enable "Retrieving Route Details API" for your key at https://developer.tech.yandex.ru/ — using straight-line distances.'
        );
      } else {
        console.warn('Yandex Router error:', resp.status, resp.statusText, '— using straight-line distances.');
      }
      return buildStraightLineRoute(coordinates);
    }
    const data = await resp.json();
    const routeLegs = data?.route?.legs;
    if (!routeLegs?.length) return buildStraightLineRoute(coordinates);

    const legs: RouteLeg[] = routeLegs.map((leg: YandexRouteLeg) => ({
      distance: (leg.steps || []).reduce((s, step) => s + (step.length ?? 0), 0),
      duration: (leg.steps || []).reduce((s, step) => s + (step.duration ?? 0), 0),
    }));

    const geoCoords: [number, number][] = [];
    for (const leg of routeLegs as YandexRouteLeg[]) {
      for (const step of leg.steps || []) {
        for (const pt of step.polyline?.points || []) {
          geoCoords.push([pt[1], pt[0]]);
        }
      }
    }

    return {
      geometry: { type: 'LineString', coordinates: geoCoords },
      distance: legs.reduce((s, l) => s + l.distance, 0),
      duration: legs.reduce((s, l) => s + l.duration, 0),
      legs,
    };
  } catch (err) {
    console.warn('Yandex routing error, using straight-line route:', err);
    return buildStraightLineRoute(coordinates);
  }
};

// Internal Yandex Router API types
interface YandexRouteStep {
  length?: number;
  duration?: number;
  polyline?: { points: [number, number][] };
}
interface YandexRouteLeg {
  steps?: YandexRouteStep[];
}

export default { geocodeAddress, getRouteWithWaypoints, calculateStraightLineDistance, YANDEX_API_KEY, YANDEX_ROUTER_API_KEY };
