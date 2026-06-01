-- Migration: Create login_otps table
-- Date: 2026-05-29

CREATE TABLE login_otps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  otp_code VARCHAR(10) NOT NULL,
  expires_at DATETIME NOT NULL,
  attempts INT DEFAULT 0,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_login_otps_email (email),
  INDEX idx_login_otps_expires (expires_at)
);

-- Create index for performance
CREATE INDEX idx_login_otps_unverified ON login_otps(email, verified);
