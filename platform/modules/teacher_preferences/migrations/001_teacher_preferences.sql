CREATE TABLE IF NOT EXISTS teacher_preference_cycles (
 id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL DEFAULT 'principal-ed', external_key TEXT NOT NULL,
 academic_year_id INTEGER NOT NULL, name TEXT NOT NULL, opens_at TEXT, closes_at TEXT,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','open','closed','archived')),
 version INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT(datetime('now')),
 updated_at TEXT NOT NULL DEFAULT(datetime('now')), UNIQUE(app_id,external_key,version),
 FOREIGN KEY(academic_year_id) REFERENCES academic_years(id), CHECK(opens_at IS NULL OR closes_at IS NULL OR opens_at<=closes_at)
);

CREATE TABLE IF NOT EXISTS teacher_preference_entries (
 id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL DEFAULT 'principal-ed', cycle_id INTEGER NOT NULL,
 external_key TEXT NOT NULL, staff_id TEXT NOT NULL,
 domain TEXT NOT NULL CHECK(domain IN ('grade_level','subject','elective','activity','role')),
 stance TEXT NOT NULL CHECK(stance IN ('prefer','avoid','declared_restriction')),
 target_key TEXT NOT NULL, target_label TEXT NOT NULL, rank INTEGER, confidence TEXT NOT NULL DEFAULT 'medium' CHECK(confidence IN ('low','medium','high')),
 rationale TEXT, valid_from TEXT, valid_to TEXT,
 review_state TEXT NOT NULL DEFAULT 'not_required' CHECK(review_state IN ('not_required','pending','confirmed','declined','expired')),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','withdrawn','superseded')),
 revision INTEGER NOT NULL DEFAULT 1, submitted_by TEXT NOT NULL, reviewed_by TEXT, reviewed_at TEXT,
 withdrawal_reason TEXT, withdrawn_by TEXT, withdrawn_at TEXT, supersedes_id INTEGER,
 created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now')),
 UNIQUE(app_id,cycle_id,external_key,revision), FOREIGN KEY(cycle_id) REFERENCES teacher_preference_cycles(id),
 FOREIGN KEY(staff_id) REFERENCES staff(staff_id), FOREIGN KEY(supersedes_id) REFERENCES teacher_preference_entries(id),
 CHECK(rank IS NULL OR (rank>=1 AND rank<=99)), CHECK(valid_from IS NULL OR valid_to IS NULL OR valid_from<=valid_to),
 CHECK((stance='declared_restriction' AND review_state<>'not_required') OR (stance<>'declared_restriction' AND review_state='not_required'))
);

CREATE TABLE IF NOT EXISTS teacher_preference_reviews (
 id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL DEFAULT 'principal-ed', preference_entry_id INTEGER NOT NULL,
 decision TEXT NOT NULL CHECK(decision IN ('confirmed','declined','expired')), reason TEXT NOT NULL,
 decided_by TEXT NOT NULL, decided_at TEXT NOT NULL DEFAULT(datetime('now')),
 FOREIGN KEY(preference_entry_id) REFERENCES teacher_preference_entries(id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_preferences_staff ON teacher_preference_entries(app_id,staff_id,status,domain);
CREATE INDEX IF NOT EXISTS idx_teacher_preferences_provider ON teacher_preference_entries(app_id,cycle_id,status,valid_from,valid_to);
CREATE UNIQUE INDEX IF NOT EXISTS uq_teacher_preference_active_rank
 ON teacher_preference_entries(app_id,cycle_id,staff_id,domain,stance,rank)
 WHERE rank IS NOT NULL AND status IN ('draft','active');
