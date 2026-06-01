import React, { useState, useEffect } from "react";
import { Card, Table, Badge, Button, Modal } from "react-bootstrap";
import Sidebar from "../../components/Sidebar.jsx";
import TopbarUserProfile from "../../components/TopbarUserProfile";
import "../../css/Dashboard.css";
import "../../css/Saldo.css";
import { dashboardAPI } from "../../services/api";

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

  useEffect(() => {
    fetchSaldoData();
  }, [userId]);

  const fetchSaldoData = async () => {
    setLoading(true);
    try {
      const balanceRes = await dashboardAPI.getUserBalance(userId);
      const balancePayload = balanceRes.data?.data || balanceRes.data;
      setBalanceData({
        saldo: balancePayload?.saldo || 0,
        saldo_hold: balancePayload?.saldo_hold || 0,
        available_balance: balancePayload?.available_balance || 0,
      });
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
  };

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
      <Sidebar />
      <main className="dashboard-main">
        <header className="topbar">
          <div></div>
          <div className="topbar-right">
            <TopbarUserProfile />
          </div>
        </header>

        <div className="dashboard-content" style={{ padding: 20 }}>
          <div style={{ marginBottom: 30 }}>
            <h1 style={{ marginBottom: 10 }}>Saldo & Poin</h1>
            <p style={{ color: "#666" }}>Pantau saldo kamu dan lihat riwayat transaksi yang sudah dikirim ke admin.</p>
          </div>

          <Card style={{ marginBottom: 30, borderRadius: 20, border: "none", background: "#fff" }}>
            <Card.Body style={{ padding: 30 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <p style={{ marginBottom: 8, color: "#666" }}>Total Saldo</p>
                  <h2 style={{ margin: 0, fontSize: 36 }}>Rp {Number(balanceData.saldo).toLocaleString('id-ID')}</h2>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ marginBottom: 8, color: '#666' }}>Saldo tersedia</p>
                  <h4 style={{ margin: 0, color: '#1E8449' }}>Rp {Number(balanceData.available_balance).toLocaleString('id-ID')}</h4>
                  <p style={{ margin: '8px 0 0', color: '#999' }}>Saldo tertahan: Rp {Number(balanceData.saldo_hold).toLocaleString('id-ID')}</p>
                </div>
              </div>
            </Card.Body>
          </Card>

          <Card style={{ borderRadius: 16 }}>
            <Card.Header style={{ backgroundColor: '#f8f9fa', fontWeight: 'bold', fontSize: 16 }}>
              Riwayat Transaksi
            </Card.Header>
            <Card.Body style={{ padding: 0 }}>
              {loading ? (
                <div style={{ padding: 20, textAlign: 'center' }}>Memuat data...</div>
              ) : transactions.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center' }}>Belum ada transaksi saldo.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <Table striped hover style={{ marginBottom: 0 }}>
                    <thead style={{ backgroundColor: '#f8f9fa' }}>
                      <tr>
                        <th style={{ padding: 15 }}>Tanggal</th>
                        <th style={{ padding: 15 }}>Order ID</th>
                        <th style={{ padding: 15 }}>Jenis</th>
                        <th style={{ padding: 15 }}>Jumlah</th>
                        <th style={{ padding: 15 }}>Status</th>
                        <th style={{ padding: 15 }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => (
                        <tr key={tx.id}>
                          <td style={{ padding: 15 }}>
                            {new Date(tx.created_at).toLocaleDateString('id-ID', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                          <td style={{ padding: 15 }}>#{tx.order_id || '-'}</td>
                          <td style={{ padding: 15, textTransform: 'capitalize' }}>{tx.type.replace('_', ' ')}</td>
                          <td style={{ padding: 15 }}>Rp {Number(tx.amount).toLocaleString('id-ID')}</td>
                          <td style={{ padding: 15 }}>{getStatusBadge(tx.status)}</td>
                          <td style={{ padding: 15 }}>
                            <Button size="sm" variant="outline-primary" onClick={() => handleViewDetail(tx)}>
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

      <Modal show={showDetailModal} onHide={() => setShowDetailModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Detail Transaksi</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: 500, overflowY: 'auto' }}>
          {selectedTx && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <p style={{ margin: 0, color: '#666' }}>Jenis Transaksi</p>
                <h5 style={{ marginBottom: 8, textTransform: 'capitalize' }}>{selectedTx.type.replace('_', ' ')}</h5>
                <p style={{ margin: 0, color: '#666' }}>Order ID</p>
                <p style={{ marginBottom: 8, fontWeight: 'bold' }}>#{selectedTx.order_id || '-'}</p>
                <p style={{ margin: 0, color: '#666' }}>Deskripsi</p>
                <p style={{ marginBottom: 8 }}>{selectedTx.description || '-'}</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ backgroundColor: '#f8f9fa', padding: 16, borderRadius: 12 }}>
                  <p style={{ marginBottom: 8, color: '#666' }}>Jumlah</p>
                  <h5 style={{ margin: 0 }}>Rp {Number(selectedTx.amount).toLocaleString('id-ID')}</h5>
                </div>
                <div style={{ backgroundColor: '#f8f9fa', padding: 16, borderRadius: 12 }}>
                  <p style={{ marginBottom: 8, color: '#666' }}>Status</p>
                  {getStatusBadge(selectedTx.status)}
                </div>
              </div>
              {selectedTx.order_status && (
                <div style={{ marginTop: 20 }}>
                  <p style={{ margin: 0, color: '#666' }}>Status Order</p>
                  <p style={{ margin: 0, fontWeight: 'bold', textTransform: 'capitalize' }}>{selectedTx.order_status}</p>
                </div>
              )}
              {selectedTx.address && (
                <div style={{ marginTop: 20 }}>
                  <p style={{ margin: 0, color: '#666' }}>Alamat</p>
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
