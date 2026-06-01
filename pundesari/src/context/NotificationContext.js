import React, { createContext, useState, useCallback, useEffect } from 'react';
import { useSocket } from './SocketContext';

export const NotificationContext = createContext();

const NOTIFICATION_TYPES = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
};

const NOTIFICATION_TIMEOUT = 5000; // 5 seconds

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const { subscribe } = useSocket();

  // Subscribe to realtime notifications from socket
  useEffect(() => {
    if (!subscribe) return;

    const unsubscribe = subscribe('notification:new', (data) => {
      console.log('🔔 New notification:', data);
      addNotification(data.message, data.type, { title: data.title });
    });

    return () => unsubscribe?.();
  }, [subscribe]);

  const addNotification = useCallback(
    (message, type = NOTIFICATION_TYPES.INFO, options = {}) => {
      const id = Date.now();
      const notification = {
        id,
        message,
        type,
        title: options.title,
        timestamp: new Date().toISOString(),
        ...options,
      };

      setNotifications(prev => [...prev, notification]);

      // Auto remove after timeout
      if (options.persistent !== true) {
        setTimeout(() => {
          removeNotification(id);
        }, NOTIFICATION_TIMEOUT);
      }

      return id;
    },
    []
  );

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Shortcut methods
  const success = useCallback(
    (message, options) => addNotification(message, NOTIFICATION_TYPES.SUCCESS, options),
    [addNotification]
  );

  const error = useCallback(
    (message, options) => addNotification(message, NOTIFICATION_TYPES.ERROR, options),
    [addNotification]
  );

  const warning = useCallback(
    (message, options) => addNotification(message, NOTIFICATION_TYPES.WARNING, options),
    [addNotification]
  );

  const info = useCallback(
    (message, options) => addNotification(message, NOTIFICATION_TYPES.INFO, options),
    [addNotification]
  );

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        removeNotification,
        clearAll,
        success,
        error,
        warning,
        info,
        NOTIFICATION_TYPES,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = React.useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
};
