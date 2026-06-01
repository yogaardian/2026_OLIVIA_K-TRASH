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
const helmet = require('helmet');
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
app.use(helmet());
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
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});
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

  // Create waste master tables if not exist
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS kategori_sampah (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama_kategori VARCHAR(100) NOT NULL UNIQUE,
        deskripsi TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS jenis_sampah (
        id INT AUTO_INCREMENT PRIMARY KEY,
        kategori_id INT NOT NULL,
        nama_jenis VARCHAR(150) NOT NULL,
        harga_per_kg INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_jenis_per_kategori (kategori_id, nama_jenis),
        INDEX idx_kategori_id (kategori_id),
        CONSTRAINT fk_jenis_kategori FOREIGN KEY (kategori_id)
          REFERENCES kategori_sampah(id)
          ON DELETE CASCADE
          ON UPDATE CASCADE
      )
    `);

    const [categoryCount] = await db.query('SELECT COUNT(*) AS count FROM kategori_sampah');
    if (categoryCount[0].count === 0) {
      const categories = [
        { nama_kategori: 'Organik', deskripsi: 'Sampah organik seperti sisa makanan dan daun.' },
        { nama_kategori: 'Anorganik', deskripsi: 'Sampah anorganik seperti plastik, kaca, dan kertas.' },
        { nama_kategori: 'Elektronik', deskripsi: 'Sampah elektronik dan kabel bekas.' },
        { nama_kategori: 'Logam', deskripsi: 'Sampah logam seperti besi, aluminium, dan tembaga.' },
        { nama_kategori: 'Plastik', deskripsi: 'Berbagai jenis sampah plastik.' },
      ];

      for (const category of categories) {
        await db.query(
          'INSERT INTO kategori_sampah (nama_kategori, deskripsi) VALUES (?, ?)',
          [category.nama_kategori, category.deskripsi]
        );
      }
    }

    const [typeCount] = await db.query('SELECT COUNT(*) AS count FROM jenis_sampah');
    if (typeCount[0].count === 0) {
      const [categories] = await db.query('SELECT id, nama_kategori FROM kategori_sampah');
      const categoryMap = categories.reduce((acc, item) => {
        acc[item.nama_kategori.toLowerCase()] = item.id;
        return acc;
      }, {});

      const wasteTypes = [
        { kategori: 'Organik', nama_jenis: 'Daun', harga_per_kg: 500 },
        { kategori: 'Organik', nama_jenis: 'Sisa Makanan', harga_per_kg: 300 },
        { kategori: 'Anorganik', nama_jenis: 'Botol Plastik PET', harga_per_kg: 4000 },
        { kategori: 'Anorganik', nama_jenis: 'Kardus', harga_per_kg: 2000 },
        { kategori: 'Anorganik', nama_jenis: 'Kaleng', harga_per_kg: 4500 },
        { kategori: 'Elektronik', nama_jenis: 'Kabel Bekas', harga_per_kg: 2000 },
        { kategori: 'Elektronik', nama_jenis: 'Charger Bekas', harga_per_kg: 1500 },
        { kategori: 'Logam', nama_jenis: 'Besi', harga_per_kg: 5000 },
        { kategori: 'Logam', nama_jenis: 'Aluminium', harga_per_kg: 15000 },
        { kategori: 'Plastik', nama_jenis: 'Botol Plastik', harga_per_kg: 3000 },
      ];

      for (const item of wasteTypes) {
        const categoryId = categoryMap[item.kategori.toLowerCase()];
        if (!categoryId) continue;
        await db.query(
          'INSERT INTO jenis_sampah (kategori_id, nama_jenis, harga_per_kg) VALUES (?, ?, ?)',
          [categoryId, item.nama_jenis, item.harga_per_kg]
        );
      }
    }
  } catch (err) {
    console.error('Error creating waste master tables:', err);
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
    console.log('Ensured users table has saldo, saldo_hold, and updated_at columns');
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
    const jenis = String(req.params.jenis || '').trim();
    const [rows] = await db.query(
      `SELECT jt.id, jt.nama_jenis AS sub_jenis, jt.harga_per_kg AS harga
       FROM jenis_sampah jt
       JOIN kategori_sampah k ON jt.kategori_id = k.id
       WHERE LOWER(k.nama_kategori) = LOWER(?)
       ORDER BY jt.nama_jenis ASC`,
      [jenis]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/harga/:jenis/:sub', async (req, res) => {
  try {
    const jenis = String(req.params.jenis || '').trim();
    const sub = String(req.params.sub || '').trim();

    const [rows] = await db.query(
      `SELECT jt.id, jt.nama_jenis AS sub_jenis, jt.harga_per_kg AS harga
       FROM jenis_sampah jt
       JOIN kategori_sampah k ON jt.kategori_id = k.id
       WHERE LOWER(k.nama_kategori) = LOWER(?) AND LOWER(jt.nama_jenis) = LOWER(?)
       ORDER BY jt.nama_jenis ASC`,
      [jenis, sub]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/harga', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { jenis, sub_jenis, harga } = req.body;
    if (!jenis || !sub_jenis || harga == null) {
      return res.status(400).json({ status: 'fail', message: 'jenis, sub_jenis, harga wajib diisi' });
    }

    const [categoryRows] = await db.query(
      'SELECT id FROM kategori_sampah WHERE LOWER(nama_kategori) = LOWER(?)',
      [String(jenis).trim()]
    );

    if (!categoryRows.length) {
      return res.status(404).json({ status: 'fail', message: 'Kategori sampah tidak ditemukan' });
    }

    const kategoriId = categoryRows[0].id;
    const [existing] = await db.query(
      'SELECT id FROM jenis_sampah WHERE kategori_id = ? AND LOWER(nama_jenis) = LOWER(?)',
      [kategoriId, String(sub_jenis).trim()]
    );
    if (existing.length) {
      return res.status(409).json({ status: 'fail', message: 'Jenis sampah sudah ada pada kategori ini' });
    }

    await db.query(
      'INSERT INTO jenis_sampah (kategori_id, nama_jenis, harga_per_kg) VALUES (?, ?, ?)',
      [kategoriId, String(sub_jenis).trim(), Number(harga)]
    );

    res.json({ status: 'success' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.put('/harga/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { jenis, sub_jenis, harga } = req.body;
    if (!id || !jenis || !sub_jenis || harga == null) {
      return res.status(400).json({ status: 'fail', message: 'jenis, sub_jenis, harga wajib diisi' });
    }

    const [categoryRows] = await db.query(
      'SELECT id FROM kategori_sampah WHERE LOWER(nama_kategori) = LOWER(?)',
      [String(jenis).trim()]
    );
    if (!categoryRows.length) {
      return res.status(404).json({ status: 'fail', message: 'Kategori sampah tidak ditemukan' });
    }

    const kategoriId = categoryRows[0].id;
    const [existing] = await db.query(
      'SELECT id FROM jenis_sampah WHERE kategori_id = ? AND LOWER(nama_jenis) = LOWER(?) AND id <> ?',
      [kategoriId, String(sub_jenis).trim(), id]
    );
    if (existing.length) {
      return res.status(409).json({ status: 'fail', message: 'Jenis sampah sudah ada pada kategori ini' });
    }

    const [result] = await db.query(
      'UPDATE jenis_sampah SET kategori_id = ?, nama_jenis = ?, harga_per_kg = ? WHERE id = ?',
      [kategoriId, String(sub_jenis).trim(), Number(harga), id]
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

app.delete('/harga/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ status: 'fail', message: 'ID tidak valid' });
    }

    const [result] = await db.query('DELETE FROM jenis_sampah WHERE id = ?', [id]);
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
      'SELECT id, user_id, driver_id, address, user_lat, user_lng, jenis_sampah, catatan, status, sampah_data, total_berat, total_harga FROM orders WHERE id = ?',
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
    const orderId = Number(req.params.id);
    const driverId = Number(req.user?.id);
    if (!orderId) return res.status(400).json({ status: 'fail', message: 'Order id tidak valid' });

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query('SELECT id, status, user_id FROM orders WHERE id = ? FOR UPDATE', [orderId]);
      if (rows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ status: 'fail', message: 'Order tidak ditemukan' });
      }
      const order = rows[0];
      if (order.status === 'cancelled' || order.status === 'rejected') {
        await connection.rollback();
        return res.status(400).json({ status: 'fail', message: 'Order sudah dibatalkan oleh pengguna.' });
      }
      if (order.status !== 'pending' && order.status !== 'searching_driver') {
        await connection.rollback();
        return res.status(400).json({ status: 'fail', message: 'Order sudah diambil' });
      }

      await connection.query('UPDATE orders SET driver_id = ?, status = ? WHERE id = ?', [driverId, 'assigned', orderId]);
      await connection.commit();

      // Fetch updated order state for reliable socket emits
      const [updatedOrders] = await connection.query('SELECT * FROM orders WHERE id = ?', [orderId]);
      const updatedOrder = updatedOrders[0] || { id: orderId, status: 'assigned', driver_id: driverId };

      // Emit socket events: order accepted/assigned
      try {
        socketService.emitToOrder(orderId, socketEvents.SERVER.ORDER_STATE, { order: updatedOrder });
        socketService.emitToOrder(orderId, socketEvents.SERVER.ORDER_ACCEPTED, { orderId, driverId });
        socketService.emitToOrder(orderId, socketEvents.SERVER.ORDER_STATUS_CHANGED, { orderId, newStatus: 'assigned' });
        // notify user directly
        socketService.emitToUser(order.user_id, socketEvents.SERVER.ORDER_STATE, { order: updatedOrder });
        socketService.emitToUser(order.user_id, socketEvents.SERVER.ORDER_DRIVER_ASSIGNED, { orderId, driverId });
        // notify drivers to remove order from lists
        socketService.emitToAllDrivers(socketEvents.SERVER.ORDER_CANCELLED, { orderId });
      } catch (e) {
        console.warn('Socket emit failed after accept:', e.message || e);
      }

      return res.json({ status: 'success', message: 'Berhasil ambil order' });
    } catch (e) {
      if (connection) await connection.rollback();
      throw e;
    } finally {
      if (connection) connection.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ================= CANCEL ORDER (by user) =================
app.patch('/orders/cancel/:id', authenticateToken, async (req, res) => {
  const orderId = Number(req.params.id);
  const userId = Number(req.user?.id);
  if (!orderId) return res.status(400).json({ status: 'fail', message: 'Order id tidak valid' });

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query('SELECT id, status, user_id FROM orders WHERE id = ? FOR UPDATE', [orderId]);
    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ status: 'fail', message: 'Order tidak ditemukan' });
    }
    const order = rows[0];
    if (order.user_id !== userId && req.user.role !== 'admin') {
      await connection.rollback();
      return res.status(403).json({ status: 'fail', message: 'Akses ditolak' });
    }
    if (order.status === 'cancelled' || order.status === 'rejected') {
      await connection.rollback();
      return res.status(400).json({ status: 'fail', message: 'Order sudah dibatalkan' });
    }
    // Only allow cancelling when still pending/searching
    if (!['pending', 'searching_driver'].includes(order.status)) {
      await connection.rollback();
      return res.status(400).json({ status: 'fail', message: `Tidak bisa batalkan order dengan status: ${order.status}` });
    }

    await connection.query('UPDATE orders SET status = ? WHERE id = ?', ['cancelled', orderId]);
    await connection.commit();

    // Emit cancelled event to order room, user, and drivers
    try {
      socketService.emitToOrder(orderId, socketEvents.SERVER.ORDER_CANCELLED, { orderId });
      socketService.emitToAllDrivers(socketEvents.SERVER.ORDER_CANCELLED, { orderId });
      socketService.emitToUser(order.user_id, socketEvents.SERVER.ORDER_CANCELLED, { orderId });
    } catch (e) { console.warn('Socket emit failed after cancel:', e.message || e); }

    return res.json({ status: 'success', message: 'Order dibatalkan' });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error('Cancel order error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// ================= UPDATE STATUS =================
app.patch('/orders/status/:id', authenticateToken, requireRole(['driver','petugas']), async (req, res) => {
  let connection;
  try {
    const { status, sampah_data, total_berat, total_harga } = req.body;
    const orderId = req.params.id;
    const driverId = Number(req.user?.id);
    const payloadDriverId = Number(req.body.driver_id);
    const effectiveDriverId = Number.isInteger(payloadDriverId) && payloadDriverId > 0 ? payloadDriverId : driverId;

    const allowed = ['assigned', 'on_the_way', 'arrived', 'completed'];

    if (!effectiveDriverId || !status) {
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
    if (order.driver_id !== effectiveDriverId) {
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
        effectiveDriverId,
      );
    } else {
      await connection.query('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);
    }

    await connection.commit();
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

    res.json({ status: 'success', message: 'Lokasi driver tersimpan' });
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

    const { nama, nomor_hp, profile_photo } = req.body;
    const updateFields = [];
    const params = [];

    if (nama !== undefined) { updateFields.push('nama = ?'); params.push(nama); }
    if (nomor_hp !== undefined) { updateFields.push('nomor_hp = ?'); params.push(nomor_hp); }
    if (profile_photo !== undefined) { updateFields.push('profile_photo = ?'); params.push(profile_photo); }

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