-- Room registry schema migration.
-- Migration: room_registry_001_rooms
-- Purpose: Rooms and bookings tracking

-- ============================================================================
-- rooms — Physical rooms
-- ============================================================================
CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_number TEXT UNIQUE NOT NULL,
    building_id INTEGER,
    capacity INTEGER NOT NULL CHECK(capacity > 0),
    room_type TEXT NOT NULL DEFAULT 'general' CHECK(room_type IN ('classroom', 'laboratory', 'office', 'meeting_room', 'lecture_hall', 'library', 'gymnasium', 'cafeteria', 'general', 'other')),
    features TEXT DEFAULT '{}',
    accessibility_flags TEXT DEFAULT '{}',
    equipment_list TEXT DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'occupied', 'maintenance', 'blocked')),
    notes TEXT,
    custom_fields TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rooms_room_number ON rooms(room_number);
CREATE INDEX IF NOT EXISTS idx_rooms_building ON rooms(building_id);
CREATE INDEX IF NOT EXISTS idx_rooms_type ON rooms(room_type);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);

-- ============================================================================
-- room_bookings — Room reservation tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS room_bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    booker_staff_id INTEGER,
    booker_student_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    repeat_rule TEXT DEFAULT NULL,
    repeat_until TEXT DEFAULT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN ('requested', 'confirmed', 'cancelled', 'completed')),
    purpose TEXT,
    attendees_expected INTEGER,
    equipment_requested TEXT DEFAULT '[]',
    admin_notes TEXT,
    custom_fields TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (booker_staff_id) REFERENCES staff(id) ON DELETE SET NULL,
    FOREIGN KEY (booker_student_id) REFERENCES students(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_bookings_room ON room_bookings(room_id);
CREATE INDEX IF NOT EXISTS idx_bookings_booker_staff ON room_bookings(booker_staff_id);
CREATE INDEX IF NOT EXISTS idx_bookings_booker_student ON room_bookings(booker_student_id);
CREATE INDEX IF NOT EXISTS idx_bookings_times ON room_bookings(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON room_bookings(status);
