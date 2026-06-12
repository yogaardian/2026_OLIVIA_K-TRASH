import React, { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";
import Sidebar from "../../components/Sidebar.jsx";
import "../../css/Dashboard.css";
import "../../css/sidebar.css";
import { dashboardAPI, hargaAPI } from "../../services/api";

import HeroBg from "../../assets/hero.png";
import TopbarUserProfile from "../../components/TopbarUserProfile";

/* ─────────────────────────────────────────────
   Inline responsive styles injected once
   (avoids editing Dashboard.css while keeping
    full responsiveness at every breakpoint)
───────────────────────────────────────────── */
const RESPONSIVE_STYLE = `
  /* ── Layout shell ── */
  .dashboard-layout {
    display: flex;
    min-height: 100vh;
    overflow-x: hidden;
  }

  .dashboard-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow-x: hidden;
  }

  /* ── Topbar ── */
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    flex-shrink: 0;
  }

  /* ── Scrollable content area ── */
  .dashboard-content {
    flex: 1;
    padding: 1rem;
    overflow-x: hidden;
    box-sizing: border-box;
  }

  /* ── Hero Banner ── */
  .hero-banner {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    border-radius: 16px;
    padding: 1.25rem;
    margin-bottom: 1.25rem;
    overflow: hidden;
  }

  .hero-banner-text {
    flex: 1;
    min-width: 0;
  }

  .hero-greeting {
    font-size: 0.95rem;
    margin: 0 0 0.35rem;
  }

  .hero-heading {
    font-size: clamp(1.1rem, 4vw, 1.75rem);
    line-height: 1.3;
    margin: 0 0 0.5rem;
    word-break: break-word;
  }

  .hero-sub {
    font-size: clamp(0.8rem, 2.5vw, 0.95rem);
    line-height: 1.6;
    margin: 0;
  }

  .hero-banner-img {
    display: flex;
    justify-content: center;
    max-height: 160px;
    overflow: hidden;
  }

  .hero-banner-img img {
    max-width: 100%;
    max-height: 160px;
    object-fit: contain;
    display: block;
  }

  /* ── Saldo Card ── */
  .saldo-card {
    border-radius: 16px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    cursor: pointer;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 220px;
    width: 100%;
  }

  .saldo-card-top {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    flex-wrap: nowrap;
  }

  .saldo-icon-wrap {
    font-size: 2rem;
    flex-shrink: 0;
    margin-top: 4px;
  }

  .saldo-label {
    font-size: 0.88rem;
    margin: 0 0 0.5rem;
    opacity: 0.9;
  }

  .saldo-amount {
    font-size: clamp(1.4rem, 6vw, 2rem);
    margin: 0;
    word-break: break-word;
    font-weight: 700;
  }

  .saldo-subtext {
    font-size: clamp(0.75rem, 2.5vw, 0.92rem) !important;
    line-height: 1.6;
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 0.8rem;
    margin-top: 12px !important;
    opacity: 0.85;
  }

  .saldo-card-bottom {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 0.5rem;
    padding-top: 0.1rem;
    font-size: 0.95rem;
  }

  /* ── Info Grid ── */
  .info-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  /* ── Info Card ── */
  .info-card {
    border-radius: 16px;
    overflow: hidden;
    box-sizing: border-box;
  }

  .info-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1rem 0.5rem;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .info-card-header h3 {
    font-size: clamp(0.9rem, 3vw, 1.05rem);
    margin: 0;
  }

  .link-btn {
    font-size: 0.82rem;
    padding: 0.4rem 0.75rem;
    min-height: 44px;
    min-width: 44px;
    display: inline-flex;
    align-items: center;
    cursor: pointer;
    white-space: nowrap;
    border: none;
    background: none;
  }

  /* ── Harga List ── */
  .harga-list {
    padding: 0.5rem 0.75rem 0.75rem;
  }

  .harga-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.6rem 0.25rem;
    gap: 0.5rem;
    flex-wrap: nowrap;
  }

  .harga-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
    flex: 1;
  }

  .harga-icon {
    font-size: 1.1rem;
    flex-shrink: 0;
  }

  .harga-nama {
    font-size: clamp(0.78rem, 2.5vw, 0.9rem);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .harga-price {
    font-size: clamp(0.78rem, 2.5vw, 0.9rem);
    font-weight: 600;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .per-kg {
    font-weight: 400;
    font-size: 0.75em;
  }

  /* ── Aktivitas List ── */
  .aktivitas-list {
    padding: 0.5rem 0.75rem 0.75rem;
  }

  .aktivitas-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.6rem 0.25rem;
    flex-wrap: nowrap;
  }

  .aktivitas-icon {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
    flex-shrink: 0;
  }

  .aktivitas-info {
    flex: 1;
    min-width: 0;
  }

  .aktivitas-judul {
    font-size: clamp(0.78rem, 2.5vw, 0.88rem);
    margin: 0 0 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .aktivitas-waktu {
    font-size: clamp(0.68rem, 2vw, 0.78rem);
    margin: 0;
  }

  .status-badge {
    font-size: 0.72rem;
    padding: 0.25rem 0.5rem;
    border-radius: 20px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* ── CTA Section ── */
  .cta-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    border-radius: 16px;
    padding: 1.25rem;
    margin-bottom: 1.5rem;
    box-sizing: border-box;
  }

  .cta-left {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    flex: 1;
  }

  .cta-icon {
    font-size: 1.75rem;
    flex-shrink: 0;
  }

  .cta-left h3 {
    font-size: clamp(0.9rem, 3vw, 1.05rem);
    margin: 0 0 0.3rem;
    line-height: 1.3;
  }

  .cta-left p {
    font-size: clamp(0.8rem, 2.5vw, 0.9rem);
    margin: 0;
    line-height: 1.5;
  }

  .cta-btn {
    width: 100%;
    padding: 0.875rem 1.25rem;
    min-height: 48px;
    border-radius: 12px;
    font-size: clamp(0.85rem, 2.5vw, 0.95rem);
    cursor: pointer;
    border: none;
    text-align: center;
    box-sizing: border-box;
  }

  /* ─────────────────────────────────────────
     Tablet: 480px+
  ───────────────────────────────────────── */
  @media (min-width: 480px) {
    .dashboard-content {
      padding: 1.25rem;
    }

    .hero-banner {
      flex-direction: row;
      align-items: center;
      padding: 1.5rem;
    }

    .hero-banner-img {
      max-height: 180px;
      flex-shrink: 0;
      width: 40%;
    }

    .hero-banner-img img {
      max-height: 180px;
    }

    .cta-section {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
    }

    .cta-btn {
      width: auto;
      white-space: nowrap;
      flex-shrink: 0;
    }
  }

  /* ─────────────────────────────────────────
     Tablet: 768px+
  ───────────────────────────────────────── */
  @media (min-width: 768px) {
    .dashboard-content {
      padding: 1.5rem;
    }

    .info-grid {
      grid-template-columns: 1fr 1fr;
    }

    .hero-banner {
      padding: 2rem;
    }

    .hero-banner-img {
      max-height: 200px;
    }

    .hero-banner-img img {
      max-height: 200px;
    }

    .saldo-card {
      padding: 2rem;
      min-height: 240px;
    }

    .saldo-card-bottom {
      margin-top: 2rem;
      padding-top: 1.25rem;
    }

    .aktivitas-icon {
      width: 42px;
      height: 42px;
    }
  }

  /* ─────────────────────────────────────────
     Laptop / Desktop: 1024px+
  ───────────────────────────────────────── */
  @media (min-width: 1024px) {
    .dashboard-content {
      padding: 2rem;
    }

    .hero-banner {
      padding: 2.5rem;
      margin-bottom: 1.5rem;
    }

    .hero-banner-img {
      max-height: 220px;
    }

    .hero-banner-img img {
      max-height: 220px;
    }

    .saldo-card {
      padding: 2.5rem;
      min-height: 260px;
    }

    .saldo-card-bottom {
      margin-top: 2.5rem;
      padding-top: 1.5rem;
    }

    .info-grid {
      gap: 1.25rem;
      margin-bottom: 1.25rem;
    }

    .cta-section {
      padding: 1.75rem 2rem;
    }
  }

  /* ─────────────────────────────────────────
     Large Desktop: 1440px+
  ───────────────────────────────────────── */
  @media (min-width: 1440px) {
    .dashboard-content {
      padding: 2rem 2.5rem;
    }
  }
`;

function UserDashboard() {
  const history = useHistory();
  const [balanceData, setBalanceData] = useState({ 
    saldo: 0, 
    saldo_hold: 0, 
    available_balance: 0 
  });
  const [isBalanceLoading, setIsBalanceLoading] = useState(true);
  const [hargaSampah, setHargaSampah] = useState([]);
  const [aktivitas, setAktivitas] = useState([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const username = localStorage.getItem("nama") || "User";
  const userId = localStorage.getItem("userId") || 1;

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setIsDataLoading(true);
        setError(null);

        // Fetch balance
        const balanceRes = await dashboardAPI.getUserBalance(userId);
        setBalanceData({
          saldo: balanceRes.data.saldo || 0,
          saldo_hold: balanceRes.data.saldo_hold || 0,
          available_balance: balanceRes.data.available_balance || 0,
        });

        // Fetch harga sampah - try multiple categories
        const hargaRes = await hargaAPI.getByJenis('anorganik');
        setHargaSampah(hargaRes.data.slice(0, 5));

        // Fetch aktivitas user (recent orders), kecualikan order yang dibatalkan
        const aktivitasRes = await dashboardAPI.getUserOrders(userId);
        const visibleOrders = aktivitasRes.data.filter(order => order.status !== 'cancelled');
        const formatted = visibleOrders.slice(0, 4).map(order => ({
          icon: "🚛",
          iconBg: "#dcfce7",
          judul: `Order #${order.id} - ${order.status}`,
          waktu: new Date(order.created_at).toLocaleString('id-ID'),
          status: order.status === 'completed' ? 'Berhasil' : 'Diproses',
        }));
        setAktivitas(formatted);

        setIsBalanceLoading(false);
      } catch (err) {
        console.error("Error fetching user data:", err);
        setError(err.message || "Gagal memuat data");
        setIsBalanceLoading(false);
      } finally {
        setIsDataLoading(false);
      }
    };

    fetchAllData();
    
    const handleStorage = (event) => {
      if (event.key === 'holdBalanceUpdatedAt') {
        dashboardAPI.getUserBalance(userId)
          .then(res => setBalanceData({
            saldo: res.data.saldo || 0,
            saldo_hold: res.data.saldo_hold || 0,
            available_balance: res.data.available_balance || 0,
          }))
          .catch(err => console.error("Balance update failed:", err));
      }
    };

    window.addEventListener('storage', handleStorage);
    
    // Refresh balance every 15 seconds
    const interval = setInterval(() => {
      dashboardAPI.getUserBalance(userId)
        .then(res => setBalanceData({
          saldo: res.data.saldo || 0,
          saldo_hold: res.data.saldo_hold || 0,
          available_balance: res.data.available_balance || 0,
        }))
        .catch(err => console.error("Balance update failed:", err));
    }, 15000);

    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, [userId]);

  return (
    <div className="dashboard-layout">
      {/* Inject responsive overrides once */}
      <style>{RESPONSIVE_STYLE}</style>

      <Sidebar />
      <main className="dashboard-main">
        {/* TOPBAR */}
        <header className="topbar">
          <div></div>
          <div className="topbar-right">
            <TopbarUserProfile />
          </div>
        </header>

        {/* CONTENT */}
        <div className="dashboard-content">
          {/* HERO */}
          <section className="hero-banner">
            <div className="hero-banner-text">
              <p className="hero-greeting">
                Selamat Datang, 👋
              </p>
              <h1 className="hero-heading">
                Jaga lingkungan mulai dari
                langkah kecil!
              </h1>
              <p className="hero-sub">
                Kelola sampah dengan mudah,
                pantau saldo poin, dan jadwalkan
                penjemputan kapan saja.
              </p>
            </div>
            <div className="hero-banner-img">
              <img
                src={HeroBg}
                alt="hero"
              />
            </div>
          </section>

          {/* SALDO CARD */}
          <div
            className="saldo-card"
            onClick={() => history.push("/user/saldo")}
          >
            <div className="saldo-card-top">
              <div className="saldo-icon-wrap">
                💳
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p className="saldo-label">
                  Saldo Poin Kamu
                </p>
                <h2 className="saldo-amount">
                  {isBalanceLoading ? "Memuat..." : `Rp ${Number(balanceData.saldo).toLocaleString('id-ID')}`}
                </h2>
                {!isBalanceLoading && (
                  <p className="saldo-subtext" style={{ marginTop: 8, fontSize: '0.95rem' }}>
                    <span>Saldo tersedia: Rp {Number(balanceData.available_balance).toLocaleString('id-ID')}</span>
                    <span>•</span>
                    <span>Saldo tertahan: Rp {Number(balanceData.saldo_hold).toLocaleString('id-ID')}</span>
                  </p>
                )}
              </div>
            </div>
            <div className="saldo-card-bottom">
              <span>Lihat Detail</span>
              <span>→</span>
            </div>
          </div>

          {/* GRID */}
          <div className="info-grid">
            {/* HARGA */}
            <section className="info-card">
              <div className="info-card-header">
                <h3>Harga Sampah per Kg</h3>
                <button
                  className="link-btn"
                  onClick={() => history.push("/user/harga")}
                >
                  Lihat Semua
                </button>
              </div>
              <div className="harga-list">
                {hargaSampah.map((item) => (
                  <div
                    key={item.id}
                    className="harga-row"
                  >
                    <div className="harga-left">
                      <div className="harga-icon">
                        🗂️
                      </div>
                      <span className="harga-nama">
                        {item.sub_jenis}
                      </span>
                    </div>
                    <span className="harga-price">
                      Rp {item.harga}
                      <span className="per-kg">
                        /kg
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* AKTIVITAS */}
            <section className="info-card">
              <div className="info-card-header">
                <h3>Aktivitas Terbaru</h3>
                <button
                  className="link-btn"
                  onClick={() => history.push("/user/history")}
                >
                  Lihat Semua
                </button>
              </div>
              <div className="aktivitas-list">
                {aktivitas.map((item, i) => (
                  <div
                    key={i}
                    className="aktivitas-row"
                  >
                    <div
                      className="aktivitas-icon"
                      style={{
                        background: item.iconBg,
                      }}
                    >
                      {item.icon}
                    </div>
                    <div className="aktivitas-info">
                      <p className="aktivitas-judul">
                        {item.judul}
                      </p>
                      <p className="aktivitas-waktu">
                        {item.waktu}
                      </p>
                    </div>
                    <span className="status-badge">
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="info-card" style={{ marginBottom: '1.5rem' }}>
            <div className="info-card-header" style={{ justifyContent: 'space-between' }}>
              <h3>Marketplace</h3>
              <button
                className="link-btn"
                onClick={() => history.push("/user/marketplace")}
              >
                Belanja Sekarang
              </button>
            </div>
            <div style={{ padding: '1rem 1rem 1.25rem' }}>
              <p style={{ margin: 0, fontSize: 'clamp(0.8rem, 2.5vw, 0.95rem)', lineHeight: 1.6 }}>
                Beli produk seperti beras, minyak, dan telur langsung dari marketplace
                menggunakan saldo tersedia Anda.
              </p>
            </div>
          </section>

          {/* CTA */}
          <section className="cta-section">
            <div className="cta-left">
              <div className="cta-icon">
                ♻️
              </div>
              <div>
                <h3>
                  Jadwalkan Jemput Sampah Sekarang!
                </h3>
                <p>
                  Pilih jenis sampah dan tentukan
                  jadwal penjemputan dengan mudah.
                </p>
              </div>
            </div>
            <button
              className="cta-btn"
              onClick={() => history.push("/user/pickup")}
            >
              Request Jemput Sampah →
            </button>
          </section>
        </div>
      </main>
    </div>
  );
}

export default UserDashboard;