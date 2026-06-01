import React from "react";
import ReactDOM from "react-dom";

import { BrowserRouter, Route, Switch, Redirect } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";

import "bootstrap/dist/css/bootstrap.min.css";
import "./assets/css/animate.min.css";
import "./assets/scss/light-bootstrap-dashboard-react.scss?v=2.0.0";
import "./assets/css/demo.css";
import "@fortawesome/fontawesome-free/css/all.min.css";

import LandingPage from "views/LandingPage.js";
import AdminLayout from "layouts/Admin.js";
import Login from "views/Login.js";
import Register from "views/Register.js";
import OTPPage from "views/Otp.js";
import LogoIcon from "./assets/LogoK-Trash.png";

// ===== PROVIDERS (Correct Order) =====
import { AuthProvider, useAuth } from "./context/AuthContext";
import { DashboardProvider } from "./context/AppContext";
import { SocketProvider } from "./context/SocketContext";
import { OrderProvider } from "./context/OrderContext";
import { NotificationProvider } from "./context/NotificationContext";
import SearchingDriverGuard from "./components/SearchingDriverGuard.jsx";

// User Flow
import UserDashboard from "views/user/UserDashboard.js";
import Profile from "views/user/Profile.js";
import History from "views/user/History.js";
import PickupPage from "views/user/PickupPage.js";
import SelectWaste from "views/user/SelectWaste.js";
import FindDriver from "views/user/FindDriver.js";
import TrackingPetugas from "views/user/TrackingPetugas.js";
import Saldo from "views/user/Saldo.js";
import HargaSampah from "views/user/HargaSampah.js";
import Marketplace from "views/user/Marketplace.js";

// Driver Flow
import DriverDashboard from "views/driver/DriverDashboard.js";
import OrderDetail from "views/driver/OrderDetail.js";
import TrackingUser from "views/driver/TrackingUser.js";
import ProfilePetugas from "views/driver/ProfilePetugas.js";

document.title = "K-Trash";

const faviconLink = document.querySelector("link[rel*='icon']") || document.createElement('link');
faviconLink.type = 'image/png';
faviconLink.rel = 'shortcut icon';
faviconLink.href = LogoIcon;
if (!document.querySelector("link[rel*='icon']")) {
  document.head.appendChild(faviconLink);
}

// ===== ERROR BOUNDARY =====
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          fontFamily: 'Arial, sans-serif'
        }}>
          <h1>⚠️ Error Loading Application</h1>
          <p>{this.state.error?.message}</p>
          <button onClick={() => window.location.reload()}>
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ===== GOOGLE OAUTH CONFIG =====
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

if (!GOOGLE_CLIENT_ID) {
  console.warn('⚠️ REACT_APP_GOOGLE_CLIENT_ID not set in .env file');
}

function AppWrapper({ children }) {
  if (GOOGLE_CLIENT_ID) {
    return (
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        {children}
      </GoogleOAuthProvider>
    );
  }
  return children;
}

// ===== REQUIRED PROVIDER HIERARCHY =====
// 1. GoogleOAuthProvider        - OAuth support
// 2. BrowserRouter              - router hooks (useHistory, useLocation, useNavigate)
// 3. AuthProvider               - authentication & token management
// 4. DashboardProvider          - depends on auth
// 5. SocketProvider             - depends on auth for token
// 6. OrderProvider              - depends on socket & auth
// 7. NotificationProvider       - depends on socket
// 8. Routes                     - all route-dependent components

const ProtectedRoute = ({ component: Component, allowedRoles, ...rest }) => {
  const { auth } = useAuth();

  return (
    <Route
      {...rest}
      render={(props) => {
        if (auth.isLoading) {
          return null;
        }

        if (!auth.isAuthenticated) {
          return <Redirect to="/login" />;
        }

        if (allowedRoles && !allowedRoles.includes(auth.user?.role)) {
          if (auth.user?.role === 'admin') {
            return <Redirect to="/admin/dashboard" />;
          }
          if (auth.user?.role === 'driver' || auth.user?.role === 'petugas') {
            return <Redirect to="/driver/dashboard" />;
          }
          if (auth.user?.role === 'user') {
            return <Redirect to="/user/dashboard" />;
          }
          return <Redirect to="/login" />;
        }

        return <Component {...props} />;
      }}
    />
  );
};

ReactDOM.render(
  <ErrorBoundary>
    <AppWrapper>
      <BrowserRouter>
        <AuthProvider>
          <DashboardProvider>
            <SocketProvider>
              <OrderProvider>
                <NotificationProvider>
                  <Switch>

                    {/* Landing */}
                    <Route exact path="/" render={(props) => <LandingPage {...props} />} />

                    {/* Auth Routes */}
                    <Route path="/login" render={(props) => <Login {...props} />} />
                    <Route path="/Register" render={(props) => <Register {...props} />} />
                    <Route path="/otp" render={(props) => <OTPPage {...props} />} />

                    {/* User Routes */}
                    <ProtectedRoute
                      path="/user/dashboard"
                      component={UserDashboard}
                      allowedRoles={['user', 'driver', 'petugas', 'admin']}
                    />

                    <ProtectedRoute
                      path="/user/profile"
                      component={Profile}
                      allowedRoles={['user', 'driver', 'petugas', 'admin']}
                    />

                    <ProtectedRoute
                      path="/user/history"
                      component={History}
                      allowedRoles={['user', 'driver', 'petugas', 'admin']}
                    />

                    <ProtectedRoute
                      path="/user/pickup"
                      component={PickupPage}
                      allowedRoles={['user', 'driver', 'petugas', 'admin']}
                    />

                    <ProtectedRoute
                      path="/user/select-waste"
                      component={SelectWaste}
                      allowedRoles={['user', 'driver', 'petugas', 'admin']}
                    />

                    <ProtectedRoute
                      path="/user/saldo"
                      component={Saldo}
                      allowedRoles={['user', 'driver', 'petugas', 'admin']}
                    />

                    <ProtectedRoute
                      path="/user/harga"
                      component={HargaSampah}
                      allowedRoles={['user', 'driver', 'petugas', 'admin']}
                    />

                    <ProtectedRoute
                      path="/user/marketplace"
                      component={Marketplace}
                      allowedRoles={['user', 'driver', 'petugas', 'admin']}
                    />

                    <Route
                      path="/user/notifications"
                      render={() => <Redirect to="/user/profile" />}
                    />

                    <ProtectedRoute
                      path="/user/find-driver"
                      component={() => (
                        <SearchingDriverGuard>
                          <FindDriver />
                        </SearchingDriverGuard>
                      )}
                      allowedRoles={['user', 'driver', 'petugas', 'admin']}
                    />

                    <ProtectedRoute
                      path="/user/tracking-petugas"
                      component={TrackingPetugas}
                      allowedRoles={['user', 'driver', 'petugas', 'admin']}
                    />

                    {/* Driver Routes */}
                    <ProtectedRoute
                      path="/driver/dashboard"
                      component={DriverDashboard}
                      allowedRoles={['driver', 'petugas', 'admin']}
                    />

                    <ProtectedRoute
                      path="/driver/order/:id"
                      component={OrderDetail}
                      allowedRoles={['driver', 'petugas', 'admin']}
                    />

                    <ProtectedRoute
                      path="/driver/tracking-user"
                      component={TrackingUser}
                      allowedRoles={['driver', 'petugas', 'admin']}
                    />

                    <ProtectedRoute
                      path="/driver/profile"
                      component={ProfilePetugas}
                      allowedRoles={['driver', 'petugas', 'admin']}
                    />

                    {/* Admin Route */}
                    <ProtectedRoute
                      path="/admin"
                      component={AdminLayout}
                      allowedRoles={['admin']}
                    />

                    <Redirect from="/" to="/login" />
                  </Switch>
                </NotificationProvider>
              </OrderProvider>
            </SocketProvider>
          </DashboardProvider>
        </AuthProvider>
      </BrowserRouter>
    </AppWrapper>
  </ErrorBoundary>,

  document.getElementById("root")
);
