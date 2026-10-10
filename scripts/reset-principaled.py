"""Explicit, backed-up Principal'Ed reset. Dry-run by default; never run at boot.

Preserves authentication, module configuration and other application scopes.
Requires an exact database path and --apply to mutate. File recovery copies and
SQLite online backup are completed before the transaction can delete records.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import sqlite3
from contextlib import closing
from datetime import datetime, timezone

APP = 'principal-ed'
CONFIG = set('ai_adapters app_component_assignments app_module_assignments calendar_layers calendar_settings late_entry_action_policy late_entry_reasons student_exit_action_policy student_exit_notification_rules student_exit_types'.split())
SCHOOL_ENTITIES = set('student staff Student Staff document formal_organisational_record formal_role formal_source formal_statement formal_term formal_responsibility formal_connection formal_role_assignment nervous_breakdown_dataset'.split())
PROVIDERS = set('core.component-operations core.cross-component core.operational-strengths core.registry-quality core.withdrawal-patterns cover.operations principal.operations'.split())


def quote(name):
    return '"' + name.replace('"', '""') + '"'


def build_plan(db):
    tables = [r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
    columns = {t: {r[1] for r in db.execute('PRAGMA table_info(' + quote(t) + ')')} for t in tables}
    selected = {t: set() for t in tables}

    def select(table, where='1', args=()):
        if table in selected:
            selected[table].update(r[0] for r in db.execute('SELECT rowid FROM ' + quote(table) + ' WHERE ' + where, args))

    for table in tables:
        if 'app_id' in columns[table] and table not in CONFIG:
            select(table, 'app_id=?', (APP,))
    # Canonical school registries are not app-scoped in this schema.
    for table in ['students', 'staff']:
        select(table)
    for table in ['entity_withdrawals', 'audit_log', 'intelligence_metadata', 'entity_snapshots']:
        if table in columns and 'entity_type' in columns[table]:
            select(table, 'entity_type IN (' + ','.join('?' for _ in SCHOOL_ENTITIES) + ')', tuple(SCHOOL_ENTITIES))
    if 'event_store' in columns:
        select('event_store', "module IN (SELECT module_name FROM app_module_assignments WHERE app_id=?) AND module NOT IN (SELECT module_name FROM app_module_assignments WHERE app_id<>?)", (APP, APP))
    if 'world_entities' in columns:
        select('world_entities', 'entity_type IN (' + ','.join('?' for _ in SCHOOL_ENTITIES) + ')', tuple(SCHOOL_ENTITIES))
    if 'world_relationships' in columns:
        for endpoint in ['subject', 'object']:
            select('world_relationships', f"EXISTS (SELECT 1 FROM world_entities e WHERE e.entity_type={endpoint}_type AND e.entity_id={endpoint}_id AND e.rowid IN (SELECT value FROM json_each(?)))", (json.dumps(sorted(selected.get('world_entities', []))),))
    for table in ['insight_products', 'provider_runs']:
        if table in columns:
            select(table, "scope_type='organisation' AND scope_id='current' AND provider_id IN (" + ','.join('?' for _ in PROVIDERS) + ')', tuple(PROVIDERS))
    if 'metric_points' in columns:
        select('metric_points', "provider_run_id IN (SELECT id FROM provider_runs WHERE rowid IN (SELECT value FROM json_each(?)))", (json.dumps(sorted(selected.get('provider_runs', []))),))

    # Follow declared ownership links. Never cascade into a different app scope.
    changed = True
    while changed:
        before = sum(map(len, selected.values()))
        for child in tables:
            for fk in db.execute('PRAGMA foreign_key_list(' + quote(child) + ')'):
                _, _, parent, child_key, parent_key, *_ = fk
                if not selected.get(parent):
                    continue
                if not parent_key:
                    parent_key = next(r[1] for r in db.execute('PRAGMA table_info(' + quote(parent) + ')') if r[5])
                where = quote(child_key) + ' IN (SELECT ' + quote(parent_key) + ' FROM ' + quote(parent) + ' WHERE rowid IN (SELECT value FROM json_each(?)))'
                args = (json.dumps(sorted(selected[parent])),)
                if 'app_id' in columns[child]:
                    foreign = db.execute('SELECT COUNT(*) FROM ' + quote(child) + ' WHERE (' + where + ') AND app_id<>?', args + (APP,)).fetchone()[0]
                    if foreign:
                        raise RuntimeError(f'Reset would affect {foreign} records in another app through {child}.{child_key}; stopped')
                if child in CONFIG:
                    raise RuntimeError(f'Reset reaches preserved configuration table {child}; stopped')
                select(child, where, args)
        changed = sum(map(len, selected.values())) != before
    return {t: sorted(ids) for t, ids in selected.items() if ids}


def fingerprints(db, plan):
    result = {}
    for (table,) in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").fetchall():
        rows = db.execute('SELECT * FROM ' + quote(table) + ' WHERE rowid NOT IN (SELECT value FROM json_each(?)) ORDER BY rowid', (json.dumps(plan.get(table, [])),)).fetchall()
        result[table] = hashlib.sha256(repr(rows).encode()).hexdigest()
    return result


def reset(database, output, apply=False):
    database = Path(database).resolve(strict=True)
    output = Path(output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect('file:' + database.as_posix() + '?mode=' + ('rw' if apply else 'ro'), uri=True, timeout=30)
    try:
        return reset_connection(db, database, output, apply)
    finally:
        db.close()


def reset_connection(db, database, output, apply):
    if db.execute('PRAGMA foreign_key_check').fetchall():
        raise RuntimeError('Existing foreign-key violations; reset refused')
    plan = build_plan(db)
    report = {'database': str(database), 'app': APP, 'applied': False, 'counts': {t: len(ids) for t, ids in plan.items()}, 'total_rows': sum(map(len, plan.values()))}
    (output / 'reset-plan.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    if not apply:
        db.close()
        return report
    backup_path = output / 'before-reset.sqlite'
    if backup_path.exists():
        raise RuntimeError('Backup already exists; use a new output directory')
    # Online backup includes committed WAL content. Never copy a live SQLite file.
    with closing(sqlite3.connect(backup_path)) as backup:
        db.backup(backup)
    db.execute('PRAGMA foreign_keys=OFF')
    db.execute('BEGIN IMMEDIATE')
    moved = []
    try:
        if build_plan(db) != plan:
            raise RuntimeError('Data changed since planning; stopped without deleting records')
        protected = fingerprints(db, plan)
        keys = db.execute('SELECT storage_key FROM document_versions WHERE rowid IN (SELECT value FROM json_each(?))', (json.dumps(plan.get('document_versions', [])),)).fetchall() if 'document_versions' in plan else []
        document_root = Path(str(database) + '.documents').resolve()
        for (key,) in keys:
            source = (document_root / key).resolve()
            if not source.is_relative_to(document_root) or not source.is_file():
                raise RuntimeError('Document storage path missing or outside expected root: ' + key)
            target = output / 'documents' / key
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)
            if hashlib.sha256(source.read_bytes()).digest() != hashlib.sha256(target.read_bytes()).digest():
                raise RuntimeError('Document backup verification failed')
            moved.append((source, target))
        for table, ids in plan.items():
            db.execute('DELETE FROM ' + quote(table) + ' WHERE rowid IN (SELECT value FROM json_each(?))', (json.dumps(ids),))
        if db.execute('PRAGMA foreign_key_check').fetchall():
            raise RuntimeError('Reset would leave broken references')
        if fingerprints(db, {}) != protected:
            raise RuntimeError('Preserved records changed unexpectedly')
        for source, _ in moved:
            source.unlink()
        db.commit()
    except BaseException:
        db.rollback()
        for source, target in moved:
            if not source.exists():
                shutil.copy2(target, source)
        raise
    finally:
        db.close()
    report.update(applied=True, backup=str(backup_path), documents_removed=len(moved), preserved_records_verified=True, foreign_keys_valid=True, completed_at=datetime.now(timezone.utc).isoformat())
    (output / 'reset-result.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    print(json.dumps(reset(args.database, args.output, args.apply), indent=2))
