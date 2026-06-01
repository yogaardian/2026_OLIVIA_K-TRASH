import React from 'react';
import { Route, Redirect } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Protected Route Component
 * Validates JWT token and user role before allowing access
 * Redirects to login if not authenticated
 */
export const ProtectedRoute = ({
  component: Component,
  requiredRoles = [],
  ...rest
}) => {
  const { auth } = useAuth();

  if (auth.isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <Route
      {...rest}
      render={(props) => {
        // Check if user is authenticated
        if (!auth.isAuthenticated || !auth.token) {
          return (
            <Redirect
              to={{
                pathname: '/login',
                state: { from: props.location },
              }}
            />
          );
        }

        // Check role if required roles are specified
        if (requiredRoles.length > 0 && !requiredRoles.includes(auth.user?.role)) {
          return <Redirect to="/unauthorized" />;
        }

        // Render the component
        return <Component {...props} />;
      }}
    />
  );
};

export default ProtectedRoute;
