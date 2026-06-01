const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const marketplaceService = require('../services/marketplaceService');

// Public routes
router.get('/products', async (req, res) => {
  try {
    const { kategori, search } = req.query;
    const products = await marketplaceService.getProducts({ kategori, search });
    res.json(products);
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/products/:id', async (req, res) => {
  try {
    const product = await marketplaceService.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (err) {
    console.error('Get product error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// User routes (authenticated)
router.use(authenticateToken);

router.post('/products/:id/order', requireRole(['user']), async (req, res) => {
  const { id } = req.params;
  const { jumlah, catatan } = req.body;
  const userId = req.user.id;

  if (!jumlah || jumlah < 1) {
    return res.status(400).json({ message: 'Valid quantity required' });
  }

  try {
    const result = await marketplaceService.createProductOrder(userId, id, jumlah, catatan);
    res.json({
      message: 'Order created successfully',
      orderId: result.orderId,
      totalHarga: result.totalHarga,
      newBalance: result.newBalance
    });
  } catch (err) {
    console.error('Create order error:', err);
    // Map known error messages to appropriate HTTP status codes for client clarity
    const msg = String(err.message || 'Internal server error');
    let status = 400;
    if (msg.includes('Product not found')) status = 404;
    else if (msg.includes('Insufficient stock') || msg.includes('stok')) status = 409;
    else if (msg.includes('User not found')) status = 404;
    else if (msg.includes('Insufficient balance')) status = 402;
    else if (msg.includes('Stock tidak mencukupi')) status = 409;

    // log full stack when available
    if (err.stack) console.error(err.stack);

    return res.status(status).json({ message: msg });
  }
});

router.get('/user/orders', requireRole(['user']), async (req, res) => {
  try {
    const { status, limit, offset } = req.query;
    const orders = await marketplaceService.getUserPurchaseHistory(req.user.id, {
      status,
      limit: Math.min(parseInt(limit) || 50, 100),
      offset: parseInt(offset) || 0
    });
    res.json({
      status: 'success',
      count: orders.length,
      data: orders
    });
  } catch (err) {
    console.error('Get user orders error:', err);
    res.status(500).json({
      status: 'error',
      message: err.message || 'Internal server error'
    });
  }
});

/**
 * GET /marketplace/user/purchases - Get detailed purchase history (user)
 */
router.get('/user/purchases', requireRole(['user']), async (req, res) => {
  try {
    const orders = await marketplaceService.getUserPurchaseHistory(req.user.id);
    res.json({
      status: 'success',
      count: orders.length,
      data: orders
    });
  } catch (err) {
    console.error('Get purchase history error:', err);
    res.status(500).json({
      status: 'error',
      message: err.message || 'Internal server error'
    });
  }
});

// Admin routes
router.post('/products', requireRole(['admin']), async (req, res) => {
  const { nama, deskripsi, harga, kategori, stok, gambar } = req.body;

  if (!nama || !harga || !kategori) {
    return res.status(400).json({ message: 'Name, price, and category required' });
  }

  try {
    const productId = await marketplaceService.createProduct(req.body, req.user.id);
    res.status(201).json({
      message: 'Product created successfully',
      productId
    });
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/products/:id', requireRole(['admin']), async (req, res) => {
  try {
    await marketplaceService.updateProduct(req.params.id, req.body);
    res.json({ message: 'Product updated successfully' });
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/products/:id', requireRole(['admin']), async (req, res) => {
  try {
    await marketplaceService.deleteProduct(req.params.id);
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/orders', requireRole(['admin']), async (req, res) => {
  try {
    const orders = await marketplaceService.getAllProductOrders();
    res.json(orders);
  } catch (err) {
    console.error('Get all orders error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.patch('/orders/:id/status', requireRole(['admin']), async (req, res) => {
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({
      status: 'error',
      message: 'Status required'
    });
  }

  try {
    await marketplaceService.updateProductOrderStatus(req.params.id, status, req.user.id);
    res.json({
      status: 'success',
      message: 'Order status updated successfully'
    });
  } catch (err) {
    console.error('Update order status error:', err);
    res.status(400).json({
      status: 'error',
      message: err.message
    });
  }
});

/**
 * GET /marketplace/admin/orders/pending - Get pending orders (admin)
 */
router.get('/admin/orders/pending', requireRole(['admin']), async (req, res) => {
  try {
    const { limit, offset } = req.query;
    const orders = await marketplaceService.getPendingOrders({
      limit: Math.min(parseInt(limit) || 50, 100),
      offset: parseInt(offset) || 0
    });

    res.json({
      status: 'success',
      count: orders.length,
      data: orders
    });
  } catch (err) {
    console.error('Get pending orders error:', err);
    res.status(500).json({
      status: 'error',
      message: err.message || 'Internal server error'
    });
  }
});

/**
 * GET /marketplace/admin/orders/:id - Get single order details (admin)
 */
router.get('/admin/orders/:id', requireRole(['admin']), async (req, res) => {
  try {
    const order = await marketplaceService.getProductOrder(req.params.id);

    res.json({
      status: 'success',
      data: order
    });
  } catch (err) {
    console.error('Get order detail error:', err);
    res.status(400).json({
      status: 'error',
      message: err.message
    });
  }
});

/**
 * POST /marketplace/admin/orders/:id/complete - Mark order as completed (admin)
 */
router.post('/admin/orders/:id/complete', requireRole(['admin']), async (req, res) => {
  try {
    await marketplaceService.completeProductOrder(req.params.id, req.user.id);

    const order = await marketplaceService.getProductOrder(req.params.id);

    res.json({
      status: 'success',
      message: 'Order completed successfully',
      data: order
    });
  } catch (err) {
    console.error('Complete order error:', err);
    res.status(400).json({
      status: 'error',
      message: err.message
    });
  }
});

/**
 * POST /marketplace/admin/orders/:id/cancel - Cancel order (admin)
 * Body: { reason }
 */
router.post('/admin/orders/:id/cancel', requireRole(['admin']), async (req, res) => {
  try {
    const { reason } = req.body;

    const result = await marketplaceService.cancelProductOrder(
      req.params.id,
      req.user.id,
      reason || 'Admin cancellation'
    );

    res.json({
      status: 'success',
      message: 'Order cancelled and refunded successfully',
      data: result
    });
  } catch (err) {
    console.error('Cancel order error:', err);
    res.status(400).json({
      status: 'error',
      message: err.message
    });
  }
});

/**
 * POST /marketplace/admin/orders/:id/refund - Refund order (admin)
 * Body: { reason }
 */
router.post('/admin/orders/:id/refund', requireRole(['admin']), async (req, res) => {
  try {
    const { reason } = req.body;

    const result = await marketplaceService.refundProductOrder(
      req.params.id,
      req.user.id,
      reason || 'Admin refund'
    );

    res.json({
      status: 'success',
      message: 'Order refunded successfully',
      data: result
    });
  } catch (err) {
    console.error('Refund order error:', err);
    res.status(400).json({
      status: 'error',
      message: err.message
    });
  }
});

/**
 * GET /marketplace/admin/stats - Get marketplace statistics (admin)
 */
router.get('/admin/stats', requireRole(['admin']), async (req, res) => {
  try {
    const stats = await marketplaceService.getMarketplaceStats();

    res.json({
      status: 'success',
      data: stats
    });
  } catch (err) {
    console.error('Get marketplace stats error:', err);
    res.status(500).json({
      status: 'error',
      message: err.message || 'Internal server error'
    });
  }
});

module.exports = router;