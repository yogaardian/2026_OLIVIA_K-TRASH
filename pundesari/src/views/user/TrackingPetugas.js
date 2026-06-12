import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useHistory } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Polyline, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import { locationAPI } from "../../services/api";
import { getTileLayerProps, MAP_OPTIONS, MAP_MODERN_CSS } from "../../config/mapConfig";
import { getProfile } from "../../config/profileConfig";
import { useSocket } from "../../context/SocketContext";
import { useOrder } from "../../context/OrderContext";
import Sidebar from "../../components/Sidebar.jsx";
import "../../css/Dashboard.css";
import "../../css/sidebar.css";

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

const DEFAULT_CENTER = [-7.8, 110.3];

// ─── Design tokens (unified with DriverDashboard / TrackingUser / OrderDetail) ─
const T = {
  green800: "#14532d",
  green700: "#15803d",
  green600: "#16a34a",
  green500: "#22c55e",
  greenGlow:  "rgba(34,197,94,0.18)",
  greenGlow2: "rgba(34,197,94,0.08)",
  surface:  "#ffffff",
  bg:       "#ffffff",
  panel:    "#fafffe",
  border:       "rgba(34,197,94,0.15)",
  borderStrong: "rgba(34,197,94,0.3)",
  text:      "#0f172a",
  textMid:   "#334155",
  textSoft:  "#64748b",
  textXsoft: "#94a3b8",
  amber:     "#f59e0b",
  amberGlow: "rgba(245,158,11,0.12)",
  blue:      "#3b82f6",
  red:       "#ef4444",
  shadow:   "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(34,197,94,0.08)",
  shadowMd: "0 4px 24px rgba(34,197,94,0.12), 0 1px 4px rgba(0,0,0,0.06)",
  radius:   20,
  radiusSm: 12,
};

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  assigned:   { label: "Petugas Ditugaskan", icon: "📋", color: T.blue,    bg: "rgba(59,130,246,0.1)",  step: 0 },
  on_the_way: { label: "Menuju Lokasi Anda", icon: "🚗", color: T.green500, bg: T.greenGlow,             step: 1 },
  arrived:    { label: "Petugas Sudah Tiba", icon: "📍", color: T.amber,   bg: T.amberGlow,             step: 2 },
  completed:  { label: "Penjemputan Selesai",icon: "✅", color: T.green600, bg: T.greenGlow2,            step: 3 },
  approved:   { label: "Disetujui Admin",    icon: "🎉", color: T.green700, bg: T.greenGlow2,            step: 3 },
};
const STEPS = ["Ditugaskan", "Menuju Lokasi", "Tiba", "Selesai"];

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
    if (!center || !follow || map._userInteracted) return;
    map.setView(center, zoom);
  }, [map, center, zoom, follow]);
  return null;
}

function FitRouteBounds({ userLocation, driverLocation, routeGeoJson }) {
  const map = useMap();
  useEffect(() => {
    if (!map || (!userLocation && !driverLocation && !routeGeoJson)) return;
    let bounds = null;
    if (routeGeoJson && routeGeoJson.coordinates) {
      const coords = routeGeoJson.coordinates.map(([lng, lat]) => [lat, lng]);
      bounds = L.latLngBounds(coords);
    }
    if (!bounds && userLocation && driverLocation) {
      bounds = L.latLngBounds([userLocation, driverLocation]);
    }
    if (!bounds) return;
    if (userLocation) bounds.extend(userLocation);
    if (driverLocation) bounds.extend(driverLocation);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16, animate: true });
  }, [map, routeGeoJson, userLocation, driverLocation]);
  return null;
}

// ─── UI Sub-components ────────────────────────────────────────────────────────

function StatusStepper({ status }) {
  const activeStep = STATUS_CONFIG[status]?.step ?? 0;
  return (
    <div style={S.stepper}>
      {STEPS.map((label, i) => {
        const done = i < activeStep, active = i === activeStep;
        return (
          <React.Fragment key={label}>
            <div style={S.stepItem}>
              <div style={{
                ...S.stepCircle,
                background: done ? T.green600 : active ? `linear-gradient(135deg,${T.green500},${T.green700})` : "rgba(0,0,0,0.06)",
                boxShadow: active ? `0 0 0 4px ${T.greenGlow}, 0 0 10px rgba(34,197,94,0.3)` : "none",
                border: done ? `2px solid ${T.green600}` : active ? "2px solid transparent" : "2px solid rgba(0,0,0,0.1)",
              }}>
                {done
                  ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  : <span style={{ width: 6, height: 6, borderRadius: "50%", background: active ? "#fff" : "rgba(0,0,0,0.2)", display: "block" }} />
                }
              </div>
              <div style={{ fontSize: 9, color: active ? T.green700 : done ? T.green600 : T.textXsoft, fontWeight: active ? 700 : done ? 600 : 400, textAlign: "center", maxWidth: 52, lineHeight: 1.2 }}>
                {label}
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ height: 2, flex: 0.6, borderRadius: 1, background: i < activeStep ? T.green500 : "rgba(0,0,0,0.08)", marginBottom: 20, transition: "background 0.3s" }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function DriverCard({ petugasProfile, driverInfo, orderStatus }) {
  const cfg = STATUS_CONFIG[orderStatus] || STATUS_CONFIG.assigned;
  const initials = (petugasProfile?.name || "P")[0].toUpperCase();
  return (
    <div style={S.card}>
      <div style={S.driverTop}>
        <div style={S.driverAvatarWrap}>
          <div style={S.driverAvatar}>
            {petugasProfile?.profilePhoto
              ? <img src={petugasProfile.profilePhoto} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
              : <span style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{initials}</span>
            }
          </div>
          <span style={S.onlinePulse} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={S.driverName}>{petugasProfile?.name || "Petugas"}</div>          <div style={S.driverMeta}>ID: {petugasProfile?.id || driverInfo?.id || "—"}</div>
          {(petugasProfile?.phoneNumber || driverInfo?.phone) && (
            <div style={S.driverPhone}>
              {petugasProfile?.phoneNumber || driverInfo?.phone}
            </div>
          )}
        </div>
        <div style={{ ...S.statusPill, background: cfg.bg, color: cfg.color, borderColor: cfg.color + "44" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color, display: "inline-block", marginRight: 5, animation: "ecoPulse 2s infinite", flexShrink: 0 }} />
          Aktif
        </div>
      </div>

      {/* Status banner */}
      <div style={{ ...S.statusBanner, background: cfg.bg, borderColor: cfg.color + "33" }}>
        <span style={{ fontSize: 16 }}>{cfg.icon}</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: cfg.color }}>{cfg.label}</div>
          <div style={{ fontSize: 10, color: T.textSoft }}>Status order saat ini</div>
        </div>
      </div>
    </div>
  );
}

function MapOverlayChips({ orderStatus, userAddress }) {
  const cfg = STATUS_CONFIG[orderStatus] || STATUS_CONFIG.assigned;
  return (
    <>
      <div style={S.mapChipTopLeft}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: T.green500, display: "inline-block", flexShrink: 0, animation: "ecoPulse 2s infinite" }} />
        K-TRASH Live Tracking
      </div>
      <div style={{ ...S.mapChipTopRight, background: cfg.bg.replace(")", ", 0.9)").replace("rgba", "rgba"), backdropFilter: "blur(12px)", borderColor: cfg.color + "44" }}>
        <span style={{ fontSize: 12 }}>{cfg.icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
      </div>
      {userAddress && (
        <div style={S.mapChipBottom}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={T.green600} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          <span style={{ fontSize: 11, color: T.green700, fontWeight: 600, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userAddress}</span>
        </div>
      )}
    </>
  );
}

function NotificationBanner({ type, onClose }) {
  const cfg = type === "arrived"
    ? { icon: "📍", title: "Petugas Sudah Tiba!", body: "Petugas sedang menunggu dan memproses sampahmu.", color: T.amber, bg: T.amberGlow, border: "rgba(245,158,11,0.3)" }
    : { icon: "✅", title: "Penjemputan Selesai!", body: "Data sudah dikirim, Anda akan diarahkan ke Dashboard.", color: T.green600, bg: T.greenGlow, border: T.borderStrong };
  return (
    <div style={{ ...S.notifBanner, background: cfg.bg, borderColor: cfg.border, color: cfg.color }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>{cfg.icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 800 }}>{cfg.title}</div>
        <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{cfg.body}</div>
      </div>
      <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: cfg.color, padding: 2, flexShrink: 0 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  );
}

function SampahModal({ show, onClose, sampahData, totalBerat, totalHarga, orderStatus }) {
  if (!show) return null;
  const catColors = { organik: T.green500, anorganik: T.blue, lainnya: T.amber };
  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={S.modalBox} onClick={e => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <div style={S.modalTitle}>
            <div style={S.modalTitleIcon}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.green600} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            Rincian Sampah
          </div>
          <button onClick={onClose} style={S.modalClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.textSoft} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={S.modalBody}>
          {sampahData ? (
            <>
              {Object.keys(sampahData).map(kategori => {
                const color = catColors[kategori] || T.green500;
                const items = sampahData[kategori];
                if (!items || Object.keys(items).length === 0) return null;
                return (
                  <div key={kategori} style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                      {kategori}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {Object.keys(items).map(itemId => {
                        const item = items[itemId];
                        const sub = item.berat * item.harga;
                        return (
                          <div key={itemId} style={S.sampahRow}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Item #{itemId}</div>
                              <div style={{ fontSize: 11, color: T.textSoft }}>{item.berat} kg × Rp {Number(item.harga).toLocaleString("id-ID")}</div>
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 700, color }}> Rp {sub.toLocaleString("id-ID")}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <div style={S.modalSummary}>
                <div style={S.summaryItem}>
                  <div style={S.summaryLabel}>Total Berat</div>
                  <div style={S.summaryValue}>{Number(totalBerat).toFixed(2)} <span style={{ fontSize: 12 }}>kg</span></div>
                </div>
                <div style={{ width: 1, background: T.border, alignSelf: "stretch" }} />
                <div style={{ ...S.summaryItem, textAlign: "right" }}>
                  <div style={S.summaryLabel}>Total Harga</div>
                  <div style={S.summaryValue}>Rp <span style={{ fontSize: 16 }}>{Number(totalHarga).toLocaleString("id-ID")}</span></div>
                </div>
              </div>

              {orderStatus === "completed" && (
                <div style={{ ...S.notifBanner, marginTop: 14, background: T.greenGlow2, borderColor: T.border, color: T.green700 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.green600} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span style={{ fontSize: 12 }}>Data sampah telah dikirim ke admin untuk verifikasi saldo Anda.</span>
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "32px 0", color: T.textSoft, fontSize: 13 }}>Belum ada data sampah</div>
          )}
        </div>

        <div style={S.modalFooter}>
          <button style={S.modalCloseBtn} onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>
  );
}

// ─── Loading Screen ───────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="dashboard-main">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "70vh", gap: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", border: `3px solid ${T.greenGlow}`, borderTop: `3px solid ${T.green500}`, animation: "spin 0.8s linear infinite" }} />
          <div style={{ fontSize: 14, color: T.textSoft, fontWeight: 600 }}>Memuat tracking...</div>
        </div>
      </main>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
function TrackingPetugas() {
  const history = useHistory();
  const orderId = sessionStorage.getItem("current_order_id");
  const { activeOrder } = useOrder();
  const { subscribe, joinOrderRoom, leaveOrderRoom, isConnected } = useSocket();

  const currentOrderId = orderId || activeOrder?.id;
  const activeUserLocation = useMemo(() => {
    if (!activeOrder?.user_lat || !activeOrder?.user_lng) return null;
    return [Number(activeOrder.user_lat), Number(activeOrder.user_lng)];
  }, [activeOrder]);

  // ── ALL ORIGINAL STATE (preserved) ──
  const [driverLocation, setDriverLocation] = useState(null);
  const [userLocation, setUserLocation] = useState(activeUserLocation);
  const [routeGeoJson, setRouteGeoJson] = useState(null);
  const [userAddress, setUserAddress] = useState(activeOrder?.address || "");
  const [driverInfo, setDriverInfo] = useState(null);
  const [orderStatus, setOrderStatus] = useState("assigned");
  const petugasProfile = useMemo(
    () => getProfile("petugas", driverInfo ? { driver_name: driverInfo.name, driver_phone: driverInfo.phone, driver_id: driverInfo.id } : null),
    [driverInfo]
  );
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
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

  useEffect(() => {
    if (!userLocation && activeUserLocation) {
      setUserLocation(activeUserLocation);
    }
    if (!userAddress && activeOrder?.address) {
      setUserAddress(activeOrder.address);
    }
  }, [activeUserLocation, activeOrder?.address, userAddress, userLocation]);

  // Routing refs (PRESERVED)
  const routeCacheRef = useRef(new Map());
  const lastRouteTimeRef = useRef(0);
  const inFlightRef = useRef(false);
  const abortControllerRef = useRef(null);
  const lastFetchedPositionsRef = useRef(null);
  const mapRef = useRef(null);
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
    if (cache && now - cache.ts < 60000) { setRouteGeoJson(cache.geo); return; }
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

  const orderStatusRef = useRef(orderStatus);

  const fetchTracking = useCallback(async () => {
    if (!currentOrderId) return;
    try {
      const response = await locationAPI.getTracking(currentOrderId);
      const data = response.data;

      // Support two response formats:
      // 1) Modern API returning an object with many fields (status === 'success', driver_lat, driver_lng, user_lat, ...)
      // 2) Legacy/simple endpoint that returns a single driver_locations row: { id, driver_id, order_id, lat, lng, created_at }
      if (data) {
        let latestDriver = null;

        // Format 1: explicit driver_lat/driver_lng or locations array
        if (data.driver_lat != null && data.driver_lng != null) {
          latestDriver = [Number(data.driver_lat), Number(data.driver_lng)];
        } else if (Array.isArray(data.locations) && data.locations.length > 0) {
          const lastLocation = data.locations[data.locations.length - 1];
          if (lastLocation?.lat != null && lastLocation?.lng != null) {
            latestDriver = [Number(lastLocation.lat), Number(lastLocation.lng)];
          }
        }

        // Format 2: direct row from driver_locations -> has lat & lng
        if (!latestDriver && data.lat != null && data.lng != null) {
          latestDriver = [Number(data.lat), Number(data.lng)];
        }

        if (latestDriver) setDriverLocation(latestDriver);

        // user location/address (may not be present from simple endpoint)
        if (data.user_lat != null && data.user_lng != null) {
          setUserLocation([Number(data.user_lat), Number(data.user_lng)]);
        } else if (activeUserLocation) {
          setUserLocation(activeUserLocation);
        }
        if (data.address) setUserAddress(data.address);

        // driver info (may only have driver_id in simple row)
        setDriverInfo({ name: data.driver_name || data.driver || "Petugas", id: data.driver_id || data.driver || null, phone: data.driver_phone || data.phone || "-" });

        const nextStatus = data.order_status || data.status || null;
        const normalizedStatus = nextStatus ? String(nextStatus).trim() : null;
        const effectiveStatus = normalizedStatus || orderStatusRef.current || activeOrder?.status || "assigned";
        if (normalizedStatus === "arrived" && orderStatusRef.current !== "arrived") setArrivedNotification(true);
        if (normalizedStatus) {
          orderStatusRef.current = normalizedStatus;
          setOrderStatus(normalizedStatus);
        } else if (!orderStatusRef.current) {
          orderStatusRef.current = effectiveStatus;
          setOrderStatus(effectiveStatus);
        }

        if (data.sampah_data) {
          setSampahData(data.sampah_data);
          setTotalBerat(data.total_berat || 0);
          setTotalHarga(data.total_harga || 0);
        }

        const finalUser = data.user_lat != null && data.user_lng != null
          ? [Number(data.user_lat), Number(data.user_lng)]
          : (activeUserLocation || userLocation);

        if (latestDriver && finalUser && mapRef.current) {
          try { mapRef.current.fitBounds([latestDriver, finalUser], { padding: [40, 40], maxZoom: 16, animate: true }); }
          catch (e) {}
        }
      }
    } catch (err) {
      console.error("Error fetching tracking:", err);
    } finally {
      setLoading(false);
    }
  }, [currentOrderId]);

  // ALL ORIGINAL EFFECTS (preserved)
  useEffect(() => {
    if (!currentOrderId) {
      history.push("/user/dashboard");
      return;
    }

    fetchTracking();
    const interval = setInterval(fetchTracking, 3000);
    return () => clearInterval(interval);
  }, [currentOrderId, history, fetchTracking]);

  useEffect(() => {
    console.log('[TRACKING PETUGAS] join room effect', { currentOrderId, isConnected });
    if (!currentOrderId || !isConnected) return;

    console.log('[TRACKING PETUGAS] joining order room', currentOrderId);
    joinOrderRoom(currentOrderId);

    return () => {
      if (currentOrderId) {
        console.log('[TRACKING PETUGAS] leaving order room on cleanup', currentOrderId);
        leaveOrderRoom(currentOrderId);
      }
    };
  }, [currentOrderId, isConnected, joinOrderRoom, leaveOrderRoom]);

  // Subscribe to realtime driver location updates via socket
  useEffect(() => {
    if (!subscribe || !currentOrderId) return;
    const unsubscribe = subscribe('driver:location_updated', (data) => {
      if (!data?.orderId || String(data.orderId) !== String(currentOrderId)) return;
      if (data.lat != null && data.lng != null) {
        setDriverLocation([Number(data.lat), Number(data.lng)]);
      }
    });
    return () => unsubscribe && unsubscribe();
  }, [subscribe, currentOrderId]);

  useEffect(() => {
    if (!subscribe || !currentOrderId) return;

    const extractOrderStatus = (data) => {
      if (!data) return null;
      if (data.order?.status) return data.order.status;
      if (data.status) return data.status;
      if (data.order_status) return data.order_status;
      return null;
    };

    const updateStatus = (nextStatus) => {
      if (!nextStatus) return;
      if (nextStatus === 'arrived' && orderStatusRef.current !== 'arrived') {
        setArrivedNotification(true);
      }
      orderStatusRef.current = nextStatus;
      setOrderStatus(nextStatus);
    };

    const handleOrderEvent = async (data, eventName) => {
      console.log('[TRACKING PETUGAS EVENT]', eventName, { data, currentOrderId });
      if (!data) return;
      const eventOrderId = data.order?.id || data.orderId || data.order_id || data.orderId;
      if (eventOrderId && String(eventOrderId) !== String(currentOrderId)) return;

      const nextStatus = extractOrderStatus(data) || {
        'order:accepted': 'on_the_way',
        'order:on_the_way': 'on_the_way',
        'order:arrived': 'arrived',
        'order:completed': 'completed',
      }[eventName];
      if (nextStatus) {
        console.log('[TRACKING PETUGAS] order event mapped nextStatus', { eventName, nextStatus });
        updateStatus(nextStatus);
      } else {
        console.log('[TRACKING PETUGAS] order event no status mapping, fetching tracking', eventName);
        await fetchTracking();
      }

      const sourceOrder = data.order || {};
      if (sourceOrder.sampah_data) {
        setSampahData(sourceOrder.sampah_data);
        setTotalBerat(sourceOrder.total_berat || 0);
        setTotalHarga(sourceOrder.total_harga || 0);
      }
    };

    const events = [
      'order:state',
      'order:status_changed',
      'order:accepted',
      'order:on_the_way',
      'order:arrived',
      'order:completed',
    ];

    const unsubs = events.map((eventName) => subscribe(eventName, (data) => handleOrderEvent(data, eventName))).filter(Boolean);
    return () => unsubs.forEach((unsubscribe) => unsubscribe && unsubscribe());
  }, [subscribe, currentOrderId, fetchTracking]);

  useEffect(() => {
    if (orderStatus === "completed" && !completedRedirected) {
      setCompletedNotification(true);
      const t = setTimeout(() => { setCompletedRedirected(true); history.push("/user/dashboard"); }, 2500);
      return () => clearTimeout(t);
    }
  }, [orderStatus, completedRedirected, history]);

  useEffect(() => {
    if (!driverLocation || !userLocation) { setRouteGeoJson(null); return; }
    fetchRouteManaged(userLocation, driverLocation);
  }, [driverLocation, userLocation, fetchRouteManaged]);

  // Smooth interpolation (PRESERVED)
  useEffect(() => {
    let rafId = null, start = null;
    const DURATION = 800;
    const from = driverSmoothPos || driverLocation || null, to = driverLocation;
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
    const from = userSmoothPos || userLocation || null, to = userLocation;
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
    const tryFetch = async () => {
      for (const path of ["/api/geojson/all", "/api/geojson/kecamatan_all.geojson", "/uploads/kecamatan_all.geojson", "/uploads/kecamatan.geojson"]) {
        try {
          const res = await fetch(path);
          if (!res.ok) continue;
          const json = await res.json();
          if (json && (json.type === "FeatureCollection" || json.features)) { setKecamatanGeoJson(json); return; }
        } catch (e) {}
      }
    };
    tryFetch();
  }, []);

  const handleRefreshLocation = async () => {
    if (!currentOrderId) return;
    setIsRefreshing(true);
    try {
      await fetchTracking();
      const target = driverSmoothPos || driverLocation;
      if (mapRef.current && target) {
        try { mapRef.current.setView(target, 16, { animate: true }); }
        catch (e) { /* ignore */ }
      }
    } catch (err) {
      console.error('Refresh location failed:', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 300);
    }
  };
  const handleCancel = () => { history.push("/user/dashboard"); };

  const currentUserLocation = userSmoothPos || userLocation || activeUserLocation;
  const currentDriverLocation = driverSmoothPos || driverLocation;
  const center = useMemo(() => currentDriverLocation || currentUserLocation || DEFAULT_CENTER, [currentDriverLocation, currentUserLocation]);

  const isOverlap = useMemo(() => {
    if (!currentUserLocation || !currentDriverLocation) return false;
    try {
      return haversine(currentUserLocation, currentDriverLocation) < 10; // meters
    } catch (e) { return false; }
  }, [currentUserLocation, currentDriverLocation]);
  if (loading) return <LoadingScreen />;

console.log("=== TRACKING DEBUG ===");
console.log("currentOrderId:", currentOrderId);
console.log("driverLocation:", driverLocation);
console.log("userLocation:", userLocation);
console.log("routeGeoJson:", routeGeoJson);
console.log("driverInfo:", driverInfo);
console.log("orderStatus:", orderStatus);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <style>{CSS}</style>
      <div className="dashboard-layout">
        <Sidebar />
        <main className="dashboard-main" style={{ background: T.bg, minHeight: "100vh" }}>
          <div style={S.pageWrap}>

            {/* ── Header ── */}
            <div style={S.header}>
              <button style={S.backBtn} onClick={() => history.goBack()}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.green800} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
              <div>
                <div style={S.headerTitle}>Tracking Petugas</div>
                <div style={S.headerSub}>Pantau lokasi petugas secara realtime</div>
              </div>
              <button style={S.profileBtn} onClick={() => history.push("/user/profile")}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.green700} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                Profil
              </button>
            </div>

            {/* ── Notifications ── */}
            {arrivedNotification && (
              <NotificationBanner type="arrived" onClose={() => setArrivedNotification(false)} />
            )}
            {completedNotification && (
              <NotificationBanner type="completed" onClose={() => setCompletedNotification(false)} />
            )}

            {/* ── Driver card + Stepper ── */}
            {driverInfo && (
              <DriverCard petugasProfile={petugasProfile} driverInfo={driverInfo} orderStatus={orderStatus} />
            )}

            <div style={{ ...S.card, padding: "14px 16px" }}>
              <div style={S.sectionLabel}>Progres Order</div>
              <StatusStepper status={orderStatus} />
            </div>

            {/* ── Map ── */}
            <div style={S.mapCard}>
              <style>{MAP_MODERN_CSS}</style>
              <MapContainer
                center={center} zoom={15}
                style={{ height: "100%", width: "100%" }}
                  {...MAP_OPTIONS}
                  whenCreated={(m) => (mapRef.current = m)}
                zoomControl={false}
              >
                <TileLayer {...getTileLayerProps()} />
                <ChangeView center={center} zoom={15} />

                {kecamatanGeoJson && (
                  <GeoJSON data={kecamatanGeoJson} style={{ color: T.green600, weight: 1, fillOpacity: 0.03, opacity: 0.35 }} smoothFactor={1} />
                )}

                {currentUserLocation && (
                  <Marker position={currentUserLocation} icon={redIcon} zIndexOffset={isOverlap ? -1000 : 0}>
                    <Popup>📍 Lokasi Anda — {userAddress || "Alamat Anda"}</Popup>
                  </Marker>
                )}

                {currentDriverLocation && (
                  <Marker position={currentDriverLocation} icon={blueIcon} zIndexOffset={isOverlap ? 1000 : 0}>
                    <Popup>🚗 Lokasi Petugas</Popup>
                  </Marker>
                )}

                {routeGeoJson ? (
                  <GeoJSON
                    key={JSON.stringify(routeGeoJson)}
                    data={routeGeoJson}
                    style={{ color: T.green500, weight: 5, opacity: 0.9, lineCap: "round" }}
                  />
                ) : (currentDriverLocation && currentUserLocation && (
                  <Polyline positions={[currentUserLocation, currentDriverLocation]} pathOptions={{ color: T.green500, weight: 5, dashArray: "8 6" }} />
                ))}

                <FitRouteBounds
                  userLocation={currentUserLocation}
                  driverLocation={currentDriverLocation}
                  routeGeoJson={routeGeoJson}
                />
              </MapContainer>

              <MapOverlayChips orderStatus={orderStatus} userAddress={userAddress} />
            </div>

            {/* ── Action Buttons ── */}
            <div style={S.actions}>
              <button style={S.refreshBtn2} onClick={handleRefreshLocation} disabled={isRefreshing}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.green700} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                  <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
                {isRefreshing ? 'Memuat...' : 'Muat Ulang Lokasi'}
              </button>

              {(orderStatus === "arrived" || orderStatus === "completed") && sampahData && (
                <button style={S.sampahBtn} onClick={() => setShowSampahModal(true)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                  Rincian Sampah
                </button>
              )}

              {(orderStatus === "approved" || orderStatus === "completed") && (
                <button style={S.doneBtn} onClick={() => history.push("/user/dashboard")}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Selesai
                </button>
              )}
            </div>
          </div>
        </main>
      </div>

      <SampahModal
        show={showSampahModal}
        onClose={() => setShowSampahModal(false)}
        sampahData={sampahData}
        totalBerat={totalBerat}
        totalHarga={totalHarga}
        orderStatus={orderStatus}
      />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  pageWrap: {
    maxWidth: 720, margin: "0 auto",
    padding: "24px 20px 48px",
    display: "flex", flexDirection: "column", gap: 14,
  },

  // Header
  header: {
    display: "flex", alignItems: "center", gap: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: "50%",
    background: T.surface,
    border: `1px solid ${T.border}`,
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", flexShrink: 0,
    boxShadow: T.shadow,
    transition: "all 0.15s",
  },
  headerTitle: { fontSize: 17, fontWeight: 800, color: T.text },
  headerSub: { fontSize: 11, color: T.textSoft, marginTop: 1 },
  profileBtn: {
    marginLeft: "auto", display: "flex", alignItems: "center", gap: 6,
    padding: "7px 14px",
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: 50, fontSize: 12, fontWeight: 600,
    color: T.green700, cursor: "pointer",
    boxShadow: T.shadow, flexShrink: 0,
    transition: "all 0.15s",
  },

  // Card base
  card: {
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: T.radius,
    padding: 16,
    boxShadow: T.shadow,
  },

  // Driver card
  driverTop: { display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  driverAvatarWrap: { position: "relative", flexShrink: 0 },
  driverAvatar: {
    width: 50, height: 50, borderRadius: "50%",
    background: `linear-gradient(135deg,${T.green500},${T.green800})`,
    display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: `0 4px 14px ${T.greenGlow}`,
    overflow: "hidden",
  },
  onlinePulse: {
    position: "absolute", bottom: 2, right: 2,
    width: 11, height: 11, borderRadius: "50%",
    background: T.green500, border: `2px solid ${T.surface}`,
    animation: "ecoPulse 2s infinite",
  },
  driverName: { fontSize: 14, fontWeight: 800, color: T.text, marginBottom: 2 },
  driverMeta: { fontSize: 10, color: T.textXsoft },
  driverPhone: { display: "flex", alignItems: "center", fontSize: 11, color: T.textSoft, marginTop: 3 },
  statusPill: {
    fontSize: 10, fontWeight: 700, padding: "4px 10px",
    borderRadius: 50, border: "1px solid",
    display: "flex", alignItems: "center", flexShrink: 0, letterSpacing: "0.03em",
  },
  statusBanner: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "10px 12px",
    background: T.greenGlow, border: `1px solid ${T.borderStrong}`,
    borderRadius: T.radiusSm,
  },

  // Stepper
  stepper: {
    display: "flex", alignItems: "center",
    padding: "10px 4px 4px",
  },
  stepItem: { display: "flex", flexDirection: "column", alignItems: "center", flex: 1, gap: 6 },
  stepCircle: {
    width: 26, height: 26, borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "all 0.3s ease",
  },

  sectionLabel: {
    fontSize: 10, fontWeight: 800, color: T.textSoft,
    textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10,
  },

  // Map card
  mapCard: {
    position: "relative",
    height: 360,
    borderRadius: T.radius,
    overflow: "hidden",
    boxShadow: T.shadowMd,
    border: `1px solid ${T.border}`,
    background: "#0f1f0f",
  },

  // Map overlays
  mapChipTopLeft: {
    position: "absolute", top: 14, left: 14, zIndex: 800,
    display: "flex", alignItems: "center", gap: 7,
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(12px)",
    border: `1px solid ${T.border}`,
    borderRadius: 50, padding: "7px 13px",
    color: T.green800, fontSize: 11, fontWeight: 700,
    boxShadow: T.shadow,
  },
  mapChipTopRight: {
    position: "absolute", top: 14, right: 14, zIndex: 800,
    display: "flex", alignItems: "center", gap: 6,
    backdropFilter: "blur(12px)",
    border: "1px solid",
    borderRadius: 50, padding: "6px 12px",
    boxShadow: T.shadow,
  },
  mapChipBottom: {
    position: "absolute", bottom: 14, left: "50%",
    transform: "translateX(-50%)", zIndex: 800,
    display: "flex", alignItems: "center", gap: 6,
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(12px)",
    border: `1px solid ${T.border}`,
    borderRadius: 50, padding: "7px 14px",
    boxShadow: T.shadowMd,
  },

  // Action buttons
  actions: { display: "flex", flexDirection: "column", gap: 10 },
  refreshBtn2: {
    width: "100%", padding: "12px 0",
    background: T.surface,
    color: T.green700, border: `1.5px solid ${T.borderStrong}`,
    borderRadius: T.radiusSm, fontSize: 13, fontWeight: 700,
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: T.shadow, transition: "all 0.2s",
  },
  sampahBtn: {
    width: "100%", padding: "12px 0",
    background: `linear-gradient(135deg,${T.green500},${T.green700})`,
    color: "#fff", border: "none",
    borderRadius: T.radiusSm, fontSize: 13, fontWeight: 700,
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: `0 4px 16px ${T.greenGlow}`, transition: "all 0.2s",
  },
  doneBtn: {
    width: "100%", padding: "13px 0",
    background: `linear-gradient(135deg,${T.green500},${T.green800})`,
    color: "#fff", border: "none",
    borderRadius: T.radiusSm, fontSize: 14, fontWeight: 800,
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: `0 6px 20px ${T.greenGlow}`, transition: "all 0.2s",
  },
  cancelBtn: {
    width: "100%", padding: "12px 0",
    background: "transparent", color: T.red,
    border: "1.5px solid rgba(239,68,68,0.3)",
    borderRadius: T.radiusSm, fontSize: 13, fontWeight: 700,
    cursor: "pointer", transition: "all 0.2s",
  },

  // Notification
  notifBanner: {
    display: "flex", alignItems: "flex-start", gap: 10,
    padding: "12px 14px",
    border: "1px solid",
    borderRadius: T.radiusSm,
    animation: "fadeIn 0.3s ease",
  },

  // Modal
  modalOverlay: {
    position: "fixed", inset: 0, zIndex: 2000,
    background: "rgba(0,0,0,0.4)",
    backdropFilter: "blur(4px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 20,
  },
  modalBox: {
    background: T.surface,
    borderRadius: T.radius,
    width: "100%", maxWidth: 520,
    maxHeight: "85vh",
    display: "flex", flexDirection: "column",
    boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
    border: `1px solid ${T.border}`,
    overflow: "hidden",
    animation: "fadeIn 0.2s ease",
  },
  modalHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "16px 20px",
    borderBottom: `1px solid ${T.border}`,
    flexShrink: 0,
  },
  modalTitle: { display: "flex", alignItems: "center", gap: 10, fontSize: 15, fontWeight: 800, color: T.text },
  modalTitleIcon: {
    width: 30, height: 30, borderRadius: 9,
    background: T.greenGlow, border: `1px solid ${T.border}`,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  modalClose: {
    width: 30, height: 30, borderRadius: "50%",
    background: "rgba(0,0,0,0.04)", border: "none",
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer",
  },
  modalBody: { flex: 1, overflowY: "auto", padding: "16px 20px" },
  modalFooter: {
    padding: "12px 20px",
    borderTop: `1px solid ${T.border}`,
    flexShrink: 0,
  },
  modalCloseBtn: {
    width: "100%", padding: "11px 0",
    background: T.greenGlow, color: T.green700,
    border: `1px solid ${T.borderStrong}`,
    borderRadius: T.radiusSm, fontSize: 13, fontWeight: 700,
    cursor: "pointer",
  },

  sampahRow: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "10px 12px",
    background: T.bg,
    border: `1px solid ${T.border}`,
    borderRadius: 10,
  },
  modalSummary: {
    display: "flex", alignItems: "stretch", gap: 0,
    background: T.greenGlow2,
    border: `1.5px solid ${T.borderStrong}`,
    borderRadius: T.radiusSm,
    overflow: "hidden",
    marginTop: 4,
  },
  summaryItem: { flex: 1, padding: "14px 16px" },
  summaryLabel: { fontSize: 10, color: T.textSoft, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 },
  summaryValue: { fontSize: 20, fontWeight: 800, color: T.green700, fontFamily: "'JetBrains Mono', monospace" },
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');

  * { box-sizing: border-box; }
  body, .dashboard-main { font-family: 'Outfit', 'Segoe UI', sans-serif !important; }

  .leaflet-container { background: #0f1f0f !important; }
  .leaflet-control-zoom { display: none; }
  .leaflet-popup-content-wrapper {
    border-radius: 12px !important;
    box-shadow: 0 4px 20px rgba(0,0,0,0.12) !important;
    border: 1px solid rgba(34,197,94,0.15) !important;
    font-family: 'Outfit', sans-serif !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    color: #0f172a !important;
  }
  .leaflet-popup-tip { background: #fff !important; }

  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes ecoPulse {
    0%, 100% { box-shadow: 0 0 0 3px rgba(34,197,94,0.3); }
    50% { box-shadow: 0 0 0 6px rgba(34,197,94,0.08); }
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @media (max-width: 600px) {
    .dashboard-main > div { padding: 16px 14px 40px !important; }
  }
`;

export default TrackingPetugas;