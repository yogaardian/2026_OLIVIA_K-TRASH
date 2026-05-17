import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useHistory } from "react-router-dom";
import { Container, Button, Card, Alert, Modal, Row, Col, Badge } from "react-bootstrap";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { locationAPI } from "../../services/api";

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
  shadowSize: [41, 41],
});

const blueIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const DEFAULT_CENTER = [-7.8, 110.3];
import Sidebar from "../../components/Sidebar.jsx";
import "../../css/Dashboard.css";
import "../../css/sidebar.css";

function ChangeView({ center, zoom }) {
  const map = useMap();
  if (center) {
    map.setView(center, zoom);
  }
  return null;
}

function TrackingPetugas() {
  const history = useHistory();
  const orderId = sessionStorage.getItem("current_order_id");
  const [driverLocation, setDriverLocation] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [userAddress, setUserAddress] = useState("");
  const [driverInfo, setDriverInfo] = useState(null);
  const [orderStatus, setOrderStatus] = useState("assigned");
  const [loading, setLoading] = useState(true);
  const [arrivedNotification, setArrivedNotification] = useState(false);
  const [completedNotification, setCompletedNotification] = useState(false);
  const [completedRedirected, setCompletedRedirected] = useState(false);
  const [showSampahModal, setShowSampahModal] = useState(false);
  const [sampahData, setSampahData] = useState(null);
  const [totalBerat, setTotalBerat] = useState(0);
  const [totalHarga, setTotalHarga] = useState(0);

  const orderStatusRef = useRef(orderStatus);

  const fetchTracking = useCallback(async () => {
    if (!orderId) return;
    try {
      const response = await locationAPI.getTracking(orderId);
      if (response.data.status === "success") {
        // Use driver_lat and driver_lng directly - don't parse locations array
        if (response.data.driver_lat != null && response.data.driver_lng != null) {
          console.log('🚗 DRIVER LOC:', response.data.driver_lat, response.data.driver_lng);
          setDriverLocation([Number(response.data.driver_lat), Number(response.data.driver_lng)]);
        }

        // Set user location
        if (response.data.user_lat != null && response.data.user_lng != null) {
          console.log('👤 USER LOC:', response.data.user_lat, response.data.user_lng);
          setUserLocation([Number(response.data.user_lat), Number(response.data.user_lng)]);
        }

        if (response.data.address) {
          setUserAddress(response.data.address);
        }

        setDriverInfo({
          name: response.data.driver_name || "Petugas",
          id: response.data.driver_id,
          phone: response.data.driver_phone || "-"
        });

        const nextStatus = response.data.order_status || "assigned";
        if (nextStatus === "arrived" && orderStatusRef.current !== "arrived") {
          setArrivedNotification(true);
        }
        orderStatusRef.current = nextStatus;
        setOrderStatus(nextStatus);

        // Extract sampah data jika ada
        if (response.data.sampah_data) {
          setSampahData(response.data.sampah_data);
          setTotalBerat(response.data.total_berat || 0);
          setTotalHarga(response.data.total_harga || 0);
        }
      } else {
        console.error("Tracking response error", response.data);
      }
    } catch (err) {
      console.error("Error fetching tracking:", err);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!orderId) {
      history.push("/user/dashboard");
      return;
    }

    fetchTracking();
    const interval = setInterval(fetchTracking, 3000);

    return () => clearInterval(interval);
  }, [orderId, history, fetchTracking]);

  useEffect(() => {
    if (orderStatus === "completed" && !completedRedirected) {
      setCompletedNotification(true);
      const redirectTimer = setTimeout(() => {
        setCompletedRedirected(true);
        history.push("/user/dashboard");
      }, 2500);

      return () => clearTimeout(redirectTimer);
    }
  }, [orderStatus, completedRedirected, history]);

  const handleRefreshLocation = async () => {
    await fetchTracking();
  };

  const handleCancel = () => {
    history.push("/user/dashboard");
  };

  const center = useMemo(() => driverLocation || userLocation || DEFAULT_CENTER, [driverLocation, userLocation]);
  const routePositions = useMemo(
    () => (driverLocation && userLocation ? [userLocation, driverLocation] : []),
    [driverLocation, userLocation]
  );

  if (loading) {
    return (
      <div className="dashboard-layout">
        <Sidebar />
        <main className="dashboard-main">
          <Container className="text-center py-5">
            <p>Loading tracking...</p>
          </Container>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="dashboard-main">
        <div style={{ backgroundColor: "#FFFFFF", minHeight: "100vh", padding: "20px 0" }}>
          <Container>
            <div className="d-flex align-items-center justify-content-between mb-4">
              <div className="d-flex align-items-center">
                <i 
                  className="nc-icon nc-minimal-left" 
                  style={{ fontSize: "24px", cursor: "pointer", marginRight: "15px" }}
                  onClick={() => history.goBack()}
                ></i>
                <h4 style={{ fontWeight: "bold", color: "#333", margin: "0" }}>Tracking Petugas</h4>
              </div>
            </div>

            {/* Notification */}
            {arrivedNotification && (
              <Alert variant="success" className="mb-3" dismissible onClose={() => setArrivedNotification(false)}>
                <strong>✓ Petugas Sudah Sampai!</strong> Petugas sedang menunggu dan memproses sampahmu.
              </Alert>
            )}
            {completedNotification && (
              <Alert variant="info" className="mb-3" dismissible onClose={() => setCompletedNotification(false)}>
                <strong>✓ Penjemputan Selesai!</strong> Data sudah dikirim, Anda akan segera diarahkan ke Dashboard.
              </Alert>
            )}

            {/* Driver Profile Card */}
            {driverInfo && (
              <Card className="mb-3" style={{ borderRadius: "15px", border: "none", boxShadow: "0 5px 10px rgba(0,0,0,0.05)" }}>
                <Card.Body>
                  <div className="d-flex align-items-center" style={{ gap: "15px" }}>
                    <div style={{
                      width: "60px",
                      height: "60px",
                      borderRadius: "50%",
                      backgroundColor: "#4CAF50",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "bold",
                      fontSize: "24px"
                    }}>
                      {driverInfo.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h6 style={{ fontWeight: "bold", margin: 0 }}>{driverInfo.name}</h6>
                      <small className="text-muted">ID: {driverInfo.id}</small>
                      <div style={{ marginTop: "5px" }}>
                        <small className="text-muted">📞 {driverInfo.phone}</small>
                      </div>
                    </div>
                    <div style={{ marginLeft: "auto" }}>
                      <div style={{
                        width: "12px",
                        height: "12px",
                        borderRadius: "50%",
                        backgroundColor: "#4CAF50",
                        animation: "pulse 1.5s infinite"
                      }}></div>
                      <small style={{ marginTop: "5px", display: "block" }}>Aktif</small>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            )}

            {/* Status */}
            <Card className="mb-3" style={{ borderRadius: "15px", border: "none", boxShadow: "0 5px 10px rgba(0,0,0,0.05)" }}>
              <Card.Body>
                <div style={{ textAlign: "center" }}>
                  <h6 style={{ color: "#666", marginBottom: "10px" }}>Status Order</h6>
                  <h5 style={{ fontWeight: "bold", color: "#4CAF50", textTransform: "capitalize" }}>
                    {orderStatus}
                  </h5>
                </div>
              </Card.Body>
            </Card>

            {/* Debug Panel */}
            <Card className="mb-3" style={{ borderRadius: "15px", border: "2px solid #FFC107", backgroundColor: "#FFFACD", boxShadow: "0 5px 10px rgba(255,193,7,0.2)" }}>
              <Card.Body style={{ padding: "12px" }}>
                <div style={{ fontSize: "12px", fontFamily: "monospace", color: "#333" }}>
                  <div>🚗 DRIVER: {JSON.stringify(driverLocation)}</div>
                  <div>👤 USER: {JSON.stringify(userLocation)}</div>
                  <div>📍 STATUS: {orderStatus}</div>
                </div>
              </Card.Body>
            </Card>

            {/* Map */}
            <Card style={{ borderRadius: "15px", border: "none", boxShadow: "0 5px 10px rgba(0,0,0,0.05)", marginBottom: "20px" }}>
              <Card.Body style={{ padding: 0 }}>
                <div style={{ height: "400px", borderRadius: "12px", overflow: "hidden" }}>
                  <MapContainer 
                    center={center} 
                    zoom={15} 
                    style={{ height: "100%", width: "100%" }}
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <ChangeView center={center} zoom={15} />
                    {userLocation && (
                      <Marker position={userLocation} icon={redIcon}>
                        <Popup>📍 Lokasi Anda - {userAddress || "Alamat user"}</Popup>
                      </Marker>
                    )}
                    {driverLocation && (
                      <Marker position={driverLocation} icon={blueIcon}>
                        <Popup>🚗 Lokasi Petugas Sekarang</Popup>
                      </Marker>
                    )}
                    {driverLocation && userLocation && (
                      <Polyline
                        positions={[userLocation, driverLocation]}
                        pathOptions={{ color: "#4CAF50", weight: 5 }}
                      />
                    )}
                  </MapContainer>
                </div>
              </Card.Body>
            </Card>

            <div className="d-grid gap-2 mb-3">
              <Button variant="outline-primary" onClick={handleRefreshLocation}>
                Muat Ulang Lokasi Petugas
              </Button>
            </div>

            {(orderStatus === "arrived" || orderStatus === "completed") && sampahData && (
              <div className="d-grid gap-2 mb-3">
                <Button 
                  variant="success" 
                  onClick={() => setShowSampahModal(true)}
                  className="py-2"
                >
                  📊 Lihat Rincian Sampah
                </Button>
              </div>
            )}

            {(orderStatus === "approved" || orderStatus === "completed") && (
              <div className="d-grid gap-2 mb-3">
                <Button
                  variant="primary"
                  className="w-100 py-2"
                  onClick={() => history.push("/user/dashboard")}
                >
                  Selesai
                </Button>
              </div>
            )}

            {orderStatus !== "approved" && orderStatus !== "completed" && (
              <Button 
                variant="outline-danger" 
                className="w-100 py-2"
                onClick={handleCancel}
              >
                Batalkan Order
              </Button>
            )}
          </Container>
        </div>
      </main>

      {/* Modal Rincian Sampah */}
      <Modal show={showSampahModal} onHide={() => setShowSampahModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>📊 Rincian Sampah</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {sampahData ? (
            <>
              {Object.keys(sampahData).map(kategori => (
                <div key={kategori} className="mb-4">
                  <h6 style={{ fontWeight: "bold", textTransform: "capitalize", color: "#4CAF50", marginBottom: "12px" }}>
                    {kategori.toUpperCase()}
                  </h6>
                  {Object.keys(sampahData[kategori]).length === 0 ? (
                    <p className="text-muted">Tidak ada sampah</p>
                  ) : (
                    Object.keys(sampahData[kategori]).map(itemId => {
                      const item = sampahData[kategori][itemId];
                      return (
                        <Row key={itemId} className="mb-2 align-items-center" style={{ borderBottom: "1px solid #eee", paddingBottom: "8px" }}>
                          <Col xs={6}>
                            <small className="text-muted">Item #{itemId}</small>
                            <div style={{ fontWeight: "500" }}>
                              {item.berat} kg × Rp {Number(item.harga).toLocaleString()}
                            </div>
                          </Col>
                          <Col xs={6} className="text-right">
                            <div style={{ fontWeight: "bold", color: "#4CAF50" }}>
                              Rp {(item.berat * item.harga).toLocaleString()}
                            </div>
                          </Col>
                        </Row>
                      );
                    })
                  )}
                </div>
              ))}
              
              <div style={{ backgroundColor: "#F5F5F5", padding: "15px", borderRadius: "8px", marginTop: "20px" }}>
                <Row>
                  <Col xs={6}>
                    <div style={{ fontSize: "14px", color: "#666" }}>Total Berat:</div>
                    <div style={{ fontSize: "20px", fontWeight: "bold", color: "#4CAF50" }}>
                      {Number(totalBerat).toFixed(2)} kg
                    </div>
                  </Col>
                  <Col xs={6} className="text-right">
                    <div style={{ fontSize: "14px", color: "#666" }}>Total Harga:</div>
                    <div style={{ fontSize: "20px", fontWeight: "bold", color: "#4CAF50" }}>
                      Rp {Number(totalHarga).toLocaleString()}
                    </div>
                  </Col>
                </Row>
              </div>
              
              {orderStatus === "completed" && (
                <Alert variant="info" className="mt-3">
                  ✓ Data sampah telah dikirim ke admin untuk verifikasi saldo Anda.
                </Alert>
              )}
            </>
          ) : (
            <p className="text-center text-muted">Belum ada data sampah</p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowSampahModal(false)}>
            Tutup
          </Button>
        </Modal.Footer>
      </Modal>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export default TrackingPetugas;