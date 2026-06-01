import React, { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";
import Sidebar from "../../components/Sidebar.jsx";
import "../../css/Dashboard.css";
import "../../css/sidebar.css";
import { dashboardAPI, hargaAPI } from "../../services/api";

import HeroBg from "../../assets/hero.png";
import TopbarUserProfile from "../../components/TopbarUserProfile";

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

        // Fetch aktivitas user (recent orders)
        const aktivitasRes = await dashboardAPI.getUserOrders(userId);
        const formatted = aktivitasRes.data.slice(0, 4).map(order => ({
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

    return () => clearInterval(interval);
  }, [userId]);

  return (
    <div className="dashboard-layout">
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
              <div>
                <p className="saldo-label">
                  Saldo Poin Kamu
                </p>
                <h2 className="saldo-amount">
                  {isBalanceLoading ? "Memuat..." : `Rp ${Number(balanceData.saldo).toLocaleString('id-ID')}`}
                </h2>
                {!isBalanceLoading && (
                  <p className="saldo-subtext" style={{ marginTop: 8, fontSize: '0.95rem' }}>
                    Saldo tersedia: Rp {Number(balanceData.available_balance).toLocaleString('id-ID')} • Saldo tertahan: Rp {Number(balanceData.saldo_hold).toLocaleString('id-ID')}
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
            <div style={{ padding: '1.5rem' }}>
              <p style={{ margin: 0 }}>
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
