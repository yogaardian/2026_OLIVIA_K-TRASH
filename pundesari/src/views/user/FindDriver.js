import React, { useEffect, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import { Container, Button, Spinner } from "react-bootstrap";
import Sidebar from "../../components/Sidebar.jsx";
import { useOrder } from "../../context/OrderContext";
import { ordersAPI } from "../../services/api";
import "../../css/Dashboard.css";
import "../../css/sidebar.css";

function FindDriver() {
  const history = useHistory();
  const {
    activeOrder,
    setActiveOrder,
    updateActiveOrder,
    cancelOrder,
    isRecovering,
  } = useOrder();

  const [currentStatus, setCurrentStatus] = useState(activeOrder?.status || null);
  const currentOrderId = activeOrder?.id || sessionStorage.getItem("current_order_id");
  const isSearchingDriver = !currentStatus || currentStatus === "pending" || currentStatus === "searching_driver";
  const acceptedAlertRef = useRef(false);

  useEffect(() => {
    if (isRecovering) return;
    if (!currentOrderId) {
      history.replace("/user/dashboard");
      return;
    }

    const checkOrderStatus = async () => {
      try {
        const response = await ordersAPI.getOrderDetail(currentOrderId);
        const order = response?.data;
        if (!order?.id) return;

        const normalizedStatus = order.status || order.order_status || order.state || "pending";
        setCurrentStatus(normalizedStatus);

        if (!activeOrder?.id) {
          setActiveOrder(order);
        } else {
          updateActiveOrder(order);
        }

        if (["assigned", "on_the_way", "arrived"].includes(normalizedStatus)) {
          if (!acceptedAlertRef.current) {
            acceptedAlertRef.current = true;
            window.alert("Petugas Ditemukan!");
          }
          history.replace("/user/tracking-petugas");
          return;
        }

        if (["cancelled", "completed"].includes(normalizedStatus)) {
          history.replace("/user/dashboard");
          return;
        }
      } catch (error) {
        console.error("Error polling order status:", error);
      }
    };

    checkOrderStatus();
    const interval = setInterval(checkOrderStatus, 3000);
    return () => clearInterval(interval);
  }, [activeOrder?.id, currentOrderId, history, isRecovering, setActiveOrder, updateActiveOrder]);

  useEffect(() => {
    if (!isSearchingDriver) return;

    const pushHistory = () => {
      window.history.pushState(null, "", window.location.href);
    };

    const handlePopState = () => {
      pushHistory();
    };

    pushHistory();
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("beforeunload", pushHistory);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("beforeunload", pushHistory);
    };
  }, [isSearchingDriver]);

  const handleCancel = async () => {
    await cancelOrder();
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="dashboard-main">
        <div style={{ backgroundColor: "#F0F9F1", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
          <Container className="text-center d-flex flex-column" style={{ flexGrow: 1 }}>
            <div
              className="w-100 py-4 mt-5"
              style={{ backgroundColor: "rgba(180, 188, 180, 0.5)", borderRadius: "15px" }}
            >
              <h5 style={{ fontWeight: "bold", margin: 0, color: "#333" }}>Mencari Petugas Terdekat .....</h5>
              <p style={{ margin: 0, color: "#555" }}>Mohon tunggu</p>
            </div>

            <div className="flex-grow-1 d-flex flex-column justify-content-center align-items-center">
              <div
                style={{
                  width: "150px",
                  height: "150px",
                  backgroundColor: "#333",
                  borderRadius: "15px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  boxShadow: "0 10px 20px rgba(0,0,0,0.2)",
                }}
              >
                <Spinner animation="border" variant="light" style={{ width: "3rem", height: "3rem" }} />
                <span className="text-white mt-3" style={{ fontWeight: "bold" }}>Loading..</span>
              </div>

              <p className="mt-5 px-4 text-muted" style={{ lineHeight: "1.6" }}>
                Kami sedang mencari petugas yang tersedia di sekitar anda.
              </p>
            </div>

            <div className="mb-5 pb-4 w-100">
              <Button
                variant="light"
                className="w-100 py-3"
                style={{
                  borderRadius: "25px",
                  border: "2px solid #4CAF50",
                  fontWeight: "bold",
                  color: "#333",
                }}
                onClick={handleCancel}
              >
                Batalkan
              </Button>
            </div>
          </Container>
        </div>
      </main>
    </div>
  );
}

export default FindDriver;
