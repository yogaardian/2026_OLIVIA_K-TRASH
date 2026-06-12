import React, { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Sidebar from "../../components/Sidebar.jsx";
import { getTileLayerProps, MAP_OPTIONS, MAP_MODERN_CSS } from "../../config/mapConfig";
import { loadStoredProfile } from "../../config/profileConfig";

// Fix Leaflet's default icon path issues with Webpack
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
  shadowSize: [41, 41]
});

function ChangeView({ center, zoom }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  green900: "#052e16",
  green400: "#ffffff",
  green100: "#dcfce7",
  green50:  "#f0fdf4",
  bg:          "#f5f7f5",
  panel:       "#fafffe",
  surface:     "#ffffff",
  border:      "rgba(34,197,94,0.15)",
  borderStrong:"rgba(34,197,94,0.30)",
  text:        "#0f172a",
  textSoft:    "#64748b",
  textXsoft:   "#94a3b8",
  shadow:      "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(34,197,94,0.08)",
  shadowMd:    "0 2px 8px rgba(0,0,0,0.08), 0 8px 24px rgba(34,197,94,0.12)",
  shadowLg:    "0 4px 16px rgba(0,0,0,0.10), 0 16px 40px rgba(34,197,94,0.16)",
  radius:      "16px",
  radiusLg:    "20px",
  radiusXl:    "24px",
  fontDisplay: "'Outfit', sans-serif",
  fontMono:    "'JetBrains Mono', monospace",
  gradientBtn: "linear-gradient(135deg, #66b282 0%, #15803d 60%, #14532d 100%)",
  gradientHdr: "linear-gradient(135deg, #052e16 0%, #14532d 50%, #15803d 100%)",
  glassLight:  "rgba(255,255,255,0.72)",
  glassBorder: "rgba(255,255,255,0.5)",
};

// ─── Style System ─────────────────────────────────────────────────────────────
const S = {
  root: {
    display: "flex",
    minHeight: "100vh",
    background: T.bg,
    fontFamily: T.fontDisplay,
    overflowX: "hidden",
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minHeight: "100vh",
    background: T.bg,
    minWidth: 0, // prevent flex child overflow
  },
  pageWrap: {
    flex: 1,
    width: "100%",
    margin: "0 auto",
    padding: "0 0 100px 0",
    position: "relative",
    boxSizing: "border-box",
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    position: "sticky",
    top: 0,
    zIndex: 100,
    background: T.glassLight,
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    borderBottom: `1px solid ${T.border}`,
    padding: "12px 16px",
    display: "flex",
    alignItems: "center",
    gap: 12,
    boxSizing: "border-box",
    width: "100%",
  },
  backBtn: {
    width: 38,
    height: 38,
    minWidth: 38,
    minHeight: 38,
    borderRadius: "50%",
    background: T.surface,
    border: `1.5px solid ${T.borderStrong}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: T.shadow,
    flexShrink: 0,
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
  },
  avatarWrap: {
    width: 38,
    height: 38,
    minWidth: 38,
    borderRadius: "50%",
    overflow: "hidden",
    border: `2px solid ${T.green400}`,
    background: T.green50,
    flexShrink: 0,
  },
  avatar: { width: "100%", height: "100%", objectFit: "cover" },
  headerText: { flex: 1, minWidth: 0, overflow: "hidden" },
  greeting: {
    fontSize: 14,
    fontWeight: 700,
    color: T.text,
    lineHeight: 1.2,
    letterSpacing: "-0.3px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  subGreeting: {
    fontSize: 11,
    color: T.textSoft,
    fontWeight: 500,
    letterSpacing: "0.3px",
    marginTop: 1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  ecoBadge: {
    fontSize: 10,
    fontWeight: 700,
    color: "#15803d",
    background: T.green100,
    border: `1px solid ${T.borderStrong}`,
    borderRadius: 20,
    padding: "3px 10px",
    letterSpacing: "0.5px",
    textTransform: "uppercase",
    flexShrink: 0,
  },

  // ── Content ─────────────────────────────────────────────────────────────────
  content: { padding: "16px 14px 0", boxSizing: "border-box" },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: T.textXsoft,
    letterSpacing: "1.2px",
    textTransform: "uppercase",
    marginBottom: 8,
    paddingLeft: 2,
  },

  // ── Service Card ─────────────────────────────────────────────────────────────
  serviceCard: {
    background: T.surface,
    border: `1.5px solid ${T.borderStrong}`,
    borderRadius: T.radiusLg,
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    gap: 14,
    boxShadow: T.shadowMd,
    marginBottom: 20,
    position: "relative",
    overflow: "hidden",
    boxSizing: "border-box",
    width: "100%",
  },
  serviceGlow: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 100,
    height: 100,
    background: "radial-gradient(circle, rgba(34,197,94,0.12) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  iconCircle: {
    width: 48,
    height: 48,
    minWidth: 48,
    borderRadius: "50%",
    background: T.gradientBtn,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  serviceInfo: {
    flex: 1,
    minWidth: 0,
  },
  serviceTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: T.text,
    marginBottom: 2,
    letterSpacing: "-0.2px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  serviceSubtitle: {
    fontSize: 12,
    color: T.textSoft,
    fontWeight: 400,
  },
  activePill: {
    fontSize: 10,
    fontWeight: 700,
    color: "#15803d",
    background: T.green100,
    border: `1px solid ${T.borderStrong}`,
    borderRadius: 20,
    padding: "3px 8px",
    letterSpacing: "0.5px",
    textTransform: "uppercase",
    marginLeft: "auto",
    flexShrink: 0,
    whiteSpace: "nowrap",
  },

  // ── Input Card ───────────────────────────────────────────────────────────────
  inputCard: {
    background: T.surface,
    border: `1.5px solid ${T.border}`,
    borderRadius: T.radiusLg,
    padding: "4px 16px",
    boxShadow: T.shadow,
    marginBottom: 12,
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
    boxSizing: "border-box",
    width: "100%",
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: "#15803d",
    letterSpacing: "0.8px",
    textTransform: "uppercase",
    paddingTop: 12,
    marginBottom: 2,
  },
  textInput: {
    width: "100%",
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: 14,
    fontWeight: 500,
    color: T.text,
    fontFamily: T.fontDisplay,
    padding: "6px 0 12px",
    lineHeight: 1.5,
    resize: "none",
    boxSizing: "border-box",
  },

  // ── Map ─────────────────────────────────────────────────────────────────────
  mapSection: { marginBottom: 14 },
  mapCard: {
    borderRadius: T.radiusXl,
    overflow: "hidden",
    border: `1.5px solid ${T.borderStrong}`,
    boxShadow: T.shadowLg,
    position: "relative",
    background: "#e8f5e9",
    width: "100%",
  },
  mapLoadingBox: {
    height: 240,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
  },
  spinner: {
    width: 40,
    height: 40,
    border: `3px solid ${T.green100}`,
    borderTop: "3px solid #22c55e",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  loadingText: {
    fontSize: 13,
    color: T.textSoft,
    fontWeight: 500,
  },
  mapOverlay: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
    zIndex: 800,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 8,
    pointerEvents: "none",
  },
  mapInfoChip: {
    background: T.glassLight,
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    border: `1px solid ${T.glassBorder}`,
    borderRadius: 30,
    padding: "6px 12px 6px 10px",
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  gpsDot: {
    width: 8,
    height: 8,
    minWidth: 8,
    borderRadius: "50%",
    background: "#22c55e",
    boxShadow: "0 0 0 3px rgba(34,197,94,0.3)",
    animation: "pulse 1.5s ease-in-out infinite",
  },
  mapChipText: {
    fontSize: 11,
    fontWeight: 700,
    color: "#14532d",
    letterSpacing: "0.3px",
    whiteSpace: "nowrap",
  },
  mapCoordChip: {
    background: "rgba(5,46,22,0.72)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    borderRadius: 30,
    padding: "6px 12px",
    fontFamily: T.fontMono,
    fontSize: 10,
    color: T.green400,
    letterSpacing: "0.5px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "55%",
  },

  // ── GPS Button ───────────────────────────────────────────────────────────────
  gpsBtn: {
    width: "100%",
    padding: "14px 16px",
    background: T.surface,
    border: `1.5px solid ${T.borderStrong}`,
    borderRadius: T.radius,
    color: "#15803d",
    fontFamily: T.fontDisplay,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    boxShadow: T.shadow,
    transition: "all 0.2s ease",
    marginBottom: 20,
    letterSpacing: "-0.2px",
    boxSizing: "border-box",
    minHeight: 48,
  },
  gpsBtnDot: {
    width: 8,
    height: 8,
    minWidth: 8,
    borderRadius: "50%",
    background: "#22c55e",
    boxShadow: "0 0 0 3px rgba(34,197,94,0.25)",
    flexShrink: 0,
  },

  // ── Notes Card ───────────────────────────────────────────────────────────────
  notesCard: {
    background: T.surface,
    border: `1.5px solid ${T.border}`,
    borderRadius: T.radiusLg,
    overflow: "hidden",
    boxShadow: T.shadow,
    marginBottom: 24,
    width: "100%",
    boxSizing: "border-box",
  },
  notesHeader: {
    background: "linear-gradient(90deg, #f0fdf4 0%, #dcfce7 100%)",
    borderBottom: `1px solid ${T.border}`,
    padding: "12px 16px",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  notesHeaderIcon: {
    width: 30,
    height: 30,
    minWidth: 30,
    borderRadius: 8,
    background: "#22c55e",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  notesHeaderTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: T.text,
    letterSpacing: "-0.2px",
  },
  notesHeaderSub: {
    fontSize: 11,
    color: T.textSoft,
  },
  notesTextarea: {
    width: "100%",
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: 14,
    color: T.text,
    fontFamily: T.fontDisplay,
    padding: "14px 16px",
    resize: "none",
    lineHeight: 1.7,
    boxSizing: "border-box",
    display: "block",
  },

  // ── Sticky Action Bar ────────────────────────────────────────────────────────
  actionBar: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 200,
    background: T.glassLight,
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    borderTop: `1px solid ${T.border}`,
    padding: "12px 16px",
    paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
    display: "flex",
    gap: 10,
    boxShadow: "0 -4px 24px rgba(34,197,94,0.10)",
    boxSizing: "border-box",
  },
  cancelBtn: {
    flex: 1,
    padding: "0 16px",
    minHeight: 48,
    background: T.surface,
    border: `1.5px solid ${T.borderStrong}`,
    borderRadius: T.radius,
    color: "#15803d",
    fontFamily: T.fontDisplay,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    transition: "all 0.2s ease",
    letterSpacing: "-0.2px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  nextBtn: {
    flex: 2,
    padding: "0 16px",
    minHeight: 48,
    background: T.gradientBtn,
    border: "none",
    borderRadius: T.radius,
    color: "#fff",
    fontFamily: T.fontDisplay,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    boxShadow: "0 4px 20px rgba(34,197,94,0.40)",
    transition: "all 0.2s ease",
    letterSpacing: "-0.2px",
  },
};

// ─── Keyframe + Responsive CSS injection ─────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("pickup-keyframes")) {
  const style = document.createElement("style");
  style.id = "pickup-keyframes";
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');

    @keyframes spin  { to { transform: rotate(360deg); } }
    @keyframes pulse {
      0%,100% { box-shadow: 0 0 0 3px rgba(34,197,94,0.3); }
      50%      { box-shadow: 0 0 0 6px rgba(34,197,94,0.15); }
    }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Base resets ── */
    *, *::before, *::after { box-sizing: border-box; }

    /* ── Focus states ── */
    .pickup-input-card:focus-within {
      border-color: rgba(34,197,94,0.50) !important;
      box-shadow: 0 0 0 3px rgba(34,197,94,0.10), 0 4px 16px rgba(34,197,94,0.10) !important;
    }

    /* ── Hover states ── */
    .pickup-gps-btn:hover {
      background: #f0fdf4 !important;
      box-shadow: 0 4px 16px rgba(34,197,94,0.20) !important;
      transform: translateY(-1px);
    }
    .pickup-cancel-btn:hover { background: #f0fdf4 !important; transform: translateY(-1px); }
    .pickup-next-btn:hover   { filter: brightness(1.06); transform: translateY(-1px); box-shadow: 0 8px 28px rgba(34,197,94,0.50) !important; }
    .pickup-back-btn:hover   { transform: scale(1.08); box-shadow: 0 4px 16px rgba(34,197,94,0.20) !important; }
    .pickup-section          { animation: fadeUp 0.4s ease both; }

    /* ── Map container responsive ── */
    .pickup-map-container .leaflet-container {
      width: 100% !important;
      border-radius: 12px;
      overflow: hidden;
    }

    /* ── Mobile small (320px) ── */
    @media (max-width: 359px) {
      .pickup-page-wrap   { max-width: 100%; padding-left: 0; padding-right: 0; }
      .pickup-content     { padding: 12px 10px 0 !important; }
      .pickup-header      { padding: 10px 10px !important; gap: 8px !important; }
      .pickup-greeting    { font-size: 13px !important; }
      .pickup-map-height  { height: 200px !important; }
      .pickup-loading-box { height: 200px !important; }
      .pickup-action-bar  { padding: 10px 10px !important; padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px)) !important; }
      .pickup-service-card { padding: 12px 12px !important; gap: 10px !important; }
      .pickup-icon-circle  { width: 40px !important; height: 40px !important; min-width: 40px !important; }
      .pickup-eco-badge    { display: none; }
    }

    /* ── Mobile (360–430px) ── */
    @media (min-width: 360px) and (max-width: 430px) {
      .pickup-page-wrap   { max-width: 100%; }
      .pickup-map-height  { height: 240px !important; }
      .pickup-loading-box { height: 240px !important; }
    }

    /* ── Mobile large / Phablet (431px–599px) ── */
    @media (min-width: 431px) and (max-width: 599px) {
      .pickup-page-wrap   { max-width: 520px; }
      .pickup-map-height  { height: 260px !important; }
      .pickup-loading-box { height: 260px !important; }
    }

    /* ── Tablet (600px–1023px) ── */
    @media (min-width: 600px) and (max-width: 1023px) {
      .pickup-page-wrap   { max-width: 640px; }
      .pickup-content     { padding: 24px 24px 0 !important; }
      .pickup-header      { padding: 16px 24px !important; }
      .pickup-map-height  { height: 320px !important; }
      .pickup-loading-box { height: 320px !important; }
      .pickup-action-bar  { padding: 16px 24px !important; padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px)) !important; }
      .pickup-greeting    { font-size: 16px !important; }
    }

    /* ── Desktop & Laptop (1024px+) ── */
    @media (min-width: 1024px) {
      .pickup-page-wrap   { max-width: 700px; }
      .pickup-content     { padding: 28px 28px 0 !important; }
      .pickup-header      { padding: 16px 28px !important; }
      .pickup-map-height  { height: 360px !important; }
      .pickup-loading-box { height: 360px !important; }
      /* Action bar accounts for sidebar width */
      .pickup-action-bar  { left: 250px !important; padding: 16px 28px !important; padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px)) !important; }
      .pickup-greeting    { font-size: 16px !important; }
    }

    /* ── Large desktop (1440px+) ── */
    @media (min-width: 1440px) {
      .pickup-page-wrap   { max-width: 760px; }
      .pickup-map-height  { height: 400px !important; }
      .pickup-loading-box { height: 400px !important; }
    }

    /* ── Reduced motion ── */
    @media (prefers-reduced-motion: reduce) {
      .pickup-section { animation: none !important; }
      .pickup-gps-btn:hover,
      .pickup-cancel-btn:hover,
      .pickup-next-btn:hover,
      .pickup-back-btn:hover { transform: none !important; }
    }
  `;
  document.head.appendChild(style);
}

// ─── Component ────────────────────────────────────────────────────────────────
function PickupPage() {
  const history = useHistory();
  const username = localStorage.getItem("nama") || "User";

  const [alamat, setAlamat] = useState("");
  const [catatan, setCatatan] = useState("");
  const [position, setPosition] = useState(null);
  const [isLocating, setIsLocating] = useState(false);

  const [selectedKecamatan, setSelectedKecamatan] = useState("");
  const [selectedDesa, setSelectedDesa] = useState("");

  const dataNgawi = {
    "Pangkur":    ["Pangkur", "Bendo", "Cengkok", "Gandri"],
    "Karangjati": ["Karangjati", "Campurasri", "Danguk"],
    "Geneng":     ["Geneng", "Kedunggalar", "Ngrambe"],
    "Wonoasri":   ["Wonoasri", "Purwosari", "Buduran", "Klitik"],
  };

  useEffect(() => {
    handleGetLocation();
  }, []);

  useEffect(() => {
    if (selectedKecamatan && selectedDesa) {
      setAlamat(`${selectedDesa}, ${selectedKecamatan}, Ngawi`);
    }
  }, [selectedKecamatan, selectedDesa]);

  const handleGetLocation = () => {
    setIsLocating(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = Number(pos.coords.latitude);
          const lng = Number(pos.coords.longitude);
          console.log("GPS RAW:", pos.coords);
          console.log("FINAL LAT:", lat);
          console.log("FINAL LNG:", lng);
          setPosition([lat, lng]);
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
            );
            const data = await response.json();
            if (data && data.display_name) {
              setAlamat(data.display_name);
            } else {
              setAlamat(`Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`);
            }
          } catch (err) {
            console.error("Gagal mendapatkan alamat:", err);
            setAlamat(`Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`);
          } finally {
            setIsLocating(false);
          }
        },
        (err) => {
          console.error("Geolocation Error:", err);
          setIsLocating(false);
          alert("Gagal mengakses lokasi. Pastikan izin lokasi aktif.");
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      setIsLocating(false);
      alert("Browser Anda tidak mendukung fitur lokasi.");
    }
  };

  const handleNext = () => {
    sessionStorage.setItem("pickup_alamat", alamat);
    sessionStorage.setItem("pickup_catatan", catatan);
    if (position) {
      sessionStorage.setItem("pickup_lat", position[0]);
      sessionStorage.setItem("pickup_lng", position[1]);
    }
    history.push("/user/select-waste");
  };

  return (
    <div style={S.root}>
      <Sidebar />
      <main style={S.main}>

        {/* ── Sticky Header ─────────────────────────────────────────────────── */}
        <header className="pickup-header" style={S.header}>
          <button
            className="pickup-back-btn"
            style={S.backBtn}
            onClick={() => history.goBack()}
            aria-label="Kembali"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>

          <div style={S.avatarWrap}>
            <img
              src={
                loadStoredProfile("user").profilePhoto ||
                `https://i.pravatar.cc/150?u=${localStorage.getItem("userId") || "001"}`
              }
              alt="avatar"
              style={S.avatar}
            />
          </div>

          <div style={S.headerText}>
            <div className="pickup-greeting" style={S.greeting}>Halo, {username} 👋</div>
            <div style={S.subGreeting}>daur ulang sampahmu yuk!</div>
          </div>

        </header>

        {/* ── Page Body ─────────────────────────────────────────────────────── */}
        <div className="pickup-page-wrap" style={S.pageWrap}>
          <div className="pickup-content" style={S.content}>

            {/* Service Type Card */}
            <div className="pickup-section" style={{ animationDelay: "0.05s" }}>
              <p style={S.sectionLabel}>Tipe Pengangkutan</p>
              <div className="pickup-service-card" style={S.serviceCard}>
                <div style={S.serviceGlow} />
                <div className="pickup-icon-circle" style={S.iconCircle}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                    stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="3" width="15" height="13" rx="2"/>
                    <path d="M16 8h4l3 5v3h-7V8z"/>
                    <circle cx="5.5" cy="18.5" r="2.5"/>
                    <circle cx="18.5" cy="18.5" r="2.5"/>
                  </svg>
                </div>
                <div style={S.serviceInfo}>
                  <div style={S.serviceTitle}>Jemput Sampah</div>
                  <div style={S.serviceSubtitle}>Petugas kami menjemput sampahmu</div>
                </div>
                <div style={S.activePill}>Aktif</div>
              </div>
            </div>

            {/* Address Input */}
            <div className="pickup-section" style={{ animationDelay: "0.10s" }}>
              <p style={S.sectionLabel}>Lokasi Penjemputan</p>
              <div className="pickup-input-card" style={S.inputCard}>
                <div style={S.inputLabel}>Alamat</div>
                <input
                  type="text"
                  placeholder="masukkan alamat mu..."
                  value={alamat}
                  onChange={(e) => setAlamat(e.target.value)}
                  style={S.textInput}
                />
              </div>
            </div>

            {/* Map Section */}
            <div className="pickup-section" style={{ ...S.mapSection, animationDelay: "0.15s" }}>
              <div style={S.mapCard}>
                {isLocating && !position ? (
                  <div className="pickup-loading-box" style={S.mapLoadingBox}>
                    <div style={S.spinner} />
                    <span style={S.loadingText}>Mendeteksi lokasi GPS…</span>
                  </div>
                ) : (
                  <>
                    <style>{MAP_MODERN_CSS}</style>
                    <div className="pickup-map-container">
                      <MapContainer
                        center={position || [-6.8915, 111.4944]}
                        zoom={16}
                        className="pickup-map-height"
                        style={{ height: 240, width: "100%", borderRadius: "12px", overflow: "hidden" }}
                        {...MAP_OPTIONS}
                      >
                        <TileLayer {...getTileLayerProps()} />
                        {position && (
                          <>
                            <ChangeView center={position} zoom={16} />
                            <Marker position={position} icon={redIcon}>
                              <Popup>Lokasi Penjemputan</Popup>
                            </Marker>
                          </>
                        )}
                      </MapContainer>
                    </div>

                    {/* Floating overlay */}
                    <div style={S.mapOverlay}>
                      <div style={S.mapInfoChip}>
                        <div style={S.gpsDot} />
                        <span style={S.mapChipText}>GPS Aktif</span>
                      </div>
                      {position && (
                        <div style={S.mapCoordChip}>
                          {position[0].toFixed(4)}, {position[1].toFixed(4)}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Refresh GPS Button */}
            <div className="pickup-section" style={{ animationDelay: "0.20s" }}>
              <button
                className="pickup-gps-btn"
                style={S.gpsBtn}
                onClick={handleGetLocation}
                disabled={isLocating}
              >
                <div style={S.gpsBtnDot} />
                {isLocating ? "Mendeteksi Lokasi…" : "Gunakan Lokasi Saat Ini"}
              </button>
            </div>

            {/* Notes Section */}
            <div className="pickup-section" style={{ animationDelay: "0.25s" }}>
              <p style={S.sectionLabel}>Catatan Tambahan</p>
              <div style={S.notesCard}>
                <div style={S.notesHeader}>
                  <div style={S.notesHeaderIcon}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                  </div>
                  <div>
                    <div style={S.notesHeaderTitle}>Catatan untuk Petugas</div>
                    <div style={S.notesHeaderSub}>Blok / Unit, Patokan, dll.</div>
                  </div>
                </div>
                <textarea
                  rows={4}
                  placeholder="Contoh: Blok A No. 12, dekat warung merah…"
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  style={S.notesTextarea}
                />
              </div>
            </div>

          </div>{/* end content */}
        </div>{/* end pageWrap */}

        {/* ── Sticky Action Bar ─────────────────────────────────────────────── */}
        <div className="pickup-action-bar" style={S.actionBar}>
          <button
            className="pickup-cancel-btn"
            style={S.cancelBtn}
            onClick={() => history.goBack()}
          >
            Batal
          </button>
          <button
            className="pickup-next-btn"
            style={S.nextBtn}
            onClick={handleNext}
          >
            Berikutnya
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>

      </main>
    </div>
  );
}

export default PickupPage;