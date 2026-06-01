import React, { useState, useEffect, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loadStoredProfile, saveProfile } from '../config/profileConfig';
import { authAPI } from '../services/api';
import './Otp.css';

function OTPPage() {
  const [otp, setOtp] = useState(Array(6).fill(''));
  const [email, setEmail] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef([]);
  const history = useHistory();
  const { login } = useAuth();
  const isMountedRef = useRef(true);

  useEffect(() => {
    const registerEmail = localStorage.getItem('otp_email');
    if (registerEmail) {
      setEmail(registerEmail);
    } else {
      history.push('/register');
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [history]);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleOtpChange = (index, value) => {
    if (/^\d$/.test(value) || value === "") {
      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);
      if (value && index < 5) inputRefs.current[index + 1].focus();
      if (error) setError("");
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").slice(0, 6);
    if (/^\d{1,6}$/.test(pasted)) {
      const newOtp = Array(6).fill("");
      pasted.split("").forEach((char, i) => (newOtp[i] = char));
      setOtp(newOtp);
      inputRefs.current[Math.min(pasted.length, 5)].focus();
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      setError('Masukkan 6 digit kode OTP');
      return;
    }

    setLoading(true);
    try {
      const { data } = await authAPI.verifyRegister({ email, otp: otpCode });

      if (data.status === 'success' && data.token) {
        const userData = data.user;
        const role = userData.role || 'user';
        const profileRole = role === 'driver' ? 'petugas' : role;
        const storedProfile = loadStoredProfile(profileRole);
        const profilePhoto =
          userData.profile_photo !== undefined && userData.profile_photo !== null
            ? userData.profile_photo
            : storedProfile.profilePhoto || null;

        saveProfile(profileRole, {
          id: userData.id,
          name: userData.nama,
          email: userData.email,
          phoneNumber: userData.nomor_hp || '',
          profilePhoto,
        });

        login(data.token, userData);
        localStorage.removeItem('otp_email');

        if (role === 'admin') {
          history.push('/admin/dashboard');
        } else if (role === 'driver' || role === 'petugas') {
          history.push('/driver/dashboard');
        } else {
          history.push('/user/dashboard');
        }
      } else {
        setError(data.message || 'Verifikasi gagal');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Verifikasi gagal');
      setOtp(Array(6).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setLoading(true);
    try {
      const { data } = await authAPI.resendRegisterOtp({ email });
      if (data.status === 'success') {
        setCountdown(60);
        setError('');
      } else {
        setError(data.message || 'Gagal mengirim ulang OTP');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Gagal mengirim ulang OTP');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  return (
    <div className="otp-page-wrapper">
      <div className="otp-container">
        <div className="otp-header">
          <h1>🔐 Verifikasi Pendaftaran</h1>
          <p>Kami telah mengirim kode ke <strong>{email}</strong></p>
        </div>

        {error && <div className="otp-error">{error}</div>}

        <form onSubmit={handleVerify} className="otp-form">
          <div className="otp-grid">
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => (inputRefs.current[i] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onPaste={handlePaste}
                className={`otp-input ${digit ? "filled" : ""}`}
              />
            ))}
          </div>

          <button type="submit" className="otp-btn" disabled={loading}>
            {loading ? "Memverifikasi..." : "Verifikasi"}
          </button>
        </form>

        <div className="otp-resend">
          {countdown > 0 ? (
            <span className="otp-timer">Kirim ulang dalam {countdown}s</span>
          ) : (
            <button type="button" onClick={handleResend} className="otp-resend-btn" disabled={loading}>
              Kirim Ulang Kode
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            localStorage.removeItem('otp_email');
            history.push('/register');
          }}
          className="otp-back"
        >
          ← Kembali
        </button>
      </div>
    </div>
  );
}

export default OTPPage;