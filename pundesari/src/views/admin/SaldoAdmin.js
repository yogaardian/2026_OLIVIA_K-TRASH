
import React, { useState, useEffect, useRef } from "react";
import { transactionsAPI } from "../../services/api";
import { Button, Card, Form, Container, Row, Col, Table, Alert, Spinner } from "react-bootstrap";

function Saldo() {
  const adminId = Number(localStorage.getItem("userId") || 0);
  const [holdAmount, setHoldAmount] = useState(50000);
  const [holdInput, setHoldInput] = useState(50000);
  const [pendingTransactions, setPendingTransactions] = useState([]);
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [summary, setSummary] = useState({ total_hold: 0, total_balance: 0 });
  const [topupUserId, setTopupUserId] = useState("");
  const [topupAmount, setTopupAmount] = useState("");
  const [topupDescription, setTopupDescription] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const hasFetchedAdminDataRef = useRef(false);

  useEffect(() => {
    if (!hasFetchedAdminDataRef.current) {
      hasFetchedAdminDataRef.current = true;
      fetchAdminData();
    }
  }, []);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      // Fetch hold balance setting
      try {
        const holdRes = await transactionsAPI.getMinimumHoldBalance();
        const hold = Number(holdRes.data.amount || 50000);
        setHoldAmount(hold);
        setHoldInput(hold);
      } catch (err) {
        console.error('Error fetching hold balance:', err);
      }

      // Fetch pending transactions
      try {
        const pendingRes = await transactionsAPI.getPendingTransactions();
        setPendingTransactions(pendingRes.data || []);
      } catch (err) {
        console.error('Error fetching pending transactions:', err);
      }

      // Fetch transaction history
      try {
        const historyRes = await transactionsAPI.getAllTransactions();
        setTransactionHistory(historyRes.data || []);
      } catch (err) {
        console.error('Error fetching transaction history:', err);
      }

      // Fetch hold summary
      try {
        const summaryRes = await transactionsAPI.getHoldSummary();
        setSummary(summaryRes.data || { total_hold: 0, total_balance: 0 });
      } catch (err) {
        console.error('Error fetching hold summary:', err);
      }
    } catch (error) {
      console.error('Gagal memuat data admin:', error);
      setFeedback({ type: 'danger', message: 'Gagal memuat beberapa data admin.' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateHold = async () => {
    try {
      const amount = Number(holdInput);
      if (!amount || amount <= 0) {
        setFeedback({ type: 'warning', message: 'Masukkan nilai hold balance yang valid.' });
        return;
      }
      await transactionsAPI.setMinimumHoldBalance(amount);
      setHoldAmount(amount);
      setFeedback({ type: 'success', message: 'Minimum hold balance berhasil diperbarui.' });
      await fetchAdminData();
    } catch (error) {
      console.error('Gagal memperbarui hold balance:', error);
      setFeedback({ type: 'danger', message: 'Gagal memperbarui hold balance.' });
    }
  };

  const handleTopup = async () => {
    try {
      const userId = Number(topupUserId);
      const amount = Number(topupAmount);
      if (!userId || !amount || amount <= 0) {
        setFeedback({ type: 'warning', message: 'Isi user ID dan amount dengan benar.' });
        return;
      }

      await transactionsAPI.topupUser({
        user_id: userId,
        amount,
        description: topupDescription || 'Top up saldo manual',
        admin_id: adminId || null,
      });

      setFeedback({ type: 'success', message: 'Top up berhasil terkirim.' });
      setTopupUserId('');
      setTopupAmount('');
      setTopupDescription('');
      await fetchAdminData();
    } catch (error) {
      console.error('Gagal topup:', error);
      setFeedback({ type: 'danger', message: error.response?.data?.message || 'Gagal melakukan top up.' });
    }
  };

  const handleApprove = async (transactionId) => {
    if (!transactionId || Number(transactionId) <= 0) {
      setFeedback({ type: 'danger', message: 'ID transaksi tidak valid untuk approve.' });
      return;
    }

    try {
      await transactionsAPI.approveTransaction(transactionId, adminId || null);
      setFeedback({ type: 'success', message: 'Transaksi berhasil disetujui.' });
      await fetchAdminData();
    } catch (error) {
      console.error('Error approve:', error);
      setFeedback({ type: 'danger', message: error.response?.data?.message || 'Gagal menyetujui transaksi.' });
    }
  };

  const handleReject = async (transactionId) => {
    if (!transactionId || Number(transactionId) <= 0) {
      setFeedback({ type: 'danger', message: 'ID transaksi tidak valid untuk reject.' });
      return;
    }

    try {
      await transactionsAPI.rejectTransaction(transactionId, adminId || null);
      setFeedback({ type: 'success', message: 'Transaksi berhasil ditolak.' });
      await fetchAdminData();
    } catch (error) {
      console.error('Error reject:', error);
      setFeedback({ type: 'danger', message: error.response?.data?.message || 'Gagal menolak transaksi.' });
    }
  };

  return (
    <Container fluid>
      <Row className="mb-4">
        <Col md={12}>
          <Card>
            <Card.Body>
              <h2>Pengaturan Saldo & Verifikasi</h2>
              <p>Admin dapat mengatur minimum hold, approve transaksi sampah, top up manual, dan melihat histori mutasi saldo.</p>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {feedback && (
        <Row className="mb-3">
          <Col md={12}>
            <Alert variant={feedback.type} onClose={() => setFeedback(null)} dismissible>
              {feedback.message}
            </Alert>
          </Col>
        </Row>
      )}

      <Row className="mb-4">
        <Col md={4}>
          <Card className="mb-3">
            <Card.Body>
              <h5>Minimum Hold Balance</h5>
              <p style={{ marginBottom: 8 }}>Saldo mengendap minimum yang dipakai sistem.</p>
              <h3>Rp {Number(holdAmount).toLocaleString('id-ID')}</h3>
              <Form.Group className="mt-3">
                <Form.Label>Perbarui Minimum Hold</Form.Label>
                <Form.Control
                  type="number"
                  value={holdInput}
                  onChange={(e) => setHoldInput(e.target.value)}
                  min={1000}
                />
              </Form.Group>
              <Button className="mt-3" variant="primary" onClick={handleUpdateHold}>
                Simpan Pengaturan
              </Button>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="mb-3">
            <Card.Body>
              <h5>Ringkasan Hold</h5>
              <p>Total saldo user: Rp {Number(summary.total_balance).toLocaleString('id-ID')}</p>
              <p>Total saldo mengendap: Rp {Number(summary.total_hold).toLocaleString('id-ID')}</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="mb-3">
            <Card.Body>
              <h5>Top Up Manual</h5>
              <Form.Group className="mb-3">
                <Form.Label>User ID</Form.Label>
                <Form.Control
                  type="number"
                  value={topupUserId}
                  onChange={(e) => setTopupUserId(e.target.value)}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Jumlah (Rp)</Form.Label>
                <Form.Control
                  type="number"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Deskripsi</Form.Label>
                <Form.Control
                  type="text"
                  value={topupDescription}
                  onChange={(e) => setTopupDescription(e.target.value)}
                  placeholder="Contoh: Top up offline"
                />
              </Form.Group>
              <Button variant="success" onClick={handleTopup}>
                Top Up Sekarang
              </Button>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="mb-4">
        <Col md={12}>
          <Card>
            <Card.Header style={{ backgroundColor: '#f8f9fa', fontWeight: 'bold' }}>Transaksi Pending</Card.Header>
            <Card.Body style={{ padding: 0 }}>
              {loading ? (
                <div style={{ padding: 20, textAlign: 'center' }}><Spinner animation="border" size="sm" /> Memuat transaksi...</div>
              ) : pendingTransactions.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center' }}>Tidak ada transaksi pending.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <Table striped hover style={{ marginBottom: 0 }}>
                    <thead style={{ backgroundColor: '#f8f9fa' }}>
                      <tr>
                        <th style={{ padding: 15 }}>ID</th>
                        <th style={{ padding: 15 }}>User</th>
                        <th style={{ padding: 15 }}>Order</th>
                        <th style={{ padding: 15 }}>Jumlah</th>
                        <th style={{ padding: 15 }}>Deskripsi</th>
                        <th style={{ padding: 15 }}>Tanggal</th>
                        <th style={{ padding: 15 }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingTransactions.map((tx, idx) => (
                        <tr key={tx.transaction_id ?? tx.id ?? idx}>
                          <td style={{ padding: 15 }}>#{tx.transaction_id ?? tx.id}</td>
                          <td style={{ padding: 15 }}>{tx.user_name}</td>
                          <td style={{ padding: 15 }}>{tx.order_id ? `#${tx.order_id}` : '-'}</td>
                          <td style={{ padding: 15 }}>Rp {Number(tx.amount).toLocaleString('id-ID')}</td>
                          <td style={{ padding: 15 }}>{tx.description || '-'}</td>
                          <td style={{ padding: 15 }}>{new Date(tx.created_at).toLocaleDateString('id-ID')}</td>
                          <td style={{ padding: 15 }}>
                            <Button variant="success" size="sm" className="me-2" onClick={() => handleApprove(tx.transaction_id ?? tx.id)}>
                              Approve
                            </Button>
                            <Button variant="danger" size="sm" onClick={() => handleReject(tx.transaction_id ?? tx.id)}>
                              Reject
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
        </Col>
      </Row>

      <Row>
        <Col md={12}>
          <Card>
            <Card.Header style={{ backgroundColor: '#f8f9fa', fontWeight: 'bold' }}>Riwayat Mutasi Saldo</Card.Header>
            <Card.Body style={{ padding: 0 }}>
              {loading ? (
                <div style={{ padding: 20, textAlign: 'center' }}><Spinner animation="border" size="sm" /> Memuat histori...</div>
              ) : transactionHistory.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center' }}>Belum ada mutasi saldo.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <Table striped hover style={{ marginBottom: 0 }}>
                    <thead style={{ backgroundColor: '#f8f9fa' }}>
                      <tr>
                        <th style={{ padding: 15 }}>ID</th>
                        <th style={{ padding: 15 }}>User</th>
                        <th style={{ padding: 15 }}>Jenis</th>
                        <th style={{ padding: 15 }}>Jumlah</th>
                        <th style={{ padding: 15 }}>Status</th>
                        <th style={{ padding: 15 }}>Tanggal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactionHistory.map((tx, idx) => (
                        <tr key={tx.transaction_id ?? tx.id ?? idx}>
                          <td style={{ padding: 15 }}>#{tx.transaction_id ?? tx.id}</td>
                          <td style={{ padding: 15 }}>{tx.user_name || '-'}</td>
                          <td style={{ padding: 15, textTransform: 'capitalize' }}>{tx.type.replace('_', ' ')}</td>
                          <td style={{ padding: 15 }}>Rp {Number(tx.amount).toLocaleString('id-ID')}</td>
                          <td style={{ padding: 15 }}>{tx.status}</td>
                          <td style={{ padding: 15 }}>{new Date(tx.created_at).toLocaleDateString('id-ID')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default Saldo;

