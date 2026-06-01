import React, { useState, useEffect, useRef } from "react";
import { useHistory } from "react-router-dom";
import Sidebar from "../../components/Sidebar.jsx";
import "../../css/Dashboard.css";
import "../../css/sidebar.css";
import "../../css/Profile.css";
import { loadStoredProfile, saveProfile } from "../../config/profileConfig";
import { usersAPI } from "../../services/api";

function Profile() {
  const history = useHistory();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phoneNumber: "",
  });
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = () => {
    const stored = loadStoredProfile("user");
    setFormData({
      name: stored.name,
      email: stored.email,
      phoneNumber: stored.phoneNumber,
    });
    setProfilePhoto(stored.profilePhoto);
  };

  const handleLogout = () => {
    ["token", "userId", "nama", "role"].forEach((key) => localStorage.removeItem(key));
    history.push("/login");
  };

  const handleInputChange = (field) => (event) => {
    setFormData((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const userId = Number(localStorage.getItem('userId')) || null;
      if (userId) {
        await usersAPI.updateUser(userId, {
          nama: formData.name,
          nomor_hp: formData.phoneNumber,
          profile_photo: profilePhoto,
        });
      }

      saveProfile("user", {
        id: userId,
        name: formData.name,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        profilePhoto,
      });
      // keep compatibility for current session keys
      localStorage.setItem("nama", formData.name);
      localStorage.setItem("email", formData.email);
      localStorage.setItem("nomor_hp", formData.phoneNumber);
      if (isMountedRef.current) {
        setMessage({ type: "success", text: "✓ Profil berhasil disimpan." });
        setTimeout(() => {
          if (isMountedRef.current) setMessage(null);
        }, 3000);
      }
    } catch (error) {
      if (isMountedRef.current) setMessage({ type: "danger", text: "Gagal menyimpan profil." });
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  const handlePhotoUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setMessage({ type: "danger", text: "Ukuran foto terlalu besar (maksimal 5MB sebelum dikodekan)." });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePhoto(reader.result);
        setMessage({ type: "info", text: "Foto dipilih. Klik Simpan untuk menyimpan." });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setProfilePhoto(null);
    saveProfile("user", {
      name: formData.name,
      email: formData.email,
      phoneNumber: formData.phoneNumber,
      profilePhoto: null,
    });
    setMessage({ type: "info", text: "Foto profil dihapus." });
  };

  const handleReset = () => {
    loadProfile();
    setMessage({ type: "info", text: "Perubahan dibatalkan." });
  };

  const handleDeleteAccount = () => {
    if (window.confirm("Apakah Anda yakin ingin menghapus akun? Tindakan ini tidak dapat dibatalkan.")) {
      localStorage.clear();
      history.push("/login");
    }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="dashboard-main">
        <div className="profile-container">
          {/* Header */}
          <div className="profile-header">
            <button
              onClick={() => history.push("/user/dashboard")}
              className="profile-back-btn"
            >
              ← 
            </button>
            <h1>Pengaturan Profil</h1>
          </div>

          {/* Message Alert */}
          {message && (
            <div className={`profile-message ${message.type}`}>
              {message.text}
            </div>
          )}

          <div className="profile-grid">
            {/* Profile Card */}
            <div className="profile-card">
              <div className="profile-card-header">
                {/* Avatar */}
                <div className="profile-avatar">
                  {profilePhoto ? (
                    <img
                      src={profilePhoto}
                      alt="profile"
                    />
                  ) : (
                    <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  )}
                </div>

                {/* Info */}
                <div className="profile-info">
                  <h3>{formData.name}</h3>
                  <p>{formData.email}</p>
                  <p>{formData.phoneNumber}</p>
                </div>
              </div>
            </div>

            {/* Edit Form */}
            <div className="profile-card">
              <h3 className="profile-card-title">Edit Profil</h3>

              {/* Photo Upload */}
              <div className="profile-form-group">
                <label>Foto Profil</label>
                <div className="profile-form-row">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="profile-file-input"
                  />
                  {profilePhoto && (
                    <button
                      onClick={handleRemovePhoto}
                      className="profile-btn profile-btn-remove"
                    >
                      Hapus
                    </button>
                  )}
                </div>
                {profilePhoto && (
                  <div className="profile-preview">
                    <p>Preview:</p>
                    <img src={profilePhoto} alt="preview" />
                  </div>
                )}
              </div>

              {/* Name */}
              <div className="profile-form-group">
                <label>Nama Lengkap</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={handleInputChange("name")}
                  placeholder="Masukkan nama lengkap"
                  className="profile-text-input"
                />
              </div>

              {/* Email */}
              <div className="profile-form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange("email")}
                  placeholder="Masukkan email"
                  className="profile-text-input"
                />
              </div>

              {/* Phone */}
              <div className="profile-form-group">
                <label>Nomor HP</label>
                <input
                  type="text"
                  value={formData.phoneNumber}
                  onChange={handleInputChange("phoneNumber")}
                  placeholder="Masukkan nomor HP"
                  className="profile-text-input"
                />
              </div>

              {/* Buttons */}
              <div className="profile-action-buttons">
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="profile-btn profile-btn-primary"
                  style={{ opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}
                >
                  {loading ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
                <button
                  onClick={handleReset}
                  className="profile-btn profile-btn-secondary"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* More Options */}
            <div className="profile-card">
              <button
                onClick={handleDeleteAccount}
                className="profile-btn profile-btn-danger"
                style={{ width: "100%", marginBottom: "0.75rem" }}
              >
                Hapus Akun
              </button>
              <button
                onClick={handleLogout}
                className="profile-btn profile-btn-danger"
                style={{ width: "100%" }}
              >
                Keluar
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Profile;
