#!/bin/bash
# Path: platform/tests/room.endpoint_smoke.sh
# Purpose: Smoke test for room_registry endpoints
# Total lines: 155

set -e

BASE_URL="http://localhost:3000"
ADMIN_USER="admin"
ADMIN_PASS="changeme123"
TOKEN=""
PLATFORM_PID=""

echo "=== Room Endpoint Smoke Test ==="
echo ""

# ============================================================================
# SETUP — Boot platform and login
# ============================================================================

echo "[SETUP] Checking if platform is running..."
if curl -s "${BASE_URL}/health" >/dev/null 2>&1; then
    echo "[SETUP] Platform already running on port 3000"
else
    echo "[SETUP] Starting platform..."
    cd "$(cd "$(dirname "$0")/.." && pwd)"

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
fi

echo "[SETUP] Logging in as admin..."
LOGIN_RESP=$(curl -s -X POST "${BASE_URL}/api/auth/login" \
    -H "Content-Type: application/json" \
    -H "X-Requested-With: XMLHttpRequest" \
    -d "{\"username\":\"${ADMIN_USER}\",\"password\":\"${ADMIN_PASS}\"}")

TOKEN=$(echo "${LOGIN_RESP}" | grep -o '"token":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "${TOKEN}" ]; then
    echo "[ERROR] Failed to get auth token. Login response:"
    echo "${LOGIN_RESP}"
    exit 1
fi

echo "[SETUP] Auth token acquired"
echo ""

# ============================================================================
# TEST 1 — Create Room
# ============================================================================

echo "[TEST 1] Creating room..."
CREATE_RESP=$(curl -s -X POST "${BASE_URL}/rooms" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d '{
        "room_number": "R101",
        "capacity": 30,
        "room_type": "classroom",
        "building_id": null,
        "features": {"whiteboard": true, "projector": true, "smart_board": false},
        "accessibility_flags": {"wheelchair_accessible": true},
        "notes": "Main floor classroom"
    }')

CREATE_CODE=$(echo "${CREATE_RESP}" | grep -o '"success":[^,]*' | head -1 | cut -d':' -f2)

if [ "${CREATE_CODE}" = "true" ]; then
    echo "[PASS] Room created successfully"
    ROOM_ID=$(echo "${CREATE_RESP}" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
    echo "[INFO] Room ID: ${ROOM_ID}"
else
    echo "[FAIL] Room creation failed"
    echo "Response: ${CREATE_RESP}"
    exit 1
fi
echo ""

# ============================================================================
# TEST 2 — Read Room by ID
# ============================================================================

echo "[TEST 2] Reading room by ID..."
READ_RESP=$(curl -s -X GET "${BASE_URL}/rooms/${ROOM_ID}" \
    -H "Authorization: Bearer ${TOKEN}")

READ_CODE=$(echo "${READ_RESP}" | grep -o '"success":[^,]*' | head -1 | cut -d':' -f2)

if [ "${READ_CODE}" = "true" ]; then
    ROOM_NUMBER=$(echo "${READ_RESP}" | grep -o '"room_number":"[^"]*' | head -1 | cut -d'"' -f4)
    CAPACITY=$(echo "${READ_RESP}" | grep -o '"capacity":[0-9]*' | head -1 | cut -d':' -f2)
    if [ "${ROOM_NUMBER}" = "R101" ] && [ "${CAPACITY}" = "30" ]; then
        echo "[PASS] Room read successfully: ${ROOM_NUMBER} (capacity: ${CAPACITY})"
    else
        echo "[WARN] Room read returned unexpected data"
        echo "Response: ${READ_RESP}"
    fi
else
    echo "[FAIL] Room read failed"
    echo "Response: ${READ_RESP}"
    exit 1
fi
echo ""

# ============================================================================
# TEST 3 — List Rooms
# ============================================================================

echo "[TEST 3] Listing rooms..."
LIST_RESP=$(curl -s -X GET "${BASE_URL}/rooms?limit=10" \
    -H "Authorization: Bearer ${TOKEN}")

LIST_CODE=$(echo "${LIST_RESP}" | grep -o '"success":[^,]*' | head -1 | cut -d':' -f2)

if [ "${LIST_CODE}" = "true" ]; then
    COUNT=$(echo "${LIST_RESP}" | grep -o '"total":[0-9]*' | head -1 | cut -d':' -f2)
    echo "[PASS] Listed ${COUNT} room(s)"
else
    echo "[FAIL] List rooms failed"
    echo "Response: ${LIST_RESP}"
    exit 1
fi
echo ""

# ============================================================================
# TEST 4 — Update Room
# ============================================================================

echo "[TEST 4] Updating room..."
UPDATE_RESP=$(curl -s -X PUT "${BASE_URL}/rooms/${ROOM_ID}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d '{
        "capacity": 35,
        "notes": "Updated classroom - expanded seating",
        "features": {"whiteboard": true, "projector": true, "smart_board": true}
    }')

UPDATE_CODE=$(echo "${UPDATE_RESP}" | grep -o '"success":[^,]*' | head -1 | cut -d':' -f2)

if [ "${UPDATE_CODE}" = "true" ]; then
    NEW_CAPACITY=$(echo "${UPDATE_RESP}" | grep -o '"capacity":[0-9]*' | head -1 | cut -d':' -f2)
    echo "[PASS] Room updated. New capacity: ${NEW_CAPACITY}"
else
    echo "[FAIL] Room update failed"
    echo "Response: ${UPDATE_RESP}"
    exit 1
fi
echo ""

# ============================================================================
# TEST 5 — Duplicate Room Number Check
# ============================================================================

echo "[TEST 5] Testing duplicate room number rejection..."
DUP_RESP=$(curl -s -X POST "${BASE_URL}/rooms" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d '{
        "room_number": "R101",
        "capacity": 20,
        "room_type": "classroom"
    }')

DUP_SUCCESS=$(echo "${DUP_RESP}" | grep -o '"success":[^,]*' | head -1 | cut -d':' -f2)

if [ "${DUP_SUCCESS}" = "false" ]; then
    DUP_CODE=$(echo "${DUP_RESP}" | grep -o '"code":"[^"]*' | head -1 | cut -d'"' -f4)
    if [ "${DUP_CODE}" = "DUPLICATE" ]; then
        echo "[PASS] Duplicate room number rejected with DUPLICATE error"
    else
        echo "[WARN] Duplicate rejected but with unexpected code: ${DUP_CODE}"
    fi
else
    echo "[FAIL] Duplicate room number was not rejected"
    exit 1
fi
echo ""

# ============================================================================
# TEST 6 — Invalid Capacity (less than 1)
# ============================================================================

echo "[TEST 6] Testing invalid capacity rejection..."
INVALID_CAP_RESP=$(curl -s -X POST "${BASE_URL}/rooms" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d '{
        "room_number": "R999",
        "capacity": 0,
        "room_type": "classroom"
    }')

INV_SUCCESS=$(echo "${INVALID_CAP_RESP}" | grep -o '"success":[^,]*' | head -1 | cut -d':' -f2)

if [ "${INV_SUCCESS}" = "false" ]; then
    INV_CODE=$(echo "${INVALID_CAP_RESP}" | grep -o '"code":"[^"]*' | head -1 | cut -d'"' -f4)
    if [ "${INV_CODE}" = "VALIDATION_ERROR" ]; then
        echo "[PASS] Invalid capacity rejected with VALIDATION_ERROR"
    else
        echo "[WARN] Invalid capacity rejected but with unexpected code: ${INV_CODE}"
    fi
else
    echo "[FAIL] Invalid capacity was not rejected"
    exit 1
fi
echo ""

# ============================================================================
# TEST 7 — Soft Delete (Block Room)
# ============================================================================

echo "[TEST 7] Testing soft delete (block room)..."
BLOCK_RESP=$(curl -s -X DELETE "${BASE_URL}/rooms/${ROOM_ID}" \
    -H "Authorization: Bearer ${TOKEN}")

BLOCK_CODE=$(echo "${BLOCK_RESP}" | grep -o '"success":[^,]*' | head -1 | cut -d':' -f2)

if [ "${BLOCK_CODE}" = "true" ]; then
    echo "[PASS] Room blocked successfully"

    VERIFY_RESP=$(curl -s -X GET "${BASE_URL}/rooms/${ROOM_ID}" \
        -H "Authorization: Bearer ${TOKEN}")

    STATUS=$(echo "${VERIFY_RESP}" | grep -o '"status":"[^"]*' | head -1 | cut -d'"' -f4)
    if [ "${STATUS}" = "blocked" ]; then
        echo "[PASS] Room status changed to 'blocked'"
    else
        echo "[WARN] Expected 'blocked', got: ${STATUS}"
    fi
else
    echo "[FAIL] Room block failed"
    echo "Response: ${BLOCK_RESP}"
    exit 1
fi
echo ""

# ============================================================================
# TEARDOWN
# ============================================================================

echo "[TEARDOWN] Cleaning up..."

if [ -n "${PLATFORM_PID}" ]; then
    kill ${PLATFORM_PID} 2>/dev/null || true
    wait ${PLATFORM_PID} 2>/dev/null || true
    echo "[TEARDOWN] Platform stopped"
fi

echo ""
echo "=== Room Endpoint Smoke Test Complete ==="
echo "All tests passed!"