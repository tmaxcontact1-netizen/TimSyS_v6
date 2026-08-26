'use strict';
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'../../modules/student_exits');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'module.json'),'utf8'));
const migration=fs.readFileSync(path.join(root,'migrations/005_student_exits_operations.sql'),'utf8');
const exits=require(path.join(root,'index.js'));

describe('student exits operational resilience contract',()=>{
  test('publishes the complete exception and reconciliation surface',()=>{
    for(const name of ['bulkCreate','reconcile','reportException','listExceptions','resolveException','correct','getNotificationRules','saveNotificationRule','analytics','insights'])expect(typeof exits[name]).toBe('function');
    for(const route of ['/student-exits/bulk','/student-exits/reconcile','/student-exits/:id/exceptions','/student-exits/:id/corrections','/student-exits/config/notification-rules'])expect(manifest.routes.some(x=>x.path===route)).toBe(true);
  });
  test('persists retry identity, exceptions, corrections and notification outbox',()=>{
    expect(migration).toMatch(/client_request_id/);
    for(const table of ['student_exit_exceptions','student_exit_corrections','student_exit_notification_rules','student_exit_notification_outbox'])expect(manifest.schema.tables).toContain(table);
    expect(manifest.schema.migrations).toContain('migrations/005_student_exits_operations.sql');
  });
  test('does not model automatic resolution',()=>{
    expect(migration).toMatch(/status IN \('open','resolved'\)/);
    expect(migration).not.toMatch(/auto_resolved|automatically_closed/);
  });
});
