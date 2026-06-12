import React, { useState, useEffect } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { useOrder } from "../context/OrderContext";
import "../css/sidebar.css";

const navItems = [
  { icon: "🏠", label: "Beranda", path: "/user/dashboard" },
  { icon: "💳", label: "Saldo & Poin", path: "/user/saldo" },
  { icon: "🛒", label: "Marketplace", path: "/user/marketplace" },
  { icon: "🚛", label: "Jemput Sampah", path: "/user/pickup" },
  { icon: "🏷️", label: "Harga Sampah", path: "/user/harga" },
  { icon: "🕐", label: "Riwayat", path: "/user/history" },
  // { icon: "🔔", label: "Notifikasi", path: "/user/notifications", badge: 2 },
];

const Sidebar = () => {
  const history = useHistory();
  const location = useLocation();
  const { orderFlowState, ORDER_FLOW, cancelOrder } = useOrder();
  const isSearchingDriver = orderFlowState === ORDER_FLOW.SEARCHING_DRIVER;
  const [isProfileOpen, setProfileOpen] = useState(false);

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebarCollapsed') === 'true'; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 1024 : false);

  // Sync collapsed state to body class for layout
  useEffect(() => {
    if (collapsed) {
      document.body.classList.add('sidebar-collapsed');
    } else {
      document.body.classList.remove('sidebar-collapsed');
    }
    return () => {
      document.body.classList.remove('sidebar-collapsed');
    };
  }, [collapsed]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 1024;
      setIsMobile(mobile);
      if (!mobile) {
        setMobileOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((s) => {
      const next = !s;
      try { localStorage.setItem('sidebarCollapsed', next ? 'true' : 'false'); } catch {}
      return next;
    });
  };

  const toggleMobileOpen = () => setMobileOpen((value) => !value);
  const closeMobileSidebar = () => setMobileOpen(false);

  useEffect(() => {
    const handler = () => setProfileOpen(true);
    window.addEventListener('openProfilePanel', handler);
    // allow other components to trigger closing via event
    const closeHandler = () => setProfileOpen(false);
    window.addEventListener('closeProfilePanel', closeHandler);
    return () => {
      window.removeEventListener('openProfilePanel', handler);
      window.removeEventListener('closeProfilePanel', closeHandler);
    };
  }, []);

  return (
    <>
      {isMobile && !mobileOpen && (
        <button
          className="user-sidebar-hamburger-toggle"
          type="button"
          onClick={toggleMobileOpen}
          aria-label="Buka menu sidebar"
        >
          ☰
        </button>
      )}
      {isMobile && mobileOpen && (
        <div className="user-sidebar-backdrop visible" onClick={closeMobileSidebar} />
      )}
      <aside className={`user-sidebar${collapsed ? ' collapsed' : ''} ${isMobile ? ' mobile' : ''} ${isMobile && mobileOpen ? ' open' : ''}`}>
      <div
        className="user-sidebar-logo"
        onClick={() => {
          if (!isSearchingDriver) {
            history.push("/user/dashboard");
            if (isMobile) closeMobileSidebar();
          }
        }}
        style={isSearchingDriver ? { cursor: 'not-allowed', opacity: 0.8 } : undefined}
      >
        <span className="user-sidebar-logo-text">K-Trash</span>
      </div>

        {!isMobile && (
          <button
            className="user-sidebar-collapse-btn"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? '→' : '←'}
          </button>
        )}

      <nav className="user-sidebar-nav">
        {navItems.map((item) => (
          <div
            key={item.label}
            className={`user-sidebar-item ${location.pathname === item.path ? "active" : ""} ${isSearchingDriver ? 'disabled' : ''}`}
            onClick={() => {
              if (isSearchingDriver) return;
              history.push(item.path);
              if (isMobile) closeMobileSidebar();
            }}
            style={isSearchingDriver ? { cursor: 'not-allowed' } : undefined}
          >
            <span className="user-sidebar-item-icon">{item.icon}</span>
            <span className="user-sidebar-item-label">{item.label}</span>
            {item.badge && (
              <span className="user-sidebar-badge">{item.badge}</span>
            )}
          </div>
        ))}
        {/* Profile Button as nav item */}
        <div
          className={`user-sidebar-item user-sidebar-profile-nav ${isSearchingDriver ? 'disabled' : ''}`}
          onClick={() => {
            if (isSearchingDriver) return;
            setProfileOpen(false); // pastikan panel profil tertutup
            history.push('/user/profile');
            if (isMobile) closeMobileSidebar();
          }}
          style={isSearchingDriver ? { cursor: 'not-allowed' } : undefined}
        >
          <span className="user-sidebar-item-icon" role="img" aria-label="Profil">👤</span>
          <span className="user-sidebar-item-label">Profil</span>
        </div>

        {isSearchingDriver && (
          <button
            type="button"
            className="user-sidebar-item user-sidebar-cancel-order"
            onClick={() => {
              cancelOrder();
              if (isMobile) closeMobileSidebar();
            }}
            style={{ marginTop: '12px', borderRadius: '12px', border: '1px solid #e74c3c', backgroundColor: '#fff', color: '#c0392b' }}
          >
            <span className="user-sidebar-item-icon">❌</span>
            <span className="user-sidebar-item-label">Batalkan Order</span>
          </button>
        )}
      </nav>

      <div className="user-sidebar-leaf"></div>
    </aside>
  </>
  );
};

export default Sidebar;
