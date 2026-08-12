#!/bin/bash
# Path: platform/tests/inventory.endpoint_smoke.sh
# Purpose: Smoke test for inventory endpoints
# Total lines: 155

set -e

BASE_URL="http://localhost:3000"
ADMIN_USER="admin"
ADMIN_PASS="changeme123"
TOKEN=""
PLATFORM_PID=""

echo "=== Inventory Endpoint Smoke Test ==="
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
# TEST 1 — Create Inventory Item
# ============================================================================

echo "[TEST 1] Creating inventory item..."
CREATE_RESP=$(curl -s -X POST "${BASE_URL}/inventory" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d '{
        "item_name": "MacBook Pro 14-inch",
        "item_number": "INV-LAPTOP-001",
        "category": "electronics",
        "quantity": 5,
        "unit": "each",
        "location": "IT Storage Room",
        "condition": "excellent",
        "purchase_date": "2024-08-01",
        "supplier": "Apple Education",
        "purchase_price": 1899.00,
        "warranty_expiry": "2027-08-01",
        "serial_number": "C02XX1234",
        "manufacturer": "Apple",
        "model_number": "Z178-001",
        "status": "available",
        "maintenance_schedule": {"frequency": "annual", "next_date": "2025-08-01"},
        "maintenance_history": []
    }')

CREATE_CODE=$(echo "${CREATE_RESP}" | grep -o '"success":[^,]*' | head -1 | cut -d':' -f2)

if [ "${CREATE_CODE}" = "true" ]; then
    echo "[PASS] Inventory item created successfully"
    ITEM_ID=$(echo "${CREATE_RESP}" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
    echo "[INFO] Item ID: ${ITEM_ID}"
else
    echo "[FAIL] Item creation failed"
    echo "Response: ${CREATE_RESP}"
    exit 1
fi
echo ""

# ============================================================================
# TEST 2 — Read Item by ID
# ============================================================================

echo "[TEST 2] Reading item by ID..."
READ_RESP=$(curl -s -X GET "${BASE_URL}/inventory/${ITEM_ID}" \
    -H "Authorization: Bearer ${TOKEN}")

READ_CODE=$(echo "${READ_RESP}" | grep -o '"success":[^,]*' | head -1 | cut -d':' -f2)

if [ "${READ_CODE}" = "true" ]; then
    ITEM_NAME=$(echo "${READ_RESP}" | grep -o '"item_name":"[^"]*' | head -1 | cut -d'"' -f4)
    QUANTITY=$(echo "${READ_RESP}" | grep -o '"quantity":[0-9]*' | head -1 | cut -d':' -f2)
    if [ "${ITEM_NAME}" = "MacBook Pro 14-inch" ] && [ "${QUANTITY}" = "5" ]; then
        echo "[PASS] Item read successfully: ${ITEM_NAME} (qty: ${QUANTITY})"
    else
        echo "[WARN] Item read returned unexpected data"
        echo "Response: ${READ_RESP}"
    fi
else
    echo "[FAIL] Item read failed"
    echo "Response: ${READ_RESP}"
    exit 1
fi
echo ""

# ============================================================================
# TEST 3 — List Items
# ============================================================================

echo "[TEST 3] Listing items..."
LIST_RESP=$(curl -s -X GET "${BASE_URL}/inventory?limit=10" \
    -H "Authorization: Bearer ${TOKEN}")

LIST_CODE=$(echo "${LIST_RESP}" | grep -o '"success":[^,]*' | head -1 | cut -d':' -f2)

if [ "${LIST_CODE}" = "true" ]; then
    COUNT=$(echo "${LIST_RESP}" | grep -o '"total":[0-9]*' | head -1 | cut -d':' -f2)
    echo "[PASS] Listed ${COUNT} item(s)"
else
    echo "[FAIL] List items failed"
    echo "Response: ${LIST_RESP}"
    exit 1
fi
echo ""

# ============================================================================
# TEST 4 — Update Item
# ============================================================================

echo "[TEST 4] Updating item..."
UPDATE_RESP=$(curl -s -X PUT "${BASE_URL}/inventory/${ITEM_ID}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d '{
        "quantity": 3,
        "condition": "good",
        "notes": "2 units sent for repair",
        "maintenance_schedule": {"frequency": "bi-annual", "next_date": "2025-02-01"},
        "maintenance_history": [{"date": "2024-11-01", "action": "screen replacement", "cost": 250}]
    }')

UPDATE_CODE=$(echo "${UPDATE_RESP}" | grep -o '"success":[^,]*' | head -1 | cut -d':' -f2)

if [ "${UPDATE_CODE}" = "true" ]; then
    NEW_QTY=$(echo "${UPDATE_RESP}" | grep -o '"quantity":[0-9]*' | head -1 | cut -d':' -f2)
    echo "[PASS] Item updated. New quantity: ${NEW_QTY}"
else
    echo "[FAIL] Item update failed"
    echo "Response: ${UPDATE_RESP}"
    exit 1
fi
echo ""

# ============================================================================
# TEST 5 — Duplicate Item Number Check
# ============================================================================

echo "[TEST 5] Testing duplicate item number rejection..."
DUP_RESP=$(curl -s -X POST "${BASE_URL}/inventory" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d '{
        "item_name": "Duplicate Item",
        "item_number": "INV-LAPTOP-001",
        "category": "electronics"
    }')

DUP_SUCCESS=$(echo "${DUP_RESP}" | grep -o '"success":[^,]*' | head -1 | cut -d':' -f2)

if [ "${DUP_SUCCESS}" = "false" ]; then
    DUP_CODE=$(echo "${DUP_RESP}" | grep -o '"code":"[^"]*' | head -1 | cut -d'"' -f4)
    if [ "${DUP_CODE}" = "DUPLICATE" ]; then
        echo "[PASS] Duplicate item number rejected with DUPLICATE error"
    else
        echo "[WARN] Duplicate rejected but with unexpected code: ${DUP_CODE}"
    fi
else
    echo "[FAIL] Duplicate item number was not rejected"
    exit 1
fi
echo ""

# ============================================================================
# TEST 6 — Invalid Quantity (negative)
# ============================================================================

echo "[TEST 6] Testing negative quantity rejection..."
INVALID_QTY_RESP=$(curl -s -X POST "${BASE_URL}/inventory" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d '{
        "item_name": "Bad Quantity Item",
        "item_number": "INV-BADQTY-001",
        "quantity": -5,
        "category": "supplies"
    }')

INV_SUCCESS=$(echo "${INVALID_QTY_RESP}" | grep -o '"success":[^,]*' | head -1 | cut -d':' -f2)

if [ "${INV_SUCCESS}" = "false" ]; then
    INV_CODE=$(echo "${INVALID_QTY_RESP}" | grep -o '"code":"[^"]*' | head -1 | cut -d'"' -f4)
    if [ "${INV_CODE}" = "VALIDATION_ERROR" ]; then
        echo "[PASS] Negative quantity rejected with VALIDATION_ERROR"
    else
        echo "[WARN] Negative quantity rejected but with unexpected code: ${INV_CODE}"
    fi
else
    echo "[FAIL] Negative quantity was not rejected"
    exit 1
fi
echo ""

# ============================================================================
# TEST 7 — Soft Delete (Retire Item)
# ============================================================================

echo "[TEST 7] Testing soft delete (retire item)..."
RETIRE_RESP=$(curl -s -X DELETE "${BASE_URL}/inventory/${ITEM_ID}" \
    -H "Authorization: Bearer ${TOKEN}")

RETIRE_CODE=$(echo "${RETIRE_RESP}" | grep -o '"success":[^,]*' | head -1 | cut -d':' -f2)

if [ "${RETIRE_CODE}" = "true" ]; then
    echo "[PASS] Item retired successfully"

    VERIFY_RESP=$(curl -s -X GET "${BASE_URL}/inventory/${ITEM_ID}" \
        -H "Authorization: Bearer ${TOKEN}")

    STATUS=$(echo "${VERIFY_RESP}" | grep -o '"status":"[^"]*' | head -1 | cut -d'"' -f4)
    if [ "${STATUS}" = "retired" ]; then
        echo "[PASS] Item status changed to 'retired'"
    else
        echo "[WARN] Expected 'retired', got: ${STATUS}"
    fi
else
    echo "[FAIL] Item retirement failed"
    echo "Response: ${RETIRE_RESP}"
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
echo "=== Inventory Endpoint Smoke Test Complete ==="
echo "All tests passed!"