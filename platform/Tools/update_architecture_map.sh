#!/usr/bin/env bash
# TimSyS Architecture Map Generator
# Manually triggered. Overwrites ARCHITECTURE_MAP.md in project root.
# Scans actual directory structure, detects drift from expected layout.

set -euo pipefail

PROJECT_ROOT="$HOME/TimSyS_v6"
OUTPUT_FILE="$PROJECT_ROOT/ARCHITECTURE_MAP.md"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GENERATED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# --- Expected structure (source of truth: CONSTITUTION + CONTEXT) ---
EXPECTED_CONTRACTS=("db.js" "cache.js" "auth.js" "log.js" "validate.js" "events.js")
EXPECTED_SERVICES=("db.js" "cache.js" "auth.js" "log.js" "validate.js" "events.js" "session.js" "audit.js" "metrics.js")
EXPECTED_REGISTRIES=("moduleRegistry.js" "schemaRegistry.js" "routeRegistry.js" "functionRegistry.js" "capabilityRegistry.js" "dependencyGraph.js")
EXPECTED_PIPELINE=("discover.js" "validate.js" "register.js" "resolve.js" "wire.js" "boot.js" "unstage.js")
EXPECTED_DIRS=("contracts" "shared/services" "shared/registry" "shared/pipeline" "modules" "tests" "Tools" "data" "routes" "engine/gap-analysis" "engine/recommendation")
ROOT_DOCS=("CONTEXT.md" "ARCHITECTURE_MAP.md" "HANDOVER.md" "CONSTITUTION_V6.0.md" "LEXICON_V6.0.0.md")

check_file_exists() {
  local dir="$1"
  shift
  local missing=()
  for f in "$@"; do
    if [[ ! -f "$dir/$f" ]]; then
      missing+=("$f")
    fi
  done
  echo "${missing[@]}"
}

# --- Begin output ---
cat > "$OUTPUT_FILE" << HEADER
# TimSyS Architecture Map
Generated: ${GENERATED_AT}
Generator: Tools/update_architecture_map.sh

This document is auto-generated. Do not edit manually.
Run \`bash Tools/update_architecture_map.sh\` to regenerate after structural changes.

---

## Project Root

Path: \`${PROJECT_ROOT}\`

HEADER

# --- Root Documents ---
echo "" >> "$OUTPUT_FILE"
echo "## Root Documents" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "| File | Exists | Size | Last Modified |" >> "$OUTPUT_FILE"
echo "|------|--------|------|---------------|" >> "$OUTPUT_FILE"
for doc in "${ROOT_DOCS[@]}"; do
  filepath="$PROJECT_ROOT/$doc"
  if [[ -f "$filepath" ]]; then
    size=$(stat --printf="%s" "$filepath" 2>/dev/null || echo "N/A")
    modtime=$(stat --printf="%y" "$filepath" 2>/dev/null | cut -d'.' -f1 || echo "N/A")
    echo "| \`$doc\` | ✅ | ${size}B | ${modtime} |" >> "$OUTPUT_FILE"
  else
    echo "| \`$doc\` | ❌ MISSING | - | - |" >> "$OUTPUT_FILE"
  fi
done

# --- Directory Tree ---
echo "" >> "$OUTPUT_FILE"
echo "## Directory Tree" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
if command -v tree &>/dev/null; then
  tree "$PROJECT_ROOT" -I 'node_modules|.git' --dirsfirst -L 4 >> "$OUTPUT_FILE" 2>&1 || \
  find "$PROJECT_ROOT" -not -path '*/node_modules/*' -not -path '*/.git/*' -type f -o -type d | sort | sed "s|$PROJECT_ROOT|.|" >> "$OUTPUT_FILE"
else
  echo "(tree command not available — using find)" >> "$OUTPUT_FILE"
  find "$PROJECT_ROOT" -not -path '*/node_modules/*' -not -path '*/.git/*' \( -type f -o -type d \) | sort | sed "s|$PROJECT_ROOT|.|" >> "$OUTPUT_FILE"
fi
echo '```' >> "$OUTPUT_FILE"

# --- Contract Layer ---
echo "" >> "$OUTPUT_FILE"
echo "## Phase 0: Foundation Contracts" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "Location: \`/contracts/\`" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "| File | Exists | Size | Last Modified |" >> "$OUTPUT_FILE"
echo "|------|--------|------|---------------|" >> "$OUTPUT_FILE"
for c in "${EXPECTED_CONTRACTS[@]}"; do
  filepath="$PROJECT_ROOT/contracts/$c"
  if [[ -f "$filepath" ]]; then
    size=$(stat --printf="%s" "$filepath" 2>/dev/null)
    modtime=$(stat --printf="%y" "$filepath" 2>/dev/null | cut -d'.' -f1)
    echo "| \`$c\` | ✅ | ${size}B | ${modtime} |" >> "$OUTPUT_FILE"
  else
    echo "| \`$c\` | ❌ MISSING | - | - |" >> "$OUTPUT_FILE"
  fi
done

# --- Services Layer ---
echo "" >> "$OUTPUT_FILE"
echo "## Phase 1.1: Persistence / Service Layer" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "Location: \`/shared/services/\`" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "| File | Exists | Size | Last Modified |" >> "$OUTPUT_FILE"
echo "|------|--------|------|---------------|" >> "$OUTPUT_FILE"
for s in "${EXPECTED_SERVICES[@]}"; do
  filepath="$PROJECT_ROOT/shared/services/$s"
  if [[ -f "$filepath" ]]; then
    size=$(stat --printf="%s" "$filepath" 2>/dev/null)
    modtime=$(stat --printf="%y" "$filepath" 2>/dev/null | cut -d'.' -f1)
    echo "| \`$s\` | ✅ | ${size}B | ${modtime} |" >> "$OUTPUT_FILE"
  else
    echo "| \`$s\` | ❌ MISSING | - | - |" >> "$OUTPUT_FILE"
  fi
done

# --- Registry Layer ---
echo "" >> "$OUTPUT_FILE"
echo "## Phase 1.2: Registry Layer" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "Location: \`/shared/registry/\`" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "| File | Exists | Size | Last Modified |" >> "$OUTPUT_FILE"
echo "|------|--------|------|---------------|" >> "$OUTPUT_FILE"
for r in "${EXPECTED_REGISTRIES[@]}"; do
  filepath="$PROJECT_ROOT/shared/registry/$r"
  if [[ -f "$filepath" ]]; then
    size=$(stat --printf="%s" "$filepath" 2>/dev/null)
    modtime=$(stat --printf="%y" "$filepath" 2>/dev/null | cut -d'.' -f1)
    echo "| \`$r\` | ✅ | ${size}B | ${modtime} |" >> "$OUTPUT_FILE"
  else
    echo "| \`$r\` | ❌ MISSING | - | - |" >> "$OUTPUT_FILE"
  fi
done

# --- Pipeline Layer ---
echo "" >> "$OUTPUT_FILE"
echo "## Phase 1.3: Staging Pipeline" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
PIPELINE_DIR_SHARED="$PROJECT_ROOT/shared/pipeline"
PIPELINE_DIR_ROOT="$PROJECT_ROOT/pipeline"
if [[ -d "$PIPELINE_DIR_SHARED" ]]; then
  PIPELINE_LOC="/shared/pipeline/"
elif [[ -d "$PIPELINE_DIR_ROOT" ]]; then
  PIPELINE_LOC="/pipeline/"
else
  PIPELINE_LOC="NOT FOUND"
fi
echo "Location: \`$PIPELINE_LOC\`" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "| File | Exists | Size | Last Modified |" >> "$OUTPUT_FILE"
echo "|------|--------|------|---------------|" >> "$OUTPUT_FILE"
for p in "${EXPECTED_PIPELINE[@]}"; do
  found=false
  for pdir in "$PIPELINE_DIR_SHARED" "$PIPELINE_DIR_ROOT"; do
    filepath="$pdir/$p"
    if [[ -f "$filepath" ]]; then
      size=$(stat --printf="%s" "$filepath" 2>/dev/null)
      modtime=$(stat --printf="%y" "$filepath" 2>/dev/null | cut -d'.' -f1)
      relpath="${filepath#$PROJECT_ROOT/}"
      echo "| \`$p\` | ✅ (${relpath}) | ${size}B | ${modtime} |" >> "$OUTPUT_FILE"
      found=true
      break
    fi
  done
  if [[ "$found" == false ]]; then
    echo "| \`$p\` | ❌ MISSING | - | - |" >> "$OUTPUT_FILE"
  fi
done

# --- Modules ---
echo "" >> "$OUTPUT_FILE"
echo "## Modules" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "Location: \`/modules/\`" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
MODULES_DIR="$PROJECT_ROOT/modules"
if [[ -d "$MODULES_DIR" ]]; then
  mapfile -t MODULE_NAMES < <(find "$MODULES_DIR" -maxdepth 1 -mindepth 1 -type d -exec basename {} \; 2>/dev/null | sort)
  if [[ ${#MODULE_NAMES[@]} -eq 0 ]]; then
    echo "No modules staged." >> "$OUTPUT_FILE"
  else
    echo "| Module | Manifest | Index | Migrations | Handlers | Schemas |" >> "$OUTPUT_FILE"
    echo "|--------|----------|-------|------------|----------|---------|" >> "$OUTPUT_FILE"
    for m in "${MODULE_NAMES[@]}"; do
      mdir="$MODULES_DIR/$m"
      manifest=$([[ -f "$mdir/module.json" ]] && echo "✅" || echo "❌")
      index=$([[ -f "$mdir/index.js" ]] && echo "✅" || echo "❌")
      mig_count=$(find "$mdir/migrations" -name "*.sql" 2>/dev/null | wc -l)
      handler_count=$(find "$mdir/handlers" -name "*.js" 2>/dev/null | wc -l)
      schema_count=$(find "$mdir/schemas" -name "*.json" 2>/dev/null | wc -l)
      echo "| \`$m\` | $manifest | $index | ${mig_count} | ${handler_count} | ${schema_count} |" >> "$OUTPUT_FILE"
    done
  fi
else
  echo "Directory does not exist." >> "$OUTPUT_FILE"
fi

# --- Tests ---
echo "" >> "$OUTPUT_FILE"
echo "## Phase 7: Testing Layer" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
TEST_BASE="$PROJECT_ROOT/tests"
if [[ -d "$TEST_BASE" ]]; then
  for subdir in "unit/services" "unit/registries" "integration/staging" "integration/http" "e2e"; do
    count=$(find "$TEST_BASE/$subdir" -name "*.test.js" -o -name "*.spec.js" 2>/dev/null | wc -l)
    echo "- \`/tests/$subdir/\` — ${count} test file(s)" >> "$OUTPUT_FILE"
  done
else
  echo "Directory does not exist." >> "$OUTPUT_FILE"
fi

# --- Tools ---
echo "" >> "$OUTPUT_FILE"
echo "## Tools" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
TOOLS_DIR="$PROJECT_ROOT/Tools"
if [[ -d "$TOOLS_DIR" ]]; then
  mapfile -t TOOLS < <(find "$TOOLS_DIR" -maxdepth 2 -type f -exec basename {} \; 2>/dev/null | sort)
  if [[ ${#TOOLS[@]} -eq 0 ]]; then
    echo "No tools found." >> "$OUTPUT_FILE"
  else
    for t in "${TOOLS[@]}"; do
      echo "- \`$t\`" >> "$OUTPUT_FILE"
    done
  fi
else
  echo "Directory does not exist." >> "$OUTPUT_FILE"
fi

# --- Engine Layers ---
echo "" >> "$OUTPUT_FILE"
echo "## Phase 10-11: Engine Layers" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
for eng_dir in "engine/gap-analysis" "engine/recommendation"; do
  full_path="$PROJECT_ROOT/$eng_dir"
  if [[ -d "$full_path" ]]; then
    mapfile -t ENG_FILES < <(find "$full_path" -type f -exec basename {} \; 2>/dev/null | sort)
    echo "**\`/$eng_dir/\`**" >> "$OUTPUT_FILE"
    if [[ ${#ENG_FILES[@]} -eq 0 ]]; then
      echo "- Empty" >> "$OUTPUT_FILE"
    else
      for ef in "${ENG_FILES[@]}"; do
        echo "- \`$ef\`" >> "$OUTPUT_FILE"
      done
    fi
  else
    echo "**\`/$eng_dir/\`** — Does not exist" >> "$OUTPUT_FILE"
  fi
done

# --- Routes ---
echo "" >> "$OUTPUT_FILE"
echo "## Phase 5: HTTP / Routes" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
ROUTES_DIR="$PROJECT_ROOT/routes"
if [[ -d "$ROUTES_DIR" ]]; then
  mapfile -t ROUTE_FILES < <(find "$ROUTES_DIR" -maxdepth 2 -name "*.js" -exec basename {} \; 2>/dev/null | sort)
  if [[ ${#ROUTE_FILES[@]} -eq 0 ]]; then
    echo "No route files found." >> "$OUTPUT_FILE"
  else
    for rf in "${ROUTE_FILES[@]}"; do
      echo "- \`$rf\`" >> "$OUTPUT_FILE"
    done
  fi
else
  echo "Directory does not exist." >> "$OUTPUT_FILE"
fi

# --- Data ---
echo "" >> "$OUTPUT_FILE"
echo "## Data Layer" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
DATA_DIR="$PROJECT_ROOT/data"
if [[ -d "$DATA_DIR" ]]; then
  mapfile -t DATA_FILES < <(find "$DATA_DIR" -maxdepth 1 -type f -exec basename {} \; 2>/dev/null | sort)
  if [[ ${#DATA_FILES[@]} -eq 0 ]]; then
    echo "No data files found." >> "$OUTPUT_FILE"
  else
    for df in "${DATA_FILES[@]}"; do
      size=$(stat --printf="%s" "$DATA_DIR/$df" 2>/dev/null || echo "?")
      echo "- \`$df\` (${size}B)" >> "$OUTPUT_FILE"
    done
  fi
else
  echo "Directory does not exist." >> "$OUTPUT_FILE"
fi

# --- Drift Detection ---
echo "" >> "$OUTPUT_FILE"
echo "---" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "## Drift Detection" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
DRIFT_FOUND=false

# Check expected dirs exist
echo "### Expected Directories" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
for d in "${EXPECTED_DIRS[@]}"; do
  full_path="$PROJECT_ROOT/$d"
  if [[ ! -d "$full_path" ]]; then
    echo "- ❌ MISSING DIR: \`/$d/\`" >> "$OUTPUT_FILE"
    DRIFT_FOUND=true
  fi
done
if [[ "$DRIFT_FOUND" == false ]]; then
  echo "- ✅ All expected directories present." >> "$OUTPUT_FILE"
fi

# Check frozen documents integrity
echo "" >> "$OUTPUT_FILE"
echo "### Frozen Document Integrity" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
CONSTITUTION_HASH=$(sha256sum "$PROJECT_ROOT/CONSTITUTION_V6.0.md" 2>/dev/null | cut -d' ' -f1 || echo "FILE MISSING")
LEXICON_HASH=$(sha256sum "$PROJECT_ROOT/LEXICON_V6.0.0.md" 2>/dev/null | cut -d' ' -f1 || echo "FILE MISSING")
echo "- CONSTITUTION_V6.0.md SHA256: \`$CONSTITUTION_HASH\`" >> "$OUTPUT_FILE"
echo "- LEXICON_V6.0.0.md SHA256: \`$LEXICON_HASH\`" >> "$OUTPUT_FILE"
echo "- Store these hashes. Any change indicates a frozen document was modified. Halt and investigate." >> "$OUTPUT_FILE"

# Contract freeze status check
echo "" >> "$OUTPUT_FILE"
echo "### Contract Freeze Status" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
CONTRACT_COUNT=0
for c in "${EXPECTED_CONTRACTS[@]}"; do
  if [[ -f "$PROJECT_ROOT/contracts/$c" ]]; then
    ((CONTRACT_COUNT++))
  fi
done
echo "- Contracts present: ${CONTRACT_COUNT}/6" >> "$OUTPUT_FILE"
if [[ $CONTRACT_COUNT -eq 6 ]]; then
  echo "- Status: All contract files exist. Verify they are frozen and signed off." >> "$OUTPUT_FILE"
else
  echo "- Status: $((6 - CONTRACT_COUNT)) contract file(s) missing." >> "$OUTPUT_FILE"
fi

echo "" >> "$OUTPUT_FILE"
echo "---" >> "$OUTPUT_FILE"
echo "End of Architecture Map." >> "$OUTPUT_FILE"

# --- Console output ---
echo "Architecture map written to: $OUTPUT_FILE"
echo "Drift detected: $DRIFT_FOUND"