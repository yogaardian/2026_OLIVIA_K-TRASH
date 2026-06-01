const express = require('express');
const router = express.Router();
const controller = require('../controllers/wasteController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Kategori Sampah
router.get('/kategori-sampah', controller.listCategories);
router.get('/kategori-sampah/:id', controller.getCategory);
router.post('/kategori-sampah', authenticateToken, requireRole(['admin']), controller.createCategory);
router.put('/kategori-sampah/:id', authenticateToken, requireRole(['admin']), controller.updateCategory);
router.delete('/kategori-sampah/:id', authenticateToken, requireRole(['admin']), controller.deleteCategory);

// Jenis Sampah
router.get('/jenis-sampah', controller.listWasteTypes);
router.get('/jenis-sampah/:id', controller.getWasteType);
router.get('/jenis-sampah/kategori/:kategoriId', controller.listWasteTypesByCategory);
router.post('/jenis-sampah', authenticateToken, requireRole(['admin']), controller.createWasteType);
router.put('/jenis-sampah/:id', authenticateToken, requireRole(['admin']), controller.updateWasteType);
router.delete('/jenis-sampah/:id', authenticateToken, requireRole(['admin']), controller.deleteWasteType);

module.exports = router;
