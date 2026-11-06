"""Package Dress'Ed over a published platform baseline; never install or restart.

Usage: python scripts/package-dressed-update.py BASELINE_ZIP OUTPUT_DIR RELEASE
Build both Dress'Ed projects first. OUTPUT_DIR must not already exist.
"""
import hashlib
import json
import posixpath
import re
import subprocess
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path


def verify_imports(files):
    """Check static relative imports, exports and literal dynamic imports."""
    for name, data in files.items():
        if not name.endswith(('.js', '.mjs')):
            continue
        for target in re.findall(r'''(?:from\s*|import\s*\(\s*|import\s*)["'](\.[^"']+)["']''', data.decode('utf-8')):
            resolved = posixpath.normpath(posixpath.join(posixpath.dirname(name), target))
            if resolved not in files:
                raise ValueError(f'Missing packaged dependency: {name} -> {target}')


def read_tree(root):
    return {p.relative_to(root).as_posix(): p.read_bytes() for p in root.rglob('*') if p.is_file()}


def main():
    baseline, output, release = sys.argv[1:]
    if not re.fullmatch(r'\d{4}\.\d{2}\.\d+\.\d+', release):
        raise ValueError('Expected YYYY.MM.DD.N release')
    root = Path(__file__).resolve().parent.parent
    baseline_manifest = json.loads(Path(baseline).with_name('timsys-update.json').read_text(encoding='utf-8-sig'))
    expected = next(b for b in baseline_manifest['bundles'] if b['id'] == 'platform')['sha256']
    if hashlib.sha256(Path(baseline).read_bytes()).hexdigest() != expected:
        raise ValueError('Published baseline checksum mismatch')
    output = Path(output)
    output.mkdir(parents=True, exist_ok=False)
    with zipfile.ZipFile(baseline) as archive:
        platform = {i.filename.removeprefix('./'): archive.read(i) for i in archive.infolist() if not i.is_dir()}
    original = dict(platform)
    prefix = 'services/dressed/dist/'
    backend = read_tree(root / 'platform/services/dressed/dist')
    if 'src/domain/planner/weekly-plan.js' not in backend:
        raise ValueError('Build Dress’Ed backend first: weekly planner missing')
    verify_imports(backend)
    for name in list(platform):
        if name.startswith(prefix):
            del platform[name]
    platform.update({prefix + name: data for name, data in backend.items()})
    for name, data in original.items():
        if not name.startswith(prefix) and platform.get(name) != data:
            raise ValueError(f'Unrelated platform file changed: {name}')
    frontend = read_tree(root / 'apps/dressed/dist/frontend')
    index = frontend['index.html'].decode()
    for asset in re.findall(r'(?:src|href)="/([^\"]+)"', index):
        if asset not in frontend:
            raise ValueError(f'Missing frontend asset: {asset}')
    dressed = {'dist/frontend/' + name: data for name, data in frontend.items()}
    for name in ('package.json', 'timsys.app.json', 'timsys.services.json', 'ai-adapter.json', 'ai-assistant-contract.json'):
        path = root / 'apps/dressed' / name
        if path.exists():
            dressed[name] = path.read_bytes()
    bundles = []
    for kind, files in (('platform', platform), ('dressed', dressed)):
        filename = f'{kind}-{release}.zip'
        path = output / filename
        with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as archive:
            for name, data in sorted(files.items()):
                archive.writestr(name, data)
        with zipfile.ZipFile(path) as archive:
            if archive.testzip() is not None:
                raise ValueError('Archive integrity check failed')
            for name, data in files.items():
                if archive.read(name) != data:
                    raise ValueError(f'Archive mismatch: {name}')
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        bundles.append(dict(id=kind, version=digest[:24], sha256=digest, size=path.stat().st_size,
                            url=f'https://github.com/tmaxcontact1-netizen/TimSyS_v6/releases/download/{release}/{filename}'))
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
    manifest = dict(schemaVersion=1, releaseVersion=release, minimumLauncherVersion='1.1.0',
                    publishedAt=datetime.now(timezone.utc).isoformat(), notes='Dress’Ed saved outfits and planners; complete backend dependency closure.', bundles=bundles)
    (output / 'timsys-update.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    changed = sorted(name for name in set(original) | set(platform) if original.get(name) != platform.get(name))
    evidence = dict(sourceCommit=commit, baselineSha256=hashlib.sha256(Path(baseline).read_bytes()).hexdigest(),
                    changedPlatformFiles=changed, localImportsVerified=True, archivesVerified=True,
                    installationPerformed=False)
    (output / 'dressed-verification.json').write_text(json.dumps(evidence, indent=2), encoding='utf-8')
    print(json.dumps(evidence, indent=2))


if __name__ == '__main__':
    main()
