# 📚 K-TRASH OTP Implementation Reference

## Quick Start (5 Minutes)

### 1. Environment Setup

```bash
# Backend .env
JWT_SECRET=dev_secret_jwt_32char_minimal_aman
JWT_EXPIRES_IN=7d
MAIL_USER=your_gmail@gmail.com
MAIL_PASS=your_google_app_password
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
OTP_EXPIRE_MINUTES=5

# Frontend .env
REACT_APP_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
REACT_APP_API_URL=http://localhost:5000
```

### 2. Database Migration

```bash
# Run in MySQL
mysql -u root bank_sampah < backend/migrations/001_update_users_table.sql
mysql -u root bank_sampah < backend/migrations/002_create_login_otps_table.sql
```

### 3. Install & Start

```bash
# Backend
cd backend && npm install && npm start

# Frontend (new terminal)
cd pundesari && npm install && npm start
```

### 4. Test

```
✓ Visit http://localhost:3003/login
✓ Enter credentials
✓ Verify OTP from email
✓ Login successful!
```

---

## API Reference

### Authentication Endpoints

#### 1️⃣ Manual Login

**Endpoint**: `POST /api/auth/login`

**Request**:
```json
{
  "email": "user@test.com",
  "password": "password123"
}
```

**Response** (OTP Required):
```json
{
  "status": "otp_required",
  "message": "OTP terkirim ke user@test.com",
  "email": "user@test.com"
}
```

**Response** (Error):
```json
{
  "status": "error",
  "message": "Email atau password salah",
  "attempts_left": 3
}
```

**cURL**:
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@test.com",
    "password": "password123"
  }'
```

---

#### 2️⃣ Verify Login OTP

**Endpoint**: `POST /api/auth/verify-login-otp`

**Request**:
```json
{
  "email": "user@test.com",
  "otp": "123456"
}
```

**Response** (Success):
```json
{
  "status": "success",
  "message": "Login berhasil",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@test.com",
    "nama": "User Demo",
    "role": "user",
    "profile_photo": null
  }
}
```

**Response** (Error):
```json
{
  "status": "error",
  "message": "OTP salah"
}
```

**cURL**:
```bash
curl -X POST http://localhost:5000/api/auth/verify-login-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@test.com",
    "otp": "123456"
  }'
```

---

#### 3️⃣ Resend Login OTP

**Endpoint**: `POST /api/auth/resend-login-otp`

**Request**:
```json
{
  "email": "user@test.com"
}
```

**Response** (Success):
```json
{
  "status": "success",
  "message": "OTP baru terkirim ke user@test.com",
  "email": "user@test.com"
}
```

**cURL**:
```bash
curl -X POST http://localhost:5000/api/auth/resend-login-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "user@test.com"}'
```

---

#### 4️⃣ Google OAuth Login

**Endpoint**: `POST /api/auth/google-login`

**Request**:
```json
{
  "credential": "eyJhbGciOiJSUzI1NiIsImtpZCI6Ijc4YzIwNjE3ZjU1ZjExYzAwZDk2ZTM5M2E4ZWU2ZmU1M2QyYjYxYjYiLCJ0eXAiOiJKV1QifQ..."
}
```

**Response** (Auto-login/register):
```json
{
  "status": "success",
  "message": "Login Google berhasil",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 2,
    "email": "user@gmail.com",
    "nama": "User Name",
    "role": "user",
    "profile_photo": "https://...",
    "auth_provider": "google"
  }
}
```

**Frontend Usage**:
```javascript
import { GoogleLogin } from "@react-oauth/google";

<GoogleLogin
  onSuccess={async (credentialResponse) => {
    const response = await fetch('/api/auth/google-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        credential: credentialResponse.credential 
      })
    });
    const data = await response.json();
    // Handle login
  }}
/>
```

---

#### 5️⃣ Get Current User

**Endpoint**: `GET /api/auth/me`

**Headers**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response**:
```json
{
  "status": "success",
  "user": {
    "id": 1,
    "email": "user@test.com",
    "nama": "User Demo",
    "role": "user",
    "profile_photo": null,
    "auth_provider": "local",
    "email_verified": true,
    "last_login": "2026-05-29T10:30:00.000Z"
  }
}
```

**cURL**:
```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

#### 6️⃣ Logout

**Endpoint**: `POST /api/auth/logout`

**Headers**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response**:
```json
{
  "status": "success",
  "message": "Logout berhasil"
}
```

**Frontend**:
```javascript
const handleLogout = async () => {
  const token = localStorage.getItem('token');
  
  await fetch(`${API_URL}/api/auth/logout`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  // Clear localStorage
  localStorage.clear();
  history.push('/login');
};
```

---

## Frontend Integration Guide

### Step 1: Update Login Component

```javascript
// pundesari/src/views/Login.js

const handleLogin = async (e) => {
  e.preventDefault();
  
  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (data.status === 'otp_required') {
      // Store email and redirect
      localStorage.setItem('login_email', email);
      history.push('/otp-login');
    }
  } catch (err) {
    setError(err.message);
  }
};
```

### Step 2: Create OTP Component

```javascript
// pundesari/src/views/Otp.js

const handleVerify = async (e) => {
  e.preventDefault();
  const otpCode = otp.join('');
  
  try {
    const email = localStorage.getItem('login_email');
    const response = await fetch(`${API_URL}/api/auth/verify-login-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp: otpCode })
    });
    
    const data = await response.json();
    
    if (data.status === 'success') {
      // Save token and user data
      localStorage.setItem('token', data.token);
      localStorage.setItem('userId', data.user.id);
      localStorage.setItem('nome', data.user.nama);
      localStorage.setItem('role', data.user.role);
      
      // Redirect based on role
      history.push(`/${data.user.role}/dashboard`);
    }
  } catch (err) {
    setError('Verification failed');
  }
};
```

### Step 3: Add Authentication Interceptor

```javascript
// pundesari/src/services/api.js

export const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000'
});

// Add authorization header
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

---

## Testing Examples

### Postman Collection

```json
{
  "info": {
    "name": "K-TRASH Auth API",
    "version": "1.0.0"
  },
  "item": [
    {
      "name": "Login",
      "request": {
        "method": "POST",
        "url": "{{base_url}}/api/auth/login",
        "body": {
          "mode": "raw",
          "raw": "{ \"email\": \"user@test.com\", \"password\": \"123456\" }"
        }
      }
    },
    {
      "name": "Verify OTP",
      "request": {
        "method": "POST",
        "url": "{{base_url}}/api/auth/verify-login-otp",
        "body": {
          "mode": "raw",
          "raw": "{ \"email\": \"user@test.com\", \"otp\": \"123456\" }"
        }
      }
    }
  ]
}
```

### Test Cases

```javascript
// Manual Login Test
describe('Manual Login Flow', () => {
  test('Should return otp_required on successful password match', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@test.com', password: '123456' });
    
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('otp_required');
  });

  test('Should reject invalid password', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@test.com', password: 'wrong' });
    
    expect(response.status).toBe(401);
    expect(response.body.status).toBe('error');
  });

  test('Should lock account after 5 failed attempts', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@test.com', password: 'wrong' });
    }
    
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@test.com', password: 'wrong' });
    
    expect(response.status).toBe(429);
  });
});

// OTP Verification Test
describe('OTP Verification', () => {
  test('Should verify valid OTP', async () => {
    const response = await request(app)
      .post('/api/auth/verify-login-otp')
      .send({ email: 'user@test.com', otp: '123456' });
    
    expect(response.status).toBe(200);
    expect(response.body.token).toBeDefined();
  });

  test('Should reject expired OTP', async () => {
    // Wait 5+ minutes
    const response = await request(app)
      .post('/api/auth/verify-login-otp')
      .send({ email: 'user@test.com', otp: '123456' });
    
    expect(response.status).toBe(401);
    expect(response.body.message).toContain('kadaluarsa');
  });
});
```

---

## Debugging Tips

### Check JWT Token

```javascript
// In browser console
const token = localStorage.getItem('token');
console.log(JSON.parse(atob(token.split('.')[1]))); // Decode payload
```

### Monitor Email Sending

```javascript
// backend/src/services/mailService.js
console.log(`Sending OTP to: ${email}`);
console.log(`OTP Code: ${otp}`); // Remove in production!
```

### Check Database State

```sql
-- View all login attempts
SELECT * FROM login_otps ORDER BY created_at DESC LIMIT 10;

-- View user login history
SELECT id, email, last_login FROM users ORDER BY last_login DESC;

-- Check locked users
SELECT * FROM users WHERE locked_until > NOW();
```

---

## Performance Metrics

### Expected Response Times

- Login: < 100ms
- OTP Verify: < 150ms  
- Google Login: < 500ms (includes network)
- Get Current User: < 50ms

### Database Query Performance

```sql
-- Check query execution
EXPLAIN SELECT * FROM login_otps WHERE email = ? AND verified = false;
-- Should use idx_login_otps_unverified index
```

---

## Migration Checklist

### Pre-Launch

- [ ] All migrations applied to production database
- [ ] Environment variables set correctly
- [ ] Gmail App Password configured
- [ ] Google OAuth credentials created
- [ ] HTTPS enabled
- [ ] Rate limiting tested
- [ ] Email delivery verified
- [ ] JWT expiration tested
- [ ] Token refresh (if implemented) working
- [ ] Logout working properly
- [ ] Error handling complete
- [ ] Logging in place
- [ ] Monitoring set up
- [ ] Backup procedure ready

### Post-Launch Monitoring

- [ ] Monitor failed login attempts
- [ ] Track email delivery failures
- [ ] Monitor OTP verification rates
- [ ] Check API response times
- [ ] Review error logs daily
- [ ] Monitor database performance
- [ ] Check for suspicious activity

---

## Useful Commands

```bash
# View backend logs
tail -f /var/log/k-trash/backend.log

# Check database connections
SELECT COUNT(*) FROM information_schema.PROCESSLIST;

# Clear old OTPs (run daily)
DELETE FROM login_otps WHERE expires_at < NOW();

# Database backup
mysqldump -u root -p bank_sampah > backup.sql

# Restart backend service
pm2 restart backend
```

---

**Happy coding! 🚀**
