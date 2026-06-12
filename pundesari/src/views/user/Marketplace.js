import React, { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";
import Sidebar from "../../components/Sidebar.jsx";
import "../../css/Dashboard.css";
import "../../css/sidebar.css";
import { dashboardAPI, marketplaceAPI } from "../../services/api";

/* ═══════════════════════════════════════════════════
   RESPONSIVE + DESIGN STYLES
   Injected once — no external CSS file changes needed
═══════════════════════════════════════════════════ */
const MARKETPLACE_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

  /* ── CSS Variables ── */
  .mp-root {
    --mp-grad: linear-gradient(135deg, #84cc16, #16a34a);
    --mp-grad-soft: linear-gradient(135deg, rgba(132,204,22,0.12), rgba(22,163,74,0.12));
    --mp-lime: #84cc16;
    --mp-green: #16a34a;
    --mp-green-dark: #15803d;
    --mp-lime-light: #ecfccb;
    --mp-green-light: #dcfce7;
    --mp-text: #0f172a;
    --mp-muted: #64748b;
    --mp-subtle: #94a3b8;
    --mp-border: #E2E8F0;
    --mp-bg: #f5f7f5;
    --mp-white: #ffffff;
    --mp-shadow-green: 0 8px 24px rgba(22,163,74,0.22);
    --mp-shadow-card: 0 2px 12px rgba(15,23,42,0.07);
  }

  /* ── Reset scoped to marketplace ── */
  .mp-root * { box-sizing: border-box; }
  .mp-main { font-family: 'Plus Jakarta Sans', sans-serif; }

  /* ── Layout ── */
  .mp-root.dashboard-layout { display: flex; min-height: 100vh; overflow-x: hidden; }
  .mp-main { flex: 1; min-width: 0; background: var(--mp-bg); overflow-x: hidden; }

  /* ── Topbar ── */
  .mp-topbar {
    position: sticky; top: 0; z-index: 100;
    background: rgba(255,255,255,0.94);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--mp-border);
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.75rem 1.5rem;
  }

  /* ── Page wrapper ── */
  .mp-page { padding: 1.5rem 1.5rem 3rem; }

  /* ════════════════════════════════
     HERO SECTION
  ════════════════════════════════ */
  .mp-hero {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.25rem;
    border-radius: 28px;
    background: var(--mp-grad);
    overflow: hidden;
    padding: 2rem 1.5rem;
    margin-bottom: 1.5rem;
    position: relative;
    min-height: 220px;
  }

  /* Decorative noise/texture overlay */
  .mp-hero::before {
    content: '';
    position: absolute; inset: 0;
    background:
      radial-gradient(ellipse at 80% 20%, rgba(255,255,255,0.18) 0%, transparent 55%),
      radial-gradient(ellipse at 10% 90%, rgba(0,0,0,0.08) 0%, transparent 50%);
    pointer-events: none;
  }

  /* Decorative circles */
  .mp-hero::after {
    content: '';
    position: absolute;
    width: 320px; height: 320px;
    border-radius: 50%;
    background: rgba(255,255,255,0.06);
    top: -80px; right: -60px;
    pointer-events: none;
  }

  .mp-hero-text { position: relative; z-index: 1; }

  .mp-hero-badge {
    display: inline-flex; align-items: center; gap: 6px;
    background: rgba(76, 75, 75, 0.25);
    border: 1px solid rgba(0, 0, 0, 0.59);
    color: #fff;
    font-size: 0.78rem; font-weight: 700;
    padding: 0.4rem 0.9rem; border-radius: 999px;
    margin-bottom: 1rem; letter-spacing: 0.04em;
    backdrop-filter: blur(4px);
  }

  .mp-hero-title {
    color: #ffffff;
    font-size: clamp(1.4rem, 5vw, 2.6rem);
    font-weight: 800; line-height: 1.1;
    margin: 0 0 0.85rem;
    text-shadow: 0 2px 12px rgba(0,0,0,0.12);
  }

  .mp-hero-title span {
    color: #fff;
    background: rgba(0, 0, 0, 0.2);
    padding: 0 6px; border-radius: 6px;
  }

  .mp-hero-sub {
    color: rgba(255,255,255,0.85);
    font-size: clamp(0.82rem, 2vw, 0.95rem);
    line-height: 1.7; margin: 0 0 1.5rem;
    max-width: 480px;
  }

  .mp-hero-cta {
    display: inline-flex; align-items: center; gap: 8px;
    background: #fff; color: var(--mp-green);
    border: none; border-radius: 14px;
    font-size: 0.9rem; font-weight: 800;
    padding: 0.85rem 1.6rem; cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  }
  .mp-hero-cta:hover { background: var(--mp-lime-light); transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.18); }

  /* ── Wallet card (inside hero) ── */
  .mp-hero-wallet {
    position: relative; z-index: 1;
    background: rgba(0, 0, 0, 0.18);
    border: 1px solid rgba(255,255,255,0.35);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-radius: 24px;
    padding: 1.25rem 1.5rem;
    display: flex; flex-direction: column; gap: 1rem;
  }

  .mp-wallet-label {
    color: rgba(255,255,255,0.75);
    font-size: 0.78rem; font-weight: 700;
    letter-spacing: 0.06em; text-transform: uppercase;
  }
  .mp-wallet-amount {
    color: #fff;
    font-size: clamp(1.5rem, 5vw, 2.1rem);
    font-weight: 800; margin: 0.25rem 0 0.75rem;
    text-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }

  .mp-wallet-row {
    display: flex; justify-content: space-between; align-items: center;
    font-size: 0.82rem; padding: 0.5rem 0;
    border-top: 1px solid rgba(255,255,255,0.15);
  }
  .mp-wallet-row span { color: rgba(255,255,255,0.7); }
  .mp-wallet-row strong { color: #fff; }

  .mp-refresh-btn {
    width: 100%; padding: 0.8rem;
    border-radius: 14px; border: none;
    background: rgba(255,255,255,0.22);
    border: 1px solid rgba(255,255,255,0.35);
    color: #fff; font-weight: 700; font-size: 0.85rem;
    cursor: pointer; transition: all 0.2s;
    margin-top: 0.25rem; backdrop-filter: blur(4px);
  }
  .mp-refresh-btn:hover:not(:disabled) {
    background: rgba(255,255,255,0.32);
    transform: translateY(-1px);
  }
  .mp-refresh-btn:disabled { opacity: 0.55; cursor: not-allowed; }

  /* ════════════════════════════════
     QUICK CATEGORIES
  ════════════════════════════════ */
  .mp-cats-scroll {
    display: flex; gap: 0.65rem;
    overflow-x: auto; padding-bottom: 6px;
    margin-bottom: 1.25rem;
    scrollbar-width: none;
  }
  .mp-cats-scroll::-webkit-scrollbar { display: none; }

  .mp-cat-pill {
    display: flex; align-items: center; gap: 0.45rem;
    flex-shrink: 0;
    padding: 0.6rem 1.1rem;
    border-radius: 999px;
    border: 1.5px solid var(--mp-border);
    background: var(--mp-white);
    color: var(--mp-text);
    font-size: 0.85rem; font-weight: 700;
    cursor: pointer;
    transition: all 0.18s;
    min-height: 44px;
  }
  .mp-cat-pill:hover {
    border-color: var(--mp-lime);
    color: var(--mp-green);
    background: var(--mp-lime-light);
  }
  .mp-cat-pill.active {
    background: var(--mp-grad);
    border-color: transparent;
    color: #fff;
    box-shadow: var(--mp-shadow-green);
  }
  .mp-cat-emoji { font-size: 1rem; }

  /* ════════════════════════════════
     SEARCH BAR
  ════════════════════════════════ */
  .mp-search-wrap {
    display: flex; gap: 0.75rem; flex-wrap: wrap;
    margin-bottom: 1.5rem;
  }

  .mp-search-input-wrap {
    flex: 1; min-width: 200px;
    position: relative;
  }

  .mp-search-icon {
    position: absolute; left: 1rem; top: 50%; transform: translateY(-50%);
    color: var(--mp-subtle); font-size: 1rem; pointer-events: none;
  }

  .mp-search-input {
    width: 100%;
    padding: 0.9rem 1rem 0.9rem 2.75rem;
    border-radius: 16px;
    border: 1.5px solid var(--mp-border);
    background: var(--mp-white);
    font-size: 0.9rem; color: var(--mp-text);
    outline: none; font-family: inherit;
    transition: border-color 0.18s, box-shadow 0.18s;
  }
  .mp-search-input:focus {
    border-color: var(--mp-lime);
    box-shadow: 0 0 0 3px rgba(132,204,22,0.15);
  }
  .mp-search-input::placeholder { color: var(--mp-subtle); }

  .mp-reload-btn {
    padding: 0.9rem 1.5rem;
    border-radius: 16px; border: none;
    background: var(--mp-grad);
    color: #fff;
    font-weight: 700; font-size: 0.9rem;
    cursor: pointer; white-space: nowrap;
    min-height: 48px;
    transition: all 0.2s;
    box-shadow: var(--mp-shadow-green);
  }
  .mp-reload-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 12px 28px rgba(22,163,74,0.3);
  }
  .mp-reload-btn:disabled { opacity: 0.7; cursor: not-allowed; }

  /* ════════════════════════════════
     SECTION HEADER
  ════════════════════════════════ */
  .mp-section-header {
    display: flex; flex-wrap: wrap;
    justify-content: space-between; align-items: flex-end;
    gap: 0.75rem; margin-bottom: 1.25rem;
  }

  .mp-section-title {
    font-size: clamp(1.1rem, 3.5vw, 1.45rem);
    font-weight: 800; color: var(--mp-text); margin: 0 0 0.2rem;
  }

  .mp-section-sub { font-size: 0.85rem; color: var(--mp-muted); margin: 0; }

  .mp-stats { display: flex; gap: 0.75rem; flex-wrap: wrap; }
  .mp-stat-chip {
    padding: 0.55rem 1rem; border-radius: 12px;
    background: var(--mp-white); border: 1px solid var(--mp-border);
    font-size: 0.8rem; color: var(--mp-muted);
  }
  .mp-stat-chip strong { color: var(--mp-text); font-size: 0.95rem; display: block; }

  /* ════════════════════════════════
     FEEDBACK ALERT
  ════════════════════════════════ */
  .mp-alert {
    display: flex; align-items: center; gap: 0.75rem;
    padding: 1rem 1.25rem; border-radius: 16px;
    margin-bottom: 1.25rem; font-size: 0.9rem; font-weight: 500;
    animation: mp-fadein 0.3s ease;
  }
  .mp-alert.success { background: var(--mp-green-light); color: #166534; border: 1px solid #bbf7d0; }
  .mp-alert.warning { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
  .mp-alert.danger  { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }

  /* ════════════════════════════════
     PRODUCT GRID
  ════════════════════════════════ */
  .mp-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 1.25rem;
  }

  /* ── Product Card ── */
  .mp-card {
    background: var(--mp-white);
    border-radius: 24px;
    overflow: hidden;
    display: flex; flex-direction: column;
    border: 1px solid var(--mp-border);
    transition: transform 0.25s ease, box-shadow 0.25s ease;
    animation: mp-fadein 0.35s ease both;
  }
  .mp-card:hover {
    transform: translateY(-6px);
    box-shadow: 0 20px 50px rgba(22,163,74,0.13), 0 4px 16px rgba(15,23,42,0.06);
    border-color: rgba(132,204,22,0.3);
  }

  .mp-card-img-wrap {
    position: relative;
    height: 200px;
    background: var(--mp-lime-light);
    overflow: hidden;
    display: flex; align-items: center; justify-content: center;
  }

  .mp-card-img {
    max-width: 100%; max-height: 180px;
    object-fit: contain;
    transition: transform 0.35s ease;
  }
  .mp-card:hover .mp-card-img { transform: scale(1.05); }

  .mp-card-badge {
    position: absolute; top: 12px; left: 12px;
    padding: 0.3rem 0.75rem; border-radius: 999px;
    background: var(--mp-grad);
    color: #fff;
    font-size: 0.72rem; font-weight: 700; letter-spacing: 0.03em;
  }

  .mp-card-out {
    position: absolute; top: 12px; right: 12px;
    padding: 0.3rem 0.75rem; border-radius: 999px;
    background: #fee2e2; color: #b91c1c;
    font-size: 0.72rem; font-weight: 700;
  }

  .mp-card-body {
    padding: 1.1rem 1.25rem 1.25rem;
    display: flex; flex-direction: column; gap: 0.85rem;
    flex: 1;
  }

  .mp-card-name {
    font-size: clamp(0.9rem, 2vw, 1rem);
    font-weight: 700; color: var(--mp-text); margin: 0;
    display: -webkit-box; -webkit-line-clamp: 2;
    -webkit-box-orient: vertical; overflow: hidden;
  }

  .mp-card-desc {
    font-size: 0.8rem; color: var(--mp-muted);
    line-height: 1.6; margin: 0;
    display: -webkit-box; -webkit-line-clamp: 2;
    -webkit-box-orient: vertical; overflow: hidden;
  }

  .mp-card-footer {
    display: flex; justify-content: space-between;
    align-items: flex-end; gap: 0.5rem; flex-wrap: wrap;
    margin-top: auto;
  }

  .mp-card-price-label { font-size: 0.75rem; color: var(--mp-subtle); margin-bottom: 2px; }
  .mp-card-price { font-size: clamp(1.05rem, 3vw, 1.3rem); font-weight: 800; color: var(--mp-text); }

  .mp-card-stock-wrap { text-align: right; }
  .mp-card-stock-label { font-size: 0.75rem; color: var(--mp-subtle); margin-bottom: 2px; }
  .mp-card-stock { font-size: 0.9rem; font-weight: 700; }
  .mp-card-stock.in  { color: var(--mp-green); }
  .mp-card-stock.out { color: #dc2626; }

  .mp-buy-btn {
    width: 100%; padding: 0.85rem 1rem;
    border-radius: 14px; border: none;
    font-size: 0.88rem; font-weight: 700;
    cursor: pointer; transition: all 0.2s;
    min-height: 48px; font-family: inherit;
  }
  .mp-buy-btn.can {
    background: var(--mp-grad);
    color: #fff;
    box-shadow: 0 4px 14px rgba(22,163,74,0.28);
  }
  .mp-buy-btn.can:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 20px rgba(22,163,74,0.35);
  }
  .mp-buy-btn.cant { background: #f1f5f9; color: var(--mp-subtle); cursor: not-allowed; }

  /* ════════════════════════════════
     EMPTY / LOADING STATE
  ════════════════════════════════ */
  .mp-state-box {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 0.75rem;
    padding: 3rem 1rem; border-radius: 24px;
    background: var(--mp-white); border: 1.5px dashed rgba(132,204,22,0.3);
    color: var(--mp-muted); text-align: center; font-size: 0.95rem;
  }
  .mp-state-icon { font-size: 2.5rem; }

  /* ════════════════════════════════
     CONFIRM MODAL
  ════════════════════════════════ */
  .mp-overlay {
    position: fixed; inset: 0; z-index: 9999;
    background: rgba(15,23,42,0.45);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center;
    padding: 1rem;
    animation: mp-fadein 0.2s ease;
  }

  .mp-modal {
    width: 100%; max-width: 460px;
    background: #fff;
    border-radius: 28px;
    overflow: hidden;
    box-shadow: 0 32px 80px rgba(22,163,74,0.18), 0 8px 24px rgba(15,23,42,0.12);
    animation: mp-slideup 0.25s ease;
    border: 1px solid rgba(132,204,22,0.15);
  }

  /* Gradient accent bar at top of modal */
  .mp-modal::before {
    content: '';
    display: block;
    height: 4px;
    background: var(--mp-grad);
  }

  .mp-modal-header {
    padding: 1.25rem 1.5rem 0;
    display: flex; justify-content: space-between; align-items: flex-start;
  }

  .mp-modal-title { font-size: 1.3rem; font-weight: 800; color: var(--mp-text); margin: 0 0 0.3rem; }
  .mp-modal-sub   { font-size: 0.82rem; color: var(--mp-muted); margin: 0; }

  .mp-modal-close {
    width: 36px; height: 36px; border-radius: 10px;
    border: 1.5px solid var(--mp-border);
    background: #f8fafc; color: var(--mp-muted);
    font-size: 1.1rem; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; transition: all 0.15s;
  }
  .mp-modal-close:hover { background: #fee2e2; border-color: #fecaca; color: #dc2626; }

  .mp-modal-body { padding: 1.25rem 1.5rem; }

  .mp-order-summary {
    background: var(--mp-lime-light);
    border: 1px solid rgba(132,204,22,0.2);
    border-radius: 18px;
    padding: 1.1rem 1.25rem;
    display: flex; flex-direction: column; gap: 0;
    margin-bottom: 1.25rem;
  }

  .mp-order-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 0.65rem 0; font-size: 0.88rem;
    border-bottom: 1px solid rgba(132,204,22,0.15);
  }
  .mp-order-row:last-child { border-bottom: none; }
  .mp-order-row .label { color: var(--mp-muted); }
  .mp-order-row .value { font-weight: 600; color: var(--mp-text); text-align: right; max-width: 60%; word-break: break-word; }
  .mp-order-row.total .label { color: var(--mp-text); font-weight: 700; }
  .mp-order-row.total .value { color: var(--mp-green); font-weight: 800; font-size: 1rem; }

  .mp-modal-actions { display: flex; gap: 0.75rem; }

  .mp-modal-cancel {
    flex: 1; padding: 0.9rem;
    border-radius: 14px; border: 1.5px solid var(--mp-border);
    background: #fff; color: var(--mp-text);
    font-weight: 700; font-size: 0.9rem;
    cursor: pointer; min-height: 48px; font-family: inherit;
    transition: all 0.15s;
  }
  .mp-modal-cancel:hover { background: #f8fafc; border-color: #cbd5e1; }

  .mp-modal-confirm {
    flex: 1.4; padding: 0.9rem;
    border-radius: 14px; border: none;
    background: var(--mp-grad);
    color: #fff; font-weight: 700; font-size: 0.9rem;
    cursor: pointer; min-height: 48px; font-family: inherit;
    transition: all 0.2s;
    box-shadow: var(--mp-shadow-green);
  }
  .mp-modal-confirm:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 10px 28px rgba(22,163,74,0.35);
  }
  .mp-modal-confirm:disabled { background: #9ca3af; cursor: not-allowed; transform: none; box-shadow: none; }

  .mp-modal-warn {
    font-size: 0.82rem; color: #b91c1c;
    background: #fee2e2; border-radius: 10px;
    padding: 0.6rem 0.85rem; margin-top: 0.75rem;
  }

  /* ════════════════════════════════
     ANIMATIONS
  ════════════════════════════════ */
  @keyframes mp-fadein {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes mp-slideup {
    from { opacity: 0; transform: translateY(24px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  /* Card stagger */
  .mp-card:nth-child(1) { animation-delay: 0.04s; }
  .mp-card:nth-child(2) { animation-delay: 0.08s; }
  .mp-card:nth-child(3) { animation-delay: 0.12s; }
  .mp-card:nth-child(4) { animation-delay: 0.16s; }
  .mp-card:nth-child(5) { animation-delay: 0.20s; }
  .mp-card:nth-child(6) { animation-delay: 0.24s; }
  .mp-card:nth-child(n+7) { animation-delay: 0.28s; }

  /* ════════════════════════════════
     RESPONSIVE BREAKPOINTS
  ════════════════════════════════ */

  /* Tablet 768px+ */
  @media (min-width: 768px) {
    .mp-hero {
      grid-template-columns: 1fr auto;
      padding: 2.5rem;
      min-height: 260px;
    }
    .mp-hero-wallet { min-width: 280px; max-width: 300px; }
    .mp-grid { grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
  }

  /* Laptop 1024px+ */
  @media (min-width: 1024px) {
    .mp-page { padding: 2rem 2rem 3rem; }
    .mp-hero { padding: 3rem; min-height: 280px; }
    .mp-hero-wallet { min-width: 300px; }
    .mp-grid { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
  }

  /* Desktop 1200px+ */
  @media (min-width: 1200px) {
    .mp-page { padding: 2rem 2.5rem 3rem; }
    .mp-grid { grid-template-columns: repeat(4, 1fr); }
  }

  /* Mobile 480px and below */
  @media (max-width: 479px) {
    .mp-page { padding: 1rem 1rem 2rem; }
    .mp-hero { padding: 1.5rem 1.25rem; }
    .mp-grid { grid-template-columns: repeat(2, 1fr); gap: 0.75rem; }
    .mp-card-img-wrap { height: 150px; }
    .mp-card-body { padding: 0.85rem 0.9rem 0.9rem; gap: 0.6rem; }
    .mp-buy-btn { padding: 0.75rem; font-size: 0.8rem; }
    .mp-modal { border-radius: 20px; }
    .mp-modal-header { padding: 1.25rem 1.25rem 0; }
    .mp-modal-body { padding: 1rem 1.25rem; }
  }

  /* Small mobile 320px */
  @media (max-width: 359px) {
    .mp-grid { grid-template-columns: 1fr; }
    .mp-hero-title { font-size: 1.3rem; }
  }
`;

/* ═══════════════════════════════════════════════════
   CATEGORY EMOJI MAP
═══════════════════════════════════════════════════ */
const CAT_EMOJI = {
  Semua: '🛒', Beras: '🌾', Minyak: '🫙', Telur: '🥚',
  Gula: '🍬', Tepung: '🌿', Bumbu: '🌶️', Minuman: '🧃', Paket: '📦',
};

const CATEGORIES = ['Semua', 'Beras', 'Minyak', 'Telur', 'Gula', 'Tepung', 'Bumbu', 'Minuman', 'Paket'];

function Marketplace() {
  const history = useHistory();
  const [products, setProducts] = useState([]);
  const [balanceData, setBalanceData] = useState({
    saldo: 0,
    saldo_hold: 0,
    available_balance: 0,
  });
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);
  const [processingProductId, setProcessingProductId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [searchTerm, setSearchTerm] = useState('');
  const userId = localStorage.getItem("userId") || 1;

  /* ── Unchanged helpers ── */
  const getCategoryPlaceholder = (category) => {
    const categoryKey = (category || '').toLowerCase();
    const placeholders = {
      beras: 'https://dummyimage.com/520x320/16a34a/ffffff&text=Beras',
      minyak: 'https://dummyimage.com/520x320/16a34a/ffffff&text=Minyak',
      telur: 'https://dummyimage.com/520x320/16a34a/ffffff&text=Telur',
      gula: 'https://dummyimage.com/520x320/16a34a/ffffff&text=Gula',
      tepung: 'https://dummyimage.com/520x320/16a34a/ffffff&text=Tepung',
      bumbu: 'https://dummyimage.com/520x320/16a34a/ffffff&text=Bumbu',
      minuman: 'https://dummyimage.com/520x320/16a34a/ffffff&text=Minuman',
      paket: 'https://dummyimage.com/520x320/16a34a/ffffff&text=Paket',
    };
    return placeholders[categoryKey] || 'https://via.placeholder.com/520x320/ffffff/16a34a?text=Produk+Sembako';
  };

  const getProductImage = (product) => {
    if (product?.gambar) return product.gambar;
    return getCategoryPlaceholder(product?.kategori || product?.nama);
  };

  /* ── Unchanged effects & handlers ── */
  useEffect(() => {
    loadMarketplace();

    const handleStorage = (event) => {
      if (event.key === 'holdBalanceUpdatedAt') {
        refreshBalance();
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [userId]);

  const loadMarketplace = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const [productsRes, balanceRes] = await Promise.all([
        marketplaceAPI.getProducts(),
        dashboardAPI.getUserBalance(userId),
      ]);
      setProducts(productsRes.data || []);
      setBalanceData({
        saldo: Number(balanceRes.data.saldo || 0),
        saldo_hold: Number(balanceRes.data.saldo_hold || 0),
        available_balance: Number(balanceRes.data.available_balance || 0),
      });
    } catch (err) {
      console.error("Error loading marketplace:", err);
      setFeedback({ type: "danger", message: err.response?.data?.message || "Gagal memuat marketplace." });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const refreshBalance = async () => {
    setRefreshing(true);
    try {
      const balanceRes = await dashboardAPI.getUserBalance(userId);
      setBalanceData({
        saldo: Number(balanceRes.data.saldo || 0),
        saldo_hold: Number(balanceRes.data.saldo_hold || 0),
        available_balance: Number(balanceRes.data.available_balance || 0),
      });
    } catch (err) {
      console.error("Failed to refresh balance:", err);
      setFeedback({ type: "danger", message: err.response?.data?.message || "Gagal menyegarkan saldo." });
    } finally {
      setRefreshing(false);
    }
  };

  const filteredProducts = products.filter((product) => {
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !term ||
      product.nama.toLowerCase().includes(term) ||
      (product.deskripsi || '').toLowerCase().includes(term);
    const matchesCategory =
      selectedCategory === 'Semua' ||
      product.kategori?.toLowerCase() === selectedCategory.toLowerCase() ||
      product.nama.toLowerCase().includes(selectedCategory.toLowerCase());
    return matchesSearch && matchesCategory;
  });

  const handlePurchase = (product) => {
    if (processingProductId || product.stok <= 0) return;
    const quantity = 1;
    const totalPrice = Number(product.harga || 0) * quantity;
    if (balanceData.available_balance < totalPrice) {
      setFeedback({ type: "warning", message: "Saldo tersedia tidak cukup untuk membeli produk ini." });
      return;
    }
    setConfirmModal({ product, quantity, totalPrice });
  };

  const confirmPurchase = async () => {
    if (!confirmModal) return;
    const { product, quantity, totalPrice } = confirmModal;
    setProcessingProductId(product.id);
    setConfirmModal(null);
    setFeedback(null);
    try {
      await marketplaceAPI.createOrder(product.id, {
        jumlah: quantity,
        catatan: `Beli ${product.nama} x${quantity}`,
      });
      await Promise.all([loadMarketplace(), refreshBalance()]);
      setFeedback({ type: "success", message: "Pesanan selesai! Silahkan ambil di koperasi desa." });
    } catch (err) {
      console.error("Marketplace purchase failed:", err);
      setFeedback({ type: "danger", message: err.response?.data?.message || "Gagal melakukan pembelian. Coba lagi." });
    } finally {
      setProcessingProductId(null);
    }
  };

  const cancelPurchase = () => setConfirmModal(null);

  /* ══════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════ */
  return (
    <div className="dashboard-layout mp-root">
      <style>{MARKETPLACE_STYLE}</style>
      <Sidebar />

      <main className="dashboard-main mp-main">
        {/* ── Topbar ── */}
        <header className="mp-topbar topbar">
          <div />
          <div className="topbar-right">
            {/* TopbarUserProfile removed per original – no import in file */}
          </div>
        </header>

        <div className="mp-page">

          {/* ════════════════════════════════
              SECTION 1 — HERO + WALLET
          ════════════════════════════════ */}
          <section className="mp-hero">
            {/* Left: Text */}
            <div className="mp-hero-text">
              <div className="mp-hero-badge">
                ✦ Marketplace Sembako Digital
              </div>
              <h1 className="mp-hero-title">
                Belanja <span>kebutuhan pokok</span><br />
                tanpa antrian
              </h1>
              <p className="mp-hero-sub">
                Pilih produk lengkap, bayar langsung dengan saldo poin kamu,
                dan nikmati kemudahan berbelanja kapan saja.
              </p>
              <button className="mp-hero-cta" onClick={() => {}}>
                Mulai Belanja →
              </button>
            </div>

            {/* Right: Wallet Card */}
            <div className="mp-hero-wallet">
              <div>
                <div className="mp-wallet-label">Saldo Tersedia</div>
                <div className="mp-wallet-amount">
                  Rp {Number(balanceData.available_balance).toLocaleString('id-ID')}
                </div>
              </div>
              <div>
                <div className="mp-wallet-row">
                  <span>Saldo total</span>
                  <strong>Rp {Number(balanceData.saldo).toLocaleString('id-ID')}</strong>
                </div>
                <div className="mp-wallet-row">
                  <span>Saldo tertahan</span>
                  <strong>Rp {Number(balanceData.saldo_hold).toLocaleString('id-ID')}</strong>
                </div>
              </div>
              <button
                type="button"
                className="mp-refresh-btn"
                onClick={refreshBalance}
                disabled={refreshing}
              >
                {refreshing ? '⏳ Menyegarkan...' : '↻ Segarkan Saldo'}
              </button>
            </div>
          </section>

          {/* ════════════════════════════════
              SECTION 2 — QUICK CATEGORIES
          ════════════════════════════════ */}
          <div className="mp-cats-scroll">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                className={`mp-cat-pill${selectedCategory === category ? ' active' : ''}`}
                onClick={() => setSelectedCategory(category)}
              >
                <span className="mp-cat-emoji">{CAT_EMOJI[category] || '🏷️'}</span>
                {category}
              </button>
            ))}
          </div>

          {/* ════════════════════════════════
              SECTION 3 — SEARCH + REFRESH
          ════════════════════════════════ */}
          <div className="mp-search-wrap">
            <div className="mp-search-input-wrap">
              <span className="mp-search-icon">🔍</span>
              <input
                type="search"
                className="mp-search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari produk, kategori, atau kebutuhan..."
              />
            </div>
            <button
              type="button"
              className="mp-reload-btn"
              onClick={loadMarketplace}
              disabled={loading}
            >
              {loading ? 'Memuat...' : '↻ Segarkan'}
            </button>
          </div>

          {/* ════════════════════════════════
              SECTION 4 — PRODUCT GRID
          ════════════════════════════════ */}
          <section>
            <div className="mp-section-header">
              <div>
                <h2 className="mp-section-title">Produk Marketplace</h2>
                <p className="mp-section-sub">Semua produk sembako disiapkan untuk kebutuhan harian.</p>
              </div>
              <div className="mp-stats">
                <div className="mp-stat-chip">
                  <strong>{filteredProducts.length}</strong>
                  Produk
                </div>
                <div className="mp-stat-chip">
                  <strong>{selectedCategory}</strong>
                  Filter
                </div>
              </div>
            </div>

            {/* Feedback Alert */}
            {feedback && (
              <div className={`mp-alert ${feedback.type}`}>
                {feedback.type === 'success' ? '✅' : feedback.type === 'warning' ? '⚠️' : '❌'}
                {feedback.message}
              </div>
            )}

            {/* States */}
            {loading ? (
              <div className="mp-state-box">
                <div className="mp-state-icon">⏳</div>
                <p>Memuat produk...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="mp-state-box">
                <div className="mp-state-icon">🔍</div>
                <p>Tidak ada produk yang cocok.</p>
              </div>
            ) : (
              <div className="mp-grid">
                {filteredProducts.map((product) => {
                  const price = Number(product.harga || 0);
                  const canBuy = product.stok > 0 && balanceData.available_balance >= price;
                  const isProcessing = processingProductId === product.id;

                  return (
                    <div key={product.id} className="mp-card">
                      {/* Image */}
                      <div className="mp-card-img-wrap">
                        <img
                          src={getProductImage(product)}
                          alt={product.nama}
                          loading="lazy"
                          className="mp-card-img"
                          onError={(e) => { e.currentTarget.src = getCategoryPlaceholder(product.kategori); }}
                        />
                        <div className="mp-card-badge">
                          {product.kategori || 'Sembako'}
                        </div>
                        {product.stok <= 0 && (
                          <div className="mp-card-out">Habis</div>
                        )}
                      </div>

                      {/* Body */}
                      <div className="mp-card-body">
                        <div>
                          <h3 className="mp-card-name">{product.nama}</h3>
                          {product.deskripsi && (
                            <p className="mp-card-desc">{product.deskripsi}</p>
                          )}
                        </div>

                        <div className="mp-card-footer">
                          <div>
                            <div className="mp-card-price-label">Harga</div>
                            <div className="mp-card-price">Rp {price.toLocaleString('id-ID')}</div>
                          </div>
                          <div className="mp-card-stock-wrap">
                            <div className="mp-card-stock-label">Stok</div>
                            <div className={`mp-card-stock ${product.stok > 0 ? 'in' : 'out'}`}>
                              {product.stok}
                            </div>
                          </div>
                        </div>

                        <button
                          className={`mp-buy-btn ${canBuy && !isProcessing ? 'can' : 'cant'}`}
                          onClick={() => handlePurchase(product)}
                          disabled={!canBuy || isProcessing}
                        >
                          {isProcessing
                            ? '⏳ Memproses...'
                            : product.stok <= 0
                            ? '❌ Stok Habis'
                            : canBuy
                            ? '🛒 Beli Sekarang'
                            : '💳 Saldo Tidak Cukup'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* ════════════════════════════════
          CONFIRM MODAL
      ════════════════════════════════ */}
      {confirmModal && (
        <div className="mp-overlay">
          <div className="mp-modal">
            <div className="mp-modal-header">
              <div>
                <h3 className="mp-modal-title">Konfirmasi Pesanan</h3>
                <p className="mp-modal-sub">Pembayaran otomatis dipotong dari saldo Anda.</p>
              </div>
              <button type="button" className="mp-modal-close" onClick={cancelPurchase}>
                ×
              </button>
            </div>

            <div className="mp-modal-body">
              <div className="mp-order-summary">
                <div className="mp-order-row">
                  <span className="label">Produk</span>
                  <span className="value">{confirmModal.product.nama}</span>
                </div>
                <div className="mp-order-row">
                  <span className="label">Jumlah</span>
                  <span className="value">{confirmModal.quantity} pcs</span>
                </div>
                <div className="mp-order-row">
                  <span className="label">Metode Bayar</span>
                  <span className="value">💳 Saldo</span>
                </div>
                <div className="mp-order-row">
                  <span className="label">Saldo Tersedia</span>
                  <span className="value">Rp {balanceData.available_balance.toLocaleString('id-ID')}</span>
                </div>
                <div className="mp-order-row total">
                  <span className="label">Total Bayar</span>
                  <span className="value">Rp {confirmModal.totalPrice.toLocaleString('id-ID')}</span>
                </div>
              </div>

              <div className="mp-modal-actions">
                <button type="button" className="mp-modal-cancel" onClick={cancelPurchase}>
                  Batal
                </button>
                <button
                  type="button"
                  className="mp-modal-confirm"
                  onClick={confirmPurchase}
                  disabled={
                    processingProductId === confirmModal.product.id ||
                    balanceData.available_balance < confirmModal.totalPrice
                  }
                >
                  {processingProductId === confirmModal.product.id
                    ? '⏳ Memproses...'
                    : '✅ Bayar dengan Saldo'}
                </button>
              </div>

              {balanceData.available_balance < confirmModal.totalPrice && (
                <div className="mp-modal-warn">
                  ⚠️ Saldo tidak cukup. Kurangi jumlah atau isi saldo terlebih dahulu.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Marketplace;