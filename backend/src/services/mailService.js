const nodemailer = require("nodemailer");

const MAIL_USER = process.env.EMAIL_USER || process.env.MAIL_USER;
const MAIL_PASS = process.env.EMAIL_PASS || process.env.MAIL_PASS;
const isProduction = process.env.NODE_ENV === 'production';
const isEmailConfigured = !!MAIL_USER && !!MAIL_PASS;

const transporter = isEmailConfigured
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: MAIL_USER,
        pass: MAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
    })
  : null;

const sendMail = async (mailOptions) => {
  if (!transporter) {
    console.warn('⚠️ Email transport tidak dikonfigurasi. Menggunakan fallback log saja.');
    console.log('Email fallback:', mailOptions);
    return { fallback: true };
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    return { info, fallback: false };
  } catch (error) {
    console.error('❌ Gagal mengirim email:', error);
    if (!isProduction) {
      console.warn('⚠️ Registrasi berjalan di mode non-production; OTP dicetak di konsol agar tidak memblokir alur pendaftaran.');
      console.log('Email fallback:', mailOptions);
      return { fallback: true, error };
    }
    throw error;
  }
};

/**
 * Send OTP Email untuk pendaftaran atau login
 */
const sendOTPEmail = async (email, otp, purpose = 'login') => {
  try {
    const isRegistration = purpose === 'pendaftaran';
    const title = isRegistration ? '🔐 Kode OTP Pendaftaran K-TRASH' : '🔐 Kode OTP Login K-TRASH';
    const message = isRegistration
      ? 'Gunakan kode berikut untuk memverifikasi pendaftaran akun K-TRASH Anda:'
      : 'Gunakan kode berikut untuk login ke akun K-TRASH Anda:';
    const subject = isRegistration
      ? 'Kode OTP Pendaftaran K-TRASH - 5 Menit'
      : 'Kode OTP Login K-TRASH - 5 Menit';

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8fafc; border-radius: 12px;">
        <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h2 style="color: #0f766e; margin-bottom: 10px;">${title}</h2>
          <p style="color: #64748b; margin-bottom: 20px;">${message}</p>
          
          <div style="background: #f0fdfa; border: 2px solid #0d9488; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0;">
            <p style="margin: 0; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px;">Kode OTP</p>
            <h1 style="margin: 0; font-size: 48px; letter-spacing: 10px; color: #0f766e; font-weight: bold; font-family: 'Courier New', monospace;">${otp}</h1>
          </div>

          <p style="color: #64748b; margin-bottom: 20px;">Kode berlaku selama 5 menit. Jangan bagikan kode ini kepada siapapun.</p>
          
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
            <p style="margin: 0; color: #92400e; font-size: 14px;">⚠️ Jika Anda tidak meminta kode ini, abaikan email ini.</p>
          </div>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
          
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">K-TRASH Security • Sistem Manajemen Sampah</p>
          <p style="color: #94a3b8; font-size: 12px; margin: 5px 0 0 0;">© 2026 K-TRASH. Semua hak cipta dilindungi.</p>
        </div>
      </div>
    `;

    const result = await sendMail({
      from: `"K-TRASH Security" <${MAIL_USER || 'no-reply@example.com'}>`,
      to: email,
      subject,
      html,
    });

    if (!result.fallback) {
      console.log(`✅ OTP email terkirim ke: ${email}`);
    }

    return {
      sent: !result.fallback,
      fallback: result.fallback,
      otp: !isProduction ? otp : undefined,
    };
  } catch (error) {
    console.error('❌ Gagal mengirim OTP email:', error);
    if (!isProduction) {
      console.warn('⚠️ Mode non-production: tetap melanjutkan pendaftaran tanpa gagal jika email tidak dapat dikirim.');
      return { sent: false, fallback: true, otp };
    }
    throw new Error(`Email service error: ${error.message}`);
  }
};

/**
 * Send Welcome Email setelah registration
 */
const sendWelcomeEmail = async (email, name) => {
  try {
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8fafc; border-radius: 12px;">
        <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h2 style="color: #0f766e; margin-bottom: 10px;">👋 Selamat Datang di K-TRASH!</h2>
          <p style="color: #64748b; margin-bottom: 20px;">Halo <strong>${name}</strong>, akun Anda berhasil dibuat.</p>
          
          <p style="color: #64748b; margin-bottom: 20px;">Sekarang Anda dapat:</p>
          <ul style="color: #64748b; margin-bottom: 20px;">
            <li>Menjemput sampah dengan mudah</li>
            <li>Melacak status penjemputan real-time</li>
            <li>Melihat riwayat transaksi</li>
            <li>Mengelola saldo digital</li>
          </ul>

          <a href="${process.env.FRONTEND_URL || 'https://k-trash.vercel.app'}/dashboard" style="display: inline-block; background: #0d9488; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">Buka Dashboard</a>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
          
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">K-TRASH • Sistem Manajemen Sampah</p>
        </div>
      </div>
    `;

    const result = await sendMail({
      from: `"K-TRASH" <${MAIL_USER || 'no-reply@example.com'}>`,
      to: email,
      subject: "Selamat Datang di K-TRASH!",
      html: html,
    });

    if (!result.fallback) {
      console.log(`✅ Welcome email terkirim ke: ${email}`);
    } else {
      console.warn('⚠️ Welcome email tidak terkirim; fallback aktif.');
    }

    return { sent: !result.fallback, fallback: result.fallback };
  } catch (error) {
    console.error("❌ Gagal mengirim welcome email:", error);
    if (!isProduction) {
      console.warn('⚠️ Mode non-production: welcome email tidak memblokir alur.');
      return { sent: false, fallback: true };
    }
    throw new Error(`Email service error: ${error.message}`);
  }
};

/**
 * Send Forgot Password OTP
 */
const sendForgotPasswordEmail = async (email, otp) => {
  try {
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8fafc; border-radius: 12px;">
        <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h2 style="color: #0f766e; margin-bottom: 10px;">🔑 Reset Password K-TRASH</h2>
          <p style="color: #64748b; margin-bottom: 20px;">Gunakan kode berikut untuk mereset password Anda:</p>
          
          <div style="background: #f0fdfa; border: 2px solid #0d9488; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0;">
            <p style="margin: 0; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px;">Kode Reset</p>
            <h1 style="margin: 0; font-size: 48px; letter-spacing: 10px; color: #0f766e; font-weight: bold; font-family: 'Courier New', monospace;">${otp}</h1>
          </div>

          <p style="color: #64748b; margin-bottom: 20px;">Kode berlaku selama 15 menit.</p>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
          
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">K-TRASH Security</p>
        </div>
      </div>
    `;

    const result = await sendMail({
      from: `"K-TRASH Security" <${MAIL_USER || 'no-reply@example.com'}>`,
      to: email,
      subject: "Kode Reset Password K-TRASH - 15 Menit",
      html: html,
    });

    if (!result.fallback) {
      console.log(`✅ Forgot password email terkirim ke: ${email}`);
    } else {
      console.warn('⚠️ Forgot password email tidak terkirim; fallback aktif.');
    }

    return { sent: !result.fallback, fallback: result.fallback };
  } catch (error) {
    console.error("❌ Gagal mengirim forgot password email:", error);
    if (!isProduction) {
      console.warn('⚠️ Mode non-production: forgot password email tidak memblokir alur.');
      return { sent: false, fallback: true };
    }
    throw new Error(`Email service error: ${error.message}`);
  }
};

module.exports = {
  sendOTPEmail,
  sendWelcomeEmail,
  sendForgotPasswordEmail,
};
