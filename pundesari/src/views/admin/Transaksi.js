import React, { useState, useEffect } from "react";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { transactionsAPI } from "../../services/api";

// react-bootstrap components
import { Button, Card, Container, Row, Col, Form, InputGroup, Table, Modal } from "react-bootstrap";

function Icons() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showDetail, setShowDetail] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const fetchTransactions = async (params = {}) => {
    setLoading(true);
    try {
      const response = await transactionsAPI.getTransactions(params);
      setTransactions(response.data);
      setCurrentPage(1);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const buildFilterParams = () => {
    const params = {};
    if (filterType !== 'all') {
      params.range = filterType;
    }
    if (filterType === 'custom') {
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
    }
    return params;
  };

  const handleFilter = () => {
    fetchTransactions(buildFilterParams());
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Laporan Transaksi', 14, 20);

    const headers = [[
      'Tanggal',
      'Kode User',
      'Nama',
      'Tipe',
      'Jumlah',
      'Status',
      'Deskripsi'
    ]];

    const rows = transactions.map(tx => [
      tx.created_at ? new Date(tx.created_at).toLocaleString() : '-',
      tx.user_id || '-',
      tx.user_name || '-',
      tx.type || '-',
      tx.amount != null ? `Rp ${Number(tx.amount).toLocaleString()}` : '-',
      tx.status || '-',
      tx.description || tx.order_status || '-',
    ]);

    doc.autoTable({
      head: headers,
      body: rows,
      startY: 26,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [33, 150, 243] },
    });

    const dateSuffix = new Date().toISOString().slice(0, 10);
    doc.save(`laporan-transaksi-${dateSuffix}.pdf`);
  };

  return (
    <>
      <Container fluid>
        <Row>
          <Col md="12">
            <Card>
              <Card.Header>
                <Card.Title as="h4">Transaksi</Card.Title>
              </Card.Header>
              <Card.Body>
                <Row className="align-items-center mb-3">
                  <Col md="3" className="mb-2 mb-md-0">
                    <InputGroup>
                      <Form.Control
                        as="select"
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                      >
                        <option value="all">Semua</option>
                        <option value="day">Hari Ini</option>
                        <option value="week">Minggu Ini</option>
                        <option value="month">Bulan Ini</option>
                        <option value="year">Tahun Ini</option>
                        <option value="custom">Rentang Custom</option>
                      </Form.Control>
                    </InputGroup>
                  </Col>

                  {filterType === 'custom' && (
                    <>
                      <Col md="3" className="mb-2 mb-md-0">
                        <InputGroup>
                          <Form.Control
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                          />
                        </InputGroup>
                      </Col>
                      <Col md="3" className="mb-2 mb-md-0">
                        <InputGroup>
                          <Form.Control
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                          />
                        </InputGroup>
                      </Col>
                    </>
                  )}

                  <Col md="3" className="text-md-right">
                    <Button variant="outline-secondary" className="mr-2" onClick={handleFilter}>
                      Filter
                    </Button>
                    <Button variant="success" onClick={exportPdf}>
                      Export PDF
                    </Button>
                  </Col>
                </Row>

                <div className="table-responsive">
                  <Table className="table-hover table-striped">
                    <thead>
                      <tr>
                        <th className="border-0">Tanggal</th>
                        <th className="border-0">Kode User</th>
                        <th className="border-0">Nama</th>
                        <th className="border-0">Total Sampah</th>
                        <th className="border-0">Total Harga</th>
                        <th className="border-0">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan="6" className="text-center">Memuat data...</td></tr>
                      ) : transactions.length === 0 ? (
                        <tr><td colSpan="6" className="text-center">Data Kosong</td></tr>
                      ) : (
                        (() => {
                          const total = transactions.length;
                          const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));
                          const startIndex = (currentPage - 1) * itemsPerPage;
                          const pageItems = transactions.slice(startIndex, startIndex + itemsPerPage);
                          return pageItems.map((tx, index) => (
                            <tr key={tx.id}>
                              <td>{tx.created_at ? new Date(tx.created_at).toLocaleDateString() : '-'}</td>
                              <td>{tx.user_id}</td>
                              <td>{tx.user_name}</td>
                              <td>{tx.type || '-'}</td>
                              <td>Rp {tx.amount ? Number(tx.amount).toLocaleString() : '0'}</td>
                              <td>
                                <Button variant="success" size="sm" className="mr-2" onClick={() => {
                                  setSelectedTx(tx);
                                  setShowDetail(true);
                                }}>
                                  Detail
                                </Button>
                                <Button variant="danger" size="sm">
                                  Hapus
                                </Button>
                              </td>
                            </tr>
                          ));
                        })()
                      )}
                    </tbody>
                  </Table>
                </div>

                {/* Detail Modal */}
                <Modal show={showDetail} onHide={() => setShowDetail(false)} size="lg">
                  <Modal.Header closeButton>
                    <Modal.Title>Detail Transaksi</Modal.Title>
                  </Modal.Header>
                  <Modal.Body>
                    {selectedTx ? (
                      <div>
                        <Row>
                          <Col md={6}>
                            <p><strong>Tanggal:</strong> {selectedTx.created_at ? new Date(selectedTx.created_at).toLocaleString() : '-'}</p>
                            <p><strong>Kode User:</strong> {selectedTx.user_id || '-'}</p>
                            <p><strong>Nama:</strong> {selectedTx.user_name || '-'}</p>
                            <p><strong>Tipe:</strong> {selectedTx.type || '-'}</p>
                          </Col>
                          <Col md={6}>
                            <p><strong>Jumlah:</strong> {selectedTx.amount != null ? `Rp ${Number(selectedTx.amount).toLocaleString()}` : '-'}</p>
                            <p><strong>Status:</strong> {selectedTx.status || '-'}</p>
                            <p><strong>Deskripsi:</strong> {selectedTx.description || selectedTx.order_status || '-'}</p>
                          </Col>
                        </Row>
                        <hr />
                      </div>
                    ) : (
                      <p>Tidak ada data.</p>
                    )}
                  </Modal.Body>
                  <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowDetail(false)}>Tutup</Button>
                  </Modal.Footer>
                </Modal>

                <Row className="align-items-center mt-3">
                  <Col>
                    <nav>
                      <ul className="pagination mb-0">
                        {(() => {
                          const total = transactions.length;
                          const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));
                          const pages = [];
                          pages.push(
                            <li key="prev" className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                              <button className="page-link" onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>&lt;</button>
                            </li>
                          );
                          for (let p = 1; p <= totalPages; p++) {
                            pages.push(
                              <li key={p} className={`page-item ${p === currentPage ? 'active' : ''}`}>
                                <button className="page-link" onClick={() => setCurrentPage(p)}>{p}</button>
                              </li>
                            );
                          }
                          pages.push(
                            <li key="next" className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                              <button className="page-link" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>&gt;</button>
                            </li>
                          );
                          return pages;
                        })()}
                      </ul>
                    </nav>
                  </Col>
                  <Col className="text-right">
                    {(() => {
                      const total = transactions.length;
                      const startIndex = total === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
                      const endIndex = Math.min(total, currentPage * itemsPerPage);
                      return (
                        <p className="mb-0">Menampilkan {startIndex}-{endIndex} dari {total} transaksi</p>
                      );
                    })()}
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </>
  );
}

export default Icons;
