import React, { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { Button, Card, Form, Row, Col, Alert } from "react-bootstrap";
import { MapContainer, TileLayer, Marker, Popup, Polyline, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import { hargaAPI, locationAPI, ordersAPI } from "../../services/api";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

const redIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const blueIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function ChangeView({ center, zoom, follow = true }) {
  const map = useMap();

  useEffect(() => {
    if (map._trackingInitialized) return;
    map._trackingInitialized = true;
    map._userInteracted = false;
    const onMoveStart = () => { map._userInteracted = true; };
    map.on('movestart', onMoveStart);
    return () => map.off('movestart', onMoveStart);
  }, [map]);

  useEffect(() => {
    if (!center || !follow) return;
    if (map._userInteracted) return;
    map.setView(center, zoom);
  }, [map, center, zoom, follow]);

  return null;
}

function FitRouteBounds({ driverLocation, userLocation, routeGeoJson, forceFit = false }) {
  const map = useMap();
  const hasFittedRef = useRef(false);

  useEffect(() => {
    if (hasFittedRef.current && !forceFit) return;
    if (map._userInteracted && !forceFit) {
      hasFittedRef.current = true;
      return;
    }

    if (routeGeoJson && routeGeoJson.coordinates) {
      const coords = routeGeoJson.coordinates.map(([lng, lat]) => [lat, lng]);
      const bounds = L.latLngBounds(coords);
      if (driverLocation) bounds.extend(driverLocation);
      if (userLocation) bounds.extend(userLocation);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16, animate: true });
      hasFittedRef.current = true;
    } else if (driverLocation && userLocation) {
      const bounds = L.latLngBounds([driverLocation, userLocation]);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16, animate: true });
      hasFittedRef.current = true;
    }
  }, [map, routeGeoJson, driverLocation, userLocation, forceFit]);

  return null;
}

function TrackingUser() {
  const history = useHistory();
  const location = useLocation();
  const storedOrder = sessionStorage.getItem("tracking_order");
  const initialOrder = location.state?.order || (storedOrder ? JSON.parse(storedOrder) : null);
  const [order, setOrder] = useState(initialOrder);
  const driverId = localStorage.getItem("userId");
  const driverName = localStorage.getItem("nama") || "Petugas";
  const orderId = order?.id;
  const [orderStatus, setOrderStatus] = useState(initialOrder?.status || "assigned");
  const [hargaList, setHargaList] = useState({ organik: [], anorganik: [], lainnya: [] });
  const [driverLocation, setDriverLocation] = useState(null);
  const [userLocation, setUserLocation] = useState(
    initialOrder?.user_lat && initialOrder?.user_lng ? [initialOrder.user_lat, initialOrder.user_lng] : null
  );
  const [routeGeoJson, setRouteGeoJson] = useState(null);
  const [kecamatanGeoJson, setKecamatanGeoJson] = useState(null);
  const [driverSmoothPos, setDriverSmoothPos] = useState(null);
  const [userSmoothPos, setUserSmoothPos] = useState(null);

  // Routing/caching refs
  const routeCacheRef = useRef(new Map());
  const lastRouteTimeRef = useRef(0);
  const inFlightRef = useRef(false);
  const abortControllerRef = useRef(null);
  const lastFetchedPositionsRef = useRef(null);

  const MIN_ROUTE_INTERVAL = 5000; // ms
  const MOVE_THRESHOLD_METERS = 50; // meters

  const roundCoord = (v) => Math.round(v * 100000) / 100000;
  const coordKey = (a, b) => `${roundCoord(a[0])},${roundCoord(a[1])}_${roundCoord(b[0])},${roundCoord(b[1])}`;

  const haversine = (a, b) => {
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(b[0] - a[0]);
    const dLon = toRad(b[1] - a[1]);
    const lat1 = toRad(a[0]);
    const lat2 = toRad(b[0]);
    const R = 6371000;
    const x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    return R * c;
  };

  const snapPoint = async (lat, lng, signal) => {
    try {
      const r = await fetch(`https://router.project-osrm.org/nearest/v1/driving/${lng},${lat}`, { signal });
      const j = await r.json();
      if (j && j.waypoints && j.waypoints.length > 0 && j.waypoints[0].location) {
        const [snappedLng, snappedLat] = j.waypoints[0].location;
        return [snappedLat, snappedLng];
      }
    } catch (e) {
      // ignore
    }
    return [lat, lng];
  };

  const chooseBestRoute = (routes) => {
    if (!routes || routes.length === 0) return null;
    // score: prefer lower duration and fewer steps
    const scored = routes.map((r) => {
      let steps = 0;
      if (r.legs) r.legs.forEach((leg) => { if (leg.steps) steps += leg.steps.length; });
      const score = (r.duration || 0) + steps * 2;
      return { r, score };
    });
    scored.sort((a, b) => a.score - b.score);
    return scored[0].r;
  };

  const fetchRouteManaged = useCallback(async (from, to) => {
    if (!from || !to) return;
    const now = Date.now();
    const key = coordKey(from, to);
    const cache = routeCacheRef.current.get(key);
    if (cache && now - cache.ts < 60 * 1000) {
      setRouteGeoJson(cache.geo);
      return;
    }

    if (inFlightRef.current && now - lastRouteTimeRef.current < MIN_ROUTE_INTERVAL) return;
    const distMoved = lastFetchedPositionsRef.current ? Math.max(haversine(lastFetchedPositionsRef.current.from, from), haversine(lastFetchedPositionsRef.current.to, to)) : Infinity;
    if (distMoved < MOVE_THRESHOLD_METERS && now - lastRouteTimeRef.current < MIN_ROUTE_INTERVAL) return;

    // abort previous
    try { abortControllerRef.current?.abort(); } catch (e) {}
    const controller = new AbortController();
    abortControllerRef.current = controller;
    inFlightRef.current = true;
    lastRouteTimeRef.current = now;

    try {
      const [sFromLat, sFromLng] = await snapPoint(from[0], from[1], controller.signal);
      const [sToLat, sToLng] = await snapPoint(to[0], to[1], controller.signal);

      const url = `https://router.project-osrm.org/route/v1/driving/${sFromLng},${sFromLat};${sToLng},${sToLat}?overview=full&geometries=geojson&steps=true&alternatives=true`;
      const resp = await fetch(url, { signal: controller.signal });
      const data = await resp.json();
      if (data && data.routes && data.routes.length > 0) {
        const best = chooseBestRoute(data.routes);
        if (best && best.geometry) {
          setRouteGeoJson(best.geometry);
          routeCacheRef.current.set(key, { geo: best.geometry, ts: Date.now() });
        }
      } else {
        setRouteGeoJson({ type: 'LineString', coordinates: [[from[1], from[0]], [to[1], to[0]]] });
      }
      lastFetchedPositionsRef.current = { from, to };
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Error fetching managed route', err);
      setRouteGeoJson({ type: 'LineString', coordinates: [[from[1], from[0]], [to[1], to[0]]] });
    } finally {
      inFlightRef.current = false;
    }
  }, []);
  const [userAddress, setUserAddress] = useState(initialOrder?.address || "");
  const [sampahData, setSampahData] = useState({ organik: {}, anorganik: {}, lainnya: {} });
  const [totalBerat, setTotalBerat] = useState(0);
  const [totalHarga, setTotalHarga] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingPrice, setLoadingPrice] = useState(true);
  const [successMessage, setSuccessMessage] = useState("");

  // Fetch harga sampah dari backend
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const kategoris = ["organik", "anorganik", "lainnya"];
        const prices = {};
        
        for (const kategori of kategoris) {
          try {
            const response = await hargaAPI.getByJenis(kategori);
            prices[kategori] = response.data;
          } catch (err) {
            prices[kategori] = [];
          }
        }
        
        setHargaList(prices);
        
        // Initialize sampahData with fetched prices
        const initialized = {};
        Object.keys(prices).forEach(kategori => {
          initialized[kategori] = {};
          prices[kategori].forEach(item => {
            initialized[kategori][item.id] = { harga: item.harga, berat: 0 };
          });
        });
        setSampahData(initialized);
      } catch (err) {
        console.error("Error fetching prices:", err);
      } finally {
        setLoadingPrice(false);
      }
    };

    fetchPrices();
  }, []);

  const fetchOrderStatus = useCallback(async () => {
    if (!orderId) return;
    try {
      // Fetch tracking data to get both driver and user locations
      const response = await locationAPI.getTracking(orderId);
      if (response.data.status === "success") {
        const updated = response.data;
        setOrderStatus(updated.order_status);
        setUserAddress(updated.address || "");
        
        // Set user location from tracking endpoint
        if (updated.user_lat != null && updated.user_lng != null) {
          console.log('👤 USER LOC:', updated.user_lat, updated.user_lng);
          setUserLocation([Number(updated.user_lat), Number(updated.user_lng)]);
        }
      }
    } catch (err) {
      console.error("Error fetching order tracking:", err);
    }
  }, [orderId]);

  const updateOrderStatus = useCallback(async (newStatus) => {
    if (!orderId || !driverId) return;
    try {
      const response = await ordersAPI.updateOrderStatus(orderId, {
        driver_id: parseInt(driverId),
        status: newStatus,
      });
      if (response.data.status === "success") {
        setOrderStatus(newStatus);
      } else {
        console.error("Failed to update order status:", response.data);
      }
    } catch (err) {
      console.error("Error updating order status:", err);
    }
  }, [driverId, orderId]);

  const sendDriverLocation = useCallback(async (lat, lng) => {
    if (!orderId || !driverId) return;
    try {
      await locationAPI.sendDriverLocation({
        driver_id: parseInt(driverId),
        order_id: orderId,
        lat,
        lng,
      });
    } catch (err) {
      console.error("Error sending driver location:", err);
    }
  }, [driverId, orderId]);

  useEffect(() => {
    if (!order?.id) {
      history.push("/driver/dashboard");
      return;
    }

    fetchOrderStatus();
    const interval = setInterval(fetchOrderStatus, 3000);
    return () => clearInterval(interval);
  }, [order?.id, history, fetchOrderStatus]);


  useEffect(() => {
    if (!navigator.geolocation || !order?.id) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude);
        const lng = Number(pos.coords.longitude);
        console.log("GPS RAW:", pos.coords);
        console.log("🚗 DRIVER GPS:", lat, lng);
        setDriverLocation([lat, lng]);
        if (orderStatus !== "completed") {
          sendDriverLocation(lat, lng);
        }
      },
      (err) => console.error("Geolocation error:", err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [order?.id, orderStatus, sendDriverLocation]);

  useEffect(() => {
    if (!driverLocation || !userLocation) {
      setRouteGeoJson(null);
      return;
    }
    fetchRouteManaged(driverLocation, userLocation);
  }, [driverLocation, userLocation, fetchRouteManaged]);

  // Smooth marker interpolation (linear over 800ms)
  useEffect(() => {
    let rafId = null;
    let start = null;
    const DURATION = 800;
    const from = driverSmoothPos || driverLocation || null;
    const to = driverLocation;
    if (!to) return;
    if (!from) {
      setDriverSmoothPos(to);
      return;
    }
    const step = (ts) => {
      if (!start) start = ts;
      const t = Math.min(1, (ts - start) / DURATION);
      const lat = from[0] + (to[0] - from[0]) * t;
      const lng = from[1] + (to[1] - from[1]) * t;
      setDriverSmoothPos([lat, lng]);
      if (t < 1) rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => { if (rafId) cancelAnimationFrame(rafId); };
  }, [driverLocation]);

  useEffect(() => {
    let rafId = null;
    let start = null;
    const DURATION = 800;
    const from = userSmoothPos || userLocation || null;
    const to = userLocation;
    if (!to) return;
    if (!from) {
      setUserSmoothPos(to);
      return;
    }
    const step = (ts) => {
      if (!start) start = ts;
      const t = Math.min(1, (ts - start) / DURATION);
      const lat = from[0] + (to[0] - from[0]) * t;
      const lng = from[1] + (to[1] - from[1]) * t;
      setUserSmoothPos([lat, lng]);
      if (t < 1) rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => { if (rafId) cancelAnimationFrame(rafId); };
  }, [userLocation]);

  // Try to load kecamatan GeoJSON to display district boundaries (optional)
  useEffect(() => {
    const tryFetchKecamatan = async () => {
      const candidates = [
        '/api/geojson/all',
        '/api/geojson/kecamatan_all.geojson',
        '/uploads/kecamatan_all.geojson',
        '/uploads/kecamatan.geojson',
        '/api/kecamatan/get_all',
      ];

      for (const path of candidates) {
        try {
          const res = await fetch(path);
          if (!res.ok) continue;
          const json = await res.json();
          if (json && (json.type === 'FeatureCollection' || json.features)) {
            setKecamatanGeoJson(json);
            return;
          }
        } catch (e) {
          // ignore and try next
        }
      }
    };

    tryFetchKecamatan();
  }, []);

  const handleRefreshLocation = async () => {
    if (!order) return;
    try {
      const response = await ordersAPI.getOrderDetail(order.id);
      if (response.data) {
        const updated = response.data;
        setOrder(updated);
        setOrderStatus(updated.status);
        setUserAddress(updated.address || "");
        if (updated.user_lat != null && updated.user_lng != null) {
          setUserLocation([updated.user_lat, updated.user_lng]);
        }
        sessionStorage.setItem("tracking_order", JSON.stringify(updated));
      }
    } catch (err) {
      console.error("Error refreshing location:", err);
    }
  };

  const handlePetugasSampai = async () => {
    try {
      const response = await ordersAPI.updateOrderStatus(order.id, {
        driver_id: parseInt(driverId),
        status: "arrived"
      });
      if (response.data.status === "success") {
        setOrderStatus("arrived");
        setShowForm(true);
      } else {
        alert(response.data.message || "Gagal update status");
      }
    } catch (err) {
      console.error("Error updating status:", err);
      alert("Gagal update status: " + (err.response?.data?.message || err.message));
    }
  };

  useEffect(() => {
    if (orderStatus === "arrived") {
      setShowForm(true);
    }
  }, [orderStatus]);

  const handleInputChange = (kategori, itemId, berat) => {
    const numValue = parseFloat(berat) || 0;
    setSampahData(prev => ({
      ...prev,
      [kategori]: {
        ...prev[kategori],
        [itemId]: {
          harga: prev[kategori][itemId].harga,
          berat: numValue
        }
      }
    }));
  };

  useEffect(() => {
    let totalB = 0;
    let totalH = 0;

    Object.keys(sampahData).forEach(kategori => {
      Object.keys(sampahData[kategori]).forEach(itemId => {
        const item = sampahData[kategori][itemId];
        totalB += item.berat || 0;
        totalH += (item.berat * item.harga) || 0;
      });
    });

    setTotalBerat(totalB);
    setTotalHarga(totalH);
  }, [sampahData]);

  const handleSubmitSampah = async () => {
    setSubmitting(true);
    try {
      const response = await ordersAPI.updateOrderStatus(order.id, {
        driver_id: parseInt(driverId),
        status: "completed",
        sampah_data: sampahData,
        total_berat: totalBerat,
        total_harga: totalHarga
      });
      if (response.data.status === "success") {
        alert("Data sampah berhasil dikirim ke admin untuk konfirmasi!");
        history.push("/driver/dashboard");
      } else {
        alert(response.data.message || "Gagal mengirim data");
      }
    } catch (err) {
      console.error("Error submitting sampah:", err);
      alert("Gagal mengirim data: " + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  if (!order) return null;

  const currentUserLocation = order.user_lat && order.user_lng ? [order.user_lat, order.user_lng] : userLocation;
  const center = useMemo(() => driverLocation || currentUserLocation || [-7.8, 110.3], [driverLocation, currentUserLocation]);
  const polylinePositions = useMemo(
    () => (driverLocation && currentUserLocation ? [driverLocation, currentUserLocation] : []),
    [driverLocation, currentUserLocation]
  );

  return (
    <div style={{ backgroundColor: "#F7F1F1", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div className="p-3 bg-white shadow-sm d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center">
          <i 
            className="nc-icon nc-minimal-left" 
            style={{ fontSize: "24px", cursor: "pointer", marginRight: "15px" }}
            onClick={() => history.goBack()}
          ></i>
          <h5 style={{ fontWeight: "bold", margin: 0 }}>Tracking User - Order #{order.id}</h5>
        </div>
        <Button variant="outline-secondary" size="sm" onClick={handleRefreshLocation}>
          Refresh Lokasi
        </Button>
      </div>
      <div className="p-3 bg-white shadow-sm d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center">
          <div className="d-flex align-items-center" style={{ gap: "12px" }}>
            <div style={{
              width: "45px",
              height: "45px",
              borderRadius: "50%",
              backgroundColor: "#4CAF50",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "bold",
              fontSize: "18px"
            }}>
              {driverName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: "bold", fontSize: "14px" }}>{driverName}</div>
              <div style={{ fontSize: "12px", color: "#666" }}>ID: {driverId}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Debug Panel */}
      <div className="p-3">
        <Alert variant="warning">
          <div style={{ fontSize: "12px", fontFamily: "monospace" }}>
            <div>🚗 DRIVER: {JSON.stringify(driverLocation)}</div>
            <div>👤 USER: {JSON.stringify(currentUserLocation)}</div>
            <div>📊 STATUS: {orderStatus}</div>
          </div>
        </Alert>
      </div>

      {/* Map */}
      <div className="p-3">
        <div style={{ height: "250px", borderRadius: "16px", overflow: "hidden" }}>
          <MapContainer center={center} zoom={15} style={{ height: "100%", width: "100%" }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <ChangeView center={center} zoom={15} />
            {kecamatanGeoJson && (
              <GeoJSON
                data={kecamatanGeoJson}
                style={{ color: '#888', weight: 1, fillOpacity: 0.03 }}
                // help performance by simplifying on the fly
                smoothFactor={1}
              />
            )}

            {driverSmoothPos ? (
              <Marker position={driverSmoothPos} icon={blueIcon}>
                <Popup>🚗 Lokasi Anda (Petugas)</Popup>
              </Marker>
            ) : driverLocation && (
              <Marker position={driverLocation} icon={blueIcon}>
                <Popup>🚗 Lokasi Anda (Petugas)</Popup>
              </Marker>
            )}

            {userSmoothPos ? (
              <Marker position={userSmoothPos} icon={redIcon}>
                <Popup>👤 Lokasi User - {userAddress || order.address}</Popup>
              </Marker>
            ) : currentUserLocation ? (
              <Marker position={currentUserLocation} icon={redIcon}>
                <Popup>👤 Lokasi User - {userAddress || order.address}</Popup>
              </Marker>
            ) : (
              <Marker position={[-7.8, 110.3]}>
                <Popup>Lokasi default</Popup>
              </Marker>
            )}

            {routeGeoJson ? (
              <GeoJSON
                key={JSON.stringify(routeGeoJson)}
                data={routeGeoJson}
                style={{ color: "#4CAF50", weight: 5, opacity: 0.9 }}
              />
            ) : (
              driverLocation && currentUserLocation && (
                <Polyline
                  positions={[driverLocation, currentUserLocation]}
                  pathOptions={{ color: "#4CAF50", weight: 5 }}
                />
              )
            )}

            <FitRouteBounds
              driverLocation={driverSmoothPos || driverLocation}
              userLocation={userSmoothPos || currentUserLocation}
              routeGeoJson={routeGeoJson}
            />
          </MapContainer>
        </div>
      </div>

      {/* Content */}
      <div className="flex-grow-1 bg-white p-4" style={{ borderTopLeftRadius: "20px", borderTopRightRadius: "20px", overflowY: "auto" }}>
        
        <Alert variant="info" className="mb-3">
          Status Order: <strong>{orderStatus}</strong>
        </Alert>

        {!showForm && (orderStatus === "assigned" || orderStatus === "on_the_way") && (
          <Button 
            className="w-100 py-3 mb-3" 
            style={{ backgroundColor: "#4CAF50", border: "none", borderRadius: "12px", fontSize: "16px", fontWeight: "bold" }}
            onClick={handlePetugasSampai}
          >
            Petugas Sampai
          </Button>
        )}

        {orderStatus === "completed" && !showForm && (
          <Alert variant="info" className="mb-3">
            Order sudah selesai dan menunggu konfirmasi admin.
          </Alert>
        )}

        {showForm && (
          <Card className="mb-3">
            <Card.Header>
              <h6 style={{ fontWeight: "bold" }}>📊 Input Jumlah Sampah</h6>
            </Card.Header>
            <Card.Body>
              {loadingPrice ? (
                <p className="text-center">Memuat data harga...</p>
              ) : (
                <>
                  {Object.keys(hargaList).map(kategori => (
                    <div key={kategori} className="mb-4">
                      <h6 style={{ fontWeight: "bold", textTransform: "capitalize", color: "#4CAF50" }}>
                        {kategori}
                      </h6>
                      {hargaList[kategori].length === 0 ? (
                        <p className="text-muted">Tidak ada jenis sampah</p>
                      ) : (
                        hargaList[kategori].map(item => (
                          <Row key={item.id} className="mb-3 align-items-center">
                            <Col xs={5}>
                              <Form.Label style={{ marginBottom: 0, fontWeight: "500" }}>
                                {item.sub_jenis}
                              </Form.Label>
                              <small className="text-muted">Rp {item.harga}/kg</small>
                            </Col>
                            <Col xs={7}>
                              <Form.Control 
                                type="number" 
                                placeholder="Berat (kg)" 
                                value={sampahData[kategori][item.id]?.berat || 0}
                                onChange={(e) => handleInputChange(kategori, item.id, e.target.value)}
                                step="0.1"
                              />
                            </Col>
                          </Row>
                        ))
                      )}
                    </div>
                  ))}
                  
                  <hr />
                  <Row className="mt-3">
                    <Col xs={6}>
                      <strong>Total Berat:</strong>
                      <div style={{ fontSize: "18px", color: "#4CAF50", fontWeight: "bold" }}>
                        {totalBerat.toFixed(2)} kg
                      </div>
                    </Col>
                    <Col xs={6} className="text-right">
                      <strong>Total Harga:</strong>
                      <div style={{ fontSize: "18px", color: "#4CAF50", fontWeight: "bold" }}>
                        Rp {totalHarga.toLocaleString()}
                      </div>
                    </Col>
                  </Row>
                </>
              )}
            </Card.Body>
          </Card>
        )}

        {showForm && (
          <Button 
            className="w-100 py-3" 
            style={{ backgroundColor: "#4CAF50", border: "none", borderRadius: "12px", fontSize: "16px", fontWeight: "bold" }}
            onClick={handleSubmitSampah}
            disabled={submitting || loadingPrice}
          >
            {submitting ? "Mengirim..." : "Kirim ke Admin"}
          </Button>
        )}
      </div>
    </div>
  );
}

export default TrackingUser;