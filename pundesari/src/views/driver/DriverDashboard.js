import React, { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { dashboardAPI, ordersAPI, locationAPI } from "../../services/api";
import { useSocket } from "../../context/SocketContext";
import { getTileLayerProps, MAP_OPTIONS, MAP_MODERN_CSS } from "../../config/mapConfig";
import { loadStoredProfile, getProfile } from "../../config/profileConfig";

// ─── Leaflet Icon Fix ────────────────────────────────────────────────────────
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

// ─── Map View Controller (unchanged logic) ───────────────────────────────────
function ChangeView({ center, zoom }) {
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
    if (!center || map._userInteracted) return;
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function DriverProfile({ nama, profilePhoto, isOnline, onToggleOnline, onLogout, onProfile }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div style={styles.profileCard}>
      <div style={styles.profileLeft}>
        <div style={styles.avatarRing}>
          <button style={styles.avatarButton} onClick={() => setMenuOpen((open) => !open)} title="Menu Profil">
            {profilePhoto ? (
              <img src={profilePhoto} alt="avatar" style={styles.avatarImage} />
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            )}
          </button>
          {isOnline && <span style={styles.onlineDot} />}
          {menuOpen && (
            <div style={styles.profileMenu}>
              <button style={styles.profileMenuItem} onClick={() => { setMenuOpen(false); onProfile(); }}>
                Profil
              </button>
              <button style={styles.profileMenuItem} onClick={() => { setMenuOpen(false); onLogout(); }}>
                Logout
              </button>
            </div>
          )}
        </div>
        <div>
          <div style={styles.profileName}>{nama}</div>
          <div style={styles.profileRole}>Petugas BankTrash</div>
        </div>
      </div>
      <label style={styles.toggleWrap}>
        <input type="checkbox" checked={isOnline} onChange={(e) => onToggleOnline(e.target.checked)} style={{ display: "none" }} />
        <div style={{ ...styles.toggleTrack, background: isOnline ? "linear-gradient(135deg,#22c55e,#16a34a)" : "#334155" }}>
          <div style={{ ...styles.toggleThumb, transform: isOnline ? "translateX(22px)" : "translateX(2px)" }} />
        </div>
        <span style={{ ...styles.toggleLabel, color: isOnline ? "#22c55e" : "#94a3b8" }}>
          {isOnline ? "Online" : "Offline"}
        </span>
      </label>
    </div>
  );
}

function StatusBar({ driverLocation, activeOrder }) {
  return (
    <div style={styles.statusBar}>
      <StatusChip icon="📍" label="GPS" value={`${driverLocation[0].toFixed(4)}, ${driverLocation[1].toFixed(4)}`} color="#3b82f6" />
      <StatusChip icon="📦" label="Order" value={activeOrder ? `#${activeOrder.id}` : "—"} color={activeOrder ? "#f59e0b" : "#475569"} />
    </div>
  );
}

function StatusChip({ icon, label, value, color }) {
  return (
    <div style={{ ...styles.chip, borderColor: color + "33", background: color + "11" }}>
      <span style={{ fontSize: 13 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 9, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase", lineHeight: 1 }}>{label}</div>
        <div style={{ fontSize: 11, color, fontWeight: 600, fontFamily: "'JetBrains Mono',monospace", lineHeight: 1.4 }}>{value}</div>
      </div>
    </div>
  );
}

function ActiveOrderCard({ order, onComplete }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <span style={styles.sectionDot} />
        <span style={styles.sectionTitle}>Active Order</span>
        <span style={styles.activeBadge}>LIVE</span>
      </div>
      <div style={styles.orderCard}>
        <div style={styles.orderCardTop}>
          <div style={styles.userBubble}>{String(order.user_id).charAt(0).toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={styles.orderUserName}>User {order.user_id}</div>
            <div style={styles.orderAddress}>{order.address}</div>
          </div>
          <div style={styles.orderIdBadge}>#{order.id}</div>
        </div>
        <div style={styles.orderMeta}>
          <OrderMetaRow label="Jenis Sampah" value={order.jenis_sampah || "—"} />
          <OrderMetaRow label="Catatan" value={order.catatan || "Tidak ada"} />
        </div>
        <button style={styles.completeBtn} onClick={onComplete}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Selesaikan Order
        </button>
      </div>
    </div>
  );
}

function OrderMetaRow({ label, value }) {
  return (
    <div style={styles.metaRow}>
      <span style={styles.metaLabel}>{label}</span>
      <span style={styles.metaValue}>{value}</span>
    </div>
  );
}

function PendingOrderCard({ order, customerProfile, onAccept, onReject, isAccepting, isOnline, onViewDetail }) {
  const displayName = customerProfile?.name || `User ${order.user_id}`;
  const avatar = customerProfile?.profilePhoto;
  return (
    <div style={styles.orderCard}>
      <div style={styles.orderCardTop}>
        <div style={styles.userBubble}>
          {avatar ? (
            <img
              src={avatar}
              alt="User avatar"
              style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "999px" }}
            />
          ) : (
            <span>{String(displayName).charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.orderUserName}>{displayName}</div>
          <div style={styles.orderAddress}>{order.address}</div>
          <div style={styles.orderType}>{order.jenis_sampah}</div>
        </div>
      </div>
      <div style={styles.cardActions}>
        <button style={styles.rejectBtn} onClick={() => onReject(order)}>Tolak</button>
        <button
          style={{ ...styles.detailBtn, opacity: !isOnline ? 0.5 : 1 }}
          onClick={() => onViewDetail(order)}
          disabled={!isOnline}
        >
          {isAccepting ? "..." : "Lihat Detail"}
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={styles.emptyState}>
      <div style={styles.emptyIcon}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
      <div style={styles.emptyText}>Tidak ada order pending</div>
      <div style={styles.emptySubtext}>Menunggu order masuk...</div>
    </div>
  );
}

// ─── Map Overlay Widgets ──────────────────────────────────────────────────────

function MapOverlay({ isOnline, driverLocation, activeOrder }) {
  return (
    <>
      {/* Top-left: course/location name chip */}
      <div style={styles.mapChipTopLeft}>
        <span style={styles.mapChipDot} />
        BankTrash Tracking
      </div>

      {/* Top-right: online status */}
      <div style={{ ...styles.mapChipTopRight, background: isOnline ? "rgba(34,197,94,0.18)" : "rgba(100,116,139,0.18)", borderColor: isOnline ? "#22c55e44" : "#47556944" }}>
        <span style={{ ...styles.mapChipDot, background: isOnline ? "#22c55e" : "#94a3b8", boxShadow: isOnline ? "0 0 0 4px #22c55e22" : "none" }} />
        <span style={{ color: isOnline ? "#22c55e" : "#94a3b8", fontSize: 12, fontWeight: 600 }}>{isOnline ? "Online" : "Offline"}</span>
      </div>

      {/* Bottom: distance if active order */}
      {activeOrder && activeOrder.user_lat && activeOrder.user_lng && (
        <div style={styles.mapChipBottom}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 5 }}>
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 600 }}>Menuju lokasi pickup</span>
        </div>
      )}
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
function DriverDashboard() {
  const history = useHistory();
  const petugasProfile = loadStoredProfile('petugas');
  const nama = petugasProfile.name || localStorage.getItem("nama") || "Driver";
  const profilePhoto = petugasProfile.profilePhoto || null;
  const driverId = localStorage.getItem("userId") || 1;

  // ── All original state preserved ──
  const [isOnline, setIsOnline] = useState(true);
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [driverLocation, setDriverLocation] = useState([-7.8, 110.3]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [error, setError] = useState(null);
  const [acceptingOrder, setAcceptingOrder] = useState(null);

  const { subscribe } = useSocket();

  // ── All original effects preserved ──
  useEffect(() => {
    if (!subscribe) return;
    const unsubs = [];

    // Remove order from list when cancelled or accepted by someone else
    unsubs.push(subscribe('order:cancelled', (data) => {
      if (!data?.orderId) return;
      setOrders((prev) => prev.filter((o) => String(o.id) !== String(data.orderId)));
    }));

    unsubs.push(subscribe('order:accepted', (data) => {
      if (!data?.orderId) return;
      setOrders((prev) => prev.filter((o) => String(o.id) !== String(data.orderId)));
    }));

    return () => unsubs.forEach((un) => un && un());
  }, [subscribe]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setDriverLocation([Number(pos.coords.latitude), Number(pos.coords.longitude)]);
      },
      (err) => console.error("Geolocation error:", err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    if (!activeOrder || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude);
        const lng = Number(pos.coords.longitude);
        locationAPI.sendDriverLocation({ driver_id: parseInt(driverId), order_id: activeOrder.id, lat, lng })
          .catch(err => console.error("Location update failed", err));
      },
      (err) => console.error(err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [activeOrder, driverId]);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!isOnline) return;
      try {
        const res = await dashboardAPI.getPendingOrders();
        setOrders(res.data);
        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching orders:", err);
        setError(err.message);
        setIsLoading(false);
      }
    };
    fetchOrders();
    const interval = setInterval(fetchOrders, 3000);
    return () => clearInterval(interval);
  }, [isOnline]);

  // ── All original handlers preserved ──
  const handleAcceptOrder = async (order) => {
    try {
      setAcceptingOrder(order.id);
      const res = await ordersAPI.acceptOrder(order.id, parseInt(driverId));
      if (res.status === 200) {
        const acceptedOrder = { ...order, status: 'assigned', driver_id: parseInt(driverId) };
        sessionStorage.setItem('tracking_order', JSON.stringify(acceptedOrder));
        sessionStorage.setItem('current_order_id', acceptedOrder.id);
        setActiveOrder(acceptedOrder);
        setOrders(orders.filter(o => o.id !== order.id));
        alert("✅ Order diterima!");
        history.push({ pathname: `/driver/tracking-user`, state: { order: acceptedOrder } });
      } else {
        alert(res.data.message || "❌ Gagal menerima order");
      }
    } catch (err) {
      alert("❌ Error: " + err.message);
    } finally {
      setAcceptingOrder(null);
    }
  };

  const handleRejectOrder = async (order) => {
    try {
      const res = await ordersAPI.rejectOrder(order.id, parseInt(driverId));
      if (res.data.status === "success") {
        setOrders((prev) => prev.filter((o) => o.id !== order.id));
        alert("⚠️ Order ditolak");
      } else {
        alert(res.data.message || "❌ Gagal menolak order");
      }
    } catch (err) {
      alert("❌ Error: " + (err?.response?.data?.message || err.message));
    }
  };

  const handleCompleteOrder = async () => {
    if (!activeOrder) return;
    try {
      const res = await ordersAPI.updateOrderStatus(activeOrder.id, {
        driver_id: parseInt(driverId),
        status: "completed",
      });
      if (res.data.status === "success") {
        setActiveOrder(null);
        alert("✅ Order Selesai!");
      }
    } catch (err) {
      alert("❌ Error: " + err.message);
    }
  };

  const handleLogout = () => {
    ["token", "userId", "nama", "role"].forEach((key) => localStorage.removeItem(key));
    history.push("/login");
  };

  const handleViewDetail = (order) => {
    history.push({ pathname: `/driver/order/${order.id}`, state: { order } });
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <style>{CSS}{MAP_MODERN_CSS}</style>
      <div style={styles.root}>

        {/* ── LEFT: Map Panel ── */}
        <div style={styles.mapPanel}>
          <MapContainer center={driverLocation} zoom={14} style={{ height: "100%", width: "100%", borderRadius: "8px", overflow: "hidden" }} {...MAP_OPTIONS}>
            <TileLayer {...getTileLayerProps()} />
            <ChangeView center={driverLocation} zoom={14} />
            <Marker position={driverLocation} icon={blueIcon}>
              <Popup>🚗 Lokasi Anda</Popup>
            </Marker>
            {activeOrder && activeOrder.user_lat && activeOrder.user_lng && (
              <>
                <Marker position={[Number(activeOrder.user_lat), Number(activeOrder.user_lng)]} icon={redIcon}>
                  <Popup>👤 Lokasi Jemput: {activeOrder.address}</Popup>
                </Marker>
                <Polyline
                  positions={[driverLocation, [Number(activeOrder.user_lat), Number(activeOrder.user_lng)]]}
                  pathOptions={{ color: "#22c55e", weight: 4, dashArray: "8 6", opacity: 0.9 }}
                />
              </>
            )}
          </MapContainer>

          {/* Map overlays */}
          <MapOverlay isOnline={isOnline} driverLocation={driverLocation} activeOrder={activeOrder} />

          {/* Debug panel - floating bottom-left */}
          <div style={styles.debugPanel}>
            <span style={{ color: "#3b82f6", fontWeight: 700 }}>GPS</span>
            {" "}{driverLocation[0].toFixed(5)}, {driverLocation[1].toFixed(5)}
            {activeOrder && <span style={{ color: "#f59e0b", marginLeft: 8 }}>• Order #{activeOrder.id}</span>}
          </div>
        </div>

        {/* ── RIGHT: Order Panel ── */}
        <div style={styles.orderPanel} className="order-panel-scroll">

          {/* Sticky Header */}
          <div style={styles.panelHeader}>
            <DriverProfile
              nama={nama}
              profilePhoto={profilePhoto}
              isOnline={isOnline}
              onToggleOnline={setIsOnline}
              onLogout={handleLogout}
              onProfile={() => history.push('/driver/profile')}
            />
            <StatusBar driverLocation={driverLocation} activeOrder={activeOrder} />
          </div>

          {/* Scrollable body */}
          <div style={styles.panelBody}>
            {activeOrder ? (
              <ActiveOrderCard order={activeOrder} onComplete={handleCompleteOrder} />
            ) : (
              <div style={styles.section}>
                <div style={styles.sectionHeader}>
                  <span style={{ ...styles.sectionDot, background: "#3b82f6" }} />
                  <span style={styles.sectionTitle}>Pending Orders</span>
                  {orders.length > 0 && (
                    <span style={styles.countBadge}>{orders.length}</span>
                  )}
                </div>

                {isLoading ? (
                  <div style={styles.loadingState}>
                    <div style={styles.spinner} />
                    <span style={styles.emptySubtext}>Memuat order...</span>
                  </div>
                ) : orders.length === 0 ? (
                  <EmptyState />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {orders.map(order => {
                      const customerProfile = getProfile("user", order);
                      return (
                        <PendingOrderCard
                          key={order.id}
                          order={order}
                          customerProfile={customerProfile}
                          onAccept={handleAcceptOrder}
                          onReject={handleRejectOrder}
                          isAccepting={acceptingOrder === order.id}
                          isOnline={isOnline}
                          onViewDetail={handleViewDetail}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  root: {
    display: "flex",
    height: "100vh",
    width: "100vw",
    overflow: "hidden",
    background: "#0a0f1a",
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
  },

  // Map
  mapPanel: {
    flex: "1 1 70%",
    position: "relative",
    overflow: "hidden",
  },
  mapChipTopLeft: {
    position: "absolute",
    top: 20,
    left: 20,
    zIndex: 800,
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#22c55e",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 50,
    padding: "8px 14px",
    color: "#ffff",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.03em",
    boxShadow: "0 4px 20px rgb(141, 140, 140)",
  },
  mapChipDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#000000",
    boxShadow: "0 0 0 3px #00000022",
    display: "inline-block",
    flexShrink: 0,
  },
  mapChipTopRight: {
    position: "absolute",
    top: 20,
    right: 20,
    zIndex: 800,
    display: "flex",
    alignItems: "center",
    gap: 7,
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: "1px solid",
    borderRadius: 50,
    padding: "7px 14px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
  },
  mapChipBottom: {
    position: "absolute",
    bottom: 24,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 800,
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "rgba(10,15,26,0.80)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    border: "1px solid rgba(245,158,11,0.3)",
    borderRadius: 50,
    padding: "8px 18px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
    whiteSpace: "nowrap",
  },
  debugPanel: {
    position: "absolute",
    bottom: 24,
    left: 16,
    zIndex: 800,
    background: "rgba(10,15,26,0.75)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 8,
    padding: "5px 10px",
    fontSize: 10,
    fontFamily: "'JetBrains Mono', monospace",
    color: "#64748b",
    letterSpacing: "0.02em",
    maxWidth: 280,
  },

  // Order Panel
  orderPanel: {
    flex: "0 0 360px",
    width: 360,
    background: "#eeeef0",
    borderLeft: "1px solid rgba(255,255,255,0.06)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderRight: "1px solid rgba(255,255,255,0.06)",
  },
  panelHeader: {
    padding: "20px 20px 0",
    borderBottom: "2px solid rgba(255,255,255,0.06)",
    background: "#eeeef0",
    flexShrink: 0,
  },
  panelBody: {
    flex: 1,
    overflowY: "auto",
    padding: "20px",
  },

  // Profile card
  profileCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  profileLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  avatarRing: {
    position: "relative",
    flexShrink: 0,
  },
  avatarButton: {
    width: 42,
    height: 42,
    borderRadius: "50%",
    background: "rgba(34,197,94,0.1)",
    border: "2px solid rgba(34,197,94,0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "all 0.2s",
    padding: 0,
    outline: "none",
    borderStyle: "solid",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: "50%",
    objectFit: "cover",
  },
  profileMenu: {
    position: "absolute",
    top: "54px",
    left: 0,
    minWidth: 140,
    background: "#fff",
    borderRadius: 12,
    boxShadow: "0 14px 40px rgba(0,0,0,0.14)",
    border: "1px solid rgba(15,23,42,0.08)",
    overflow: "hidden",
    zIndex: 1200,
  },
  profileMenuItem: {
    width: "100%",
    padding: "10px 14px",
    background: "transparent",
    border: "none",
    textAlign: "left",
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.15s ease",
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: "50%",
    background: "rgba(34,197,94,0.1)",
    border: "2px solid rgba(34,197,94,0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  onlineDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "#22c55e",
    border: "2px solid #0d1321",
    boxShadow: "0 0 0 3px rgba(34,197,94,0.2)",
  },
  profileName: {
    fontSize: 14,
    fontWeight: 700,
    color: "#000000",
    letterSpacing: "0.01em",
  },
  profileRole: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 1,
  },
  toggleWrap: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    cursor: "pointer",
  },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    position: "relative",
    transition: "background 0.3s ease",
    flexShrink: 0,
  },
  toggleThumb: {
    position: "absolute",
    top: 2,
    width: 20,
    height: 20,
    borderRadius: "50%",
    background: "#fff",
    boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
    transition: "transform 0.25s cubic-bezier(.4,0,.2,1)",
  },
  toggleLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    transition: "color 0.2s",
  },

  // Status bar
  statusBar: {
    display: "flex",
    gap: 8,
    paddingBottom: 16,
  },
  chip: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid",
    transition: "all 0.2s",
  },

  // Sections
  section: {
    marginBottom: 4,
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#22c55e",
    boxShadow: "0 0 0 3px rgba(34,197,94,0.2)",
    flexShrink: 0,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: "#94a3b8",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    flex: 1,
  },
  activeBadge: {
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "0.1em",
    color: "#22c55e",
    background: "rgba(34,197,94,0.12)",
    border: "1px solid rgba(34,197,94,0.3)",
    borderRadius: 4,
    padding: "2px 6px",
    animation: "pulse 2s infinite",
  },
  countBadge: {
    fontSize: 10,
    fontWeight: 700,
    color: "#3b82f6",
    background: "rgba(59,130,246,0.12)",
    border: "1px solid rgba(59,130,246,0.3)",
    borderRadius: 10,
    padding: "1px 7px",
    minWidth: 20,
    textAlign: "center",
  },

  // Order cards
  orderCard: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 16,
    padding: 16,
    transition: "all 0.2s",
  },
  orderCardTop: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  userBubble: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: "linear-gradient(135deg,#22c55e,#16a34a)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 800,
    flexShrink: 0,
    letterSpacing: "-0.02em",
  },
  orderUserName: {
    fontSize: 13,
    fontWeight: 700,
    color: "#000000",
    marginBottom: 2,
  },
  orderAddress: {
    fontSize: 11,
    color: "#64748b",
    lineHeight: 1.4,
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
  },
  orderType: {
    fontSize: 10,
    color: "#3b82f6",
    fontWeight: 600,
    marginTop: 4,
  },
  orderIdBadge: {
    fontSize: 10,
    fontWeight: 700,
    color: "#94a3b8",
    background: "rgba(255,255,255,0.06)",
    borderRadius: 6,
    padding: "2px 7px",
    flexShrink: 0,
  },
  orderMeta: {
    background: "rgba(0,0,0,0.2)",
    borderRadius: 10,
    padding: "10px 12px",
    marginBottom: 14,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  metaRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  metaLabel: {
    fontSize: 11,
    color: "#475569",
    flexShrink: 0,
  },
  metaValue: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: 600,
    textAlign: "right",
    flex: 1,
  },
  completeBtn: {
    width: "100%",
    padding: "11px 0",
    background: "linear-gradient(135deg,#22c55e,#16a34a)",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    letterSpacing: "0.02em",
    boxShadow: "0 4px 16px rgba(34,197,94,0.35)",
    transition: "all 0.2s",
  },
  cardActions: {
    display: "flex",
    gap: 8,
    marginTop: 2,
  },
  rejectBtn: {
    flex: 1,
    padding: "9px 0",
    background: "transparent",
    color: "#64748b",
    border: "1px solid rgba(255, 0, 0, 0.18)",
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  detailBtn: {
    flex: 2,
    padding: "9px 0",
    background: "#22c55e",
    color: "#ffffff",
    border: "1px solid rgba(34,197,94,0.25)",
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    transition: "all 0.2s",
  },

  // Empty / Loading
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 20px",
    gap: 10,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.06)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 13,
    fontWeight: 600,
    color: "#475569",
  },
  emptySubtext: {
    fontSize: 11,
    color: "#334155",
  },
  loadingState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    padding: "40px 20px",
  },
  spinner: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    border: "3px solid rgba(34,197,94,0.15)",
    borderTop: "3px solid #22c55e",
    animation: "spin 0.8s linear infinite",
  },
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap');

  * { box-sizing: border-box; }

  .order-panel-scroll::-webkit-scrollbar { width: 4px; }
  .order-panel-scroll::-webkit-scrollbar-track { background: transparent; }
  .order-panel-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }

  .leaflet-container { background: #1a2332 !important; }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* Mobile: stack layout */
  @media (max-width: 768px) {
    /* Map takes 55vh, panel below */
    body > * [style*="flex-direction"] { flex-direction: column !important; }
  }
`;

export default DriverDashboard;