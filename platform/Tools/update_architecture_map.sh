#!/usr/bin/env bash
# TimSyS Architecture Map Generator
# Manually triggered. Overwrites ARCHITECTURE_MAP.md in project root.
# Scans actual directory structure, detects drift from expected layout.
# To run bash /home/tmax/TimSyS_v6/platform/Tools/update_architecture_map.sh

set -euo pipefail

ROOT_DIR="$HOME/TimSyS_v6"
PLATFORM_DIR="$ROOT_DIR/platform"
OUTPUT_FILE="$ROOT_DIR/ARCHITECTURE_MAP.md"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GENERATED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# --- Expected structure (source of truth: CONSTITUTION + CONTEXT) ---
EXPECTED_CONTRACTS=("db.js" "cache.js" "auth.js" "log.js" "validate.js" "events.js" "intelligence.js")
EXPECTED_SERVICES=("db.js" "cache.js" "auth.js" "log.js" "validate.js" "events.js" "session.js" "audit.js" "metrics.js" "email.js" "ratelimit.js" "refresh.js")
EXPECTED_REGISTRIES=("moduleRegistry.js" "schemaRegistry.js" "routeRegistry.js" "functionRegistry.js" "capabilityRegistry.js" "dependencyGraph.js" "componentRegistry.js" "componentScanner.js")
EXPECTED_PIPELINE=("discover.js" "validate.js" "register.js" "resolve.js" "wire.js" "boot.js" "unstage.js")
EXPECTED_DIRS=("contracts" "shared/services" "shared/registry" "shared/pipeline" "modules" "tests" "Tools" "data" "routes" "engine/gap-analysis" "engine/recommendation")
ROOT_DOCS=("CONTEXT.md" "ARCHITECTURE_MAP.md" "HANDOVER.md" "CONSTITUTION_V6.0.md" "LEXICON_V6.0.0.md")

# --- Begin output ---
cat > "$OUTPUT_FILE" << HEADER
# TimSyS Architecture Map
Generated: ${GENERATED_AT}
Generator: Tools/update_architecture_map.sh

This document is auto-generated. Do not edit manually.
Run \`bash Tools/update_architecture_map.sh\` to regenerate after structural changes.

---

## Project Root

Path: \`${ROOT_DIR}\`

Platform Location: \`${PLATFORM_DIR}\`

HEADER

# --- Root Documents ---
echo "" >> "$OUTPUT_FILE"
echo "## Root Documents" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "| File | Exists | Size | Last Modified |" >> "$OUTPUT_FILE"
echo "|------|--------|------|---------------|" >> "$OUTPUT_FILE"
for doc in "${ROOT_DOCS[@]}"; do
  filepath="$ROOT_DIR/$doc"
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
  tree "$ROOT_DIR" -I 'node_modules|.git' --dirsfirst -L 4 >> "$OUTPUT_FILE" 2>&1 || \
  find "$ROOT_DIR" -not -path '*/node_modules/*' -not -path '*/.git/*' \( -type f -o -type d \) | sort | sed "s|$ROOT_DIR|.|" >> "$OUTPUT_FILE"
else
  echo "(tree command not available — using find)" >> "$OUTPUT_FILE"
  find "$ROOT_DIR" -not -path '*/node_modules/*' -not -path '*/.git/*' \( -type f -o -type d \) | sort | sed "s|$ROOT_DIR|.|" >> "$OUTPUT_FILE"
fi
echo '```' >> "$OUTPUT_FILE"

# --- Contract Layer ---
echo "" >> "$OUTPUT_FILE"
echo "## Phase 0: Foundation Contracts" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "Location: \`/platform/contracts/\`" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "| File | Exists | Size | Last Modified |" >> "$OUTPUT_FILE"
echo "|------|--------|------|---------------|" >> "$OUTPUT_FILE"
for c in "${EXPECTED_CONTRACTS[@]}"; do
  filepath="$PLATFORM_DIR/contracts/$c"
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
echo "Location: \`/platform/shared/services/\`" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "| File | Exists | Size | Last Modified |" >> "$OUTPUT_FILE"
echo "|------|--------|------|---------------|" >> "$OUTPUT_FILE"
for s in "${EXPECTED_SERVICES[@]}"; do
  filepath="$PLATFORM_DIR/shared/services/$s"
  if [[ -f "$filepath" ]]; then
    size=$(stat --printf="%s" "$filepath" 2>/dev/null)
    modtime=$(stat --printf="%y" "$filepath" 2>/dev/null | cut -d'.' -f1)
    echo "| \`$s\` | ✅ | ${size}B | ${modtime} |" >> "$OUTPUT_FILE"
  else
    echo "| \`$s\` | ❌ MISSING | - | - |" >> "$OUTPUT_FILE"
  fi
done

# Intelligence service package
echo "" >> "$OUTPUT_FILE"
echo "### Intelligence Service Package" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
INTEL_DIR="$PLATFORM_DIR/shared/services/intelligence"
if [[ -d "$INTEL_DIR" ]]; then
  echo "Location: \`/platform/shared/services/intelligence/\`" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
  echo "| File | Exists | Size |" >> "$OUTPUT_FILE"
  echo "|------|--------|------|" >> "$OUTPUT_FILE"
  for intel_file in "index.js" "metadata.js" "insights.js" "logic.js" "store.js"; do
    filepath="$INTEL_DIR/$intel_file"
    if [[ -f "$filepath" ]]; then
      size=$(stat --printf="%s" "$filepath" 2>/dev/null)
      echo "| \`$intel_file\` | ✅ | ${size}B |" >> "$OUTPUT_FILE"
    else
      echo "| \`$intel_file\` | ❌ MISSING | - |" >> "$OUTPUT_FILE"
    fi
  done
else
  echo "Directory does not exist." >> "$OUTPUT_FILE"
fi

# --- Registry Layer ---
echo "" >> "$OUTPUT_FILE"
echo "## Phase 1.2: Registry Layer" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "Location: \`/platform/shared/registry/\`" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "| File | Exists | Size | Last Modified |" >> "$OUTPUT_FILE"
echo "|------|--------|------|---------------|" >> "$OUTPUT_FILE"
for r in "${EXPECTED_REGISTRIES[@]}"; do
  filepath="$PLATFORM_DIR/shared/registry/$r"
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
PIPELINE_DIR="$PLATFORM_DIR/shared/pipeline"
echo "Location: \`/platform/shared/pipeline/\`" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "| File | Exists | Size | Last Modified |" >> "$OUTPUT_FILE"
echo "|------|--------|------|---------------|" >> "$OUTPUT_FILE"
for p in "${EXPECTED_PIPELINE[@]}"; do
  filepath="$PIPELINE_DIR/$p"
  if [[ -f "$filepath" ]]; then
    size=$(stat --printf="%s" "$filepath" 2>/dev/null)
    modtime=$(stat --printf="%y" "$filepath" 2>/dev/null | cut -d'.' -f1)
    echo "| \`$p\` | ✅ | ${size}B | ${modtime} |" >> "$OUTPUT_FILE"
  else
    echo "| \`$p\` | ❌ MISSING | - | - |" >> "$OUTPUT_FILE"
  fi
done

# --- Middleware ---
echo "" >> "$OUTPUT_FILE"
echo "## Phase 5: HTTP Middleware" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
MIDDLEWARE_DIR="$PLATFORM_DIR/shared/middleware"
if [[ -d "$MIDDLEWARE_DIR" ]]; then
  echo "Location: \`/platform/shared/middleware/\`" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
  echo "| File | Exists | Size |" >> "$OUTPUT_FILE"
  echo "|------|--------|------|" >> "$OUTPUT_FILE"
  for mw in "*.js"; do
    mapfile -t MW_FILES < <(find "$MIDDLEWARE_DIR" -name "*.js" -exec basename {} \; 2>/dev/null | sort)
    if [[ ${#MW_FILES[@]} -gt 0 ]]; then
      for mf in "${MW_FILES[@]}"; do
        filepath="$MIDDLEWARE_DIR/$mf"
        size=$(stat --printf="%s" "$filepath" 2>/dev/null)
        echo "| \`$mf\` | ✅ | ${size}B |" >> "$OUTPUT_FILE"
      done
      break
    else
      echo "No middleware files found." >> "$OUTPUT_FILE"
      break
    fi
  done
else
  echo "Directory does not exist." >> "$OUTPUT_FILE"
fi

# --- Modules ---
echo "" >> "$OUTPUT_FILE"
echo "## Modules" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "Location: \`/platform/modules/\`" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
MODULES_DIR="$PLATFORM_DIR/modules"
if [[ -d "$MODULES_DIR" ]]; then
  mapfile -t MODULE_NAMES < <(find "$MODULES_DIR" -maxdepth 1 -mindepth 1 -type d -exec basename {} \; 2>/dev/null | sort)
  if [[ ${#MODULE_NAMES[@]} -eq 0 ]]; then
    echo "No modules staged." >> "$OUTPUT_FILE"
  else
    echo "| Module | Manifest | Index | Component | Migrations | Type |" >> "$OUTPUT_FILE"
    echo "|--------|----------|-------|-----------|------------|------|" >> "$OUTPUT_FILE"
    for m in "${MODULE_NAMES[@]}"; do
      mdir="$MODULES_DIR/$m"
      manifest=$([[ -f "$mdir/module.json" ]] && echo "✅" || echo "❌")
      index=$([[ -f "$mdir/index.js" ]] && echo "✅" || echo "❌")
      component=$([[ -f "$mdir/component.json" ]] && echo "✅" || echo "❌")
      mig_count=$(find "$mdir/migrations" -name "*.sql" 2>/dev/null | wc -l)
      
      # Detect module type from component.json or name
      module_type="standard"
      if [[ -f "$mdir/component.json" ]]; then
        comp_type=$(grep -o '"type"[[:space:]]*:[[:space:]]*"[^"]*"' "$mdir/component.json" 2>/dev/null | cut -d'"' -f4 || echo "")
        if [[ -n "$comp_type" ]]; then
          module_type="$comp_type"
        elif [[ "$m" =~ _registry$ ]]; then
          module_type="registry"
        elif [[ "$m" =~ _profile$ ]]; then
          module_type="profile"
        fi
      fi
      
      echo "| \`$m\` | $manifest | $index | $component | ${mig_count} | $module_type |" >> "$OUTPUT_FILE"
    done
  fi
else
  echo "Directory does not exist." >> "$OUTPUT_FILE"
fi

# --- CLI Tools ---
echo "" >> "$OUTPUT_FILE"
echo "## CLI Tools" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
CLI_DIR="$PLATFORM_DIR/scripts/cli"
if [[ -d "$CLI_DIR" ]]; then
  echo "Location: \`/platform/scripts/cli/\`" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
  echo "| File | Exists | Purpose |" >> "$OUTPUT_FILE"
  echo "|------|--------|---------|" >> "$OUTPUT_FILE"
  for cli in "migrate.js" "scaffold.js" "builder.js"; do
    filepath="$CLI_DIR/$cli"
    if [[ -f "$filepath" ]]; then
      purpose=""
      case "$cli" in
        migrate.js) purpose="Database migrations" ;;
        scaffold.js) purpose="Module generation" ;;
        builder.js) purpose="App assembly" ;;
      esac
      echo "| \`$cli\` | ✅ | $purpose |" >> "$OUTPUT_FILE"
    else
      echo "| \`$cli\` | ❌ MISSING | - |" >> "$OUTPUT_FILE"
    fi
  done
else
  echo "Directory does not exist." >> "$OUTPUT_FILE"
fi

# --- Tests ---
echo "" >> "$OUTPUT_FILE"
echo "## Phase 7: Testing Layer" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
TEST_BASE="$PLATFORM_DIR/../tests"
if [[ -d "$TEST_BASE" ]]; then
  for subdir in "unit/services" "unit/registries" "integration/staging" "integration/http" "e2e"; do
    count=$(find "$TEST_BASE/$subdir" -name "*.test.js" -o -name "*.spec.js" 2>/dev/null | wc -l)
    echo "- \`/tests/$subdir/\` — ${count} test file(s)" >> "$OUTPUT_FILE"
  done
  
  # Endpoint smoke tests
  echo "" >> "$OUTPUT_FILE"
  echo "### Smoke Tests" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
  for smoke in "student.endpoint_smoke.sh" "staff.endpoint_smoke.sh" "room.endpoint_smoke.sh" "inventory.endpoint_smoke.sh" "intelligence.smoke.sh" "profile.endpoint_smoke.sh"; do
    filepath="$TEST_BASE/$smoke"
    if [[ -f "$filepath" ]]; then
      echo "- \`$smoke\` ✅" >> "$OUTPUT_FILE"
    else
      echo "- \`$smoke\` ❌" >> "$OUTPUT_FILE"
    fi
  done
else
  echo "Directory does not exist." >> "$OUTPUT_FILE"
fi

# --- Engine Layers ---
echo "" >> "$OUTPUT_FILE"
echo "## Phase 10-11: Engine Layers" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
for eng_dir in "engine/gap-analysis" "engine/recommendation"; do
  full_path="$PLATFORM_DIR/$eng_dir"
  if [[ -d "$full_path" ]]; then
    mapfile -t ENG_FILES < <(find "$full_path" -type f -name "*.js" ! -name ".gitkeep" -exec basename {} \; 2>/dev/null | sort)
    echo "**\`/$eng_dir/\`**" >> "$OUTPUT_FILE"
    if [[ ${#ENG_FILES[@]} -eq 0 ]]; then
      echo "- Empty (only .gitkeep)" >> "$OUTPUT_FILE"
    else
      for ef in "${ENG_FILES[@]}"; do
        filepath="$full_path/$ef"
        size=$(stat --printf="%s" "$filepath" 2>/dev/null || echo "?")
        echo "- \`$ef\` (${size}B)" >> "$OUTPUT_FILE"
      done
    fi
  else
    echo "**\`/$eng_dir/\`** — Does not exist" >> "$OUTPUT_FILE"
  fi
done

# --- Data ---
echo "" >> "$OUTPUT_FILE"
echo "## Data Layer" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
DATA_DIR="$PLATFORM_DIR/data"
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

# --- Apps ---
echo "" >> "$OUTPUT_FILE"
echo "## Applications" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
APPS_DIR="$ROOT_DIR/apps"
if [[ -d "$APPS_DIR" ]]; then
  mapfile -t APP_NAMES < <(find "$APPS_DIR" -maxdepth 1 -mindepth 1 -type d -exec basename {} \; 2>/dev/null | sort)
  echo "| Application | Status |" >> "$OUTPUT_FILE"
  echo "|-------------|--------|" >> "$OUTPUT_FILE"
  for app in "${APP_NAMES[@]}"; do
    app_dir="$APPS_DIR/$app"
    pkg="$app_dir/package.json"
    src="$app_dir/src"
    if [[ -f "$pkg" && -d "$src" ]]; then
      echo "| \`$app\` | ✅ Ready |" >> "$OUTPUT_FILE"
    else
      echo "| \`$app\` | ⚠️ Incomplete |" >> "$OUTPUT_FILE"
    fi
  done
else
  echo "No applications found." >> "$OUTPUT_FILE"
fi

# --- Drift Detection ---
echo "" >> "$OUTPUT_FILE"
echo "---" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "## Drift Detection" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
DRIFT_FOUND=false

# Check expected dirs exist in PLATFORM_DIR
echo "### Expected Platform Directories" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
for d in "${EXPECTED_DIRS[@]}"; do
  full_path="$PLATFORM_DIR/$d"
  if [[ ! -d "$full_path" ]]; then
    echo "- ❌ MISSING DIR: \`/platform/$d/\`" >> "$OUTPUT_FILE"
    DRIFT_FOUND=true
  fi
done
if [[ "$DRIFT_FOUND" == false ]]; then
  echo "- ✅ All expected platform directories present." >> "$OUTPUT_FILE"
fi

# Check frozen documents integrity
echo "" >> "$OUTPUT_FILE"
echo "### Frozen Document Integrity" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
CONSTITUTION_HASH=$(sha256sum "$ROOT_DIR/CONSTITUTION_V6.0.md" 2>/dev/null | cut -d' ' -f1 || echo "FILE MISSING")
LEXICON_HASH=$(sha256sum "$ROOT_DIR/LEXICON_V6.0.0.md" 2>/dev/null | cut -d' ' -f1 || echo "FILE MISSING")
echo "- CONSTITUTION_V6.0.md SHA256: \`$CONSTITUTION_HASH\`" >> "$OUTPUT_FILE"
echo "- LEXICON_V6.0.0.md SHA256: \`$LEXICON_HASH\`" >> "$OUTPUT_FILE"
echo "- Store these hashes. Any change indicates a frozen document was modified. Halt and investigate." >> "$OUTPUT_FILE"

# Contract freeze status check
echo "" >> "$OUTPUT_FILE"
echo "### Contract Freeze Status" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
CONTRACT_COUNT=0
for c in "${EXPECTED_CONTRACTS[@]}"; do
  if [[ -f "$PLATFORM_DIR/contracts/$c" ]]; then
    ((CONTRACT_COUNT++))
  fi
done
echo "- Contracts present: ${CONTRACT_COUNT}/${#EXPECTED_CONTRACTS[@]}" >> "$OUTPUT_FILE"
if [[ $CONTRACT_COUNT -eq ${#EXPECTED_CONTRACTS[@]} ]]; then
  echo "- Status: All contract files exist. Verify they are frozen and signed off." >> "$OUTPUT_FILE"
else
  echo "- Status: $(( ${#EXPECTED_CONTRACTS[@]} - CONTRACT_COUNT )) contract file(s) missing." >> "$OUTPUT_FILE"
fi

echo "" >> "$OUTPUT_FILE"
echo "---" >> "$OUTPUT_FILE"
echo "End of Architecture Map." >> "$OUTPUT_FILE"

# --- Console output ---
echo "Architecture map written to: $OUTPUT_FILE"
echo "Drift detected: $DRIFT_FOUND"