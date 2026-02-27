import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  IconButton,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useChart } from '../contexts/ChartContext';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { geocodeAddress, getRouteWithWaypoints } from '../services/mapboxService';
import './ProductDetails.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

const parsePrice = (str: string): number => {
  const cleaned = String(str || '').replace(/\s/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
};

const Cart: React.FC = () => {
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.auth.user);
  const { items, updateQuantity, removeFromChart } = useChart();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  const [warehouseOrder, setWarehouseOrder] = useState<string[]>([]);
  const [loadingMap, setLoadingMap] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const userWarehouseAddresses = useMemo(() => {
    return (user?.warehouses || []).map((wh) =>
      typeof wh === 'string' ? wh : (wh as { address?: string }).address || ''
    ).filter((a) => a?.trim());
  }, [user?.warehouses]);

  const [selectedDestination, setSelectedDestination] = useState<string>('');
  const destinationAddress = selectedDestination?.trim() || null;

  useEffect(() => {
    if (userWarehouseAddresses.length > 0 && !selectedDestination) {
      setSelectedDestination(userWarehouseAddresses[0]);
    }
  }, [userWarehouseAddresses, selectedDestination]);

  // Initialize warehouse order from cart items only (no destination)
  useEffect(() => {
    const seen = new Set<string>();
    const warehouses: string[] = [];
    items.forEach((item) => {
      const addr = item.row.warehouseAddress?.trim() || '';
      if (addr && !seen.has(addr)) {
        seen.add(addr);
        warehouses.push(addr);
      }
    });
    setWarehouseOrder(warehouses);
  }, [items]);

  const totalPrice = useMemo(() => {
    return items.reduce((sum, item) => {
      const rowQty = parseFloat(String(item.row.quantity || '1').replace(/\s/g, '')) || 1;
      const cost = parsePrice(item.row.cost || '0');
      const pricePerUnit = rowQty > 0 ? cost / rowQty : cost;
      return sum + pricePerUnit * item.quantity;
    }, 0);
  }, [items]);

  const [deliveryPrice] = useState(() => Math.round(500 + Math.random() * 3000));

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [37.6173, 55.7558],
      zoom: 10,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.on('load', () => setLoadingMap(false));
    map.on('error', () => {
      setMapError('Ошибка загрузки карты');
      setLoadingMap(false);
    });
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Load route when warehouse order or destination changes
  useEffect(() => {
    const routeAddresses = destinationAddress
      ? [...warehouseOrder, destinationAddress]
      : warehouseOrder;
    if (routeAddresses.length < 2 || !mapRef.current) return;

    const loadRoute = async () => {
      setLoadingMap(true);
      setMapError(null);

      try {
        const coords: [number, number][] = [];
        for (const addr of routeAddresses) {
          const c = await geocodeAddress(addr);
          if (c) coords.push(c);
        }

        if (coords.length < 2) {
          setMapError('Не удалось найти координаты для адресов');
          setLoadingMap(false);
          return;
        }

        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];

        const map = mapRef.current;
        if (!map) {
          setLoadingMap(false);
          return;
        }
        if (map.getLayer('route')) map.removeLayer('route');
        if (map.getSource('route')) map.removeSource('route');

        const routeData = await getRouteWithWaypoints(coords);

        if (routeData && map) {
          map.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: routeData.geometry,
              properties: {},
            },
          });
          map.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': '#FED208',
              'line-width': 6,
              'line-opacity': 0.9,
            },
          });

          coords.forEach((coord, i) => {
            const isFirst = i === 0;
            const isLast = i === coords.length - 1;
            const el = document.createElement('div');
            el.className = 'cart-route-marker';
            el.textContent = String(i + 1);
            if (isFirst) el.classList.add('cart-route-marker-start');
            else if (isLast) el.classList.add('cart-route-marker-destination');
            else el.classList.add('cart-route-marker-waypoint');
            const marker = new mapboxgl.Marker({ element: el })
              .setLngLat(coord)
              .addTo(map);
            el.title = isLast ? `Назначение (${i + 1})` : `Точка ${i + 1}`;
            markersRef.current.push(marker);
          });

          const bounds = new mapboxgl.LngLatBounds();
          coords.forEach((c) => bounds.extend(c));
          map.fitBounds(bounds, { padding: { top: 50, bottom: 50, left: 50, right: 50 }, duration: 1000 });
        }
      } catch {
        setMapError('Ошибка построения маршрута');
      }
      setLoadingMap(false);
    };

    const t = setTimeout(loadRoute, 500);
    return () => clearTimeout(t);
  }, [warehouseOrder, destinationAddress]);

  const handleDragStart = (index: number) => setDraggedIndex(index);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (targetIndex: number) => {
    if (draggedIndex === null) return;
    setWarehouseOrder((prev) => {
      const arr = [...prev];
      const [removed] = arr.splice(draggedIndex, 1);
      arr.splice(targetIndex, 0, removed);
      return arr;
    });
    setDraggedIndex(null);
  };

  if (items.length === 0) {
    return (
      <Box className="product-details-container">
        <Container maxWidth="lg" className="product-details-content">
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/marketplace')} className="product-details-back-button">
            Назад
          </Button>
          <Typography variant="h5" sx={{ color: '#fff', mt: 2 }}>
            Корзина пуста
          </Typography>
        </Container>
      </Box>
    );
  }

  return (
    <Box className="product-details-container">
      <Container maxWidth="lg" className="product-details-content">
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/marketplace')} className="product-details-back-button">
          Назад к списку
        </Button>

        <Typography variant="h4" component="h1" className="product-details-title">
          Корзина
        </Typography>

        <Box className="product-details-content-box">
          <Box className="product-details-left-box">
            <Paper className="product-details-paper">
              <Typography variant="h5" className="product-details-section-title">
                Товары в корзине
              </Typography>
              <Divider sx={{ borderColor: 'rgba(254,210,8,0.3)', mb: 2 }} />
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: '#FED208', fontWeight: 700 }}>Наименование подкласса</TableCell>
                      <TableCell sx={{ color: '#FED208', fontWeight: 700 }}>Ед. измерения</TableCell>
                      <TableCell sx={{ color: '#FED208', fontWeight: 700 }}>Количество</TableCell>
                      <TableCell sx={{ color: '#FED208', fontWeight: 700 }}>Цена, руб</TableCell>
                      <TableCell align="right" sx={{ color: '#FED208', fontWeight: 700 }} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((item) => {
                      const rowQty = parseFloat(String(item.row.quantity || '1').replace(/\s/g, '')) || 1;
                      const cost = parsePrice(item.row.cost || '0');
                      const pricePerUnit = rowQty > 0 ? cost / rowQty : cost;
                      const itemTotal = pricePerUnit * item.quantity;
                      return (
                        <TableRow key={item.id}>
                          <TableCell sx={{ color: '#fff' }}>{item.row.subclassName || item.row.materialName || '-'}</TableCell>
                          <TableCell sx={{ color: '#fff' }}>{item.row.unit || '-'}</TableCell>
                          <TableCell sx={{ color: '#fff' }}>
                            <TextField
                              type="number"
                              size="small"
                              value={item.quantity}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                if (!isNaN(v) && v >= 0) updateQuantity(item.id, v);
                              }}
                              inputProps={{ min: 0, step: 0.001 }}
                              sx={{ width: 90, '& .MuiOutlinedInput-root': { color: '#fff' } }}
                            />
                          </TableCell>
                          <TableCell sx={{ color: '#fff' }}>{itemTotal.toFixed(2)}</TableCell>
                          <TableCell align="right">
                            <IconButton size="small" onClick={() => removeFromChart(item.id)} sx={{ color: '#FED208' }}>
                              <DeleteOutlineIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>

            <Paper className="product-details-paper" sx={{ mt: 2 }}>
              <Typography variant="h6" className="product-details-section-title">
                Порядок маршрута
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 1 }}>
                Перетащите для изменения порядка
              </Typography>
              <Divider sx={{ borderColor: 'rgba(254,210,8,0.3)', mb: 2 }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {warehouseOrder.map((addr, idx) => (
                  <Box
                    key={`${addr}-${idx}`}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(idx)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      p: 1,
                      borderRadius: 1,
                      bgcolor: draggedIndex === idx ? 'rgba(254,210,8,0.2)' : 'rgba(255,255,255,0.05)',
                      cursor: 'grab',
                      border: '1px solid rgba(254,210,8,0.2)',
                    }}
                  >
                    <DragIndicatorIcon sx={{ color: '#FED208', cursor: 'grab' }} />
                    <Typography variant="body2" sx={{ color: '#fff', flex: 1 }} noWrap title={addr}>
                      {idx + 1}. {addr}
                    </Typography>
                  </Box>
                ))}
                <Box sx={{ mt: 3 }}>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 1.5 }}>
                    Адрес назначения (куда)
                  </Typography>
                  <FormControl fullWidth className="product-details-form-control">
                    <InputLabel className="product-details-form-control-label">
                      Выберите склад
                    </InputLabel>
                    <Select
                      value={selectedDestination}
                      onChange={(e) => setSelectedDestination(e.target.value)}
                      label="Выберите склад"
                      className="product-details-select"
                    >
                      {userWarehouseAddresses.length > 0 ? (
                        userWarehouseAddresses.map((addr, index) => (
                          <MenuItem key={index} value={addr}>
                            {addr}
                          </MenuItem>
                        ))
                      ) : (
                        <MenuItem value="">Нет доступных складов</MenuItem>
                      )}
                    </Select>
                  </FormControl>
                </Box>
              </Box>
            </Paper>

            <Paper className="product-details-paper map-paper" sx={{ mt: 2 }}>
              <Typography variant="h5" className="product-details-section-title">
                Маршрут на карте
              </Typography>
              <Divider sx={{ borderColor: 'rgba(254,210,8,0.3)', mb: 2 }} />
              <Box className="product-details-map-container">
                <Box ref={mapContainerRef} className="product-details-map-box" />
                {loadingMap && (
                  <Box className="product-details-map-loading">Загрузка карты...</Box>
                )}
                {mapError && (
                  <Typography sx={{ color: '#f44336', p: 2 }}>{mapError}</Typography>
                )}
              </Box>
            </Paper>
          </Box>

          <Box className="product-details-right-box">
            <Paper className="product-details-paper">
              <Typography variant="h6" className="product-details-section-title">
                Итого
              </Typography>
              <Divider sx={{ borderColor: 'rgba(254,210,8,0.3)', my: 2 }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ color: '#fff' }}>Стоимость товаров:</Typography>
                  <Typography sx={{ color: '#FED208', fontWeight: 700 }}>{totalPrice.toFixed(2)} ₽</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ color: '#fff' }}>Доставка:</Typography>
                  <Typography sx={{ color: '#FED208', fontWeight: 700 }}>{deliveryPrice.toFixed(2)} ₽</Typography>
                </Box>
                <Divider sx={{ borderColor: 'rgba(254,210,8,0.3)' }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ color: '#fff', fontWeight: 700 }}>Всего:</Typography>
                  <Typography sx={{ color: '#FED208', fontWeight: 700, fontSize: '1.25rem' }}>
                    {(totalPrice + deliveryPrice).toFixed(2)} ₽
                  </Typography>
                </Box>
              </Box>
              <Button variant="contained" fullWidth className="product-details-order-button" sx={{ mt: 3 }}>
                Оформить заказ
              </Button>
            </Paper>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default Cart;
