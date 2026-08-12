-- Staff registry schema migration.
-- Migration: staff_registry_001_staff
-- Purpose: Core staff identity, employment, background checks, certifications
-- Total lines: 97

-- ============================================================================
-- staff — Core identity and employment
-- ============================================================================
CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id TEXT UNIQUE NOT NULL,
    user_id INTEGER,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    middle_name TEXT,
    preferred_name TEXT,
    date_of_birth TEXT,
    sex TEXT CHECK(sex IN ('Male', 'Female')),
    photo_url TEXT,
    nationality TEXT,
    national_insurance_number TEXT,
    identity_custom TEXT DEFAULT '{}',
    hire_date TEXT NOT NULL,
    termination_date TEXT,
    employment_status TEXT NOT NULL DEFAULT 'active' CHECK(employment_status IN ('active', 'terminated', 'leave', 'contract')),
    employment_type TEXT NOT NULL DEFAULT 'full_time' CHECK(employment_type IN ('full_time', 'part_time', 'casual', 'contractor')),
    job_title TEXT,
    department TEXT,
    reports_to_staff_id INTEGER,
    pay_grade TEXT,
    work_email TEXT,
    work_phone TEXT,
    employment_custom TEXT DEFAULT '{}',
    dbs_check_status TEXT NOT NULL DEFAULT 'pending' CHECK(dbs_check_status IN ('pending', 'clear', 'disclosed', 'expired')),
    dbs_check_date TEXT,
    dbs_expiry_date TEXT,
    dbs_reference_number TEXT,
    dbs_certificate_url TEXT,
    background_checks_custom TEXT DEFAULT '{}',
    qualifications_summary TEXT,
    qualifications_custom TEXT DEFAULT '{}',
    phone_primary TEXT,
    phone_secondary TEXT,
    email_work TEXT,
    email_personal TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state_province TEXT,
    postal_code TEXT,
    country TEXT,
    contact_custom TEXT DEFAULT '{}',
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    emergency_contact_relationship TEXT,
    notes TEXT,
    custom_fields TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (reports_to_staff_id) REFERENCES staff(id) ON DELETE SET NULL
);

-- ============================================================================
-- staff_certifications — Professional certifications and training
-- ============================================================================
CREATE TABLE IF NOT EXISTS staff_certifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER NOT NULL,
    certification_name TEXT NOT NULL,
    issuing_body TEXT,
    certification_number TEXT,
    issue_date TEXT,
    expiry_date TEXT,
    status TEXT NOT NULL DEFAULT 'valid' CHECK(status IN ('valid', 'expiring', 'expired', 'suspended', 'revoked')),
    document_url TEXT,
    notes TEXT,
    certification_custom TEXT DEFAULT '{}',
    custom_fields TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_staff_staff_id ON staff(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_last_name ON staff(last_name);
CREATE INDEX IF NOT EXISTS idx_staff_status ON staff(employment_status);
CREATE INDEX IF NOT EXISTS idx_staff_department ON staff(department);
CREATE INDEX IF NOT EXISTS idx_staff_user_id ON staff(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_dbs_status ON staff(dbs_check_status);
CREATE INDEX IF NOT EXISTS idx_staff_reports_to ON staff(reports_to_staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_sex ON staff(sex);
CREATE INDEX IF NOT EXISTS idx_staff_certs_staff ON staff_certifications(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_certs_expiry ON staff_certifications(expiry_date);
CREATE INDEX IF NOT EXISTS idx_staff_certs_status ON staff_certifications(status);
CREATE INDEX IF NOT EXISTS idx_staff_certs_name ON staff_certifications(certification_name);
