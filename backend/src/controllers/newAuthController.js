const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const otpGenerator = require("otp-generator");
const { OAuth2Client } = require("google-auth-library");
const { sendOTPEmail, sendWelcomeEmail } = require("../services/mailService");
const db = require("../db");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * LOGIN MANUAL - Generate OTP
 * POST /api/auth/login
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validasi input
    if (!email || !password) {
      return res.status(400).json({
        status: "error",
        message: "Email dan password harus diisi",
      });
    }

    // Query user
    const [users] = await db.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (users.length === 0) {
      return res.status(401).json({
        status: "error",
        message: "Email atau password salah",
      });
    }

    const user = users[0];

    // Cek jika akun terkunci (brute force protection)
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(429).json({
        status: "error",
        message: "Akun terkunci sementara. Coba lagi nanti.",
      });
    }

    // Verifikasi password
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      // Increment failed attempts
      const failedAttempts = user.failed_login_attempts + 1;
      let lockedUntil = null;

      // Lock akun jika 5x gagal
      if (failedAttempts >= 5) {
        lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // Lock 30 menit
      }

      await db.query(
        "UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?",
        [failedAttempts, lockedUntil, user.id]
      );

      return res.status(401).json({
        status: "error",
        message: "Email atau password salah",
        attempts_left: 5 - failedAttempts,
      });
    }

    // Generate OTP
    const otp = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      specialChars: false,
      alphabets: false,
    });

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 menit

    // Simpan OTP ke database
    await db.query(
      "INSERT INTO login_otps (email, otp_code, expires_at, attempts, verified) VALUES (?, ?, ?, ?, ?)",
      [email, otp, expiresAt, 0, false]
    );

    // Kirim OTP via email
    await sendOTPEmail(email, otp);

    // Reset failed attempts
    await db.query(
      "UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?",
      [user.id]
    );

    return res.json({
      status: "otp_required",
      message: `OTP terkirim ke ${email}`,
      email,
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    return res.status(500).json({
      status: "error",
      message: "Terjadi kesalahan saat login",
    });
  }
};

/**
 * VERIFY LOGIN OTP
 * POST /api/auth/verify-login-otp
 */
exports.verifyLoginOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Validasi input
    if (!email || !otp) {
      return res.status(400).json({
        status: "error",
        message: "Email dan OTP harus diisi",
      });
    }

    // Cari OTP terbaru yang belum terverifikasi
    const [otpRecords] = await db.query(
      "SELECT * FROM login_otps WHERE email = ? AND otp_code = ? AND verified = false ORDER BY created_at DESC LIMIT 1",
      [email, otp]
    );

    if (otpRecords.length === 0) {
      // Increment attempts
      const [attemptRecords] = await db.query(
        "SELECT * FROM login_otps WHERE email = ? AND verified = false ORDER BY created_at DESC LIMIT 1",
        [email]
      );

      if (attemptRecords.length > 0) {
        const attempts = attemptRecords[0].attempts + 1;
        await db.query(
          "UPDATE login_otps SET attempts = ? WHERE id = ?",
          [attempts, attemptRecords[0].id]
        );
      }

      return res.status(401).json({
        status: "error",
        message: "OTP salah",
      });
    }

    const otpData = otpRecords[0];

    // Cek jika OTP expired
    if (new Date() > new Date(otpData.expires_at)) {
      return res.status(401).json({
        status: "error",
        message: "OTP telah kadaluarsa. Silakan minta OTP baru.",
      });
    }

    // Mark OTP as verified
    await db.query("UPDATE login_otps SET verified = true WHERE id = ?", [
      otpData.id,
    ]);

    // Get user
    const [users] = await db.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (users.length === 0) {
      return res.status(401).json({
        status: "error",
        message: "User tidak ditemukan",
      });
    }

    const user = users[0];

    // Generate JWT
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "7d",
      }
    );

    // Update last login
    await db.query(
      "UPDATE users SET last_login = NOW(), email_verified = true WHERE id = ?",
      [user.id]
    );

    return res.json({
      status: "success",
      message: "Login berhasil",
      token,
      user: {
        id: user.id,
        email: user.email,
        nama: user.nama,
        role: user.role,
        profile_photo: user.profile_photo,
      },
    });
  } catch (err) {
    console.error("❌ Verify OTP error:", err);
    return res.status(500).json({
      status: "error",
      message: "Terjadi kesalahan saat verifikasi OTP",
    });
  }
};

/**
 * RESEND OTP LOGIN
 * POST /api/auth/resend-login-otp
 */
exports.resendLoginOTP = async (req, res) => {
  try {
    const { email } = req.body;

    // Validasi input
    if (!email) {
      return res.status(400).json({
        status: "error",
        message: "Email harus diisi",
      });
    }

    // Cek user exist
    const [users] = await db.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (users.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "User tidak ditemukan",
      });
    }

    // Generate OTP baru
    const otp = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      specialChars: false,
      alphabets: false,
    });

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 menit

    // Simpan OTP ke database
    await db.query(
      "INSERT INTO login_otps (email, otp_code, expires_at, attempts, verified) VALUES (?, ?, ?, ?, ?)",
      [email, otp, expiresAt, 0, false]
    );

    // Kirim OTP via email
    await sendOTPEmail(email, otp);

    return res.json({
      status: "success",
      message: `OTP baru terkirim ke ${email}`,
      email,
    });
  } catch (err) {
    console.error("❌ Resend OTP error:", err);
    return res.status(500).json({
      status: "error",
      message: "Terjadi kesalahan saat mengirim OTP",
    });
  }
};

/**
 * GOOGLE LOGIN - Tidak perlu OTP
 * POST /api/auth/google-login
 */
exports.googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;

    // Validasi input
    if (!credential) {
      return res.status(400).json({
        status: "error",
        message: "Google token harus diisi",
      });
    }

    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    // Cek user exist
    let [users] = await db.query("SELECT * FROM users WHERE google_id = ?", [
      googleId,
    ]);

    let user;

    if (users.length === 0) {
      // Register user baru dengan Google
      const [result] = await db.query(
        `INSERT INTO users (email, nama, google_id, auth_provider, email_verified, profile_photo, last_login, password)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [
          email,
          name || email.split("@")[0],
          googleId,
          "google",
          true,
          picture || null,
          bcrypt.hashSync("", 10), // Empty password untuk Google auth
        ]
      );

      // Get newly created user
      [users] = await db.query("SELECT * FROM users WHERE id = ?", [
        result.insertId,
      ]);

      user = users[0];

      // Kirim welcome email
      await sendWelcomeEmail(email, name || email.split("@")[0]);
    } else {
      user = users[0];

      // Update last login & profile picture
      await db.query(
        "UPDATE users SET last_login = NOW(), profile_photo = ? WHERE id = ?",
        [picture || user.profile_photo, user.id]
      );
    }

    // Generate JWT
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "7d",
      }
    );

    return res.json({
      status: "success",
      message: "Login Google berhasil",
      token,
      user: {
        id: user.id,
        email: user.email,
        nama: user.nama,
        role: user.role,
        profile_photo: user.profile_photo,
        auth_provider: user.auth_provider,
      },
    });
  } catch (err) {
    console.error("❌ Google login error:", err);
    return res.status(401).json({
      status: "error",
      message: "Gagal verifikasi Google token",
    });
  }
};

/**
 * LOGOUT
 * POST /api/auth/logout
 */
exports.logout = async (req, res) => {
  try {
    // Client side akan delete token dari localStorage
    return res.json({
      status: "success",
      message: "Logout berhasil",
    });
  } catch (err) {
    console.error("❌ Logout error:", err);
    return res.status(500).json({
      status: "error",
      message: "Terjadi kesalahan saat logout",
    });
  }
};

/**
 * GET CURRENT USER
 * GET /api/auth/me
 */
exports.getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.id;

    const [users] = await db.query("SELECT * FROM users WHERE id = ?", [
      userId,
    ]);

    if (users.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "User tidak ditemukan",
      });
    }

    const user = users[0];

    return res.json({
      status: "success",
      user: {
        id: user.id,
        email: user.email,
        nama: user.nama,
        role: user.role,
        profile_photo: user.profile_photo,
        auth_provider: user.auth_provider,
        email_verified: user.email_verified,
        last_login: user.last_login,
      },
    });
  } catch (err) {
    console.error("❌ Get current user error:", err);
    return res.status(500).json({
      status: "error",
      message: "Terjadi kesalahan",
    });
  }
};
