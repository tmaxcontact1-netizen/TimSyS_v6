'use strict';

const db = require('../../shared/services/db');
const log = require('../../shared/services/log');

// Get all templates
function getAll() {
  const result = db.query('SELECT * FROM module_templates ORDER BY completion_state ASC');
  if (!result.rows || result.rows.length === 0) return [];
  
  return result.rows.map(row => ({
    name: row.name,
    completionState: row.completion_state,
    description: row.description,
    manifestTemplate: row.manifest_template ? JSON.parse(row.manifest_template) : null,
    files: typeof row.files === 'string' ? JSON.parse(row.files) : row.files
  }));
}

// Get template by name
function getByName(name) {
  const result = db.query('SELECT * FROM module_templates WHERE name = ?', [name]);
  if (!result.rows || result.rows.length === 0) return null;
  
  const row = result.rows[0];
  return {
    name: row.name,
    completionState: row.completion_state,
    description: row.description,
    manifestTemplate: row.manifest_template ? JSON.parse(row.manifest_template) : null,
    files: typeof row.files === 'string' ? JSON.parse(row.files) : row.files
  };
}

// Get functional templates only (completionState = 0, have component lists)
function getFunctional() {
  const result = db.query('SELECT * FROM module_templates WHERE completion_state = 0 ORDER BY name ASC');
  if (!result.rows || result.rows.length === 0) return [];
  
  return result.rows.map(row => ({
    name: row.name,
    description: row.description,
    manifestTemplate: row.manifest_template ? JSON.parse(row.manifest_template) : null,
    files: typeof row.files === 'string' ? JSON.parse(row.files) : row.files
  }));
}

// Get structural templates only (completionState > 0)
function getStructural() {
  const result = db.query('SELECT * FROM module_templates WHERE completion_state > 0 ORDER BY completion_state ASC');
  if (!result.rows || result.rows.length === 0) return [];
  
  return result.rows.map(row => ({
    name: row.name,
    completionState: row.completion_state,
    description: row.description,
    manifestTemplate: row.manifest_template ? JSON.parse(row.manifest_template) : null,
    files: typeof row.files === 'string' ? JSON.parse(row.files) : row.files
  }));
}

// Seed default templates (called on boot from index.js boot handler)
function seedDefaults() {
  const existing = db.query("SELECT COUNT(*) as cnt FROM module_templates");
  if (existing.rows && existing.rows[0].cnt > 0) return; // Already seeded

  const defaults = [
    // Structural templates
    {
      name: 'minimal',
      completionState: 25,
      description: 'Bare module.json with declarations only',
      manifestTemplate: JSON.stringify({
        name: '{{module_name}}',
        version: '1.0.0',
        author: '{{author}}',
        dependencies: ['db', 'cache', 'auth', 'log', 'validate', 'events'],
        provides: [],
        requires: [],
        routes: [],
        functions: [],
        schema: { tables: [], migrations: [] },
        events: { publishes: [], subscribes: [] }
      }),
      files: JSON.stringify(['module.json'])
    },
    {
      name: 'standard',
      completionState: 50,
      description: 'Module with boot/teardown, no handlers',
      manifestTemplate: null,
      files: JSON.stringify(['module.json', 'index.js'])
    },
    {
      name: 'crud',
      completionState: 75,
      description: 'Module with CRUD handlers, missing some routes',
      manifestTemplate: null,
      files: JSON.stringify(['module.json', 'index.js', 'migrations/001_init.sql'])
    },
    {
      name: 'full',
      completionState: 100,
      description: 'Complete module with all CRUD operations, events, and schema',
      manifestTemplate: null,
      files: JSON.stringify(['module.json', 'index.js', 'migrations/001_init.sql', 'handlers/', 'schemas/'])
    },
    // Functional templates (completionState = 0, have component lists)
    {
      name: 'incident_reports',
      completionState: 0,
      description: 'Incident reporting — staff report incidents involving students in specific locations',
      manifestTemplate: JSON.stringify({
        name: 'incident_reports',
        version: '1.0.0',
        author: '{{author}}',
        dependencies: ['db', 'cache', 'auth', 'log', 'validate', 'events'],
        components: ['staff_registry', 'student_registry', 'room_allocation', 'inventory'],
        provides: ['capability:incident_reports'],
        requires: ['staff_registry', 'student_registry', 'room_allocation'],
        optionalComponents: ['inventory', 'medical'],
        routes: [
          { path: '/incidents', method: 'GET', handler: 'incident_reports_list', auth_required: true },
          { path: '/incidents', method: 'POST', handler: 'incident_reports_create', auth_required: true },
          { path: '/incidents/:id', method: 'GET', handler: 'incident_reports_read', auth_required: true },
          { path: '/incidents/:id', method: 'PUT', handler: 'incident_reports_update', auth_required: true },
          { path: '/incidents/:id', method: 'DELETE', handler: 'incident_reports_delete', auth_required: true }
        ],
        schema: { tables: ['incidents'], migrations: ['001_incidents.sql'] },
        events: {
          publishes: ['incident.created', 'incident.updated', 'incident.resolved'],
          subscribes: []
        }
      }),
      files: JSON.stringify(['module.json', 'index.js', 'migrations/001_incidents.sql'])
    },
    {
      name: 'attendance',
      completionState: 0,
      description: 'Attendance tracking — staff record student attendance per scheduled session',
      manifestTemplate: JSON.stringify({
        name: 'attendance',
        version: '1.0.0',
        author: '{{author}}',
        dependencies: ['db', 'cache', 'auth', 'log', 'validate', 'events'],
        components: ['staff_registry', 'student_registry'],
        provides: ['capability:attendance'],
        requires: ['staff_registry', 'student_registry'],
        optionalComponents: ['room_allocation'],
        routes: [
          { path: '/attendance', method: 'GET', handler: 'attendance_list', auth_required: true },
          { path: '/attendance', method: 'POST', handler: 'attendance_create', auth_required: true },
          { path: '/attendance/:id', method: 'GET', handler: 'attendance_read', auth_required: true },
          { path: '/attendance/:id', method: 'PUT', handler: 'attendance_update', auth_required: true }
        ],
        schema: { tables: ['attendance_records'], migrations: ['001_attendance.sql'] },
        events: {
          publishes: ['attendance.recorded', 'attendance.updated'],
          subscribes: []
        }
      }),
      files: JSON.stringify(['module.json', 'index.js', 'migrations/001_attendance.sql'])
    },
    {
      name: 'medical_tracking',
      completionState: 0,
      description: 'Medical incident tracking — nurse/medical staff record student medical events',
      manifestTemplate: JSON.stringify({
        name: 'medical_tracking',
        version: '1.0.0',
        author: '{{author}}',
        dependencies: ['db', 'cache', 'auth', 'log', 'validate', 'events'],
        components: ['student_registry', 'staff_registry', 'room_allocation'],
        provides: ['capability:medical_tracking'],
        requires: ['student_registry', 'staff_registry'],
        optionalComponents: ['incident_reports'],
        routes: [
          { path: '/medical', method: 'GET', handler: 'medical_tracking_list', auth_required: true },
          { path: '/medical', method: 'POST', handler: 'medical_tracking_create', auth_required: true },
          { path: '/medical/:id', method: 'GET', handler: 'medical_tracking_read', auth_required: true },
          { path: '/medical/:id', method: 'PUT', handler: 'medical_tracking_update', auth_required: true },
          { path: '/medical/:id', method: 'DELETE', handler: 'medical_tracking_delete', auth_required: true }
        ],
        schema: { tables: ['medical_events'], migrations: ['001_medical_events.sql'] },
        events: {
          publishes: ['medical.event_recorded', 'medical.event_updated'],
          subscribes: ['incident.created']
        }
      }),
      files: JSON.stringify(['module.json', 'index.js', 'migrations/001_medical_events.sql'])
    }
  ];

  defaults.forEach(tpl => {
    db.query(
      'INSERT INTO module_templates (name, completion_state, description, manifest_template, files) VALUES (?, ?, ?, ?, ?)',
      [tpl.name, tpl.completionState, tpl.description, tpl.manifestTemplate, tpl.files]
    );
  });

  log.info('Seeded ' + defaults.length + ' module templates', { 
    count: defaults.length,
    structural: 4,
    functional: 3
  });
}

module.exports = {
  getAll: getAll,
  getByName: getByName,
  getFunctional: getFunctional,
  getStructural: getStructural,
  seedDefaults: seedDefaults
};