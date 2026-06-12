/**
 * Socket.IO Service
 * Manages socket connections, room management, and event emission
 */

const socketEvents = require('../constants/socketEvents');

let io = null;

const initializeSocket = (socketIoInstance) => {
  io = socketIoInstance;
  console.log('✅ Socket.IO initialized');
};

const getIO = () => io;

const isValidEventName = (event) => typeof event === 'string' && event.trim().length > 0;

const safeEmit = (socketTarget, event, data, targetDescription) => {
  if (!io || !socketTarget) return;
  if (!isValidEventName(event)) {
    console.error('[SOCKET INVALID EVENT]', {
      eventName: event,
      payload: data,
      target: targetDescription,
    });
    return;
  }

  console.log('[SOCKET EMIT]', {
    eventName: event,
    target: targetDescription,
    payload: data,
  });
  socketTarget.emit(event, data);
};

/**
 * Emit event to a specific user
 */
const emitToUser = (userId, event, data) => {
  if (!io) return;
  safeEmit(
    io.to(`${socketEvents.ROOMS.USER_PREFIX}${userId}`),
    event,
    data,
    `user:${userId}`
  );
};

/**
 * Emit event to a specific driver
 */
const emitToDriver = (driverId, event, data) => {
  if (!io) return;
  safeEmit(
    io.to(`${socketEvents.ROOMS.DRIVER_PREFIX}${driverId}`),
    event,
    data,
    `driver:${driverId}`
  );
};

/**
 * Emit event to a specific order room
 */
const emitToOrder = (orderId, event, data) => {
  if (!io) return;
  safeEmit(
    io.to(`${socketEvents.ROOMS.ORDER_PREFIX}${orderId}`),
    event,
    data,
    `order:${orderId}`
  );
};

/**
 * Emit event to all drivers
 */
const emitToAllDrivers = (event, data) => {
  if (!io) return;
  safeEmit(
    io.to(socketEvents.ROOMS.DRIVERS),
    event,
    data,
    'room:drivers'
  );
};

/**
 * Emit event to all users
 */
const emitToAllUsers = (event, data) => {
  if (!io) return;
  safeEmit(
    io.to(socketEvents.ROOMS.USERS),
    event,
    data,
    'room:users'
  );
};

/**
 * Emit event to all admins
 */
const emitToAllAdmins = (event, data) => {
  if (!io) return;
  safeEmit(
    io.to(socketEvents.ROOMS.ADMIN),
    event,
    data,
    'room:admin'
  );
};

/**
 * Emit event to everyone
 */
const emitToAll = (event, data) => {
  if (!io) return;
  safeEmit(io, event, data, 'broadcast:all');
};

/**
 * Send notification to user
 */
const sendNotification = (userId, title, message, type = 'info', data = {}) => {
  emitToUser(userId, socketEvents.SERVER.NOTIFICATION, {
    id: Date.now(),
    title,
    message,
    type, // 'info', 'success', 'warning', 'error'
    timestamp: new Date().toISOString(),
    ...data,
  });
};

module.exports = {
  initializeSocket,
  getIO,
  emitToUser,
  emitToDriver,
  emitToOrder,
  emitToAllDrivers,
  emitToAllUsers,
  emitToAllAdmins,
  emitToAll,
  sendNotification,
};
