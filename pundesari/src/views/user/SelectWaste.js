import React, { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";
import { Container, Row, Col, Card, Form, Button } from "react-bootstrap";
import Sidebar from "../../components/Sidebar.jsx";
import "../../css/Dashboard.css";
import "../../css/sidebar.css";
import { ordersAPI } from "../../services/api";
import { useOrder } from "../../context/OrderContext";

function SelectWaste() {
  const history = useHistory();
  const username = localStorage.getItem("nama") || "User";
  const userId = localStorage.getItem("userId") || 1;
  const { setActiveOrder } = useOrder();

  // Retrieve flow data from session storage
  const alamat = sessionStorage.getItem("pickup_alamat") || "Alamat tidak diketahui";
  const catatanPickup = sessionStorage.getItem("pickup_catatan") || "";
  const userLat = sessionStorage.getItem("pickup_lat");
  const userLng = sessionStorage.getItem("pickup_lng");

  const [isOrganik, setIsOrganik] = useState(false);
  const [isAnorganik, setIsAnorganik] = useState(false);
  const [isLainnya, setIsLainnya] = useState(false);
  const [catatanLainnya, setCatatanLainnya] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (catatanPickup) {
      setCatatanLainnya(catatanPickup);
    }
  }, [catatanPickup]);

  const handleCreateOrder = async () => {
    if (!isOrganik && !isAnorganik && !isLainnya) {
      alert("Pilih minimal satu jenis sampah");
      return;
    }

    const jenisSampah = [];
    if (isOrganik) jenisSampah.push("organik");
    if (isAnorganik) jenisSampah.push("anorganik");
    if (isLainnya) jenisSampah.push("lainnya");

    setIsSubmitting(true);
    try {
      const response = await ordersAPI.createOrder({
        user_id: parseInt(userId),
        address: alamat,
        user_lat: userLat ? parseFloat(userLat) : null,
        user_lng: userLng ? parseFloat(userLng) : null,
        jenis_sampah: jenisSampah.join(", "),
        catatan: catatanLainnya,
      });

      if (response.data.status === "success") {
        const orderPayload = {
          id: response.data.order_id,
          status: "searching_driver",
          user_id: parseInt(userId),
          address: alamat,
          user_lat: userLat ? parseFloat(userLat) : null,
          user_lng: userLng ? parseFloat(userLng) : null,
          jenis_sampah: jenisSampah.join(", "),
          catatan: catatanLainnya,
        };

        setActiveOrder(orderPayload);
        sessionStorage.setItem("current_order_id", response.data.order_id);
        history.push("/user/find-driver");
      } else {
        alert("Gagal membuat order");
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan koneksi");
      setIsSubmitting(false);
    }
  };

  const CategoryItem = ({ title, value, onChange }) => (
    <div className="mb-3 d-flex align-items-center">
      <Form.Check 
        type="checkbox" 
        checked={value} 
        onChange={(e) => onChange(e.target.checked)}
        className="mr-3"
        style={{ transform: "scale(1.5)" }}
      />
      <div 
        className="flex-grow-1 p-3" 
        style={{ backgroundColor: "#D1E4FF", borderRadius: "12px", display: "flex", alignItems: "center" }}
      >
        <i className="nc-icon nc-box-2 text-success mr-3" style={{ fontSize: "24px" }}></i>
        <span style={{ fontWeight: "bold" }}>{title}</span>
      </div>
    </div>
  );

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="dashboard-main">
        <div style={{ backgroundColor: "#FFFFFF", minHeight: "100vh" }}>
          <Container className="py-4">
        <div className="d-flex align-items-center mb-4">
          <i 
            className="nc-icon nc-minimal-left" 
            style={{ fontSize: "24px", cursor: "pointer", marginRight: "15px" }}
            onClick={() => history.goBack()}
          ></i>
          <div>
            <h5 style={{ fontWeight: "bold", margin: 0 }}>Halo {username}</h5>
            <small className="text-muted">daur ulang sampahmu yuk!</small>
          </div>
        </div>

        <h6 style={{ fontWeight: "bold" }}>📍 Alamat Penjemputan</h6>
        <Card style={{ borderRadius: "12px", border: "1px solid #ddd", boxShadow: "none", marginBottom: "30px" }}>
          <Card.Body className="p-3">
            <span style={{ fontSize: "14px", color: "#555" }}>{alamat}</span>
          </Card.Body>
        </Card>

        <h5 className="text-center mb-4" style={{ fontWeight: "bold" }}>Pilih Jenis Sampahmu</h5>

        <CategoryItem title="Sampah Organik" value={isOrganik} onChange={setIsOrganik} />
        <CategoryItem title="Sampah Anorganik" value={isAnorganik} onChange={setIsAnorganik} />
        <CategoryItem title="Sampah Lainnya" value={isLainnya} onChange={setIsLainnya} />

        <h6 className="mt-4 mb-2" style={{ fontWeight: "bold" }}>Catatan Untuk Sampah Lainnya</h6>
        <Form.Group className="mb-5">
          <Form.Control 
            type="text" 
            placeholder="Tambahkan catatan" 
            value={catatanLainnya}
            onChange={(e) => setCatatanLainnya(e.target.value)}
            style={{ borderRadius: "12px" }}
          />
        </Form.Group>

        <Row>
          <Col>
            <Button 
              variant="outline-success" 
              className="w-100" 
              style={{ borderRadius: "20px" }}
              onClick={() => history.goBack()}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </Col>
          <Col>
            <Button 
              variant="success" 
              className="w-100" 
              style={{ borderRadius: "20px" }}
              onClick={handleCreateOrder}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Loading..." : "Berikutnya"}
            </Button>
          </Col>
        </Row>
      </Container>
        </div>
      </main>
    </div>
  );
}

export default SelectWaste;
