const express = require('express');
const router = express.Router();
const controller = require('../controllers/orderController');

router.patch('/orders/accept/:id', controller.acceptOrder);
router.post('/orders/:id/reject', controller.rejectOrder);
router.patch('/orders/status/:id', controller.completeOrder);
router.post('/driver/location', controller.updateLocation);
router.get('/tracking/:order_id', controller.getTracking);

module.exports = router;