const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const {
  loginLimiter,
  otpLimiter,
  otpResendLimiter,
  registerLimiter,
} = require('../middleware/rateLimiter');

router.post('/register', registerLimiter, authController.register);
router.post('/register/verify', otpLimiter, authController.verifyRegister);
router.post('/register/resend', otpResendLimiter, authController.resendRegisterOTP);
router.post('/login', loginLimiter, authController.login);
router.post('/google-login', authController.googleLogin);
router.post('/validate-token', authenticateToken, authController.validateToken);

module.exports = router;
