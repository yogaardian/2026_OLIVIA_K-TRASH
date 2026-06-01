const path = require('path');
const os = require('os');
const fs = require('fs');
const axios = require('axios');
const io = require('socket.io-client');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { monitorEventLoopDelay, performance } = require('perf_hooks');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const CONFIG = {
  apiUrl: process.env.STRESS_API_URL || process.env.API_URL || 'http://localhost:5000',
  socketUrl: process.env.STRESS_SOCKET_URL || process.env.SOCKET_URL || process.env.API_URL || 'http://localhost:5000',
  durationMinutes: Number(process.env.STRESS_DURATION || 5),
  userCount: Number(process.env.USER_COUNT || 50),
  petugasCount: Number(process.env.PETUGAS_COUNT || 10),
  adminCount: Number(process.env.ADMIN_COUNT || 1),
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'dashboard',
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL_LIMIT || 30),
    queueLimit: 0,
  },
  slowQueryMs: Number(process.env.STRESS_SLOW_QUERY_MS || 200),
  socketObserverCount: Number(process.env.SOCKET_OBSERVER_COUNT || 20),
  userPassword: process.env.STRESS_USER_PASSWORD || 'Stress123!',
  driverPassword: process.env.STRESS_PETUGAS_PASSWORD || 'Stress123!',
  adminPassword: process.env.STRESS_ADMIN_PASSWORD || 'Stress123!',
};

const LOG_DIR = path.join(__dirname, 'stress-report');
const ERROR_LOG = path.join(LOG_DIR, 'errors.log');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}
fs.writeFileSync(ERROR_LOG, '', { encoding: 'utf8' });

const REPORT = {
  apiRequests: 0,
  apiSuccess: 0,
  apiFailed: 0,
  apiLatencies: [],
  socketConnected: 0,
  socketFailed: 0,
  socketDisconnects: 0,
  socketMessages: 0,
  socketLatencies: [],
  dbQueries: 0,
  dbQueryErrors: 0,
  dbLatencies: [],
  dbSlowQueries: 0,
  ordersCreated: 0,
  ordersCompleted: 0,
  errors: 0,
  warnings: 0,
  monitorSamples: [],
};

const api = axios.create({
  baseURL: CONFIG.apiUrl,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
  validateStatus: () => true,
});

const pool = mysql.createPool(CONFIG.db);
const runStart = Date.now();
const runDeadline = runStart + CONFIG.durationMinutes * 60 * 1000;
let monitorInterval;
let eventLoopMonitor;
let cpuUsageLast = process.cpuUsage();
let cpuTimeLast = performance.now();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const nowSec = () => ((Date.now() - runStart) / 1000).toFixed(1);

function addApiMetrics(durationMs, success) {
  REPORT.apiRequests += 1;
  if (success) REPORT.apiSuccess += 1;
  else REPORT.apiFailed += 1;
  REPORT.apiLatencies.push(durationMs);
}

function addSocketMetrics(latencyMs, success) {
  if (typeof latencyMs === 'number') {
    REPORT.socketLatencies.push(latencyMs);
  }
  if (success) REPORT.socketConnected += 1;
  else REPORT.socketFailed += 1;
}

function addDbMetrics(durationMs, success) {
  REPORT.dbQueries += 1;
  if (!success) REPORT.dbQueryErrors += 1;
  REPORT.dbLatencies.push(durationMs);
  if (durationMs > CONFIG.slowQueryMs) REPORT.dbSlowQueries += 1;
}

function getAverage(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getPercentile(values, percentile) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((percentile / 100) * sorted.length));
  return sorted[index];
}

function formatMs(value) {
  return `${Number(value).toFixed(1)} ms`;
}

function formatBytes(value) {
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

function log(message) {
  process.stdout.write(`[${nowSec()}s] ${message}\n`);
}

function appendErrorLog(entry) {
  try {
    fs.appendFileSync(ERROR_LOG, `${new Date().toISOString()} ${entry}\n`, 'utf8');
  } catch (err) {
    console.error('Failed to write error log:', err.message);
  }
}

function logApiResult(method, url, status, payload) {
  log(`[API] ${method.toUpperCase()} ${url} ${status}`);
  if (status >= 400 || status === 0) {
    appendErrorLog(`[API ERROR] ${method.toUpperCase()} ${url} ${status} ${JSON.stringify(payload)}`);
  }
}

async function dbQuery(sql, params = []) {
  const start = Date.now();
  try {
    const [result] = await pool.query(sql, params);
    const durationMs = Date.now() - start;
    addDbMetrics(durationMs, true);
    log(`[DB] ${sql} ${JSON.stringify(params)} ${durationMs}ms`);
    return result;
  } catch (err) {
    const durationMs = Date.now() - start;
    addDbMetrics(durationMs, false);
    REPORT.errors += 1;
    appendErrorLog(`[DB ERROR] ${sql} ${JSON.stringify(params)} ${err.message}`);
    log(`[DB ERROR] ${sql} ${JSON.stringify(params)} ${durationMs}ms -> ${err.message}`);
    return null;
  }
}

async function apiRequest(method, url, token, data) {
  const config = { method, url, data, headers: {} };
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const start = Date.now();
  try {
    const response = await api(config);
    const durationMs = Date.now() - start;
    const success = response.status >= 200 && response.status < 300;
    addApiMetrics(durationMs, success);
    logApiResult(method, url, response.status, response.data);
    if (!success) {
      REPORT.errors += 1;
    }
    return { success, status: response.status, data: response.data };
  } catch (err) {
    addApiMetrics(Date.now() - start, false);
    REPORT.errors += 1;
    logApiResult(method, url, 0, { error: err.message });
    return { success: false, status: 0, data: { error: err.message } };
  }
}

function randomFrom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomGeo() {
  const lat = -7.545 + Math.random() * 0.04;
  const lng = 111.520 + Math.random() * 0.05;
  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
}

function randomAddress() {
  const streets = ['Jl. Merdeka', 'Jl. Sudirman', 'Jl. Diponegoro', 'Jl. Ahmad Yani', 'Jl. Basuki Rahmat'];
  return `${randomFrom(streets)} No.${Math.ceil(Math.random() * 100)}, Kota Demo`;
}

async function seedRoleAccounts(role, count, password) {
  const stressEmails = Array.from({ length: count }, (_, idx) => `stress-${role}-${idx + 1}@example.com`);
  const existing = await dbQuery('SELECT id, email, role FROM users WHERE email IN (?)', [stressEmails]);
  if (existing === null) return [];

  const hashedPassword = await bcrypt.hash(password, 10);
  const accounts = existing.map((row) => ({ id: row.id, email: row.email, password, role: row.role }));
  const existingEmails = new Set(existing.map((row) => row.email));

  for (let index = 0; index < count; index += 1) {
    const email = stressEmails[index];
    if (!existingEmails.has(email)) {
      const nama = `${role.toUpperCase()} Stress ${index + 1}`;
      const [result] = await pool.query(
        'INSERT INTO users (nama, email, password, role, nomor_hp) VALUES (?, ?, ?, ?, ?)',
        [nama, email, hashedPassword, role, `0812${Math.floor(10000000 + Math.random() * 89999999)}`]
      );
      accounts.push({ id: result.insertId, email, password, role });
    }
  }

  if (existing.length > 0) {
    const existingEmailsArray = existing.map((row) => row.email);
    await pool.query('UPDATE users SET password = ? WHERE email IN (?)', [hashedPassword, existingEmailsArray]);
  }

  return accounts;
}

async function validateSeededAccounts() {
  const users = await seedRoleAccounts('user', CONFIG.userCount, CONFIG.userPassword);
  const petugas = await seedRoleAccounts('petugas', CONFIG.petugasCount, CONFIG.driverPassword);
  const admins = await seedRoleAccounts('admin', CONFIG.adminCount, CONFIG.adminPassword);
  return { users, petugas, admins };
}

async function createSocket(token, orderId, role) {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = io(CONFIG.socketUrl, {
      auth: { token },
      transports: ['websocket'],
      timeout: 15000,
      forceNew: true,
    });

    let joined = false;
    let connected = false;

    socket.on('connect', () => {
      connected = true;
      addSocketMetrics(Date.now() - start, true);
      log(`[SOCKET] connected to ${CONFIG.socketUrl} token=${Boolean(token)} orderId=${orderId || 'none'}`);
      if (orderId) {
        socket.emit('join:order_room', { orderId });
      }
      resolve(socket);
    });

    socket.on('connect_error', (err) => {
      addSocketMetrics(0, false);
      log(`[SOCKET] connect_error ${err?.message || err}`);
      REPORT.socketFailed += 1;
      resolve(null);
    });

    socket.on('error', (err) => {
      log(`[SOCKET] socket error ${err?.message || err}`);
    });

    socket.on('disconnect', (reason) => {
      if (connected) REPORT.socketDisconnects += 1;
      log(`[SOCKET] disconnect reason=${reason}`);
    });

    socket.on('auth:success', (payload) => {
      log(`[SOCKET] auth:success ${JSON.stringify(payload)}`);
    });

    socket.on('auth:error', (payload) => {
      log(`[SOCKET] auth:error ${JSON.stringify(payload)}`);
    });

    socket.on('order:state', () => {
      REPORT.socketMessages += 1;
    });

    socket.on('order:accepted', () => { REPORT.socketMessages += 1; });
    socket.on('order:status_changed', () => { REPORT.socketMessages += 1; });
    socket.on('order:driver_assigned', () => { REPORT.socketMessages += 1; });
    socket.on('driver:location_updated', () => { REPORT.socketMessages += 1; });
    socket.on('notification:new', () => { REPORT.socketMessages += 1; });
    socket.on('error:occurred', (payload) => { REPORT.socketMessages += 1; log(`[SOCKET] server error event ${JSON.stringify(payload)}`); });

    socket.on('disconnect', () => {
      if (connected) REPORT.socketDisconnects += 1;
    });

    socket.on('order:state', () => {
      REPORT.socketMessages += 1;
    });

    socket.on('order:accepted', () => { REPORT.socketMessages += 1; });
    socket.on('order:status_changed', () => { REPORT.socketMessages += 1; });
    socket.on('order:driver_assigned', () => { REPORT.socketMessages += 1; });
    socket.on('driver:location_updated', () => { REPORT.socketMessages += 1; });
    socket.on('notification:new', () => { REPORT.socketMessages += 1; });
  });
}

async function simulateUser(user, index) {
  const result = await apiRequest('post', '/api/auth/login', null, {
    email: user.email,
    password: user.password,
  });
  if (!result.success || !result.data?.token) {
    REPORT.warnings += 1;
    return null;
  }

  const token = result.data.token;
  const profileResult = await apiRequest('post', '/api/auth/validate-token', token, null);
  const profile = profileResult.success ? profileResult.data?.user : null;
  if (!profile) {
    REPORT.warnings += 1;
    return null;
  }

  const categoriesData = categoriesResultFrom(await apiRequest('get', '/api/kategori-sampah', token, null));
  if (!Array.isArray(categoriesData) || categoriesData.length === 0) {
    REPORT.warnings += 1;
    return null;
  }

  const category = randomFrom(categoriesData);
  const typesData = typesDataFrom(await apiRequest('get', `/api/jenis-sampah/kategori/${category.id}`, token, null));
  if (!Array.isArray(typesData) || typesData.length === 0) {
    REPORT.warnings += 1;
    return null;
  }

  const type = randomFrom(typesData);
  const location = randomGeo();
  const orderPayload = {
    user_id: profile.id,
    address: randomAddress(),
    user_lat: location.lat,
    user_lng: location.lng,
    jenis_sampah: type.nama_jenis || type.nama,
    catatan: 'Stress test order',
  };

  const orderResult = await apiRequest('post', '/orders', token, orderPayload);
  if (!orderResult.success || !orderResult.data?.order_id) {
    REPORT.warnings += 1;
    return null;
  }

  REPORT.ordersCreated += 1;
  const orderId = orderResult.data.order_id;
  const socket = await createSocket(token, orderId, 'user');

  const startWait = Date.now();
  while (Date.now() < runDeadline && Date.now() - startWait < 120000) {
    const tracking = await apiRequest('get', `/tracking/${orderId}`, token, null);
    if (tracking.success && tracking.data?.order_status === 'completed') {
      REPORT.ordersCompleted += 1;
      break;
    }
    await sleep(3000);
  }

  if (socket) {
    socket.emit('leave:order_room', { orderId });
    socket.disconnect();
  }

  return orderId;
}

function categoriesResultFrom(apiResult) {
  return Array.isArray(apiResult.data?.data) ? apiResult.data.data : apiResult.data;
}

function typesDataFrom(apiResult) {
  return Array.isArray(apiResult.data?.data) ? apiResult.data.data : apiResult.data;
}

async function updateOrderStatus(orderId, token, status, driverId, extra = {}) {
  return apiRequest('patch', `/orders/status/${orderId}`, token, {
    status,
    driver_id: driverId,
    ...extra,
  });
}

async function simulatePetugas(driver, index) {
  const result = await apiRequest('post', '/api/auth/login', null, {
    email: driver.email,
    password: driver.password,
  });
  if (!result.success || !result.data?.token) {
    REPORT.warnings += 1;
    return null;
  }

  const token = result.data.token;
  const socket = await createSocket(token, null, 'petugas');
  if (!socket) {
    REPORT.warnings += 1;
  }

  while (Date.now() < runDeadline) {
    const pending = await apiRequest('get', '/orders/pending', token, null);
    const orders = pending.success ? (Array.isArray(pending.data?.data) ? pending.data.data : pending.data) : [];
    if (!Array.isArray(orders) || orders.length === 0) {
      await sleep(2000);
      continue;
    }

    const order = randomFrom(orders);
    if (!order?.id) {
      await sleep(2000);
      continue;
    }

    const acceptResult = await apiRequest('patch', `/orders/accept/${order.id}`, token, {
      driver_id: driver.id,
    });
    if (!acceptResult.success) {
      await sleep(1000);
      continue;
    }

    if (socket) {
      socket.emit('join:order_room', { orderId: order.id });
    }

    let location = randomGeo();
    // Send location updates while the order is still assignable / on the way.
    await apiRequest('post', '/driver/location', token, {
      driver_id: driver.id,
      order_id: order.id,
      lat: location.lat,
      lng: location.lng,
    });
    await updateOrderStatus(order.id, token, 'on_the_way', driver.id);
    if (socket) {
      socket.emit('driver:update_location', { orderId: order.id, lat: location.lat, lng: location.lng });
    }
    await sleep(3000);

    await updateOrderStatus(order.id, token, 'arrived', driver.id);
    await sleep(3000);

    await updateOrderStatus(order.id, token, 'completed', driver.id, {
      sampah_data: [{ nama_jenis: 'Plastic', berat: 5 }],
      total_berat: 5,
      total_harga: 50000,
    });

    REPORT.ordersCompleted += 1;
    if (socket) {
      socket.emit('leave:order_room', { orderId: order.id });
    }
    await sleep(1000);
  }

  if (socket) {
    socket.disconnect();
  }

  return true;
}

async function simulateAdmin(admin, index) {
  const result = await apiRequest('post', '/api/auth/login', null, {
    email: admin.email,
    password: admin.password,
  });
  if (!result.success) {
    REPORT.warnings += 1;
    return null;
  }

  const token = result.data.token;
  await apiRequest('get', '/admin/transactions', token, null);
  await apiRequest('get', '/admin/pending-transactions', token, null);
  await apiRequest('get', '/admin/hold-summary', token, null);
  await apiRequest('get', '/admin/settings/hold-balance', token, null);

  const categoryResult = await apiRequest('post', '/api/kategori-sampah', token, {
    nama_kategori: `Stress Kategori ${Date.now()}-${index}`,
    deskripsi: 'Stress test category',
  });

  const categoryId = categoryResult.success && categoryResult.data?.id ? categoryResult.data.id : null;
  if (!categoryId) {
    REPORT.warnings += 1;
    return null;
  }

  const typeResult = await apiRequest('post', '/api/jenis-sampah', token, {
    kategori_id: categoryId,
    nama_jenis: `Stress Jenis ${Date.now()}-${index}`,
    harga_per_kg: 2500,
  });
  const typeId = typeResult.success && typeResult.data?.id ? typeResult.data.id : null;

  if (typeId) {
    await apiRequest('put', `/api/jenis-sampah/${typeId}`, token, {
      kategori_id: categoryId,
      nama_jenis: `Stress Jenis ${Date.now()}-${index}-updated`,
      harga_per_kg: 3500,
    });
    await apiRequest('delete', `/api/jenis-sampah/${typeId}`, token, null);
  }

  if (categoryId) {
    await apiRequest('put', `/api/kategori-sampah/${categoryId}`, token, {
      nama_kategori: `Stress Kategori ${Date.now()}-${index}-updated`,
      deskripsi: 'Stress test category updated',
    });
    await apiRequest('delete', `/api/kategori-sampah/${categoryId}`, token, null);
  }

  await apiRequest('get', '/admin/transactions', token, null);
  await apiRequest('get', '/admin/pending-transactions', token, null);

  return true;
}

async function monitorServer() {
  eventLoopMonitor = monitorEventLoopDelay({ resolution: 20 });
  eventLoopMonitor.enable();

  monitorInterval = setInterval(() => {
    const now = Date.now();
    const cpuTimeNow = performance.now();
    const cpuUsageNow = process.cpuUsage();
    const intervalMs = cpuTimeNow - cpuTimeLast;
    const cpuDiffMicros = (cpuUsageNow.user - cpuUsageLast.user) + (cpuUsageNow.system - cpuUsageLast.system);
    const cores = os.cpus().length || 1;
    const cpuPercent = intervalMs > 0 ? clamp(((cpuDiffMicros / 1000) / intervalMs / cores) * 100, 0, 100) : 0;
    cpuTimeLast = cpuTimeNow;
    cpuUsageLast = cpuUsageNow;

    const memory = process.memoryUsage();
    REPORT.monitorSamples.push({
      timestamp: now,
      cpuPercent,
      rss: memory.rss,
      heapUsed: memory.heapUsed,
      heapTotal: memory.heapTotal,
      eventLoopMean: eventLoopMonitor.mean / 1e6,
      eventLoopP95: eventLoopMonitor.percentile(95) / 1e6,
      eventLoopP99: eventLoopMonitor.percentile(99) / 1e6,
      activeHandles: process._getActiveHandles ? process._getActiveHandles().length : null,
      activeRequests: process._getActiveRequests ? process._getActiveRequests().length : null,
      poolSize: pool._allConnections ? pool._allConnections.length : null,
      freeConnections: pool._freeConnections ? pool._freeConnections.length : null,
    });
  }, 5000);
}

async function runDbWorkload() {
  const queries = [
    'SELECT COUNT(*) AS count FROM users',
    'SELECT COUNT(*) AS count FROM orders',
    'SELECT COUNT(*) AS count FROM kategori_sampah',
    'SELECT COUNT(*) AS count FROM jenis_sampah',
    'SELECT COUNT(*) AS count FROM driver_locations',
  ];

  while (Date.now() < runDeadline) {
    const query = randomFrom(queries);
    await dbQuery(query);
    await sleep(300 + Math.random() * 400);
  }
}

function buildUserRampStages() {
  const schedule = [50, 100, 250, 500, 1000];
  return schedule.map((target) => Math.min(target, CONFIG.userCount));
}

async function runUserRamp(users) {
  const stageCounts = buildUserRampStages();
  const tasks = [];
  let started = 0;

  for (let minute = 0; minute < stageCounts.length && Date.now() < runDeadline; minute += 1) {
    const target = stageCounts[minute];
    const toStart = Math.max(0, target - started);
    const stageUsers = users.slice(started, started + toStart);
    if (stageUsers.length > 0) {
      log(`Starting user stage ${minute + 1}: ${stageUsers.length} users`);
      tasks.push(...stageUsers.map((user, idx) => simulateUser(user, started + idx)));
      started += stageUsers.length;
    }

    const nextStageTime = runStart + (minute + 1) * 60 * 1000;
    const waitTime = Math.max(0, nextStageTime - Date.now());
    if (waitTime > 0) {
      await sleep(waitTime);
    }
  }

  if (started < users.length && Date.now() < runDeadline) {
    const remaining = users.slice(started);
    tasks.push(...remaining.map((user, idx) => simulateUser(user, started + idx)));
  }

  return Promise.allSettled(tasks);
}

async function runSocketObservers() {
  const sockets = [];
  const account = await apiRequest('post', '/api/auth/login', null, {
    email: process.env.STRESS_USER_EMAIL || 'user@test.com',
    password: process.env.STRESS_USER_PASSWORD || '123456',
  });

  if (!account.success) {
    REPORT.warnings += 1;
    return;
  }

  const token = account.data.token;
  const promises = Array.from({ length: CONFIG.socketObserverCount }, async () => {
    const socket = await createSocket(token, null, 'observer');
    if (!socket) return;

    socket.on('connect', () => {
      log('[SocketObserver] connected');
    });

    sockets.push(socket);
    await sleep(CONFIG.durationMinutes * 60 * 1000);
    socket.disconnect();
  });

  await Promise.all(promises);
}

async function runScenario() {
  log('Starting K-TRASH system stress test');
  log(`Duration: ${CONFIG.durationMinutes} minutes`);
  log(`Users: ${CONFIG.userCount}, Petugas: ${CONFIG.petugasCount}, Admins: ${CONFIG.adminCount}`);

  await monitorServer();
  const { users, petugas, admins } = await validateSeededAccounts();

  const userTask = runUserRamp(users);
  const driverSimulations = petugas.map((driver, index) => simulatePetugas(driver, index));
  const adminSimulations = admins.map((admin, index) => simulateAdmin(admin, index));
  const dbTask = runDbWorkload();

  await Promise.allSettled([
    userTask,
    Promise.allSettled(driverSimulations),
    Promise.allSettled(adminSimulations),
    dbTask,
  ]);

  if (monitorInterval) {
    clearInterval(monitorInterval);
  }
  if (eventLoopMonitor) {
    eventLoopMonitor.disable();
  }

  await pool.end();
  await printReport();
}

async function printReport() {
  const apiAvg = getAverage(REPORT.apiLatencies);
  const apiP95 = getPercentile(REPORT.apiLatencies, 95);
  const socketAvg = getAverage(REPORT.socketLatencies);
  const socketP95 = getPercentile(REPORT.socketLatencies, 95);
  const dbAvg = getAverage(REPORT.dbLatencies);
  const dbMax = REPORT.dbLatencies.length ? Math.max(...REPORT.dbLatencies) : 0;
  const monitorCpuPeak = REPORT.monitorSamples.length ? Math.max(...REPORT.monitorSamples.map((item) => item.cpuPercent)) : 0;
  const monitorMemoryPeak = REPORT.monitorSamples.length ? Math.max(...REPORT.monitorSamples.map((item) => item.rss)) : 0;
  const elapsedSeconds = Math.max(1, (Date.now() - runStart) / 1000);
  const monitorHeapPeak = REPORT.monitorSamples.length ? Math.max(...REPORT.monitorSamples.map((item) => item.heapUsed)) : 0;
  const apiSuccessRate = REPORT.apiRequests ? (REPORT.apiSuccess / REPORT.apiRequests) * 100 : 0;
  const dbErrorRate = REPORT.dbQueries ? (REPORT.dbQueryErrors / REPORT.dbQueries) * 100 : 0;
  const socketSuccessRate = REPORT.socketConnected + REPORT.socketFailed ? (REPORT.socketConnected / (REPORT.socketConnected + REPORT.socketFailed)) * 100 : 0;
  const errorRate = REPORT.errors ? REPORT.errors : 0;
  const requestsPerSecond = REPORT.apiRequests / elapsedSeconds;
  const transactionsPerSecond = REPORT.ordersCompleted / elapsedSeconds;

  const scaleVerdict = (() => {
    if (CONFIG.userCount <= 50 && CONFIG.petugasCount <= 10 && CONFIG.adminCount <= 1) return 'READY FOR SMALL SCALE';
    if (CONFIG.userCount <= 250 && CONFIG.petugasCount <= 50 && CONFIG.adminCount <= 3) return 'READY FOR DISTRICT SCALE';
    if (CONFIG.userCount <= 1000 && CONFIG.petugasCount <= 100 && CONFIG.adminCount <= 5) return 'READY FOR CITY SCALE';
    return 'NOT READY';
  })();

  const passVerdict = apiSuccessRate >= 95 && socketSuccessRate >= 90 && dbErrorRate <= 5 && REPORT.ordersCompleted > 0 ? scaleVerdict : 'NOT READY';

  console.log('\n====================================');
  console.log('K-TRASH SYSTEM STRESS REPORT');
  console.log('====================================');
  console.log(`Users Simulated: ${CONFIG.userCount}`);
  console.log(`Drivers Simulated: ${CONFIG.petugasCount}`);
  console.log(`Admins Simulated: ${CONFIG.adminCount}`);
  console.log(`Duration: ${CONFIG.durationMinutes} minutes`);
  console.log('');
  console.log(`CPU Peak: ${monitorCpuPeak.toFixed(1)}%`);
  console.log(`Memory Peak: ${formatBytes(monitorMemoryPeak)}`);
  console.log(`Heap Peak: ${formatBytes(monitorHeapPeak)}`);
  console.log('');
  console.log(`API Success: ${REPORT.apiSuccess}`);
  console.log(`API Failed: ${REPORT.apiFailed}`);
  console.log('');
  console.log(`Socket Connected: ${REPORT.socketConnected}`);
  console.log(`Socket Failed: ${REPORT.socketFailed}`);
  console.log(`Socket Disconnects: ${REPORT.socketDisconnects}`);
  console.log('');
  console.log(`Orders Created: ${REPORT.ordersCreated}`);
  console.log(`Orders Completed: ${REPORT.ordersCompleted}`);
  console.log('');
  console.log(`Average API Latency: ${formatMs(apiAvg)}`);
  console.log(`P95 API Latency: ${formatMs(apiP95)}`);
  console.log('');
  console.log(`Average Socket Latency: ${formatMs(socketAvg)}`);
  console.log(`P95 Socket Latency: ${formatMs(socketP95)}`);
  console.log('');
  console.log(`Database Average Query: ${formatMs(dbAvg)}`);
  console.log(`Database Peak Query: ${formatMs(dbMax)}`);
  console.log('');
  console.log(`Requests/sec (RPS): ${requestsPerSecond.toFixed(2)}`);
  console.log(`Transactions/sec (TPS): ${transactionsPerSecond.toFixed(2)}`);
  console.log('');
  console.log(`Error Count: ${errorRate}`);
  console.log('');
  console.log('====================================');
  console.log(`VERDICT: ${passVerdict}`);
  console.log('====================================');
}

runScenario().catch((err) => {
  console.error('System stress test failed:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:');
  console.error(err);
});

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:');
  console.error(err);
});