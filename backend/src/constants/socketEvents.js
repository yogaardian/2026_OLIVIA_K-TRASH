/**
 * Socket.IO Event Constants - Centralized event definitions
 * Ensures consistency between backend and frontend
 */

module.exports = {
  // Client-to-Server Events
  CLIENT: {
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    USER_AUTHENTICATE: 'user:authenticate',
    JOIN_ORDER_ROOM: 'join:order_room',
    LEAVE_ORDER_ROOM: 'leave:order_room',
    REQUEST_DRIVER: 'order:request_driver',
    UPDATE_LOCATION: 'driver:update_location',
  },

  // Server-to-Client Events
  SERVER: {
    AUTHENTICATED: 'auth:success',
    AUTH_ERROR: 'auth:error',
    
    // Order Events
    ORDER_CREATED: 'order:created',
    ORDER_SEARCHING: 'order:searching_driver',
    ORDER_DRIVER_ASSIGNED: 'order:driver_assigned',
    ORDER_STATUS_CHANGED: 'order:status_changed',
    ORDER_ACCEPTED: 'order:accepted',
    ORDER_ON_THE_WAY: 'order:on_the_way',
    ORDER_ARRIVED: 'order:arrived',
    ORDER_COMPLETED: 'order:completed',
    ORDER_CANCELLED: 'order:cancelled',
    
    // Driver Location Events
    DRIVER_LOCATION_UPDATED: 'driver:location_updated',
    
    // Notification Events
    NOTIFICATION: 'notification:new',
    
    // Error Events
    ERROR: 'error:occurred',
  },

  // Event Rooms
  ROOMS: {
    ADMIN: 'admin',
    DRIVERS: 'drivers',
    USERS: 'users',
    ORDER_PREFIX: 'order_',
    USER_PREFIX: 'user_',
    DRIVER_PREFIX: 'driver_',
  },
};
