import React, { useState } from "react";
import { useHistory } from "react-router-dom";
import "./css/register.css";
import BgRegister from "../assets/Bgregister.png";
import Logo from "../assets/LogoK-Trash.png";
import { Mail, Lock, User, Phone, Eye, EyeOff } from "lucide-react";
import { authAPI } from "../services/api";

const Register = () => {
    const history = useHistory();
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    
    const [formData, setFormData] = useState({
        nama: "",
        email: "",
        nomor_hp: "",
        password: "",
        confirmPassword: "",
        agree: false
    });

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({
            ...formData,
            [name]: type === "checkbox" ? checked : value
        });
    };

    const validateForm = () => {
        if (!formData.nama.trim()) {
            setError("Nama lengkap harus diisi");
            return false;
        }
        if (!formData.email.trim()) {
            setError("Email harus diisi");
            return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            setError("Format email tidak valid");
            return false;
        }
        if (!formData.nomor_hp.trim()) {
            setError("Nomor HP harus diisi");
            return false;
        }
        if (!/^\d{10,13}$/.test(formData.nomor_hp.replace(/[^\d]/g, ''))) {
            setError("Nomor HP harus 10-13 digit");
            return false;
        }
        if (!formData.password) {
            setError("Password harus diisi");
            return false;
        }
        if (formData.password.length < 6) {
            setError("Password minimal 6 karakter");
            return false;
        }
        if (formData.password !== formData.confirmPassword) {
            setError("Password dan konfirmasi password tidak cocok");
            return false;
        }
        if (!formData.agree) {
            setError("Anda harus setuju dengan Syarat & Ketentuan");
            return false;
        }
        return true;
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (!validateForm()) {
            return;
        }

        setLoading(true);
        try {
            const response = await authAPI.register({
                nama: formData.nama,
                email: formData.email,
                nomor_hp: formData.nomor_hp,
                password: formData.password,
                role: "user"
            });

            if (response.data.status === "otp_sent") {
                localStorage.setItem('otp_email', formData.email);
                history.push('/otp');
                return;
            }

            setError(response.data.message || "Pendaftaran gagal. Silakan coba lagi.");
        } catch (err) {
            console.error(err);
            if (err.response?.data?.message) {
                setError(err.response.data.message);
            } else if (err.response?.status === 409) {
                setError("Email sudah terdaftar. Gunakan email lain.");
            } else {
                setError("Terjadi kesalahan pada server atau koneksi terputus.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="register-page"
            style={{
                backgroundImage: `url(${BgRegister})`,
            }}
        >
            {/* OVERLAY */}
            <div className="overlay"></div>

            {/* TOP NAV */}
            <div className="top-navbar">
                <div className="logo-wrapper">
                    <img src={Logo} alt="logo" className="logo-img" />
                    <h1 className="logo-text">K-Trash</h1>
                </div>

                <div className="auth-switch">
                    <button className="login-switch" onClick={() => history.push("/login")}>
                        Login
                    </button>
                    <button className="register-switch active">
                        Daftar
                    </button>
                </div>
            </div>

            {/* REGISTER CARD */}
            <div className="register-container">
                <div className="register-card">
                    <h1 className="register-title">
                        <span>Buat Akun Baru</span>
                    </h1>

                    <p className="register-subtitle">
                        Bergabung dengan K-Trash dan mulai
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

                    {/* SUCCESS MESSAGE */}
                    {success && (
                        <div className="alert-success" style={{
                            backgroundColor: "#efe",
                            color: "#3c3",
                            padding: "12px 16px",
                            borderRadius: "8px",
                            marginBottom: "16px",
                            fontSize: "14px"
                        }}>
                            {success}
                        </div>
                    )}

                    {/* FORM */}
                    <form className="register-form" onSubmit={handleRegister}>
                        {/* NAMA */}
                        <div className="input-group">
                            <User size={20} className="input-icon" />
                            <input
                                type="text"
                                name="nama"
                                placeholder="Nama Lengkap"
                                value={formData.nama}
                                onChange={handleInputChange}
                            />
                        </div>

                        {/* EMAIL */}
                        <div className="input-group">
                            <Mail size={20} className="input-icon" />
                            <input
                                type="email"
                                name="email"
                                placeholder="Email"
                                value={formData.email}
                                onChange={handleInputChange}
                            />
                        </div>

                        {/* PHONE */}
                        <div className="input-group">
                            <Phone size={20} className="input-icon" />
                            <input
                                type="text"
                                name="nomor_hp"
                                placeholder="Nomor HP"
                                value={formData.nomor_hp}
                                onChange={handleInputChange}
                            />
                        </div>

                        {/* PASSWORD */}
                        <div className="input-group">
                            <Lock size={20} className="input-icon" />
                            <input
                                type={showPassword ? "text" : "password"}
                                name="password"
                                placeholder="Password"
                                value={formData.password}
                                onChange={handleInputChange}
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

                        {/* KONFIRMASI PASSWORD */}
                        <div className="input-group">
                            <Lock size={20} className="input-icon" />
                            <input
                                type={showConfirmPassword ? "text" : "password"}
                                name="confirmPassword"
                                placeholder="Konfirmasi Password"
                                value={formData.confirmPassword}
                                onChange={handleInputChange}
                            />

                            <button
                                type="button"
                                className="eye-button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            >
                                {showConfirmPassword ? (
                                    <EyeOff size={20} />
                                ) : (
                                    <Eye size={20} />
                                )}
                            </button>
                        </div>

                        {/* CHECKBOX */}
                        <div className="checkbox-group">
                            <input 
                                type="checkbox"
                                name="agree"
                                checked={formData.agree}
                                onChange={handleInputChange}
                            />

                            <p>
                                Saya setuju dengan{" "}
                                <span>Syarat & Ketentuan</span> dan{" "}
                                <span>Kebijakan Privasi</span>
                            </p>
                        </div>

                        {/* BUTTON */}
                        <button 
                            className="register-btn"
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? "Mendaftar..." : "Daftar Sekarang →"}
                        </button>

                        {/* LOGIN */}
                        <div className="bottom-login">
                            Sudah punya akun?
                            <span 
                                onClick={() => history.push("/login")} 
                                style={{ cursor: 'pointer' }}
                            >
                                Login Sekarang
                            </span>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Register;