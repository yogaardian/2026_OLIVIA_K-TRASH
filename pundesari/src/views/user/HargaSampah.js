import React, { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar.jsx";
import TopbarUserProfile from "../../components/TopbarUserProfile";
import "../../css/Dashboard.css";
import "../../css/HargaSampah.css";
import { wasteAPI } from "../../services/api";

const HargaSampah = () => {
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [hargaList, setHargaList] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadCategories = async () => {
    setLoadingCategories(true);
    setErrorMessage("");
    try {
      const response = await wasteAPI.listCategories({ page: 1, limit: 50, search: "" });
      const data = response.data.data || [];
      setCategories(data);
      if (data.length > 0) {
        setSelectedCategoryId(String(data[0].id));
      }
    } catch (err) {
      console.error("Gagal memuat kategori:", err);
      setErrorMessage("Gagal memuat kategori sampah dari server.");
    } finally {
      setLoadingCategories(false);
    }
  };

  const loadPrices = async (categoryId) => {
    if (!categoryId) {
      setHargaList([]);
      return;
    }

    setLoadingPrices(true);
    setErrorMessage("");
    try {
      const response = await wasteAPI.listWasteTypesByCategory(categoryId, { page: 1, limit: 100, search: "" });
      setHargaList(response.data.data || []);
    } catch (err) {
      console.error("Gagal memuat harga sampah:", err);
      setErrorMessage("Gagal memuat daftar harga dari server.");
      setHargaList([]);
    } finally {
      setLoadingPrices(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (selectedCategoryId) {
      loadPrices(selectedCategoryId);
    }
  }, [selectedCategoryId]);

  const selectedCategory = categories.find((item) => String(item.id) === String(selectedCategoryId));

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="dashboard-main">
        <header className="topbar">
          <div></div>
          <div className="topbar-right">
            <TopbarUserProfile />
          </div>
        </header>

        <div className="dashboard-content">
          <div className="harga-header">
            <div className="header-text">
              <h1>Daftar Harga Sampah</h1>
              <p>Lihat harga terkini untuk setiap jenis sampah yang bisa kami terima</p>
            </div>
          </div>

          <div className="kategori-filter">
            {loadingCategories ? (
              <button className="filter-btn active" type="button" disabled>
                Memuat kategori...
              </button>
            ) : categories.length === 0 ? (
              <p className="text-center">Belum ada kategori sampah tersedia.</p>
            ) : (
              categories.map((kategori) => (
                <button
                  key={kategori.id}
                  type="button"
                  className={`filter-btn ${String(selectedCategoryId) === String(kategori.id) ? "active" : ""}`}
                  onClick={() => setSelectedCategoryId(String(kategori.id))}
                >
                  {kategori.nama_kategori}
                </button>
              ))
            )}
          </div>

          <div className="harga-grid">
            {errorMessage ? (
              <p className="text-center text-danger">{errorMessage}</p>
            ) : loadingPrices ? (
              <p className="text-center">Memuat data...</p>
            ) : hargaList.length === 0 ? (
              <p className="text-center">Data tidak ditemukan</p>
            ) : (
              hargaList.map((item) => (
                <div key={item.id} className="harga-card">
                  <div className="harga-card-icon">🗂️</div>
                  <div className="harga-card-info">
                    <h4>{item.nama_jenis}</h4>
                    <p className="harga-price">Rp {Number(item.harga_per_kg).toLocaleString()} / kg</p>
                    {selectedCategory && (
                      <small className="text-muted">Kategori: {selectedCategory.nama_kategori}</small>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default HargaSampah;
