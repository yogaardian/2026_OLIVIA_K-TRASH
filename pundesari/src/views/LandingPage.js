import React from "react";
// Ganti useNavigate menjadi useHistory untuk React Router v5
import { useHistory } from "react-router-dom";
import "./landingpage.css";

// Pastikan path ini sesuai dengan struktur folder src Anda
import HeroImage from "../assets/hero.png";
import Logo from "../assets/LogoK-Trash.png";

const LandingPage = () => {
  // Inisialisasi history
  const history = useHistory();
  const [activeNav, setActiveNav] = React.useState("beranda");
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  // Scroll to element
  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setActiveNav(id);
      setMobileMenuOpen(false);
    }
  };

  return (
    <div className="landing-page">
      {/* NAVBAR */}
      <nav className="navbar">
        <div className="navbar-container">
          <div className="logo-wrapper" onClick={() => scrollToSection("beranda")} style={{cursor: "pointer"}}>
            <img src={Logo} alt="logo" className="logo-img" />
            <h1 className="logo-text">K-Trash</h1>
          </div>

          <button
            type="button"
            className={`hamburger-btn ${mobileMenuOpen ? "open" : ""}`}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle navigation"
          >
            <span />
            <span />
            <span />
          </button>

          <ul className={`nav-menu ${mobileMenuOpen ? "open" : ""}`}>
            <li className={activeNav === "beranda" ? "active" : ""} onClick={() => scrollToSection("beranda")}>Beranda</li>
            <li className={activeNav === "fitur" ? "active" : ""} onClick={() => scrollToSection("fitur")}>Fitur</li>
            <li className={activeNav === "cara-kerja" ? "active" : ""} onClick={() => scrollToSection("cara-kerja")}>Cara Kerja</li>
            <li className={activeNav === "tentang-kami" ? "active" : ""} onClick={() => scrollToSection("tentang-kami")}>Tentang Kami</li>
            <li className={activeNav === "kontak" ? "active" : ""} onClick={() => scrollToSection("kontak")}>Kontak</li>
            <li className="mobile-login-item">
              <button className="mobile-login-btn" onClick={() => { setMobileMenuOpen(false); history.push("/login"); }}>
                Masuk / Daftar
              </button>
            </li>
          </ul>

          {/* Gunakan history.push untuk pindah ke halaman login */}
          <button className="login-btn desktop-login-btn" onClick={() => history.push("/login")}>
            <span className="login-icon"></span> Masuk / Daftar
          </button>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="hero-section" id="beranda">
        <div className="hero-left">
          <div className="badge">🌱 Solusi Cerdas untuk Lingkungan Bersih</div>

          <h1 className="hero-title">
            Kelola Sampah,
            <br />
            Jadi Lebih Mudah,
            <br />
            <span>Bermanfaat,</span>
            <br />
            <span>dan Berkelanjutan</span>
          </h1>

          <p className="hero-description">
            K-Trash membantu Anda mengelola sampah dengan praktis. Pantau saldo,
            request jemput, dan lihat harga sampah dengan transparan.
          </p>

          <div className="hero-buttons">
            <button className="primary-btn" onClick={() => history.push("/login")}>
              Mulai Sekarang →
            </button>
            <button className="secondary-btn" onClick={() => history.push("/login")}>
              Pelajari Lebih Lanjut
            </button>
          </div>

          <div className="hero-features">
            <div className="feature-item">
              <div className="feature-icon">💰</div>
              <p>Saldo Aman &amp; Transparan</p>
            </div>
            <div className="feature-item">
              <div className="feature-icon">🚛</div>
              <p>Jemput Sampah Cepat &amp; Mudah</p>
            </div>
            <div className="feature-item">
              <div className="feature-icon">🏷️</div>
              <p>Harga Jelas per Kg</p>
            </div>
          </div>
        </div>

        <div className="hero-right">
          <img src={HeroImage} alt="Hero" className="hero-image" />
        </div>
      </section>

      {/* FITUR UTAMA */}
      <section className="feature-section" id="fitur">
        <div className="section-title">
          <span className="section-badge">FITUR UTAMA</span>
          <h2>
            Semua yang Anda Butuhkan
            <br />
            dalam Satu Genggaman
          </h2>
        </div>

        <div className="feature-cards">
          <div className="feature-card">
            <div className="card-icon-wrap">
              <span className="card-icon">💳</span>
            </div>
            <h3>1. Lihat Saldo</h3>
            <p>
              Pantau saldo Anda secara real-time setiap saat. Transaksi aman dan
              riwayat jelas.
            </p>
            <button className="card-btn" onClick={() => history.push("/login")}>
              Lihat Saldo
            </button>
          </div>

          <div className="feature-card">
            <div className="card-icon-wrap">
              <span className="card-icon">🚛</span>
            </div>
            <h3>2. Request Jemput Sampah</h3>
            <p>
              Ajukan penjemputan dengan mudah. Pilih jadwal, jenis sampah, dan
              lokasi Anda.
            </p>
            <button className="card-btn" onClick={() => history.push("/login")}>
              Request Jemput
            </button>
          </div>

          <div className="feature-card">
            <div className="card-icon-wrap">
              <span className="card-icon">🏷️</span>
            </div>
            <h3>3. Harga Sampah per Kg</h3>
            <p>
              Lihat daftar harga terbaru per kg. Transparan dan selalu
              diperbarui.
            </p>
            <button className="card-btn" onClick={() => history.push("/login")}>
              Lihat Harga
            </button>
          </div>
        </div>
      </section>

      {/* CARA KERJA */}
      <section className="work-section" id="cara-kerja">
        <div className="work-header">
          <span className="section-badge">ALUR SISTEM</span>
          <h2>Bagaimana K-Trash Bekerja?</h2>
          <p>Proses pengelolaan sampah menjadi mudah dengan alur sistem yang transparan</p>
        </div>

        <div className="work-steps">
          <div className="step">
            <div className="step-number">1</div>
            <div className="step-illustration">
              <span className="step-emoji">👤</span>
            </div>
            <h4>Daftar & Login</h4>
            <p>Buat akun Anda dengan mudah dan login ke platform K-Trash</p>
          </div>

          <div className="step-arrow">→</div>

          <div className="step">
            <div className="step-number">2</div>
            <div className="step-illustration">
              <span className="step-emoji">🗑️</span>
            </div>
            <h4>Siapkan Sampah</h4>
            <p>Kumpulkan dan kelompokkan sampah Anda sesuai jenis (plastik, kertas, logam)</p>
          </div>

          <div className="step-arrow">→</div>

          <div className="step">
            <div className="step-number">3</div>
            <div className="step-illustration">
              <span className="step-emoji">📱</span>
            </div>
            <h4>Request Jemput</h4>
            <p>Ajukan permintaan penjemputan melalui aplikasi dengan jadwal pilihan Anda</p>
          </div>

          <div className="step-arrow">→</div>

          <div className="step">
            <div className="step-number">4</div>
            <div className="step-illustration">
              <span className="step-emoji">🚛</span>
            </div>
            <h4>Tunggu Penjemput</h4>
            <p>Driver kami akan menjemput sampah di lokasi Anda sesuai jadwal yang disepakati</p>
          </div>

          <div className="step-arrow">→</div>

          <div className="step">
            <div className="step-number">5</div>
            <div className="step-illustration">
              <span className="step-emoji">⚖️</span>
            </div>
            <h4>Timbang & Bayar</h4>
            <p>Sampah ditimbang dan Anda mendapat kompensasi sesuai harga per kg</p>
          </div>

          <div className="step-arrow">→</div>

          <div className="step">
            <div className="step-number">6</div>
            <div className="step-illustration">
              <span className="step-emoji">💰</span>
            </div>
            <h4>Saldo Masuk</h4>
            <p>Dana langsung masuk ke saldo akun Anda dan siap untuk dicairkan</p>
          </div>
        </div>
      </section>

      {/* TENTANG KAMI */}
      <section className="about-section" id="tentang-kami">
        <div className="about-container">
          <div className="about-left">
            <span className="section-badge">TENTANG KAMI</span>
            <h2>Bergabung dalam Revolusi Pengelolaan Sampah</h2>
            <p>K-Trash lahir dari komitmen untuk menciptakan solusi praktis dalam mengelola sampah sambil memberikan manfaat ekonomi kepada masyarakat. Kami percaya bahwa pengelolaan sampah yang baik adalah investasi untuk lingkungan yang lebih sehat.</p>
            
            <div className="about-features">
              <div className="about-feature">
                <span className="feature-check">✓</span>
                <div>
                  <h4>Transparan & Aman</h4>
                  <p>Semua transaksi tercatat jelas dan aman dalam sistem kami</p>
                </div>
              </div>
              <div className="about-feature">
                <span className="feature-check">✓</span>
                <div>
                  <h4>Ramah Lingkungan</h4>
                  <p>Mendukung program daur ulang dan pengurangan limbah</p>
                </div>
              </div>
              <div className="about-feature">
                <span className="feature-check">✓</span>
                <div>
                  <h4>Komunitas Aktif</h4>
                  <p>Bergabung dengan ribuan pengguna yang peduli lingkungan</p>
                </div>
              </div>
              <div className="about-feature">
                <span className="feature-check">✓</span>
                <div>
                  <h4>Support 24/7</h4>
                  <p>Tim kami siap membantu Anda kapan saja</p>
                </div>
              </div>
            </div>
          </div>

          <div className="about-right">
            <div className="about-card">
              <div className="stat-number">50K+</div>
              <div className="stat-text">Pengguna Aktif</div>
            </div>
            <div className="about-card">
              <div className="stat-number">1000T</div>
              <div className="stat-text">Sampah Terolah</div>
            </div>
            <div className="about-card">
              <div className="stat-number">100%</div>
              <div className="stat-text">Transparan</div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer" id="kontak">
        <div className="footer-grid">
          <div className="footer-brand">
            <div className="logo-wrapper">
              <img src={Logo} alt="logo" className="logo-img" />
              <h1 className="logo-text">K-Trash</h1>
            </div>
            <p className="footer-text">
              Platform digital untuk pengelolaan sampah yang lebih efisien,
              transparan, dan berkelanjutan.
            </p>
            <div className="footer-socials">
              <span className="social-icon" title="Facebook">📘</span>
              <span className="social-icon" title="Instagram">📸</span>
              <span className="social-icon" title="Twitter">🐦</span>
              <span className="social-icon" title="YouTube">▶️</span>
            </div>
          </div>

          <div>
            <h3>Menu</h3>
            <ul>
              <li onClick={() => scrollToSection("beranda")}>Beranda</li>
              <li onClick={() => scrollToSection("fitur")}>Fitur</li>
              <li onClick={() => scrollToSection("cara-kerja")}>Cara Kerja</li>
              <li onClick={() => scrollToSection("tentang-kami")}>Tentang Kami</li>
              <li onClick={() => scrollToSection("kontak")}>Kontak</li>
            </ul>
          </div>

          <div>
            <h3>Lainnya</h3>
            <ul>
              <li onClick={() => alert("Halaman FAQ sedang dikembangkan")}>FAQ</li>
              <li onClick={() => alert("Halaman Kebijakan Privasi sedang dikembangkan")}>Kebijakan Privasi</li>
              <li onClick={() => alert("Halaman Syarat & Ketentuan sedang dikembangkan")}>Syarat &amp; Ketentuan</li>
            </ul>
          </div>

          <div>
            <h3>Kontak Kami</h3>
            <ul className="contact-list">
              <li>
                <span className="contact-icon">📍</span> <span>Jl. Green City No. 123, Surabaya, Indonesia</span>
              </li>
              <li>
                <span className="contact-icon">✉️</span> <a href="mailto:info@ktrash.id">info@ktrash.id</a>
              </li>
              <li>
                <span className="contact-icon">📞</span> <a href="tel:+6281234567890">0812-3456-7890</a>
              </li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
