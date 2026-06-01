# K-TRASH Backend Realtime Architecture Guide

## Overview
This guide explains how to emit realtime socket events and integrate them with existing endpoints.

## Socket Events

### Order Events
- `order:created` - New order created
- `order:searching_driver` - Order searching for driver
- `order:driver_assigned` / `order:accepted` - Driver accepted the order
- `order:on_the_way` - Driver on the way to user
- `order:arrived` - Driver arrived at location
- `order:completed` - Order completed
- `order:cancelled` - Order cancelled

### Location Events
- `driver:location_updated` - Driver location update

### Notification Events
- `notification:new` - New system notification

## Integration Points

### 1. Accept Order Endpoint - `/api/orders/accept/:id`

Current code:
```javascript
app.patch('/orders/accept/:id', authenticateToken, requireRole(['driver','petugas']), async (req, res) => {
  try {
    const { driver_id } = req.body;
    const orderId = req.params.id;

    const sql = `
      UPDATE orders
      SET driver_id = ?, status = 'assigned'
      WHERE id = ? AND status = 'pending'
    `;

    const [result] = await db.query(sql, [driver_id, orderId]);

    if (result.affectedRows === 0) {
      return res.status(400).json({ status: 'fail', message: 'Order sudah diambil' });
    }

    res.json({ status: 'success' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});
```

Update to:
```javascript
const socketService = require('./src/services/socketService');
const socketEvents = require('./src/constants/socketEvents');

app.patch('/orders/accept/:id', authenticateToken, requireRole(['driver','petugas']), async (req, res) => {
  try {
    const { driver_id } = req.body;
    const orderId = req.params.id;

    const sql = `
      UPDATE orders
      SET driver_id = ?, status = 'assigned'
      WHERE id = ? AND status = 'pending'
    `;

    const [result] = await db.query(sql, [driver_id, orderId]);

    if (result.affectedRows === 0) {
      return res.status(400).json({ status: 'fail', message: 'Order sudah diambil' });
    }

    // Fetch updated order details
    const [orders] = await db.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    const order = orders[0];

    // REALTIME: Emit to user - order accepted by driver
    socketService.emitToUser(
      order.user_id,
      socketEvents.SERVER.ORDER_ACCEPTED,
      {
        orderId: order.id,
        driverId: driver_id,
        status: 'assigned',
        message: 'Driver menerima pesanan Anda',
      }
    );

    // REALTIME: Emit to order room - for all participants
    socketService.emitToOrder(
      orderId,
      socketEvents.SERVER.ORDER_DRIVER_ASSIGNED,
      {
        orderId: order.id,
        driverId: driver_id,
        status: 'assigned',
        timestamp: new Date().toISOString(),
      }
    );

    // Send notification to user
    socketService.sendNotification(
      order.user_id,
      'Pesanan Diterima',
      `Driver sedang menuju lokasi Anda`,
      'success'
    );

    res.json({ status: 'success', order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});
```

### 2. Update Order Status Endpoint - `/api/orders/status/:id`

Add realtime emission after status update:

```javascript
const socketService = require('./src/services/socketService');
const socketEvents = require('./src/constants/socketEvents');

app.patch('/orders/status/:id', authenticateToken, requireRole(['driver','petugas']), async (req, res) => {
  let connection;
  try {
    const { driver_id, status, sampah_data, total_berat, total_harga } = req.body;
    const orderId = req.params.id;

    // ... validation code ...

    connection = await db.getConnection();
    await connection.beginTransaction();

    // ... existing status update code ...

    await connection.commit();

    // REALTIME: Emit status change to all participants
    const [orders] = await db.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    const order = orders[0];

    socketService.emitToOrder(
      orderId,
      socketEvents.SERVER.ORDER_STATUS_CHANGED,
      {
        orderId: order.id,
        newStatus: status,
        driverId: driver_id,
        timestamp: new Date().toISOString(),
      }
    );

    // Notify user of status change
    socketService.sendNotification(
      order.user_id,
      'Status Pesanan Berubah',
      `Pesanan Anda sekarang: ${status}`,
      'info'
    );

    res.json({ status: 'success', message: 'Status order berhasil diperbarui' });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  } finally {
    if (connection) connection.release();
  }
});
```

### 3. Driver Location Update - `/api/driver/location`

Add realtime emission:

```javascript
const socketService = require('./src/services/socketService');
const socketEvents = require('./src/constants/socketEvents');

app.post('/driver/location', authenticateToken, requireRole(['driver','petugas']), async (req, res) => {
  try {
    const { driver_id, order_id, lat, lng } = req.body;

    if (!driver_id || !order_id || lat == null || lng == null) {
      return res.status(400).json({ status: 'fail', message: 'driver_id, order_id, lat, lng wajib diisi' });
    }

    // ... existing validation code ...

    await db.query(
      'INSERT INTO driver_locations (driver_id, order_id, lat, lng) VALUES (?, ?, ?, ?)',
      [driver_id, order_id, lat, lng],
    );

    // REALTIME: Emit driver location update to order room
    socketService.emitToOrder(
      order_id,
      socketEvents.SERVER.DRIVER_LOCATION_UPDATED,
      {
        orderId: order_id,
        driverId: driver_id,
        lat,
        lng,
        timestamp: new Date().toISOString(),
      }
    );

    res.json({ status: 'success', message: 'Lokasi driver tersimpan' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});
```

### 4. Create Order - Add Socket Emission

```javascript
const socketService = require('./src/services/socketService');
const socketEvents = require('./src/constants/socketEvents');

app.post('/orders', authenticateToken, requireRole(['user', 'driver']), async (req, res) => {
  try {
    const { user_id, address, user_lat, user_lng, jenis_sampah, catatan } = req.body;

    const sql = `
      INSERT INTO orders (user_id, address, user_lat, user_lng, jenis_sampah, catatan, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())
    `;

    const [result] = await db.query(sql, [user_id, address, user_lat, user_lng, jenis_sampah, catatan]);

    const orderId = result.insertId;
    const [orders] = await db.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    const order = orders[0];

    // REALTIME: Emit to all drivers - new order available
    socketService.emitToAllDrivers(
      socketEvents.SERVER.ORDER_CREATED,
      {
        order,
        message: 'Pesanan baru tersedia',
      }
    );

    // Notify user
    socketService.sendNotification(
      user_id,
      'Pesanan Dibuat',
      'Pesanan Anda telah dibuat dan menunggu driver',
      'success'
    );

    res.json({ status: 'success', order_id: orderId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});
```

## Implementation Checklist

### Immediate (Critical)
- [ ] Add socketService imports to index.js
- [ ] Add socketEvents imports to index.js
- [ ] Update `/orders/accept/:id` endpoint with socket emission
- [ ] Update `/orders/status/:id` endpoint with socket emission
- [ ] Update `/driver/location` endpoint with socket emission
- [ ] Test socket connections with frontend

### Phase 2
- [ ] Add socket emission to `/orders` (create order)
- [ ] Add socket emission to order cancel endpoint
- [ ] Add socket emission to order complete endpoint
- [ ] Implement rate limiting for socket events
- [ ] Add request validation middleware

### Phase 3
- [ ] Implement socket message compression
- [ ] Add socket connection pooling
- [ ] Implement socket reconnection strategy
- [ ] Add socket health checks
- [ ] Monitor socket connections

## Testing Socket Events

### Backend Testing

1. Connect test socket client:
```javascript
const io = require('socket.io-client');
const socket = io('http://localhost:5000', {
  auth: {
    token: 'your_jwt_token_here'
  }
});

socket.on('connect', () => console.log('Connected'));
socket.on('auth:success', (data) => console.log('Auth success:', data));
socket.on('order:accepted', (data) => console.log('Order accepted:', data));
```

2. Simulate order acceptance:
```bash
curl -X PATCH http://localhost:5000/orders/accept/1 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"driver_id": 2}'
```

### Frontend Testing

1. Check socket connection in browser console:
```javascript
// In React component with useSocket hook
console.log('Socket connected:', isConnected);
console.log('Socket ID:', socket?.id);
```

2. Listen to events:
```javascript
subscribe('order:accepted', (data) => {
  console.log('Order accepted:', data);
  // Should trigger redirect to tracking
});
```

## Race Condition Prevention

### Database Locking
Use SELECT FOR UPDATE to prevent race conditions on concurrent requests:

```javascript
const [order] = await connection.query(
  'SELECT * FROM orders WHERE id = ? FOR UPDATE',
  [orderId]
);

// Update safely
if (order[0].status === 'pending') {
  await connection.query('UPDATE orders SET status = ? WHERE id = ?', ['assigned', orderId]);
}
```

### Socket Event Ordering
- Always emit AFTER database commit
- Use transaction to ensure atomicity
- Client-side optimistic updates with server verification
- Server is source of truth

### Duplicate Prevention
- Check status before update
- Use unique constraints in database
- Add idempotency keys if needed
- Emit only on successful database update

## Monitoring

### Socket Health Checks
```javascript
// In socket handlers
setInterval(() => {
  const sockets = io.sockets.sockets;
  console.log(`Active connections: ${sockets.size}`);
  Object.values(sockets).forEach(socket => {
    if (socket.userId) {
      console.log(`  User ${socket.userId}: ${socket.id}`);
    }
  });
}, 60000); // Every minute
```

### Error Logging
All socket errors should be logged with context:
```javascript
socket.on('error', (err) => {
  console.error(`Socket error for user ${socket.userId}:`, {
    error: err.message,
    userId: socket.userId,
    timestamp: new Date().toISOString(),
    socketId: socket.id,
  });
});
```

## Production Deployment

### Railway/Vercel Considerations
1. Socket.IO needs persistent connection
2. Use Redis adapter for multiple server instances:
```bash
npm install socket.io-redis
```

3. Configure in index.js:
```javascript
const redisAdapter = require('socket.io-redis');
const redis = require('redis');
const pubClient = redis.createClient();
const subClient = redis.createClient();

io.adapter(redisAdapter({
  pubClient,
  subClient,
}));
```

4. Enable WebSocket on Vercel serverless functions (not recommended)
   - Better: Use Railway for WebSocket support

## Security Considerations

- [ ] Always validate JWT token in socket auth middleware
- [ ] Sanitize all socket event data
- [ ] Rate limit socket events per user
- [ ] Validate user role before emitting sensitive data
- [ ] Use encryption for sensitive data in transit
- [ ] Implement socket message validation schema
- [ ] Log all critical socket events
- [ ] Monitor for suspicious connection patterns
