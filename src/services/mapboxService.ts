// Mapbox service for geocoding and routing
// Get your free API key from: https://account.mapbox.com/access-tokens/

export const MAPBOX_API_KEY = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1IjoiYWxpYnloNzkiLCJhIjoiY21oa3JmMjE1MWphdDJqcXFzYWRiM2pwNSJ9.eTeDf44PmOr7DFpeMzSHXQ';
const MAPBOX_REQUEST_TIMEOUT_MS = 12000;
const MAPBOX_VERBOSE_LOGS = false;

const mapboxLog = (...args: unknown[]) => {
  if (MAPBOX_VERBOSE_LOGS) console.log(...args);
};

const fetchWithTimeout = async (url: string, timeoutMs = MAPBOX_REQUEST_TIMEOUT_MS): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
};

/**
 * Calculate straight-line distance between two coordinates (Haversine formula)
 * @param coord1 - [longitude, latitude] of first point
 * @param coord2 - [longitude, latitude] of second point
 * @returns Distance in kilometers
 */
export const calculateStraightLineDistance = (
  coord1: [number, number],
  coord2: [number, number]
): number => {
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;
  
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
};

/**
 * Normalize Russian address for better geocoding
 * Converts common Russian abbreviations to full forms
 */
const normalizeRussianAddress = (address: string): string => {
  let normalized = address.trim();
  
  // Expand common abbreviations
  // const replacements: Record<string, string> = {
  //   'край ': 'край ',
  //   'обл ': 'область ',
  //   'ул ': 'улица ',
  //   'ул.': 'улица ',
  //   'г ': 'город ',
  //   'г.': 'город ',
  //   'р-н ': 'район ',
  //   'д.': 'дом ',
  //   'д ': 'дом ',
  // };
  
  // Try to detect and fix region name issues
  // "Красноярский" should be Krasnoyarsk, not Primorsky
  if (normalized.includes('Красноярский')) {
    // Add explicit region name to help disambiguation
    normalized = normalized.replace(/край Красноярский/gi, 'Красноярский край');
    // Ensure it's not confused with Primorsky
    if (!normalized.includes('Красноярск') && !normalized.includes('Красноярский край')) {
      normalized = `Красноярск ${normalized}`;
    }
  }
  
  return normalized;
};

/**
 * Geocode an address using Mapbox Geocoding API
 * @param address - Address string to geocode
 * @returns Coordinates [longitude, latitude] or null if not found
 */
export const geocodeAddress = async (address: string): Promise<[number, number] | null> => {
  if (!address || !address.trim()) {
    console.warn('Empty address provided');
    return null;
  }

  if (MAPBOX_API_KEY === 'YOUR_MAPBOX_ACCESS_TOKEN') {
    console.error('⚠️ Mapbox API key not configured. Get your free key from: https://account.mapbox.com/access-tokens/');
    return null;
  }

  try {
    // Normalize the address
    const normalizedAddress = normalizeRussianAddress(address);
    mapboxLog('Original address:', address);
    mapboxLog('Normalized address:', normalizedAddress);
    
    const encodedAddress = encodeURIComponent(normalizedAddress);
    
    // Try multiple geocoding strategies
    // Strategy 1: Full address with region bias
    let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${MAPBOX_API_KEY}&country=ru&limit=10&types=address,poi,place`;
    
    // If we detect Krasnoyarsk region, add proximity bias to Krasnoyarsk city
    let useProximity = false;
    if (normalizedAddress.includes('Красноярск') || normalizedAddress.includes('Красноярский')) {
      // Krasnoyarsk city coordinates: [92.8932, 56.0087]
      url += `&proximity=92.8932,56.0087`;
      useProximity = true;
      mapboxLog('📍 Using Krasnoyarsk proximity bias');
    }
    
    let response = await fetchWithTimeout(url);
    
    if (!response.ok) {
      console.error('Mapbox Geocoding API error:', response.status, response.statusText);
      return null;
    }

    let data = await response.json();
    
    // If we got results but they're in wrong region, try alternative format
    if (useProximity && data.features && data.features.length > 0) {
      const firstResult = data.features[0];
      const placeName = firstResult.place_name || '';
      
      // Check if result is NOT in Krasnoyarsk region
      if (!placeName.toLowerCase().includes('красноярск')) {
        console.warn('⚠️ First result is not in Krasnoyarsk, trying alternative address format...');
        
        // Try alternative: "Красноярский край, [street address]"
        const alternativeAddress = normalizedAddress.replace(/^край Красноярский,?\s*/i, 'Красноярский край, ');
        const altEncoded = encodeURIComponent(alternativeAddress);
        const altUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${altEncoded}.json?access_token=${MAPBOX_API_KEY}&country=ru&limit=10&types=address,poi,place&proximity=92.8932,56.0087`;
        
        const altResponse = await fetchWithTimeout(altUrl);
        if (altResponse.ok) {
          const altData = await altResponse.json();
          if (altData.features && altData.features.length > 0) {
            const altResult = altData.features.find((f: any) => 
              (f.place_name || '').toLowerCase().includes('красноярск')
            );
            if (altResult) {
              mapboxLog('✅ Found better result with alternative format');
              data.features.unshift(altResult); // Add to beginning of results
            }
          }
        }
      }
    }
    
    if (data.features && data.features.length > 0) {
      // Filter results to prefer Krasnoyarsk region if address contains "Красноярский"
      const isKrasnoyarskAddress = normalizedAddress.includes('Красноярск') || normalizedAddress.includes('Красноярский');
      
      let bestResult = data.features[0];
      
      if (isKrasnoyarskAddress) {
        // Prefer results in Krasnoyarsk region
        const krasnoyarskResult = data.features.find((f: any) => {
          const context = f.context || [];
          const region = context.find((c: any) => c.id?.startsWith('region'));
          const regionName = region?.text || f.place_name || '';
          return regionName.toLowerCase().includes('красноярск') || 
                 f.place_name?.toLowerCase().includes('красноярск');
        });
        
        if (krasnoyarskResult) {
          bestResult = krasnoyarskResult;
          mapboxLog('✅ Found Krasnoyarsk region result');
        } else {
          console.warn('⚠️ No Krasnoyarsk region result found, using first result');
        }
      }
      
      // Prefer address results over place results for accuracy
      const addressResult = data.features.find((f: any) => 
        (f.place_type?.includes('address') || f.properties?.accuracy === 'address') &&
        (!isKrasnoyarskAddress || f.place_name?.toLowerCase().includes('красноярск'))
      );
      
      if (addressResult) {
        bestResult = addressResult;
      }
      
      const [longitude, latitude] = bestResult.center;
      const placeName = bestResult.place_name || bestResult.text || 'Unknown';
      const relevance = bestResult.relevance || 0;
      
      mapboxLog('Geocoded:', address);
      mapboxLog('  -> Coordinates:', [longitude, latitude]);
      mapboxLog('  -> Place:', placeName);
      mapboxLog('  -> Relevance:', relevance);
      mapboxLog('  -> All results:', data.features.length);
      
      // Check if result is in wrong region
      if (isKrasnoyarskAddress && !placeName.toLowerCase().includes('красноярск')) {
        console.error('❌ ERROR: Address should be in Krasnoyarsk but geocoded to:', placeName);
        console.error('   This indicates incorrect geocoding. Mapbox may not have accurate data for this address.');
      }
      
      // Warn if relevance is low (might be wrong location)
      if (relevance < 0.7) mapboxLog('Low geocoding relevance for address:', address, relevance);
      
      return [longitude, latitude]; // Mapbox uses [lon, lat] format
    }
    
    console.warn('No geocoding results found for address:', address);
    return null;
  } catch (error: any) {
    console.error('Geocoding error for address:', address, error);
    return null;
  }
};

/**
 * Get route between two coordinates using Mapbox Directions API
 * @param origin - [longitude, latitude] of origin
 * @param destination - [longitude, latitude] of destination
 * @returns Route data with geometry and distance, or null if error
 */
export const getRoute = async (
  origin: [number, number],
  destination: [number, number]
): Promise<{ geometry: any; distance: number; duration: number } | null> => {
  if (MAPBOX_API_KEY === 'YOUR_MAPBOX_ACCESS_TOKEN') {
    console.error('⚠️ Mapbox API key not configured');
    return null;
  }

  // Calculate straight-line distance first
  const straightLineDistance = calculateStraightLineDistance(origin, destination);
  console.log('📍 Straight-line distance:', straightLineDistance.toFixed(2), 'km');
  
  // If addresses are very close (< 100m), use straight-line distance
  if (straightLineDistance < 0.1) {
    console.log('📍 Addresses are very close (< 100m), using straight-line distance');
    return {
      geometry: {
        type: 'LineString',
        coordinates: [origin, destination]
      },
      distance: straightLineDistance * 1000, // Convert to meters
      duration: 0 // Very short, no significant duration
    };
  }

  try {
    // Mapbox Directions API - driving route
    const coordinates = `${origin[0]},${origin[1]};${destination[0]},${destination[1]}`;
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?access_token=${MAPBOX_API_KEY}&geometries=geojson&overview=full&steps=false`;
    
    const response = await fetchWithTimeout(url);
    
    if (!response.ok) {
      console.error('Mapbox Directions API error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    
    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const routeDistanceKm = route.distance / 1000; // Convert to km
      
      console.log('📍 Route distance:', routeDistanceKm.toFixed(2), 'km');
      console.log('📍 Route duration:', Math.round(route.duration / 60), 'minutes');
      
      // Validate route distance - if it's much longer than straight-line, something might be wrong
      const distanceRatio = routeDistanceKm / straightLineDistance;
      if (distanceRatio > 3 && straightLineDistance < 1) {
        console.warn('⚠️ Route distance is', distanceRatio.toFixed(1), 'x longer than straight-line. This might indicate incorrect geocoding.');
        console.warn('   Straight-line:', straightLineDistance.toFixed(2), 'km');
        console.warn('   Route distance:', routeDistanceKm.toFixed(2), 'km');
      }
      
      return {
        geometry: route.geometry,
        distance: route.distance, // in meters
        duration: route.duration // in seconds
      };
    }
    
    console.warn('No route found');
    return null;
  } catch (error: any) {
    console.error('Route calculation error:', error);
    return null;
  }
};

export interface RouteLeg {
  distance: number; // meters
  duration: number; // seconds
}

function buildStraightLineRoute(
  coordinates: [number, number][]
): { geometry: GeoJSON.LineString; distance: number; duration: number; legs: RouteLeg[] } {
  const legs: RouteLeg[] = [];
  for (let i = 0; i < coordinates.length - 1; i++) {
    const distM = calculateStraightLineDistance(coordinates[i], coordinates[i + 1]) * 1000;
    legs.push({ distance: distM, duration: distM / 15 });
  }
  return {
    geometry: { type: 'LineString', coordinates: [...coordinates] },
    distance: legs.reduce((sum, leg) => sum + leg.distance, 0),
    duration: legs.reduce((sum, leg) => sum + leg.duration, 0),
    legs,
  };
}

async function getSingleLegRoute(
  origin: [number, number],
  destination: [number, number]
): Promise<{ geometry: [number, number][]; distance: number; duration: number } | null> {
  const coords = `${origin[0]},${origin[1]};${destination[0]},${destination[1]}`;
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?access_token=${MAPBOX_API_KEY}&geometries=geojson&overview=full&steps=false`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    console.warn('Mapbox single leg route error:', response.status, response.statusText, errorBody);
    return null;
  }
  const data = await response.json();
  const route = data?.routes?.[0];
  if (!route?.geometry?.coordinates?.length) return null;
  return {
    geometry: route.geometry.coordinates as [number, number][],
    distance: Number(route.distance ?? 0),
    duration: Number(route.duration ?? 0),
  };
}

async function buildSegmentedRoute(
  coordinates: [number, number][]
): Promise<{ geometry: GeoJSON.LineString; distance: number; duration: number; legs: RouteLeg[] }> {
  const stitchedGeometry: [number, number][] = [];
  const legs: RouteLeg[] = [];

  for (let i = 0; i < coordinates.length - 1; i++) {
    const origin = coordinates[i];
    const destination = coordinates[i + 1];
    const legRoute = await getSingleLegRoute(origin, destination);

    if (legRoute) {
      if (stitchedGeometry.length === 0) {
        stitchedGeometry.push(...legRoute.geometry);
      } else {
        stitchedGeometry.push(...legRoute.geometry.slice(1));
      }
      legs.push({ distance: legRoute.distance, duration: legRoute.duration });
      continue;
    }

    // Fallback for a failed single leg: keep the route complete with straight-line segment.
    const fallbackDistanceM = calculateStraightLineDistance(origin, destination) * 1000;
    if (stitchedGeometry.length === 0) stitchedGeometry.push(origin, destination);
    else stitchedGeometry.push(destination);
    legs.push({ distance: fallbackDistanceM, duration: fallbackDistanceM / 15 });
  }

  return {
    geometry: { type: 'LineString', coordinates: stitchedGeometry },
    distance: legs.reduce((sum, leg) => sum + leg.distance, 0),
    duration: legs.reduce((sum, leg) => sum + leg.duration, 0),
    legs,
  };
}

/**
 * Get route through multiple waypoints (2-25 coordinates)
 * @param coordinates - Array of [longitude, latitude] in visit order
 * @returns Combined route data with legs (per-segment distance/duration) or null
 */
export const getRouteWithWaypoints = async (
  coordinates: [number, number][]
): Promise<{ geometry: any; distance: number; duration: number; legs: RouteLeg[] } | null> => {
  if (!coordinates || coordinates.length < 2) return null;
  if (MAPBOX_API_KEY === 'YOUR_MAPBOX_ACCESS_TOKEN') return null;

  try {
    const validCoordinates = coordinates.filter(
      ([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat)
    );
    if (validCoordinates.length < 2) return null;

    const trimmedCoordinates =
      validCoordinates.length > 25 ? validCoordinates.slice(0, 25) : validCoordinates;
    if (validCoordinates.length > 25) {
      console.warn(
        `Mapbox Directions supports up to 25 points. Trimmed ${validCoordinates.length} to ${trimmedCoordinates.length}.`
      );
    }

    const coordsStr = trimmedCoordinates.map(([lon, lat]) => `${lon},${lat}`).join(';');
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsStr}?access_token=${MAPBOX_API_KEY}&geometries=geojson&overview=full&steps=false`;

    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      if (response.status !== 422) {
        console.warn('Mapbox waypoints route error:', response.status, response.statusText, errorBody);
      } else {
        mapboxLog('Mapbox route too long, switching to segmented route fallback.');
      }
      if (response.status === 422) {
        return await buildSegmentedRoute(trimmedCoordinates);
      }
      return null;
    }

    const data = await response.json();
    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const legs: RouteLeg[] = (route.legs || []).map((leg: { distance?: number; duration?: number }) => ({
        distance: leg.distance ?? 0,
        duration: leg.duration ?? 0,
      }));
      return {
        geometry: route.geometry,
        distance: route.distance,
        duration: route.duration,
        legs,
      };
    }
    return buildStraightLineRoute(trimmedCoordinates);
  } catch (error: any) {
    console.error('Multi-waypoint route error:', error);
    return buildStraightLineRoute(coordinates);
  }
};

export default {
  geocodeAddress,
  getRoute,
  getRouteWithWaypoints,
  calculateStraightLineDistance,
  MAPBOX_API_KEY
};

