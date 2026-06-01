import React, { createContext, useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';

export const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { auth } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [listeners, setListeners] = useState({});

  // Initialize socket connection only after auth validation completes
  useEffect(() => {
    if (auth.isLoading) {
      return;
    }

    if (!auth.isAuthenticated || !auth.token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const socketUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    const newSocket = io(socketUrl, {
      auth: {
        token: auth.token,
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      transports: ['websocket', 'polling'],
    });

    // Connection events
    newSocket.on('connect', () => {
      console.log('✅ Socket connected:', newSocket.id);
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
      setIsConnected(false);
    });

    newSocket.on('error', (error) => {
      console.error('🔴 Socket error:', error);
    });

    newSocket.on('auth:success', (data) => {
      console.log('✅ Socket authenticated:', data);
    });

    newSocket.on('auth:error', (error) => {
      console.error('🔴 Socket auth error:', error);
      newSocket.disconnect();
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      newSocket.disconnect();
    };
  }, [auth.isAuthenticated, auth.token]);

  // Subscribe to socket event
  const subscribe = useCallback(
    (event, callback) => {
      if (!socket) return;

      socket.on(event, callback);
      
      // Store listener for cleanup
      setListeners(prev => ({
        ...prev,
        [event]: [...(prev[event] || []), callback],
      }));

      // Return unsubscribe function
      return () => {
        socket.off(event, callback);
      };
    },
    [socket]
  );

  // Emit socket event
  const emit = useCallback(
    (event, data) => {
      if (!socket) {
        console.warn(`Socket not initialized for event: ${event}`);
        return;
      }
      socket.emit(event, data);
    },
    [socket]
  );

  // Join order room for real-time tracking
  const joinOrderRoom = useCallback(
    (orderId) => {
      emit('join:order_room', { orderId });
    },
    [emit]
  );

  // Leave order room
  const leaveOrderRoom = useCallback(
    (orderId) => {
      emit('leave:order_room', { orderId });
    },
    [emit]
  );

  // Update driver location
  const updateDriverLocation = useCallback(
    (orderId, lat, lng) => {
      emit('driver:update_location', { orderId, lat, lng });
    },
    [emit]
  );

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        subscribe,
        emit,
        joinOrderRoom,
        leaveOrderRoom,
        updateDriverLocation,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = React.useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return context;
};
