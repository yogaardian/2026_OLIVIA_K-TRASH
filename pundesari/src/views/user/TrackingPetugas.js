import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useHistory } from "react-router-dom";
import { Container, Button, Card, Alert, Modal, Row, Col, Badge } from "react-bootstrap";
import { MapContainer, TileLayer, Marker, Popup, Polyline, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import { locationAPI } from "../../services/api";

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

const DEFAULT_CENTER = [-7.8, 110.3];
import Sidebar from "../../components/Sidebar.jsx";
import "../../css/Dashboard.css";
import "../../css/sidebar.css";

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

function FitRouteBounds({ userLocation, driverLocation, routeGeoJson, forceFit = false }) {
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
      if (userLocation) bounds.extend(userLocation);
      if (driverLocation) bounds.extend(driverLocation);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16, animate: true });
      hasFittedRef.current = true;
    } else if (userLocation && driverLocation) {
      const bounds = L.latLngBounds([userLocation, driverLocation]);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16, animate: true });
      hasFittedRef.current = true;
    }
  }, [map, routeGeoJson, userLocation, driverLocation, forceFit]);

  return null;
}

function TrackingPetugas() {
  const history = useHistory();
  const orderId = sessionStorage.getItem("current_order_id");
  const [driverLocation, setDriverLocation] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [routeGeoJson, setRouteGeoJson] = useState(null);
  const [userAddress, setUserAddress] = useState("");
  const [driverInfo, setDriverInfo] = useState(null);
  const [orderStatus, setOrderStatus] = useState("assigned");
  const [loading, setLoading] = useState(true);
  const [arrivedNotification, setArrivedNotification] = useState(false);
  const [completedNotification, setCompletedNotification] = useState(false);
  const [completedRedirected, setCompletedRedirected] = useState(false);
  const [showSampahModal, setShowSampahModal] = useState(false);
  const [sampahData, setSampahData] = useState(null);
  const [totalBerat, setTotalBerat] = useState(0);
  const [totalHarga, setTotalHarga] = useState(0);
  const [kecamatanGeoJson, setKecamatanGeoJson] = useState(null);
  const [driverSmoothPos, setDriverSmoothPos] = useState(null);
  const [userSmoothPos, setUserSmoothPos] = useState(null);

  // Routing refs & caches
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

  const orderStatusRef = useRef(orderStatus);

  const fetchTracking = useCallback(async () => {
    if (!orderId) return;
    try {
      const response = await locationAPI.getTracking(orderId);
      if (response.data.status === "success") {
        // Use driver_lat and driver_lng directly - don't parse locations array
        if (response.data.driver_lat != null && response.data.driver_lng != null) {
          console.log('🚗 DRIVER LOC:', response.data.driver_lat, response.data.driver_lng);
          setDriverLocation([Number(response.data.driver_lat), Number(response.data.driver_lng)]);
        }

        // Set user location
        if (response.data.user_lat != null && response.data.user_lng != null) {
          console.log('👤 USER LOC:', response.data.user_lat, response.data.user_lng);
          setUserLocation([Number(response.data.user_lat), Number(response.data.user_lng)]);
        }

        if (response.data.address) {
          setUserAddress(response.data.address);
        }

        setDriverInfo({
          name: response.data.driver_name || "Petugas",
          id: response.data.driver_id,
          phone: response.data.driver_phone || "-"
        });

        const nextStatus = response.data.order_status || "assigned";
        if (nextStatus === "arrived" && orderStatusRef.current !== "arrived") {
          setArrivedNotification(true);
        }
        orderStatusRef.current = nextStatus;
        setOrderStatus(nextStatus);

        // Extract sampah data jika ada
        if (response.data.sampah_data) {
          setSampahData(response.data.sampah_data);
          setTotalBerat(response.data.total_berat || 0);
          setTotalHarga(response.data.total_harga || 0);
        }
      } else {
        console.error("Tracking response error", response.data);
      }
    } catch (err) {
      console.error("Error fetching tracking:", err);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!orderId) {
      history.push("/user/dashboard");
      return;
    }

    fetchTracking();
    const interval = setInterval(fetchTracking, 3000);

    return () => clearInterval(interval);
  }, [orderId, history, fetchTracking]);

  useEffect(() => {
    if (orderStatus === "completed" && !completedRedirected) {
      setCompletedNotification(true);
      const redirectTimer = setTimeout(() => {
        setCompletedRedirected(true);
        history.push("/user/dashboard");
      }, 2500);

      return () => clearTimeout(redirectTimer);
    }
  }, [orderStatus, completedRedirected, history]);

  const handleRefreshLocation = async () => {
    await fetchTracking();
  };

  const handleCancel = () => {
    history.push("/user/dashboard");
  };

  const center = useMemo(() => driverLocation || userLocation || DEFAULT_CENTER, [driverLocation, userLocation]);
  useEffect(() => {
    if (!driverLocation || !userLocation) {
      setRouteGeoJson(null);
      return;
    }
    fetchRouteManaged(userLocation, driverLocation);
  }, [driverLocation, userLocation, fetchRouteManaged]);

  // Smooth marker interpolation
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

  // Load kecamatan GeoJSON to display district boundaries
  useEffect(() => {
    const tryFetchKecamatan = async () => {
      const candidates = [
        '/api/geojson/all',
        '/api/geojson/kecamatan_all.geojson',
        '/uploads/kecamatan_all.geojson',
        '/uploads/kecamatan.geojson',
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

  if (loading) {
    return (
      <div className="dashboard-layout">
        <Sidebar />
        <main className="dashboard-main">
          <Container className="text-center py-5">
            <p>Loading tracking...</p>
          </Container>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="dashboard-main">
        <div style={{ backgroundColor: "#FFFFFF", minHeight: "100vh", padding: "20px 0" }}>
          <Container>
            <div className="d-flex align-items-center justify-content-between mb-4">
              <div className="d-flex align-items-center">
                <i 
                  className="nc-icon nc-minimal-left" 
                  style={{ fontSize: "24px", cursor: "pointer", marginRight: "15px" }}
                  onClick={() => history.goBack()}
                ></i>
                <h4 style={{ fontWeight: "bold", color: "#333", margin: "0" }}>Tracking Petugas</h4>
              </div>
            </div>

            {/* Notification */}
            {arrivedNotification && (
              <Alert variant="success" className="mb-3" dismissible onClose={() => setArrivedNotification(false)}>
                <strong>✓ Petugas Sudah Sampai!</strong> Petugas sedang menunggu dan memproses sampahmu.
              </Alert>
            )}
            {completedNotification && (
              <Alert variant="info" className="mb-3" dismissible onClose={() => setCompletedNotification(false)}>
                <strong>✓ Penjemputan Selesai!</strong> Data sudah dikirim, Anda akan segera diarahkan ke Dashboard.
              </Alert>
            )}

            {/* Driver Profile Card */}
            {driverInfo && (
              <Card className="mb-3" style={{ borderRadius: "15px", border: "none", boxShadow: "0 5px 10px rgba(0,0,0,0.05)" }}>
                <Card.Body>
                  <div className="d-flex align-items-center" style={{ gap: "15px" }}>
                    <div style={{
                      width: "60px",
                      height: "60px",
                      borderRadius: "50%",
                      backgroundColor: "#4CAF50",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "bold",
                      fontSize: "24px"
                    }}>
                      {driverInfo.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h6 style={{ fontWeight: "bold", margin: 0 }}>{driverInfo.name}</h6>
                      <small className="text-muted">ID: {driverInfo.id}</small>
                      <div style={{ marginTop: "5px" }}>
                        <small className="text-muted">📞 {driverInfo.phone}</small>
                      </div>
                    </div>
                    <div style={{ marginLeft: "auto" }}>
                      <div style={{
                        width: "12px",
                        height: "12px",
                        borderRadius: "50%",
                        backgroundColor: "#4CAF50",
                        animation: "pulse 1.5s infinite"
                      }}></div>
                      <small style={{ marginTop: "5px", display: "block" }}>Aktif</small>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            )}

            {/* Status */}
            <Card className="mb-3" style={{ borderRadius: "15px", border: "none", boxShadow: "0 5px 10px rgba(0,0,0,0.05)" }}>
              <Card.Body>
                <div style={{ textAlign: "center" }}>
                  <h6 style={{ color: "#666", marginBottom: "10px" }}>Status Order</h6>
                  <h5 style={{ fontWeight: "bold", color: "#4CAF50", textTransform: "capitalize" }}>
                    {orderStatus}
                  </h5>
                </div>
              </Card.Body>
            </Card>

            {/* Debug Panel */}
            <Card className="mb-3" style={{ borderRadius: "15px", border: "2px solid #FFC107", backgroundColor: "#FFFACD", boxShadow: "0 5px 10px rgba(255,193,7,0.2)" }}>
              <Card.Body style={{ padding: "12px" }}>
                <div style={{ fontSize: "12px", fontFamily: "monospace", color: "#333" }}>
                  <div>🚗 DRIVER: {JSON.stringify(driverLocation)}</div>
                  <div>👤 USER: {JSON.stringify(userLocation)}</div>
                  <div>📍 STATUS: {orderStatus}</div>
                </div>
              </Card.Body>
            </Card>

            {/* Map */}
            <Card style={{ borderRadius: "15px", border: "none", boxShadow: "0 5px 10px rgba(0,0,0,0.05)", marginBottom: "20px" }}>
              <Card.Body style={{ padding: 0 }}>
                <div style={{ height: "400px", borderRadius: "12px", overflow: "hidden" }}>
                  <MapContainer 
                    center={center} 
                    zoom={15} 
                    style={{ height: "100%", width: "100%" }}
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <ChangeView center={center} zoom={15} />
                    {kecamatanGeoJson && (
                      <GeoJSON
                        data={kecamatanGeoJson}
                        style={{ color: '#888', weight: 1, fillOpacity: 0.03 }}
                        smoothFactor={1}
                      />
                    )}

                    {userSmoothPos ? (
                      <Marker position={userSmoothPos} icon={redIcon}>
                        <Popup>📍 Lokasi Anda - {userAddress || "Alamat user"}</Popup>
                      </Marker>
                    ) : userLocation && (
                      <Marker position={userLocation} icon={redIcon}>
                        <Popup>📍 Lokasi Anda - {userAddress || "Alamat user"}</Popup>
                      </Marker>
                    )}

                    {driverSmoothPos ? (
                      <Marker position={driverSmoothPos} icon={blueIcon}>
                        <Popup>🚗 Lokasi Petugas Sekarang</Popup>
                      </Marker>
                    ) : driverLocation && (
                      <Marker position={driverLocation} icon={blueIcon}>
                        <Popup>🚗 Lokasi Petugas Sekarang</Popup>
                      </Marker>
                    )}

                    {routeGeoJson ? (
                      <GeoJSON
                        key={JSON.stringify(routeGeoJson)}
                        data={routeGeoJson}
                        style={{ color: "#3388ff", weight: 6, opacity: 0.7 }}
                      />
                    ) : (
                      driverLocation && userLocation && (
                        <Polyline
                          positions={[userLocation, driverLocation]}
                          pathOptions={{ color: "#3388ff", weight: 6 }}
                        />
                      )
                    )}

                    <FitRouteBounds
                      userLocation={userSmoothPos || userLocation}
                      driverLocation={driverSmoothPos || driverLocation}
                      routeGeoJson={routeGeoJson}
                      kecamatanGeoJson={kecamatanGeoJson}
                    />
                  </MapContainer>
                </div>
              </Card.Body>
            </Card>

            <div className="d-grid gap-2 mb-3">
              <Button variant="outline-primary" onClick={handleRefreshLocation}>
                Muat Ulang Lokasi Petugas
              </Button>
            </div>

            {(orderStatus === "arrived" || orderStatus === "completed") && sampahData && (
              <div className="d-grid gap-2 mb-3">
                <Button 
                  variant="success" 
                  onClick={() => setShowSampahModal(true)}
                  className="py-2"
                >
                  📊 Lihat Rincian Sampah
                </Button>
              </div>
            )}

            {(orderStatus === "approved" || orderStatus === "completed") && (
              <div className="d-grid gap-2 mb-3">
                <Button
                  variant="primary"
                  className="w-100 py-2"
                  onClick={() => history.push("/user/dashboard")}
                >
                  Selesai
                </Button>
              </div>
            )}

            {orderStatus !== "approved" && orderStatus !== "completed" && (
              <Button 
                variant="outline-danger" 
                className="w-100 py-2"
                onClick={handleCancel}
              >
                Batalkan Order
              </Button>
            )}
          </Container>
        </div>
      </main>

      {/* Modal Rincian Sampah */}
      <Modal show={showSampahModal} onHide={() => setShowSampahModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>📊 Rincian Sampah</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {sampahData ? (
            <>
              {Object.keys(sampahData).map(kategori => (
                <div key={kategori} className="mb-4">
                  <h6 style={{ fontWeight: "bold", textTransform: "capitalize", color: "#4CAF50", marginBottom: "12px" }}>
                    {kategori.toUpperCase()}
                  </h6>
                  {Object.keys(sampahData[kategori]).length === 0 ? (
                    <p className="text-muted">Tidak ada sampah</p>
                  ) : (
                    Object.keys(sampahData[kategori]).map(itemId => {
                      const item = sampahData[kategori][itemId];
                      return (
                        <Row key={itemId} className="mb-2 align-items-center" style={{ borderBottom: "1px solid #eee", paddingBottom: "8px" }}>
                          <Col xs={6}>
                            <small className="text-muted">Item #{itemId}</small>
                            <div style={{ fontWeight: "500" }}>
                              {item.berat} kg × Rp {Number(item.harga).toLocaleString()}
                            </div>
                          </Col>
                          <Col xs={6} className="text-right">
                            <div style={{ fontWeight: "bold", color: "#4CAF50" }}>
                              Rp {(item.berat * item.harga).toLocaleString()}
                            </div>
                          </Col>
                        </Row>
                      );
                    })
                  )}
                </div>
              ))}
              
              <div style={{ backgroundColor: "#F5F5F5", padding: "15px", borderRadius: "8px", marginTop: "20px" }}>
                <Row>
                  <Col xs={6}>
                    <div style={{ fontSize: "14px", color: "#666" }}>Total Berat:</div>
                    <div style={{ fontSize: "20px", fontWeight: "bold", color: "#4CAF50" }}>
                      {Number(totalBerat).toFixed(2)} kg
                    </div>
                  </Col>
                  <Col xs={6} className="text-right">
                    <div style={{ fontSize: "14px", color: "#666" }}>Total Harga:</div>
                    <div style={{ fontSize: "20px", fontWeight: "bold", color: "#4CAF50" }}>
                      Rp {Number(totalHarga).toLocaleString()}
                    </div>
                  </Col>
                </Row>
              </div>
              
              {orderStatus === "completed" && (
                <Alert variant="info" className="mt-3">
                  ✓ Data sampah telah dikirim ke admin untuk verifikasi saldo Anda.
                </Alert>
              )}
            </>
          ) : (
            <p className="text-center text-muted">Belum ada data sampah</p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowSampahModal(false)}>
            Tutup
          </Button>
        </Modal.Footer>
      </Modal>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export default TrackingPetugas;