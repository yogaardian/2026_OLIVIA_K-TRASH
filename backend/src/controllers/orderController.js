const db = require('../db');
const transactionService = require('../services/transactionService');
const socketService = require('../services/socketService');
const socketEvents = require('../constants/socketEvents');

exports.updateLocation = async (req, res) => {
  const { driver_id, order_id, lat, lng } = req.body;

  const [order] = await db.query(
    'SELECT status FROM orders WHERE id = ?',
    [order_id]
  );

  if (!order.length || !['assigned', 'on_the_way'].includes(order[0].status)) {
    return res.json({ message: 'Order belum aktif' });
  }

  await db.query(`
    INSERT INTO driver_locations (driver_id, order_id, lat, lng)
    VALUES (?, ?, ?, ?)
  `, [driver_id, order_id, lat, lng]);

  res.json({ message: 'Lokasi tersimpan' });
};

exports.acceptOrder = async (req, res) => {
  const { driver_id } = req.body;
  const orderId = req.params.id;

  const [result] = await db.query(`
    UPDATE orders
    SET driver_id = ?, status = 'assigned'
    WHERE id = ? AND status = 'pending'
  `, [driver_id, orderId]);

  if (result.affectedRows === 0) {
    return res.status(400).json({ message: 'Order sudah diambil' });
  }

  res.json({ message: 'Berhasil ambil order' });
};

exports.cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const [orders] = await db.query('SELECT status FROM orders WHERE id = ?', [orderId]);

    if (!orders.length) {
      return res.status(404).json({ message: 'Order tidak ditemukan' });
    }

    const currentStatus = orders[0].status;
    if (currentStatus === 'cancelled') {
      return res.status(400).json({ message: 'Order sudah dibatalkan' });
    }

    if (currentStatus === 'completed') {
      return res.status(400).json({ message: 'Order sudah selesai dan tidak dapat dibatalkan' });
    }

    await db.query(
      `UPDATE orders SET status = 'cancelled' WHERE id = ? AND status NOT IN ('completed', 'cancelled')`,
      [orderId]
    );

    socketService.emitToOrder(orderId, socketEvents.SERVER.ORDER_STATE, {
      order: { id: orderId, status: 'cancelled' },
    });
    socketService.emitToOrder(orderId, socketEvents.SERVER.ORDER_STATUS_CHANGED, {
      orderId,
      status: 'cancelled',
    });

    res.json({ status: 'success', message: 'Order berhasil dibatalkan' });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ status: 'error', message: 'Gagal batalkan order' });
  }
};

exports.rejectOrder = async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const driverId = parseInt(req.body.driver_id || req.body.user_id || req.user?.id);

    if (!orderId || !driverId) {
      return res.status(400).json({ status: 'fail', message: 'order_id atau driver_id tidak valid' });
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
    const { order_id } = req.params;

    const [locations] = await db.query(`
      SELECT *
      FROM driver_locations
      WHERE order_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `, [order_id]);

    if (!locations.length) {
      return res.status(404).json({
        message: 'Lokasi tidak ditemukan'
      });
    }

    res.json(locations[0]);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: 'Server error'
    });
  }
};

exports.completeOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { driver_id, status, sampah_data, total_berat, total_harga } = req.body;

    const allowedStatuses = ['on_the_way', 'arrived', 'completed'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Status tidak valid' });
    }

    const [orders] = await db.query(
      'SELECT user_id FROM orders WHERE id = ?',
      [orderId]
    );

    if (!orders.length) {
      return res.status(404).json({ message: 'Order tidak ditemukan' });
    }

    const userId = orders[0].user_id;

    if (status === 'completed') {
      if (!total_harga || total_harga <= 0) {
        return res.status(400).json({ message: 'Total harga harus lebih dari 0' });
      }

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

      return res.json({
        status: 'success',
        message: 'Data sampah berhasil dikirim ke admin untuk konfirmasi',
        transaction_id: transactionId,
        order_id: orderId
      });
    }

    const [result] = await db.query(
      `UPDATE orders
       SET status = ?, driver_id = ?
       WHERE id = ?`,
      [status, driver_id, orderId]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ status: 'fail', message: 'Gagal update status order' });
    }

    res.json({ status: 'success', message: `Status order diperbarui menjadi ${status}` });

  } catch (error) {
    console.error('Error completing order:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Server error'
    });
  }
};