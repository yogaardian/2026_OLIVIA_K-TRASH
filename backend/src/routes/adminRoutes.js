const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const transactionService = require('../services/transactionService');

// Apply auth to all admin routes
router.use(authenticateToken);
router.use(requireRole(['admin']));

// Get pending transactions
router.get('/pending-transactions', async (req, res) => {
  try {
    const transactions = await transactionService.getPendingTransactions();
    res.json(transactions);
  } catch (err) {
    console.error('Get pending transactions error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all transactions
router.get('/transactions', async (req, res) => {
  try {
    const transactions = await transactionService.getAllTransactions();
    res.json(transactions);
  } catch (err) {
    console.error('Get all transactions error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Approve transaction
router.patch('/approve-transaction/:id', async (req, res) => {
  const { id } = req.params;
  const adminId = req.user.id;

  try {
    const result = await transactionService.approveTransaction(id, adminId);
    res.json({
      message: 'Transaction approved successfully',
      balance: result
    });
  } catch (err) {
    console.error('Approve transaction error:', err);
    res.status(400).json({ message: err.message });
  }
});

// Reject transaction
router.patch('/reject-transaction/:id', async (req, res) => {
  const { id } = req.params;
  const adminId = req.user.id;

  try {
    const result = await transactionService.rejectTransaction(id, adminId);
    res.json({
      message: 'Transaction rejected successfully'
    });
  } catch (err) {
    console.error('Reject transaction error:', err);
    res.status(400).json({ message: err.message });
  }
});

// Topup user
router.post('/topup', async (req, res) => {
  const { user_id, amount, description } = req.body;
  const adminId = req.user.id;

  if (!user_id || !amount) {
    return res.status(400).json({ message: 'User ID and amount required' });
  }

  try {
    const result = await transactionService.topupUser(user_id, amount, description, adminId);
    res.json({
      message: 'Topup successful',
      balance: result
    });
  } catch (err) {
    console.error('Topup error:', err);
    res.status(400).json({ message: err.message });
  }
});

// Hold balance settings
router.get('/settings/hold-balance', async (req, res) => {
  try {
    const amount = await transactionService.getMinimumHoldBalance();
    res.json({ minimum_hold_balance: amount });
  } catch (err) {
    console.error('Get hold balance error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.patch('/settings/hold-balance', async (req, res) => {
  const { amount } = req.body;

  if (amount === undefined || amount < 0) {
    return res.status(400).json({ message: 'Valid amount required' });
  }

  try {
    const newAmount = await transactionService.setMinimumHoldBalance(amount);
    res.json({
      message: 'Hold balance updated successfully',
      minimum_hold_balance: newAmount
    });
  } catch (err) {
    console.error('Set hold balance error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Hold summary
router.get('/hold-summary', async (req, res) => {
  try {
    const summary = await transactionService.getHoldSummary();
    res.json(summary);
  } catch (err) {
    console.error('Get hold summary error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;