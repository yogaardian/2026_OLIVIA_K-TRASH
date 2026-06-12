const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
// Environment variable validation and fallback
const isProduction = process.env.NODE_ENV === 'production';

if (!process.env.JWT_SECRET) {
  if (isProduction) {
    console.error('❌ Environment variable JWT_SECRET is required in production. Server exiting.');
    process.exit(1);
  } else {
    console.warn('⚠️  JWT_SECRET not set. Using default dev secret. DO NOT USE IN PRODUCTION!');
    process.env.JWT_SECRET = 'dev_secret_jwt_32char_minimal_aman';
  }
}
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const http = require('http');
const socketIO = require('socket.io');
const db = require('./src/db');
const transactionService = require('./src/services/transactionService');
const walletService = require('./src/services/walletService');
const { authenticateToken, requireRole } = require('./src/middleware/auth');
const { apiLimiter } = require('./src/middleware/rateLimiter');
const socketAuthMiddleware = require('./src/middleware/socketAuth');
const setupSocketHandlers = require('./src/socket/handlers');
const socketService = require('./src/services/socketService');
const socketEvents = require('./src/constants/socketEvents');
const newAuthRoutes = require('./src/routes/newAuthRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const productRoutes = require('./src/routes/productRoutes');
const wasteRoutes = require('./src/routes/wasteRoutes');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

const allowedOriginsRaw = process.env.CORS_ALLOW_ORIGINS?.trim();
const frontendUrl = process.env.FRONTEND_URL?.trim();
const defaultOrigins = 'http://localhost:3000,http://localhost:3001,http://localhost:3002,https://k-trash-olivia.vercel.app';
const allowedOrigins = (allowedOriginsRaw || frontendUrl || defaultOrigins)
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

console.log('CORS_ALLOW_ORIGINS env:', JSON.stringify(allowedOriginsRaw));
console.log('FRONTEND_URL env:', JSON.stringify(frontendUrl));
console.log('Computed allowedOrigins:', allowedOrigins);

const corsOptions = {
  origin: (origin, callback) => {
    console.log('CORS origin:', origin);
    console.log('Allowed origins:', allowedOrigins);
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS policy does not allow access from origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(apiLimiter); // General rate limiting
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ================= SOCKET.IO SETUP =================
const io = socketIO(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

io.use(socketAuthMiddleware);
setupSocketHandlers(io);
socketService.initializeSocket(io);

io.engine.on('connection', (engineSocket) => {
  console.log('[Engine] new engine connection:', engineSocket.id);
  engineSocket.on('packet', (packet) => {
    console.log('[Engine] packet:', packet);
  });
  engineSocket.on('error', (err) => {
    console.error('[Engine] transport error:', err);
  });
  engineSocket.on('close', (reason) => {
    console.warn('[Engine] transport close:', reason);
  });
});

// Routes
app.use('/api/auth', newAuthRoutes);
app.use('/api', wasteRoutes);
app.use('/', orderRoutes);
app.use('/products', productRoutes);
app.use('/marketplace', require('./src/routes/marketplaceRoutes'));
app.use('/admin', require('./src/routes/adminRoutes'));

// Initialize DB and seed accounts
(async () => {
  try {
    const connection = await db.getConnection();
    console.log('DB Connected');
    connection.release();
    if (process.env.NODE_ENV !== 'production') {
      await seedDefaultAccounts();
    } else {
      console.log('Production mode: default demo account seeding skipped');
    }
  } catch (err) {
    console.error('DB Error:', err);
  }
})();

db.on('error', (err) => {
  console.error('DB pool error', err);
});

// ================= SEED =================
async function seedDefaultAccounts() {
  const SALT_ROUNDS = 10;
  const users = [
    {
      nama: 'Petugas Demo',
      email: 'petugas@test.com',
      password: await bcrypt.hash('123456', SALT_ROUNDS),
      role: 'driver',
      nomor_hp: '081234567890',
    },
    {
      nama: 'User Demo',
      email: 'user@test.com',
      password: await bcrypt.hash('123456', SALT_ROUNDS),
      role: 'user',
      nomor_hp: '081234567891',
    },
    {
      nama: 'Admin Demo',
      email: 'admin@test.com',
      password: await bcrypt.hash('123456', SALT_ROUNDS),
      role: 'admin',
      nomor_hp: '081234567892',
    },
  ];

  for (const u of users) {
    try {
      const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [u.email]);
      if (existing.length === 0) {
        await db.query(
          'INSERT INTO users (nama,email,password,role,nomor_hp) VALUES (?,?,?,?,?)',
          [u.nama, u.email, u.password, u.role, u.nomor_hp],
        );
      }
    } catch (err) {
      console.error('Seed error for user', u.email, err);
    }
  }

  // Create harga_sampah table if not exists
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS harga_sampah (
        id INT AUTO_INCREMENT PRIMARY KEY,
        jenis VARCHAR(50) NOT NULL,
        sub_jenis VARCHAR(100) NOT NULL,
        harga INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    // Seed initial data if table is empty
    const [existing] = await db.query('SELECT COUNT(*) as count FROM harga_sampah');
    if (existing[0].count === 0) {
      const initialData = [
        { jenis: 'anorganik', sub_jenis: 'Botol Plastik PET', harga: 4000 },
        { jenis: 'anorganik', sub_jenis: 'Kardus', harga: 2000 },
        { jenis: 'anorganik', sub_jenis: 'Besi', harga: 5000 },
        { jenis: 'anorganik', sub_jenis: 'Kaleng', harga: 4500 },
        { jenis: 'organik', sub_jenis: 'Daun', harga: 500 },
        { jenis: 'organik', sub_jenis: 'Sisa Makanan', harga: 300 },
        { jenis: 'elektronik', sub_jenis: 'Kabel Bekas', harga: 2000 },
        { jenis: 'elektronik', sub_jenis: 'Charger Bekas', harga: 1500 },
      ];
      
      for (const item of initialData) {
        await db.query(
          'INSERT INTO harga_sampah (jenis, sub_jenis, harga) VALUES (?, ?, ?)',
          [item.jenis, item.sub_jenis, item.harga]
        );
      }
      console.log('Seeded harga_sampah table with initial data');
    }
  } catch (err) {
    console.error('Error creating harga_sampah table:', err);
  }

  // Ensure orders table has columns needed for completed order details
  try {
    const [orderColumns] = await db.query("SHOW COLUMNS FROM orders");
    const columnNames = orderColumns.map(col => col.Field);

    if (!columnNames.includes('sampah_data')) {
      await db.query('ALTER TABLE orders ADD COLUMN sampah_data LONGTEXT NULL');
    }
    if (!columnNames.includes('total_berat')) {
      await db.query('ALTER TABLE orders ADD COLUMN total_berat DECIMAL(10,2) NULL');
    }
    if (!columnNames.includes('total_harga')) {
      await db.query('ALTER TABLE orders ADD COLUMN total_harga INT NULL');
    }

    const [statusColumn] = await db.query("SHOW COLUMNS FROM orders WHERE Field = 'status'");
    if (statusColumn.length > 0) {
      const statusType = statusColumn[0].Type;
      if (!statusType.includes('approved') || !statusType.includes('rejected')) {
        await db.query(`ALTER TABLE orders MODIFY status ENUM('pending','searching_driver','assigned','on_the_way','arrived','completed','cancelled','approved','rejected') COLLATE utf8mb4_general_ci DEFAULT 'pending'`);
      }
    }

    console.log('Ensured orders table has sampah_data, total_berat, total_harga columns and status enum includes approved/rejected');
  } catch (err) {
    console.error('Error ensuring orders schema:', err);
  }

  // Ensure users table has saldo and saldo_hold columns
  try {
    const [userColumns] = await db.query('SHOW COLUMNS FROM users');
    const userColumnNames = userColumns.map(col => col.Field);

    if (!userColumnNames.includes('google_id')) {
      await db.query('ALTER TABLE users ADD COLUMN google_id VARCHAR(255) NULL UNIQUE AFTER email');
    }
    if (!userColumnNames.includes('saldo')) {
      await db.query('ALTER TABLE users ADD COLUMN saldo DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER role');
    }
    if (!userColumnNames.includes('saldo_hold')) {
      await db.query('ALTER TABLE users ADD COLUMN saldo_hold DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER saldo');
    }
    if (!userColumnNames.includes('updated_at')) {
      await db.query('ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER saldo_hold');
    }
    if (!userColumnNames.includes('profile_photo')) {
      await db.query('ALTER TABLE users ADD COLUMN profile_photo LONGTEXT NULL AFTER updated_at');
    }

    const minimumHold = 50000;
    await db.query('UPDATE users SET saldo_hold = LEAST(saldo, ?) WHERE saldo_hold = 0', [minimumHold]);
    console.log('Ensured users table has google_id, saldo, saldo_hold, and updated_at columns');
  } catch (err) {
    console.error('Error ensuring users schema:', err);
  }

  // Ensure pending registrations table exists for OTP-based sign-up
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS pending_registrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        nomor_hp VARCHAR(50) DEFAULT NULL,
        otp VARCHAR(10) NOT NULL,
        otp_expires_at DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
    console.log('Ensured pending_registrations table exists');
  } catch (err) {
    console.error('Error ensuring pending_registrations schema:', err);
  }

  // Ensure case table app_settings and saldo_transactions exists
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
    const [settingRows] = await db.query('SELECT COUNT(*) as count FROM app_settings WHERE setting_key = ?', ['minimum_hold_balance']);
    if (settingRows[0].count === 0) {
      await db.query('INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)', ['minimum_hold_balance', '50000']);
    }

    await db.query(`
      CREATE TABLE IF NOT EXISTS saldo_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        order_id INT NULL,
        type ENUM('waste_income','topup_manual','withdraw','adjustment','penalty','marketplace_purchase','marketplace_refund','marketplace_order_reversal') NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
        description TEXT NULL,
        created_by INT NULL,
        approved_by INT NULL,
        transaction_reference VARCHAR(255) UNIQUE NULL,
        balance_before DECIMAL(15,2) NULL,
        balance_after DECIMAL(15,2) NULL,
        saldo_hold DECIMAL(15,2) NULL,
        source_type VARCHAR(100) NULL,
        source_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);

    // Migrate existing saldo_transactions table to add marketplace types if not already present
    try {
      const [typeColumn] = await db.query("SHOW COLUMNS FROM saldo_transactions WHERE Field = 'type'");
      if (typeColumn.length > 0) {
        const currentType = typeColumn[0].Type;
        if (!currentType.includes('marketplace_purchase')) {
          await db.query(`
            ALTER TABLE saldo_transactions MODIFY type ENUM('waste_income','topup_manual','withdraw','adjustment','penalty','marketplace_purchase','marketplace_refund','marketplace_order_reversal') NOT NULL
          `);
          console.log('Migrated saldo_transactions ENUM to include marketplace types');
        }
      }
    } catch (err) {
      console.warn('Could not migrate saldo_transactions ENUM:', err.message);
    }

    // Ensure saldo_transactions has additional columns if not present
    try {
      const [txnColumns] = await db.query('SHOW COLUMNS FROM saldo_transactions');
      const txnColumnNames = txnColumns.map(col => col.Field);
      if (!txnColumnNames.includes('transaction_reference')) {
        await db.query('ALTER TABLE saldo_transactions ADD COLUMN transaction_reference VARCHAR(255) UNIQUE NULL');
      }
      if (!txnColumnNames.includes('balance_before')) {
        await db.query('ALTER TABLE saldo_transactions ADD COLUMN balance_before DECIMAL(15,2) NULL');
      }
      if (!txnColumnNames.includes('balance_after')) {
        await db.query('ALTER TABLE saldo_transactions ADD COLUMN balance_after DECIMAL(15,2) NULL');
      }
      if (!txnColumnNames.includes('saldo_hold')) {
        await db.query('ALTER TABLE saldo_transactions ADD COLUMN saldo_hold DECIMAL(15,2) NULL');
      }
      if (!txnColumnNames.includes('source_type')) {
        await db.query('ALTER TABLE saldo_transactions ADD COLUMN source_type VARCHAR(100) NULL');
      }
      if (!txnColumnNames.includes('source_id')) {
        await db.query('ALTER TABLE saldo_transactions ADD COLUMN source_id INT NULL');
      }
    } catch (err) {
      console.warn('Could not add additional saldo_transactions columns:', err.message);
    }

    await db.query(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama VARCHAR(255) NOT NULL,
        deskripsi TEXT,
        harga DECIMAL(15,2) NOT NULL,
        kategori ENUM('lokal','digital','pulsa','token_listrik','paket_data') NOT NULL DEFAULT 'lokal',
        stok INT NOT NULL DEFAULT 0,
        gambar VARCHAR(500),
        aktif BOOLEAN NOT NULL DEFAULT TRUE,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS product_orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        product_id INT NOT NULL,
        jumlah INT NOT NULL DEFAULT 1,
        total_harga DECIMAL(15,2) NOT NULL,
        transaction_id INT NULL,
        status ENUM('pending','processing','completed','cancelled','refunded') NOT NULL DEFAULT 'pending',
        catatan TEXT,
        processed_by INT NULL,
        processed_at TIMESTAMP NULL,
        refunded_by INT NULL,
        refunded_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (transaction_id) REFERENCES saldo_transactions(id) ON DELETE SET NULL,
        FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (refunded_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS product_order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        product_id INT NOT NULL,
        jumlah INT NOT NULL,
        harga_satuan DECIMAL(15,2) NOT NULL,
        subtotal DECIMAL(15,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES product_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS product_stock_changes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        quantity_delta INT NOT NULL,
        stock_before INT NOT NULL,
        stock_after INT NOT NULL,
        reason VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id),
        INDEX idx_product_id (product_id),
        INDEX idx_created_at (created_at),
        INDEX idx_product_date (product_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);

    const [productCount] = await db.query('SELECT COUNT(*) as count FROM products');
    if (productCount[0].count === 0) {
      const defaultProducts = [
        { nama: 'Beras', deskripsi: 'Beras premium 5kg untuk kebutuhan rumah tangga.', harga: 20000, kategori: 'lokal', stok: 100 },
        { nama: 'Minyak', deskripsi: 'Minyak goreng kemasan 1 liter, siap pakai.', harga: 18000, kategori: 'lokal', stok: 100 },
        { nama: 'Telur', deskripsi: 'Telur ayam segar isi 10 butir.', harga: 22000, kategori: 'lokal', stok: 100 },
      ];

      for (const product of defaultProducts) {
        await db.query(
          'INSERT INTO products (nama, deskripsi, harga, kategori, stok, aktif) VALUES (?, ?, ?, ?, ?, TRUE)',
          [product.nama, product.deskripsi, product.harga, product.kategori, product.stok]
        );
      }
      console.log('Seeded default marketplace products');
    }

    console.log('Ensured app_settings, saldo_transactions, and marketplace tables exist');
  } catch (err) {
    console.error('Error ensuring saldo schema:', err);
  }
}

// ================= BASIC =================
app.get('/', (req, res) => {
  res.send('API jalan 🚀');
});

app.get('/ping', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/user/balance/:id', authenticateToken, async (req, res) => {
  const userId = Number(req.params.id);
  if (!userId) {
    return res.status(400).json({ status: 'fail', message: 'User id tidak valid' });
  }

  if (req.user.role !== 'admin' && req.user.id !== userId) {
    return res.status(403).json({ status: 'fail', message: 'Akses ditolak' });
  }

  try {
    const balance = await walletService.getUserBalance(userId);
    res.json(balance);
  } catch (err) {
    if (err.message === 'User not found') {
      return res.status(404).json({ status: 'fail', message: 'User tidak ditemukan' });
    }
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/user/transactions/:id', authenticateToken, async (req, res) => {
  const userId = Number(req.params.id);
  if (!userId) {
    return res.status(400).json({ status: 'fail', message: 'User id tidak valid' });
  }

  if (req.user.role !== 'admin' && req.user.id !== userId) {
    return res.status(403).json({ status: 'fail', message: 'Akses ditolak' });
  }

  try {
    const transactions = await transactionService.getUserTransactions(userId);
    res.json(transactions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/admin/pending-transactions', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const transactions = await transactionService.getPendingTransactions();
    res.json(transactions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/admin/transactions', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const transactions = await transactionService.getAllTransactions();
    res.json(transactions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/admin/hold-summary', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const summary = await transactionService.getHoldSummary();
    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/admin/settings/hold-balance', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const amount = await transactionService.getMinimumHoldBalance();
    res.json({ minimum_hold_balance: amount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.patch('/admin/settings/hold-balance', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { amount } = req.body;
    if (amount == null || Number(amount) <= 0) {
      return res.status(400).json({ status: 'fail', message: 'amount wajib lebih besar dari 0' });
    }

    const updated = await transactionService.setMinimumHoldBalance(Number(amount));
    res.json({ status: 'success', minimum_hold_balance: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/admin/topup', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { user_id, amount, description, admin_id } = req.body;
    if (!user_id || amount == null || Number(amount) <= 0) {
      return res.status(400).json({ status: 'fail', message: 'user_id dan amount positif wajib diisi' });
    }

    const result = await transactionService.topupUser(Number(user_id), Number(amount), description || 'Top up manual', admin_id || null);
    res.json({ status: 'success', message: 'Top up berhasil', balance: result });
  } catch (err) {
    if (err.message === 'User not found') {
      return res.status(404).json({ status: 'fail', message: 'User tidak ditemukan' });
    }
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.patch('/admin/approve-transaction/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const transactionId = Number(req.params.id);
    const { admin_id } = req.body;

    if (!transactionId) {
      return res.status(400).json({ status: 'fail', message: 'Transaction id tidak valid' });
    }

    const balance = await transactionService.approveTransaction(transactionId, admin_id || null);
    res.json({ status: 'success', message: 'Transaksi disetujui', balance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.patch('/admin/reject-transaction/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const transactionId = Number(req.params.id);
    const { admin_id } = req.body;

    if (!transactionId) {
      return res.status(400).json({ status: 'fail', message: 'Transaction id tidak valid' });
    }

    const result = await transactionService.rejectTransaction(transactionId, admin_id || null);
    res.json({ status: 'success', message: 'Transaksi ditolak', data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});


// ================= AUTH =================
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: 'fail',
        message: 'Email dan password wajib diisi'
      });
    }

    // Check if email is actually an email or username
    let query = 'SELECT * FROM users WHERE email = ? AND password = ?';
    let params = [email, password];

    // If not found, try as username (nama)
    const [result] = await db.query(query, params);
    if (result.length === 0) {
      query = 'SELECT * FROM users WHERE nama = ? AND password = ?';
      const [result2] = await db.query(query, [email, password]);
      if (result2.length > 0) {
        res.json({
          status: 'success',
          id: result2[0].id,
          nama: result2[0].nama,
          role: result2[0].role,
        });
        return;
      }
    } else {
      res.json({
        status: 'success',
        id: result[0].id,
        nama: result[0].nama,
        role: result[0].role,
      });
      return;
    }

    res.json({ status: 'fail' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/register', async (req, res) => {
  try {
    const { nama, email, password, role, nomor_hp } = req.body;

    await db.query(
      'INSERT INTO users (nama,email,password,role,nomor_hp) VALUES (?,?,?,?,?)',
      [nama, email, password, role, nomor_hp],
    );

    res.json({ status: 'success' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ================= HARGA =================
app.get('/harga/:jenis', async (req, res) => {
  try {
    const jenis = req.params.jenis;

    const [result] = await db.query(
      'SELECT id, sub_jenis, harga FROM harga_sampah WHERE jenis = ?',
      [jenis],
    );

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/harga/:jenis/:sub', async (req, res) => {
  try {
    const jenis = req.params.jenis;
    const sub = req.params.sub;

    const [result] = await db.query(
      'SELECT id, sub_jenis, harga FROM harga_sampah WHERE jenis = ? AND sub_jenis = ?',
      [jenis, sub],
    );

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// POST /harga - Add new waste type
app.post('/harga', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { jenis, sub_jenis, harga } = req.body;

    if (!jenis || !sub_jenis || harga == null) {
      return res.status(400).json({ status: 'fail', message: 'jenis, sub_jenis, harga wajib diisi' });
    }

    await db.query(
      'INSERT INTO harga_sampah (jenis, sub_jenis, harga) VALUES (?, ?, ?)',
      [jenis, sub_jenis, harga],
    );

    res.json({ status: 'success' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// PUT /harga/:id - Update waste type
app.put('/harga/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const id = req.params.id;
    const { jenis, sub_jenis, harga } = req.body;

    if (!jenis || !sub_jenis || harga == null) {
      return res.status(400).json({ status: 'fail', message: 'jenis, sub_jenis, harga wajib diisi' });
    }

    const [result] = await db.query(
      'UPDATE harga_sampah SET jenis = ?, sub_jenis = ?, harga = ? WHERE id = ?',
      [jenis, sub_jenis, harga, id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'fail', message: 'Harga sampah tidak ditemukan' });
    }

    res.json({ status: 'success' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// DELETE /harga/:id - Delete waste type
app.delete('/harga/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const id = req.params.id;

    const [result] = await db.query(
      'DELETE FROM harga_sampah WHERE id = ?',
      [id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'fail', message: 'Harga sampah tidak ditemukan' });
    }

    res.json({ status: 'success' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ================= USERS =================
app.get('/users/role/:role', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const role = req.params.role;
    let sql = 'SELECT id, nama, email, nomor_hp, role FROM users WHERE role = ?';
    let params = [role];

    if (role === 'driver' || role === 'petugas') {
      sql = 'SELECT id, nama, email, nomor_hp, role FROM users WHERE role IN (?, ?)';
      params = ['driver', 'petugas'];
    }

    const [result] = await db.query(sql, params);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/users', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    let { nama, email, password, role, nomor_hp } = req.body;
    if (!nama || !email || !password || !role || !nomor_hp) {
      return res.status(400).json({ status: 'fail', message: 'Semua field wajib diisi' });
    }

    // Restrict role to user or driver only; admin creation requires admin privilege
    if (!['user', 'driver'].includes(role)) {
      return res.status(403).json({ status: 'fail', message: 'Invalid role. Only user or driver allowed.' });
    }

    if (role === 'driver') {
      role = 'petugas';
    }

    await db.query(
      'INSERT INTO users (nama, email, password, role, nomor_hp) VALUES (?, ?, ?, ?, ?)',
      [nama, email, password, role, nomor_hp],
    );

    res.json({ status: 'success' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.delete('/users/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!userId) {
      return res.status(400).json({ status: 'fail', message: 'User id tidak valid' });
    }

    const [result] = await db.query('DELETE FROM users WHERE id = ?', [userId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'fail', message: 'User tidak ditemukan' });
    }

    res.json({ status: 'success' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ================= STATS =================
app.get('/stats/dashboard', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    // Total active orders (pending + assigned + on_the_way + arrived)
    const [activeOrders] = await db.query(
      "SELECT COUNT(*) as total FROM orders WHERE status IN ('pending', 'assigned', 'on_the_way', 'arrived')"
    );

    // Total petugas (drivers)
    const [totalPetugas] = await db.query(
      "SELECT COUNT(*) as total FROM users WHERE role IN ('driver', 'petugas')"
    );

    // Total sampah (sum of berat from completed orders or something, but since no berat, maybe count completed orders)
    // Assuming we need total weight, but since not stored, perhaps sum from transactions or estimate
    // For now, let's say total completed orders as "total sampah"
    const [totalSampah] = await db.query(
      "SELECT COUNT(*) as total FROM orders WHERE status = 'completed'"
    );

    // Riwayat (total completed orders)
    const [riwayat] = await db.query(
      "SELECT COUNT(*) as total FROM orders WHERE status = 'completed'"
    );

    res.json({
      totalOrders: activeOrders[0].total,
      totalPetugas: totalPetugas[0].total,
      totalSampah: totalSampah[0].total, // placeholder
      riwayat: riwayat[0].total,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// New endpoint for total users with all roles
app.get('/stats/total-users', authenticateToken, requireRole(['admin']), async (req, res) => {
  console.log('Endpoint /stats/total-users called');
  try {
    const [totalUsers] = await db.query(
      "SELECT COUNT(*) as total FROM users"
    );

    console.log('Total users result:', totalUsers);
    res.json({
      totalUsers: totalUsers[0].total,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// New endpoint for daily transactions (resets at midnight)
app.get('/stats/daily-transactions', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const [dailyTransactions] = await db.query(
      "SELECT SUM(amount) as total FROM saldo_transactions WHERE DATE(created_at) = CURDATE() AND status = 'approved'"
    );

    res.json({
      dailyTransactions: dailyTransactions[0].total || 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /orders/recent - Get recent orders for dashboard
app.get('/orders/recent', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const [recentOrders] = await db.query(
      "SELECT id, status, created_at FROM orders ORDER BY created_at DESC LIMIT 10"
    );

    const formatted = recentOrders.map(order => ({
      judul: `Order #${order.id} - ${order.status}`,
      waktu: new Date(order.created_at).toLocaleString(),
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /orders/user/:userId - Get orders for specific user
app.get('/orders/user/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!userId) {
      return res.status(400).json({ status: 'fail', message: 'User id tidak valid' });
    }

    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({ status: 'fail', message: 'Akses ditolak' });
    }

    const [userOrders] = await db.query(
      "SELECT id, status, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 10",
      [userId]
    );

    res.json(userOrders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ================= CREATE ORDER =================
app.post('/orders', authenticateToken, requireRole(['user', 'driver']), async (req, res) => {
  try {
    const { user_id, address, user_lat, user_lng, jenis_sampah, catatan } = req.body;

    const sql = `
      INSERT INTO orders (user_id, address, user_lat, user_lng, jenis_sampah, catatan, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())
    `;

    const [result] = await db.query(sql, [user_id, address, user_lat, user_lng, jenis_sampah, catatan]);

    res.json({ status: 'success', order_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ================= LIST ORDER =================
app.get('/orders/pending', authenticateToken, requireRole(['admin','driver','petugas']), async (req, res) => {
  try {
    // Filter out orders that the current driver has rejected (per-driver rejection)
    const driverId = req.user?.id || null;
    const params = [];
    let sql = `SELECT o.*, u.nama AS user_name, u.profile_photo AS user_profile_photo
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.status = 'pending'`;

    if (driverId) {
      sql = `SELECT o.*, u.nama AS user_name, u.profile_photo AS user_profile_photo
        FROM orders o
        JOIN users u ON o.user_id = u.id
        LEFT JOIN driver_rejected_orders dro ON o.id = dro.order_id AND dro.driver_id = ?
        WHERE o.status = 'pending' AND dro.id IS NULL`;
      params.push(driverId);
    }

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ================= ORDER DETAIL =================
app.get('/orders/:id', authenticateToken, async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    if (!orderId) {
      return res.status(400).json({ status: 'fail', message: 'Order id tidak valid' });
    }

    const [result] = await db.query(
      `SELECT o.id, o.user_id, o.driver_id, o.address, o.user_lat, o.user_lng, o.jenis_sampah, o.catatan, o.status, o.sampah_data, o.total_berat, o.total_harga,
        u.nama AS user_name, u.profile_photo AS user_profile_photo, u.nomor_hp AS user_phone,
        d.nama AS driver_name, d.profile_photo AS driver_profile_photo, d.nomor_hp AS driver_phone
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN users d ON o.driver_id = d.id
      WHERE o.id = ?`,
      [orderId],
    );

    if (result.length === 0) {
      return res.status(404).json({ status: 'fail' });
    }

    const order = result[0];
    if (req.user.role !== 'admin') {
      if (req.user.role === 'user' && req.user.id !== order.user_id) {
        return res.status(403).json({ status: 'fail', message: 'Akses ditolak' });
      }
      if (req.user.role === 'driver' && req.user.id !== order.driver_id) {
        return res.status(403).json({ status: 'fail', message: 'Akses ditolak' });
      }
    }

    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ================= ACCEPT ORDER =================
app.patch('/orders/accept/:id', authenticateToken, requireRole(['driver','petugas']), async (req, res) => {
  try {
    const { driver_id } = req.body;
    const orderId = req.params.id;

    const sql = `
      UPDATE orders
      SET driver_id = ?, status = 'on_the_way'
      WHERE id = ? AND status = 'pending'
    `;

    const [result] = await db.query(sql, [driver_id, orderId]);

    if (result.affectedRows === 0) {
      return res.status(400).json({ status: 'fail', message: 'Order sudah diambil' });
    }

    const [updatedRows] = await db.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (updatedRows.length > 0) {
      const updatedOrder = updatedRows[0];
      socketService.emitToOrder(orderId, socketEvents.SERVER.ORDER_STATUS_CHANGED, { order: updatedOrder });
      socketService.emitToUser(updatedOrder.user_id, socketEvents.SERVER.ORDER_STATUS_CHANGED, { order: updatedOrder });
      socketService.emitToOrder(orderId, socketEvents.SERVER.ORDER_ACCEPTED, { order: updatedOrder });
      socketService.emitToUser(updatedOrder.user_id, socketEvents.SERVER.ORDER_ACCEPTED, { order: updatedOrder });
      socketService.emitToOrder(orderId, socketEvents.SERVER.ORDER_ON_THE_WAY, { order: updatedOrder });
      socketService.emitToUser(updatedOrder.user_id, socketEvents.SERVER.ORDER_ON_THE_WAY, { order: updatedOrder });
    }

    res.json({ status: 'success' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ================= UPDATE STATUS =================
app.patch('/orders/status/:id', authenticateToken, requireRole(['driver','petugas']), async (req, res) => {
  let connection;
  try {
    const { driver_id, status, sampah_data, total_berat, total_harga } = req.body;
    const orderId = req.params.id;

    const allowed = ['assigned', 'on_the_way', 'arrived', 'completed'];

    if (!driver_id || !status) {
      return res.status(400).json({ status: 'fail', message: 'driver_id dan status wajib diisi' });
    }

    if (!allowed.includes(status)) {
      return res.status(400).json({ status: 'fail', message: 'Status tidak valid' });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [orderResult] = await connection.query('SELECT driver_id, status, user_id FROM orders WHERE id = ? FOR UPDATE', [orderId]);
    if (orderResult.length === 0) {
      await connection.rollback();
      return res.status(404).json({ status: 'fail', message: 'Order tidak ditemukan' });
    }

    const order = orderResult[0];
    if (order.driver_id !== driver_id) {
      await connection.rollback();
      return res.status(403).json({ status: 'fail', message: 'Driver tidak terdaftar untuk order ini' });
    }

    const transitions = {
      pending: ['assigned'],
      assigned: ['on_the_way', 'arrived', 'completed'],
      on_the_way: ['arrived', 'completed'],
      arrived: ['completed'],
      completed: [],
      cancelled: [],
      approved: [],
      rejected: [],
    };

    if (!transitions[order.status]?.includes(status)) {
      await connection.rollback();
      return res.status(400).json({ status: 'fail', message: `Transisi status tidak diperbolehkan dari ${order.status} ke ${status}` });
    }

    if (status === 'completed') {
      if (!sampah_data || total_berat == null || total_harga == null) {
        await connection.rollback();
        return res.status(400).json({ status: 'fail', message: 'sampah_data, total_berat, total_harga wajib diisi saat menyelesaikan order' });
      }

      await connection.query(
        'UPDATE orders SET status = ?, sampah_data = ?, total_berat = ?, total_harga = ? WHERE id = ?',
        [status, JSON.stringify(sampah_data), total_berat, total_harga, orderId],
      );

      await transactionService.createPendingTransaction(
        order.user_id,
        orderId,
        total_harga,
        `Transaksi sampah order #${orderId}`,
        driver_id,
      );
    } else {
      await connection.query('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);
    }

    await connection.commit();

    const [updatedRows] = await db.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (updatedRows.length > 0) {
      const updatedOrder = updatedRows[0];
      socketService.emitToOrder(orderId, socketEvents.SERVER.ORDER_STATUS_CHANGED, { order: updatedOrder });
      socketService.emitToUser(updatedOrder.user_id, socketEvents.SERVER.ORDER_STATUS_CHANGED, { order: updatedOrder });
      const statusEvent = {
        // assigned does not emit a dedicated specific event here;
        // the client should consume ORDER_STATUS_CHANGED for the assigned transition.
        on_the_way: socketEvents.SERVER.ORDER_ON_THE_WAY,
        arrived: socketEvents.SERVER.ORDER_ARRIVED,
        completed: socketEvents.SERVER.ORDER_COMPLETED,
      }[updatedOrder.status];
      if (statusEvent) {
        socketService.emitToOrder(orderId, statusEvent, { order: updatedOrder });
        socketService.emitToUser(updatedOrder.user_id, statusEvent, { order: updatedOrder });
      }
    }

    res.json({ status: 'success', message: 'Status order berhasil diperbarui' });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// ================= DRIVER LOCATION =================
app.post('/driver/location', authenticateToken, requireRole(['driver','petugas']), async (req, res) => {
  try {
    const { driver_id, order_id, lat, lng } = req.body;

    if (!driver_id || !order_id || lat == null || lng == null) {
      return res.status(400).json({ status: 'fail', message: 'driver_id, order_id, lat, lng wajib diisi' });
    }

    const [result] = await db.query(
      'SELECT driver_id, status FROM orders WHERE id = ?',
      [order_id],
    );

    if (result.length === 0) {
      return res.status(404).json({ status: 'fail', message: 'Order tidak ditemukan' });
    }

    const order = result[0];

    if (req.user.id !== driver_id) {
      return res.status(403).json({ status: 'fail', message: 'Driver tidak sesuai order' });
    }

    if (!['assigned', 'on_the_way', 'arrived'].includes(order.status)) {
      return res.status(400).json({ status: 'fail', message: 'Order belum aktif atau tidak dalam status yang boleh dikirim lokasi' });
    }

    await db.query(
      'INSERT INTO driver_locations (driver_id, order_id, lat, lng) VALUES (?, ?, ?, ?)',
      [driver_id, order_id, lat, lng],
    );

    socketService.emitToOrder(order_id, socketEvents.SERVER.DRIVER_LOCATION_UPDATED, {
      orderId: order_id,
      driverId: driver_id,
      lat,
      lng,
      timestamp: new Date().toISOString(),
    });

    socketService.emitToUser(order.user_id, socketEvents.SERVER.DRIVER_LOCATION_UPDATED, {
      orderId: order_id,
      driverId: driver_id,
      lat,
      lng,
      timestamp: new Date().toISOString(),
    });

    res.json({ status: 'success', message: 'Lokasi driver tersimpan' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ================= TRACKING =================
app.get('/tracking/:order_id', authenticateToken, async (req, res) => {
  try {
    const orderId = Number(req.params.order_id);
    if (!orderId) {
      return res.status(400).json({ status: 'fail', message: 'Order id tidak valid' });
    }

    const [orderResult] = await db.query('SELECT id, user_id, driver_id, status, user_lat, user_lng, address FROM orders WHERE id = ?', [orderId]);

    if (orderResult.length === 0) {
      return res.status(404).json({ status: 'fail', message: 'Order tidak ditemukan' });
    }

    const order = orderResult[0];
    if (req.user.role !== 'admin') {
      if (req.user.role === 'user' && req.user.id !== order.user_id) {
        return res.status(403).json({ status: 'fail', message: 'Akses ditolak' });
      }
      if (req.user.role === 'driver' && req.user.id !== order.driver_id) {
        return res.status(403).json({ status: 'fail', message: 'Akses ditolak' });
      }
    }

    const [locations] = await db.query(
      `SELECT lat, lng, created_at
       FROM driver_locations
       WHERE order_id = ?
       ORDER BY created_at ASC`,
      [orderId],
    );

    const [driverRows] = await db.query(
      'SELECT nama, nomor_hp, profile_photo FROM users WHERE id = ?',
      [order.driver_id],
    );

    const driverInfo = driverRows[0] || {};
    const latestDriverLocation = locations.length ? locations[locations.length - 1] : null;

    console.log('DRIVER LOCATION:', latestDriverLocation?.lat, latestDriverLocation?.lng);
    console.log('USER LOCATION:', order.user_lat, order.user_lng);

    res.json({
      status: 'success',
      order_status: order.status,
      driver_id: order.driver_id,
      driver_name: driverInfo.nama || 'Petugas',
      driver_phone: driverInfo.nomor_hp || '-',
      driver_photo: driverInfo.profile_photo || null,
      user_lat: order.user_lat ? Number(order.user_lat) : null,
      user_lng: order.user_lng ? Number(order.user_lng) : null,
      address: order.address,
      driver_lat: latestDriverLocation ? Number(latestDriverLocation.lat) : null,
      driver_lng: latestDriverLocation ? Number(latestDriverLocation.lng) : null,
      locations: locations,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ================= WALLET =================
app.post('/admin/add-balance', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { user_id, amount, description, admin_id } = req.body;

    if (!user_id || amount == null || Number(amount) <= 0) {
      return res.status(400).json({ status: 'fail', message: 'user_id dan amount positif wajib diisi' });
    }

    const result = await transactionService.topupUser(Number(user_id), Number(amount), description || 'Admin add balance', admin_id || null);
    res.json({ status: 'success', message: 'Balance berhasil ditambahkan', balance: result });
  } catch (err) {
    if (err.message === 'User not found') {
      return res.status(404).json({ status: 'fail', message: 'User tidak ditemukan' });
    }
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/wallet/:user_id', authenticateToken, async (req, res) => {
  try {
    const userId = Number(req.params.user_id);
    if (!userId) {
      return res.status(400).json({ status: 'fail', message: 'User id tidak valid' });
    }

    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({ status: 'fail', message: 'Akses ditolak' });
    }

    const [result] = await db.query(`
      SELECT balance FROM wallets WHERE user_id = ?
    `, [userId]);

    const balance = result.length > 0 ? result[0].balance : 0;

    res.json({ balance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/withdraw', authenticateToken, async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    const { user_id, amount } = req.body;

    if (!user_id || !amount || amount < 50000) {
      return res.status(400).json({ status: 'fail', message: 'user_id dan amount minimal 50000 wajib diisi' });
    }

    if (req.user.role !== 'admin' && req.user.id !== Number(user_id)) {
      return res.status(403).json({ status: 'fail', message: 'Akses ditolak' });
    }

    await connection.beginTransaction();

    // Get current balance
    const [walletResult] = await connection.query('SELECT balance FROM wallets WHERE user_id = ?', [user_id]);
    const currentBalance = walletResult.length > 0 ? walletResult[0].balance : 0;

    if (currentBalance < amount) {
      await connection.rollback();
      return res.status(400).json({ status: 'fail', message: 'Saldo tidak cukup' });
    }

    // Deduct balance
    await connection.query(`
      UPDATE wallets SET balance = balance - ? WHERE user_id = ?
    `, [amount, user_id]);

    // Insert transaction
    await connection.query(`
      INSERT INTO transactions (user_id, amount, type, description, created_at)
      VALUES (?, ?, 'debit', 'Withdraw', NOW())
    `, [user_id, amount]);

    await connection.commit();
    res.json({ status: 'success', message: 'Withdraw berhasil' });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// ================= APPROVE ORDER & UPDATE SALDO =================
app.patch('/orders/approve/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const orderId = req.params.id;
    const { approved } = req.body; // true or false

    const [orderResult] = await db.query(
      'SELECT user_id, total_harga, status FROM orders WHERE id = ?',
      [orderId]
    );

    if (orderResult.length === 0) {
      return res.status(404).json({ status: 'fail', message: 'Order tidak ditemukan' });
    }

    const order = orderResult[0];

    if (order.status !== 'completed') {
      return res.status(400).json({ status: 'fail', message: 'Order belum completed' });
    }

    if (approved) {
      // Update order status to approved
      await db.query('UPDATE orders SET status = ? WHERE id = ?', ['approved', orderId]);

      // Add to user saldo
      await db.query('UPDATE users SET saldo = saldo + ? WHERE id = ?', [order.total_harga, order.user_id]);

      // Create transaction record
      await db.query(
        'INSERT INTO transactions (user_id, type, amount, description, created_at) VALUES (?, ?, ?, ?, NOW())',
        [order.user_id, 'credit', order.total_harga, `Penjualan sampah order #${orderId}`]
      );

      res.json({ status: 'success', message: 'Order disetujui dan saldo user ditambahkan' });
    } else {
      // Reject order
      await db.query('UPDATE orders SET status = ? WHERE id = ?', ['rejected', orderId]);
      res.json({ status: 'success', message: 'Order ditolak' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});
app.get('/transactions', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { range, start_date, end_date, status, type } = req.query;
    const conditions = [];
    const params = [];

    if (range) {
      switch (range) {
        case 'day':
          conditions.push('DATE(st.created_at) = CURDATE()');
          break;
        case 'week':
          conditions.push('YEARWEEK(st.created_at, 1) = YEARWEEK(CURDATE(), 1)');
          break;
        case 'month':
          conditions.push('YEAR(st.created_at) = YEAR(CURDATE()) AND MONTH(st.created_at) = MONTH(CURDATE())');
          break;
        case 'year':
          conditions.push('YEAR(st.created_at) = YEAR(CURDATE())');
          break;
      }
    }

    if (start_date) {
      conditions.push('DATE(st.created_at) >= ?');
      params.push(start_date);
    }

    if (end_date) {
      conditions.push('DATE(st.created_at) <= ?');
      params.push(end_date);
    }

    if (status) {
      conditions.push('st.status = ?');
      params.push(status);
    }

    if (type) {
      conditions.push('st.type = ?');
      params.push(type);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [result] = await db.query(`
      SELECT st.*, u.nama AS user_name, u.role AS user_role,
        ca.nama AS created_by_name, aa.nama AS approved_by_name,
        o.address, o.status AS order_status
      FROM saldo_transactions st
      LEFT JOIN users u ON st.user_id = u.id
      LEFT JOIN users ca ON st.created_by = ca.id
      LEFT JOIN users aa ON st.approved_by = aa.id
      LEFT JOIN orders o ON st.order_id = o.id
      ${whereClause}
      ORDER BY st.created_at DESC
    `, params);

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ================= CREATE TABLES IF NOT EXISTS =================
(async () => {
  try {
    // Create driver_locations table for realtime tracking
    await db.query(`
      CREATE TABLE IF NOT EXISTS driver_locations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        driver_id INT NOT NULL,
        order_id INT NOT NULL,
        lat DECIMAL(10, 8) NOT NULL,
        lng DECIMAL(11, 8) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (driver_id) REFERENCES users(id),
        FOREIGN KEY (order_id) REFERENCES orders(id),
        INDEX idx_order_id (order_id),
        INDEX idx_driver_id (driver_id),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Create driver_rejected_orders table to store per-driver rejections
    await db.query(`
      CREATE TABLE IF NOT EXISTS driver_rejected_orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        driver_id INT NOT NULL,
        order_id INT NOT NULL,
        rejected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_driver_order (driver_id, order_id),
        INDEX idx_driver_rejected (driver_id, order_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const [driverLocationColumns] = await db.query("SHOW COLUMNS FROM driver_locations WHERE Field = 'id'");
    if (driverLocationColumns.length > 0 && !driverLocationColumns[0].Extra.includes('auto_increment')) {
      await db.query('DROP TABLE IF EXISTS driver_locations_tmp');
      await db.query(`
        CREATE TABLE driver_locations_tmp (
          id INT AUTO_INCREMENT PRIMARY KEY,
          driver_id INT NOT NULL,
          order_id INT NOT NULL,
          lat DECIMAL(10, 8) NOT NULL,
          lng DECIMAL(11, 8) NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_order_id (order_id),
          INDEX idx_driver_id (driver_id),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await db.query(`
        INSERT INTO driver_locations_tmp (driver_id, order_id, lat, lng, created_at)
        SELECT driver_id, order_id, lat, lng, created_at FROM driver_locations
      `);
      await db.query('DROP TABLE driver_locations');
      await db.query('RENAME TABLE driver_locations_tmp TO driver_locations');
      console.log('✓ Recreated driver_locations with AUTO_INCREMENT id');
    }

    console.log('✓ Table driver_locations ready');
  } catch (err) {
    console.error('Error creating tables:', err);
  }
})();

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} sudah digunakan. Hentikan proses lain yang memakai port ini atau atur PORT berbeda di .env`);
    process.exit(1);
  }
  console.error('Server error:', err);
  process.exit(1);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server jalan di port ${PORT} pada 0.0.0.0 dengan Socket.IO`);
});

// ================= GEOJSON SERVING =================
// Serve individual geojson files from project-level api/geojson folder
const fs = require('fs');
const geojsonDir = path.join(__dirname, '..', 'api', 'geojson');

app.get('/api/geojson/:name', async (req, res) => {
  try {
    let name = req.params.name || '';
    if (!name.toLowerCase().endsWith('.geojson')) name = `${name}.geojson`;
    const filePath = path.join(geojsonDir, name);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ status: 'fail', message: 'GeoJSON not found' });
    }
    const content = fs.readFileSync(filePath, 'utf8');
    try {
      const json = JSON.parse(content);
      return res.json(json);
    } catch (err) {
      return res.type('application/json').send(content);
    }
  } catch (err) {
    console.error('Error serving geojson file', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Return combined FeatureCollection of all .geojson files in the folder
app.get('/api/geojson/all', async (req, res) => {
  try {
    if (!fs.existsSync(geojsonDir)) return res.json({ type: 'FeatureCollection', features: [] });
    const files = fs.readdirSync(geojsonDir).filter(f => f.toLowerCase().endsWith('.geojson'));
    const allFeatures = [];
    for (const f of files) {
      try {
        const txt = fs.readFileSync(path.join(geojsonDir, f), 'utf8');
        const j = JSON.parse(txt);
        if (j.type === 'FeatureCollection' && Array.isArray(j.features)) {
          allFeatures.push(...j.features);
        } else if (j.type === 'Feature') {
          allFeatures.push(j);
        } else if (Array.isArray(j)) {
          // array of features
          allFeatures.push(...j);
        }
      } catch (e) {
        console.warn('Skipping invalid geojson', f, e.message);
      }
    }
    return res.json({ type: 'FeatureCollection', features: allFeatures });
  } catch (err) {
    console.error('Error building combined geojson', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ================= UPDATE USER PROFILE =================
app.patch('/users/:id', authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ status: 'fail', message: 'User id tidak valid' });

    // only allow updating own profile or admin
    if (req.user.id !== id && req.user.role !== 'admin') {
      return res.status(403).json({ status: 'fail', message: 'Akses ditolak' });
    }

      const { nama, nomor_hp, profile_photo, current_password, new_password } = req.body;
    const updateFields = [];
    const params = [];

    if (nama !== undefined) { updateFields.push('nama = ?'); params.push(nama); }
    if (nomor_hp !== undefined) { updateFields.push('nomor_hp = ?'); params.push(nomor_hp); }
    if (profile_photo !== undefined) { updateFields.push('profile_photo = ?'); params.push(profile_photo); }

    if (new_password !== undefined) {
      if (!current_password) {
        return res.status(400).json({ status: 'fail', message: 'Password lama diperlukan untuk mengubah password' });
      }
      if (typeof new_password !== 'string' || new_password.length < 6) {
        return res.status(400).json({ status: 'fail', message: 'Password baru minimal 6 karakter' });
      }

      const [userRows] = await db.query('SELECT password FROM users WHERE id = ?', [id]);
      if (!userRows || userRows.length === 0) {
        return res.status(404).json({ status: 'fail', message: 'User tidak ditemukan' });
      }

      const currentHash = userRows[0].password || '';
      const isMatch = await bcrypt.compare(current_password, currentHash);
      if (!isMatch) {
        return res.status(403).json({ status: 'fail', message: 'Password lama tidak cocok' });
      }

      const hashedPassword = await bcrypt.hash(new_password, 10);
      updateFields.push('password = ?');
      params.push(hashedPassword);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ status: 'fail', message: 'Tidak ada field untuk diupdate' });
    }

    params.push(id);
    const sql = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
    const [result] = await db.query(sql, params);
    if (result.affectedRows === 0) return res.status(404).json({ status: 'fail', message: 'User tidak ditemukan' });

    const [rows] = await db.query('SELECT id, nama, email, nomor_hp, role, profile_photo FROM users WHERE id = ?', [id]);
    res.json({ status: 'success', user: rows[0] });
  } catch (err) {
    console.error('Error updating user profile:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});