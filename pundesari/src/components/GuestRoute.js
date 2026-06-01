import React from 'react';
import { Route, Redirect } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Guest Route Component
 * Prevents authenticated users from accessing login/register pages
 * Redirects to dashboard if already logged in
 */
export const GuestRoute = ({ component: Component, ...rest }) => {
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
        // If user is already authenticated, redirect to dashboard
        if (auth.isAuthenticated && auth.token) {
          return (
            <Redirect
              to={{
                pathname: '/dashboard',
                state: { from: props.location },
              }}
            />
          );
        }

        // Render the component for guest users
        return <Component {...props} />;
      }}
    />
  );
};

export default GuestRoute;
