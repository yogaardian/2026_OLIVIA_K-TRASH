const path = require('path');
const autocannon = require('autocannon');
const { monitorEventLoopDelay } = require('perf_hooks');
const io = require('socket.io-client');
const pidusage = require('pidusage');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const API_BASE = process.env.STRESS_API_URL || process.env.API_URL || 'http://localhost:5000';
const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'dashboard',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_LIMIT || 10),
  queueLimit: 0,
};

const ADMIN_CREDENTIALS = {
  email: process.env.STRESS_ADMIN_EMAIL || 'admin@test.com',
  password: process.env.STRESS_ADMIN_PASSWORD || '123456',
};
const DRIVER_CREDENTIALS = {
  email: process.env.STRESS_DRIVER_EMAIL || 'petugas@test.com',
  password: process.env.STRESS_DRIVER_PASSWORD || '123456',
};
const USER_CREDENTIALS = {
  email: process.env.STRESS_USER_EMAIL || 'user@test.com',
  password: process.env.STRESS_USER_PASSWORD || '123456',
};
const REGISTER_CONCURRENCY = Number(process.env.STRESS_REGISTER_CONCURRENCY || 20);
const DURATION = Number(process.env.STRESS_DURATION || 10);
const SLOW_QUERY_THRESHOLD = Number(process.env.STRESS_SLOW_QUERY_MS || 100);
const SOCKET_CLIENT_COUNTS = [50, 100, 250];
const TEST_ORDER_ID = process.env.STRESS_ORDER_ID ? Number(process.env.STRESS_ORDER_ID) : null;
const MAX_ENDPOINT_LEVELS = [50, 100, 250, 500, 1000];

const label = (text) => `[1m${text}[22m`;
const green = (text) => `[32m${text}[39m`;
const yellow = (text) => `[33m${text}[39m`;
const red = (text) => `[31m${text}[39m`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const buildHeaders = (token) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

const formatMs = (value) => `${Number(value).toFixed(1)} ms`;
const formatBytes = (value) => `${(value / 1024 / 1024).toFixed(2)} MB`;
const formatPercent = (value) => `${Number(value).toFixed(2)}%`;

const summary = [];

async function fetchJson(url, options = {}) {
  try {
    const response = await fetch(url, options);
    const payload = await response.json();
    return { status: response.status, payload };
  } catch (err) {
    return { status: 0, payload: { error: err.message } };
  }
}

async function login(credentials) {
  const url = `${API_BASE}/api/auth/login`;
  const { status, payload } = await fetchJson(url, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(credentials),
  });

  if (status !== 200 || !payload.token) {
    throw new Error(`Login failed for ${credentials.email}: ${JSON.stringify(payload)}`);
  }

  return payload.token;
}

async function resolveOrderId(pool) {
  if (TEST_ORDER_ID) {
    return TEST_ORDER_ID;
  }

  const [rows] = await pool.query('SELECT id FROM orders ORDER BY id DESC LIMIT 1');
  if (!rows.length) {
    throw new Error('No order record found. Set STRESS_ORDER_ID or seed the orders table.');
  }

  return rows[0].id;
}

async function resolveCategoryInfo() {
  const url = `${API_BASE}/api/kategori-sampah`;
  const { status, payload } = await fetchJson(url);
  if (status !== 200 || !Array.isArray(payload)) {
    throw new Error(`Failed to read kategori data: ${JSON.stringify(payload)}`);
  }
  if (!payload.length) {
    throw new Error('No kategori_sampah records found in backend. Please seed master data first.');
  }
  const category = payload[0];
  const typesUrl = `${API_BASE}/api/jenis-sampah/kategori/${category.id}`;
  const { status: typeStatus, payload: types } = await fetchJson(typesUrl);
  if (typeStatus !== 200 || !Array.isArray(types)) {
    throw new Error(`Failed to read jenis data for category ${category.id}: ${JSON.stringify(types)}`);
  }
  return { category, types };
}

function collectStatusCodes(statusCodes = {}) {
  const totals = Object.entries(statusCodes).reduce(
    (result, [code, count]) => {
      if (code.startsWith('2')) {
        result.success += count;
      } else {
        result.fail += count;
      }
      return result;
    },
    { success: 0, fail: 0 }
  );
  return totals;
}

async function captureProcessMetrics(durationMs) {
  const samples = [];
  const loopDelayMonitor = monitorEventLoopDelay({ resolution: 20 });
  loopDelayMonitor.enable();

  const interval = setInterval(async () => {
    try {
      const stats = await pidusage(process.pid);
      samples.push(stats);
    } catch (err) {
      console.warn('Unable to sample pidusage:', err.message);
    }
  }, 1000);

  await sleep(durationMs);
  clearInterval(interval);
  loopDelayMonitor.disable();

  const memory = process.memoryUsage();
  const sampleCount = samples.length || 1;
  const cpuAverage = samples.reduce((sum, sample) => sum + (sample.cpu || 0), 0) / sampleCount;
  const memoryAverage = samples.reduce((sum, sample) => sum + (sample.memory || 0), 0) / sampleCount;

  return {
    cpuAverage,
    memoryAverage,
    heapUsed: memory.heapUsed,
    heapTotal: memory.heapTotal,
    eventLoopMean: loopDelayMonitor.mean / 1e6,
    eventLoopP95: loopDelayMonitor.percentile(95) / 1e6,
    eventLoopP99: loopDelayMonitor.percentile(99) / 1e6,
  };
}

async function runAutocannonTest({ name, method, url, body, headers, connections, duration }) {
  const targetUrl = `${API_BASE}${url}`;
  const cannonOptions = {
    url: targetUrl,
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    connections,
    duration,
    warmup: 2,
    headersTimeout: duration * 2000,
  };

  const runStart = Date.now();
  const eventLoop = monitorEventLoopDelay({ resolution: 20 });
  eventLoop.enable();

  const metricsPromise = captureProcessMetrics((duration + 2) * 1000);

  let result;
  try {
    result = await autocannon(cannonOptions);
  } catch (err) {
    eventLoop.disable();
    throw err;
  }

  eventLoop.disable();
  const runtimeMs = Date.now() - runStart;
  const processMetrics = await metricsPromise;

  const statusCounts = collectStatusCodes(result.statusCodes || {});
  const successRatio = result.requests.total ? (statusCounts.success / result.requests.total) * 100 : 0;

  return {
    name,
    url,
    connections,
    duration,
    totalRequests: result.requests.total,
    requestsPerSecond: result.requests.average || 0,
    averageLatency: result.latency.average || 0,
    p95Latency: result.latency.p95 || 0,
    p99Latency: result.latency.p99 || 0,
    successRatio,
    non2xx: statusCounts.fail,
    errors: result.errors || 0,
    timeout: result.timeouts || 0,
    runtimeMs,
    metrics: processMetrics,
  };
}

async function runRegisterStress({ duration, concurrency }) {
  const tokens = [];
  const endTime = Date.now() + duration * 1000;
  let total = 0;
  let failures = 0;
  let totalLatency = 0;

  const workers = Array.from({ length: concurrency }, async () => {
    while (Date.now() < endTime) {
      const email = `stress+${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
      const payload = {
        name: 'Stress Test User',
        email,
        password: 'Stresstest123!',
        role: 'user',
      };
      const start = Date.now();
      try {
        const response = await fetchJson(`${API_BASE}/api/auth/register`, {
          method: 'POST',
          headers: buildHeaders(),
          body: JSON.stringify(payload),
        });
        const elapsed = Date.now() - start;
        totalLatency += elapsed;
        total += 1;
        if (response.status !== 201 && response.status !== 200) {
          failures += 1;
        }
      } catch (err) {
        failures += 1;
      }
    }
  });

  await Promise.all(workers);

  return {
    name: 'Register Endpoint',
    url: '/api/auth/register',
    connections: concurrency,
    duration,
    totalRequests: total,
    requestsPerSecond: total / duration,
    averageLatency: total ? totalLatency / total : 0,
    successRatio: total ? ((total - failures) / total) * 100 : 0,
    non2xx: failures,
    errors: failures,
    timeout: 0,
    runtimeMs: duration * 1000,
    metrics: await captureProcessMetrics(duration * 1000),
  };
}

function printEndpointResult(result) {
  const thresholdMs = 300;
  const pass = result.successRatio >= 99 && result.averageLatency <= thresholdMs && result.errors === 0;
  const labelStatus = pass ? green('PASS') : yellow('WARN');

  console.log(`\n${label(`Endpoint Test: ${result.name}`)} (${labelStatus})`);
  console.log(`URL: ${result.url}`);
  console.log(`Connections: ${result.connections}, Duration: ${result.duration}s`);
  console.log(`Requests/sec: ${result.requestsPerSecond.toFixed(1)}, Total: ${result.totalRequests}`);
  console.log(`Latency avg: ${formatMs(result.averageLatency)}, p95: ${formatMs(result.p95Latency)}, p99: ${formatMs(result.p99Latency)}`);
  console.log(`Success Ratio: ${formatPercent(result.successRatio)}, Errors: ${result.errors}, Non-2xx: ${result.non2xx}`);
  console.log(`CPU avg: ${formatPercent(result.metrics.cpuAverage)}, Mem avg: ${formatBytes(result.metrics.memoryAverage)}`);
  console.log(`Heap used: ${formatBytes(result.metrics.heapUsed)}, Event loop mean: ${formatMs(result.metrics.eventLoopMean)}`);
  summary.push({ ...result, pass });
}

async function runSocketStress(token, count) {
  const startTime = Date.now();
  const sockets = [];
  const results = { connected: 0, failed: 0, messages: 0, disconnects: 0 };
  const orderRoom = `order-room-test-${Date.now()}`;

  const connectClient = async () => {
    return new Promise((resolve) => {
      const socket = io(API_BASE, {
        auth: { token },
        transports: ['websocket'],
        timeout: 10000,
      });

      socket.on('connect', () => {
        results.connected += 1;
        socket.emit('join:order_room', { orderId: orderRoom });
        const interval = setInterval(() => {
          socket.emit('driver:update_location', {
            orderId: orderRoom,
            lat: -7.5 + Math.random() * 0.01,
            lng: 111.5 + Math.random() * 0.01,
          });
        }, 800);
        socket._stressInterval = interval;
        sockets.push(socket);
        resolve();
      });

      socket.on('connect_error', () => {
        results.failed += 1;
        resolve();
      });

      socket.on('disconnect', () => {
        results.disconnects += 1;
      });

      socket.on('driver:location_updated', () => {
        results.messages += 1;
      });
    });
  };

  const connectors = Array.from({ length: count }, connectClient);
  await Promise.all(connectors);

  await sleep(8000);
  for (const socket of sockets) {
    clearInterval(socket._stressInterval);
    socket.disconnect();
  }

  return {
    name: 'Socket.IO Stress',
    url: `${API_BASE} [socket.io]`,
    connections: count,
    duration: (Date.now() - startTime) / 1000,
    totalRequests: results.connected,
    requestsPerSecond: results.connected / ((Date.now() - startTime) / 1000),
    averageLatency: 0,
    p95Latency: 0,
    p99Latency: 0,
    successRatio: count ? (results.connected / count) * 100 : 0,
    non2xx: results.failed,
    errors: results.failed,
    timeout: 0,
    runtimeMs: Date.now() - startTime,
    metrics: await captureProcessMetrics(10 * 1000),
    payload: results,
  };
}

async function runDatabaseStress() {
  const pool = mysql.createPool(DB_CONFIG);
  const endTime = Date.now() + DURATION * 1000;
  const activeQueries = [];
  const queryTimes = [];
  let totalErrors = 0;

  const work = async () => {
    while (Date.now() < endTime) {
      const start = Date.now();
      try {
        await pool.query('SELECT COUNT(*) AS count FROM orders');
        await pool.query('SELECT COUNT(*) AS count FROM kategori_sampah');
        queryTimes.push(Date.now() - start);
      } catch (err) {
        totalErrors += 1;
      }
    }
  };

  for (let i = 0; i < Math.min(DB_CONFIG.connectionLimit, 10); i += 1) {
    activeQueries.push(work());
  }
  await Promise.all(activeQueries);
  const stats = await pidusage(process.pid);
  await pool.end();

  const averageMs = queryTimes.length ? queryTimes.reduce((sum, item) => sum + item, 0) / queryTimes.length : 0;

  const poolInfo = {
    allConnections: pool._allConnections ? pool._allConnections.length : null,
    freeConnections: pool._freeConnections ? pool._freeConnections.length : null,
  };

  const result = {
    name: 'Database Stress',
    url: `mysql://${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}`,
    connections: DB_CONFIG.connectionLimit,
    duration: DURATION,
    totalRequests: queryTimes.length,
    requestsPerSecond: queryTimes.length / DURATION,
    averageLatency: averageMs,
    p95Latency: 0,
    p99Latency: 0,
    successRatio: queryTimes.length ? ((queryTimes.length - totalErrors) / queryTimes.length) * 100 : 0,
    non2xx: totalErrors,
    errors: totalErrors,
    timeout: 0,
    runtimeMs: DURATION * 1000,
    metrics: {
      cpuAverage: stats.cpu,
      memoryAverage: stats.memory,
      heapUsed: process.memoryUsage().heapUsed,
      heapTotal: process.memoryUsage().heapTotal,
      eventLoopMean: 0,
      eventLoopP95: 0,
      eventLoopP99: 0,
      poolInfo,
    },
  };

  printEndpointResult(result);
  return result;
}

async function runEndpointSuite(category, orderId, adminToken, driverToken, userToken) {
  const endpoints = [
    {
      name: 'Login (Admin)',
      method: 'POST',
      url: '/api/auth/login',
      headers: buildHeaders(),
      body: ADMIN_CREDENTIALS,
      token: null,
    },
    {
      name: 'Kategori Sampah',
      method: 'GET',
      url: '/api/kategori-sampah',
      headers: buildHeaders(),
      token: null,
    },
    {
      name: 'Jenis Sampah By Category',
      method: 'GET',
      url: `/api/jenis-sampah/kategori/${category.id}`,
      headers: buildHeaders(),
      token: null,
    },
    {
      name: 'Harga Sampah By Category',
      method: 'GET',
      url: `/harga/${encodeURIComponent(category.nama_kategori.toLowerCase())}`,
      headers: buildHeaders(),
      token: null,
    },
    {
      name: 'Order Tracking',
      method: 'GET',
      url: `/tracking/${orderId}`,
      headers: buildHeaders(userToken),
      token: userToken,
    },
    {
      name: 'Dashboard Admin',
      method: 'GET',
      url: '/stats/dashboard',
      headers: buildHeaders(adminToken),
      token: adminToken,
    },
    {
      name: 'Pending Orders (Petugas)',
      method: 'GET',
      url: '/orders/pending',
      headers: buildHeaders(driverToken),
      token: driverToken,
    },
    {
      name: 'Driver Update Location',
      method: 'POST',
      url: '/driver/location',
      headers: buildHeaders(driverToken),
      body: { orderId, lat: -7.56, lng: 111.54 },
      token: driverToken,
    },
  ]; 

  for (const concurrency of MAX_ENDPOINT_LEVELS) {
    for (const endpoint of endpoints) {
      try {
        const result = await runAutocannonTest({
          name: endpoint.name,
          method: endpoint.method,
          url: endpoint.url,
          body: endpoint.body,
          headers: endpoint.headers,
          connections: concurrency,
          duration: DURATION,
        });
        printEndpointResult(result);
      } catch (err) {
        console.error(red(`Error testing ${endpoint.name} @ ${concurrency} connections:`), err.message);
        summary.push({ name: endpoint.name, connections: concurrency, pass: false, error: err.message });
      }
    }
  }
}

async function runAll() {
  console.log(label('=== K-Trash Backend Stress Test ==='));
  console.log(`API Base: ${API_BASE}`);
  console.log(`Duration per run: ${DURATION}s, Register concurrency: ${REGISTER_CONCURRENCY}`);
  console.log(`Socket client targets: ${SOCKET_CLIENT_COUNTS.join(', ')}`);
  console.log('Reading environment and verifying connectivity...\n');

  const pool = mysql.createPool(DB_CONFIG);

  try {
    const adminToken = await login(ADMIN_CREDENTIALS);
    const driverToken = await login(DRIVER_CREDENTIALS);
    const userToken = await login(USER_CREDENTIALS);
    const orderId = await resolveOrderId(pool);
    const { category } = await resolveCategoryInfo();

    console.log(green('Auth and backend data validation succeeded.')); 
    console.log(`Using order id: ${orderId}`);
    console.log(`Using category: ${category.nama_kategori} (#${category.id})\n`);

    console.log(label('Running Database Stress Test...'));
    await runDatabaseStress();

    console.log(label('\nRunning API Endpoint Stress Suite...'));
    await runEndpointSuite(category, orderId, adminToken, driverToken, userToken);

    console.log(label('\nRunning Register Endpoint Stress Test...'));
    const registerResult = await runRegisterStress({ duration: DURATION, concurrency: REGISTER_CONCURRENCY });
    printEndpointResult(registerResult);

    console.log(label('\nRunning Socket.IO Stress Tests...'));
    for (const clients of SOCKET_CLIENT_COUNTS) {
      const socketResult = await runSocketStress(driverToken, clients);
      printEndpointResult(socketResult);
    }

    const passedTests = summary.filter((item) => item.pass).length;
    const totalTests = summary.length;
    const overallPass = summary.every((item) => item.pass);

    console.log('\n' + label('=== Stress Test Summary ==='));
    console.log(`Total tests executed: ${totalTests}`);
    console.log(`Passed: ${passedTests}, Failed/Warn: ${totalTests - passedTests}`);
    console.log(`Overall verdict: ${overallPass ? green('PRODUCTION-READY') : yellow('FURTHER TUNING REQUIRED')}`);

    if (!overallPass) {
      console.log(red('Review individual warnings and failure lines above.'));
    }
  } catch (err) {
    console.error(red('Stress test execution failed:'), err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runAll();
