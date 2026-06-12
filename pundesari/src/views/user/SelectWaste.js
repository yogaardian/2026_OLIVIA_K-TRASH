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
    <div style={styles.categoryRow}>
      <div style={styles.checkboxWrapper}>
        <Form.Check
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          style={styles.checkbox}
        />
      </div>
      <div style={styles.categoryCard}>
        <i
          className="nc-icon nc-box-2 text-success"
          style={styles.categoryIcon}
        ></i>
        <span style={styles.categoryLabel}>{title}</span>
      </div>
    </div>
  );

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="dashboard-main" style={styles.main}>

        {/* ── Hero Header ── */}
        <div style={styles.heroHeader}>
          <div style={styles.heroInner}>
            <div>
              <h5 style={styles.heroTitle}>Halo {username} 👋</h5>
              <p style={styles.heroSubtitle}>Daur ulang sampahmu yuk!</p>
            </div>
          </div>
        </div>

        {/* ── Content Area ── */}
        <div style={styles.contentArea}>
          <Container style={styles.container}>

            {/* Alamat */}
            <div style={styles.sectionLabel}>
              <span style={styles.sectionLabelText}>📍 Alamat Penjemputan</span>
            </div>
            <Card style={styles.addressCard}>
              <Card.Body style={styles.addressCardBody}>
                <i
                  className="nc-icon nc-pin-3"
                  style={styles.addressIcon}
                ></i>
                <span style={styles.addressText}>{alamat}</span>
              </Card.Body>
            </Card>

            {/* Pilih Jenis */}
            <h5 style={styles.sectionTitle}>Pilih Jenis Sampahmu</h5>

            <CategoryItem title="Sampah Organik"   value={isOrganik}   onChange={setIsOrganik} />
            <CategoryItem title="Sampah Anorganik" value={isAnorganik} onChange={setIsAnorganik} />
            <CategoryItem title="Sampah Lainnya"   value={isLainnya}   onChange={setIsLainnya} />

            {/* Catatan */}
            <div style={styles.sectionLabel}>
              <span style={styles.sectionLabelText}>📝 Catatan Untuk Sampah Lainnya</span>
            </div>
            <Form.Group style={styles.formGroup}>
              <Form.Control
                type="text"
                placeholder="Tambahkan catatan (opsional)"
                value={catatanLainnya}
                onChange={(e) => setCatatanLainnya(e.target.value)}
                style={styles.textInput}
              />
            </Form.Group>

            {/* Action Buttons */}
            <Row style={styles.buttonRow}>
              <Col xs={6} style={{ paddingRight: "6px" }}>
                <Button
                  variant="outline-success"
                  className="w-100"
                  style={styles.btnCancel}
                  onClick={() => history.goBack()}
                  disabled={isSubmitting}
                >
                  Batal
                </Button>
              </Col>
              <Col xs={6} style={{ paddingLeft: "6px" }}>
                <Button
                  variant="success"
                  className="w-100"
                  style={styles.btnNext}
                  onClick={handleCreateOrder}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                        aria-hidden="true"
                      ></span>
                      Loading...
                    </>
                  ) : (
                    "Berikutnya →"
                  )}
                </Button>
              </Col>
            </Row>

          </Container>
        </div>
      </main>
    </div>
  );
}

/* ─────────────────────────────────────────
   Inline Styles — UI only, no logic change
───────────────────────────────────────── */
const BRAND_GRADIENT =
  "linear-gradient(135deg, rgb(102,178,130) 0%, rgb(21,128,61) 60%, rgb(20,83,45) 100%)";

const styles = {
  /* layout */
  main: {
    backgroundColor: "#f5f7f5",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  },

  /* hero */
  heroHeader: {
    background: BRAND_GRADIENT,
    padding: "clamp(16px, 4vw, 28px) clamp(16px, 5vw, 32px)",
    paddingBottom: "clamp(24px, 5vw, 36px)",
  },
  heroInner: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    maxWidth: "720px",
    margin: "0 auto",
    width: "100%",
  },
  backBtn: {
    background: "rgba(255,255,255,0.2)",
    border: "none",
    borderRadius: "10px",
    width: "40px",
    height: "40px",
    minWidth: "40px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    cursor: "pointer",
    flexShrink: 0,
  },
  heroTitle: {
    color: "#fff",
    fontWeight: "700",
    margin: 0,
    fontSize: "clamp(16px, 4vw, 20px)",
    lineHeight: 1.3,
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.85)",
    margin: 0,
    fontSize: "clamp(12px, 3vw, 14px)",
  },

  /* content */
  contentArea: {
    flex: 1,
    paddingTop: "clamp(16px, 4vw, 28px)",
    paddingBottom: "clamp(24px, 6vw, 40px)",
  },
  container: {
    maxWidth: "720px",
    padding: "0 clamp(12px, 4vw, 24px)",
  },

  /* address card */
  sectionLabel: {
    marginBottom: "8px",
  },
  sectionLabelText: {
    fontWeight: "700",
    fontSize: "clamp(13px, 3.5vw, 15px)",
    color: "#1e4d2b",
  },
  addressCard: {
    borderRadius: "14px",
    border: "1px solid #d4e8d4",
    boxShadow: "0 2px 8px rgba(21,128,61,0.08)",
    marginBottom: "24px",
    overflow: "hidden",
  },
  addressCardBody: {
    padding: "clamp(12px, 3vw, 16px)",
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
  },
  addressIcon: {
    fontSize: "18px",
    color: "#15803d",
    flexShrink: 0,
    marginTop: "2px",
  },
  addressText: {
    fontSize: "clamp(12px, 3.5vw, 14px)",
    color: "#444",
    lineHeight: 1.5,
  },

  /* section title */
  sectionTitle: {
    fontWeight: "700",
    textAlign: "center",
    fontSize: "clamp(15px, 4vw, 18px)",
    color: "#1e4d2b",
    marginBottom: "16px",
  },

  /* category item */
  categoryRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "12px",
  },
  checkboxWrapper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "44px",
    height: "44px",
    flexShrink: 0,
  },
  checkbox: {
    width: "22px",
    height: "22px",
    cursor: "pointer",
    accentColor: "#15803d",
  },
  categoryCard: {
    flex: 1,
    backgroundColor: "#dbeafe",
    borderRadius: "12px",
    padding: "clamp(12px, 3vw, 16px)",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minHeight: "52px",
  },
  categoryIcon: {
    fontSize: "clamp(20px, 5vw, 26px)",
    flexShrink: 0,
  },
  categoryLabel: {
    fontWeight: "600",
    fontSize: "clamp(13px, 3.5vw, 15px)",
    color: "#1e3a5f",
  },

  /* catatan */
  formGroup: {
    marginBottom: "28px",
  },
  textInput: {
    borderRadius: "12px",
    padding: "clamp(10px, 2.5vw, 13px) 14px",
    fontSize: "clamp(13px, 3.5vw, 15px)",
    border: "1px solid #c8dfc8",
    backgroundColor: "#fff",
    width: "100%",
  },

  /* buttons */
  buttonRow: {
    marginTop: "4px",
  },
  btnCancel: {
    borderRadius: "22px",
    minHeight: "48px",
    fontWeight: "600",
    fontSize: "clamp(13px, 3.5vw, 15px)",
    borderColor: "#15803d",
    color: "#15803d",
  },
  btnNext: {
    borderRadius: "22px",
    minHeight: "48px",
    fontWeight: "600",
    fontSize: "clamp(13px, 3.5vw, 15px)",
    background: BRAND_GRADIENT,
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
  },
};

export default SelectWaste;