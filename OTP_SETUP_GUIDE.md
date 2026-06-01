# 🔐 K-TRASH OTP Authentication System Setup Guide

## Overview

Production-ready authentication system dengan:
- ✅ Login Manual + OTP Email (5 menit expiry)
- ✅ Google OAuth (auto login tanpa OTP)
- ✅ Rate Limiting (5x login attempts per 15 menit)
- ✅ JWT Tokens (7 hari expiry)
- ✅ Hashed Passwords (bcryptjs)
- ✅ Secure Email Service (Nodemailer Gmail)
- ✅ Session Management

---

## 📋 Checklist Sebelum Implementasi

### Backend Setup

- [ ] MySQL tables sudah updated dengan migrations
- [ ] `backend/.env` sudah dikonfigurasi dengan:
  - `JWT_SECRET` (random string)
  - `JWT_EXPIRES_IN=7d`
  - `MAIL_USER` (Gmail dengan 2FA enabled)
  - `MAIL_PASS` (Google App Password, bukan password Gmail biasa)
  - `GOOGLE_CLIENT_ID` (dari Google Cloud Console)
  - `OTP_EXPIRE_MINUTES=5`
- [ ] Dependencies sudah di-install: `npm install` di backend folder
- [ ] Backend server bisa start: `npm start` atau `npm run dev`

### Frontend Setup

- [ ] `.env` file di `pundesari/` sudah punya:
  - `REACT_APP_GOOGLE_CLIENT_ID` (dari Google Cloud Console)
  - `REACT_APP_API_URL=http://localhost:5000` (untuk dev)
- [ ] React components sudah updated (Login.js, Otp.js)
- [ ] Frontend server bisa start: `npm start` di pundesari folder

---

## 🚀 Setup Langkah Demi Langkah

### Step 1: Database Migrations

Jalankan SQL migrations untuk update schema:

```bash
# Koneksi ke MySQL
mysql -u root -p bank_sampah

# Paste isi dari migrations/001_update_users_table.sql
# Paste isi dari migrations/002_create_login_otps_table.sql
```

### Step 2: Gmail App Password

1. Buka [Google Account Security](https://myaccount.google.com/security)
2. Enable "2-Step Verification" jika belum
3. Buat "App Password" untuk Mail:
   - Pilih: App = Mail, Device = Windows/Mac/Linux
   - Copy generated password
   - Paste ke `MAIL_PASS` di `.env`

**JANGAN gunakan password Gmail biasa!**

### Step 3: Google Cloud OAuth Setup

1. Buka [Google Cloud Console](https://console.cloud.google.com)
2. Create Project atau gunakan existing
3. Enable "Google+ API"
4. Create "OAuth 2.0 Client ID" untuk Web Application:
   - Authorized JavaScript origins:
     - `http://localhost:3003`
     - `https://yourdomain.com` (production)
   - Authorized redirect URIs:
     - `http://localhost:3003`
     - `https://yourdomain.com` (production)
5. Copy Client ID ke `GOOGLE_CLIENT_ID` dan `REACT_APP_GOOGLE_CLIENT_ID`

### Step 4: Backend Environment Variables

Edit `backend/.env`:

```env
# JWT Configuration
JWT_SECRET=your_super_secret_random_string_here_minimum_32_chars
JWT_EXPIRES_IN=7d

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com

# Email Service (Gmail)
MAIL_USER=your_gmail@gmail.com
MAIL_PASS=your_google_app_password_16_chars

# OTP Configuration
OTP_EXPIRE_MINUTES=5

# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=bank_sampah
DB_PORT=3306

# Server
PORT=5000
NODE_ENV=development

# CORS
CORS_ALLOW_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003
```

### Step 5: Frontend Environment Variables

Edit `pundesari/.env`:

```env
REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
REACT_APP_API_URL=http://localhost:5000
```

### Step 6: Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../pundesari
npm install
```

---

## 🧪 Testing Checklist

### Local Testing

#### Test 1: Manual Login + OTP Flow
```
1. Buka http://localhost:3003/login
2. Input email (user@test.com) dan password (123456)
3. Klik "Masuk Sekarang"
4. ✓ Harus redirect ke /otp-login
5. ✓ Email harus terkirim ke inbox (check spam folder)
6. Copy OTP dari email
7. Input 6 digit OTP
8. ✓ Harus redirect ke dashboard
9. ✓ User harus login
```

#### Test 2: Google OAuth Login
```
1. Buka http://localhost:3003/login
2. Klik tombol "Google Login"
3. ✓ Harus redirect ke Google consent screen
4. Pilih akun Google
5. ✓ Harus auto redirect ke dashboard
6. ✓ User harus login tanpa OTP
```

#### Test 3: Rate Limiting
```
1. Login dengan email salah 5x dalam 15 menit
2. ✓ Request ke-6 harus di-block dengan pesan "Terlalu banyak percobaan"
3. Tunggu 15 menit atau clear cache
4. ✓ Bisa login lagi
```

#### Test 4: OTP Expiry
```
1. Login dan masuk ke OTP page
2. Tunggu 5+ menit tanpa submit
3. Masukkan OTP yang lama
4. ✓ Harus dapat error "OTP telah kadaluarsa"
5. Klik "Kirim Ulang Kode"
6. ✓ OTP baru harus terkirim
7. Input OTP baru
8. ✓ Harus berhasil login
```

#### Test 5: JWT Token Validation
```
1. Login berhasil dan masuk dashboard
2. Check localStorage:
   - token (harus ada JWT token)
   - userId
   - nama
   - role
   - isLogin=true
3. ✓ Token harus bisa di-decode di jwt.io
4. ✓ Token harus expired setelah 7 hari (dev)
```

#### Test 6: Logout
```
1. Masuk dashboard
2. Klik logout
3. ✓ localStorage semua harus dihapus
4. ✓ Redirect ke /login
5. ✓ Refresh page harus redirect ke /login juga
```

---

## 🔧 API Endpoints

### Authentication Endpoints

#### 1. Manual Login
```
POST /api/auth/login
Body: { email, password }
Response:
- Status "otp_required": OTP terkirim, silakan verifikasi
- Returns: { status, email }
```

#### 2. Verify Login OTP
```
POST /api/auth/verify-login-otp
Body: { email, otp }
Response:
- Status "success": Login berhasil
- Returns: { status, token, user }
```

#### 3. Resend Login OTP
```
POST /api/auth/resend-login-otp
Body: { email }
Response:
- Status "success": OTP baru terkirim
```

#### 4. Google OAuth Login
```
POST /api/auth/google-login
Body: { credential }
Response:
- Status "success": Login berhasil (otomatis register jika user baru)
- Returns: { status, token, user }
```

#### 5. Get Current User
```
GET /api/auth/me
Header: Authorization: Bearer {token}
Response:
- Returns: user data
```

#### 6. Logout
```
POST /api/auth/logout
Header: Authorization: Bearer {token}
Response:
- Status "success"
```

---

## 📱 Frontend Flow

### Manual Login Flow
```
Login Page (email + password)
        ↓
Verify Password
        ↓
Generate & Send OTP Email
        ↓
Redirect to OTP Page (/otp-login)
        ↓
User Input OTP
        ↓
Verify OTP
        ↓
Generate JWT Token
        ↓
Save to localStorage
        ↓
Redirect to Dashboard (based on role)
```

### Google OAuth Flow
```
Login Page
        ↓
Click Google Login Button
        ↓
Google Consent Screen
        ↓
Verify Google Token
        ↓
Auto Login/Register
        ↓
Generate JWT Token
        ↓
Save to localStorage
        ↓
Redirect to Dashboard
(NO OTP NEEDED!)
```

---

## 🚨 Security Best Practices

### ✅ Implemented

1. **Password Hashing**: bcryptjs dengan salt rounds = 10
2. **JWT Expiry**: 7 hari default
3. **OTP Expiry**: 5 menit
4. **Rate Limiting**:
   - Login: 5 attempts per 15 menit
   - OTP Verify: 10 attempts per 15 menit
   - OTP Resend: 3 attempts per 5 menit
5. **Account Locking**: 5 failed attempts = lock 30 menit
6. **Email Security**: HTML email format dengan branding
7. **HTTPS Ready**: Railway + Vercel otomatis HTTPS

### ⚠️ NOT YET (Untuk production lanjutan)

1. **Refresh Tokens**: Implement refresh token rotation
2. **Device Tracking**: Track login devices dan locations
3. **Suspicious Activity**: Detect unusual login patterns
4. **Forgot Password OTP**: Implement password reset flow
5. **Revoke Token**: Implement token blacklist
6. **2FA**: Add authenticator app atau SMS 2FA
7. **Session Storage**: Use httpOnly cookies instead localStorage

---

## 🌐 Production Deployment

### Railway Backend

1. Push code ke GitHub
2. Connect Railway ke GitHub repo
3. Set Environment Variables di Railway:
   ```
   JWT_SECRET=your_prod_secret
   MAIL_USER=your_gmail@gmail.com
   MAIL_PASS=your_app_password
   GOOGLE_CLIENT_ID=your_client_id
   DB_HOST=your_railway_mysql_host
   DB_NAME=bank_sampah
   DB_USER=root
   DB_PASSWORD=your_password
   NODE_ENV=production
   CORS_ALLOW_ORIGINS=https://yourdomain.com
   ```
4. Deploy
5. Verify API: `https://your-backend.railway.app/api/auth/me`

### Vercel Frontend

1. Push code ke GitHub
2. Connect Vercel ke GitHub repo
3. Set Environment Variables:
   ```
   REACT_APP_GOOGLE_CLIENT_ID=your_client_id
   REACT_APP_API_URL=https://your-backend.railway.app
   ```
4. Deploy
5. Test: `https://yourdomain.vercel.app/login`

---

## 🐛 Troubleshooting

### Email tidak terkirim

**Problem**: OTP email tidak masuk inbox

**Solution**:
1. Check `MAIL_USER` dan `MAIL_PASS` di `.env`
2. Pastikan Gmail account punya 2FA dan sudah buat App Password
3. Check backend logs untuk error detail
4. Check spam folder
5. Pastikan `MAIL_PASS` bukan password Gmail biasa

### Google login tidak bekerja

**Problem**: "Google login gagal"

**Solution**:
1. Check `GOOGLE_CLIENT_ID` di frontend `.env`
2. Pastikan Client ID sudah authorized di Google Cloud Console
3. Check authorized origins dan redirect URIs di Google Cloud
4. Clear browser cache dan localStorage
5. Refresh halaman

### OTP invalid terus

**Problem**: "OTP salah" padahal input benar

**Solution**:
1. Pastikan database sudah di-migrate dengan benar
2. Check `login_otps` table ada dan tidak kosong
3. Check OTP tidak expired (5 menit)
4. Pastikan email sama persis di semua tempat
5. Check database clock sama dengan server

### JWT token tidak bisa verify

**Problem**: "Invalid token" di API

**Solution**:
1. Pastikan `JWT_SECRET` sama di semua tempat (backend `.env`)
2. Check token tidak expired
3. Check format header: `Authorization: Bearer {token}`
4. Clear localStorage dan login lagi
5. Check backend server sudah restart setelah update `.env`

---

## 📞 Support

Untuk issues atau pertanyaan, hubungi developer atau check backend logs:

```bash
# Backend logs
tail -f backend/server.log

# Frontend console
F12 → Console tab
```

---

**Happy Authenticating! 🎉**
