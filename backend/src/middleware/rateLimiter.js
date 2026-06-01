const rateLimit = require("express-rate-limit");

/**
 * Rate limiter untuk login endpoint
 * Max 5 attempts per 15 menit
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 5, // max 5 requests
  message: {
    status: "error",
    message: "Terlalu banyak percobaan login. Silakan coba lagi dalam 15 menit.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method !== "POST",
  keyGenerator: (req) => {
    // Gunakan email atau IP address sebagai key
    return req.body.email || req.ip;
  },
});

/**
 * Rate limiter untuk OTP verification
 * Max 10 attempts per 15 menit
 */
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 10, // max 10 requests
  message: {
    status: "error",
    message: "Terlalu banyak percobaan verifikasi OTP. Silakan coba lagi nanti.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.body.email || req.ip;
  },
});

/**
 * Rate limiter untuk OTP resend
 * Max 3 attempts per 5 menit
 */
const otpResendLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 menit
  max: 3, // max 3 requests
  message: {
    status: "error",
    message: "Terlalu sering meminta OTP. Coba lagi dalam 5 menit.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.body.email || req.ip;
  },
});

/**
 * Rate limiter untuk registration
 * Max 3 attempts per 1 jam
 */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 jam
  max: 3, // max 3 requests
  message: {
    status: "error",
    message: "Terlalu banyak percobaan registrasi. Coba lagi dalam 1 jam.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.body.email || req.ip;
  },
});

/**
 * Rate limiter umum untuk API
 * Gunakan batas cukup besar untuk aplikasi realtime/polling.
 * Max 500 requests per 15 menit (sekitar 33 request per menit).
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 500, // max 500 requests
  message: {
    status: "error",
    message: "Terlalu banyak request. Silakan coba lagi nanti.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  loginLimiter,
  otpLimiter,
  otpResendLimiter,
  registerLimiter,
  apiLimiter,
};
