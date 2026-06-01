/**
 * Socket.IO Middleware for Authentication
 * Validates JWT tokens from socket connections
 */

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./auth');

const socketAuthMiddleware = (socket, next) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded.id;
    socket.userRole = decoded.role;
    socket.userEmail = decoded.email;

    next();
  } catch (err) {
    console.error('Socket auth error:', err.message);
    next(new Error('Invalid token'));
  }
};

module.exports = socketAuthMiddleware;
