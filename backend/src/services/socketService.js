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

/**
 * Emit event to a specific user
 */
const emitToUser = (userId, event, data) => {
  if (!io) return;
  io.to(`${socketEvents.ROOMS.USER_PREFIX}${userId}`).emit(event, data);
};

/**
 * Emit event to a specific driver
 */
const emitToDriver = (driverId, event, data) => {
  if (!io) return;
  io.to(`${socketEvents.ROOMS.DRIVER_PREFIX}${driverId}`).emit(event, data);
};

/**
 * Emit event to a specific order room
 */
const emitToOrder = (orderId, event, data) => {
  if (!io) return;
  io.to(`${socketEvents.ROOMS.ORDER_PREFIX}${orderId}`).emit(event, data);
};

/**
 * Emit event to all drivers
 */
const emitToAllDrivers = (event, data) => {
  if (!io) return;
  io.to(socketEvents.ROOMS.DRIVERS).emit(event, data);
};

/**
 * Emit event to all users
 */
const emitToAllUsers = (event, data) => {
  if (!io) return;
  io.to(socketEvents.ROOMS.USERS).emit(event, data);
};

/**
 * Emit event to all admins
 */
const emitToAllAdmins = (event, data) => {
  if (!io) return;
  io.to(socketEvents.ROOMS.ADMIN).emit(event, data);
};

/**
 * Emit event to everyone
 */
const emitToAll = (event, data) => {
  if (!io) return;
  io.emit(event, data);
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
