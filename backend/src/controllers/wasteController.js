const db = require('../db');

const parsePagination = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
  const offset = (page - 1) * limit;
  const search = String(query.search || '').trim();
  return { page, limit, offset, search };
};

const buildPagination = (page, limit, totalData) => ({
  page,
  limit,
  totalData,
  totalPages: Math.ceil(totalData / limit),
});

exports.listCategories = async (req, res) => {
  try {
    const { page, limit, offset, search } = parsePagination(req.query);
    const filter = `%${search.toLowerCase()}%`;

    const [data] = await db.query(
      `SELECT id, nama_kategori, deskripsi, created_at, updated_at
       FROM kategori_sampah
       WHERE LOWER(nama_kategori) LIKE ?
       ORDER BY nama_kategori ASC
       LIMIT ? OFFSET ?`,
      [filter, limit, offset]
    );

    const [countRows] = await db.query(
      `SELECT COUNT(*) AS totalData
       FROM kategori_sampah
       WHERE LOWER(nama_kategori) LIKE ?`,
      [filter]
    );

    res.json({
      data,
      pagination: buildPagination(page, limit, countRows[0].totalData),
    });
  } catch (error) {
    console.error('listCategories error', error);
    res.status(500).json({ status: 'error', message: 'Gagal mengambil kategori sampah' });
  }
};

exports.getCategory = async (req, res) => {
  try {
    const categoryId = Number(req.params.id);
    if (!categoryId) {
      return res.status(400).json({ status: 'fail', message: 'Kategori tidak valid' });
    }

    const [rows] = await db.query(
      'SELECT id, nama_kategori, deskripsi, created_at, updated_at FROM kategori_sampah WHERE id = ?',
      [categoryId]
    );

    if (!rows.length) {
      return res.status(404).json({ status: 'fail', message: 'Kategori tidak ditemukan' });
    }

    res.json({ data: rows[0] });
  } catch (error) {
    console.error('getCategory error', error);
    res.status(500).json({ status: 'error', message: 'Gagal membaca kategori sampah' });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const namaKategori = String(req.body.nama_kategori || '').trim();
    const deskripsi = String(req.body.deskripsi || '').trim();

    if (!namaKategori) {
      return res.status(400).json({ status: 'fail', message: 'Nama kategori wajib diisi' });
    }

    const [existing] = await db.query(
      'SELECT id FROM kategori_sampah WHERE LOWER(nama_kategori) = LOWER(?)',
      [namaKategori]
    );

    if (existing.length) {
      return res.status(409).json({ status: 'fail', message: 'Nama kategori sudah digunakan' });
    }

    const [result] = await db.query(
      'INSERT INTO kategori_sampah (nama_kategori, deskripsi) VALUES (?, ?)',
      [namaKategori, deskripsi || null]
    );

    res.status(201).json({
      status: 'success',
      data: { id: result.insertId, nama_kategori: namaKategori, deskripsi },
    });
  } catch (error) {
    console.error('createCategory error', error);
    res.status(500).json({ status: 'error', message: 'Gagal membuat kategori sampah' });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const categoryId = Number(req.params.id);
    const namaKategori = String(req.body.nama_kategori || '').trim();
    const deskripsi = String(req.body.deskripsi || '').trim();

    if (!categoryId) {
      return res.status(400).json({ status: 'fail', message: 'Kategori tidak valid' });
    }
    if (!namaKategori) {
      return res.status(400).json({ status: 'fail', message: 'Nama kategori wajib diisi' });
    }

    const [existing] = await db.query(
      'SELECT id FROM kategori_sampah WHERE LOWER(nama_kategori) = LOWER(?) AND id <> ?',
      [namaKategori, categoryId]
    );
    if (existing.length) {
      return res.status(409).json({ status: 'fail', message: 'Nama kategori sudah digunakan' });
    }

    const [result] = await db.query(
      'UPDATE kategori_sampah SET nama_kategori = ?, deskripsi = ? WHERE id = ?',
      [namaKategori, deskripsi || null, categoryId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'fail', message: 'Kategori tidak ditemukan' });
    }

    res.json({ status: 'success', data: { id: categoryId, nama_kategori: namaKategori, deskripsi } });
  } catch (error) {
    console.error('updateCategory error', error);
    res.status(500).json({ status: 'error', message: 'Gagal memperbarui kategori sampah' });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const categoryId = Number(req.params.id);
    if (!categoryId) {
      return res.status(400).json({ status: 'fail', message: 'Kategori tidak valid' });
    }

    const [result] = await db.query('DELETE FROM kategori_sampah WHERE id = ?', [categoryId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'fail', message: 'Kategori tidak ditemukan' });
    }

    res.json({ status: 'success' });
  } catch (error) {
    console.error('deleteCategory error', error);
    res.status(500).json({ status: 'error', message: 'Gagal menghapus kategori sampah' });
  }
};

exports.listWasteTypes = async (req, res) => {
  try {
    const { page, limit, offset, search } = parsePagination(req.query);
    const filter = `%${search.toLowerCase()}%`;

    const [data] = await db.query(
      `SELECT jt.id, jt.kategori_id, kt.nama_kategori AS kategori, jt.nama_jenis, jt.harga_per_kg, jt.created_at, jt.updated_at
       FROM jenis_sampah jt
       JOIN kategori_sampah kt ON jt.kategori_id = kt.id
       WHERE LOWER(jt.nama_jenis) LIKE ? OR LOWER(kt.nama_kategori) LIKE ?
       ORDER BY kt.nama_kategori ASC, jt.nama_jenis ASC
       LIMIT ? OFFSET ?`,
      [filter, filter, limit, offset]
    );

    const [countRows] = await db.query(
      `SELECT COUNT(*) AS totalData
       FROM jenis_sampah jt
       JOIN kategori_sampah kt ON jt.kategori_id = kt.id
       WHERE LOWER(jt.nama_jenis) LIKE ? OR LOWER(kt.nama_kategori) LIKE ?`,
      [filter, filter]
    );

    res.json({
      data,
      pagination: buildPagination(page, limit, countRows[0].totalData),
    });
  } catch (error) {
    console.error('listWasteTypes error', error);
    res.status(500).json({ status: 'error', message: 'Gagal mengambil jenis sampah' });
  }
};

exports.listWasteTypesByCategory = async (req, res) => {
  try {
    const categoryId = Number(req.params.kategoriId);
    if (!categoryId) {
      return res.status(400).json({ status: 'fail', message: 'Kategori tidak valid' });
    }

    const [categoryRows] = await db.query('SELECT id FROM kategori_sampah WHERE id = ?', [categoryId]);
    if (categoryRows.length === 0) {
      return res.status(404).json({ status: 'fail', message: 'Kategori tidak ditemukan' });
    }

    const { page, limit, offset, search } = parsePagination(req.query);
    const filter = `%${search.toLowerCase()}%`;

    const [data] = await db.query(
      `SELECT jt.id, jt.kategori_id, kt.nama_kategori AS kategori, jt.nama_jenis, jt.harga_per_kg, jt.created_at, jt.updated_at
       FROM jenis_sampah jt
       JOIN kategori_sampah kt ON jt.kategori_id = kt.id
       WHERE jt.kategori_id = ? AND LOWER(jt.nama_jenis) LIKE ?
       ORDER BY jt.nama_jenis ASC
       LIMIT ? OFFSET ?`,
      [categoryId, filter, limit, offset]
    );

    const [countRows] = await db.query(
      `SELECT COUNT(*) AS totalData
       FROM jenis_sampah
       WHERE kategori_id = ? AND LOWER(nama_jenis) LIKE ?`,
      [categoryId, filter]
    );

    res.json({
      data,
      pagination: buildPagination(page, limit, countRows[0].totalData),
    });
  } catch (error) {
    console.error('listWasteTypesByCategory error', error);
    res.status(500).json({ status: 'error', message: 'Gagal mengambil jenis sampah berdasarkan kategori' });
  }
};

exports.getWasteType = async (req, res) => {
  try {
    const typeId = Number(req.params.id);
    if (!typeId) {
      return res.status(400).json({ status: 'fail', message: 'Jenis sampah tidak valid' });
    }

    const [rows] = await db.query(
      `SELECT jt.id, jt.kategori_id, kt.nama_kategori AS kategori, jt.nama_jenis, jt.harga_per_kg, jt.created_at, jt.updated_at
       FROM jenis_sampah jt
       JOIN kategori_sampah kt ON jt.kategori_id = kt.id
       WHERE jt.id = ?`,
      [typeId]
    );

    if (!rows.length) {
      return res.status(404).json({ status: 'fail', message: 'Jenis sampah tidak ditemukan' });
    }

    res.json({ data: rows[0] });
  } catch (error) {
    console.error('getWasteType error', error);
    res.status(500).json({ status: 'error', message: 'Gagal membaca jenis sampah' });
  }
};

exports.createWasteType = async (req, res) => {
  try {
    const kategoriId = Number(req.body.kategori_id);
    const namaJenis = String(req.body.nama_jenis || '').trim();
    const hargaPerKg = Number(req.body.harga_per_kg);

    if (!kategoriId) {
      return res.status(400).json({ status: 'fail', message: 'Kategori wajib dipilih' });
    }
    if (!namaJenis) {
      return res.status(400).json({ status: 'fail', message: 'Nama jenis sampah wajib diisi' });
    }
    if (!Number.isFinite(hargaPerKg) || hargaPerKg <= 0) {
      return res.status(400).json({ status: 'fail', message: 'Harga per Kg harus angka positif' });
    }

    const [categoryRows] = await db.query('SELECT id FROM kategori_sampah WHERE id = ?', [kategoriId]);
    if (!categoryRows.length) {
      return res.status(404).json({ status: 'fail', message: 'Kategori tidak ditemukan' });
    }

    const [existing] = await db.query(
      'SELECT id FROM jenis_sampah WHERE kategori_id = ? AND LOWER(nama_jenis) = LOWER(?)',
      [kategoriId, namaJenis]
    );
    if (existing.length) {
      return res.status(409).json({ status: 'fail', message: 'Jenis sampah untuk kategori ini sudah ada' });
    }

    const [result] = await db.query(
      'INSERT INTO jenis_sampah (kategori_id, nama_jenis, harga_per_kg) VALUES (?, ?, ?)',
      [kategoriId, namaJenis, hargaPerKg]
    );

    res.status(201).json({
      status: 'success',
      data: { id: result.insertId, kategori_id: kategoriId, nama_jenis: namaJenis, harga_per_kg: hargaPerKg },
    });
  } catch (error) {
    console.error('createWasteType error', error);
    res.status(500).json({ status: 'error', message: 'Gagal membuat jenis sampah' });
  }
};

exports.updateWasteType = async (req, res) => {
  try {
    const typeId = Number(req.params.id);
    const kategoriId = Number(req.body.kategori_id);
    const namaJenis = String(req.body.nama_jenis || '').trim();
    const hargaPerKg = Number(req.body.harga_per_kg);

    if (!typeId) {
      return res.status(400).json({ status: 'fail', message: 'Jenis sampah tidak valid' });
    }
    if (!kategoriId) {
      return res.status(400).json({ status: 'fail', message: 'Kategori wajib dipilih' });
    }
    if (!namaJenis) {
      return res.status(400).json({ status: 'fail', message: 'Nama jenis sampah wajib diisi' });
    }
    if (!Number.isFinite(hargaPerKg) || hargaPerKg <= 0) {
      return res.status(400).json({ status: 'fail', message: 'Harga per Kg harus angka positif' });
    }

    const [categoryRows] = await db.query('SELECT id FROM kategori_sampah WHERE id = ?', [kategoriId]);
    if (!categoryRows.length) {
      return res.status(404).json({ status: 'fail', message: 'Kategori tidak ditemukan' });
    }

    const [existing] = await db.query(
      'SELECT id FROM jenis_sampah WHERE kategori_id = ? AND LOWER(nama_jenis) = LOWER(?) AND id <> ?',
      [kategoriId, namaJenis, typeId]
    );
    if (existing.length) {
      return res.status(409).json({ status: 'fail', message: 'Jenis sampah untuk kategori ini sudah ada' });
    }

    const [result] = await db.query(
      'UPDATE jenis_sampah SET kategori_id = ?, nama_jenis = ?, harga_per_kg = ? WHERE id = ?',
      [kategoriId, namaJenis, hargaPerKg, typeId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'fail', message: 'Jenis sampah tidak ditemukan' });
    }

    res.json({ status: 'success', data: { id: typeId, kategori_id: kategoriId, nama_jenis: namaJenis, harga_per_kg: hargaPerKg } });
  } catch (error) {
    console.error('updateWasteType error', error);
    res.status(500).json({ status: 'error', message: 'Gagal memperbarui jenis sampah' });
  }
};

exports.deleteWasteType = async (req, res) => {
  try {
    const typeId = Number(req.params.id);
    if (!typeId) {
      return res.status(400).json({ status: 'fail', message: 'Jenis sampah tidak valid' });
    }

    const [result] = await db.query('DELETE FROM jenis_sampah WHERE id = ?', [typeId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'fail', message: 'Jenis sampah tidak ditemukan' });
    }

    res.json({ status: 'success' });
  } catch (error) {
    console.error('deleteWasteType error', error);
    res.status(500).json({ status: 'error', message: 'Gagal menghapus jenis sampah' });
  }
};
