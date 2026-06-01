import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { Form, Row, Col } from "react-bootstrap";
import { MapContainer, TileLayer, Marker, Popup, Polyline, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import { hargaAPI, locationAPI, ordersAPI } from "../../services/api";
import { getTileLayerProps, MAP_OPTIONS, MAP_MODERN_CSS } from "../../config/mapConfig";
import { getProfile } from "../../config/profileConfig";

// ─── Leaflet icon fix (PRESERVED) ────────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

const redIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

const blueIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

// ─── Map helpers (ALL LOGIC PRESERVED) ───────────────────────────────────────
function ChangeView({ center, zoom, follow = true }) {
  const map = useMap();
  useEffect(() => {
    if (map._trackingInitialized) return;
    map._trackingInitialized = true;
    map._userInteracted = false;
    const onMoveStart = () => { map._userInteracted = true; };
    map.on("movestart", onMoveStart);
    return () => map.off("movestart", onMoveStart);
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
    if (map._userInteracted && !forceFit) { hasFittedRef.current = true; return; }
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

// ─── Design tokens ───────────────────────────────────────────────────────────
const T = {
  green900: "#052e16",
  green800: "#14532d",
  green700: "#15803d",
  green600: "#16a34a",
  green500: "#22c55e",
  green400: "#4ade80",
  green300: "#86efac",
  greenGlow: "rgba(34,197,94,0.18)",
  greenGlow2: "rgba(34,197,94,0.08)",
  surface: "#ffffff",
  bg: "#f0fdf4",
  panel: "#fafffe",
  border: "rgba(34,197,94,0.15)",
  borderStrong: "rgba(34,197,94,0.3)",
  text: "#0f172a",
  textMid: "#334155",
  textSoft: "#64748b",
  textXsoft: "#94a3b8",
  amber: "#f59e0b",
  amberGlow: "rgba(245,158,11,0.15)",
  blue: "#3b82f6",
  red: "#ef4444",
  shadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(34,197,94,0.08)",
  shadowMd: "0 4px 24px rgba(34,197,94,0.12), 0 1px 4px rgba(0,0,0,0.06)",
  shadowLg: "0 8px 40px rgba(34,197,94,0.16), 0 2px 8px rgba(0,0,0,0.08)",
  radius: 20,
  radiusSm: 12,
};

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  assigned: { label: "Assigned", color: T.blue, bg: "rgba(59,130,246,0.1)", step: 0 },
  on_the_way: { label: "Menuju User", color: T.green500, bg: T.greenGlow, step: 1 },
  arrived: { label: "Tiba di Lokasi", color: T.amber, bg: T.amberGlow, step: 2 },
  completed: { label: "Selesai", color: T.green600, bg: T.greenGlow2, step: 3 },
};

const STEPS = ["Assigned", "On The Way", "Arrived", "Completed"];

// ─── UI Sub-components ────────────────────────────────────────────────────────

function StatusStepper({ status }) {
  const activeStep = STATUS_CONFIG[status]?.step ?? 0;
  return (
    <div style={S.stepper}>
      {STEPS.map((label, i) => {
        const done = i < activeStep;
        const active = i === activeStep;
        return (
          <React.Fragment key={label}>
            <div style={S.stepItem}>
              <div style={{
                ...S.stepCircle,
                background: done ? T.green600 : active ? `linear-gradient(135deg,${T.green500},${T.green700})` : "rgba(0,0,0,0.06)",
                boxShadow: active ? `0 0 0 4px ${T.greenGlow}, 0 0 12px ${T.green400}55` : "none",
                border: done ? `2px solid ${T.green600}` : active ? "2px solid transparent" : `2px solid rgba(0,0,0,0.1)`,
              }}>
                {done
                  ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  : <span style={{ width: 6, height: 6, borderRadius: "50%", background: active ? "#fff" : "rgba(0,0,0,0.2)", display: "block" }} />
                }
              </div>
              <div style={{ ...S.stepLabel, color: active ? T.green700 : done ? T.green600 : T.textXsoft, fontWeight: active ? 700 : done ? 600 : 400 }}>
                {label}
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ ...S.stepLine, background: i < activeStep ? T.green500 : "rgba(0,0,0,0.08)" }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function CustomerCard({ order, driverName, driverId, orderStatus, customerProfile, driverProfile }) {
  const cfg = STATUS_CONFIG[orderStatus] || STATUS_CONFIG.assigned;
  const displayName = customerProfile?.name || (order?.user_id ? `User #${order.user_id}` : "User");
  return (
    <div style={S.customerCard}>
      <div style={S.customerTop}>
        <div style={S.customerAvatar}>
          {customerProfile?.profilePhoto ? (
            <img
              src={customerProfile.profilePhoto}
              alt="Pelanggan avatar"
              style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "999px" }}
            />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={S.customerLabel}>Pelanggan</div>
          <div style={S.customerName}>{displayName}</div>
          <div style={S.customerAddress}>{order?.address || "—"}</div>
        </div>
        <div style={{ ...S.statusPill, background: cfg.bg, color: cfg.color, borderColor: cfg.color + "44" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color, display: "inline-block", marginRight: 5, boxShadow: `0 0 0 3px ${cfg.color}22` }} />
          {cfg.label}
        </div>
      </div>
      <div style={S.divider} />
      <div style={S.driverRow}>
        <div style={S.driverBubble}>
          {driverProfile?.profilePhoto ? (
            <img
              src={driverProfile.profilePhoto}
              alt="Petugas avatar"
              style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "999px" }}
            />
          ) : (
            driverName?.charAt(0)?.toUpperCase() || "D"
          )}
        </div>
        <div>
          <div style={S.driverName}>{driverName}</div>
          <div style={S.driverId}>ID: {driverId}</div>
        </div>
        <div style={S.orderIdTag}>Order #{order?.id}</div>
      </div>
    </div>
  );
}

function MapOverlay({ orderStatus, driverLocation, order }) {
  const cfg = STATUS_CONFIG[orderStatus] || STATUS_CONFIG.assigned;
  return (
    <>
      {/* Top: status floating badge */}
      <div style={S.mapBadge}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color, display: "inline-block", flexShrink: 0, boxShadow: `0 0 0 4px ${cfg.color}33`, animation: "ecoPulse 2s infinite" }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color, letterSpacing: "0.04em" }}>{cfg.label}</span>
      </div>

      {/* Top right: order ID */}
      <div style={S.mapOrderChip}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={T.green600} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
        <span style={{ fontSize: 11, fontWeight: 700, color: T.green700 }}>#{order?.id}</span>
      </div>

      {/* Bottom debug chip */}
      {driverLocation && (
        <div style={S.mapDebugChip}>
          <span style={{ color: T.blue, fontWeight: 700, marginRight: 4 }}>GPS</span>
          {driverLocation[0].toFixed(5)}, {driverLocation[1].toFixed(5)}
        </div>
      )}
    </>
  );
}

function SampahCategoryBlock({ kategori, items, sampahData, onInputChange }) {
  const [open, setOpen] = useState(true);
  const catColors = { organik: "#22c55e", anorganik: "#3b82f6", lainnya: "#f59e0b" };
  const color = catColors[kategori] || T.green500;
  const catTotal = items.reduce((sum, item) => {
    const d = sampahData[kategori]?.[item.id];
    return sum + (d?.berat || 0) * (d?.harga || item.harga || 0);
  }, 0);

  return (
    <div style={{ ...S.categoryBlock, borderColor: color + "22" }}>
      <button style={{ ...S.categoryHeader, background: color + "0d" }} onClick={() => setOpen(o => !o)}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: T.text, textTransform: "capitalize" }}>{kategori}</span>
          <span style={{ fontSize: 10, color: T.textSoft, fontWeight: 500 }}>{items.length} jenis</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {catTotal > 0 && <span style={{ fontSize: 11, fontWeight: 700, color }}> Rp {catTotal.toLocaleString("id-ID")}</span>}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textSoft} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </button>

      {open && (
        <div style={{ padding: "4px 0 8px" }}>
          {items.length === 0 ? (
            <div style={{ textAlign: "center", padding: "14px 0", color: T.textXsoft, fontSize: 12 }}>Tidak ada jenis sampah</div>
          ) : (
            items.map((item, idx) => {
              const val = sampahData[kategori]?.[item.id]?.berat || 0;
              const sub = val * (item.harga || 0);
              return (
                <div key={item.id} style={{ ...S.sampahRow, borderTop: idx > 0 ? "1px solid rgba(0,0,0,0.04)" : "none" }}>
                  <div style={{ flex: 1 }}>
                    <div style={S.sampahName}>{item.sub_jenis}</div>
                    <div style={S.sampahPrice}>Rp {(item.harga || 0).toLocaleString("id-ID")}/kg</div>
                    {sub > 0 && <div style={{ ...S.sampahPrice, color }}>=  Rp {sub.toLocaleString("id-ID")}</div>}
                  </div>
                  <div style={S.sampahInputWrap}>
                    <input
                      type="number"
                      placeholder="0"
                      value={val || ""}
                      step="0.1"
                      min="0"
                      onChange={(e) => onInputChange(kategori, item.id, e.target.value)}
                      style={{ ...S.sampahInput, borderColor: val > 0 ? color + "55" : "rgba(0,0,0,0.1)", outlineColor: color }}
                    />
                    <span style={S.sampahUnit}>kg</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ totalBerat, totalHarga, onSubmit, submitting, loadingPrice }) {
  return (
    <div style={S.summaryCard}>
      <div style={S.summaryRow}>
        <div style={S.summaryItem}>
          <div style={S.summaryLabel}>Total Berat</div>
          <div style={S.summaryValue}>{totalBerat.toFixed(2)} <span style={S.summaryUnit}>kg</span></div>
        </div>
        <div style={{ width: 1, background: T.border, alignSelf: "stretch" }} />
        <div style={{ ...S.summaryItem, textAlign: "right" }}>
          <div style={S.summaryLabel}>Total Estimasi</div>
          <div style={S.summaryValue}>Rp <span style={{ fontSize: 18 }}>{totalHarga.toLocaleString("id-ID")}</span></div>
        </div>
      </div>
      <button
        style={{ ...S.submitBtn, opacity: submitting || loadingPrice ? 0.6 : 1 }}
        onClick={onSubmit}
        disabled={submitting || loadingPrice}
      >
        {submitting ? (
          <><div style={S.btnSpinner} /> Mengirim...</>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8 }}>
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
            Kirim ke Admin
          </>
        )}
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
function TrackingUser() {
  const history = useHistory();
  const location = useLocation();
  const storedOrder = sessionStorage.getItem("tracking_order");
  const initialOrder = location.state?.order || (storedOrder ? JSON.parse(storedOrder) : null);

  // ── ALL ORIGINAL STATE (preserved) ──
  const [order, setOrder] = useState(initialOrder);
  const driverId = localStorage.getItem("userId");
  const driverName = localStorage.getItem("nama") || "Petugas";
  const orderId = order?.id;
  const userProfile = useMemo(() => getProfile("user", order), [order]);
  const petugasProfile = useMemo(() => getProfile("petugas"), []);
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

  // Routing/caching refs (PRESERVED)
  const routeCacheRef = useRef(new Map());
  const lastRouteTimeRef = useRef(0);
  const inFlightRef = useRef(false);
  const abortControllerRef = useRef(null);
  const lastFetchedPositionsRef = useRef(null);

  const MIN_ROUTE_INTERVAL = 5000;
  const MOVE_THRESHOLD_METERS = 50;

  const roundCoord = (v) => Math.round(v * 100000) / 100000;
  const coordKey = (a, b) => `${roundCoord(a[0])},${roundCoord(a[1])}_${roundCoord(b[0])},${roundCoord(b[1])}`;

  const haversine = (a, b) => {
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(b[0] - a[0]), dLon = toRad(b[1] - a[1]);
    const lat1 = toRad(a[0]), lat2 = toRad(b[0]), R = 6371000;
    const x = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
  };

  const snapPoint = async (lat, lng, signal) => {
    try {
      const r = await fetch(`https://router.project-osrm.org/nearest/v1/driving/${lng},${lat}`, { signal });
      const j = await r.json();
      if (j?.waypoints?.length > 0 && j.waypoints[0].location) {
        const [sl, so] = j.waypoints[0].location;
        return [so, sl];
      }
    } catch (e) {}
    return [lat, lng];
  };

  const chooseBestRoute = (routes) => {
    if (!routes?.length) return null;
    const scored = routes.map(r => {
      let steps = 0;
      if (r.legs) r.legs.forEach(leg => { if (leg.steps) steps += leg.steps.length; });
      return { r, score: (r.duration || 0) + steps * 2 };
    });
    scored.sort((a, b) => a.score - b.score);
    return scored[0].r;
  };

  const fetchRouteManaged = useCallback(async (from, to) => {
    if (!from || !to) return;
    const now = Date.now();
    const key = coordKey(from, to);
    const cache = routeCacheRef.current.get(key);
    if (cache && now - cache.ts < 60 * 1000) { setRouteGeoJson(cache.geo); return; }
    if (inFlightRef.current && now - lastRouteTimeRef.current < MIN_ROUTE_INTERVAL) return;
    const distMoved = lastFetchedPositionsRef.current
      ? Math.max(haversine(lastFetchedPositionsRef.current.from, from), haversine(lastFetchedPositionsRef.current.to, to))
      : Infinity;
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
      if (data?.routes?.length > 0) {
        const best = chooseBestRoute(data.routes);
        if (best?.geometry) {
          setRouteGeoJson(best.geometry);
          routeCacheRef.current.set(key, { geo: best.geometry, ts: Date.now() });
        }
      } else {
        setRouteGeoJson({ type: "LineString", coordinates: [[from[1], from[0]], [to[1], to[0]]] });
      }
      lastFetchedPositionsRef.current = { from, to };
    } catch (err) {
      if (err.name === "AbortError") return;
      setRouteGeoJson({ type: "LineString", coordinates: [[from[1], from[0]], [to[1], to[0]]] });
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

  // ── ALL ORIGINAL EFFECTS (preserved) ──
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const kategoris = ["organik", "anorganik", "lainnya"];
        const prices = {};
        for (const kategori of kategoris) {
          try { const response = await hargaAPI.getByJenis(kategori); prices[kategori] = response.data; }
          catch (err) { prices[kategori] = []; }
        }
        setHargaList(prices);
        const initialized = {};
        Object.keys(prices).forEach(kategori => {
          initialized[kategori] = {};
          prices[kategori].forEach(item => { initialized[kategori][item.id] = { harga: item.harga, berat: 0 }; });
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
      const response = await ordersAPI.getOrderDetail(orderId);
      const updated = response.data;
      if (updated) {
        setOrder(updated);
        setOrderStatus(updated.status);
        setUserAddress(updated.address || "");
        if (updated.user_lat != null && updated.user_lng != null) {
          setUserLocation([Number(updated.user_lat), Number(updated.user_lng)]);
        }
        sessionStorage.setItem("tracking_order", JSON.stringify(updated));
      }
    } catch (err) {
      console.error("Error fetching order status:", err);
    }
  }, [orderId]);

  const updateOrderStatus = useCallback(async (newStatus) => {
    if (!orderId || !driverId) return;
    try {
      const response = await ordersAPI.updateOrderStatus(orderId, { driver_id: parseInt(driverId), status: newStatus });
      if (response.data.status === "success") setOrderStatus(newStatus);
    } catch (err) { console.error("Error updating order status:", err); }
  }, [driverId, orderId]);

  const sendDriverLocation = useCallback(async (lat, lng) => {
    if (!orderId || !driverId) return;
    try { await locationAPI.sendDriverLocation({ driver_id: parseInt(driverId), order_id: orderId, lat, lng }); }
    catch (err) { console.error("Error sending driver location:", err); }
  }, [driverId, orderId]);

  useEffect(() => {
    if (!order?.id) { history.push("/driver/dashboard"); return; }
    fetchOrderStatus();
    const interval = setInterval(fetchOrderStatus, 3000);
    return () => clearInterval(interval);
  }, [order?.id, history, fetchOrderStatus]);

  useEffect(() => {
    if (!navigator.geolocation || !order?.id) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude), lng = Number(pos.coords.longitude);
        setDriverLocation([lat, lng]);
        if (orderStatus !== "completed") sendDriverLocation(lat, lng);
      },
      (err) => console.error("Geolocation error:", err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [order?.id, orderStatus, sendDriverLocation]);

  useEffect(() => {
    if (!driverLocation || !userLocation) { setRouteGeoJson(null); return; }
    fetchRouteManaged(driverLocation, userLocation);
  }, [driverLocation, userLocation, fetchRouteManaged]);

  // Smooth marker interpolation (PRESERVED)
  useEffect(() => {
    let rafId = null, start = null;
    const DURATION = 800;
    const from = driverSmoothPos || driverLocation || null;
    const to = driverLocation;
    if (!to) return;
    if (!from) { setDriverSmoothPos(to); return; }
    const step = (ts) => {
      if (!start) start = ts;
      const t = Math.min(1, (ts - start) / DURATION);
      setDriverSmoothPos([from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]);
      if (t < 1) rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => { if (rafId) cancelAnimationFrame(rafId); };
  }, [driverLocation]);

  useEffect(() => {
    let rafId = null, start = null;
    const DURATION = 800;
    const from = userSmoothPos || userLocation || null;
    const to = userLocation;
    if (!to) return;
    if (!from) { setUserSmoothPos(to); return; }
    const step = (ts) => {
      if (!start) start = ts;
      const t = Math.min(1, (ts - start) / DURATION);
      setUserSmoothPos([from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]);
      if (t < 1) rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => { if (rafId) cancelAnimationFrame(rafId); };
  }, [userLocation]);

  // Kecamatan GeoJSON (PRESERVED)
  useEffect(() => {
    const tryFetchKecamatan = async () => {
      const candidates = ["/api/geojson/all", "/api/geojson/kecamatan_all.geojson", "/uploads/kecamatan_all.geojson", "/uploads/kecamatan.geojson", "/api/kecamatan/get_all"];
      for (const path of candidates) {
        try {
          const res = await fetch(path);
          if (!res.ok) continue;
          const json = await res.json();
          if (json && (json.type === "FeatureCollection" || json.features)) { setKecamatanGeoJson(json); return; }
        } catch (e) {}
      }
    };
    tryFetchKecamatan();
  }, []);

  // ── ALL ORIGINAL HANDLERS (preserved) ──
  const handleRefreshLocation = async () => {
    if (!order) return;
    try {
      await fetchOrderStatus();
    } catch (err) {
      console.error("Error refreshing location:", err);
    }
  };
  

  const handlePetugasSampai = async () => {
    try {
      const response = await ordersAPI.updateOrderStatus(order.id, { driver_id: parseInt(driverId), status: "arrived" });
      if (response.data.status === "success") { setOrderStatus("arrived"); setShowForm(true); }
      else alert(response.data.message || "Gagal update status");
    } catch (err) {
      console.error("Error updating status:", err);
      alert("Gagal update status: " + (err.response?.data?.message || err.message));
    }
  };

  useEffect(() => { if (orderStatus === "arrived") setShowForm(true); }, [orderStatus]);

  const handleInputChange = (kategori, itemId, berat) => {
    const numValue = parseFloat(berat) || 0;
    setSampahData(prev => ({ ...prev, [kategori]: { ...prev[kategori], [itemId]: { harga: prev[kategori][itemId].harga, berat: numValue } } }));
  };

  useEffect(() => {
    let totalB = 0, totalH = 0;
    Object.keys(sampahData).forEach(k => Object.keys(sampahData[k]).forEach(id => {
      const item = sampahData[k][id];
      totalB += item.berat || 0;
      totalH += (item.berat * item.harga) || 0;
    }));
    setTotalBerat(totalB);
    setTotalHarga(totalH);
  }, [sampahData]);

  const handleSubmitSampah = async () => {
    setSubmitting(true);
    try {
      const response = await ordersAPI.updateOrderStatus(order.id, {
        driver_id: parseInt(driverId), status: "completed",
        sampah_data: sampahData, total_berat: totalBerat, total_harga: totalHarga,
      });
      if (response.data.status === "success") {
        alert("Data sampah berhasil dikirim ke admin untuk konfirmasi!");
        history.push("/driver/dashboard");
      } else alert(response.data.message || "Gagal mengirim data");
    } catch (err) {
      console.error("Error submitting sampah:", err);
      alert("Gagal mengirim data: " + (err.response?.data?.message || err.message));
    } finally { setSubmitting(false); }
  };

  if (!order) return null;

  const currentUserLocation = order.user_lat && order.user_lng ? [order.user_lat, order.user_lng] : userLocation;
  const center = useMemo(() => driverLocation || currentUserLocation || [-7.8, 110.3], [driverLocation, currentUserLocation]);

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <>
      <style>{CSS}</style>
      <div style={S.root}>

        {/* ── LEFT: Map ── */}
        <div style={S.mapPanel}>
          {/* Header overlay on map */}
          <div style={S.mapHeader}>
            <button style={S.backBtn} onClick={() => history.goBack()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <div style={S.mapTitle}>
              <div style={S.mapTitleLabel}>K-TRASH Tracking</div>
              <div style={S.mapTitleSub}>Order #{order.id} · Real-time</div>
            </div>
            <button style={S.refreshBtn} onClick={handleRefreshLocation} title="Refresh lokasi">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.green600} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </button>
            <button style={{ ...S.refreshBtn, marginLeft: 8 }} onClick={() => history.push('/driver/profile')} title="Profil Saya">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.green600} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </button>
          </div>

          {/* Fullscreen map */}
          <style>{MAP_MODERN_CSS}</style>
          <MapContainer center={center} zoom={15} style={{ height: "100%", width: "100%" }} {...MAP_OPTIONS}>
            <TileLayer {...getTileLayerProps()} />
            <ChangeView center={center} zoom={15} />

            {kecamatanGeoJson && (
              <GeoJSON data={kecamatanGeoJson} style={{ color: T.green600, weight: 1, fillOpacity: 0.03, opacity: 0.4 }} smoothFactor={1} />
            )}

            {(driverSmoothPos || driverLocation) && (
              <Marker position={driverSmoothPos || driverLocation} icon={blueIcon}>
                <Popup>🚗 Lokasi Anda (Petugas)</Popup>
              </Marker>
            )}

            {(userSmoothPos || currentUserLocation) && (
              <Marker position={userSmoothPos || currentUserLocation} icon={redIcon}>
                <Popup>👤 Lokasi User — {userAddress || order.address}</Popup>
              </Marker>
            )}

            {routeGeoJson ? (
              <GeoJSON
                key={JSON.stringify(routeGeoJson)}
                data={routeGeoJson}
                style={{ color: T.green500, weight: 5, opacity: 0.92, lineCap: "round" }}
              />
            ) : (driverLocation && currentUserLocation && (
              <Polyline positions={[driverLocation, currentUserLocation]} pathOptions={{ color: T.green500, weight: 5, dashArray: "8 6" }} />
            ))}

            <FitRouteBounds
              driverLocation={driverSmoothPos || driverLocation}
              userLocation={userSmoothPos || currentUserLocation}
              routeGeoJson={routeGeoJson}
            />
          </MapContainer>

          <MapOverlay orderStatus={orderStatus} driverLocation={driverLocation} order={order} />
        </div>

        {/* ── RIGHT: Order Panel ── */}
        <div style={S.panel} className="tracking-panel-scroll">

          {/* Customer Card */}
          <div style={{ padding: "20px 20px 0" }}>
            <CustomerCard
              order={order}
              driverName={driverName}
              driverId={driverId}
              orderStatus={orderStatus}
              customerProfile={userProfile}
              driverProfile={petugasProfile}
            />
          </div>

          {/* Status Stepper */}
          <div style={{ padding: "16px 20px 0" }}>
            <div style={S.sectionLabel}>Progres Order</div>
            <StatusStepper status={orderStatus} />
          </div>

          {/* CTA Button */}
          {!showForm && (orderStatus === "assigned" || orderStatus === "on_the_way") && (
            <div style={{ padding: "16px 20px 0" }}>
              <button style={S.arrivedBtn} onClick={handlePetugasSampai}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8 }}>
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                Petugas Sampai
              </button>
            </div>
          )}

          {orderStatus === "completed" && !showForm && (
            <div style={{ padding: "16px 20px 0" }}>
              <div style={S.completedBanner}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.green600} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Order selesai — menunggu konfirmasi admin
              </div>
            </div>
          )}

          {/* Sampah Form */}
          {showForm && (
            <div style={{ padding: "16px 20px 0" }}>
              <div style={S.sectionLabel}>Input Data Sampah</div>

              {loadingPrice ? (
                <div style={S.loadingWrap}>
                  <div style={S.spinner} />
                  <span style={{ color: T.textSoft, fontSize: 13 }}>Memuat data harga...</span>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {Object.keys(hargaList).map(kategori => (
                    <SampahCategoryBlock
                      key={kategori}
                      kategori={kategori}
                      items={hargaList[kategori]}
                      sampahData={sampahData}
                      onInputChange={handleInputChange}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Summary + Submit */}
          {showForm && (
            <div style={{ padding: "16px 20px 24px" }}>
              <SummaryCard
                totalBerat={totalBerat}
                totalHarga={totalHarga}
                onSubmit={handleSubmitSampah}
                submitting={submitting}
                loadingPrice={loadingPrice}
              />
            </div>
          )}

          {/* Bottom spacer */}
          {!showForm && <div style={{ height: 24 }} />}
        </div>
      </div>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  root: {
    display: "flex",
    height: "100vh",
    width: "100vw",
    overflow: "hidden",
    background: T.bg,
    fontFamily: "'Outfit', 'DM Sans', 'Segoe UI', sans-serif",
  },

  // Map
  mapPanel: {
    flex: "1 1 65%",
    position: "relative",
    overflow: "hidden",
    background: "#1a2e1a",
  },
  mapHeader: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    zIndex: 900,
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "16px 20px",
    background: "linear-gradient(to bottom, rgba(5,46,22,0.75) 0%, transparent 100%)",
    backdropFilter: "blur(2px)",
  },
  backBtn: {
    width: 36, height: 36,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.92)",
    border: "none",
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer",
    color: T.green800,
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
    flexShrink: 0,
    transition: "all 0.15s",
  },
  mapTitle: { flex: 1 },
  mapTitleLabel: { fontSize: 14, fontWeight: 800, color: "#fff", letterSpacing: "0.02em" },
  mapTitleSub: { fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 1 },
  refreshBtn: {
    width: 36, height: 36,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.92)",
    border: "none",
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
    flexShrink: 0,
  },
  mapBadge: {
    position: "absolute",
    bottom: 24, left: "50%",
    transform: "translateX(-50%)",
    zIndex: 800,
    display: "flex", alignItems: "center", gap: 7,
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(12px)",
    border: `1px solid ${T.borderStrong}`,
    borderRadius: 50,
    padding: "8px 16px",
    boxShadow: T.shadowMd,
    whiteSpace: "nowrap",
  },
  mapOrderChip: {
    position: "absolute",
    top: 76, right: 16,
    zIndex: 800,
    display: "flex", alignItems: "center", gap: 5,
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(12px)",
    border: `1px solid ${T.border}`,
    borderRadius: 50,
    padding: "5px 11px",
    boxShadow: T.shadow,
  },
  mapDebugChip: {
    position: "absolute",
    bottom: 66, left: 16,
    zIndex: 800,
    background: "rgba(5,46,22,0.7)",
    backdropFilter: "blur(8px)",
    border: "1px solid rgba(34,197,94,0.2)",
    borderRadius: 7,
    padding: "4px 9px",
    fontSize: 10,
    fontFamily: "'JetBrains Mono', monospace",
    color: "#94a3b8",
    letterSpacing: "0.02em",
  },

  // Panel
  panel: {
    flex: "0 0 380px",
    width: 380,
    background: T.panel,
    borderLeft: `1px solid ${T.border}`,
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
  },

  // Customer card
  customerCard: {
    background: T.surface,
    borderRadius: T.radius,
    border: `1px solid ${T.border}`,
    padding: 16,
    boxShadow: T.shadow,
  },
  customerTop: {
    display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14,
  },
  customerAvatar: {
    width: 40, height: 40,
    borderRadius: 12,
    background: `linear-gradient(135deg,${T.green500},${T.green700})`,
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
    boxShadow: `0 4px 12px ${T.greenGlow}`,
  },
  customerLabel: { fontSize: 10, color: T.textXsoft, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 },
  customerName: { fontSize: 14, fontWeight: 800, color: T.text, lineHeight: 1.2 },
  customerAddress: { fontSize: 11, color: T.textSoft, marginTop: 2, lineHeight: 1.4 },
  statusPill: {
    fontSize: 10, fontWeight: 700,
    padding: "4px 10px", borderRadius: 50,
    border: "1px solid",
    display: "flex", alignItems: "center",
    flexShrink: 0,
    letterSpacing: "0.03em",
  },
  divider: { height: 1, background: T.border, marginBottom: 12 },
  driverRow: {
    display: "flex", alignItems: "center", gap: 10,
  },
  driverBubble: {
    width: 32, height: 32, borderRadius: 9,
    background: `linear-gradient(135deg,${T.green400},${T.green600})`,
    color: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 13, fontWeight: 800, flexShrink: 0,
  },
  driverName: { fontSize: 13, fontWeight: 700, color: T.text, flex: 1 },
  driverId: { fontSize: 10, color: T.textSoft },
  orderIdTag: {
    fontSize: 10, fontWeight: 700,
    color: T.green700,
    background: T.greenGlow,
    border: `1px solid ${T.border}`,
    borderRadius: 6, padding: "3px 8px",
    flexShrink: 0,
  },

  // Stepper
  stepper: {
    display: "flex", alignItems: "center",
    padding: "14px 4px",
    background: T.surface,
    borderRadius: T.radius,
    border: `1px solid ${T.border}`,
    boxShadow: T.shadow,
  },
  stepItem: {
    display: "flex", flexDirection: "column", alignItems: "center", flex: 1, gap: 6,
  },
  stepCircle: {
    width: 26, height: 26, borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "all 0.3s ease",
  },
  stepLabel: {
    fontSize: 9, textAlign: "center",
    letterSpacing: "0.02em",
    lineHeight: 1.2, maxWidth: 52,
  },
  stepLine: {
    height: 2, flex: 0.6, borderRadius: 1,
    transition: "background 0.3s ease",
    marginBottom: 20,
  },

  // Section label
  sectionLabel: {
    fontSize: 10, fontWeight: 800,
    color: T.textSoft, textTransform: "uppercase",
    letterSpacing: "0.1em", marginBottom: 10,
  },

  // Arrived button
  arrivedBtn: {
    width: "100%", padding: "14px 0",
    background: `linear-gradient(135deg,${T.green500},${T.green700})`,
    color: "#fff", border: "none",
    borderRadius: T.radiusSm,
    fontSize: 14, fontWeight: 800,
    cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: `0 6px 20px ${T.greenGlow}, 0 2px 6px rgba(0,0,0,0.1)`,
    letterSpacing: "0.02em",
    transition: "all 0.2s",
  },

  // Completed banner
  completedBanner: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "12px 14px",
    background: T.greenGlow2,
    border: `1px solid ${T.border}`,
    borderRadius: T.radiusSm,
    fontSize: 12, fontWeight: 600,
    color: T.green700,
  },

  // Category block
  categoryBlock: {
    background: T.surface,
    border: "1px solid",
    borderRadius: T.radiusSm,
    overflow: "hidden",
    boxShadow: T.shadow,
  },
  categoryHeader: {
    width: "100%", border: "none",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "12px 14px",
    cursor: "pointer",
    transition: "all 0.15s",
  },

  // Sampah rows
  sampahRow: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "10px 14px",
    transition: "background 0.15s",
  },
  sampahName: { fontSize: 12, fontWeight: 600, color: T.text, lineHeight: 1.3 },
  sampahPrice: { fontSize: 10, color: T.textSoft, marginTop: 1 },
  sampahInputWrap: {
    display: "flex", alignItems: "center", gap: 4,
    flexShrink: 0,
  },
  sampahInput: {
    width: 72, padding: "7px 8px",
    background: T.bg,
    border: "1.5px solid",
    borderRadius: 9,
    fontSize: 13, fontWeight: 700,
    color: T.text,
    textAlign: "right",
    outline: "none",
    transition: "border-color 0.15s",
    fontFamily: "'JetBrains Mono', monospace",
  },
  sampahUnit: { fontSize: 10, color: T.textSoft, fontWeight: 600 },

  // Summary card
  summaryCard: {
    background: T.surface,
    border: `1.5px solid ${T.borderStrong}`,
    borderRadius: T.radius,
    padding: 16,
    boxShadow: T.shadowMd,
  },
  summaryRow: {
    display: "flex", alignItems: "stretch", gap: 0,
    marginBottom: 14,
  },
  summaryItem: {
    flex: 1, padding: "4px 8px",
  },
  summaryLabel: { fontSize: 10, color: T.textSoft, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 },
  summaryValue: { fontSize: 22, fontWeight: 800, color: T.green700, lineHeight: 1, fontFamily: "'JetBrains Mono', monospace" },
  summaryUnit: { fontSize: 12, fontWeight: 600, color: T.green500 },

  submitBtn: {
    width: "100%", padding: "14px 0",
    background: `linear-gradient(135deg,${T.green500},${T.green700})`,
    color: "#fff", border: "none",
    borderRadius: T.radiusSm,
    fontSize: 14, fontWeight: 800,
    cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: `0 6px 20px ${T.greenGlow}`,
    letterSpacing: "0.02em",
    transition: "all 0.2s",
  },
  btnSpinner: {
    width: 14, height: 14,
    borderRadius: "50%",
    border: "2px solid rgba(255,255,255,0.3)",
    borderTop: "2px solid #fff",
    animation: "spin 0.7s linear infinite",
    marginRight: 8,
  },

  // Loading
  loadingWrap: {
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: 10, padding: "32px 0",
  },
  spinner: {
    width: 28, height: 28, borderRadius: "50%",
    border: `3px solid ${T.greenGlow}`,
    borderTop: `3px solid ${T.green500}`,
    animation: "spin 0.8s linear infinite",
  },
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');

  * { box-sizing: border-box; }

  .tracking-panel-scroll { scrollbar-width: thin; scrollbar-color: rgba(34,197,94,0.2) transparent; }
  .tracking-panel-scroll::-webkit-scrollbar { width: 4px; }
  .tracking-panel-scroll::-webkit-scrollbar-track { background: transparent; }
  .tracking-panel-scroll::-webkit-scrollbar-thumb { background: rgba(34,197,94,0.25); border-radius: 4px; }

  .leaflet-container { background: #0f1f0f !important; }
  .leaflet-control-zoom { display: none; }

  @keyframes spin { to { transform: rotate(360deg); } }

  @keyframes ecoPulse {
    0%, 100% { box-shadow: 0 0 0 3px rgba(34,197,94,0.3); }
    50% { box-shadow: 0 0 0 6px rgba(34,197,94,0.1); }
  }

  /* Hover states */
  button[style*="arrivedBtn"]:hover,
  button[style*="submitBtn"]:hover { filter: brightness(1.08); transform: translateY(-1px); }

  /* Mobile responsive */
  @media (max-width: 768px) {
    /* Force column on mobile — handled via JS/CSS override if needed */
    body .tracking-root { flex-direction: column !important; }
  }
`;

export default TrackingUser;