import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { dashboardAPI } from '../services/api';

// ======================== DASHBOARD CONTEXT ========================

const DashboardContext = createContext();

export const DashboardProvider = ({ children }) => {
  const { auth } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    if (!auth?.user) return;

    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        let data = {};

        // Admin Dashboard
        if (auth.user.role === 'admin') {
          const statsRes = await dashboardAPI.getAdminStats();
          data.stats = statsRes.data;
        }

        // User Dashboard
        if (auth.user.role === 'user') {
          const balanceRes = await dashboardAPI.getUserBalance(auth.user.id);
          const ordersRes = await dashboardAPI.getUserOrders(auth.user.id);
          data.balance = balanceRes.data;
          data.orders = ordersRes.data;
        }

        // Driver Dashboard
        if (auth.user.role === 'driver' || auth.user.role === 'petugas') {
          const ordersRes = await dashboardAPI.getPendingOrders();
          data.orders = ordersRes.data;
        }

        setDashboardData(data);
        setLastUpdate(new Date());
      } catch (err) {
        console.error('Error fetching dashboard:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [auth?.user]);

  const refresh = async () => {
    if (!auth?.user) return;
    try {
      setIsLoading(true);
      let data = {};

      if (auth.user.role === 'admin') {
        const statsRes = await dashboardAPI.getAdminStats();
        data.stats = statsRes.data;
      }

      if (auth.user.role === 'user') {
        const balanceRes = await dashboardAPI.getUserBalance(auth.user.id);
        const ordersRes = await dashboardAPI.getUserOrders(auth.user.id);
        data.balance = balanceRes.data;
        data.orders = ordersRes.data;
      }

      if (auth.user.role === 'driver' || auth.user.role === 'petugas') {
        const ordersRes = await dashboardAPI.getPendingOrders();
        data.orders = ordersRes.data;
      }

      setDashboardData(data);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Error refreshing dashboard:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardContext.Provider
      value={{
        dashboardData,
        isLoading,
        error,
        lastUpdate,
        refresh,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within DashboardProvider');
  }
  return context;
};

