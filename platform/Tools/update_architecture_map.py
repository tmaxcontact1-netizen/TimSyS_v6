#!/usr/bin/env python3
# TimSyS Architecture Map Generator — Discovery-Based
# Scans actual disk state, catalogs everything found.
# Comparison against expected layout goes in "Drift Detection" only.
#
# To run bash /home/tmax/TimSyS_v6/platform/Tools/update_architecture_map.sh

import os
import json
import hashlib
from datetime import datetime

ROOT = '/home/tmax/TimSyS_v6'
PLATFORM = ROOT + '/platform'
OUTPUT = ROOT + '/ARCHITECTURE_MAP.md'

EXPECTED_CONTRACTS = ['db.js', 'cache.js', 'auth.js', 'log.js', 'validate.js', 'events.js', 'intelligence.js']
EXPECTED_SERVICES = ['db.js', 'cache.js', 'auth.js', 'log.js', 'validate.js', 'events.js', 'session.js', 'audit.js', 'metrics.js', 'email.js', 'ratelimit.js', 'refresh.js']
EXPECTED_REGISTRIES = ['moduleRegistry.js', 'schemaRegistry.js', 'routeRegistry.js', 'functionRegistry.js', 'capabilityRegistry.js', 'dependencyGraph.js', 'componentRegistry.js', 'componentScanner.js']
EXPECTED_PIPELINE = ['discover.js', 'validate.js', 'register.js', 'resolve.js', 'wire.js', 'boot.js', 'unstage.js']
EXPECTED_DIRS = ['contracts', 'shared/services', 'shared/registry', 'shared/pipeline', 'modules', 'tests', 'Tools', 'data', 'routes', 'engine/gap-analysis', 'engine/recommendation']
ROOT_DOCS = ['CONTEXT.md', 'ARCHITECTURE_MAP.md', 'HANDOVER.md', 'CONSTITUTION_V6.0.md', 'LEXICON_V6.0.0.md']


def ls_files_immediate(path, ext=None):
    try:
        files = [f for f in os.listdir(path) if os.path.isfile(os.path.join(path, f))]
        if ext:
            files = [f for f in files if f.endswith(ext)]
        return sorted(files)
    except Exception:
        return []


def ls_dir(path):
    try:
        return sorted([d for d in os.listdir(path) if os.path.isdir(os.path.join(path, d))])
    except Exception:
        return []


def file_info(path):
    try:
        st = os.stat(path)
        return {
            'size': st.st_size,
            'mtime': datetime.fromtimestamp(st.st_mtime).strftime('%Y-%m-%d %H:%M:%S')
        }
    except Exception:
        return {'size': 0, 'mtime': 'N/A'}


def file_hash_sha256(path):
    try:
        h = hashlib.sha256()
        with open(path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                h.update(chunk)
        return h.hexdigest()
    except Exception:
        return 'ERROR'


def md_table_row(cells):
    return '| ' + ' | '.join(str(c) for c in cells) + ' |'


out = []
out.append('# TimSyS Architecture Map')
out.append('Generated: ' + datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'))
out.append('Generator: platform/Tools/update_architecture_map.py (Discovery-Based)')
out.append('')
out.append('This document is auto-generated. Do not edit manually.')
out.append('# To run bash /home/tmax/TimSyS_v6/platform/Tools/update_architecture_map.sh')
out.append('')
out.append('---')
out.append('')
out.append('## Project Root')
out.append('')
out.append('Path: `' + ROOT + '`')
out.append('Platform Location: `' + PLATFORM + '`')
out.append('')

# Root Documents
out.append('## Root Documents')
out.append('')
out.append(md_table_row(['File', 'Exists', 'Size', 'Last Modified']))
out.append(md_table_row(['------', '------', '------', '---------------']))
for doc in ROOT_DOCS:
    path = ROOT + '/' + doc
    if os.path.isfile(path):
        info = file_info(path)
        out.append(md_table_row(['`' + doc + '`', '✅', str(info['size']) + 'B', info['mtime']]))
    else:
        out.append(md_table_row(['`' + doc + '`', '❌ MISSING', '-', '-']))
out.append('')

# Directory Tree
out.append('## Directory Tree')
out.append('')
out.append('```')
for root, dirs, files in os.walk(ROOT):
    if 'node_modules' in root or '/.git' in root:
        dirs[:] = []
        continue
    rel = os.path.relpath(root, ROOT)
    if rel == '.':
        out.append('.')
    else:
        depth = rel.count(os.sep)
        if depth <= 4:
            out.append('./' + rel)
    if rel.count(os.sep) <= 4:
        for f in sorted(files)[:10]:
            depth = rel.count(os.sep) if rel != '.' else 0
            out.append(('  ' * (depth + 1)) + f)
    elif rel.count(os.sep) > 4:
        dirs[:] = []
out.append('```')
out.append('')

# Contract Layer (discovery-based)
contract_dir = PLATFORM + '/contracts'
found_contracts = ls_files_immediate(contract_dir, '.js')
out.append('## Phase 0: Foundation Contracts')
out.append('')
out.append('Location: `/platform/contracts/`')
out.append('')
out.append(md_table_row(['File', 'Exists', 'Size', 'Last Modified']))
out.append(md_table_row(['------', '------', '------', '---------------']))
for c in sorted(set(EXPECTED_CONTRACTS + found_contracts)):
    path = contract_dir + '/' + c
    if os.path.isfile(path):
        info = file_info(path)
        out.append(md_table_row(['`' + c + '`', '✅', str(info['size']) + 'B', info['mtime']]))
    else:
        out.append(md_table_row(['`' + c + '`', '❌ MISSING', '-', '-']))
out.append('')

# Services Layer (discovery-based)
services_dir = PLATFORM + '/shared/services'
found_services = ls_files_immediate(services_dir, '.js')
out.append('## Phase 1.1: Persistence / Service Layer')
out.append('')
out.append('Location: `/platform/shared/services/`')
out.append('')
out.append(md_table_row(['File', 'Exists', 'Size', 'Last Modified']))
out.append(md_table_row(['------', '------', '------', '---------------']))
for s in sorted(set(EXPECTED_SERVICES + found_services)):
    path = services_dir + '/' + s
    if os.path.isfile(path):
        info = file_info(path)
        out.append(md_table_row(['`' + s + '`', '✅', str(info['size']) + 'B', info['mtime']]))
    else:
        out.append(md_table_row(['`' + s + '`', '❌ MISSING', '-', '-']))
out.append('')

# Intelligence Package
intel_dir = services_dir + '/intelligence'
if os.path.isdir(intel_dir):
    out.append('### Intelligence Service Package')
    out.append('')
    out.append('Location: `/platform/shared/services/intelligence/`')
    out.append('')
    out.append(md_table_row(['File', 'Exists', 'Size']))
    out.append(md_table_row(['------', '------', '------']))
    for f in ls_files_immediate(intel_dir, '.js'):
        info = file_info(intel_dir + '/' + f)
        out.append(md_table_row(['`' + f + '`', '✅', str(info['size']) + 'B']))
    out.append('')

# Registry Layer (discovery-based)
registry_dir = PLATFORM + '/shared/registry'
found_registries = ls_files_immediate(registry_dir, '.js')
out.append('## Phase 1.2: Registry Layer')
out.append('')
out.append('Location: `/platform/shared/registry/`')
out.append('')
out.append(md_table_row(['File', 'Exists', 'Size', 'Last Modified']))
out.append(md_table_row(['------', '------', '------', '---------------']))
for r in sorted(set(EXPECTED_REGISTRIES + found_registries)):
    path = registry_dir + '/' + r
    if os.path.isfile(path):
        info = file_info(path)
        out.append(md_table_row(['`' + r + '`', '✅', str(info['size']) + 'B', info['mtime']]))
    else:
        out.append(md_table_row(['`' + r + '`', '❌ MISSING', '-', '-']))
out.append('')

# Pipeline Layer (discovery-based)
pipeline_dir = PLATFORM + '/shared/pipeline'
found_pipeline = ls_files_immediate(pipeline_dir, '.js')
out.append('## Phase 1.3: Staging Pipeline')
out.append('')
out.append('Location: `/platform/shared/pipeline/`')
out.append('')
out.append(md_table_row(['File', 'Exists', 'Size', 'Last Modified']))
out.append(md_table_row(['------', '------', '------', '---------------']))
for p in sorted(set(EXPECTED_PIPELINE + found_pipeline)):
    path = pipeline_dir + '/' + p
    if os.path.isfile(path):
        info = file_info(path)
        out.append(md_table_row(['`' + p + '`', '✅', str(info['size']) + 'B', info['mtime']]))
    else:
        out.append(md_table_row(['`' + p + '`', '❌ MISSING', '-', '-']))
out.append('')

# Middleware
middleware_dir = PLATFORM + '/shared/middleware'
out.append('## Phase 5: HTTP Middleware')
out.append('')
if os.path.isdir(middleware_dir):
    out.append('Location: `/platform/shared/middleware/`')
    out.append('')
    out.append(md_table_row(['File', 'Exists', 'Size']))
    out.append(md_table_row(['------', '------', '------']))
    mw_files = ls_files_immediate(middleware_dir, '.js')
    if mw_files:
        for f in mw_files:
            info = file_info(middleware_dir + '/' + f)
            out.append(md_table_row(['`' + f + '`', '✅', str(info['size']) + 'B']))
    else:
        out.append(md_table_row(['No .js files', '⚠️', '-']))
    out.append('')
else:
    out.append('Directory does not exist.')
    out.append('')

# Modules (discovery-based)
modules_dir = PLATFORM + '/modules'
out.append('## Modules')
out.append('')
out.append('Location: `/platform/modules/`')
out.append('')
if os.path.isdir(modules_dir):
    module_names = [d for d in ls_dir(modules_dir) if d != '.gitkeep']
    out.append(md_table_row(['Module', 'Manifest', 'Index', 'Component', 'Migrations', 'Type']))
    out.append(md_table_row(['------', '--------', '-----', '---------', '------------', '----']))
    for m in sorted(module_names):
        mdir = modules_dir + '/' + m
        manifest = '✅' if os.path.isfile(mdir + '/module.json') else '❌'
        index = '✅' if os.path.isfile(mdir + '/index.js') else '❌'
        component = '✅' if os.path.isfile(mdir + '/component.json') else '❌'
        mig_dir = mdir + '/migrations'
        mig_count = len(ls_files_immediate(mig_dir, '.sql')) if os.path.isdir(mig_dir) else 0

        module_type = 'standard'
        comp_path = mdir + '/component.json'
        if os.path.isfile(comp_path):
            try:
                with open(comp_path) as cf:
                    comp_data = json.load(cf)
                    ctype = comp_data.get('type', '')
                    if ctype:
                        module_type = ctype
            except Exception:
                pass
        elif '_registry' in m:
            module_type = 'registry'
        elif '_profile' in m:
            module_type = 'profile'

        out.append(md_table_row(['`' + m + '`', manifest, index, component, str(mig_count), module_type]))
else:
    out.append('Directory does not exist.')
out.append('')

# CLI Tools
cli_dir = PLATFORM + '/scripts/cli'
out.append('## CLI Tools')
out.append('')
if os.path.isdir(cli_dir):
    out.append('Location: `/platform/scripts/cli/`')
    out.append('')
    out.append(md_table_row(['File', 'Exists', 'Purpose']))
    out.append(md_table_row(['------', '------', '-------']))
    cli_purposes = {'migrate.js': 'Database migrations', 'scaffold.js': 'Module generation', 'builder.js': 'App assembly'}
    for cli in sorted(cli_purposes.keys()):
        exists = '✅' if os.path.isfile(cli_dir + '/' + cli) else '❌'
        out.append(md_table_row(['`' + cli + '`', exists, cli_purposes[cli]]))
    found_cli = [f for f in ls_files_immediate(cli_dir, '.js') if f not in cli_purposes]
    for f in found_cli:
        out.append(md_table_row(['`' + f + '`', '✅', '(other)']))
    out.append('')
else:
    out.append('Directory does not exist.')
    out.append('')

# Tests
test_base = ROOT + '/tests'
out.append('## Phase 7: Testing Layer')
out.append('')
if os.path.isdir(test_base):
    test_subdirs = ['unit/services', 'unit/registries', 'integration/staging', 'integration/http', 'e2e']
    for subdir in test_subdirs:
        files = ls_files_immediate(test_base + '/' + subdir, '.test.js') + ls_files_immediate(test_base + '/' + subdir, '.spec.js')
        out.append('- `/tests/' + subdir + '/` — ' + str(len(files)) + ' test file(s)')
    out.append('')
    out.append('### Smoke Tests')
    out.append('')
    smoke_tests = ['student.endpoint_smoke.sh', 'staff.endpoint_smoke.sh', 'room.endpoint_smoke.sh', 'inventory.endpoint_smoke.sh', 'intelligence.smoke.sh', 'profile.endpoint_smoke.sh']
    for smoke in smoke_tests:
        exists = '✅' if os.path.isfile(test_base + '/' + smoke) else '❌'
        out.append('- `' + smoke + '` ' + exists)
    out.append('')
else:
    out.append('Directory does not exist.')
    out.append('')

# Engine Layers
out.append('## Phase 10-11: Engine Layers')
out.append('')
for eng_dir in ['engine/gap-analysis', 'engine/recommendation']:
    full_path = PLATFORM + '/' + eng_dir
    if os.path.isdir(full_path):
        eng_files = [f for f in ls_files_immediate(full_path, '.js') if f != '.gitkeep']
        out.append('**`/' + eng_dir + '/`**')
        if not eng_files:
            out.append('- Empty (only .gitkeep)')
        else:
            for ef in eng_files:
                info = file_info(full_path + '/' + ef)
                out.append('- `' + ef + '` (' + str(info['size']) + 'B)')
    else:
        out.append('**`/' + eng_dir + '/`** — Does not exist')
    out.append('')

# Data
data_dir = PLATFORM + '/data'
out.append('## Data Layer')
out.append('')
if os.path.isdir(data_dir):
    data_files = ls_files_immediate(data_dir)
    if data_files:
        for df in data_files:
            info = file_info(data_dir + '/' + df)
            out.append('- `' + df + '` (' + str(info['size']) + 'B)')
    else:
        out.append('No data files found.')
else:
    out.append('Directory does not exist.')
out.append('')

# Applications
apps_dir = ROOT + '/apps'
out.append('## Applications')
out.append('')
if os.path.isdir(apps_dir):
    app_names = [d for d in ls_dir(apps_dir) if not d.startswith('.')]
    out.append(md_table_row(['Application', 'Status']))
    out.append(md_table_row(['------------', '------']))
    for app in app_names:
        app_dir = apps_dir + '/' + app
        has_pkg = os.path.isfile(app_dir + '/package.json')
        has_src = os.path.isdir(app_dir + '/src')
        status = '✅ Ready' if (has_pkg and has_src) else '⚠️ Incomplete'
        out.append(md_table_row(['`' + app + '`', status]))
    out.append('')
else:
    out.append('No applications found.')
    out.append('')

# Drift Detection
out.append('---')
out.append('')
out.append('## Drift Detection')
out.append('')
drift_found = False

out.append('### Expected vs Found Discrepancies')
out.append('')

missing_contracts = [c for c in EXPECTED_CONTRACTS if c not in found_contracts]
extra_contracts = [c for c in found_contracts if c not in EXPECTED_CONTRACTS]
if missing_contracts or extra_contracts:
    drift_found = True
    if missing_contracts:
        out.append('- **Contracts missing:** ' + ', '.join(missing_contracts))
    if extra_contracts:
        out.append('- **Contracts extra (not expected):** ' + ', '.join(extra_contracts))
else:
    out.append('- ✅ All expected contracts present, no extras.')
out.append('')

missing_services = [s for s in EXPECTED_SERVICES if s not in found_services]
extra_services = [s for s in found_services if s not in EXPECTED_SERVICES]
if missing_services or extra_services:
    drift_found = True
    if missing_services:
        out.append('- **Services missing:** ' + ', '.join(missing_services))
    if extra_services:
        out.append('- **Services extra (not expected):** ' + ', '.join(extra_services))
else:
    out.append('- ✅ All expected services present, no extras.')
out.append('')

missing_registries = [r for r in EXPECTED_REGISTRIES if r not in found_registries]
extra_registries = [r for r in found_registries if r not in EXPECTED_REGISTRIES]
if missing_registries or extra_registries:
    drift_found = True
    if missing_registries:
        out.append('- **Registries missing:** ' + ', '.join(missing_registries))
    if extra_registries:
        out.append('- **Registries extra (not expected):** ' + ', '.join(extra_registries))
else:
    out.append('- ✅ All expected registries present, no extras.')
out.append('')

missing_pipeline = [p for p in EXPECTED_PIPELINE if p not in found_pipeline]
extra_pipeline = [p for p in found_pipeline if p not in EXPECTED_PIPELINE]
if missing_pipeline or extra_pipeline:
    drift_found = True
    if missing_pipeline:
        out.append('- **Pipeline missing:** ' + ', '.join(missing_pipeline))
    if extra_pipeline:
        out.append('- **Pipeline extra (not expected):** ' + ', '.join(extra_pipeline))
else:
    out.append('- ✅ All expected pipeline files present, no extras.')
out.append('')

out.append('### Expected Platform Directories')
out.append('')
for d in EXPECTED_DIRS:
    full_path = PLATFORM + '/' + d
    if not os.path.isdir(full_path):
        out.append('- ❌ MISSING DIR: `/platform/' + d + '/`')
        drift_found = True
    else:
        out.append('- ✅ `/platform/' + d + '/`')
out.append('')

out.append('### Frozen Document Integrity')
out.append('')
const_hash = file_hash_sha256(ROOT + '/CONSTITUTION_V6.0.md')
lex_hash = file_hash_sha256(ROOT + '/LEXICON_V6.0.0.md')
out.append('- CONSTITUTION_V6.0.md SHA256: `' + const_hash + '`')
out.append('- LEXICON_V6.0.0.md SHA256: `' + lex_hash + '`')
out.append('- Store these hashes. Any change indicates a frozen document was modified. Halt and investigate.')
out.append('')

out.append('### Summary')
out.append('')
if drift_found:
    out.append('- ⚠️ **Drift detected.** Compare against Constitution/Context for discrepancies.')
else:
    out.append('- ✅ No structural drift detected.')
out.append('')
out.append('---')
out.append('End of Architecture Map.')

with open(OUTPUT, 'w') as f:
    f.write('\n'.join(out))

print('Architecture map written to: ' + OUTPUT)
print('Drift detected: ' + str(drift_found))
