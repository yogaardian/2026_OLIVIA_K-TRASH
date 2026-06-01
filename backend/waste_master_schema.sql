-- Master data schema for kategori sampah and jenis sampah

CREATE TABLE IF NOT EXISTS kategori_sampah (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nama_kategori VARCHAR(100) NOT NULL UNIQUE,
  deskripsi TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS jenis_sampah (
  id INT AUTO_INCREMENT PRIMARY KEY,
  kategori_id INT NOT NULL,
  nama_jenis VARCHAR(150) NOT NULL,
  harga_per_kg INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_jenis_per_kategori (kategori_id, nama_jenis),
  INDEX idx_kategori_id (kategori_id),
  CONSTRAINT fk_jenis_kategori FOREIGN KEY (kategori_id)
    REFERENCES kategori_sampah(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);
