import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Alert,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { InventoryRow } from '../utils/csvParser';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';

declare global {
  interface Window {
    ymaps: any;
  }
}

// Geocode address using Yandex HTTP Geocoder API
const geocodeAddress = async (address: string): Promise<[number, number] | null> => {
  if (!address || !address.trim()) {
    console.warn('Empty address provided');
    return null;
  }

  const API_KEY = '35686a94-d9da-45dc-a9f8-2c4678b20a88';
  
  try {
    // Use HTTP Geocoder API
    const encodedAddress = encodeURIComponent(address);
    const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${API_KEY}&geocode=${encodedAddress}&format=json&results=1`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('HTTP Geocoder API error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    
    if (data.response && data.response.GeoObjectCollection) {
      const featureMembers = data.response.GeoObjectCollection.featureMember;
      
      if (featureMembers && featureMembers.length > 0) {
        const firstResult = featureMembers[0].GeoObject;
        const pos = firstResult.Point.pos;
        
        if (pos) {
          // Yandex returns coordinates as "lon lat" (space-separated)
          const [lon, lat] = pos.split(' ').map(Number);
          if (lat && lon) {
            console.log('Geocoded successfully:', address, '->', [lon, lat], '(lon, lat for Yandex Maps)');
            return [lon, lat]; // Yandex Maps expects [lon, lat] format
          }
        }
      }
    }
    
    console.warn('No geocoding results found for address:', address);
    return null;
  } catch (error: any) {
    console.error('Geocoding error for address:', address, error);
    return null;
  }
};

const ProductDetails: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSelector((state: RootState) => state.auth.user);
  const mapRef = useRef<HTMLDivElement>(null);
  const yandexMapRef = useRef<any>(null);
  const routeRef = useRef<any>(null);
  
  // Get product data from navigation state
  const productData = location.state?.product as InventoryRow | null;

  const [selectedWarehouse, setSelectedWarehouse] = useState<string>(() => {
    if (user?.warehouses && user.warehouses.length > 0) {
      const firstWarehouse = user.warehouses[0];
      return typeof firstWarehouse === 'string' 
        ? firstWarehouse 
        : firstWarehouse.address || '';
    }
    return '';
  });
  const [destinationAddress, setDestinationAddress] = useState<string>(
    productData?.warehouseAddress || ''
  );

  // Map state
  const [distance, setDistance] = useState<number | null>(null);
  const [loadingMap, setLoadingMap] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);

  // Check if Yandex Maps API is loaded
  useEffect(() => {
    const checkApi = () => {
      // Check if script loaded but API failed
      const script = document.querySelector('script[src*="api-maps.yandex.ru"]');
      if (script) {
        script.addEventListener('error', () => {
          setMapError('Ошибка загрузки скрипта Yandex Maps. Проверьте подключение к интернету.');
        });
      }

      if (window.ymaps) {
        setMapError(null);
      } else {
        // Check if API failed to load after delay
        setTimeout(() => {
          if (!window.ymaps) {
            setMapError('Не удалось загрузить Yandex Maps API. Проверьте ограничения API ключа.');
          }
        }, 3000);
      }
    };

    // Wait a bit for script to load
    const timer = setTimeout(checkApi, 500);
    return () => clearTimeout(timer);
  }, []);

  // Initialize Yandex Map
  useEffect(() => {
    if (!mapRef.current) {
      console.warn('Map ref is null');
      return;
    }

    console.log('Map ref is available, initializing...');
    let mounted = true;

    const initMap = () => {
      if (!mounted) return;

      if (!window.ymaps) {
        console.error('window.ymaps is not available');
        setMapError('Yandex Maps API not loaded. Check API key.');
        setLoadingMap(false);
        return;
      }

      console.log('window.ymaps is available');

      // Don't destroy existing map - reuse it to preserve routes
      if (yandexMapRef.current) {
        console.log('Map already exists, reusing it to preserve route');
        return; // Exit early, don't recreate the map
      }

      const createMapInstance = () => {
        if (!mounted || !mapRef.current) return;

        console.log('ymaps.ready() callback fired');
        
        const container = mapRef.current;
        console.log('Map container:', container);
        console.log('Container dimensions:', container.offsetWidth, 'x', container.offsetHeight);
        console.log('Container visible:', container.offsetParent !== null);
        console.log('Container display:', window.getComputedStyle(container).display);
        console.log('Container visibility:', window.getComputedStyle(container).visibility);

        if (container.offsetWidth === 0 || container.offsetHeight === 0) {
          console.error('Container has zero dimensions!');
          console.error('Container styles:', window.getComputedStyle(container));
          setMapError('Map container has invalid dimensions');
          setLoadingMap(false);
          return;
        }
        
        // Ensure container is visible and has proper styling
        container.style.display = 'block';
        container.style.visibility = 'visible';
        container.style.opacity = '1';

          try {
            console.log('Creating Map instance...');
            console.log('Available ymaps modules:', Object.keys(window.ymaps));
            console.log('ymaps.Map exists?', typeof window.ymaps.Map);
            
            yandexMapRef.current = new window.ymaps.Map(container, {
              center: [55.993152, 92.791729], // Default to first location
              zoom: 10,
              controls: [],
              type: 'yandex#map', // Explicitly set map type
              // Force map to be interactive
              behaviors: ['default', 'scrollZoom'],
              // Ensure map tries to load tiles
              autoFitToViewport: 'always'
            });
            
            // Ensure map is properly initialized and visible
            console.log('Map created, waiting for tiles to initialize...');
            
            // Force map container to be ready for tiles
            setTimeout(() => {
              if (yandexMapRef.current) {
                // Trigger a redraw to force tile loading
                try {
                  const zoom = yandexMapRef.current.getZoom();
                  yandexMapRef.current.setZoom(zoom);
                  console.log('Map zoom set to trigger tiles');
                } catch (e) {
                  console.warn('Error setting zoom:', e);
                }
              }
            }, 500);

            console.log('Map instance created successfully');
            
            // Listen for map tiles to load
            yandexMapRef.current.events.add('tilesload', () => {
              console.log('✅ Map tiles loaded successfully');
            });
            
            yandexMapRef.current.events.add('tilesinsert', () => {
              console.log('✅ Map tiles inserted');
            });
            
            // Check for tile loading errors
            yandexMapRef.current.events.add('tileserror', (e: any) => {
              console.error('❌ Map tiles error:', e);
              console.error('This might be due to API key restrictions blocking tile requests');
            });
            
            // Listen for map ready state
            yandexMapRef.current.events.add('actionbegin', () => {
              console.log('Map action beginning');
            });
            
            // Force map to check container size and load tiles
            setTimeout(() => {
              if (yandexMapRef.current && container) {
                console.log('Checking if map needs to recalculate size...');
                const containerRect = container.getBoundingClientRect();
                console.log('Container rect:', containerRect);
                
                // Force container size recalculation
                if (containerRect.width > 0 && containerRect.height > 0) {
                  // Try to force tiles to load by changing map state
                  try {
                    yandexMapRef.current.container.fitToViewport();
                    console.log('Container fitted to viewport');
                  } catch (e) {
                    console.warn('fitToViewport error:', e);
                  }
                }
              }
            }, 300);
            
            // Check map state after a delay
            setTimeout(() => {
              if (yandexMapRef.current && container) {
                const mapType = yandexMapRef.current.getType();
                const zoom = yandexMapRef.current.getZoom();
                const center = yandexMapRef.current.getCenter();
                console.log('Map state:', { mapType, zoom, center });
                
                // Check ALL elements in the container
                const allElements = container.querySelectorAll('*');
                console.log(`Total elements in container: ${allElements.length}`);
                
                // Check all ymaps elements
                const allYmaps = container.querySelectorAll('[class*="ymaps"]');
                console.log(`Found ${allYmaps.length} ymaps elements in container`);
                
                // Log first 10 ymaps elements to see what's there
                allYmaps.forEach((el, i) => {
                  if (i < 10) {
                    const htmlEl = el as HTMLElement;
                    console.log(`Element ${i}:`, {
                      tag: el.tagName,
                      classes: el.className,
                      id: el.id,
                      visible: htmlEl.offsetWidth > 0 && htmlEl.offsetHeight > 0
                    });
                  }
                });
                
                // Check if tiles are actually in the DOM - try multiple selectors
                let tilesContainer = container.querySelector('.ymaps-2-1-79-tiles-pane');
                if (!tilesContainer) {
                  // Try alternative selectors - check for any pane
                  tilesContainer = container.querySelector('[class*="tiles-pane"]');
                }
                if (!tilesContainer) {
                  // Try ground-pane
                  tilesContainer = container.querySelector('[class*="ground-pane"]');
                }
                if (!tilesContainer) {
                  // Try any pane
                  const panes = container.querySelectorAll('[class*="pane"]');
                  console.log(`Found ${panes.length} pane elements`);
                  panes.forEach((pane, i) => {
                    if (i < 5) console.log(`Pane ${i}:`, pane.className);
                  });
                }
                
                // Check for images anywhere in container
                const allImages = container.querySelectorAll('img');
                console.log(`Found ${allImages.length} image elements in container`);
                allImages.forEach((img, i) => {
                  if (i < 5) {
                    console.log(`Image ${i}:`, {
                      src: img.src.substring(0, 100),
                      width: img.width,
                      height: img.height,
                      complete: img.complete
                    });
                  }
                });
                
                if (tilesContainer) {
                  console.log('✅ Tiles container found in DOM');
                  const tileImages = tilesContainer.querySelectorAll('img');
                  console.log(`Found ${tileImages.length} tile images`);
                  if (tileImages.length === 0) {
                    console.warn('⚠️ No tile images found - tiles may not be loading due to API restrictions');
                    console.warn('Check API key settings - ensure "JavaScript API" is enabled and HTTP Referer allows localhost');
                  }
                } else {
                  console.warn('⚠️ Tiles container not found in DOM');
                  console.warn('This might mean the map tiles are not initializing. Check:');
                  console.warn('1. API key has "JavaScript API" enabled');
                  console.warn('2. HTTP Referer restrictions allow localhost');
                  console.warn('3. Network tab shows tile image requests (should see requests to api-maps.yandex.ru with .png or .jpg)');
                }
              }
            }, 3000);
            
            // Force map to initialize tiles by changing view slightly
            setTimeout(() => {
              if (yandexMapRef.current) {
                console.log('Forcing map tile refresh...');
                try {
                  // Force tiles to load by changing zoom and center
                  const currentZoom = yandexMapRef.current.getZoom();
                  const currentCenter = yandexMapRef.current.getCenter();
                  
                  // Slight zoom change to trigger tile loading
                  yandexMapRef.current.setZoom(currentZoom + 0.1);
                  setTimeout(() => {
                    if (yandexMapRef.current) {
                      yandexMapRef.current.setZoom(currentZoom);
                    }
                  }, 100);
                  
                  // Also try panning slightly to trigger tiles
                  setTimeout(() => {
                    if (yandexMapRef.current) {
                      yandexMapRef.current.panTo(currentCenter, { duration: 0 });
                    }
                  }, 200);
                  
                  // Force redraw by setting bounds
                  setTimeout(() => {
                    if (yandexMapRef.current) {
                      try {
                        const bounds = yandexMapRef.current.getBounds();
                        if (bounds) {
                          yandexMapRef.current.setBounds(bounds, {
                            checkZoomRange: false,
                            duration: 0
                          });
                        }
                      } catch (e) {
                        console.warn('Error setting bounds:', e);
                      }
                    }
                  }, 300);
                  
                  console.log('Map refresh triggered - tiles should load now');
                  
                  // Check for tiles after a delay
                  setTimeout(() => {
                    if (container) {
                      const images = container.querySelectorAll('img');
                      console.log(`After refresh: Found ${images.length} images`);
                      if (images.length > 0) {
                        console.log('✅ Tiles are loading!');
                      } else {
                        console.warn('⚠️ Still no tiles');
                        console.warn('Note: Yandex Maps tiles load from vec*.maps.yandex.net, not api-maps.yandex.ru');
                        console.warn('Check Network tab for requests to domains like:');
                        console.warn('- vec01.maps.yandex.net');
                        console.warn('- vec02.maps.yandex.net');
                        console.warn('- vec03.maps.yandex.net');
                        console.warn('If these are blocked (403/401), the API key needs tile permissions');
                      }
                    }
                  }, 2000);
                } catch (e) {
                  console.warn('Error refreshing map:', e);
                }
              }
            }, 1000);
            
            // Add controls
            yandexMapRef.current.controls.add('zoomControl', {
              size: 'small',
              position: {
                right: 10,
                top: 10
              }
            });
            
            yandexMapRef.current.controls.add('fullscreenControl', {
              position: {
                right: 10,
                top: 50
              }
            });

            console.log('Map controls added');
            setMapError(null);
            setLoadingMap(false);
          } catch (error: any) {
            console.error('Map initialization error:', error);
            console.error('Error stack:', error.stack);
            setMapError(`Map initialization error: ${error.message}`);
            setLoadingMap(false);
          }
      };

      try {
        console.log('Calling ymaps.ready()...');
        console.log('ymaps object:', window.ymaps);
        console.log('ymaps.ready type:', typeof window.ymaps.ready);
        
        if (typeof window.ymaps.ready === 'function') {
          // Test if ready is working
          window.ymaps.ready(() => {
            console.log('TEST: ymaps.ready callback works!');
            createMapInstance();
          });
          
          // Fallback: try to create map after a delay if callback doesn't fire
          setTimeout(() => {
            if (!yandexMapRef.current && mounted && mapRef.current) {
              console.warn('ymaps.ready callback did not fire, trying direct initialization');
              createMapInstance();
            }
          }, 2000);
        } else {
          console.error('window.ymaps.ready is not a function! Type:', typeof window.ymaps.ready);
          setMapError('ymaps.ready is not available');
          setLoadingMap(false);
        }
      } catch (error: any) {
        console.error('Yandex Maps ready error:', error);
        console.error('Error details:', error.message, error.stack);
        setMapError('Error calling ymaps.ready(). Check console.');
        setLoadingMap(false);
      }
    };

    // Delay to ensure container is fully rendered
    const timer = setTimeout(() => {
      if (mounted) {
        initMap();
      }
    }, 500);

    return () => {
      mounted = false;
      clearTimeout(timer);
      // Don't destroy map on cleanup - let it persist
      // This prevents the route from disappearing when component re-renders
      console.log('Map initialization cleanup (not destroying map)');
    };
  }, []);

  // Load route when addresses change
  useEffect(() => {
    let isMounted = true;
    let currentRouteAddresses = '';
    
    const loadRoute = async () => {
      console.log('🔄 loadRoute called with:', { selectedWarehouse, destinationAddress, isMounted });
      
      if (!selectedWarehouse || !destinationAddress) {
        console.warn('⚠️ Missing addresses:', { selectedWarehouse, destinationAddress });
        if (isMounted) {
          setLoadingMap(false);
        }
        return;
      }

      // Check if we're already loading/loaded the same route
      const routeKey = `${selectedWarehouse}|${destinationAddress}`;
      if (currentRouteAddresses === routeKey && routeRef.current) {
        console.log('Route already loaded for these addresses, verifying it still exists...');
        // Verify route is still on map
        let routeStillExists = false;
        if (yandexMapRef.current) {
          yandexMapRef.current.geoObjects.each((obj: any) => {
            if (obj === routeRef.current) {
              routeStillExists = true;
            }
          });
        }
        if (routeStillExists) {
          console.log('✅ Route still on map, skipping reload');
          if (isMounted) {
            setLoadingMap(false);
          }
          return;
        } else {
          console.warn('⚠️ Route was removed, will reload...');
          routeRef.current = null;
        }
      }

      // Wait for Yandex Maps to be ready
      if (!window.ymaps) {
        if (isMounted) {
          setMapError('Yandex Maps API не загружен. Ожидание...');
          setLoadingMap(true);
        }
        return;
      }

      if (!yandexMapRef.current) {
        if (isMounted) {
          setMapError('Карта не инициализирована. Ожидание...');
          setLoadingMap(true);
        }
        return;
      }

      currentRouteAddresses = routeKey;
      
      if (isMounted) {
        setLoadingMap(true);
        setDistance(null);
        setMapError(null);
      }

      try {
        // Wait for ymaps to be ready before geocoding
        await new Promise<void>((resolve) => {
          if (window.ymaps.ready) {
            window.ymaps.ready(() => {
              resolve();
            });
          } else {
            resolve();
          }
        });

        console.log('📍 Geocoding addresses:', { selectedWarehouse, destinationAddress });
        console.log('🔄 Starting route loading process...');
        
        // Geocode both addresses
        const origin = await geocodeAddress(selectedWarehouse);
        const destination = await geocodeAddress(destinationAddress);
        
        console.log('Geocoding results:', { origin, destination });

        if (origin && destination && isMounted) {
          // Only clear if we're creating a different route
          const routeKey = `${selectedWarehouse}|${destinationAddress}`;
          const shouldClear = currentRouteAddresses !== routeKey;
          
          if (shouldClear) {
            // Clear previous route and markers carefully
            if (routeRef.current) {
              try {
                yandexMapRef.current.geoObjects.remove(routeRef.current);
              } catch (e) {
                console.warn('Error removing previous route:', e);
              }
              routeRef.current = null;
            }

            // Remove only markers, not the route (route should already be removed above)
            // Use each() to iterate over geoObjects
            const markersToRemove: any[] = [];
            yandexMapRef.current.geoObjects.each((obj: any) => {
              // Only remove Placemarks (markers), not routes
              if (obj && obj.constructor && obj.constructor.name === 'Placemark') {
                markersToRemove.push(obj);
              }
            });
            
            // Remove markers
            markersToRemove.forEach((marker) => {
              try {
                yandexMapRef.current.geoObjects.remove(marker);
              } catch (e) {
                // Ignore errors
              }
            });
          } else {
            console.log('Keeping existing route for same addresses');
            if (isMounted) {
              setLoadingMap(false);
            }
            return;
          }

          // Create markers
          const originMarker = new window.ymaps.Placemark(origin, {
            balloonContent: `<strong>Склад отгрузки</strong><br/>${selectedWarehouse}`,
            iconColor: '#FED208'
          }, {
            preset: 'islands#yellowStretchyIcon'
          });

          const destinationMarker = new window.ymaps.Placemark(destination, {
            balloonContent: `<strong>Адрес назначения</strong><br/>${destinationAddress}`,
            iconColor: '#FED208'
          }, {
            preset: 'islands#yellowStretchyIcon'
          });

          yandexMapRef.current.geoObjects.add(originMarker);
          yandexMapRef.current.geoObjects.add(destinationMarker);

          // Create route using Yandex Router
          console.log('📍 Creating multiRoute with points:', origin, destination);
          console.log('📍 Origin type:', Array.isArray(origin) ? 'array' : typeof origin, origin);
          console.log('📍 Destination type:', Array.isArray(destination) ? 'array' : typeof destination, destination);
          
          const multiRoute = new window.ymaps.multiRouter.MultiRoute({
            referencePoints: [
              origin, // [lon, lat]
              destination
            ],
            params: {
              routingMode: 'auto',
              results: 1
            }
          }, {
            // Auto fit bounds to show the route
            boundsAutoApply: true,
            // Active route (the one being used) - make it very visible
            routeActiveStrokeWidth: 8,
            routeActiveStrokeColor: '#FED208',
            routeActiveStrokeStyle: 'solid',
            routeActiveStrokeOpacity: 1.0,
            // Inactive routes
            routeStrokeWidth: 8,
            routeStrokeColor: '#FED208',
            routeStrokeStyle: 'solid',
            routeStrokeOpacity: 1.0,
            // Path styling (for the actual road path)
            pathStrokeWidth: 8,
            pathStrokeColor: '#FED208',
            pathStrokeStyle: 'solid',
            pathStrokeOpacity: 1.0,
            // Ensure visibility
            opacity: 1.0,
            visible: true,
            // Way point options - make markers visible
            wayPointStartVisible: true,
            wayPointFinishVisible: true,
            wayPointStartIconColor: '#FED208',
            wayPointFinishIconColor: '#FED208',
            wayPointIconFillColor: '#FED208'
          });

          routeRef.current = multiRoute;
          yandexMapRef.current.geoObjects.add(multiRoute);
          console.log('✅ MultiRoute added to map');
          
          // Mark route to prevent accidental removal
          try {
            if (multiRoute.properties) {
              multiRoute.properties.set('isRoute', true);
            }
          } catch (e) {
            // Ignore if properties not available
          }

          // Listen for route model events
          console.log('Setting up route event listeners...');
          
          // Get route distance and fit bounds when route loads
          multiRoute.model.events.add('requestsuccess', () => {
            console.log('✅ Route request successful');
            try {
              const routes = multiRoute.getRoutes();
              console.log('Number of routes:', routes.getLength());
              
              if (routes.getLength() > 0) {
                const route = routes.get(0);
                
                // Explicitly set as active route
                multiRoute.setActiveRoute(route);
                console.log('✅ Route set as active');
                
                const distanceMeters = route.properties.get('distance').value;
                const distanceKm = Math.round((distanceMeters / 1000) * 10) / 10;
                setDistance(distanceKm);
                console.log('✅ Route distance set:', distanceKm, 'km');
                
                // Verify route is visible and explicitly show all paths
                try {
                  const paths = route.getPaths();
                  if (paths && paths.getLength() > 0) {
                    console.log('✅ Route has', paths.getLength(), 'path(s)');
                    
                    // Explicitly ensure each path is visible
                    for (let i = 0; i < paths.getLength(); i++) {
                      const path = paths.get(i);
                      try {
                        // Force path to be visible
                        path.options.set('strokeWidth', 8);
                        path.options.set('strokeColor', '#FED208');
                        path.options.set('strokeOpacity', 1.0);
                        path.options.set('opacity', 1.0);
                        path.options.set('visible', true);
                        console.log(`✅ Path ${i} styled and made visible`);
                      } catch (pathError) {
                        console.warn(`Could not style path ${i}:`, pathError);
                      }
                    }
                  } else {
                    console.warn('⚠️ Route has no paths!');
                  }
                } catch (e) {
                  console.warn('Could not get route paths:', e);
                }
                
                // Verify route is still on the map
                setTimeout(() => {
                  if (yandexMapRef.current && routeRef.current === multiRoute) {
                    let routeOnMap = false;
                    yandexMapRef.current.geoObjects.each((obj: any) => {
                      if (obj === multiRoute) {
                        routeOnMap = true;
                      }
                    });
                    console.log('Route still on map:', routeOnMap);
                    
                    if (!routeOnMap) {
                      console.warn('⚠️ Route disappeared! Re-adding...');
                      yandexMapRef.current.geoObjects.add(multiRoute);
                    }
                  }
                }, 100);
                
                // Fit map to route bounds after it's loaded
                setTimeout(() => {
                  try {
                    const routeBounds = multiRoute.getBounds();
                    if (routeBounds && yandexMapRef.current) {
                      console.log('Fitting map to route bounds:', routeBounds);
                      yandexMapRef.current.setBounds(routeBounds, {
                        checkZoomRange: true,
                        padding: [80, 80, 80, 80],
                        duration: 500
                      });
                      
                      // Verify route is still visible after bounds change
                      setTimeout(() => {
                        if (yandexMapRef.current && routeRef.current === multiRoute) {
                          let routeStillThere = false;
                          yandexMapRef.current.geoObjects.each((obj: any) => {
                            if (obj === multiRoute) {
                              routeStillThere = true;
                            }
                          });
                          console.log('Route still on map after bounds change:', routeStillThere);
                          
                          if (!routeStillThere) {
                            console.warn('⚠️ Route disappeared after bounds change! Re-adding...');
                            yandexMapRef.current.geoObjects.add(multiRoute);
                            multiRoute.setActiveRoute(route);
                          }
                        }
                      }, 700);
                    }
                  } catch (boundsError: any) {
                    console.error('Error fitting bounds:', boundsError);
                  }
                }, 200);
              } else {
                console.warn('⚠️ No routes found in multiRoute');
              }
            } catch (error: any) {
              console.error('Error processing route:', error);
            }
          });
          
          // Handle route errors
          multiRoute.model.events.add('requesterror', (error: any) => {
            console.error('❌ Route request error:', error);
            setMapError('Route building error');
          });
          
          // Also listen for route update events
          multiRoute.model.events.add('requestsuccess', () => {
            console.log('✅ Route model requestsuccess event fired');
          });
          
          // Fallback: Check route state after delays (in case events don't fire)
          setTimeout(() => {
            if (yandexMapRef.current && routeRef.current === multiRoute) {
              console.log('🔍 Fallback: Checking route state after 1 second...');
              try {
                const routes = multiRoute.getRoutes();
                console.log('Routes count:', routes ? routes.getLength() : 'no routes object');
                
                if (routes && routes.getLength() > 0) {
                  const route = routes.get(0);
                  console.log('✅ Route found! Activating...');
                  
                  try {
                    const distance = route.properties.get('distance');
                    const distanceKm = Math.round((distance.value / 1000) * 10) / 10;
                    setDistance(distanceKm);
                    console.log('✅ Route distance:', distanceKm, 'km');
                  } catch (e) {
                    console.warn('Could not get route distance:', e);
                  }
                  
                  // Force route to be visible and active
                  try {
                    multiRoute.setActiveRoute(route);
                    console.log('✅ Route set as active');
                    
                    // Force redraw
                    yandexMapRef.current.geoObjects.add(multiRoute);
                  } catch (e) {
                    console.warn('Could not set active route:', e);
                  }
                  
                  // Fit bounds
                  try {
                    const bounds = multiRoute.getBounds();
                    if (bounds) {
                      yandexMapRef.current.setBounds(bounds, {
                        checkZoomRange: true,
                        padding: [80, 80, 80, 80]
                      });
                    }
                  } catch (e) {
                    console.warn('Could not fit bounds:', e);
                  }
                } else {
                  console.warn('⚠️ No routes available yet, will retry...');
                }
              } catch (e) {
                console.error('Error checking route:', e);
              }
            }
          }, 1000);
          
          // Second fallback check
          setTimeout(() => {
            if (yandexMapRef.current && routeRef.current === multiRoute) {
              console.log('🔍 Fallback: Checking route state after 3 seconds...');
              try {
                const routes = multiRoute.getRoutes();
                if (routes && routes.getLength() > 0) {
                  const route = routes.get(0);
                  multiRoute.setActiveRoute(route);
                  console.log('✅ Route activated on fallback');
                  
                  // Ensure route is on map
                  let routeOnMap = false;
                  yandexMapRef.current.geoObjects.each((obj: any) => {
                    if (obj === multiRoute) {
                      routeOnMap = true;
                    }
                  });
                  
                  if (!routeOnMap) {
                    console.warn('⚠️ Route not on map, adding...');
                    yandexMapRef.current.geoObjects.add(multiRoute);
                  }
                }
              } catch (e) {
                console.error('Error in fallback check:', e);
              }
            }
          }, 3000);
        } else {
          console.error('Could not geocode addresses');
          if (!origin) {
            setMapError(`Не удалось найти координаты для адреса: ${selectedWarehouse}`);
          } else if (!destination) {
            setMapError(`Не удалось найти координаты для адреса: ${destinationAddress}`);
          } else {
            setMapError('Не удалось найти координаты для адресов');
          }
        }
      } catch (error: any) {
        console.error('Error loading route:', error);
        if (isMounted) {
          setMapError(`Ошибка при загрузке маршрута: ${error?.message || 'Неизвестная ошибка'}`);
        }
      } finally {
        if (isMounted) {
          setLoadingMap(false);
        }
      }
    };
    
    return () => {
      isMounted = false;
      // Don't clear route on unmount - let it persist
    };

    // Wait for Yandex Maps to be ready
    console.log('🔄 Route loading effect triggered', { selectedWarehouse, destinationAddress });
    
    if (window.ymaps) {
      if (yandexMapRef.current) {
        console.log('Map ready, loading route...');
        window.ymaps.ready(loadRoute);
      } else {
        console.log('Map not ready yet, waiting...');
        // Wait a bit for map to initialize
        window.ymaps.ready(() => {
          setTimeout(() => {
            if (yandexMapRef.current && isMounted) {
              console.log('Map ready after delay, loading route...');
              loadRoute();
            } else {
              console.warn('Map not initialized, waiting...');
              const checkInterval = setInterval(() => {
                if (yandexMapRef.current && isMounted) {
                  clearInterval(checkInterval);
                  console.log('Map ready after interval check, loading route...');
                  loadRoute();
                }
              }, 500);
              setTimeout(() => {
                clearInterval(checkInterval);
                if (!yandexMapRef.current && isMounted) {
                  console.error('Map initialization timeout');
                }
              }, 5000);
            }
          }, 1000);
        });
      }
    } else {
      console.warn('Yandex Maps API not loaded yet');
      if (isMounted) {
        setMapError('Ожидание загрузки Yandex Maps API...');
        setLoadingMap(true);
      }
    }
  }, [selectedWarehouse, destinationAddress]);

  if (!productData) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">Продукт не найден</Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/marketplace')}
          sx={{ mt: 2, color: '#FED208' }}
        >
          Вернуться к списку
        </Button>
      </Container>
    );
  }

  const handleBack = () => {
    navigate('/marketplace');
  };

  return (
    <Box sx={{ backgroundColor: '#1a1a1a', minHeight: '100vh', pb: 4 }}>
      <Container maxWidth="lg" sx={{ pt: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
          sx={{
            mb: 3,
            color: '#FED208',
            '&:hover': {
              backgroundColor: 'rgba(254, 210, 8, 0.1)',
            },
          }}
        >
          Назад к списку
        </Button>

        <Typography
          variant="h4"
          component="h1"
          sx={{
            color: '#FED208',
            mb: 3,
            fontWeight: 'bold',
          }}
        >
          Информация о продукте
        </Typography>

        <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
          {/* Product Information */}
          <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 66.66%' } }}>
            <Paper
              sx={{
                p: 3,
                backgroundColor: '#2a2a2a',
                border: '1px solid #444',
                mb: 3,
              }}
            >
              <Typography
                variant="h5"
                sx={{ color: '#FED208', mb: 2, fontWeight: 'bold' }}
              >
                Основная информация
              </Typography>
              <Divider sx={{ mb: 2, borderColor: '#444' }} />

              <TableContainer>
                <Table sx={{ '& .MuiTableCell-root': { borderColor: '#444', color: '#fff' } }}>
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', color: '#FED208' }}>
                        БЕ (Балансовая единица)
                      </TableCell>
                      <TableCell>{productData.balanceUnit || '-'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', color: '#FED208' }}>
                        Наименование дочернего Общества
                      </TableCell>
                      <TableCell>{productData.companyName || '-'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', color: '#FED208' }}>
                        Филиал Общества
                      </TableCell>
                      <TableCell>{productData.branch || '-'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', color: '#FED208' }}>
                        Адрес склада
                      </TableCell>
                      <TableCell>{productData.warehouseAddress || '-'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', color: '#FED208' }}>
                        Класс МТР
                      </TableCell>
                      <TableCell>{productData.materialClass || '-'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', color: '#FED208' }}>
                        Наименование класса
                      </TableCell>
                      <TableCell>{productData.className || '-'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', color: '#FED208' }}>
                        Подкласс МТР
                      </TableCell>
                      <TableCell>{productData.materialSubclass || '-'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', color: '#FED208' }}>
                        Наименование подкласса
                      </TableCell>
                      <TableCell>{productData.subclassName || '-'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', color: '#FED208' }}>
                        КСМ (код материала)
                      </TableCell>
                      <TableCell>{productData.materialCode || '-'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', color: '#FED208' }}>
                        Наименование материала
                      </TableCell>
                      <TableCell>{productData.materialName || '-'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', color: '#FED208' }}>
                        Единица измерения
                      </TableCell>
                      <TableCell>{productData.unit || '-'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', color: '#FED208' }}>
                        Количество
                      </TableCell>
                      <TableCell>{productData.quantity || '-'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', color: '#FED208' }}>
                        Стоимость, руб
                      </TableCell>
                      <TableCell>{productData.cost || '-'}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>

            {/* Map Section */}
            <Paper
              sx={{
                p: 3,
                backgroundColor: '#2a2a2a',
                border: '1px solid #444',
                minHeight: '500px',
                position: 'relative',
              }}
            >
              <Typography
                variant="h5"
                sx={{ color: '#FED208', mb: 2, fontWeight: 'bold' }}
              >
                Маршрут доставки
              </Typography>
              {distance !== null && (
                <Typography
                  variant="h6"
                  sx={{ color: '#fff', mb: 2 }}
                >
                  Расстояние: {distance} км
                </Typography>
              )}
              <Divider sx={{ mb: 2, borderColor: '#444' }} />
              {mapError ? (
                <Alert 
                  severity="error" 
                  sx={{ 
                    backgroundColor: '#2a2a2a',
                    color: '#fff',
                    '& .MuiAlert-icon': { color: '#f44336' }
                  }}
                >
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold' }}>
                    Ошибка API ключа Yandex Maps
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    {mapError}
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: '0.875rem', mt: 1, fontWeight: 'bold', color: '#FED208' }}>
                    ⚠️ Диагностика: Тайлы не загружаются
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: '0.875rem', mt: 1 }}>
                    Проблема: Контейнер карты найден, но изображения тайлов (0 штук) не загружаются.
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: '0.875rem', mt: 1 }}>
                    Пожалуйста, убедитесь что:
                  </Typography>
                  <Box component="ul" sx={{ mt: 1, pl: 2, fontSize: '0.875rem', mb: 1 }}>
                    <li>API ключ активирован в <a href="https://developer.tech.yandex.ru/services/" target="_blank" rel="noopener noreferrer" style={{ color: '#FED208' }}>Yandex Developer Dashboard</a></li>
                    <li>Выбран сервис "JavaScript API и HTTP Геокодер"</li>
                    <li>API ключ указан правильно в index.html</li>
                    <li style={{ color: '#FED208', fontWeight: 'bold' }}>❗ В настройках API ключа включен доступ к загрузке тайлов карты</li>
                  </Box>
                  <Typography variant="body2" sx={{ fontSize: '0.875rem', mt: 2, fontWeight: 'bold', color: '#FED208' }}>
                    ⚠️ Важно: Проверьте ограничения API ключа
                  </Typography>
                  <Box component="ul" sx={{ mt: 1, pl: 2, fontSize: '0.875rem' }}>
                    <li>В настройках API ключа найдите раздел "Ограничение по HTTP Referer"</li>
                    <li>Для локальной разработки добавьте (каждое значение на отдельной строке, БЕЗ протокола, порта и URL):</li>
                    <Box component="ul" sx={{ mt: 0.5, pl: 3, mb: 1 }}>
                      <li><code style={{ color: '#FED208', backgroundColor: '#1a1a1a', padding: '2px 4px', borderRadius: '2px' }}>localhost</code></li>
                      <li><code style={{ color: '#FED208', backgroundColor: '#1a1a1a', padding: '2px 4px', borderRadius: '2px' }}>127.0.0.1</code></li>
                    </Box>
                    <li>Или временно отключите ограничения для тестирования (уберите галочку "Ограничение по HTTP Referer")</li>
                    <li>Проверьте, что в настройках ключа включен доступ к "JavaScript API"</li>
                    <li style={{ marginTop: '8px', color: '#FED208', fontWeight: 'bold' }}>⚠️ Формат: только доменное имя, без :* или протокола (например: localhost, не localhost:3000 или http://localhost)</li>
                    <li style={{ marginTop: '12px', color: '#f44336', fontWeight: 'bold' }}>🔴 КРИТИЧНО: Тайлы загружаются с домена vec*.maps.yandex.net, НЕ api-maps.yandex.ru</li>
                    <li style={{ marginTop: '8px', color: '#FED208' }}>В Network tab ищите запросы к:</li>
                    <Box component="ul" sx={{ mt: 0.5, pl: 3, mb: 1 }}>
                      <li>vec01.maps.yandex.net</li>
                      <li>vec02.maps.yandex.net</li>
                      <li>vec03.maps.yandex.net</li>
                      <li>или другие vec*.maps.yandex.net</li>
                    </Box>
                    <li style={{ marginTop: '8px' }}>Если эти запросы блокируются (403/401) или их вообще нет, API ключ не имеет доступа к тайлам</li>
                  </Box>
                  <Typography variant="body2" sx={{ fontSize: '0.875rem', mt: 2, p: 2, backgroundColor: '#1a1a1a', borderRadius: '4px', border: '1px solid #FED208' }}>
                    <strong style={{ color: '#FED208' }}>Текущая диагностика:</strong><br/>
                    ✅ Контейнер карты создан<br/>
                    ✅ Структура карты найдена (89 элементов)<br/>
                    ✅ Контейнер тайлов найден (ground-pane)<br/>
                    ❌ Изображения тайлов: <strong style={{ color: '#f44336' }}>0 штук</strong><br/>
                    <br/>
                    <strong style={{ color: '#FED208' }}>Важно:</strong> Тайлы Yandex Maps загружаются с домена <code style={{ color: '#FED208', backgroundColor: '#2a2a2a', padding: '2px 4px' }}>vec*.maps.yandex.net</code>, а не api-maps.yandex.ru<br/>
                    <br/>
                    <strong>Проверьте в Network tab:</strong><br/>
                    1. Фильтруйте по "maps.yandex.net" или "vec"<br/>
                    2. Ищите запросы к vec01.maps.yandex.net, vec02.maps.yandex.net и т.д.<br/>
                    3. Если их нет вообще - API ключ не запрашивает тайлы<br/>
                    4. Если есть ошибки 403/401 - API ключ блокирует загрузку тайлов<br/>
                    <br/>
                    <strong style={{ color: '#f44336' }}>Решение:</strong> В Yandex Developer Dashboard убедитесь, что API ключ имеет доступ к загрузке тайлов карты (не только JavaScript API, но и тайлы)
                  </Typography>
                </Alert>
              ) : (
                <>
                  <Box sx={{ position: 'relative', width: '100%', height: '400px' }}>
                    <Box
                      ref={mapRef}
                      id="yandex-map-container"
                      sx={{
                        height: '100%',
                        width: '100%',
                        borderRadius: '8px',
                        backgroundColor: '#fff',
                        position: 'relative',
                        border: '2px solid #FED208',
                        zIndex: 1,
                        overflow: 'visible',
                      }}
                    />
                    {loadingMap && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          color: '#000',
                          backgroundColor: 'rgba(254, 210, 8, 0.8)',
                          padding: '12px 24px',
                          borderRadius: '8px',
                          zIndex: 2,
                          fontWeight: 'bold',
                        }}
                      >
                        Loading map...
                      </Box>
                    )}
                  </Box>
                </>
              )}
            </Paper>
          </Box>

          {/* Delivery Information */}
          <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 33.33%' } }}>
            <Paper
              sx={{
                p: 3,
                backgroundColor: '#2a2a2a',
                border: '1px solid #444',
              }}
            >
              <Typography
                variant="h6"
                sx={{ color: '#FED208', mb: 2, fontWeight: 'bold' }}
              >
                Адреса доставки
              </Typography>
              <Divider sx={{ mb: 3, borderColor: '#444' }} />

              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel
                  sx={{
                    color: '#aaa',
                    '&.Mui-focused': {
                      color: '#FED208',
                    },
                  }}
                >
                  Склад отгрузки
                </InputLabel>
                <Select
                  value={selectedWarehouse}
                  onChange={(e) => setSelectedWarehouse(e.target.value)}
                  label="Склад отгрузки"
                  sx={{
                    color: '#fff',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#555',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#FED208',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#FED208',
                    },
                    '& .MuiSvgIcon-root': {
                      color: '#FED208',
                    },
                  }}
                >
                  {user?.warehouses && user.warehouses.length > 0 ? (
                    user.warehouses.map((warehouse, index) => {
                      const address = typeof warehouse === 'string' 
                        ? warehouse 
                        : warehouse.address || '';
                      return (
                        <MenuItem key={index} value={address}>
                          {address}
                        </MenuItem>
                      );
                    })
                  ) : (
                    <MenuItem value="">Нет доступных складов</MenuItem>
                  )}
                </Select>
              </FormControl>

              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel
                  sx={{
                    color: '#aaa',
                    '&.Mui-focused': {
                      color: '#FED208',
                    },
                  }}
                >
                  Адрес назначения
                </InputLabel>
                <Select
                  value={destinationAddress}
                  onChange={(e) => setDestinationAddress(e.target.value)}
                  label="Адрес назначения"
                  sx={{
                    color: '#fff',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#555',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#FED208',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#FED208',
                    },
                    '& .MuiSvgIcon-root': {
                      color: '#FED208',
                    },
                  }}
                >
                  <MenuItem value={productData.warehouseAddress}>
                    {productData.warehouseAddress || 'Адрес из данных'}
                  </MenuItem>
                </Select>
              </FormControl>

              <Button
                variant="contained"
                fullWidth
                sx={{
                  backgroundColor: '#FED208',
                  color: '#000',
                  fontWeight: 'bold',
                  py: 1.5,
                  '&:hover': {
                    backgroundColor: '#e6bd07',
                  },
                }}
              >
                Оформить заказ
              </Button>
            </Paper>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default ProductDetails;
