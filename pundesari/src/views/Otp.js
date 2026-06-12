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
    const normalizedValue = value;
    if (/^[A-Za-z0-9]$/.test(normalizedValue) || value === "") {
      const newOtp = [...otp];
      newOtp[index] = normalizedValue;
      setOtp(newOtp);
      if (normalizedValue && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
      if (error) setError("");
    }
  };

  const handleOtpKeyDown = async (index, event) => {
    const key = event.key;
    const isModifier = event.ctrlKey || event.metaKey;

    if (isModifier && key.toLowerCase() === 'c') {
      event.preventDefault();
      const otpCode = otp.join('');
      try {
        await navigator.clipboard.writeText(otpCode);
      } catch (err) {
        console.error('Gagal menyalin OTP:', err);
      }
      return;
    }

    if (key === 'Backspace') {
      event.preventDefault();
      if (otp[index] !== '') {
        const newOtp = [...otp];
        newOtp[index] = '';
        setOtp(newOtp);
        return;
      }
      if (index > 0) {
        inputRefs.current[index - 1]?.focus();
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
      }
      return;
    }

    if (key === 'Delete') {
      event.preventDefault();
      if (otp[index] !== '') {
        const newOtp = [...otp];
        newOtp[index] = '';
        setOtp(newOtp);
      }
      return;
    }

    if (key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      inputRefs.current[index - 1]?.focus();
      return;
    }

    if (key === 'ArrowRight' && index < otp.length - 1) {
      event.preventDefault();
      inputRefs.current[index + 1]?.focus();
      return;
    }
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData("text").trim();
    if (!/^[A-Za-z0-9]{1,6}$/.test(pasted)) {
      return;
    }
    e.preventDefault();
    const newOtp = Array(6).fill("");
    pasted.split("").forEach((char, i) => {
      if (i < 6) newOtp[i] = char;
    });
    setOtp(newOtp);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleOtpFocus = (index) => {
    inputRefs.current[index]?.select();
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
        const profilePhoto =
          userData.profile_photo && String(userData.profile_photo).trim() !== ""
            ? userData.profile_photo
            : null;

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
                inputMode="text"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(i, e)}
                onFocus={() => handleOtpFocus(i)}
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