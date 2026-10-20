"""Explicit empty-store retirement, with online backup; never invoked at startup."""
import argparse
import hashlib
import json
from pathlib import Path
import sqlite3

parser = argparse.ArgumentParser()
parser.add_argument('--database', required=True)
parser.add_argument('--output', required=True)
parser.add_argument('--apply', action='store_true')
args = parser.parse_args()
database = Path(args.database).resolve(strict=True)
output = Path(args.output).resolve()
root = Path(__file__).resolve().parents[1]
db = sqlite3.connect('file:' + database.as_posix() + '?mode=' + ('rw' if args.apply else 'ro'), uri=True, timeout=30)
db.execute('PRAGMA foreign_keys=ON')
assert db.execute('PRAGMA integrity_check').fetchall() == [('ok',)]
assert not db.execute('PRAGMA foreign_key_check').fetchall()
for table in ['nb_records', 'nb_revisions']:
    assert db.execute('SELECT COUNT(*) FROM '+table).fetchone()[0] == 0, 'Nonempty model requires a separate ownership audit'
if not args.apply:
    print('Empty model verified; no changes made.')
    raise SystemExit()
output.mkdir(parents=True, exist_ok=False)
backup_path = output / 'before-retirement.sqlite'
backup = sqlite3.connect(backup_path)
db.backup(backup)
assert backup.execute('PRAGMA integrity_check').fetchall() == [('ok',)]
assert not backup.execute('PRAGMA foreign_key_check').fetchall()
backup.close()
backup_hash = hashlib.sha256(backup_path.read_bytes()).hexdigest()
plan = {
    'schema_registry': "owner_module='nervous_breakdown'",
    'function_registry': "module_name='nervous_breakdown' OR name='execution_context'",
    'capability_registry': "module_name='nervous_breakdown'",
    'route_registry': "module_name='nervous_breakdown' OR handler='execution_context'",
    'app_component_assignments': "component_name='nervous_breakdown'",
    'component_registry': "owner_module='nervous_breakdown'",
    'module_registry': "name='nervous_breakdown'",
    'metrics': "instr(tags,'module=nervous_breakdown')>0 OR instr(tags,'path=/nervous-breakdown/')>0",
    'metric_points': "metric_id='component.nervous_breakdown.records'",
    'metric_definitions': "id='component.nervous_breakdown.records'",
}
def preserved():
    fingerprints = {}
    for (t,) in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").fetchall():
        if t in ['nb_records','nb_revisions','schema_migrations','provider_runs']:
            continue
        if t == 'module_registry':
            rows = db.execute("SELECT name,metadata FROM module_registry WHERE name!='nervous_breakdown' ORDER BY name").fetchall()
            normal = []
            for name, metadata in rows:
                value = json.loads(metadata)
                if name == 'execution':
                    value['dependencies'] = [v for v in value['dependencies'] if v != 'nervous_breakdown']
                    value['routes'] = [v for v in value['routes'] if v['handler'] != 'execution_context']
                    value['functions'] = [v for v in value['functions'] if v['name'] != 'execution_context']
                normal.append((name,json.dumps(value,sort_keys=True)))
            rows = normal
        else:
            rows = db.execute('SELECT * FROM "'+t+'" WHERE NOT COALESCE(('+plan.get(t,'0')+'),0) ORDER BY rowid').fetchall()
        fingerprints[t] = hashlib.sha256(repr(rows).encode()).hexdigest()
    return fingerprints
db.execute('BEGIN IMMEDIATE')
try:
    protected = preserved()
    summaries = db.execute('SELECT id,output_summary FROM provider_runs').fetchall()
    counts = {t:db.execute('SELECT COUNT(*) FROM '+t+' WHERE '+where).fetchone()[0] for t,where in plan.items()}
    sql = (root/'platform/modules/nervous_breakdown/migrations/002_retire_empty_model.sql').read_text()
    statement = ''
    for line in sql.splitlines(True):
        statement += line
        if sqlite3.complete_statement(statement):
            db.execute(statement)
            statement = ''
    assert preserved() == protected, 'Unrelated records changed'
    for key, value in summaries:
        old = json.loads(value)
        if isinstance(old.get('components'), dict):
            old['components'].pop('nervous_breakdown',None)
        new = json.loads(db.execute('SELECT output_summary FROM provider_runs WHERE id=?',(key,)).fetchone()[0])
        assert old == new, 'Unrelated summary data changed'
    assert not db.execute('PRAGMA foreign_key_check').fetchall()
    assert db.execute('PRAGMA integrity_check').fetchall() == [('ok',)]
    assert not db.execute("SELECT name FROM sqlite_master WHERE name LIKE 'nb_%'").fetchall()
    db.execute("INSERT INTO schema_migrations(version,applied_at) VALUES('nervous_breakdown_002_retire_empty_model',strftime('%s','now')*1000)")
    db.commit()
except BaseException:
    db.rollback()
    raise
report = {'database':str(database),'backup':str(backup_path),'backup_sha256':backup_hash,
          'integrity_check':'ok','foreign_key_check':[],'preserved_records_unchanged':True,
          'removed_rows':counts,'removed_schema':['nb_governed_records','nb_revisions','nb_records'],
          'analytical_records_removed':0,'remaining_model_records':0}
(output/'result.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
db.close()
