const db = require('../db');
const transactionService = require('../services/transactionService');

exports.updateLocation = async (req, res) => {
  const driverId = Number(req.body.driver_id || req.user?.id);
  const order_id = Number(req.body.order_id);
  const lat = req.body.lat;
  const lng = req.body.lng;

  if (!driverId || !order_id || lat == null || lng == null) {
    return res.status(400).json({ status: 'fail', message: 'driver_id, order_id, lat, lng wajib diisi' });
  }

  if (!req.user || req.user.id !== driverId) {
    return res.status(403).json({ status: 'fail', message: 'Driver tidak sesuai atau tidak terautentikasi' });
  }

  const [order] = await db.query(
    'SELECT status FROM orders WHERE id = ?',
    [order_id]
  );

  if (!order.length || !['assigned', 'on_the_way'].includes(order[0].status)) {
    return res.status(400).json({ status: 'fail', message: 'Order belum aktif' });
  }

  await db.query(`
    INSERT INTO driver_locations (driver_id, order_id, lat, lng)
    VALUES (?, ?, ?, ?)
  `, [driverId, order_id, lat, lng]);

  res.json({ status: 'success', message: 'Lokasi tersimpan' });
};

exports.acceptOrder = async (req, res) => {
  const driverId = Number(req.body.driver_id || req.user?.id);
  const orderId = Number(req.params.id);

  if (!orderId || !driverId) {
    return res.status(400).json({ status: 'fail', message: 'Order id atau driver id tidak valid' });
  }

  if (!req.user || req.user.id !== driverId) {
    return res.status(403).json({ status: 'fail', message: 'Driver tidak sesuai atau tidak terautentikasi' });
  }

  const [result] = await db.query(`
    UPDATE orders
    SET driver_id = ?, status = 'assigned'
    WHERE id = ? AND status = 'pending'
  `, [driverId, orderId]);

  if (result.affectedRows === 0) {
    return res.status(400).json({ status: 'fail', message: 'Order sudah diambil' });
  }

  res.json({ status: 'success', message: 'Berhasil ambil order' });
};

exports.rejectOrder = async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const driverId = Number(req.body.driver_id || req.body.user_id || req.user?.id);

    if (!orderId || !driverId) {
      return res.status(400).json({ status: 'fail', message: 'order_id atau driver_id tidak valid' });
    }

    if (!req.user || req.user.id !== driverId) {
      return res.status(403).json({ status: 'fail', message: 'Driver tidak sesuai atau tidak terautentikasi' });
    }

    if (!['driver', 'petugas'].includes(req.user.role)) {
      return res.status(403).json({ status: 'fail', message: 'Hanya driver atau petugas yang dapat menolak order' });
    }

    // Check if order exists
    const [orders] = await db.query('SELECT id FROM orders WHERE id = ?', [orderId]);
    if (!orders.length) {
      return res.status(404).json({ status: 'fail', message: 'Order tidak ditemukan' });
    }

    // Check existing rejection
    const [existing] = await db.query(
      `SELECT id FROM driver_rejected_orders WHERE driver_id = ? AND order_id = ?`,
      [driverId, orderId]
    );

    if (existing.length > 0) {
      return res.json({ status: 'success', message: 'Order sudah pernah ditolak' });
    }

    await db.query(
      `INSERT INTO driver_rejected_orders (driver_id, order_id) VALUES (?, ?)`,
      [driverId, orderId]
    );

    res.json({ status: 'success', message: 'Order berhasil ditolak' });
  } catch (err) {
    console.error('Error rejecting order:', err);
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.json({ status: 'success', message: 'Order sudah pernah ditolak' });
    }
    res.status(500).json({ status: 'error', message: 'Gagal menolak order' });
  }
};

exports.getTracking = async (req, res) => {
  try {
    const orderId = Number(req.params.order_id);
    if (!orderId) {
      return res.status(400).json({ status: 'fail', message: 'Order id tidak valid' });
    }

    const [orderResult] = await db.query(
      'SELECT id, user_id, driver_id, status, user_lat, user_lng, address FROM orders WHERE id = ?',
      [orderId]
    );

    if (orderResult.length === 0) {
      return res.status(404).json({ status: 'fail', message: 'Order tidak ditemukan' });
    }

    const order = orderResult[0];

    const [locations] = await db.query(
      `SELECT lat, lng, created_at
       FROM driver_locations
       WHERE order_id = ?
       ORDER BY created_at ASC`,
      [orderId]
    );

    const [driverRows] = order.driver_id
      ? await db.query('SELECT nama, nomor_hp, profile_photo FROM users WHERE id = ?', [order.driver_id])
      : [[]];

    const driverInfo = driverRows[0] || {};
    const latestDriverLocation = locations.length ? locations[locations.length - 1] : null;

    res.json({
      status: 'success',
      order_status: order.status,
      driver_id: order.driver_id,
      driver_name: driverInfo.nama || 'Petugas',
      driver_phone: driverInfo.nomor_hp || '-',
      driver_photo: driverInfo.profile_photo || null,
      user_lat: order.user_lat != null ? Number(order.user_lat) : null,
      user_lng: order.user_lng != null ? Number(order.user_lng) : null,
      address: order.address,
      driver_lat: latestDriverLocation ? Number(latestDriverLocation.lat) : null,
      driver_lng: latestDriverLocation ? Number(latestDriverLocation.lng) : null,
      locations,
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
};

exports.completeOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { driver_id, status, sampah_data, total_berat, total_harga } = req.body;

    if (status !== 'completed') {
      return res.status(400).json({ message: 'Status harus completed' });
    }

    if (!total_harga || total_harga <= 0) {
      return res.status(400).json({ message: 'Total harga harus lebih dari 0' });
    }

    // Get order details including user_id
    const [orders] = await db.query(
      'SELECT user_id FROM orders WHERE id = ?',
      [orderId]
    );

    if (!orders.length) {
      return res.status(404).json({ message: 'Order tidak ditemukan' });
    }

    const userId = orders[0].user_id;

    // Update order status to completed with sampah data
    await db.query(
      `UPDATE orders 
       SET status = ?, driver_id = ?, sampah_data = ?, total_berat = ?, total_harga = ?
       WHERE id = ?`,
      ['completed', driver_id, JSON.stringify(sampah_data), total_berat, total_harga, orderId]
    );

    // Create pending transaction for admin approval
    const description = `Penimbangan sampah: ${total_berat}kg, Harga: Rp${total_harga}`;
    const transactionId = await transactionService.createPendingTransaction(
      userId,
      orderId,
      total_harga,
      description,
      driver_id
    );

    res.json({
      status: 'success',
      message: 'Data sampah berhasil dikirim ke admin untuk konfirmasi',
      transaction_id: transactionId,
      order_id: orderId
    });

  } catch (error) {
    console.error('Error completing order:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Server error'
    });
  }
};