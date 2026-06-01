# K-TRASH Frontend Architecture Integration Guide

## Overview
This guide explains how to integrate all the new context providers, route protection, and realtime features into your React application.

## File Structure
```
pundesari/src/
├── context/
│   ├── AuthContext.js           # Auth state & JWT validation
│   ├── SocketContext.js         # Realtime socket connection
│   ├── OrderContext.js          # Order state machine
│   └── NotificationContext.js   # Global notifications
├── components/
│   ├── ProtectedRoute.js        # Route protection component
│   ├── GuestRoute.js            # Guest-only routes
│   ├── NotificationPanel.js     # Notification display
│   └── NotificationPanel.css
└── index.js                     # Updated with providers
```

## Step 1: Update index.js

Wrap your entire app with all providers in the correct order:

```javascript
import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { OrderProvider } from './context/OrderContext';
import { NotificationProvider } from './context/NotificationContext';

ReactDOM.render(
  <React.StrictMode>
    <AuthProvider>
      <SocketProvider>
        <OrderProvider>
          <NotificationProvider>
            <App />
          </NotificationProvider>
        </OrderProvider>
      </SocketProvider>
    </AuthProvider>
  </React.StrictMode>,
  document.getElementById('root')
);
```

## Step 2: Update routes.js

Use ProtectedRoute and GuestRoute:

```javascript
import React from 'react';
import { BrowserRouter, Switch } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import GuestRoute from './components/GuestRoute';

// Import all your pages
import LoginPage from './views/Login';
import RegisterPage from './views/Register';
import OtpPage from './views/Otp';
import Dashboard from './views/Dashboard';
import TrackingPage from './views/Tracking';

export default function Routes() {
  return (
    <BrowserRouter>
      <Switch>
        {/* Guest only routes */}
        <GuestRoute exact path="/login" component={LoginPage} />
        <GuestRoute exact path="/Register" component={RegisterPage} />
        <GuestRoute exact path="/otp" component={OtpPage} />

        {/* Protected routes */}
        <ProtectedRoute exact path="/dashboard" component={Dashboard} />
        <ProtectedRoute path="/tracking/:id" component={TrackingPage} />

        {/* Catch-all redirect */}
        <Route render={() => <Redirect to="/dashboard" />} />
      </Switch>
    </BrowserRouter>
  );
}
```

## Step 3: Update App.js

Add NotificationPanel to the top level:

```javascript
import React from 'react';
import { NotificationPanel } from './components/NotificationPanel';
import Routes from './routes';

function App() {
  return (
    <div className="App">
      <NotificationPanel />
      <Routes />
    </div>
  );
}

export default App;
```

## Step 4: Update Login.js

Use AuthContext for login flow with proper navigation:

```javascript
import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { authAPI } from '../services/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const history = useHistory();
  const { login } = useAuth();
  const { success, error: notifyError } = useNotification();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data } = await authAPI.login({ email, password });

      if (data.status === 'success' && data.token) {
        login(data.user, data.token);
        success('Login berhasil!');
        
        // Use replace to prevent back button from going to login
        history.replace('/dashboard');
      } else {
        notifyError('Login gagal: ' + (data.message || 'Unknown error'));
      }
    } catch (err) {
      notifyError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Your login form here */}
    </div>
  );
}
```

## Step 5: Update Register.js

Clean OTP state and use proper navigation:

```javascript
import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useNotification } from '../context/NotificationContext';
import { authAPI } from '../services/api';

export default function Register() {
  const [loading, setLoading] = useState(false);
  const history = useHistory();
  const { error: notifyError, success } = useNotification();

  const handleRegister = async (formData) => {
    setLoading(true);

    try {
      const { data } = await authAPI.register(formData);

      if (data.status === 'otp_sent') {
        // Store email for OTP verification
        localStorage.setItem('otp_email', data.email);
        
        // Show OTP code if in development
        if (data.debugOtp) {
          success(`OTP Code (Dev Mode): ${data.debugOtp}`);
        }
        
        // Replace navigation to prevent back button
        history.replace('/otp');
      } else {
        notifyError('Registration failed: ' + (data.message || 'Unknown error'));
      }
    } catch (err) {
      notifyError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Your register form here */}
    </div>
  );
}
```

## Step 6: Update Otp.js

Clean OTP state after verification:

```javascript
import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { authAPI } from '../services/api';

export default function Otp() {
  const [otp, setOtp] = useState(Array(6).fill(''));
  const [loading, setLoading] = useState(false);
  const history = useHistory();
  const { login } = useAuth();
  const { success, error: notifyError } = useNotification();

  // Redirect if no email in localStorage (OTP flow interrupted)
  useEffect(() => {
    const email = localStorage.getItem('otp_email');
    if (!email) {
      history.replace('/Register');
    }
  }, [history]);

  const handleVerify = async (e) => {
    e.preventDefault();
    const otpCode = otp.join('');
    const email = localStorage.getItem('otp_email');

    setLoading(true);

    try {
      const { data } = await authAPI.verifyRegister({ email, otp: otpCode });

      if (data.status === 'success' && data.token) {
        // IMPORTANT: Clean OTP state completely
        localStorage.removeItem('otp_email');

        // Save auth state
        login(data.user, data.token);
        
        success('Registration successful!');
        
        // Replace navigation to prevent back button to OTP page
        history.replace('/dashboard');
      } else {
        notifyError('Verification failed: ' + (data.message || 'Unknown error'));
      }
    } catch (err) {
      notifyError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Your OTP form here */}
    </div>
  );
}
```

## Step 7: Update Tracking.js

Use realtime order updates:

```javascript
import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useOrder } from '../context/OrderContext';
import { useSocket } from '../context/SocketContext';
import { useNotification } from '../context/NotificationContext';

export default function Tracking() {
  const { id: orderId } = useParams();
  const { activeOrder, setActiveOrder } = useOrder();
  const { joinOrderRoom } = useSocket();
  const { info } = useNotification();

  useEffect(() => {
    if (orderId) {
      // Join socket room for this order
      joinOrderRoom(orderId);
      info('Connected to tracking...');
    }
  }, [orderId, joinOrderRoom, info]);

  return (
    <div>
      {/* Your tracking page here */}
      {activeOrder && (
        <div>
          <h2>Order #{activeOrder.id}</h2>
          <p>Status: {activeOrder.status}</p>
          {/* Display order details */}
        </div>
      )}
    </div>
  );
}
```

## Key Concepts

### Auth Flow
1. User logs in → AuthProvider saves token & user
2. Protected routes validate token
3. Token persists across page refreshes
4. Session validation on app load
5. Logout clears all auth state

### Realtime Order Updates
1. Socket connects when auth succeeds
2. Socket disconnects when user logs out
3. Order events update global state
4. Auto-redirect on order acceptance
5. Location updates for drivers

### Navigation Strategy
- Use `history.replace()` after login/register/logout
- Prevents back button from showing auth pages
- Browser back button requires full session validation
- Protected routes enforce auth state

### State Machine
- Orders follow strict state transitions
- Invalid transitions are prevented
- Realtime events update state safely
- No race conditions or stale state

## Production Deployment

### Environment Variables (.env)
```
REACT_APP_API_URL=https://your-api.com
REACT_APP_SOCKET_URL=https://your-api.com
```

### Security Checklist
- [ ] JWT token stored securely (localStorage for now)
- [ ] Token validation on page load
- [ ] HTTPS enforced
- [ ] CORS properly configured
- [ ] Socket authentication enabled
- [ ] Rate limiting on backend
- [ ] Input validation on all forms
- [ ] XSS protection in place

### Performance Checklist
- [ ] Socket connection pooling
- [ ] Message debouncing
- [ ] Socket reconnection strategy
- [ ] State updates batched
- [ ] Notification auto-dismissal
- [ ] Memory leak prevention

## Troubleshooting

### Socket not connecting
- Check auth token is passed
- Verify CORS settings match frontend URL
- Check Socket.IO logs on backend

### Auto-redirect not working
- Ensure history.replace() is used
- Check route transitions are valid
- Verify Component prop naming

### Notifications not showing
- Ensure NotificationPanel in top-level component
- Check useNotification is in component tree
- Verify emit is called with correct event name

### OTP page reappearing
- Verify localStorage is cleared after verification
- Check GuestRoute is properly configured
- Ensure history.replace() is used after success
