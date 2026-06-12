import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';

export const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { auth } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [listeners, setListeners] = useState({});
  const joinedOrderRoomsRef = useRef(new Set());

  // Initialize socket connection only after auth validation completes
  useEffect(() => {
    if (auth.isLoading) {
      return;
    }

    if (!auth.isAuthenticated || !auth.token) {
      if (socket) {
        socket.disconnect();
        joinedOrderRoomsRef.current.clear();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const socketUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    const socketTransports = (process.env.REACT_APP_SOCKET_TRANSPORTS || 'websocket')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    console.log('🟢 Socket init', {
      socketUrl,
      socketTransports,
      authState: {
        isAuthenticated: auth.isAuthenticated,
        tokenPresent: !!auth.token,
      },
    });

    const newSocket = io(socketUrl, {
      auth: {
        token: auth.token,
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      transports: socketTransports,
      path: '/socket.io',
    });

    // Connection events
    newSocket.on('connect', () => {
      const transport = newSocket.io?.engine?.transport?.name;
      console.log('✅ Socket connected:', newSocket.id, { transport });
      setIsConnected(true);
      if (joinedOrderRoomsRef.current.size > 0) {
        const rooms = Array.from(joinedOrderRoomsRef.current);
        console.log('🔁 Rejoining order rooms after reconnect:', rooms);
        rooms.forEach((orderId) => {
          newSocket.emit('join:order_room', { orderId });
        });
      }
    });

    newSocket.on('disconnect', (reason) => {
      console.warn('❌ Socket disconnected:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('🔴 Socket connect_error:', error, {
        transport: newSocket.io?.engine?.transport?.name,
        socketUrl,
      });
    });

    newSocket.on('reconnect_error', (error) => {
      console.error('🔴 Socket reconnect_error:', error, {
        transport: newSocket.io?.engine?.transport?.name,
        socketUrl,
      });
    });

    newSocket.on('reconnect_attempt', (attempt) => {
      console.log('🔁 Socket reconnect attempt:', attempt, {
        transport: newSocket.io?.engine?.transport?.name,
      });
    });

    newSocket.on('reconnect_failed', () => {
      console.error('🔴 Socket reconnect failed', {
        socketUrl,
      });
    });

    newSocket.on('error', (error) => {
      console.error('🔴 Socket error:', error, {
        transport: newSocket.io?.engine?.transport?.name,
      });
    });

    if (newSocket.io?.engine) {
      newSocket.io.engine.on('packet', (packet) => {
        console.log('🔷 Socket engine packet:', packet);
      });
      newSocket.io.engine.on('upgradeError', (error) => {
        console.error('🔴 Socket engine upgradeError:', error);
      });
      newSocket.io.engine.on('error', (error) => {
        console.error('🔴 Socket engine error:', error);
      });
    }

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
      joinedOrderRoomsRef.current.clear();
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
      if (!orderId) return;
      joinedOrderRoomsRef.current.add(String(orderId));
      emit('join:order_room', { orderId });
    },
    [emit]
  );

  // Leave order room
  const leaveOrderRoom = useCallback(
    (orderId) => {
      if (!orderId) return;
      joinedOrderRoomsRef.current.delete(String(orderId));
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
