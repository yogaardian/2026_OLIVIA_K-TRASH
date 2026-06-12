import React, { useState, useEffect, useRef } from "react";
import { useHistory } from "react-router-dom";
import { useAuth } from '../context/AuthContext';
import { authAPI } from "../services/api";
import { loadStoredProfile, saveProfile } from "../config/profileConfig";
import { GoogleLogin } from "@react-oauth/google";
import "./css/login.css";
import Logo from "../assets/LogoK-Trash.png";
import BgImage from "../assets/Bgregister.png";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const history = useHistory();
  const { login } = useAuth();
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Isi semua data");
      return;
    }
    

    setLoading(true);
    try {
      const { data } = await authAPI.login(email, password);

      const userData = data.user;
      const role = userData.role || 'user';
      const profileRole = role === 'driver' ? 'petugas' : role;
      const profilePhoto =
        userData.profile_photo && String(userData.profile_photo).trim() !== ""
          ? userData.profile_photo
          : null;

      saveProfile(profileRole, {
        id: userData.id,
        name: userData.nama,
        email: userData.email,
        phoneNumber: userData.nomor_hp || "",
        profilePhoto,
      });

      login(data.token, userData);

      if (role === "admin") {
        history.push("/admin/dashboard");
      } else if (role === "driver" || role === "petugas") {
        history.push("/driver/dashboard");
      } else if (role === "user") {
        history.push("/user/dashboard");
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err.response?.data?.message || err.message || "Login gagal");
      }
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  // ==================== GOOGLE LOGIN ====================
  const handleGoogleSuccess = async (credentialResponse) => {
    setError("");
    setLoading(true);

    if (!credentialResponse?.credential) {
      if (isMountedRef.current) {
        setError("Google credential tidak ditemukan. Silakan coba lagi.");
      }
      setLoading(false);
      return;
    }

    try {
      const { data } = await authAPI.googleLogin(credentialResponse.credential);

      if (!data || data.status !== 'success') {
        if (isMountedRef.current) {
          setError(data?.error || data?.message || 'Google login gagal');
        }
        return;
      }

      if (data.token) {
        const userData = data.user;
        const role = userData.role || 'user';
        const profileRole = role === 'driver' ? 'petugas' : role;

        saveProfile(profileRole, {
          id: userData.id,
          name: userData.nama,
          email: userData.email,
          phoneNumber: userData.nomor_hp || "",
          profilePhoto: userData.profile_photo || null,
        });

        login(data.token, userData);

        if (role === "admin") {
          history.push("/admin/dashboard");
        } else if (role === "driver" || role === "petugas") {
          history.push("/driver/dashboard");
        } else if (role === "user") {
          history.push("/user/dashboard");
        } else {
          if (isMountedRef.current) setError("Role tidak dikenali. Hubungi admin.");
        }
      }
    } catch (err) {
      if (isMountedRef.current) {
        const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message || "Google login gagal";
        setError(errorMsg);
        console.error("Google login error:", err.response?.data || err);
      }
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError("Gagal login dengan Google. Silakan coba lagi.");
  };

  return (
    <div
      className="login-page"
      style={{
        backgroundImage: `url(${BgImage})`,
      }}
    >
      {/* OVERLAY */}
      <div className="overlay"></div>

      {/* TOP NAVBAR */}
      <div className="top-navbar">
        <div className="logo-wrapper">
          <img src={Logo} alt="logo" className="logo-img" />
          <h1 className="logo-text">K-Trash</h1>
        </div>

        <div className="auth-switch">
          <button className="login-switch active">
            Login
          </button>
          <button
            className="register-switch"
            onClick={() => history.push("/Register")}
          >
            Daftar
          </button>
        </div>
      </div>

      {/* LOGIN CARD */}
      <div className="login-container">
        <div className="login-card">
          {/* TITLE */}
          <h1 className="login-title">
            <span>Selamat Datang</span>
          </h1>

          <p className="login-subtitle">
            Masuk ke akun K-Trash Anda dan mulai
            kelola sampah dengan lebih mudah.
          </p>

          {/* ERROR MESSAGE */}
          {error && (
            <div className="alert-error" style={{
              backgroundColor: "#fee",
              color: "#c33",
              padding: "12px 16px",
              borderRadius: "8px",
              marginBottom: "16px",
              fontSize: "14px"
            }}>
              {error}
            </div>
          )}

          {/* FORM */}
          <form className="login-form" onSubmit={handleLogin}>
            {/* EMAIL */}
            <div className="input-group">
              <Mail size={20} className="input-icon" />
              <input
                type="email"
                placeholder="Masukkan Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* PASSWORD */}
            <div className="input-group">
              <Lock size={20} className="input-icon" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Masukkan Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <button
                type="button"
                className="eye-button"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff size={20} />
                ) : (
                  <Eye size={20} />
                )}
              </button>
            </div>

            {/* REMEMBER */}
            <div className="login-options">
              <label className="remember-me">
                <input type="checkbox" />
                Ingat Saya
              </label>

              <span className="forgot-password">
                Lupa Password?
              </span>
            </div>

            {/* BUTTON */}
            <button 
              className="login-submit-btn" 
              type="submit"
              disabled={loading}
            >
              {loading ? "Memuat..." : "Masuk Sekarang"}
            </button>

            {/* DIVIDER & GOOGLE LOGIN - Only show if clientId is available */}
            {process.env.REACT_APP_GOOGLE_CLIENT_ID && (
              <>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  margin: '24px 0',
                  color: '#999'
                }}>
                  <hr style={{ flex: 1, border: 'none', borderTop: '1px solid #ddd' }} />
                  <span style={{ padding: '0 12px', fontSize: '12px' }}>ATAU</span>
                  <hr style={{ flex: 1, border: 'none', borderTop: '1px solid #ddd' }} />
                </div>

                {/* GOOGLE LOGIN */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  marginBottom: '20px'
                }}>
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={handleGoogleError}
                  />
                </div>
              </>
            )}

            {/* REGISTER */}
            <div className="bottom-register">
              Belum punya akun?
              <span onClick={() => history.push("/Register")} style={{ cursor: 'pointer' }}>
                {" "}Daftar Sekarang
              </span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;