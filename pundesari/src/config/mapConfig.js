/**
 * Global Map Configuration
 * Centralized Leaflet + CARTO settings
 * Used by: TrackingUser, TrackingPetugas, DriverDashboard, PickupPage, OrderDetail, Peta
 */

// ─── CARTO Voyager Basemap (stable, modern, Google Maps-like) ────────────────
export const BASEMAP_URL =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

export const BASEMAP_ATTRIBUTION =
  "&copy; OpenStreetMap contributors &copy; CARTO";

// ─── Map Container Options (prevents infinite tile loading) ───────────────
export const MAP_OPTIONS = {
  maxZoom: 20,
  minZoom: 3,
  zoomControl: false, // disable default controls (custom ones below)
  attributionControl: true,
  preferCanvas: true, // better performance
};

// ─── Zoom Control Style (modern, minimal) ──────────────────────────────────
export const ZOOM_CONTROL_STYLE = {
  position: "bottomright",
  zoomInTitle: "Perbesar",
  zoomOutTitle: "Perkecil",
};

// ─── Map Container Modern Styling (rounded, shadow, border) ────────────────
export const MAP_CONTAINER_STYLE = {
  height: "100%",
  width: "100%",
  borderRadius: "16px",
  overflow: "hidden",
  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.12)",
  border: "1px solid rgba(0, 0, 0, 0.06)",
};

// ─── Default Map Center (Madiun, Jawa Timur) ──────────────────────────────
export const DEFAULT_CENTER = [-7.8, 110.3];
export const DEFAULT_ZOOM = 15;

// ─── Color Palette for Markers & Overlays (consistent across app) ─────────
export const MAP_COLORS = {
  primary: "#22c55e", // green
  secondary: "#3b82f6", // blue
  danger: "#ef4444", // red
  warning: "#f59e0b", // amber
  success: "#10b981", // emerald
};

// ─── TileLayer Props Helper (prevents duplication) ───────────────────────
export const getTileLayerProps = () => ({
  url: BASEMAP_URL,
  attribution: BASEMAP_ATTRIBUTION,
  maxZoom: MAP_OPTIONS.maxZoom,
  minZoom: MAP_OPTIONS.minZoom,
});

// ─── CSS for Modern Map Controls & Popups ──────────────────────────────────
export const MAP_MODERN_CSS = `
  /* Leaflet global overrides */
  .leaflet-container {
    background: #f5f5f5 !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }

  /* Modern zoom control */
  .leaflet-control-zoom {
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
    border: 1px solid rgba(0, 0, 0, 0.06);
    background: #fff !important;
    margin: 10px !important;
  }

  .leaflet-control-zoom a {
    width: 36px !important;
    height: 36px !important;
    line-height: 36px !important;
    font-size: 14px !important;
    color: #0f172a !important;
    border: none !important;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06) !important;
    transition: all 0.2s ease !important;
  }

  .leaflet-control-zoom a:last-child {
    border-bottom: none !important;
  }

  .leaflet-control-zoom a:hover {
    background: #f0f9ff !important;
    color: #22c55e !important;
  }

  /* Attribution control */
  .leaflet-control-attribution {
    background: rgba(255, 255, 255, 0.92) !important;
    backdrop-filter: blur(10px) !important;
    border-radius: 8px !important;
    border: 1px solid rgba(0, 0, 0, 0.06) !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08) !important;
    font-size: 10px !important;
    padding: 4px 8px !important;
  }

  .leaflet-control-attribution a {
    color: #22c55e !important;
    text-decoration: none !important;
  }

  .leaflet-control-attribution a:hover {
    text-decoration: underline !important;
  }

  /* Modern popup styling */
  .leaflet-popup {
    margin-bottom: 0 !important;
  }

  .leaflet-popup-content-wrapper {
    background: #fff !important;
    border-radius: 12px !important;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15) !important;
    border: 1px solid rgba(0, 0, 0, 0.08) !important;
    padding: 0 !important;
  }

  .leaflet-popup-content {
    margin: 12px !important;
    font-size: 13px !important;
    color: #0f172a !important;
    line-height: 1.5 !important;
  }

  .leaflet-popup-tip {
    background: #fff !important;
    border: 1px solid rgba(0, 0, 0, 0.08) !important;
  }

  /* Modern marker styles */
  .leaflet-marker-icon {
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2)) !important;
  }

  /* Smooth transitions */
  .leaflet-zoom-anim .leaflet-layer,
  .leaflet-fade-anim .leaflet-tile,
  .leaflet-fade-anim .leaflet-popup {
    transition: opacity 0.2s !important;
  }

  /* Responsive scroll behavior */
  .leaflet-container {
    scroll-behavior: smooth;
  }

  /* Hide default markers (will use custom) */
  .leaflet-marker-pane img.leaflet-marker-icon {
    filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.15));
  }
`;

export default {
  BASEMAP_URL,
  BASEMAP_ATTRIBUTION,
  MAP_OPTIONS,
  ZOOM_CONTROL_STYLE,
  MAP_CONTAINER_STYLE,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  MAP_COLORS,
  getTileLayerProps,
  MAP_MODERN_CSS,
};
