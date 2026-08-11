-- Path: /home/tmax/TimSyS_v6/platform/modules/inventory/migrations/001_inventory.sql
-- Migration: inventory_001_items
-- Purpose: Inventory items and checkout tracking

-- ============================================================================
-- inventory_items — Physical assets and supplies
-- ============================================================================
CREATE TABLE IF NOT EXISTS inventory_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_name TEXT NOT NULL,
    item_number TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL DEFAULT 'general' CHECK(category IN ('electronics', 'furniture', 'equipment', 'supplies', 'books', 'sports', 'art', 'science', 'computers', 'general', 'other')),
    quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity >= 0),
    unit TEXT DEFAULT 'each',
    location TEXT,
    condition TEXT NOT NULL DEFAULT 'good' CHECK(condition IN ('excellent', 'good', 'fair', 'poor', 'maintenance_needed', 'retired')),
    purchase_date TEXT,
    supplier TEXT,
    purchase_price REAL,
    warranty_expiry TEXT,
    serial_number TEXT,
    manufacturer TEXT,
    model_number TEXT,
    maintenance_schedule TEXT DEFAULT '{}',
    maintenance_history TEXT DEFAULT '[]',
    assigned_to_staff_id INTEGER,
    assigned_to_student_id INTEGER,
    status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'checked_out', 'reserved', 'maintenance', 'retired', 'lost')),
    notes TEXT,
    custom_fields TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (assigned_to_staff_id) REFERENCES staff(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_to_student_id) REFERENCES students(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_inventory_item_number ON inventory_items(item_number);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_inventory_location ON inventory_items(location);
CREATE INDEX IF NOT EXISTS idx_inventory_condition ON inventory_items(condition);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory_items(status);
CREATE INDEX IF NOT EXISTS idx_inventory_assigned_staff ON inventory_items(assigned_to_staff_id);
CREATE INDEX IF NOT EXISTS idx_inventory_assigned_student ON inventory_items(assigned_to_student_id);

-- ============================================================================
-- inventory_checkouts — Item loan tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS inventory_checkouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    checkout_staff_id INTEGER,
    checkout_student_id INTEGER,
    checkout_date TEXT NOT NULL,
    expected_return_date TEXT,
    actual_return_date TEXT,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0),
    condition_at_checkout TEXT DEFAULT 'good',
    condition_at_return TEXT DEFAULT NULL,
    purpose TEXT,
    extension_count INTEGER DEFAULT 0,
    overdue_penalty_amount REAL DEFAULT 0,
    notes TEXT,
    custom_fields TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
    FOREIGN KEY (checkout_staff_id) REFERENCES staff(id) ON DELETE SET NULL,
    FOREIGN KEY (checkout_student_id) REFERENCES students(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_checkouts_item ON inventory_checkouts(item_id);
CREATE INDEX IF NOT EXISTS idx_checkouts_checkout_staff ON inventory_checkouts(checkout_staff_id);
CREATE INDEX IF NOT EXISTS idx_checkouts_checkout_student ON inventory_checkouts(checkout_student_id);
CREATE INDEX IF NOT EXISTS idx_checkouts_dates ON inventory_checkouts(expected_return_date, actual_return_date);
