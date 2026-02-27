// Mapbox service for geocoding and routing
// Get your free API key from: https://account.mapbox.com/access-tokens/

const MAPBOX_API_KEY = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1IjoiYWxpYnloNzkiLCJhIjoiY21oa3JmMjE1MWphdDJqcXFzYWRiM2pwNSJ9.eTeDf44PmOr7DFpeMzSHXQ';

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
    console.log('Original address:', address);
    console.log('Normalized address:', normalizedAddress);
    
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
      console.log('📍 Using Krasnoyarsk proximity bias');
    }
    
    let response = await fetch(url);
    
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
        
        const altResponse = await fetch(altUrl);
        if (altResponse.ok) {
          const altData = await altResponse.json();
          if (altData.features && altData.features.length > 0) {
            const altResult = altData.features.find((f: any) => 
              (f.place_name || '').toLowerCase().includes('красноярск')
            );
            if (altResult) {
              console.log('✅ Found better result with alternative format');
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
          console.log('✅ Found Krasnoyarsk region result');
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
      
      console.log('Geocoded:', address);
      console.log('  -> Coordinates:', [longitude, latitude]);
      console.log('  -> Place:', placeName);
      console.log('  -> Relevance:', relevance);
      console.log('  -> All results:', data.features.length);
      
      // Check if result is in wrong region
      if (isKrasnoyarskAddress && !placeName.toLowerCase().includes('красноярск')) {
        console.error('❌ ERROR: Address should be in Krasnoyarsk but geocoded to:', placeName);
        console.error('   This indicates incorrect geocoding. Mapbox may not have accurate data for this address.');
      }
      
      // Warn if relevance is low (might be wrong location)
      if (relevance < 0.7) {
        console.warn('⚠️ Low geocoding relevance - address might not match exactly');
      }
      
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
    
    const response = await fetch(url);
    
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

/**
 * Get route through multiple waypoints (2-25 coordinates)
 * @param coordinates - Array of [longitude, latitude] in visit order
 * @returns Combined route data or null
 */
export const getRouteWithWaypoints = async (
  coordinates: [number, number][]
): Promise<{ geometry: any; distance: number; duration: number } | null> => {
  if (!coordinates || coordinates.length < 2) return null;
  if (MAPBOX_API_KEY === 'YOUR_MAPBOX_ACCESS_TOKEN') return null;

  try {
    const coordsStr = coordinates.map(([lon, lat]) => `${lon},${lat}`).join(';');
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsStr}?access_token=${MAPBOX_API_KEY}&geometries=geojson&overview=full&steps=false`;

    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      return {
        geometry: route.geometry,
        distance: route.distance,
        duration: route.duration,
      };
    }
    return null;
  } catch (error: any) {
    console.error('Multi-waypoint route error:', error);
    return null;
  }
};

export default {
  geocodeAddress,
  getRoute,
  getRouteWithWaypoints,
  calculateStraightLineDistance,
  MAPBOX_API_KEY
};

