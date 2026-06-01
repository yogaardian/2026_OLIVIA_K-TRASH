-- Google OAuth Migration for K-TRASH
-- Run this to add Google OAuth support to the users table

-- Add google_id column (for Google sub identifier)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) NULL UNIQUE COMMENT 'Google sub identifier for OAuth';

-- Add profile_photo column (for Google profile picture)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS profile_photo TEXT NULL COMMENT 'User profile photo URL from Google or other sources';

-- Add index for faster lookups by google_id
ALTER TABLE users
ADD INDEX IF NOT EXISTS idx_google_id (google_id);

-- Ensure email is UNIQUE for better validation
ALTER TABLE users
ADD UNIQUE KEY IF NOT EXISTS unique_email (email);

-- Verification query - Run this to check if migration is successful
SELECT 
  'Users table structure after migration:' as verification,
  COLUMN_NAME,
  COLUMN_TYPE,
  IS_NULLABLE,
  COLUMN_KEY
FROM information_schema.COLUMNS 
WHERE TABLE_NAME='users' 
  AND TABLE_SCHEMA=DATABASE()
  AND COLUMN_NAME IN ('id', 'email', 'google_id', 'profile_photo')
ORDER BY ORDINAL_POSITION;
