import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
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
import { useChart, ChartItem } from '../contexts/ChartContext';
import { useChat } from '../contexts/ChatContext';

interface OrderSnapshot {
  items: ChartItem[];
  destination: string;
  totalPrice: number;
  deliveryPrice: number;
  successText: string;
}
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { geocodeAddress, getRouteWithWaypoints } from '../services/mapboxService';
import { inventoryService } from '../services/inventoryService';
import { orderService, mapCartItemsToOrderPayload } from '../services/orderService';
import { parseDecimalStr, sanitizeQuantityInput, formatForDisplay } from '../utils/numberUtils';
import { legDeliveryCostRub, effectiveWeightTons, getDeliveryRate } from '../utils/deliveryCalculation';
import { useDeliveryRates } from '../contexts/DeliveryRatesContext';
import './ProductDetails.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

const parsePrice = (str: string): number => {
  return parseDecimalStr(str) || 0;
};

const Cart: React.FC = () => {
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.auth.user);
  const { items, updateQuantity, updateTons, removeFromChart, clearChart } = useChart();
  const { openConversation } = useChat();
  const { getRatesForBe } = useDeliveryRates();
  const rates = useMemo(
    () => getRatesForBe(user?.companyId || ''),
    [getRatesForBe, user?.companyId]
  );
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  const [warehouseOrder, setWarehouseOrder] = useState<string[]>([]);
  const [routeLegDistancesKm, setRouteLegDistancesKm] = useState<number[]>([]);
  const [loadingMap, setLoadingMap] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const userWarehouseAddresses = useMemo(() => {
    return (user?.warehouses || []).map((wh) =>
      typeof wh === 'string' ? wh : (wh as { address?: string }).address || ''
    ).filter((a) => a?.trim());
  }, [user?.warehouses]);

  const [inventoryWarehouses, setInventoryWarehouses] = useState<string[]>([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);

  const deliveryWarehouseOptions = useMemo(() => {
    if (userWarehouseAddresses.length > 0) return userWarehouseAddresses;
    return inventoryWarehouses;
  }, [userWarehouseAddresses, inventoryWarehouses]);

  const [selectedDestination, setSelectedDestination] = useState<string>('');
  const destinationAddress = selectedDestination?.trim() || null;
  const [qtyEditing, setQtyEditing] = useState<{ id: string; value: string } | null>(null);
  const [tonsEditing, setTonsEditing] = useState<{ id: string; value: string } | null>(null);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [lastOrder, setLastOrder] = useState<OrderSnapshot | null>(null);

  useEffect(() => {
    if (userWarehouseAddresses.length > 0) {
      if (!selectedDestination || !userWarehouseAddresses.includes(selectedDestination)) {
        setSelectedDestination(userWarehouseAddresses[0]);
      }
    }
  }, [userWarehouseAddresses, selectedDestination]);

  useEffect(() => {
    if (inventoryWarehouses.length > 0 && (!selectedDestination || !inventoryWarehouses.includes(selectedDestination))) {
      setSelectedDestination(inventoryWarehouses[0]);
    }
  }, [inventoryWarehouses]);

  useEffect(() => {
    if (userWarehouseAddresses.length > 0) {
      setInventoryWarehouses([]);
      return;
    }
    const companyId = (user as { companyId?: string })?.companyId?.trim();
    if (!companyId) {
      setInventoryWarehouses([]);
      return;
    }
    let cancelled = false;
    setLoadingWarehouses(true);
    inventoryService.getWarehouseAddressesByCompanyId(companyId).then((addrs) => {
      if (!cancelled) {
        setInventoryWarehouses(addrs);
        setSelectedDestination((prev) => (prev ? prev : addrs[0] ?? ''));
      }
      setLoadingWarehouses(false);
    });
    return () => { cancelled = true; };
  }, [user?.companyId, userWarehouseAddresses.length]);

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
      const rowQty = parseDecimalStr(String(item.row.quantity || '1')) || 1;
      const cost = parsePrice(item.row.cost || '0');
      const pricePerUnit = rowQty > 0 ? cost / rowQty : cost;
      return sum + pricePerUnit * item.quantity;
    }, 0);
  }, [items]);

  /**
   * Per-leg delivery details.
   * For leg i: cumulative weight, effective weight (для тарифа), rate, cost.
   */
  const routeLegDetails = useMemo((): Array<{ cumTons: number; effectiveTons: number; rate: number; cost: number }> => {
    if (routeLegDistancesKm.length === 0) return [];
    const tonsForItem = (item: (typeof items)[0]) => {
      const u = (item.row.unit || '').trim().toLowerCase();
      const isTon = /^(т|тонн|тонна|тонны|t|ton|tonne)s?$/.test(u);
      return isTon ? item.quantity : (item.tons ?? 0);
    };
    return routeLegDistancesKm.map((distanceKm, legIndex) => {
      const warehousesSoFar = new Set(warehouseOrder.slice(0, legIndex + 1));
      const cumTons = items
        .filter((item) => warehousesSoFar.has((item.row.warehouseAddress || '').trim()))
        .reduce((sum, item) => sum + tonsForItem(item), 0);
      const effectiveTons = effectiveWeightTons(cumTons);
      const rate = cumTons > 0 ? getDeliveryRate(effectiveTons, distanceKm, rates) : 0;
      const cost = legDeliveryCostRub(cumTons, distanceKm, rates);
      return { cumTons, effectiveTons, rate, cost };
    });
  }, [items, warehouseOrder, routeLegDistancesKm, rates]);

  const routeLegCosts = useMemo(() => routeLegDetails.map((d) => d.cost), [routeLegDetails]);

  const deliveryPrice = useMemo(
    () => routeLegCosts.reduce((a, b) => a + b, 0),
    [routeLegCosts]
  );

  // Initialize Mapbox map
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
          setRouteLegDistancesKm(
            routeData.legs.map((leg) => Math.round((leg.distance / 1000) * 10) / 10)
          );
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
        } else {
          setRouteLegDistancesKm([]);
        }
      } catch {
        setMapError('Ошибка построения маршрута');
        setRouteLegDistancesKm([]);
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

  const handleSubmitOrder = async () => {
    if (!user) {
      setSubmitError('Пользователь не найден');
      return;
    }
    if (!destinationAddress) {
      setSubmitError('Выберите склад назначения');
      return;
    }
    if (!user.email?.trim()) {
      setSubmitError('В профиле отсутствует email. Выйдите из учётной записи и войдите снова.');
      return;
    }

    try {
      setSubmittingOrder(true);
      setSubmitError(null);
      setSubmitSuccess(null);

      const payloadItems = mapCartItemsToOrderPayload(items);
      const result = await orderService.submitOrder({
        requester: {
          id: user.id,
          fullName: user.fullName,
          email: user.email || '',
          companyId: user.companyId || '',
          companyName: user.company || '',
        },
        destinationWarehouse: destinationAddress,
        items: payloadItems,
      });

      const skippedText =
        result.skipped.length > 0
          ? ` Не отправлено для ${result.skipped.map((s) => s.balanceUnit).join(', ')}.`
          : '';

      const successText = `Заявка отправлена. Писем: ${result.sentCount}.${skippedText}`;
      setSubmitSuccess(successText);

      // Snapshot order details before clearing the cart
      setLastOrder({
        items: [...items],
        destination: destinationAddress ?? '',
        totalPrice,
        deliveryPrice,
        successText,
      });

      // Open one conversation per seller (grouped by balanceUnit)
      const buyerCompanyId = user.companyId || '';
      const companyName = user.company || '';
      const sellerGroups = new Map<string, typeof items>();
      items.forEach((item) => {
        const sellerId = item.row.balanceUnit || '';
        if (!sellerId) return;
        if (!sellerGroups.has(sellerId)) sellerGroups.set(sellerId, []);
        sellerGroups.get(sellerId)!.push(item);
      });
      for (const [sellerId, sellerItems] of sellerGroups) {
        const kcms = sellerItems.map((i) => i.row.materialCode || '').filter(Boolean);
        const title = [buyerCompanyId, companyName, ...kcms].join(', ');
        const participants = [...new Set([buyerCompanyId, sellerId].filter(Boolean))];
        if (title && participants.length > 0) {
          openConversation(title, participants);
        }
      }

      clearChart();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Ошибка отправки заявки');
    } finally {
      setSubmittingOrder(false);
    }
  };

  if (items.length === 0) {
    if (lastOrder) {
      // Group items by seller for display
      const sellerGroupsForDisplay = new Map<string, { companyName: string; items: ChartItem[] }>();
      lastOrder.items.forEach((item) => {
        const sellerId = item.row.balanceUnit || '—';
        if (!sellerGroupsForDisplay.has(sellerId)) {
          sellerGroupsForDisplay.set(sellerId, { companyName: item.row.companyName || sellerId, items: [] });
        }
        sellerGroupsForDisplay.get(sellerId)!.items.push(item);
      });

      return (
        <Box className="product-details-container">
          <Container maxWidth="lg" className="product-details-content">
            <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/marketplace')} className="product-details-back-button">
              Назад к торговой площадке
            </Button>
            <Typography variant="h4" component="h1" className="product-details-title" sx={{ mb: 1 }}>
              Заявка оформлена
            </Typography>
            <Alert severity="success" sx={{ mb: 3 }}>
              {lastOrder.successText}
            </Alert>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Items grouped by seller */}
              {Array.from(sellerGroupsForDisplay.entries()).map(([sellerId, group]) => (
                <Paper key={sellerId} className="product-details-paper">
                  <Typography variant="h6" className="product-details-section-title">
                    {group.companyName}
                  </Typography>
                  <Divider sx={{ borderColor: 'rgba(254,210,8,0.3)', mb: 2 }} />
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ color: '#FED208', fontWeight: 700 }}>Код КСМ</TableCell>
                          <TableCell sx={{ color: '#FED208', fontWeight: 700 }}>Наим. материала</TableCell>
                          <TableCell sx={{ color: '#FED208', fontWeight: 700 }}>ЕИ</TableCell>
                          <TableCell sx={{ color: '#FED208', fontWeight: 700 }}>Количество</TableCell>
                          <TableCell sx={{ color: '#FED208', fontWeight: 700 }}>Сумма, ₽</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {group.items.map((item) => {
                          const rowQty = parseDecimalStr(String(item.row.quantity || '1')) || 1;
                          const cost = parsePrice(item.row.cost || '0');
                          const pricePerUnit = rowQty > 0 ? cost / rowQty : cost;
                          const itemTotal = pricePerUnit * item.quantity;
                          return (
                            <TableRow key={item.id}>
                              <TableCell sx={{ color: '#fff' }}>{item.row.materialCode || '—'}</TableCell>
                              <TableCell sx={{ color: '#fff' }}>{item.row.materialName || '—'}</TableCell>
                              <TableCell sx={{ color: '#fff' }}>{item.row.unit || '—'}</TableCell>
                              <TableCell sx={{ color: '#fff' }}>{formatForDisplay(item.quantity, 3)}</TableCell>
                              <TableCell sx={{ color: '#FED208', fontWeight: 600 }}>{formatForDisplay(itemTotal, 2)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              ))}

              {/* Summary */}
              <Paper className="product-details-paper" sx={{ maxWidth: 480 }}>
                <Typography variant="h6" className="product-details-section-title">
                  Итого
                </Typography>
                <Divider sx={{ borderColor: 'rgba(254,210,8,0.3)', my: 2 }} />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography sx={{ color: 'rgba(255,255,255,0.8)' }}>Склад назначения:</Typography>
                    <Typography sx={{ color: '#fff', fontWeight: 600, ml: 2, textAlign: 'right' }}>
                      {lastOrder.destination}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography sx={{ color: 'rgba(255,255,255,0.8)' }}>Стоимость товаров:</Typography>
                    <Typography sx={{ color: '#FED208', fontWeight: 700 }}>
                      {formatForDisplay(lastOrder.totalPrice, 2)} ₽
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography sx={{ color: 'rgba(255,255,255,0.8)' }}>Доставка:</Typography>
                    <Typography sx={{ color: '#FED208', fontWeight: 700 }}>
                      {formatForDisplay(lastOrder.deliveryPrice, 2)} ₽
                    </Typography>
                  </Box>
                  <Divider sx={{ borderColor: 'rgba(254,210,8,0.3)' }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography sx={{ color: '#fff', fontWeight: 700 }}>Всего:</Typography>
                    <Typography sx={{ color: '#FED208', fontWeight: 700, fontSize: '1.2rem' }}>
                      {formatForDisplay(lastOrder.totalPrice + lastOrder.deliveryPrice, 2)} ₽
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Box>
          </Container>
        </Box>
      );
    }

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

        <Box className="product-details-content-box cart-page">
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
                      <TableCell sx={{ color: '#FED208', fontWeight: 700 }}>Наим. общества</TableCell>
                      <TableCell sx={{ color: '#FED208', fontWeight: 700 }}>Код КСМ</TableCell>
                      <TableCell sx={{ color: '#FED208', fontWeight: 700 }}>Наим. материала</TableCell>
                      <TableCell sx={{ color: '#FED208', fontWeight: 700 }}>ЕИ</TableCell>
                      <TableCell sx={{ color: '#FED208', fontWeight: 700 }}>Количество</TableCell>
                      <TableCell sx={{ color: '#FED208', fontWeight: 700 }} title="Вес в тоннах для расчёта доставки (для каждой позиции)">
                      Вес, тн
                    </TableCell>
                      <TableCell sx={{ color: '#FED208', fontWeight: 700, whiteSpace: 'nowrap' }}>Сумма</TableCell>
                      <TableCell align="right" sx={{ color: '#FED208', fontWeight: 700 }} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((item) => {
                      const rowQty = parseDecimalStr(String(item.row.quantity || '1')) || 1;
                      const cost = parsePrice(item.row.cost || '0');
                      const pricePerUnit = rowQty > 0 ? cost / rowQty : cost;
                      const itemTotal = pricePerUnit * item.quantity;
                      const maxQty = rowQty;
                      const unit = (item.row.unit || '').trim().toLowerCase();
                      const isUnitTon = /^(т|тонн|тонна|тонны|t|ton|tonne)s?$/.test(unit);
                      const displayQty = qtyEditing?.id === item.id ? qtyEditing.value : formatForDisplay(item.quantity, 3);
                      const displayTons = tonsEditing?.id === item.id
                        ? tonsEditing.value
                        : (isUnitTon ? formatForDisplay(item.quantity, 3) : (item.tons != null ? formatForDisplay(item.tons, 3) : ''));
                      return (
                        <TableRow key={item.id}>
                          <TableCell sx={{ color: '#fff' }}>{item.row.companyName || '-'}</TableCell>
                          <TableCell sx={{ color: '#fff' }}>{item.row.materialCode || '-'}</TableCell>
                          <TableCell sx={{ color: '#fff' }}>{item.row.materialName || '-'}</TableCell>
                          <TableCell sx={{ color: '#fff' }}>{item.row.unit || '-'}</TableCell>
                          <TableCell sx={{ color: '#fff' }}>
                            <TextField
                              type="text"
                              inputMode="decimal"
                              size="small"
                              value={displayQty}
                              onChange={(e) =>
                                setQtyEditing({ id: item.id, value: sanitizeQuantityInput(e.target.value) })
                              }
                              onBlur={() => {
                                const raw = qtyEditing?.id === item.id ? qtyEditing.value : String(item.quantity);
                                const parsed = parseDecimalStr(raw);
                                const valid = !isNaN(parsed) && parsed > 0;
                                const clamped = valid ? Math.min(parsed, maxQty) : Math.min(1, maxQty);
                                updateQuantity(item.id, clamped);
                                if (isUnitTon) updateTons(item.id, clamped);
                                setQtyEditing(null);
                              }}
                              onFocus={() => setQtyEditing({ id: item.id, value: sanitizeQuantityInput(String(item.quantity)) })}
                              inputProps={{ min: 0, step: 0.001 }}
                              sx={{
                                width: 90,
                                '& .MuiOutlinedInput-root': {
                                  color: '#fff',
                                  '& fieldset': { borderColor: '#fff' },
                                  '&:hover fieldset': { borderColor: '#fff' },
                                  '&.Mui-focused fieldset': { borderColor: '#fff' },
                                },
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ color: '#fff' }}>
                            {isUnitTon ? (
                              <TextField
                                size="small"
                                value={displayTons}
                                inputProps={{ readOnly: true }}
                                placeholder="т"
                                sx={{
                                  width: 80,
                                  '& .MuiOutlinedInput-root': {
                                    color: '#fff',
                                    '& fieldset': { borderColor: '#fff' },
                                    '& input': { cursor: 'default' },
                                  },
                                }}
                              />
                            ) : (
                              <TextField
                                type="text"
                                inputMode="decimal"
                                size="small"
                                value={displayTons}
                                onChange={(e) =>
                                  setTonsEditing({ id: item.id, value: sanitizeQuantityInput(e.target.value) })
                                }
                                onBlur={() => {
                                  const raw = tonsEditing?.id === item.id ? tonsEditing.value : String(item.tons ?? '');
                                  const parsed = parseDecimalStr(raw);
                                  const valid = !isNaN(parsed) && parsed >= 0;
                                  updateTons(item.id, valid ? parsed : 0);
                                  setTonsEditing(null);
                                }}
                                onFocus={() => setTonsEditing({ id: item.id, value: sanitizeQuantityInput(String(item.tons ?? '')) })}
                                placeholder="т"
                                inputProps={{ min: 0, step: 0.001 }}
                                sx={{
                                  width: 80,
                                  '& .MuiOutlinedInput-root': {
                                    color: '#fff',
                                    '& fieldset': { borderColor: '#fff' },
                                    '&:hover fieldset': { borderColor: '#fff' },
                                    '&.Mui-focused fieldset': { borderColor: '#fff' },
                                  },
                                }}
                              />
                            )}
                          </TableCell>
                          <TableCell sx={{ color: '#fff', whiteSpace: 'nowrap' }}>
                            {formatForDisplay(itemTotal, 2)}
                          </TableCell>
                          <TableCell align="right">
                            <IconButton size="small" onClick={() => removeFromChart(item.id)} sx={{ color: '#FED208' }} title="Удалить">
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
              Маршрут доставки
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 1 }}>
                Перетащите для изменения маршрута
              </Typography>
              <Divider sx={{ borderColor: 'rgba(254,210,8,0.3)', mb: 2 }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {warehouseOrder.map((addr, idx) => {
                  const legKm = routeLegDistancesKm[idx];
                  const legDetail = routeLegDetails[idx];
                  const hasLeg = legKm != null && (
                    destinationAddress ? true : idx < warehouseOrder.length - 1
                  );
                  return (
                    <Box key={`${addr}-${idx}`} sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      <Box
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
                      {hasLeg && legDetail && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 0.5, px: 1.5, py: 0.5, bgcolor: 'rgba(0,0,0,0.2)', borderLeft: '2px solid rgba(254,210,8,0.3)', ml: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                              ↓ {formatForDisplay(legKm, 1)} км · {legDetail.cumTons > 0 ? `${formatForDisplay(legDetail.cumTons, 3)} т → ${formatForDisplay(legDetail.effectiveTons, legDetail.effectiveTons % 1 === 0 ? 0 : 3)}` : 'нет тонн'}
                            </Typography>
                            {legDetail.cumTons > 0 && legDetail.rate > 0 && (
                              <Typography variant="caption" sx={{ color: '#FED208', fontWeight: 600 }}>
                                × {formatForDisplay(legDetail.rate, 2)}
                              </Typography>
                            )}
                          </Box>
                          <Typography variant="caption" sx={{ color: legDetail.cost > 0 ? '#FED208' : 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
                            {legDetail.cost > 0 ? `${formatForDisplay(legDetail.cost, 2)} ₽` : '—'}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  );
                })}
                {routeLegDistancesKm.length > 0 && (
                  <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'space-between', px: 1 }}>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                      Всего по маршруту: {formatForDisplay(routeLegDistancesKm.reduce((a, b) => a + b, 0), 1)} км
                    </Typography>
                    {deliveryPrice > 0 && (
                      <Typography variant="body2" sx={{ color: '#FED208', fontWeight: 600 }}>
                        {formatForDisplay(deliveryPrice, 2)} ₽
                      </Typography>
                    )}
                  </Box>
                )}
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
                      {loadingWarehouses ? (
                        <MenuItem value="">Загрузка складов...</MenuItem>
                      ) : deliveryWarehouseOptions.length > 0 ? (
                        deliveryWarehouseOptions.map((addr, index) => (
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

          <Paper className="product-details-paper" sx={{ mt: 3, width: '100%', maxWidth: 720 }}>
            <Typography variant="h6" className="product-details-section-title">
              Итого
            </Typography>
            <Divider sx={{ borderColor: 'rgba(254,210,8,0.3)', my: 2 }} />
            {submitError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {submitError}
              </Alert>
            )}
            {submitSuccess && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {submitSuccess}
              </Alert>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ color: '#fff' }}>Стоимость товаров:</Typography>
                <Typography sx={{ color: '#FED208', fontWeight: 700 }}>{formatForDisplay(totalPrice, 2)} ₽</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ color: '#fff' }}>Доставка:</Typography>
                  <Typography sx={{ color: '#FED208', fontWeight: 700 }}>{formatForDisplay(deliveryPrice, 2)} ₽</Typography>
                </Box>
                <Divider sx={{ borderColor: 'rgba(254,210,8,0.3)' }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ color: '#fff', fontWeight: 700 }}>Всего:</Typography>
                  <Typography sx={{ color: '#FED208', fontWeight: 700, fontSize: '1.25rem' }}>
                    {formatForDisplay(totalPrice + deliveryPrice, 2)} ₽
                </Typography>
              </Box>
            </Box>
            <Button
              variant="contained"
              fullWidth
              className="product-details-order-button"
              sx={{ mt: 3 }}
              onClick={handleSubmitOrder}
              disabled={submittingOrder || !destinationAddress}
            >
              {submittingOrder ? 'Отправка...' : 'Оформить заказ'}
            </Button>
          </Paper>
        </Box>
      </Container>
    </Box>
  );
};

export default Cart;
