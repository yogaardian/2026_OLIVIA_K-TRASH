const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const otpGenerator = require('otp-generator');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');
const { OAuth2Client } = require('google-auth-library');
const { sendOTPEmail, sendWelcomeEmail } = require('../services/mailService');

const SALT_ROUNDS = 10;
const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 5;
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function generateOTP() {
  return otpGenerator.generate(OTP_LENGTH, {
    digits: true,
    alphabets: false,
    upperCase: false,
    specialChars: false,
  });
}

function getOtpExpiry() {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + OTP_TTL_MINUTES);
  return expiry;
}

exports.register = async (req, res) => {
  const { nama, email, password, role, nomor_hp } = req.body;
  const normalizedPassword = String(password || '').normalize('NFC');

  if (!nama || !email || !normalizedPassword || !role) {
    return res.status(400).json({ status: 'error', message: 'Semua field wajib diisi' });
  }

  try {
    const [existingUser] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser.length > 0) {
      return res.status(409).json({ status: 'error', message: 'Email sudah terdaftar' });
    }

    const hashedPassword = await bcrypt.hash(normalizedPassword, SALT_ROUNDS);
    const otp = generateOTP();
    const otpExpiresAt = getOtpExpiry();

    const [existingPending] = await db.query('SELECT id FROM pending_registrations WHERE email = ?', [email]);

    if (existingPending.length > 0) {
      await db.query(
        `UPDATE pending_registrations
         SET nama = ?, password = ?, role = ?, nomor_hp = ?, otp = ?, otp_expires_at = ?, updated_at = NOW()
         WHERE email = ?`,
        [nama, hashedPassword, role, nomor_hp || '', otp, otpExpiresAt, email]
      );
    } else {
      await db.query(
        `INSERT INTO pending_registrations
         (nama, email, password, role, nomor_hp, otp, otp_expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [nama, email, hashedPassword, role, nomor_hp || '', otp, otpExpiresAt]
      );
    }

    const sendResult = await sendOTPEmail(email, otp, 'pendaftaran');

    const response = {
      status: 'otp_sent',
      message: 'Kode OTP pendaftaran telah dikirim ke email Anda',
      email,
    };

    if (sendResult.fallback && sendResult.otp) {
      response.debugOtp = sendResult.otp;
      response.message += ' (OTP tersedia di mode development)';
    }

    return res.status(200).json(response);
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

exports.verifyRegister = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ status: 'error', message: 'Email dan OTP diperlukan' });
  }

  try {
    const [rows] = await db.query('SELECT * FROM pending_registrations WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Permintaan pendaftaran tidak ditemukan' });
    }

    const pending = rows[0];
    const now = new Date();
    if (pending.otp !== otp) {
      return res.status(400).json({ status: 'error', message: 'Kode OTP tidak valid' });
    }
    if (new Date(pending.otp_expires_at) < now) {
      return res.status(400).json({ status: 'error', message: 'Kode OTP telah kedaluwarsa' });
    }

    const [existingUser] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser.length > 0) {
      await db.query('DELETE FROM pending_registrations WHERE email = ?', [email]);
      return res.status(409).json({ status: 'error', message: 'Email sudah terdaftar' });
    }

    const [result] = await db.query(
      `INSERT INTO users (nama, email, password, role, nomor_hp, saldo, saldo_hold)
       VALUES (?, ?, ?, ?, ?, 0, 0)`,
      [pending.nama, pending.email, pending.password, pending.role, pending.nomor_hp || '']
    );

    const [userRows] = await db.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
    const user = userRows[0];

    await db.query('DELETE FROM pending_registrations WHERE email = ?', [email]);

    try {
      await sendWelcomeEmail(email, pending.nama);
    } catch (warn) {
      console.warn('Welcome email failed:', warn.message);
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      status: 'success',
      message: 'Registrasi berhasil',
      token,
      user: {
        id: user.id,
        nama: user.nama,
        email: user.email,
        role: user.role,
        nomor_hp: user.nomor_hp || null,
        profile_photo: user.profile_photo || null,
      },
    });
  } catch (err) {
    console.error('Verify register error:', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

exports.resendRegisterOTP = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ status: 'error', message: 'Email diperlukan' });
  }

  try {
    const [rows] = await db.query('SELECT * FROM pending_registrations WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Permintaan pendaftaran tidak ditemukan' });
    }

    const otp = generateOTP();
    const otpExpiresAt = getOtpExpiry();

    await db.query(
      `UPDATE pending_registrations SET otp = ?, otp_expires_at = ?, updated_at = NOW() WHERE email = ?`,
      [otp, otpExpiresAt, email]
    );

    const sendResult = await sendOTPEmail(email, otp, 'pendaftaran');
    const response = { status: 'success', message: 'OTP baru telah dikirim ke email Anda' };

    if (sendResult.fallback && sendResult.otp) {
      response.message += ' (OTP tersedia di mode development)';
      response.debugOtp = sendResult.otp;
    }

    return res.json(response);
  } catch (err) {
    console.error('Resend OTP error:', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const normalizedPassword = String(password || '').normalize('NFC');

  if (!email || !normalizedPassword) {
    return res.status(400).json({ status: 'error', message: 'Email dan password diperlukan' });
  }

  try {
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ status: 'error', message: 'Email atau password tidak valid' });
    }

    const user = users[0];
    let isValidPassword = false;
    const passwordHash = user.password || '';

    const isBcryptHash = typeof passwordHash === 'string' && passwordHash.startsWith('$2');
    if (isBcryptHash) {
      isValidPassword = await bcrypt.compare(normalizedPassword, passwordHash);
    } else {
      isValidPassword = normalizedPassword === passwordHash;
    }

    if (!isValidPassword) {
      return res.status(401).json({ status: 'error', message: 'Email atau password tidak valid' });
    }

    if (isBcryptHash && !passwordHash.startsWith('$2b$')) {
      try {
        const newHash = await bcrypt.hash(password, SALT_ROUNDS);
        await db.query('UPDATE users SET password = ? WHERE id = ?', [newHash, user.id]);
      } catch (rehashErr) {
        console.warn('Password rehash warning:', rehashErr.message);
      }
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      status: 'success',
      message: 'Login berhasil',
      token,
      user: {
        id: user.id,
        nama: user.nama,
        email: user.email,
        role: user.role,
        nomor_hp: user.nomor_hp || null,
        profile_photo: user.profile_photo || null,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};
// Token validation endpoint - called by frontend on app load to verify stored token
exports.validateToken = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'error', valid: false, message: 'Invalid token' });
    }

    return res.status(200).json({
      status: 'ok',
      valid: true,
      user: {
        id: req.user.id,
        nama: req.user.nama,
        email: req.user.email,
        role: req.user.role,
        nomor_hp: req.user.nomor_hp || null,
        profile_photo: req.user.profile_photo || null,
      },
    });
  } catch (err) {
    console.error('Token validation error:', err);
    return res.status(401).json({ status: 'error', valid: false, message: 'Invalid token' });
  }
};
exports.googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential || typeof credential !== 'string' || !credential.trim()) {
      return res.status(400).json({ status: 'error', message: 'Credential Google diperlukan' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub, email, name, picture } = payload;

    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    let user;

    if (rows.length > 0) {
      user = rows[0];
      await db.query('UPDATE users SET google_id = ?, profile_photo = ? WHERE id = ?', [sub, picture, user.id]);
    } else {
      const [insertResult] = await db.query(
        `INSERT INTO users (nama, email, google_id, profile_photo, role, saldo, saldo_hold)
         VALUES (?, ?, ?, ?, ?, 0, 0)`,
        [name, email, sub, picture, 'user']
      );

      const [newUserRows] = await db.query('SELECT * FROM users WHERE id = ?', [insertResult.insertId]);
      user = newUserRows[0];
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      status: 'success',
      message: 'Google login successful',
      token,
      user: {
        id: user.id,
        nama: user.nama,
        email: user.email,
        role: user.role,
        nomor_hp: user.nomor_hp || null,
        profile_photo: user.profile_photo || null,
      },
    });
  } catch (err) {
    console.error('Google login error:', err);
    const isAuthError = /Wrong number of segments|invalid token|Invalid token|Token used too late|Wrong number of segments/i.test(err.message || '');
    const statusCode = isAuthError ? 401 : 500;
    const message = isAuthError ? 'Google credential tidak valid' : 'Google login gagal';
    return res.status(statusCode).json({ status: 'error', message, error: err.message });
  }
};