import React, { useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { ordersAPI } from "../../services/api";
import { getTileLayerProps, MAP_OPTIONS, MAP_MODERN_CSS } from "../../config/mapConfig";
import { getProfile } from "../../config/profileConfig";

// ─── Design tokens (matching TrackingUser system) ─────────────────────────────
const T = {
  green900: "#052e16",
  green800: "#14532d",
  green700: "#15803d",
  green600: "#16a34a",
  green500: "#22c55e",
  green400: "#4ade80",
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
  amberGlow: "rgba(245,158,11,0.12)",
  blue: "#3b82f6",
  shadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(34,197,94,0.08)",
  shadowMd: "0 4px 24px rgba(34,197,94,0.12), 0 1px 4px rgba(0,0,0,0.06)",
  shadowLg: "0 8px 40px rgba(34,197,94,0.16), 0 2px 8px rgba(0,0,0,0.08)",
  radius: 20,
  radiusSm: 12,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ label, value, accent }) {
  return (
    <div style={S.infoRow}>
      <span style={S.infoLabel}>{label}</span>
      <span style={{ ...S.infoValue, color: accent ? T.green700 : T.text }}>{value || "—"}</span>
    </div>
  );
}

function StatChip({ icon, label, value }) {
  return (
    <div style={S.statChip}>
      <div style={S.statIcon}>{icon}</div>
      <div>
        <div style={S.statLabel}>{label}</div>
        <div style={S.statValue}>{value}</div>
      </div>
    </div>
  );
}

function MapHeader({ order, userProfile }) {
  return (
    <div style={S.mapOverlayCard}>
      <div style={S.mapOverlayLeft}>
        <div style={S.mapOverlayAvatar}>
          {userProfile?.profilePhoto ? (
            <img
              src={userProfile.profilePhoto}
              alt="User avatar"
              style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "999px" }}
            />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          )}
        </div>
        <div>
          <div style={S.mapOverlayName}>{userProfile?.name || `User #${order.user_id}`}</div>
          <div style={S.mapOverlayAddr}>{order.address}</div>
        </div>
      </div>
      <div style={S.mapOverlayBadge}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.amber, display: "inline-block", marginRight: 5, boxShadow: `0 0 0 3px ${T.amberGlow}` }} />
        Pending
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
function OrderDetail() {
  const history = useHistory();
  const location = useLocation();
  const order = location.state?.order;
  const driverId = localStorage.getItem("userId") || 1;
  const userProfile = getProfile("user", order);

  const [accepting, setAccepting] = useState(false);

  if (!order) {
    history.push("/driver/dashboard");
    return null;
  }

  // ── ORIGINAL HANDLER PRESERVED ──
  const handleAcceptOrder = async () => {
    try {
      setAccepting(true);
      const response = await ordersAPI.acceptOrder(order.id, parseInt(driverId));
      if (response.status === 200) {
        alert("Order Berhasil Diterima!");
        const acceptedOrder = { ...order, status: "assigned", driver_id: parseInt(driverId) };
        sessionStorage.setItem("tracking_order", JSON.stringify(acceptedOrder));
        sessionStorage.setItem("current_order_id", order.id);
        history.push({ pathname: "/driver/tracking-user", state: { order: acceptedOrder } });
      } else {
        alert(response.data.message || "Gagal menerima order");
      }
    } catch (err) {
      console.error(err);
      alert("Error menerima order");
    } finally {
      setAccepting(false);
    }
  };

  const centerMap = order.user_lat && order.user_lng
    ? [Number(order.user_lat), Number(order.user_lng)]
    : [-7.8, 110.3];

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <>
      <style>{CSS}</style>
      <div style={S.root}>

        {/* ── LEFT: Map ── */}
        <div style={S.mapPanel}>

          {/* Glassmorphic header over map */}
          <div style={S.mapHeader}>
            <button style={S.backBtn} onClick={() => history.goBack()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.green800} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <div style={S.mapTitleWrap}>
              <div style={S.mapTitleText}>Order Tracking</div>
              <div style={S.mapTitleSub}>Pickup Preview</div>
            </div>
            <div style={S.orderIdChip}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={T.green600} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              #{order.id}
            </div>
          </div>

          {/* Fullscreen map */}
          <style>{MAP_MODERN_CSS}</style>
          <MapContainer center={centerMap} zoom={15} style={{ height: "100%", width: "100%" }} {...MAP_OPTIONS}>
            <TileLayer {...getTileLayerProps()} />
            <Marker position={centerMap}>
              <Popup>📍 {order.address}</Popup>
            </Marker>
          </MapContainer>

          {/* Floating overlay card on map */}
          <MapHeader order={order} userProfile={userProfile} />

          {/* Jenis sampah chip */}
          {order.jenis_sampah && (
            <div style={S.sampahChip}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={T.green600} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
              {order.jenis_sampah}
            </div>
          )}
        </div>

        {/* ── RIGHT: Detail Panel ── */}
        <div style={S.panel} className="orderdetail-scroll">

          {/* Customer Card */}
          <div style={{ padding: "20px 20px 0" }}>
            <div style={S.customerCard}>
              <div style={S.customerAvatarWrap}>
                <div style={S.customerAvatar}>
                  {userProfile?.profilePhoto ? (
                    <img
                      src={userProfile.profilePhoto}
                      alt="Pelanggan avatar"
                      style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "999px" }}
                    />
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                  )}
                </div>
                <div style={S.onlineDot} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={S.customerName}>{userProfile?.name || `User #${order.user_id}`}</div>
                <div style={S.customerAddr}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={T.green600} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4, flexShrink: 0 }}>
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                  {order.address}
                </div>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ padding: "14px 20px 0" }}>
            <div style={S.statsRow}>
              <StatChip
                icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.green600} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>}
                label="Order ID"
                value={`#${order.id}`}
              />
              <StatChip
                icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.amber} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>}
                label="Jenis"
                value={order.jenis_sampah || "—"}
              />
            </div>
          </div>

          {/* Order Details Card */}
          <div style={{ padding: "14px 20px 0" }}>
            <div style={S.sectionLabel}>Detail Order</div>
            <div style={S.detailCard}>
              <InfoRow label="Kode Customer" value={`#${order.id}`} accent />
              <div style={S.detailDivider} />
              <InfoRow label="Jenis Sampah" value={order.jenis_sampah} />
              <div style={S.detailDivider} />
              <InfoRow label="Status" value="Pending" />
              {order.catatan && (
                <>
                  <div style={S.detailDivider} />
                  <div style={S.notesBlock}>
                    <div style={S.notesLabel}>Catatan</div>
                    <div style={S.notesText}>{order.catatan}</div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Location Card */}
          <div style={{ padding: "14px 20px 0" }}>
            <div style={S.sectionLabel}>Lokasi Pickup</div>
            <div style={S.locationCard}>
              <div style={S.locationIconWrap}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.green600} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={S.locationAddr}>{order.address}</div>
                {order.user_lat && order.user_lng && (
                  <div style={S.locationCoords}>{Number(order.user_lat).toFixed(5)}, {Number(order.user_lng).toFixed(5)}</div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ padding: "14px 20px 0" }}>
            <div style={S.actionRow}>
              <button style={S.chatBtn}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.green700} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                Chat
              </button>
              <button style={S.phoneBtn}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.16 6.16l.91-.91a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                Telepon
              </button>
            </div>
          </div>

          {/* Accept Order CTA */}
          <div style={{ padding: "16px 20px 28px" }}>
            <button
              style={{ ...S.acceptBtn, opacity: accepting ? 0.7 : 1 }}
              onClick={handleAcceptOrder}
              disabled={accepting}
              className="accept-order-btn"
            >
              {accepting ? (
                <><div style={S.btnSpinner} />Memproses...</>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8 }}>
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Ambil Order
                </>
              )}
            </button>
          </div>
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
    flex: "1 1 62%",
    position: "relative",
    overflow: "hidden",
    background: "#0f1f0f",
  },
  mapHeader: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    zIndex: 900,
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "16px 20px",
    background: "linear-gradient(to bottom, rgba(5,46,22,0.78) 0%, transparent 100%)",
  },
  backBtn: {
    width: 36, height: 36,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.94)",
    border: "none",
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer",
    boxShadow: "0 2px 10px rgba(0,0,0,0.14)",
    flexShrink: 0,
    transition: "transform 0.15s",
  },
  mapTitleWrap: { flex: 1 },
  mapTitleText: { fontSize: 14, fontWeight: 800, color: "#fff", letterSpacing: "0.02em" },
  mapTitleSub: { fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 1 },
  orderIdChip: {
    display: "flex", alignItems: "center", gap: 5,
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(8px)",
    border: `1px solid ${T.border}`,
    borderRadius: 50,
    padding: "5px 11px",
    fontSize: 11, fontWeight: 700, color: T.green700,
    boxShadow: T.shadow,
    flexShrink: 0,
  },

  // Map floating cards
  mapOverlayCard: {
    position: "absolute",
    bottom: 70, left: 16, right: 16,
    zIndex: 800,
    display: "flex", alignItems: "center", gap: 12,
    background: "rgba(255,255,255,0.94)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    border: `1px solid ${T.border}`,
    borderRadius: 16,
    padding: "12px 14px",
    boxShadow: T.shadowMd,
  },
  mapOverlayLeft: { display: "flex", alignItems: "center", gap: 10, flex: 1 },
  mapOverlayAvatar: {
    width: 34, height: 34, borderRadius: 10,
    background: `linear-gradient(135deg,${T.green500},${T.green700})`,
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
    boxShadow: `0 4px 10px ${T.greenGlow}`,
  },
  mapOverlayName: { fontSize: 13, fontWeight: 700, color: T.text },
  mapOverlayAddr: { fontSize: 10, color: T.textSoft, lineHeight: 1.4, marginTop: 1 },
  mapOverlayBadge: {
    fontSize: 10, fontWeight: 700,
    color: T.amber,
    background: T.amberGlow,
    border: "1px solid rgba(245,158,11,0.3)",
    borderRadius: 50, padding: "3px 9px",
    display: "flex", alignItems: "center",
    flexShrink: 0,
  },
  sampahChip: {
    position: "absolute",
    bottom: 24, left: "50%",
    transform: "translateX(-50%)",
    zIndex: 800,
    display: "flex", alignItems: "center", gap: 6,
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(12px)",
    border: `1px solid ${T.borderStrong}`,
    borderRadius: 50,
    padding: "7px 14px",
    fontSize: 12, fontWeight: 700, color: T.green700,
    boxShadow: T.shadowMd,
    whiteSpace: "nowrap",
  },

  // Panel
  panel: {
    flex: "0 0 360px",
    width: 360,
    background: T.panel,
    borderLeft: `1px solid ${T.border}`,
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
  },

  // Customer
  customerCard: {
    display: "flex", alignItems: "flex-start", gap: 12,
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: T.radius,
    padding: 16,
    boxShadow: T.shadow,
  },
  customerAvatarWrap: { position: "relative", flexShrink: 0 },
  customerAvatar: {
    width: 46, height: 46, borderRadius: 14,
    background: `linear-gradient(135deg,${T.green500},${T.green800})`,
    display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: `0 6px 16px ${T.greenGlow}`,
  },
  onlineDot: {
    position: "absolute", bottom: 1, right: 1,
    width: 11, height: 11, borderRadius: "50%",
    background: T.amber,
    border: `2px solid ${T.panel}`,
    boxShadow: `0 0 0 3px ${T.amberGlow}`,
  },
  customerName: { fontSize: 15, fontWeight: 800, color: T.text, marginBottom: 4 },
  customerAddr: {
    display: "flex", alignItems: "flex-start",
    fontSize: 11, color: T.textSoft, lineHeight: 1.5,
  },

  // Stats row
  statsRow: {
    display: "grid", gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  statChip: {
    display: "flex", alignItems: "center", gap: 10,
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: T.radiusSm,
    padding: "10px 12px",
    boxShadow: T.shadow,
  },
  statIcon: {
    width: 32, height: 32,
    background: T.greenGlow2,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  statLabel: { fontSize: 9, color: T.textXsoft, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 },
  statValue: { fontSize: 12, fontWeight: 800, color: T.text, fontFamily: "'JetBrains Mono', monospace" },

  // Section label
  sectionLabel: {
    fontSize: 10, fontWeight: 800,
    color: T.textSoft, textTransform: "uppercase",
    letterSpacing: "0.1em", marginBottom: 10,
  },

  // Detail card
  detailCard: {
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: T.radius,
    overflow: "hidden",
    boxShadow: T.shadow,
  },
  infoRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "11px 16px",
  },
  infoLabel: { fontSize: 12, color: T.textSoft },
  infoValue: { fontSize: 12, fontWeight: 700, textAlign: "right", maxWidth: "55%" },
  detailDivider: { height: 1, background: T.border, margin: "0 16px" },
  notesBlock: { padding: "11px 16px" },
  notesLabel: { fontSize: 10, color: T.textXsoft, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 },
  notesText: { fontSize: 12, color: T.textMid, lineHeight: 1.6, fontStyle: "italic" },

  // Location card
  locationCard: {
    display: "flex", alignItems: "flex-start", gap: 12,
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: T.radius,
    padding: 14,
    boxShadow: T.shadow,
  },
  locationIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    background: T.greenGlow,
    border: `1px solid ${T.borderStrong}`,
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  locationAddr: { fontSize: 12, fontWeight: 600, color: T.text, lineHeight: 1.5 },
  locationCoords: { fontSize: 10, color: T.textXsoft, marginTop: 3, fontFamily: "'JetBrains Mono', monospace" },

  // Action row
  actionRow: {
    display: "grid", gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  chatBtn: {
    padding: "12px 0",
    background: T.surface,
    color: T.green700,
    border: `1.5px solid ${T.borderStrong}`,
    borderRadius: T.radiusSm,
    fontSize: 13, fontWeight: 700,
    cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "all 0.15s",
    boxShadow: T.shadow,
  },
  phoneBtn: {
    padding: "12px 0",
    background: `linear-gradient(135deg,${T.green500},${T.green700})`,
    color: "#fff",
    border: "none",
    borderRadius: T.radiusSm,
    fontSize: 13, fontWeight: 700,
    cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "all 0.15s",
    boxShadow: `0 4px 14px ${T.greenGlow}`,
  },

  // Accept button
  acceptBtn: {
    width: "100%", padding: "15px 0",
    background: `linear-gradient(135deg,${T.green500} 0%,${T.green700} 60%,${T.green800} 100%)`,
    color: "#fff", border: "none",
    borderRadius: T.radiusSm,
    fontSize: 15, fontWeight: 800,
    cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    letterSpacing: "0.03em",
    boxShadow: `0 6px 24px ${T.greenGlow}, 0 2px 6px rgba(0,0,0,0.12)`,
    transition: "all 0.2s",
  },
  btnSpinner: {
    width: 14, height: 14, borderRadius: "50%",
    border: "2px solid rgba(255,255,255,0.3)",
    borderTop: "2px solid #fff",
    animation: "spin 0.7s linear infinite",
    marginRight: 8,
  },
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');

  * { box-sizing: border-box; }

  .orderdetail-scroll::-webkit-scrollbar { width: 4px; }
  .orderdetail-scroll::-webkit-scrollbar-track { background: transparent; }
  .orderdetail-scroll::-webkit-scrollbar-thumb { background: rgba(34,197,94,0.2); border-radius: 4px; }

  .leaflet-container { background: #0f1f0f !important; }
  .leaflet-control-zoom { display: none; }

  @keyframes spin { to { transform: rotate(360deg); } }

  .accept-order-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 10px 32px rgba(34,197,94,0.35), 0 2px 8px rgba(0,0,0,0.12) !important;
    filter: brightness(1.06);
  }
  .accept-order-btn:active:not(:disabled) {
    transform: translateY(0px);
  }

  @media (max-width: 768px) {
    /* Stack on mobile */
  }
`;

export default OrderDetail;