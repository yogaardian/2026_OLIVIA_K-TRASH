/**
 * Socket.IO Handler
 * Manages socket connections, room joins, and event listeners
 */

const socketEvents = require('../constants/socketEvents');
const socketService = require('../services/socketService');
const db = require('../db');

const sendUserCurrentOrderState = async (socket, userId) => {
  try {
    console.log('[Socket] sendUserCurrentOrderState for user:', userId);
    const [orders] = await db.query(
      `SELECT * FROM orders WHERE user_id = ? AND status IN (?, ?, ?, ?, ?) ORDER BY id DESC LIMIT 1`,
      [userId, 'pending', 'searching_driver', 'assigned', 'on_the_way', 'arrived']
    );
    if (orders.length > 0) {
      console.log('[Socket] Emitting ORDER_STATE to user:', { userId, orderId: orders[0].id });
      socket.emit(socketEvents.SERVER.ORDER_STATE, { order: orders[0] });
    } else {
      console.log('[Socket] No active orders found for user:', userId);
    }
  } catch (err) {
    console.error('Error sending current order state to user:', err);
  }
};

const setupSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    console.log(`[Socket] User connected: ${socket.id} (User ID: ${socket.userId})`);

    // Join user-specific room
    if (socket.userId) {
      socket.join(`${socketEvents.ROOMS.USER_PREFIX}${socket.userId}`);
      console.log(`[Socket] User ${socket.userId} joined personal room`);
      if (socket.userRole === 'user') {
        sendUserCurrentOrderState(socket, socket.userId);
      }
    }

    // Join role-specific room
    if (socket.userRole === 'user') {
      socket.join(socketEvents.ROOMS.USERS);
    } else if (socket.userRole === 'driver' || socket.userRole === 'petugas') {
      socket.join(socketEvents.ROOMS.DRIVERS);
    } else if (socket.userRole === 'admin') {
      socket.join(socketEvents.ROOMS.ADMIN);
    }

    // Send authentication success
    socket.emit(socketEvents.SERVER.AUTHENTICATED, {
      userId: socket.userId,
      userRole: socket.userRole,
      userEmail: socket.userEmail,
      timestamp: new Date().toISOString(),
    });

    // ==========================================
    // Order Room Events
    // ==========================================

    /**
     * User/Driver joins order room for real-time tracking
     */
    socket.on(socketEvents.CLIENT.JOIN_ORDER_ROOM, async (data) => {
      const { orderId } = data;
      if (!orderId) return;

      socket.join(`${socketEvents.ROOMS.ORDER_PREFIX}${orderId}`);
      console.log(
        `[Socket] User ${socket.userId} joined order room: ${orderId}`
      );

      // Send current order state to the user
      try {
        console.log('[Socket] JOIN_ORDER_ROOM - fetching order state for:', orderId);
        const [orders] = await db.query(
          'SELECT * FROM orders WHERE id = ?',
          [orderId]
        );
        if (orders.length > 0) {
          console.log('[Socket] Emitting ORDER_STATE on join for order:', orderId);
          socket.emit(socketEvents.SERVER.ORDER_STATE, { order: orders[0] });
        } else {
          console.log('[Socket] Order not found:', orderId);
        }
      } catch (err) {
        console.error('Error fetching order state:', err);
      }
    });

    /**
     * User/Driver leaves order room
     */
    socket.on(socketEvents.CLIENT.LEAVE_ORDER_ROOM, (data) => {
      const { orderId } = data;
      if (!orderId) return;

      socket.leave(`${socketEvents.ROOMS.ORDER_PREFIX}${orderId}`);
      console.log(
        `[Socket] User ${socket.userId} left order room: ${orderId}`
      );
    });

    // ==========================================
    // Driver Location Events
    // ==========================================

    /**
     * Driver updates location in real-time
     */
    socket.on(socketEvents.CLIENT.UPDATE_LOCATION, async (data) => {
      const { orderId, lat, lng } = data;
      if (!orderId || lat == null || lng == null) return;

      try {
        // Store location in database
        await db.query(
          'INSERT INTO driver_locations (driver_id, order_id, lat, lng) VALUES (?, ?, ?, ?)',
          [socket.userId, orderId, lat, lng]
        );

        // Emit to all users in this order room
        socketService.emitToOrder(orderId, socketEvents.SERVER.DRIVER_LOCATION_UPDATED, {
          orderId,
          driverId: socket.userId,
          lat,
          lng,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Error saving driver location:', err);
      }
    });

    // ==========================================
    // Disconnect Event
    // ==========================================

    socket.on('disconnect', (reason) => {
      console.log(
        `[Socket] User disconnected: ${socket.id} (User ID: ${socket.userId}) reason=${reason}`
      );
    });

    // ==========================================
    // Error Handling
    // ==========================================

    socket.on('error', (err) => {
      console.error(`[Socket] Error for user ${socket.userId}:`, err);
    });
  });

  console.log('✅ Socket handlers registered');
};

module.exports = setupSocketHandlers;
