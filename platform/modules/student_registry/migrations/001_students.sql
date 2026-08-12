-- Student registry schema migration.
-- Migration: student_registry_001_students
-- Purpose: Core student identity, contacts, enrollment history

-- ============================================================================
-- students — Core identity and enrollment
-- ============================================================================
CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    middle_name TEXT,
    preferred_name TEXT,
    date_of_birth TEXT NOT NULL,
    sex TEXT NOT NULL CHECK(sex IN ('Male', 'Female')),
    photo_url TEXT,
    nationality TEXT,
    ethnicity TEXT,
    primary_language TEXT,
    secondary_language TEXT,
    identity_custom TEXT DEFAULT '{}',
    enrollment_date TEXT NOT NULL,
    enrollment_status TEXT NOT NULL DEFAULT 'active' CHECK(enrollment_status IN ('active', 'withdrawn', 'graduated', 'suspended', 'expelled')),
    current_grade_level TEXT,
    homeroom TEXT,
    term_start TEXT,
    term_end TEXT,
    school_year TEXT,
    enrollment_custom TEXT DEFAULT '{}',
    medical_alert_flag INTEGER NOT NULL DEFAULT 0,
    special_education_flag INTEGER NOT NULL DEFAULT 0,
    free_lunch_eligible INTEGER NOT NULL DEFAULT 0,
    gifted_talented_flag INTEGER NOT NULL DEFAULT 0,
    esl_flag INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    custom_fields TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================================
-- student_contacts — Guardian/contact information
-- ============================================================================
CREATE TABLE IF NOT EXISTS student_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    contact_type TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    relationship TEXT,
    phone_primary TEXT,
    phone_secondary TEXT,
    email TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state_province TEXT,
    postal_code TEXT,
    country TEXT,
    is_primary_contact INTEGER NOT NULL DEFAULT 0,
    has_custody INTEGER NOT NULL DEFAULT 0,
    pickup_authorization INTEGER NOT NULL DEFAULT 0,
    employer TEXT,
    occupation TEXT,
    notes TEXT,
    contact_custom TEXT DEFAULT '{}',
    custom_fields TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- ============================================================================
-- student_enrollment_history — Year-over-year tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS student_enrollment_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    academic_year TEXT NOT NULL,
    grade_level TEXT NOT NULL,
    enrollment_date TEXT NOT NULL,
    withdrawal_date TEXT,
    withdrawal_reason TEXT,
    status TEXT NOT NULL DEFAULT 'enrolled',
    school_transferred_from TEXT,
    school_transferred_to TEXT,
    homeroom TEXT,
    notes TEXT,
    history_custom TEXT DEFAULT '{}',
    custom_fields TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_students_student_id ON students(student_id);
CREATE INDEX IF NOT EXISTS idx_students_last_name ON students(last_name);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(enrollment_status);
CREATE INDEX IF NOT EXISTS idx_students_grade ON students(current_grade_level);
CREATE INDEX IF NOT EXISTS idx_students_sex ON students(sex);
CREATE INDEX IF NOT EXISTS idx_student_contacts_student ON student_contacts(student_id);
CREATE INDEX IF NOT EXISTS idx_student_contacts_primary ON student_contacts(student_id, is_primary_contact);
CREATE INDEX IF NOT EXISTS idx_student_enrollment_student ON student_enrollment_history(student_id);
CREATE INDEX IF NOT EXISTS idx_student_enrollment_year ON student_enrollment_history(academic_year);
CREATE INDEX IF NOT EXISTS idx_student_enrollment_status ON student_enrollment_history(status);
-- Total lines: 79
