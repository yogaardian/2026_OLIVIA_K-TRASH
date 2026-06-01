import React, { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";
import "../../css/Dashboard.css";
import "../../css/Profile.css";
import { loadStoredProfile, saveProfile } from "../../config/profileConfig";
import { usersAPI } from "../../services/api";

function ProfilePetugas() {
  const history = useHistory();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phoneNumber: "",
  });
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = () => {
    const stored = loadStoredProfile("petugas");
    setFormData({
      name: stored.name,
      email: stored.email,
      phoneNumber: stored.phoneNumber,
    });
    setProfilePhoto(stored.profilePhoto);
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

      saveProfile("petugas", {
        id: userId,
        name: formData.name,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        profilePhoto,
      });
      if (formData.name) localStorage.setItem('nama', formData.name);
      if (formData.phoneNumber) localStorage.setItem('nomor_hp', formData.phoneNumber);
      setMessage({ type: "success", text: "✓ Profil petugas berhasil disimpan." });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: "danger", text: "Gagal menyimpan profil petugas." });
    } finally {
      setLoading(false);
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
    saveProfile("petugas", {
      name: formData.name,
      email: formData.email,
      phoneNumber: formData.phoneNumber,
      profilePhoto: null,
    });
    setMessage({ type: "info", text: "Foto profil petugas dihapus." });
  };

  const handleReset = () => {
    loadProfile();
    setMessage({ type: "info", text: "Perubahan dibatalkan." });
  };

  const handleLogout = () => {
    ["token", "userId", "nama", "role"].forEach((key) => localStorage.removeItem(key));
    history.push("/login");
  };

  return (
    <div className="dashboard-layout">
      <main className="dashboard-main">
        <div className="profile-container">
          <div className="profile-header">
            <button onClick={() => history.push("/driver/dashboard")} className="profile-back-btn">
              ← 
            </button>
            <h1>Profil Petugas</h1>
          </div>

          {message && (
            <div className={`profile-message ${message.type}`}>
              {message.text}
            </div>
          )}

          <div className="profile-grid">
            <div className="profile-card">
              <div className="profile-card-header">
                <div className="profile-avatar">
                  {profilePhoto ? (
                    <img src={profilePhoto} alt="profile" />
                  ) : (
                    <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  )}
                </div>

                <div className="profile-info">
                  <h3>{formData.name}</h3>
                  <p>{formData.email}</p>
                  <p>{formData.phoneNumber}</p>
                </div>
              </div>
            </div>

            <div className="profile-card">
              <h3 className="profile-card-title">Edit Profil Petugas</h3>

              <div className="profile-form-group">
                <label>Foto Profil</label>
                <div className="profile-form-row">
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="profile-file-input" />
                  {profilePhoto && (
                    <button onClick={handleRemovePhoto} className="profile-btn profile-btn-remove">
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

              <div className="profile-action-buttons">
                <button onClick={handleSave} disabled={loading} className="profile-btn profile-btn-primary">
                  {loading ? "Menyimpan..." : "Simpan"}
                </button>
                <button onClick={handleReset} type="button" className="profile-btn profile-btn-secondary">
                  Batal
                </button>
              </div>
            </div>
          </div>

          <div className="profile-card">
            <button onClick={handleLogout} className="profile-btn profile-btn-danger">
              Logout
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default ProfilePetugas;
