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
import { MappedInventoryRow } from '../services/inventoryService';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { geocodeAddress, getRoute, calculateStraightLineDistance } from '../services/mapboxService';
import './ProductDetails.css';

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
  const productData = location.state?.product as MappedInventoryRow | null;

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
      <Container maxWidth="lg" className="product-details-error-container">
        <Alert severity="error">Продукт не найден</Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/marketplace')}
          className="product-details-error-back-button"
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
    <Box className="product-details-container">
      <Container maxWidth="lg" className="product-details-content">
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
          className="product-details-back-button"
        >
          Назад к списку
        </Button>

        <Typography variant="h4" component="h1" className="product-details-title">
          Информация о продукте
        </Typography>

        <Box className="product-details-content-box">
          {/* Product Information */}
          <Box className="product-details-left-box">
            <Paper className="product-details-paper">
              <Typography variant="h5" className="product-details-section-title">
                Основная информация
              </Typography>
              <Divider className="product-details-divider" style={{ marginBottom: '16px' }} />

              <TableContainer>
                <Table className="product-details-table">
                  <TableBody>
                    <TableRow>
                      <TableCell className="product-details-table-cell-label">
                        БЕ (Балансовая единица)
                      </TableCell>
                      <TableCell>{productData.balanceUnit || '-'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="product-details-table-cell-label">
                        Наименование дочернего Общества
                      </TableCell>
                      <TableCell>{productData.companyName || '-'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="product-details-table-cell-label">
                        Филиал Общества
                      </TableCell>
                      <TableCell>{productData.branch || '-'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="product-details-table-cell-label">
                        Адрес склада
                      </TableCell>
                      <TableCell>{productData.warehouseAddress || '-'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="product-details-table-cell-label">
                        Класс МТР
                      </TableCell>
                      <TableCell>{productData.materialClass || '-'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="product-details-table-cell-label">
                        Наименование класса
                      </TableCell>
                      <TableCell>{productData.className || '-'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="product-details-table-cell-label">
                        Подкласс МТР
                      </TableCell>
                      <TableCell>{productData.materialSubclass || '-'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="product-details-table-cell-label">
                        Наименование подкласса
                      </TableCell>
                      <TableCell>{productData.subclassName || '-'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="product-details-table-cell-label">
                        КСМ (код материала)
                      </TableCell>
                      <TableCell>{productData.materialCode || '-'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="product-details-table-cell-label">
                        Наименование материала
                      </TableCell>
                      <TableCell>{productData.materialName || '-'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="product-details-table-cell-label">
                        Единица измерения
                      </TableCell>
                      <TableCell>{productData.unit || '-'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="product-details-table-cell-label">
                        Количество
                      </TableCell>
                      <TableCell>{productData.quantity || '-'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="product-details-table-cell-label">
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
          <Box className="product-details-right-box">
            {/* Map Section */}
            <Paper className="product-details-paper map-paper">
              <Typography variant="h5" className="product-details-section-title">
                Маршрут доставки
              </Typography>
              {distance !== null && (
                <Typography variant="h6" className="product-details-distance-badge">
                  Расстояние: {distance} км
                </Typography>
              )}
              <Divider className="product-details-divider" style={{ marginBottom: '16px' }} />
              {mapError ? (
                <Alert severity="error" className="product-details-alert">
                  <Typography variant="body2" style={{ marginBottom: '8px', fontWeight: 'bold' }}>
                    {mapError}
                  </Typography>
                  {mapError.includes('token') && (
                    <Box style={{ marginTop: '16px' }}>
                      <Typography variant="body2" style={{ marginBottom: '8px' }}>
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
                  <Box className="product-details-map-container">
                    <Box ref={mapContainerRef} className="product-details-map-box" />
                    {loadingMap && (
                      <Box className="product-details-map-loading">
                        Загрузка карты...
                      </Box>
                    )}
                  </Box>
                </>
              )}
            </Paper>

            {/* Delivery Information */}
            <Paper className="product-details-paper">
              <Typography variant="h6" className="product-details-section-title">
                Адреса доставки
              </Typography>
              <Divider className="product-details-divider" style={{ marginBottom: '24px' }} />

              <FormControl fullWidth className="product-details-form-control">
                <InputLabel className="product-details-form-control-label">
                  Склад отгрузки (откуда)
                </InputLabel>
                <Select
                  value={destinationAddress}
                  onChange={(e) => setDestinationAddress(e.target.value)}
                  label="Склад отгрузки (откуда)"
                  className="product-details-select"
                >
                  <MenuItem value={productData.warehouseAddress}>
                    {productData.warehouseAddress || 'Адрес из данных'}
                  </MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth className="product-details-form-control">
                <InputLabel className="product-details-form-control-label">
                  Адрес назначения (куда)
                </InputLabel>
                <Select
                  value={selectedWarehouse}
                  onChange={(e) => setSelectedWarehouse(e.target.value)}
                  label="Адрес назначения (куда)"
                  className="product-details-select"
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

              <Button variant="contained" fullWidth className="product-details-order-button">
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
