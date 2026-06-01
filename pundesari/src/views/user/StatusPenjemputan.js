import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar.jsx";
import TopbarUserProfile from "../../components/TopbarUserProfile";
import "../../css/Dashboard.css";
import "../../css/StatusPenjemputan.css";
import { ordersAPI } from "../../services/api";

const StatusPenjemputan = () => {
  const [orderId, setOrderId] = useState(null);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const currentOrderId = sessionStorage.getItem("current_order_id");
    if (currentOrderId) {
      setOrderId(currentOrderId);
      // Fetch order details
      ordersAPI
        .getOrderDetail(currentOrderId)
        .then((res) => {
          setOrder(res.data);
        })
        .catch((err) => console.error(err))
        .finally(() => setLoading(false));
    }
  }, []);

  const getStatusIcon = (status) => {
    const statuses = {
      pending: "📋",
      assigned: "✅",
      dalam_perjalanan: "🚛",
      arrived: "📍",
      completed: "✓",
    };
    return statuses[status] || "❓";
  };

  const getStepStatus = (step) => {
    const statusOrder = ["pending", "assigned", "dalam_perjalanan", "arrived", "completed"];
    if (!order) return "disabled";
    const currentIndex = statusOrder.indexOf(order.status);
    const stepIndex = statusOrder.indexOf(step);
    if (stepIndex < currentIndex) return "completed";
    if (stepIndex === currentIndex) return "active";
    return "disabled";
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="dashboard-main">
        {/* TOPBAR */}
        <header className="topbar">
          <div></div>
          <div className="topbar-right">
            <div className="notif-btn">🔔</div>
            <TopbarUserProfile />
          </div>
        </header>

        {/* CONTENT */}
        <div className="dashboard-content">
          {/* HEADER */}
          <div className="status-header">
            <div className="header-text">
              <h1>Status Penjemputan</h1>
              <p>Pantau status penjemputan sampahmu secara real-time</p>
            </div>
          </div>

          {loading ? (
            <p className="text-center">Memuat data...</p>
          ) : !order ? (
            <p className="text-center">Order tidak ditemukan</p>
          ) : (
            <>
              {/* STEPPER */}
              <div className="status-stepper">
                {["pending", "assigned", "dalam_perjalanan", "arrived", "completed"].map((step, i) => (
                  <div key={step}>
                    <div className={`step ${getStepStatus(step)}`}>
                      <div className="step-icon">{getStatusIcon(step)}</div>
                      <div>
                        <div className="step-title">
                          {step === "pending" && "Menunggu"}
                          {step === "assigned" && "Driver Ditugaskan"}
                          {step === "dalam_perjalanan" && "Dalam Perjalanan"}
                          {step === "arrived" && "Tiba"}
                          {step === "completed" && "Selesai"}
                        </div>
                        <div className="step-desc">
                          {step === "pending" && "Mencari driver"}
                          {step === "assigned" && "Driver ditemukan"}
                          {step === "dalam_perjalanan" && "Dalam perjalanan ke lokasi"}
                          {step === "arrived" && "Driver tiba di lokasi"}
                          {step === "completed" && "Penjemputan selesai"}
                        </div>
                      </div>
                    </div>
                    {i < 4 && <div className="step-line"></div>}
                  </div>
                ))}
              </div>

              {/* GRID */}
              <div className="status-grid">
                {/* SEARCH ANIMATION */}
                <div className="search-card">
                  <div className="search-circle">
                    <div className="radar"></div>
                    <div className="radar-truck">🚛</div>
                  </div>
                  <div className="notif-pill">
                    {order.status === "pending" && "Mencari driver..."}
                    {order.status === "assigned" && "Driver ditugaskan"}
                    {order.status === "dalam_perjalanan" && "Driver dalam perjalanan"}
                    {order.status === "arrived" && "Driver telah tiba"}
                    {order.status === "completed" && "Penjemputan selesai"}
                  </div>
                </div>

                {/* DETAILS */}
                <div className="detail-card">
                  <h3>Detail Penjemputan</h3>
                  <div className="info-list">
                    <div className="info-item">
                      <div className="info-icon">📍</div>
                      <div>
                        <div className="info-label">Lokasi</div>
                        <div className="info-label">{order.location || "Tidak diketahui"}</div>
                      </div>
                    </div>
                    <div className="info-item">
                      <div className="info-icon">🗓️</div>
                      <div>
                        <div className="info-label">Tanggal</div>
                        <div className="info-label">
                          {new Date(order.created_at).toLocaleDateString("id-ID")}
                        </div>
                      </div>
                    </div>
                    <div className="info-item">
                      <div className="info-icon">📦</div>
                      <div>
                        <div className="info-label">Status Order</div>
                        <div className="info-label text-capitalize">{order.status}</div>
                      </div>
                    </div>
                  </div>

                  {driver && (
                    <div className="petugas-card">
                      <h4>Informasi Driver</h4>
                      <div className="petugas-profile">
                        <div className="avatar-petugas">
                          {driver.nama?.charAt(0).toUpperCase()}
                        </div>
                        <div className="petugas-info">
                          <h3>{driver.nama}</h3>
                          <div className="rating">⭐ 4.8</div>
                        </div>
                      </div>
                      <div className="petugas-details">
                        <div className="detail-item">
                          <span>📱 {driver.nomor_hp}</span>
                        </div>
                        <div className="detail-item">
                          <span>🚗 Plat Nomor: XXX 1234</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default StatusPenjemputan;
