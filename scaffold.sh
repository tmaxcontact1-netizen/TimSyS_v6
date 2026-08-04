#!/usr/bin/env bash

set -euo pipefail

project_root="${1:-$PWD}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
map_source="$script_dir/PROJECT_MAP.md"

if [[ ! -f "$project_root/package.json" || ! -f "$project_root/package-lock.json" ]]; then
  echo "STOP: run this against the existing Memecoined repository containing package.json and package-lock.json." >&2
  exit 1
fi

if [[ ! -f "$map_source" ]]; then
  echo "STOP: PROJECT_MAP.md must be beside scaffold.sh." >&2
  exit 1
fi

package_name="$(node -p "require(process.argv[1]).name" "$project_root/package.json")"
if [[ "$package_name" != "memecoined" ]]; then
  echo "STOP: package name is '$package_name', expected 'memecoined'." >&2
  exit 1
fi

for document in \
  SERVICE_CONTRACTS.md \
  PROJECT_MAP.md \
  DEPENDENCY_MANIFEST.md \
  SYSTEM_SCHEMA.md \
  STRATEGY_SPECIFICATION.md \
  CHANGELOG.md
do
  if [[ ! -f "$script_dir/$document" ]]; then
    echo "STOP: required approved document is missing: $document" >&2
    exit 1
  fi
done

mapfile -t mapped_files < <(
  awk -F'|' '
    /^\| `\// {
      path = $2
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", path)
      gsub(/`/, "", path)
      if (path !~ /\*/ && path !~ /\/$/ && path ~ /\.[A-Za-z0-9]+$/) {
        print substr(path, 2)
      }
    }
  ' "$map_source" | sort -u
)

if [[ "${#mapped_files[@]}" -ne 161 ]]; then
  echo "STOP: PROJECT_MAP.md yielded ${#mapped_files[@]} authored files; expected 161." >&2
  exit 1
fi

mkdir -p "$project_root/docs"
for document in \
  SERVICE_CONTRACTS.md \
  PROJECT_MAP.md \
  DEPENDENCY_MANIFEST.md \
  SYSTEM_SCHEMA.md \
  STRATEGY_SPECIFICATION.md \
  CHANGELOG.md
do
  if [[ -e "$project_root/docs/$document" ]]; then
    echo "STOP: refusing to overwrite existing docs/$document." >&2
    exit 1
  fi
  cp "$script_dir/$document" "$project_root/docs/$document"
done

for relative_path in "${mapped_files[@]}"; do
  case "$relative_path" in
    package.json|package-lock.json|docs/SERVICE_CONTRACTS.md|docs/PROJECT_MAP.md|docs/DEPENDENCY_MANIFEST.md|docs/SYSTEM_SCHEMA.md|docs/STRATEGY_SPECIFICATION.md|docs/CHANGELOG.md)
      continue
      ;;
  esac

  mkdir -p "$project_root/$(dirname "$relative_path")"
  if [[ ! -e "$project_root/$relative_path" ]]; then
    : > "$project_root/$relative_path"
  fi
done

mkdir -p \
  "$project_root/fixtures/providers/solana" \
  "$project_root/fixtures/providers/helius" \
  "$project_root/fixtures/providers/jupiter" \
  "$project_root/fixtures/providers/dexscreener" \
  "$project_root/fixtures/providers/birdeye" \
  "$project_root/fixtures/providers/gmgn" \
  "$project_root/fixtures/providers/telegram" \
  "$project_root/fixtures/replay"

missing=0
for relative_path in "${mapped_files[@]}"; do
  if [[ ! -f "$project_root/$relative_path" ]]; then
    echo "MISSING: $relative_path" >&2
    missing=$((missing + 1))
  fi
done

if [[ "$missing" -ne 0 ]]; then
  echo "FAILED: $missing mapped files are missing." >&2
  exit 1
fi

created_count="$(find "$project_root" -type f \
  ! -path "$project_root/node_modules/*" \
  ! -path "$project_root/.git/*" \
  | wc -l)"

echo "Scaffold complete: all 161 mapped authored files exist."
echo "Repository files outside node_modules and .git: $created_count"
echo "No database, migrations, provider authentication, or executable implementation was run."
