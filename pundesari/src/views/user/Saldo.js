import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card, Table, Badge, Button, Modal } from "react-bootstrap";
import Sidebar from "../../components/Sidebar.jsx";
import TopbarUserProfile from "../../components/TopbarUserProfile";
import "../../css/Dashboard.css";
import "../../css/Saldo.css";
import { dashboardAPI } from "../../services/api";

/* ─────────────────────────────────────────────
   Inline responsive styles — tidak mengubah
   Saldo.css / Dashboard.css yang sudah ada
───────────────────────────────────────────── */
const RESPONSIVE_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

  /* ── CSS Variables ── */
  .dashboard-layout {
    --sl-grad: linear-gradient(135deg, rgb(102,178,130) 0%, rgb(21,128,61) 60%, rgb(20,83,45) 100%);
    --sl-grad-soft: linear-gradient(135deg, rgba(102,178,130,0.12) 0%, rgba(21,128,61,0.12) 100%);
    --sl-green-mid: rgb(21,128,61);
    --sl-green-dark: rgb(20,83,45);
    --sl-accent-light: #dcfce7;
    --sl-accent-xlight: #f0fdf4;
    --sl-bg: #f5f7f5;
    --sl-border: #d1fae5;
    --sl-border-strong: rgba(21,128,61,0.2);
    --sl-text: #0f172a;
    --sl-muted: #374151;
    --sl-subtle: #6b7280;
    --sl-shadow: 0 8px 32px rgba(20,83,45,0.18);
    --sl-shadow-sm: 0 2px 12px rgba(20,83,45,0.1);
  }

  .dashboard-main {
    font-family: 'Plus Jakarta Sans', sans-serif;
  }

  /* ── Page background ── */
  .dashboard-main {
    background: var(--sl-bg) !important;
  }

  /* ── Page heading ── */
  .saldo-page-title {
    font-size: clamp(1.3rem, 5vw, 1.75rem) !important;
    font-weight: 800 !important;
    color: var(--sl-text) !important;
    margin-bottom: 8px !important;
  }

  .saldo-page-sub {
    font-size: clamp(0.82rem, 2.5vw, 0.95rem);
    color: var(--sl-muted) !important;
  }

  /* ── Balance Card ── */
  .saldo-balance-card {
    border: none !important;
    border-radius: 24px !important;
    background: var(--sl-grad) !important;
    box-shadow: var(--sl-shadow) !important;
    overflow: hidden;
    position: relative;
  }

  /* Decorative circles on balance card */
  .saldo-balance-card::after {
    content: '';
    position: absolute;
    width: 280px; height: 280px;
    border-radius: 50%;
    background: rgba(255,255,255,0.06);
    top: -90px; right: -70px;
    pointer-events: none;
  }

  .saldo-balance-card::before {
    content: '';
    position: absolute;
    width: 160px; height: 160px;
    border-radius: 50%;
    background: rgba(255,255,255,0.04);
    bottom: -50px; left: 30px;
    pointer-events: none;
  }

  .saldo-balance-card .card-body {
    padding: 1.5rem !important;
    position: relative; z-index: 1;
  }

  .saldo-balance-inner {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  /* Total saldo label & amount */
  .saldo-balance-inner > div:first-child > p {
    color: rgba(255,255,255,0.75) !important;
    font-size: 0.82rem !important;
    font-weight: 600 !important;
    letter-spacing: 0.05em !important;
    text-transform: uppercase !important;
    margin-bottom: 6px !important;
  }

  .saldo-total-amount {
    font-size: clamp(1.75rem, 6vw, 2.5rem) !important;
    font-weight: 800 !important;
    color: #ffffff !important;
    margin: 0 !important;
    word-break: break-word;
    text-shadow: 0 2px 10px rgba(0,0,0,0.1);
  }

  /* Right block: saldo tersedia */
  .saldo-right-block {
    text-align: left;
  }

  .saldo-right-block > p:first-child {
    color: rgba(255,255,255,0.75) !important;
    font-size: 0.82rem !important;
    font-weight: 600 !important;
    letter-spacing: 0.05em !important;
    text-transform: uppercase !important;
    margin-bottom: 6px !important;
  }

  .saldo-available-amount {
    font-size: clamp(1.1rem, 4vw, 1.5rem) !important;
    font-weight: 800 !important;
    color: #ffffff !important;
    margin: 0 !important;
  }

  .saldo-hold-text {
    font-size: clamp(0.75rem, 2.5vw, 0.85rem);
    margin: 8px 0 0 !important;
    color: rgba(255,255,255,0.65) !important;
  }

  /* Divider between left & right on mobile */
  .saldo-balance-divider {
    height: 1px;
    background: rgba(255,255,255,0.2);
    border: none;
    margin: 0;
  }

  /* ── Transaction Card ── */
  .saldo-tx-card {
    border-radius: 20px !important;
    border: 1px solid var(--sl-border) !important;
    overflow: hidden;
    box-shadow: var(--sl-shadow-sm) !important;
  }

  .saldo-tx-card .card-header {
    background: var(--sl-accent-light) !important;
    border-bottom: 1px solid var(--sl-border-strong) !important;
    font-weight: 700 !important;
    font-size: clamp(0.9rem, 2.5vw, 1rem) !important;
    color: var(--sl-text) !important;
    padding: 1rem 1.25rem !important;
  }

  /* ── Responsive table wrapper ── */
  .saldo-table-scroll {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .saldo-table-scroll table {
    min-width: 560px;
  }

  .saldo-table-scroll thead {
    background: var(--sl-accent-light) !important;
  }

  .saldo-table-scroll thead th {
    color: var(--sl-text) !important;
    font-weight: 700 !important;
    border-bottom: 1px solid var(--sl-border-strong) !important;
  }

  .saldo-table-scroll th,
  .saldo-table-scroll td {
    padding: 12px 10px !important;
    font-size: clamp(0.78rem, 2vw, 0.9rem);
    white-space: nowrap;
    vertical-align: middle !important;
  }

  /* Detail button — forest green gradient */
  .saldo-detail-btn {
    min-height: 36px !important;
    min-width: 64px !important;
    font-size: 0.8rem !important;
    font-weight: 700 !important;
    border: none !important;
    background: var(--sl-grad) !important;
    color: #fff !important;
    border-radius: 10px !important;
    padding: 0.4rem 0.85rem !important;
    transition: all 0.18s !important;
    box-shadow: 0 2px 8px rgba(20,83,45,0.22) !important;
  }
  .saldo-detail-btn:hover {
    transform: translateY(-1px) !important;
    box-shadow: 0 4px 14px rgba(20,83,45,0.32) !important;
    background: var(--sl-grad) !important;
    color: #fff !important;
  }
  .saldo-detail-btn:focus {
    box-shadow: 0 0 0 3px rgba(102,178,130,0.35) !important;
  }

  /* Empty / loading state */
  .saldo-state-msg {
    padding: 2rem;
    text-align: center;
    color: var(--sl-muted);
    font-size: 0.92rem;
  }

  /* ── Modal ── */
  .saldo-modal-body {
    max-height: 70vh !important;
    overflow-y: auto;
  }

  /* Modal top accent bar */
  .modal-content {
    border-radius: 20px !important;
    overflow: hidden;
    border: 1px solid var(--sl-border-strong) !important;
  }

  .modal-content::before {
    content: '';
    display: block;
    height: 4px;
    background: var(--sl-grad);
  }

  .modal-header {
    border-bottom: 1px solid var(--sl-border) !important;
    padding: 1rem 1.25rem !important;
  }

  .modal-title {
    font-weight: 800 !important;
    color: var(--sl-text) !important;
  }

  .saldo-modal-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  /* Modal info boxes */
  .saldo-modal-info-box {
    background: var(--sl-accent-light) !important;
    border: 1px solid var(--sl-border-strong) !important;
    padding: 14px !important;
    border-radius: 14px !important;
  }

  .saldo-modal-info-box p {
    color: var(--sl-muted) !important;
    font-size: 0.78rem !important;
    font-weight: 600 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.04em !important;
  }

  /* ── Animations ── */
  @keyframes saldo-fadein {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .saldo-animate {
    animation: saldo-fadein 0.35s ease both;
  }

  .saldo-animate-delay-1 { animation-delay: 0.06s; }
  .saldo-animate-delay-2 { animation-delay: 0.14s; }

  /* ════════════════════════
     TABLET 480px+
  ════════════════════════ */
  @media (min-width: 480px) {
    .saldo-balance-inner {
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
    }

    .saldo-right-block {
      text-align: right;
    }

    .saldo-balance-divider { display: none; }

    .saldo-balance-card .card-body {
      padding: 1.75rem !important;
    }
  }

  /* ════════════════════════
     TABLET 768px+
  ════════════════════════ */
  @media (min-width: 768px) {
    .saldo-balance-card .card-body {
      padding: 2rem !important;
    }

    .saldo-table-scroll th,
    .saldo-table-scroll td {
      padding: 14px 15px !important;
    }
  }

  /* ════════════════════════
     DESKTOP 1024px+
  ════════════════════════ */
  @media (min-width: 1024px) {
    .saldo-balance-card .card-body {
      padding: 2rem 2.5rem !important;
    }
  }

  /* ════════════════════════
     SMALL MOBILE ≤479px
  ════════════════════════ */
  @media (max-width: 479px) {
    .saldo-modal-grid {
      grid-template-columns: 1fr;
    }

    .dashboard-content {
      padding: 14px !important;
    }

    .saldo-balance-card .card-body {
      padding: 1.25rem !important;
    }
  }
`;

const STATUS_BADGE = {
  approved: { text: "Disetujui", variant: "success" },
  pending: { text: "Menunggu Verifikasi", variant: "warning" },
  rejected: { text: "Ditolak", variant: "danger" },
};

const Saldo = () => {
  const userId = Number(localStorage.getItem("userId") || 1);
  const username = localStorage.getItem("nama") || "User";

  const [balanceData, setBalanceData] = useState({
    saldo: 0,
    saldo_hold: 0,
    available_balance: 0,
  });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const fetchSaldoData = useCallback(async () => {
    setLoading(true);
    try {
      const balanceRes = await dashboardAPI.getUserBalance(userId);
      const balancePayload = balanceRes.data?.data || balanceRes.data;
      setBalanceData({
        saldo: balancePayload?.saldo || 0,
        saldo_hold: balancePayload?.saldo_hold || 0,
        available_balance: balancePayload?.available_balance || 0,
      });
      setLastRefreshed(new Date());
    } catch (err) {
      console.error("Error fetching saldo data:", err);
    }

    try {
      const txRes = await dashboardAPI.getUserTransactions(userId);
      setTransactions(txRes.data || []);
    } catch (err) {
      console.error("Error fetching saldo transactions:", err);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchSaldoData();
  }, [userId, fetchSaldoData]);

  useEffect(() => {
    const handleFocus = () => {
      fetchSaldoData();
    };
    const handleStorage = (event) => {
      if (event.key === 'holdBalanceUpdatedAt') {
        fetchSaldoData();
      }
    };
    window.addEventListener("focus", handleFocus);
    window.addEventListener("storage", handleStorage);
    const intervalId = setInterval(fetchSaldoData, 15000);
    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("storage", handleStorage);
      clearInterval(intervalId);
    };
  }, [fetchSaldoData]);

  const getStatusBadge = (status) => {
    const badge = STATUS_BADGE[status] || { text: status, variant: "secondary" };
    return (
      <Badge bg={badge.variant} style={{ textTransform: "capitalize" }}>
        {badge.text}
      </Badge>
    );
  };

  const handleViewDetail = (tx) => {
    setSelectedTx(tx);
    setShowDetailModal(true);
  };

  return (
    <div className="dashboard-layout">
      <style>{RESPONSIVE_STYLE}</style>

      <Sidebar />
      <main className="dashboard-main">
        <header className="topbar">
          <div></div>
          <div className="topbar-right">
            <TopbarUserProfile />
          </div>
        </header>

        <div className="dashboard-content" style={{ padding: 20 }}>

          {/* Page Heading */}
          <div className="saldo-animate" style={{ marginBottom: 24 }}>
            <h1 className="saldo-page-title">Saldo &amp; Poin</h1>
            <p className="saldo-page-sub">
              Pantau saldo kamu dan lihat riwayat transaksi yang sudah dikirim ke admin.
            </p>
          </div>

          {/* Balance Card */}
          <Card
            className="saldo-balance-card saldo-animate saldo-animate-delay-1"
            style={{ marginBottom: 24 }}
          >
            <Card.Body>
              <div className="saldo-balance-inner">
                <div>
                  <p style={{ marginBottom: 6, fontSize: "0.9rem" }}>Total Saldo</p>
                  <h2 className="saldo-total-amount">
                    Rp {Number(balanceData.saldo).toLocaleString('id-ID')}
                  </h2>
                </div>
                <hr className="saldo-balance-divider" />
                <div className="saldo-right-block">
                  <p style={{ marginBottom: 6, fontSize: "0.9rem" }}>Saldo tersedia</p>
                  <h4 className="saldo-available-amount">
                    Rp {Number(balanceData.available_balance).toLocaleString('id-ID')}
                  </h4>
                  <p className="saldo-hold-text">
                    Saldo tertahan: Rp {Number(balanceData.saldo_hold).toLocaleString('id-ID')}
                  </p>
                  <div style={{ color: '#ffffff', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <Button variant="outline-secondary" size="sm" onClick={fetchSaldoData}>
                      Segarkan saldo
                    </Button>
                    {lastRefreshed && (
                      <small style={{ color: '#ffffff' }}>
                        Terakhir diperbarui: {lastRefreshed.toLocaleTimeString('id-ID')}
                      </small>
                    )}
                  </div>
                </div>
              </div>
            </Card.Body>
          </Card>

          {/* Transaction Table */}
          <Card
            className="saldo-tx-card saldo-animate saldo-animate-delay-2"
          >
            <Card.Header>
              Riwayat Transaksi
            </Card.Header>
            <Card.Body style={{ padding: 0 }}>
              {loading ? (
                <div className="saldo-state-msg">Memuat data...</div>
              ) : transactions.length === 0 ? (
                <div className="saldo-state-msg">Belum ada transaksi saldo.</div>
              ) : (
                <div className="saldo-table-scroll">
                  <Table striped hover style={{ marginBottom: 0 }}>
                    <thead style={{ backgroundColor: '#f8f9fa' }}>
                      <tr>
                        <th>Tanggal</th>
                        <th>Order ID</th>
                        <th>Jenis</th>
                        <th>Jumlah</th>
                        <th>Status</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => (
                        <tr key={tx.id}>
                          <td>
                            {new Date(tx.created_at).toLocaleDateString('id-ID', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                          <td>#{tx.order_id || '-'}</td>
                          <td style={{ textTransform: 'capitalize' }}>{tx.type.replace('_', ' ')}</td>
                          <td>Rp {Number(tx.amount).toLocaleString('id-ID')}</td>
                          <td>{getStatusBadge(tx.status)}</td>
                          <td>
                            <Button
                              size="sm"
                              variant="outline-primary"
                              className="saldo-detail-btn"
                              onClick={() => handleViewDetail(tx)}
                            >
                              Detail
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>
        </div>
      </main>

      {/* Detail Modal */}
      <Modal
        show={showDetailModal}
        onHide={() => setShowDetailModal(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title style={{ fontSize: 'clamp(1rem, 4vw, 1.25rem)' }}>
            Detail Transaksi
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="saldo-modal-body">
          {selectedTx && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <p style={{ margin: 0, color: '#666', fontSize: '0.82rem' }}>Jenis Transaksi</p>
                <h5 style={{ marginBottom: 10, textTransform: 'capitalize', fontSize: 'clamp(0.95rem, 3vw, 1.1rem)' }}>
                  {selectedTx.type.replace('_', ' ')}
                </h5>
                <p style={{ margin: 0, color: '#666', fontSize: '0.82rem' }}>Order ID</p>
                <p style={{ marginBottom: 10, fontWeight: 'bold' }}>#{selectedTx.order_id || '-'}</p>
                <p style={{ margin: 0, color: '#666', fontSize: '0.82rem' }}>Deskripsi</p>
                <p style={{ marginBottom: 8 }}>{selectedTx.description || '-'}</p>
              </div>

              <div className="saldo-modal-grid">
                <div className="saldo-modal-info-box">
                  <p style={{ marginBottom: 6 }}>Jumlah</p>
                  <h5 style={{ margin: 0, fontSize: 'clamp(0.95rem, 3vw, 1.1rem)', fontWeight: 800 }}>
                    Rp {Number(selectedTx.amount).toLocaleString('id-ID')}
                  </h5>
                </div>
                <div className="saldo-modal-info-box">
                  <p style={{ marginBottom: 6 }}>Status</p>
                  {getStatusBadge(selectedTx.status)}
                </div>
              </div>

              {selectedTx.order_status && (
                <div style={{ marginTop: 16 }}>
                  <p style={{ margin: 0, color: '#666', fontSize: '0.82rem' }}>Status Order</p>
                  <p style={{ margin: 0, fontWeight: 'bold', textTransform: 'capitalize' }}>
                    {selectedTx.order_status}
                  </p>
                </div>
              )}
              {selectedTx.address && (
                <div style={{ marginTop: 16 }}>
                  <p style={{ margin: 0, color: '#666', fontSize: '0.82rem' }}>Alamat</p>
                  <p style={{ margin: 0 }}>{selectedTx.address}</p>
                </div>
              )}
            </div>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default Saldo;