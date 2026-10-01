-- ==============================================================================
-- CHARUSAT SMART ATTENDANCE & ANALYTICS — PRODUCTION POSTGRESQL SCHEMA
-- ==============================================================================
-- This script provisions the complete relational database architecture
-- for enterprise attendance tracking, anti-proxy telemetry, WebAuthn credentials,
-- and institutional reporting across CSPIT, DEPSTAR, and CMPICA institutes.
--
-- Supported Database: PostgreSQL 14+ (Compatible with Supabase, Neon, AWS RDS, GCP Cloud SQL)
-- Run via: psql -U [user] -d [database] -f schema.sql
-- ==============================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 1. ENUMS
-- ==============================================================================

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('ADMIN', 'TEACHER', 'STUDENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE session_status AS ENUM ('SCHEDULED', 'ACTIVE', 'ENDED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE attendance_status AS ENUM ('Present', 'Late', 'Absent', 'Excused');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE risk_severity AS ENUM ('High', 'Medium', 'Low');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE risk_status AS ENUM ('Needs review', 'Reviewed', 'Dismissed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE audit_severity AS ENUM ('Info', 'Warning', 'Critical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==============================================================================
-- 2. CORE IDENTITY & INSTITUTIONAL ROSTERS
-- ==============================================================================

-- System Users Table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role user_role NOT NULL,
    department TEXT,
    institute TEXT,
    avatar TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Classes / Cohorts Table
CREATE TABLE IF NOT EXISTS classes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    section TEXT NOT NULL,
    semester TEXT NOT NULL,
    room TEXT,
    institute TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Course Subjects Table
CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    credits INTEGER NOT NULL DEFAULT 4,
    threshold INTEGER NOT NULL DEFAULT 75,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Faculty Profiles Table
CREATE TABLE IF NOT EXISTS teachers (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    department TEXT NOT NULL,
    institute TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Student Profiles Table
CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL UNIQUE,
    class_id TEXT REFERENCES classes(id) ON DELETE SET NULL,
    attendance_percent INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Student Class & Course Enrollments Table
CREATE TABLE IF NOT EXISTS enrollments (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_student_class_subject UNIQUE (student_id, class_id, subject_id)
);

-- Teacher Course & Class Assignments Table
CREATE TABLE IF NOT EXISTS teacher_assignments (
    id TEXT PRIMARY KEY,
    teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_teacher_class_subject UNIQUE (teacher_id, class_id, subject_id)
);

-- ==============================================================================
-- 3. LECTURE SESSIONS & ATTENDANCE LEDGER
-- ==============================================================================

-- Lecture Sessions Table
CREATE TABLE IF NOT EXISTS class_sessions (
    id TEXT PRIMARY KEY,
    teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
    status session_status NOT NULL DEFAULT 'SCHEDULED',
    code TEXT,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Attendance Records Table
CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
    status attendance_status NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_method TEXT,
    risk_score INTEGER DEFAULT 0,
    marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    marked_by TEXT,
    metadata TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_session_student UNIQUE (session_id, student_id)
);

-- ==============================================================================
-- 4. HARDWARE PASSKEYS & WEBAUTHN ATTESTATION
-- ==============================================================================

-- FIDO2 WebAuthn Credentials Table
CREATE TABLE IF NOT EXISTS passkeys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_id TEXT NOT NULL UNIQUE,
    public_key TEXT NOT NULL,
    device_name TEXT,
    last_used TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Replay-Protected Verification Challenge Tokens Table
CREATE TABLE IF NOT EXISTS verification_challenges (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    challenge TEXT NOT NULL,
    consumed BOOLEAN NOT NULL DEFAULT FALSE,
    consumed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Random Mid-Class Presence Re-Check Requests Table
CREATE TABLE IF NOT EXISTS recheck_requests (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'requested',
    prompt TEXT NOT NULL DEFAULT 'Please verify your attendance',
    expires_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Attendance Corrections Audit Ledger
CREATE TABLE IF NOT EXISTS attendance_corrections (
    id TEXT PRIMARY KEY,
    attendance_id TEXT NOT NULL,
    old_status TEXT NOT NULL,
    new_status TEXT NOT NULL,
    reason TEXT NOT NULL,
    actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_role TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sliding-Window Rate Limits Table
CREATE TABLE IF NOT EXISTS rate_limits (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    attempts INTEGER NOT NULL DEFAULT 1,
    last_attempt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 5. RISK SIGNALS, NOTIFICATIONS, AUDIT LOGS & SETTINGS
-- ==============================================================================

-- Security & Anti-Proxy Events Table
CREATE TABLE IF NOT EXISTS risk_events (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    session_id TEXT REFERENCES class_sessions(id) ON DELETE SET NULL,
    event TEXT NOT NULL,
    severity risk_severity NOT NULL,
    risk_score INTEGER NOT NULL DEFAULT 0,
    status risk_status NOT NULL DEFAULT 'Needs review',
    reason TEXT,
    device_fingerprint TEXT,
    ip_location TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User Communications & Alerts Table
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tamper-Evident Institutional Audit Log Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor_id TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    severity audit_severity NOT NULL DEFAULT 'Info',
    success BOOLEAN NOT NULL DEFAULT TRUE,
    metadata TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Key-Value System Configuration Table
CREATE TABLE IF NOT EXISTS attendance_settings (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    description TEXT,
    updated_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 6. HIGH-PERFORMANCE PRODUCTION INDEXES
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id);
CREATE INDEX IF NOT EXISTS idx_students_student_id ON students(student_id);
CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_teachers_user_id ON teachers(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student_class ON enrollments(student_id, class_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_teacher_class ON teacher_assignments(teacher_id, class_id);
CREATE INDEX IF NOT EXISTS idx_class_sessions_class_status ON class_sessions(class_id, status);
CREATE INDEX IF NOT EXISTS idx_class_sessions_teacher_id ON class_sessions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session_student ON attendance(session_id, student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_marked_at ON attendance(marked_at DESC);
CREATE INDEX IF NOT EXISTS idx_passkeys_user_id ON passkeys(user_id);
CREATE INDEX IF NOT EXISTS idx_passkeys_credential_id ON passkeys(credential_id);
CREATE INDEX IF NOT EXISTS idx_verification_challenges_session_consumed ON verification_challenges(session_id, consumed);
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_action ON rate_limits(user_id, action);
CREATE INDEX IF NOT EXISTS idx_risk_events_user_id ON risk_events(user_id);
CREATE INDEX IF NOT EXISTS idx_risk_events_status ON risk_events(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_settings_key ON attendance_settings(key);

-- ==============================================================================
-- 7. DEFAULT INSTITUTIONAL POLICIES (CHARUSAT CONFIGURATION)
-- ==============================================================================

INSERT INTO attendance_settings (id, key, value, description, created_at, updated_at)
VALUES
    ('s_campus', 'campus', 'Charotar University of Science and Technology (CHARUSAT)', 'Primary institutional campus designation', NOW(), NOW()),
    ('s_threshold', 'attendanceThreshold', '75', 'Minimum percentage required to maintain academic compliance', NOW(), NOW()),
    ('s_session_len', 'sessionLength', '60', 'Default lecture session window in minutes', NOW(), NOW()),
    ('s_bssid_lock', 'bssidLock', 'true', 'Restricts student check-ins to university Wi-Fi perimeter', NOW(), NOW()),
    ('s_geofence', 'geofenceRadiusMeters', '45', 'Classroom proximity radius threshold in meters', NOW(), NOW())
ON CONFLICT (key) DO NOTHING;
