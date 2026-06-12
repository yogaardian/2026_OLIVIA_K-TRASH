const db = require('../db');
const walletService = require('./walletService');

const HOLD_SETTING_KEY = 'minimum_hold_balance';

function safeNumber(value) {
  return Number(value) || 0;
}

function calculateAvailableBalance(saldo, saldoHold) {
  return Math.max(safeNumber(saldo) - safeNumber(saldoHold), 0);
}

async function getMinimumHoldBalance() {
  const [rows] = await db.query(
    'SELECT setting_value FROM app_settings WHERE setting_key = ?',
    [HOLD_SETTING_KEY],
  );

  if (rows.length === 0) {
    return 50000;
  }

  return safeNumber(rows[0].setting_value);
}

async function setMinimumHoldBalance(amount) {
  await db.query(
    `INSERT INTO app_settings (setting_key, setting_value)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [HOLD_SETTING_KEY, String(amount)],
  );

  // Recalculate the hold balance for all users so the new minimum is applied immediately.
  await db.query(
    'UPDATE users SET saldo_hold = LEAST(saldo, ?), updated_at = NOW()',
    [amount],
  );

  return safeNumber(amount);
}

async function getUserBalance(userId) {
  const [rows] = await db.query(
    'SELECT saldo, saldo_hold FROM users WHERE id = ?',
    [userId],
  );

  if (rows.length === 0) {
    throw new Error('User not found');
  }

  const saldo = safeNumber(rows[0].saldo);
  const saldo_hold = safeNumber(rows[0].saldo_hold);
  const available_balance = calculateAvailableBalance(saldo, saldo_hold);

  return {
    total_balance: saldo,
    hold_balance: saldo_hold,
    available_balance,
  };
}

async function getUserTransactions(userId) {
  const [rows] = await db.query(
    `SELECT st.*, u.nama AS approved_by_name, c.nama AS created_by_name, o.address, o.status as order_status
     FROM saldo_transactions st
     LEFT JOIN users u ON st.approved_by = u.id
     LEFT JOIN users c ON st.created_by = c.id
     LEFT JOIN orders o ON st.order_id = o.id
     WHERE st.user_id = ?
     ORDER BY st.created_at DESC`,
    [userId],
  );

  return rows;
}

async function getPendingTransactions() {
  const [rows] = await db.query(
    `SELECT
       st.id AS transaction_id,
       st.user_id,
       st.order_id,
       st.type,
       st.amount,
       st.status,
       st.description,
       st.created_by,
       st.approved_by,
       st.transaction_reference,
       st.balance_before,
       st.balance_after,
       st.saldo_hold,
       st.source_type,
       st.source_id,
       st.created_at,
       u.nama AS user_name,
       u.email AS user_email,
       o.address,
       o.status as order_status
     FROM saldo_transactions st
     JOIN users u ON st.user_id = u.id
     LEFT JOIN orders o ON st.order_id = o.id
     WHERE st.status = 'pending'
     ORDER BY st.created_at DESC`,
  );

  return rows;
}

async function getAllTransactions() {
  const [rows] = await db.query(
    `SELECT
       st.id AS transaction_id,
       st.user_id,
       st.order_id,
       st.type,
       st.amount,
       st.status,
       st.description,
       st.created_by,
       st.approved_by,
       st.transaction_reference,
       st.balance_before,
       st.balance_after,
       st.saldo_hold,
       st.source_type,
       st.source_id,
       st.created_at,
       u.nama AS user_name,
       o.address,
       o.status as order_status
     FROM saldo_transactions st
     LEFT JOIN users u ON st.user_id = u.id
     LEFT JOIN orders o ON st.order_id = o.id
     ORDER BY st.created_at DESC`,
  );

  return rows;
}

async function getHoldSummary() {
  const [rows] = await db.query(
    `SELECT
      COALESCE(SUM(saldo_hold), 0) AS total_hold,
      COALESCE(SUM(saldo), 0) AS total_balance
     FROM users
     WHERE role = 'user'`,
  );

  return {
    total_hold: safeNumber(rows[0].total_hold),
    total_balance: safeNumber(rows[0].total_balance),
  };
}

async function createPendingTransaction(userId, orderId, amount, description, createdBy) {
  const [existing] = await db.query(
    `SELECT id FROM saldo_transactions
     WHERE order_id = ? AND type = 'waste_income' AND status = 'pending' LIMIT 1`,
    [orderId],
  );

  if (existing.length > 0) {
    return existing[0].id;
  }

  const [insertResult] = await db.query(
    `INSERT INTO saldo_transactions
     (user_id, order_id, type, amount, status, description, created_by, created_at)
     VALUES (?, ?, 'waste_income', ?, 'pending', ?, ?, NOW())`,
    [userId, orderId, amount, description, createdBy],
  );

  return insertResult.insertId;
}

async function approveTransaction(transactionId, adminId) {
  // Get transaction details
  const [rows] = await db.query(
    'SELECT id, user_id, order_id, type, amount, status, description FROM saldo_transactions WHERE id = ?',
    [transactionId],
  );

  if (rows.length === 0) {
    throw new Error('Transaction not found');
  }

  const tx = rows[0];
  if (tx.status === 'approved') {
    throw new Error('Transaction already approved');
  }
  if (tx.status === 'rejected') {
    throw new Error('Transaction already rejected');
  }

  // Generate unique reference for this approval
  const transactionReference = `approval_${transactionId}_${adminId}_${Date.now()}`;

  // Execute through walletService (centralized engine)
  const result = await walletService.executeTransaction({
    userId: tx.user_id,
    amount: safeNumber(tx.amount),
    type: tx.type,
    transactionReference,
    sourceType: 'saldo_transaction',
    sourceId: transactionId,
    description: `${tx.description} [Approved]`,
    createdBy: adminId,
  });

  // Update original transaction to approved
  await db.query(
    'UPDATE saldo_transactions SET status = ?, approved_by = ?, approved_at = NOW() WHERE id = ?',
    ['approved', adminId, transactionId],
  );

  // Update related order if exists
  if (tx.order_id) {
    await db.query('UPDATE orders SET status = ? WHERE id = ?', ['approved', tx.order_id]);
  }

  return {
    total_balance: result.balanceAfter,
    hold_balance: result.holdAfter,
    available_balance: result.availableAfter,
    transactionId: result.transactionId,
  };
}

async function rejectTransaction(transactionId, adminId) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      'SELECT * FROM saldo_transactions WHERE id = ? FOR UPDATE',
      [transactionId],
    );
    if (rows.length === 0) {
      throw new Error('Transaction not found');
    }

    const tx = rows[0];
    if (tx.status !== 'pending') {
      throw new Error('Transaction is not pending');
    }

    if (tx.order_id) {
      await connection.query('UPDATE orders SET status = ? WHERE id = ?', ['rejected', tx.order_id]);
    }

    await connection.query(
      'UPDATE saldo_transactions SET status = ?, approved_by = ? WHERE id = ?',
      ['rejected', adminId, transactionId],
    );

    await connection.commit();
    return {
      status: 'rejected',
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function topupUser(userId, amount, description, adminId) {
  // Validate inputs
  if (!userId) throw new Error('userId is required');
  if (!adminId) throw new Error('adminId is required');
  if (safeNumber(amount) <= 0) throw new Error('amount must be positive');

  // Generate unique reference for this topup (prevents double-topup on retry)
  const transactionReference = `topup_${userId}_${amount}_${adminId}_${Date.now()}`;

  // Execute through walletService (centralized engine)
  const result = await walletService.executeTransaction({
    userId,
    amount: safeNumber(amount),
    type: 'topup_manual',
    transactionReference,
    sourceType: 'admin_topup',
    sourceId: null,
    description: description || 'Manual topup',
    createdBy: adminId,
  });

  return {
    total_balance: result.balanceAfter,
    hold_balance: result.holdAfter,
    available_balance: result.availableAfter,
    transactionId: result.transactionId,
  };
}

async function reverseTransaction(originalTransactionId, adminId, reason) {
  // Get original transaction
  const [txnRows] = await db.query(
    'SELECT id, user_id, amount, type, description FROM saldo_transactions WHERE id = ?',
    [originalTransactionId],
  );

  if (txnRows.length === 0) {
    throw new Error('Transaction not found');
  }

  const originalTxn = txnRows[0];

  // Reverse amount
  const reverseAmount = -safeNumber(originalTxn.amount);

  // Generate unique reference for reversal
  const transactionReference = `reversal_${originalTransactionId}_${adminId}_${Date.now()}`;

  // Execute through walletService
  const result = await walletService.executeTransaction({
    userId: originalTxn.user_id,
    amount: reverseAmount,
    type: `${originalTxn.type}_reversal`,
    transactionReference,
    sourceType: 'reversal',
    sourceId: originalTransactionId,
    description: `Reversal: ${originalTxn.description}. Reason: ${reason}`,
    createdBy: adminId,
  });

  return {
    originalTransactionId,
    reversalTransactionId: result.transactionId,
    total_balance: result.balanceAfter,
    hold_balance: result.holdAfter,
    available_balance: result.availableAfter,
  };
}

module.exports = {
  getMinimumHoldBalance,
  setMinimumHoldBalance,
  getUserBalance,
  getUserTransactions,
  getPendingTransactions,
  getAllTransactions,
  getHoldSummary,
  createPendingTransaction,
  approveTransaction,
  rejectTransaction,
  topupUser,
  reverseTransaction,
};
