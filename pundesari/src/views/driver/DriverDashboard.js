import React, { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";
import { Container, Card, Row, Col, Button, Badge, Form, Alert, Spinner } from "react-bootstrap";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { dashboardAPI, ordersAPI, locationAPI } from "../../services/api";

// Fix Leaflet's default icon path issues
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

const blueIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function ChangeView({ center, zoom }) {
  const map = useMap();

  useEffect(() => {
    if (map._trackingInitialized) return;
    map._trackingInitialized = true;
    map._userInteracted = false;
    const onMoveStart = () => { map._userInteracted = true; };
    map.on('movestart', onMoveStart);
    return () => map.off('movestart', onMoveStart);
  }, [map]);

  useEffect(() => {
    if (!center || map._userInteracted) return;
    map.setView(center, zoom);
  }, [map, center, zoom]);

  return null;
}

function DriverDashboard() {
  const history = useHistory();
  const nama = localStorage.getItem("nama") || "Driver";
  const driverId = localStorage.getItem("userId") || 1;

  const [isOnline, setIsOnline] = useState(true);
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [driverLocation, setDriverLocation] = useState([-7.8, 110.3]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [error, setError] = useState(null);
  const [acceptingOrder, setAcceptingOrder] = useState(null);

  // Get Driver Location - Watch GPS
  useEffect(() => {
    if (!navigator.geolocation) return;
    
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude);
        const lng = Number(pos.coords.longitude);
        console.log("🚗 GPS UPDATE:", lat, lng);
        setDriverLocation([lat, lng]);
      },
      (err) => console.error("Geolocation error:", err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Send location to backend when activeOrder changes
  useEffect(() => {
    if (!activeOrder || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude);
        const lng = Number(pos.coords.longitude);
        console.log('🚗 SEND LOCATION:', lat, lng, 'Order:', activeOrder.id);
        
        // Send location to backend
        locationAPI.sendDriverLocation({
          driver_id: parseInt(driverId),
          order_id: activeOrder.id,
          lat,
          lng
        }).catch(err => console.error("Location update failed", err));
      },
      (err) => console.error(err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [activeOrder, driverId]);

  // Polling pending orders
  useEffect(() => {
    const fetchOrders = async () => {
      if (!isOnline) return;
      try {
        const res = await dashboardAPI.getPendingOrders();
        setOrders(res.data);
        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching orders:", err);
        setError(err.message);
        setIsLoading(false);
      }
    };

    fetchOrders();
    const interval = setInterval(fetchOrders, 3000);
    return () => clearInterval(interval);
  }, [isOnline]);

  const handleAcceptOrder = async (order) => {
    try {
      setAcceptingOrder(order.id);
      const res = await ordersAPI.acceptOrder(order.id, parseInt(driverId));
      if (res.data.status === "success") {
        setActiveOrder(order);
        setOrders(orders.filter(o => o.id !== order.id));
        alert("✅ Order diterima!");
      } else {
        alert(res.data.message || "❌ Gagal menerima order");
      }
    } catch (err) {
      alert("❌ Error: " + err.message);
      console.error(err);
    } finally {
      setAcceptingOrder(null);
    }
  };

  const handleCompleteOrder = async () => {
    if (!activeOrder) return;
    try {
      const res = await ordersAPI.updateOrderStatus(activeOrder.id, {
        driver_id: parseInt(driverId),
        status: 'completed'
      });
      if (res.data.status === "success") {
        setActiveOrder(null);
        alert("✅ Order Selesai!");
      }
    } catch (err) {
      alert("❌ Error: " + err.message);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    history.push("/login");
  };

  return (
    <div style={{ backgroundColor: "#F7F1F1", minHeight: "100vh", paddingBottom: "70px" }}>
      {/* Header */}
      <div style={{ backgroundColor: "#4CAF50", padding: "20px", borderBottomLeftRadius: "20px", borderBottomRightRadius: "20px" }}>
        <Row className="align-items-center text-white">
          <Col xs="auto">
            <div style={{ width: "50px", height: "50px", backgroundColor: "white", borderRadius: "50%", display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer" }} onClick={handleLogout}>
              <i className="nc-icon nc-single-02 text-success" style={{ fontSize: "24px" }}></i>
            </div>
          </Col>
          <Col>
            <h5 style={{ fontWeight: "bold", margin: 0 }}>{nama}</h5>
            <small>Petugas BankTrash</small>
          </Col>
          <Col xs="auto" className="d-flex align-items-center">
            <span style={{ fontWeight: "bold", marginRight: "10px" }}>{isOnline ? "Online" : "Offline"}</span>
            <Form.Check 
              type="switch" 
              id="custom-switch" 
              checked={isOnline}
              onChange={(e) => setIsOnline(e.target.checked)}
            />
          </Col>
        </Row>
      </div>

      <Container className="py-4">
        {/* Debug Panel */}
        <Card style={{ borderRadius: "16px", border: "2px solid #FFC107", backgroundColor: "#FFFACD", marginBottom: "15px" }}>
          <Card.Body style={{ padding: "12px" }}>
            <div style={{ fontSize: "12px", fontFamily: "monospace", color: "#333" }}>
              <div>🚗 DRIVER: {JSON.stringify(driverLocation)}</div>
              {activeOrder && <div>👤 USER: {JSON.stringify([activeOrder.user_lat, activeOrder.user_lng])}</div>}
              <div>📍 ACTIVE ORDER: {activeOrder ? `Order #${activeOrder.id}` : 'None'}</div>
            </div>
          </Card.Body>
        </Card>

        {/* Map */}
        <div style={{ height: "280px", borderRadius: "16px", overflow: "hidden", border: "2px solid #C8E6C9", marginBottom: "20px" }}>
          <MapContainer center={driverLocation} zoom={14} style={{ height: "100%", width: "100%" }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <ChangeView center={driverLocation} zoom={14} />
            
            {/* Driver Marker */}
            <Marker position={driverLocation} icon={blueIcon}>
              <Popup>Lokasi Anda</Popup>
            </Marker>

            {/* Active Order Marker */}
            {activeOrder && activeOrder.user_lat && activeOrder.user_lng && (
              <>
                <Marker position={[Number(activeOrder.user_lat), Number(activeOrder.user_lng)]} icon={redIcon}>
                  <Popup>👤 Lokasi Jemput: {activeOrder.address}</Popup>
                </Marker>
                <Polyline 
                  positions={[driverLocation, [Number(activeOrder.user_lat), Number(activeOrder.user_lng)]]} 
                  pathOptions={{ color: "#4CAF50", weight: 5 }}
                />
              </>
            )}
          </MapContainer>
        </div>

        {/* Orders Section */}
        {activeOrder ? (
          <div>
            <h5 style={{ fontWeight: "bold", marginBottom: "15px" }}>Active Order</h5>
            <Card style={{ borderRadius: "16px", border: "none", boxShadow: "0 5px 10px rgba(0,0,0,0.05)" }}>
              <Card.Body>
                <Row className="align-items-center mb-3">
                  <Col xs="auto">
                    <div style={{ width: "40px", height: "40px", backgroundColor: "#4CAF50", color: "white", borderRadius: "50%", display: "flex", justifyContent: "center", alignItems: "center", fontWeight: "bold" }}>
                      User
                    </div>
                  </Col>
                  <Col>
                    <h6 style={{ fontWeight: "bold", margin: 0 }}>User {activeOrder.user_id}</h6>
                    <small className="text-muted">{activeOrder.address}</small>
                  </Col>
                </Row>
                
                <div className="d-flex justify-content-between mb-2">
                  <span className="text-muted">Kode Order</span>
                  <span style={{ fontWeight: "bold" }}>{activeOrder.id}</span>
                </div>
                <div className="d-flex justify-content-between mb-2">
                  <span className="text-muted">Jenis Sampah</span>
                  <span style={{ fontWeight: "bold" }}>{activeOrder.jenis_sampah || "Tidak tersedia"}</span>
                </div>
                <div className="d-flex justify-content-between mb-3">
                  <span className="text-muted">Catatan</span>
                  <span style={{ fontWeight: "bold", textAlign: "right", maxWidth: "60%" }}>{activeOrder.catatan || "Tidak ada"}</span>
                </div>
                
                <Button variant="success" className="w-100" style={{ borderRadius: "10px" }} onClick={handleCompleteOrder}>
                  Selesaikan Order
                </Button>
              </Card.Body>
            </Card>
          </div>
        ) : (
          <div>
            <h5 style={{ fontWeight: "bold", marginBottom: "15px" }}>Pending Orders</h5>
            {isLoading ? (
              <div className="text-center py-4"><p>Memuat order...</p></div>
            ) : orders.length === 0 ? (
              <div className="text-center py-4 text-muted"><p>Tidak ada order pending</p></div>
            ) : (
              orders.map(order => (
                <Card key={order.id} style={{ borderRadius: "16px", border: "none", boxShadow: "0 5px 10px rgba(0,0,0,0.05)", marginBottom: "15px" }}>
                  <Card.Body>
                    <Row className="align-items-center mb-3">
                      <Col xs="auto">
                        <div style={{ width: "40px", height: "40px", backgroundColor: "#4CAF50", color: "white", borderRadius: "50%", display: "flex", justifyContent: "center", alignItems: "center", fontWeight: "bold" }}>
                          U
                        </div>
                      </Col>
                      <Col>
                        <h6 style={{ fontWeight: "bold", margin: 0 }}>User {order.user_id}</h6>
                        <small className="text-muted">{order.address}</small>
                        <div className="mt-1"><small style={{ color: "#888" }}>Jenis: {order.jenis_sampah}</small></div>
                      </Col>
                    </Row>
                    <Row>
                      <Col>
                        <Button 
                          variant="outline-secondary" 
                          className="w-100" 
                          style={{ borderRadius: "10px" }}
                          onClick={() => setOrders(orders.filter(o => o.id !== order.id))}
                        >
                          Tolak
                        </Button>
                      </Col>
                      <Col>
                        <Button 
                          variant="success" 
                          className="w-100" 
                          style={{ borderRadius: "10px" }}
                          onClick={() => {
                            history.push({
                              pathname: `/driver/order/${order.id}`,
                              state: { order }
                            });
                          }}
                          disabled={!isOnline}
                        >
                          Lihat Detail
                        </Button>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>
              ))
            )}
          </div>
        )}
      </Container>
    </div>
  );
}

export default DriverDashboard;