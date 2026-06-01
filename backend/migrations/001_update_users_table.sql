-- Migration: Update users table with auth provider and security fields
-- Date: 2026-05-29

ALTER TABLE users
ADD COLUMN auth_provider ENUM('local','google') DEFAULT 'local',
ADD COLUMN google_id VARCHAR(255) NULL UNIQUE,
ADD COLUMN email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN last_login DATETIME NULL,
ADD COLUMN failed_login_attempts INT DEFAULT 0,
ADD COLUMN locked_until DATETIME NULL;

-- Create index for google_id lookups
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_locked_until ON users(locked_until);
