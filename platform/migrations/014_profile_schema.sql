-- Canonical schema for the profile composition modules.

CREATE TABLE IF NOT EXISTS student_profile_extended (
    student_id INTEGER PRIMARY KEY,
    interests TEXT NOT NULL DEFAULT '{}',
    strengths TEXT NOT NULL DEFAULT '{}',
    goals TEXT NOT NULL DEFAULT '{}',
    extracurricular TEXT NOT NULL DEFAULT '[]',
    medical_details TEXT,
    dietary_requirements TEXT,
    transport_info TEXT,
    parent_conference_notes TEXT,
    custom_fields TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS staff_profile_extended (
    staff_id INTEGER PRIMARY KEY,
    professional_development TEXT NOT NULL DEFAULT '[]',
    mentorship_roles TEXT NOT NULL DEFAULT '[]',
    committee_memberships TEXT NOT NULL DEFAULT '[]',
    performance_reviews TEXT NOT NULL DEFAULT '[]',
    career_goals TEXT,
    custom_fields TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS role_hierarchy (
    role_name TEXT PRIMARY KEY,
    hierarchy_level INTEGER NOT NULL,
    can_see_roles TEXT NOT NULL DEFAULT '[]',
    description TEXT
);

INSERT OR IGNORE INTO role_hierarchy(role_name,hierarchy_level,can_see_roles,description) VALUES
 ('viewer',0,'[]','No sensitive profile access'),
 ('student',1,'["student"]','Own student-level information'),
 ('teacher',2,'["student"]','Student information needed for teaching'),
 ('head_of_department',3,'["student","teacher"]','Department oversight'),
 ('assistant_principal',4,'["student","teacher","head_of_department"]','School leadership'),
 ('principal',5,'["student","teacher","head_of_department","assistant_principal"]','Organisation leadership'),
 ('developer',7,'["student","teacher","head_of_department","assistant_principal","principal","developer"]','Local system administration');
