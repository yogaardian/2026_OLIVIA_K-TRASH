const express = require('express');
const router = express.Router();
const controller = require('../controllers/orderController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.post(
  '/orders/:id/reject',
  authenticateToken,
  requireRole(['driver', 'petugas']),
  controller.rejectOrder,
);
router.get('/tracking/:order_id', authenticateToken, controller.getTracking);

module.exports = router;