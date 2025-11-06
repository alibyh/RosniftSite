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
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { InventoryRow } from '../utils/csvParser';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { geocodeAddress, getRoute, calculateStraightLineDistance } from '../services/mapboxService';

// Set Mapbox access token (you'll need to get this from https://account.mapbox.com/access-tokens/)
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1IjoiYWxpYnloNzkiLCJhIjoiY21oa3JmMjE1MWphdDJqcXFzYWRiM2pwNSJ9.eTeDf44PmOr7DFpeMzSHXQ';

// ============================================
// MAPBOX VERSION - NOT YANDEX - VERSION 2.0
// ============================================
console.log('🗺️✅✅✅ MAPBOX VERSION LOADED - NOT YANDEX ✅✅✅');
console.log('If you see Yandex, your browser is using CACHED code!');

const ProductDetails: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSelector((state: RootState) => state.auth.user);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  
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

  // Initialize Mapbox Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Check if Mapbox access token is configured
    if (mapboxgl.accessToken === 'YOUR_MAPBOX_ACCESS_TOKEN') {
      setMapError('Mapbox access token не настроен. Пожалуйста, добавьте ваш токен в src/services/mapboxService.ts');
      setLoadingMap(false);
      return;
    }

    // Initialize map
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12', // You can change this to other styles
      center: [37.6173, 55.7558], // Default to Moscow
      zoom: 10,
    });

    mapRef.current = map;

    // Add navigation controls
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Wait for map to load
    map.on('load', () => {
      console.log('✅ Mapbox map loaded successfully');
      setLoadingMap(false);
      setMapError(null);
    });

    map.on('error', (e) => {
      console.error('Mapbox map error:', e);
      setMapError('Ошибка загрузки карты Mapbox');
      setLoadingMap(false);
    });

    // Cleanup
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Load route when addresses change
  useEffect(() => {
    let isMounted = true;

    const loadRoute = async () => {
      if (!selectedWarehouse || !destinationAddress || !mapRef.current) {
        if (isMounted) {
          setLoadingMap(false);
        }
        return;
      }

      if (isMounted) {
        setLoadingMap(true);
        setDistance(null);
        setMapError(null);
      }

      try {
        console.log('📍 Geocoding addresses:', { selectedWarehouse, destinationAddress });
        
        // Check if addresses are the same (case-insensitive, trimmed)
        const addressesAreSame = selectedWarehouse.trim().toLowerCase() === destinationAddress.trim().toLowerCase();
        if (addressesAreSame) {
          console.log('📍 Same address detected - distance will be 0');
          if (isMounted) {
            setDistance(0);
            setLoadingMap(false);
            setMapError(null);
          }
          return;
        }
        
        // Geocode both addresses
        // Origin = product warehouse (where seller ships FROM)
        // Destination = user's warehouse (where they deliver TO)
        const origin = await geocodeAddress(destinationAddress);
        const destination = await geocodeAddress(selectedWarehouse);
        
        console.log('Geocoding results:', { origin, destination });

        if (!origin || !destination) {
          if (isMounted) {
            setMapError('Не удалось найти координаты для одного или обоих адресов');
            setLoadingMap(false);
          }
          return;
        }
        
        // Check if coordinates are the same (within 10 meters)
        const straightLineDistance = calculateStraightLineDistance(origin, destination);
        if (straightLineDistance < 0.01) { // Less than 10 meters
          console.log('📍 Coordinates are essentially the same (< 10m apart)');
          if (isMounted) {
            setDistance(0);
            setLoadingMap(false);
            setMapError(null);
          }
          return;
        }

        if (!mapRef.current) return;

        const map = mapRef.current;

        // Remove existing markers and route
        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = [];

        // Wait for map to be fully loaded before manipulating layers
        if (!map.loaded()) {
          console.log('📍 Waiting for map to load...');
          await new Promise<void>((resolve) => {
            if (map.loaded()) {
              resolve();
            } else {
              map.once('load', () => resolve());
            }
          });
        }

        // Remove existing route layer if it exists
        if (map.getLayer('route')) {
          map.removeLayer('route');
        }
        if (map.getSource('route')) {
          map.removeSource('route');
        }

        // Get route
        console.log('📍 Calculating route...');
        const routeData = await getRoute(origin, destination);

        if (!routeData) {
          if (isMounted) {
            setMapError('Не удалось построить маршрут');
            setLoadingMap(false);
          }
          return;
        }

        // Calculate distance in kilometers
        const distanceKm = Math.round((routeData.distance / 1000) * 10) / 10;
        if (isMounted) {
          setDistance(distanceKm);
        }

        // Ensure map is still loaded before adding layers
        if (!map.loaded()) {
          console.warn('📍 Map unloaded during route calculation, waiting...');
          await new Promise<void>((resolve) => {
            if (map.loaded()) {
              resolve();
            } else {
              map.once('load', () => resolve());
            }
          });
        }

        // Add route to map
        try {
          if (map.getSource('route')) {
            (map.getSource('route') as mapboxgl.GeoJSONSource).setData({
              type: 'Feature',
              geometry: routeData.geometry,
              properties: {}
            });
          } else {
            map.addSource('route', {
              type: 'geojson',
              data: {
                type: 'Feature',
                geometry: routeData.geometry,
                properties: {}
              }
            });

            map.addLayer({
              id: 'route',
              type: 'line',
              source: 'route',
              layout: {
                'line-join': 'round',
                'line-cap': 'round'
              },
              paint: {
                'line-color': '#FED208',
                'line-width': 6,
                'line-opacity': 0.9
              }
            });
          }
        } catch (error: any) {
          console.error('Error adding route layer:', error);
          // If adding layer fails, try to add source first
          if (error.message?.includes('Style is not done loading') || 
              error.message?.includes('getOwnSource')) {
            // Wait a bit and retry
            await new Promise(resolve => setTimeout(resolve, 500));
            if (map.loaded() && !map.getSource('route')) {
              try {
                map.addSource('route', {
                  type: 'geojson',
                  data: {
                    type: 'Feature',
                    geometry: routeData.geometry,
                    properties: {}
                  }
                });

                map.addLayer({
                  id: 'route',
                  type: 'line',
                  source: 'route',
                  layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                  },
                  paint: {
                    'line-color': '#FED208',
                    'line-width': 6,
                    'line-opacity': 0.9
                  }
                });
              } catch (retryError) {
                console.error('Retry failed:', retryError);
              }
            }
          }
        }

        // Add markers for origin and destination
        try {
          // Add origin marker (product warehouse - where seller ships FROM)
          const originMarker = new mapboxgl.Marker({ color: '#4CAF50' })
            .setLngLat(origin)
            .addTo(map);
          markersRef.current.push(originMarker);

          // Add destination marker (user's warehouse - where they deliver TO)
          const destMarker = new mapboxgl.Marker({ color: '#F44336' })
            .setLngLat(destination)
            .addTo(map);
          markersRef.current.push(destMarker);
        } catch (markerError) {
          console.error('Error adding markers:', markerError);
        }

        // Fit map to show both markers and route
        const bounds = new mapboxgl.LngLatBounds();
        bounds.extend(origin);
        bounds.extend(destination);
        map.fitBounds(bounds, {
          padding: { top: 50, bottom: 50, left: 50, right: 50 },
          duration: 1000
        });

        console.log('✅ Route loaded successfully, distance:', distanceKm, 'km');
        if (isMounted) {
          setLoadingMap(false);
        }
      } catch (error: any) {
        console.error('Error loading route:', error);
        if (isMounted) {
          setMapError(`Ошибка при загрузке маршрута: ${error?.message || 'Неизвестная ошибка'}`);
          setLoadingMap(false);
        }
      }
    };

    // Wait a bit for map to initialize
    const timer = setTimeout(() => {
      if (mapRef.current) {
        loadRoute();
      }
    }, 500);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      // Clean up markers
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
    };
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
          <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 50%' } }}>
            <Paper
              sx={{
                p: 3,
                backgroundColor: '#2a2a2a',
                border: '1px solid #444',
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
          </Box>

          {/* Right Side: Map and Delivery Information */}
          <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 50%' }, display: 'flex', flexDirection: 'column', gap: 3 }}>
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
                    {mapError}
                  </Typography>
                  {mapError.includes('token') && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        Чтобы использовать Mapbox, вам нужно:
                      </Typography>
                      <ol style={{ marginLeft: '20px', fontSize: '0.875rem' }}>
                        <li>Зарегистрируйтесь на <a href="https://account.mapbox.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#FED208' }}>Mapbox</a></li>
                        <li>Создайте бесплатный access token</li>
                        <li>Добавьте токен в файл <code style={{ color: '#FED208', backgroundColor: '#1a1a1a', padding: '2px 4px' }}>src/services/mapboxService.ts</code></li>
                        <li>Также добавьте переменную окружения <code style={{ color: '#FED208', backgroundColor: '#1a1a1a', padding: '2px 4px' }}>VITE_MAPBOX_ACCESS_TOKEN</code> в файл <code style={{ color: '#FED208', backgroundColor: '#1a1a1a', padding: '2px 4px' }}>.env</code></li>
                      </ol>
                    </Box>
                  )}
                </Alert>
              ) : (
                <>
                  <Box sx={{ position: 'relative', width: '100%', height: '400px' }}>
                    <Box
                      ref={mapContainerRef}
                      sx={{
                        height: '100%',
                        width: '100%',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        border: '2px solid #FED208',
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
                        Загрузка карты...
                      </Box>
                    )}
                  </Box>
                </>
              )}
            </Paper>

            {/* Delivery Information */}
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
                  Склад отгрузки (откуда)
                </InputLabel>
                <Select
                  value={destinationAddress}
                  onChange={(e) => setDestinationAddress(e.target.value)}
                  label="Склад отгрузки (откуда)"
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

              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel
                  sx={{
                    color: '#aaa',
                    '&.Mui-focused': {
                      color: '#FED208',
                    },
                  }}
                >
                  Адрес назначения (куда)
                </InputLabel>
                <Select
                  value={selectedWarehouse}
                  onChange={(e) => setSelectedWarehouse(e.target.value)}
                  label="Адрес назначения (куда)"
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
