import React, { createContext, useCallback, useReducer, useEffect, useMemo, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { ordersAPI } from '../services/api';

export const OrderContext = createContext();

export const ORDER_FLOW = {
  IDLE: 'IDLE',
  SEARCHING_DRIVER: 'SEARCHING_DRIVER',
  DRIVER_ACCEPTED: 'DRIVER_ACCEPTED',
  DRIVER_ARRIVING: 'DRIVER_ARRIVING',
  PICKUP: 'PICKUP',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

const ORDER_STATUS_MAP = {
  pending: ORDER_FLOW.SEARCHING_DRIVER,
  searching_driver: ORDER_FLOW.SEARCHING_DRIVER,
  assigned: ORDER_FLOW.DRIVER_ACCEPTED,
  on_the_way: ORDER_FLOW.DRIVER_ARRIVING,
  arrived: ORDER_FLOW.PICKUP,
  completed: ORDER_FLOW.COMPLETED,
  cancelled: ORDER_FLOW.CANCELLED,
};

const VALID_TRANSITIONS = {
  [ORDER_FLOW.IDLE]: [ORDER_FLOW.SEARCHING_DRIVER, ORDER_FLOW.DRIVER_ACCEPTED, ORDER_FLOW.DRIVER_ARRIVING, ORDER_FLOW.PICKUP, ORDER_FLOW.COMPLETED, ORDER_FLOW.CANCELLED],
  [ORDER_FLOW.SEARCHING_DRIVER]: [ORDER_FLOW.DRIVER_ACCEPTED, ORDER_FLOW.CANCELLED],
  [ORDER_FLOW.DRIVER_ACCEPTED]: [ORDER_FLOW.DRIVER_ARRIVING, ORDER_FLOW.PICKUP, ORDER_FLOW.CANCELLED],
  [ORDER_FLOW.DRIVER_ARRIVING]: [ORDER_FLOW.PICKUP, ORDER_FLOW.CANCELLED],
  [ORDER_FLOW.PICKUP]: [ORDER_FLOW.COMPLETED, ORDER_FLOW.CANCELLED],
  [ORDER_FLOW.COMPLETED]: [],
  [ORDER_FLOW.CANCELLED]: [],
};

const ORDER_STORAGE_KEY = 'current_order_id';

const normalizeOrder = (order) => {
  if (!order) return null;
  return {
    ...order,
    id: order?.id || order?.order_id || order?.orderId,
    status: order?.status || order?.order_status || order?.state || 'pending',
  };
};

const mapBackendStatusToFlow = (status) => ORDER_STATUS_MAP[status] || ORDER_FLOW.IDLE;

const canTransition = (from, to) => {
  if (from === to) return true;
  const valid = VALID_TRANSITIONS[from] || [];
  return valid.includes(to);
};

const orderReducer = (state, action) => {
  switch (action.type) {
    case 'SET_RECOVERING':
      return { ...state, isRecovering: action.payload };

    case 'SET_ACTIVE_ORDER': {
      const activeOrder = normalizeOrder(action.payload);
      if (!activeOrder || !activeOrder.id) return state;
      return {
        ...state,
        activeOrder,
        orders: {
          ...state.orders,
          [activeOrder.id]: {
            ...(state.orders[activeOrder.id] || {}),
            ...activeOrder,
          },
        },
      };
    }

    case 'SET_ORDER_FLOW_STATE': {
      const nextState = action.payload;
      if (!canTransition(state.orderFlowState, nextState)) {
        console.warn(`Ignored invalid order transition ${state.orderFlowState} -> ${nextState}`);
        return state;
      }
      return {
        ...state,
        orderFlowState: nextState,
      };
    }

    case 'UPDATE_ACTIVE_ORDER': {
      const activeOrder = normalizeOrder(action.payload);
      if (!state.activeOrder || !activeOrder || !activeOrder.id) return state;
      const orderId = state.activeOrder.id;
      return {
        ...state,
        activeOrder: {
          ...state.activeOrder,
          ...activeOrder,
        },
        orders: {
          ...state.orders,
          [orderId]: {
            ...state.orders[orderId],
            ...activeOrder,
          },
        },
      };
    }

    case 'CLEAR_ACTIVE_ORDER':
      return {
        ...state,
        activeOrder: null,
        orderFlowState: ORDER_FLOW.IDLE,
      };

    case 'ADD_ORDER': {
      const order = normalizeOrder(action.payload);
      if (!order || !order.id) return state;
      return {
        ...state,
        orders: {
          ...state.orders,
          [order.id]: {
            ...(state.orders[order.id] || {}),
            ...order,
          },
        },
      };
    }

    case 'UPDATE_DRIVER_LOCATION':
      return {
        ...state,
        driverLocations: {
          ...state.driverLocations,
          [action.payload.driverId]: {
            lat: action.payload.lat,
            lng: action.payload.lng,
            timestamp: action.payload.timestamp,
          },
        },
      };

    default:
      return state;
  }
};

export const OrderProvider = ({ children }) => {
  const history = useHistory();
  const { subscribe, joinOrderRoom, leaveOrderRoom, isConnected } = useSocket();
  const [state, dispatch] = useReducer(orderReducer, {
    orders: {},
    activeOrder: null,
    driverLocations: {},
    orderFlowState: ORDER_FLOW.IDLE,
    isRecovering: false,
  });

  const isSearchingDriver = state.orderFlowState === ORDER_FLOW.SEARCHING_DRIVER;

  const safeSetOrderFlowState = useCallback((nextState) => {
    dispatch({ type: 'SET_ORDER_FLOW_STATE', payload: nextState });
  }, []);

  const setActiveOrder = useCallback((order) => {
    const normalized = normalizeOrder(order);
    if (!normalized || !normalized.id) return;
    sessionStorage.setItem(ORDER_STORAGE_KEY, normalized.id);
    dispatch({ type: 'SET_ACTIVE_ORDER', payload: normalized });
  }, []);

  const clearActiveOrder = useCallback(() => {
    if (state.activeOrder?.id) {
      leaveOrderRoom(state.activeOrder.id);
    }
    sessionStorage.removeItem(ORDER_STORAGE_KEY);
    dispatch({ type: 'CLEAR_ACTIVE_ORDER' });
  }, [leaveOrderRoom, state.activeOrder]);

  const updateActiveOrder = useCallback((order) => {
    const normalized = normalizeOrder(order);
    if (!normalized || !normalized.id) return;
    dispatch({ type: 'UPDATE_ACTIVE_ORDER', payload: normalized });
  }, []);

  const restoreOrderFromBackend = useCallback(async (orderId) => {
    if (!orderId) return;
    dispatch({ type: 'SET_RECOVERING', payload: true });
    try {
      const response = await ordersAPI.getOrderDetail(orderId);
      if (response?.data?.id) {
        const order = normalizeOrder(response.data);
        dispatch({ type: 'SET_ACTIVE_ORDER', payload: order });
        safeSetOrderFlowState(mapBackendStatusToFlow(order.status));
        if (isConnected) {
          joinOrderRoom(order.id);
        }
      } else {
        sessionStorage.removeItem(ORDER_STORAGE_KEY);
      }
    } catch (error) {
      console.error('Failed to restore order from backend:', error);
      sessionStorage.removeItem(ORDER_STORAGE_KEY);
    } finally {
      dispatch({ type: 'SET_RECOVERING', payload: false });
    }
  }, [isConnected, joinOrderRoom, safeSetOrderFlowState]);

  useEffect(() => {
    const storedOrderId = sessionStorage.getItem(ORDER_STORAGE_KEY);
    if (!storedOrderId) return;
    if (state.activeOrder?.id === storedOrderId) return;
    restoreOrderFromBackend(storedOrderId);
  }, [restoreOrderFromBackend, state.activeOrder?.id]);

  useEffect(() => {
    if (!subscribe) return;
    const unsubscribe = subscribe('driver:location_updated', (data) => {
      if (!data?.driverId) return;
      dispatch({ type: 'UPDATE_DRIVER_LOCATION', payload: data });
    });

    return () => unsubscribe && unsubscribe();
  }, [subscribe]);

  const { auth } = useAuth();

  useEffect(() => {
    if (!state.activeOrder) return;
    const nextState = mapBackendStatusToFlow(state.activeOrder.status);
    if (nextState !== state.orderFlowState) {
      safeSetOrderFlowState(nextState);
    }
  }, [safeSetOrderFlowState, state.activeOrder, state.orderFlowState]);

  const cancelOrder = useCallback(async () => {
    if (!state.activeOrder?.id) return;
    try {
      const response = await ordersAPI.cancelOrder(state.activeOrder.id);
      if (response?.status !== 200 && response?.data?.status !== 'success') {
        console.error('Cancel order failed:', response?.data || response);
        return;
      }
      clearActiveOrder();
      history.replace('/user/dashboard');
    } catch (error) {
      console.error('Cancel order failed:', error);
    }
  }, [clearActiveOrder, history, state.activeOrder]);

  const contextValue = useMemo(() => ({
    ...state,
    isSearchingDriver,
    setActiveOrder,
    clearActiveOrder,
    cancelOrder,
    updateActiveOrder,
    safeSetOrderFlowState,
    ORDER_FLOW,
  }), [state, isSearchingDriver, setActiveOrder, clearActiveOrder, cancelOrder, updateActiveOrder, safeSetOrderFlowState]);

  return (
    <OrderContext.Provider value={contextValue}>
      {children}
    </OrderContext.Provider>
  );
};

export const useOrder = () => {
  const context = React.useContext(OrderContext);
  if (!context) {
    throw new Error('useOrder must be used within OrderProvider');
  }
  return context;
};
