-- Migration: user_management_003_must_change_password
-- Purpose: Add must_change_password flag to users table

ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;