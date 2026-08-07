#!/bin/bash
# Path: /home/tmax/TimSyS_v6/tests/intelligence.smoke.sh
# Purpose: Smoke test for intelligence engine — metadata storage + synthesize
# Total lines: 120

set -e

BASE_URL="http://localhost:3000"
ADMIN_USER="admin"
ADMIN_PASS="changeme123"
TOKEN=""
PLATFORM_PID=""

echo "=== Intelligence Engine Smoke Test ==="
echo ""

# ============================================================================
# SETUP
# ============================================================================

echo "[SETUP] Starting platform..."
kill -9 $(lsof -ti:3000) 2>/dev/null || true
cd /home/tmax/TimSyS_v6/platform
rm -f data/timsys.sqlite*

export JWT_SECRET="test-secret-key-for-development-use-only-32chars"
NODE_ENV=test DEV_MODE=1 node index.js &
PLATFORM_PID=$!
sleep 3

if ! curl -s "${BASE_URL}/health" >/dev/null 2>&1; then
    echo "[ERROR] Platform failed to start"
    exit 1
fi
echo "[SETUP] Platform started (PID: ${PLATFORM_PID})"

echo "[SETUP] Logging in as admin..."
LOGIN_RESP=$(curl -s -X POST "${BASE_URL}/api/auth/login" \
    -H "Content-Type: application/json" \
    -H "X-Requested-With: XMLHttpRequest" \
    -d "{\"username\":\"${ADMIN_USER}\",\"password\":\"${ADMIN_PASS}\"}")

TOKEN=$(echo "${LOGIN_RESP}" | grep -o '"token":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "${TOKEN}" ]; then
    echo "[ERROR] Failed to get auth token"
    echo "${LOGIN_RESP}"
    exit 1
fi
echo "[SETUP] Token acquired"
echo ""

# ============================================================================
# TEST 1 — Create student (triggers metadata storage)
# ============================================================================

echo "[TEST 1] Creating student..."
RESP=$(curl -s -X POST "${BASE_URL}/students" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d '{"student_id":"STU-INT-001","first_name":"Alice","last_name":"Test","date_of_birth":"2010-05-15","sex":"Female","enrollment_status":"active","current_grade_level":5}')

SUCCESS=$(echo "${RESP}" | grep -o '"success":[^,]*' | head -1 | cut -d':' -f2)

if [ "${SUCCESS}" = "true" ]; then
    echo "[PASS] Student created"
else
    echo "[FAIL] Student creation failed"
    echo "${RESP}"
    exit 1
fi
echo ""

# ============================================================================
# TEST 2 — Create staff (triggers metadata storage)
# ============================================================================

echo "[TEST 2] Creating staff..."
RESP=$(curl -s -X POST "${BASE_URL}/staff" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d '{"staff_id":"STA-INT-001","first_name":"Jane","last_name":"Teacher","hire_date":"2023-09-01","employment_status":"active","dbs_check_status":"clear","department":"Science"}')

SUCCESS=$(echo "${RESP}" | grep -o '"success":[^,]*' | head -1 | cut -d':' -f2)

if [ "${SUCCESS}" = "true" ]; then
    echo "[PASS] Staff created"
else
    echo "[FAIL] Staff creation failed"
    echo "${RESP}"
    exit 1
fi
echo ""

# ============================================================================
# TEST 3 — Create room (triggers metadata storage)
# ============================================================================

echo "[TEST 3] Creating room..."
RESP=$(curl -s -X POST "${BASE_URL}/rooms" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d '{"room_number":"R201","capacity":25,"room_type":"classroom","features":{"whiteboard":true}}')

SUCCESS=$(echo "${RESP}" | grep -o '"success":[^,]*' | head -1 | cut -d':' -f2)

if [ "${SUCCESS}" = "true" ]; then
    echo "[PASS] Room created"
else
    echo "[FAIL] Room creation failed"
    echo "${RESP}"
    exit 1
fi
echo ""

# ============================================================================
# TEST 4 — Create inventory item (triggers metadata storage)
# ============================================================================

echo "[TEST 4] Creating inventory item..."
RESP=$(curl -s -X POST "${BASE_URL}/inventory" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d '{"item_name":"Projector Unit","item_number":"INV-PROJ-001","category":"electronics","quantity":3,"condition":"good"}')

SUCCESS=$(echo "${RESP}" | grep -o '"success":[^,]*' | head -1 | cut -d':' -f2)

if [ "${SUCCESS}" = "true" ]; then
    echo "[PASS] Inventory item created"
else
    echo "[FAIL] Inventory item creation failed"
    echo "${RESP}"
    exit 1
fi
echo ""

# ============================================================================
# TEST 5 — Verify metadata was stored
# ============================================================================

echo "[TEST 5] Verifying metadata storage..."
META_COUNT=$(node -e "
const db = require('/home/tmax/TimSyS_v6/platform/shared/services/db');
const rows = db.query('SELECT entity_type, entity_id, tags, classifications FROM intelligence_metadata ORDER BY entity_type').rows;
console.log(rows.length);
" 2>/dev/null || echo "0")

if [ "${META_COUNT}" -ge 4 ]; then
    echo "[PASS] ${META_COUNT} metadata records stored"
else
    echo "[FAIL] Expected 4+ metadata records, got ${META_COUNT}"
    node -e "
const db = require('/home/tmax/TimSyS_v6/platform/shared/services/db');
const rows = db.query('SELECT * FROM intelligence_metadata').rows;
console.log(JSON.stringify(rows, null, 2));
" 2>/dev/null || echo "(could not query metadata table)"
fi
echo ""

# ============================================================================
# TEST 6 — Call synthesize endpoint
# ============================================================================

echo "[TEST 6] Calling /api/intelligence/synthesize..."
SYNTH_RESP=$(curl -s -X GET "${BASE_URL}/api/intelligence/synthesize" \
    -H "Authorization: Bearer ${TOKEN}")

echo "Response:"
echo "${SYNTH_RESP}" | python3 -m json.tool 2>/dev/null || echo "${SYNTH_RESP}"
echo ""

# ============================================================================
# TEARDOWN
# ============================================================================

echo "[TEARDOWN] Cleaning up..."
kill ${PLATFORM_PID} 2>/dev/null || true
wait ${PLATFORM_PID} 2>/dev/null || true
echo ""
echo "=== Intelligence Engine Smoke Test Complete ==="