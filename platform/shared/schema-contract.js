'use strict';

var db = require('./services/db');

var CONTRACT = {
  users: ['id','external_id','username','display_name','status','created_at','updated_at'],
  insight_products: ['id','product_type','scope_type','scope_id','title','summary','evidence','confidence','uncertainty','status','provider_id','provider_version','detected_at'],
  insight_actions: ['insight_id','action','actor_id','acted_at'],
  world_entities: ['entity_type','entity_id','owning_module','lifecycle_status','facts','data_quality'],
  world_relationships: ['subject_type','subject_id','relationship_type','object_type','object_id','provenance','confidence'],
  student_profile_extended: ['student_id','interests','strengths','goals','custom_fields','created_at','updated_at'],
  staff_profile_extended: ['staff_id','professional_development','career_goals','custom_fields','created_at','updated_at'],
  role_hierarchy: ['role_name','hierarchy_level','can_see_roles'],
  event_store: ['event_id','channel','payload','occurred_at','entity_type','entity_id','module','source'],
  metric_points: ['metric_id','scope_type','scope_id','period_start','period_end','value','evidence','provider_run_id']
};

function verify() {
  var errors = [];
  Object.keys(CONTRACT).forEach(function(table) {
    var columns = db.query('PRAGMA table_info("' + table + '")').rows.map(function(row) { return row.name; });
    if (!columns.length) { errors.push('missing table ' + table); return; }
    CONTRACT[table].forEach(function(column) {
      if (columns.indexOf(column) === -1) errors.push('missing column ' + table + '.' + column);
    });
  });
  var legacy = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='intelligence_insights'").rows;
  if (legacy.length) errors.push('legacy table intelligence_insights still exists');
  if (errors.length) throw new Error('Canonical schema contract failed: ' + errors.join('; '));
  return { tables: Object.keys(CONTRACT).length, columns: Object.values(CONTRACT).reduce(function(total, list) { return total + list.length; }, 0) };
}

module.exports = { CONTRACT: CONTRACT, verify: verify };
