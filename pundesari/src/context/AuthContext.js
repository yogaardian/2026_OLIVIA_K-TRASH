import React, { createContext, useState, useCallback, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { authAPI } from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const history = useHistory();
  const [auth, setAuth] = useState({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  const clearAuthStorage = () => {
    const legacyKeys = ['token', 'userId', 'nama', 'role', 'isLogin', 'email'];
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    legacyKeys.forEach((key) => localStorage.removeItem(key));
  };

  const handleInvalidSession = useCallback((redirect = false) => {
    clearAuthStorage();
    setAuth({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });

    if (redirect && window.location.pathname !== '/login') {
      history.replace('/login');
    }
  }, [history]);

  // Restore session from localStorage on mount
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const storedToken = localStorage.getItem('auth_token');
        const storedUser = localStorage.getItem('auth_user');

        const legacyToken = localStorage.getItem('token');
        const legacyUserId = localStorage.getItem('userId');
        const legacyName = localStorage.getItem('nama');
        const legacyRole = localStorage.getItem('role');

        const token = storedToken || legacyToken;
        let user = null;

        if (storedUser) {
          try {
            user = JSON.parse(storedUser);
          } catch (e) {
            console.warn('Failed to parse stored user:', e);
          }
        } else if (legacyUserId && legacyName && legacyRole) {
          user = {
            id: parseInt(legacyUserId, 10),
            nama: legacyName,
            role: legacyRole,
            email: localStorage.getItem('email'),
          };
        }

        if (!token || !user) {
          setAuth({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
          return;
        }

        const response = await authAPI.validateToken();
        if (response?.data?.status === 'ok' && response.data.valid) {
          const validatedUser = response.data.user;
          const normalizedUser = { ...user, ...validatedUser };
          localStorage.setItem('auth_token', token);
          localStorage.setItem('auth_user', JSON.stringify(normalizedUser));

          setAuth({
            user: normalizedUser,
            token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          return;
        }

        console.warn('Token validation failed during session restore', response?.data);
      } catch (validationErr) {
        console.warn('Token validation failed:', validationErr.response?.data?.message || validationErr.message);
      }

      handleInvalidSession(true);
    };

    restoreSession();

    const handleStorage = (event) => {
      const watchedKeys = ['auth_token', 'auth_user', 'token', 'userId', 'nama', 'role', 'isLogin', 'email'];
      if (!event.key || !watchedKeys.includes(event.key)) {
        return;
      }

      if (!localStorage.getItem('auth_token') && !localStorage.getItem('token')) {
        handleInvalidSession(false);
        return;
      }

      const currentToken = localStorage.getItem('auth_token') || localStorage.getItem('token');
      const currentUserString = localStorage.getItem('auth_user');
      if (currentToken && currentUserString) {
        try {
          const currentUser = JSON.parse(currentUserString);
          setAuth((prev) => ({
            ...prev,
            user: currentUser,
            token: currentToken,
            isAuthenticated: true,
          }));
        } catch (e) {
          console.warn('Failed to parse stored user during storage sync:', e);
        }
      }
    };

    const handleLogoutEvent = () => {
      handleInvalidSession(true);
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('logout', handleLogoutEvent);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('logout', handleLogoutEvent);
    };
  }, [handleInvalidSession]);

  const login = useCallback((token, user) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(user));

    localStorage.setItem('token', token);
    localStorage.setItem('userId', user.id.toString());
    localStorage.setItem('nama', user.nama);
    localStorage.setItem('role', user.role);
    localStorage.setItem('isLogin', 'true');
    if (user.email) {
      localStorage.setItem('email', user.email);
    }

    setAuth({
      user,
      token,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
  }, []);

  const logout = useCallback(() => {
    clearAuthStorage();
    localStorage.removeItem('otp_email');

    setAuth({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });

    window.dispatchEvent(new Event('logout'));

    if (window.location.pathname !== '/login') {
      history.replace('/login');
    }
  }, [history]);

  const setError = useCallback((error) => {
    setAuth(prev => ({ ...prev, error }));
  }, []);

  const clearError = useCallback(() => {
    setAuth(prev => ({ ...prev, error: null }));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        auth,
        login,
        logout,
        setError,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
