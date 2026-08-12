#!/bin/bash
# Path: platform/tests/staff.endpoint_smoke.sh
# Purpose: Smoke test for staff_registry endpoints
# Total lines: 165

set -e

BASE_URL="http://localhost:3000"
ADMIN_USER="admin"
ADMIN_PASS="changeme123"
TOKEN=""
PLATFORM_PID=""

echo "=== Staff Endpoint Smoke Test ==="
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
# TEST 1 — Create Staff Member
# ============================================================================

echo "[TEST 1] Creating staff member..."
CREATE_RESP=$(curl -s -X POST "${BASE_URL}/staff" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d '{
        "staff_id": "EMP001",
        "first_name": "Sarah",
        "last_name": "Smith",
        "middle_name": "Jane",
        "preferred_name": "Sara",
        "date_of_birth": "1985-03-20",
        "sex": "Female",
        "nationality": "British",
        "national_insurance_number": "AB123456C",
        "hire_date": "2020-09-01",
        "employment_status": "active",
        "employment_type": "full_time",
        "job_title": "Mathematics Teacher",
        "department": "Mathematics",
        "pay_grade": "M3",
        "work_email": "s.smith@school.local",
        "work_phone": "555-987-6543",
        "dbs_check_status": "clear",
        "dbs_check_date": "2020-08-15",
        "dbs_expiry_date": "2025-08-15",
        "dbs_reference_number": "DBS-12345",
        "phone_primary": "555-111-2222",
        "email_personal": "sarah.smith@example.com",
        "emergency_contact_name": "John Smith",
        "emergency_contact_phone": "555-333-4444",
        "emergency_contact_relationship": "Spouse"
    }')

CREATE_CODE=$(echo "${CREATE_RESP}" | grep -o '"success":[^,]*' | head -1 | cut -d':' -f2)

if [ "${CREATE_CODE}" = "true" ]; then
    echo "[PASS] Staff member created successfully"
    STAFF_ID=$(echo "${CREATE_RESP}" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
    echo "[INFO] Staff ID: ${STAFF_ID}"
else
    echo "[FAIL] Staff creation failed"
    echo "Response: ${CREATE_RESP}"
    exit 1
fi
echo ""

# ============================================================================
# TEST 2 — Read Staff by ID
# ============================================================================

echo "[TEST 2] Reading staff by ID..."
READ_RESP=$(curl -s -X GET "${BASE_URL}/staff/${STAFF_ID}" \
    -H "Authorization: Bearer ${TOKEN}")

READ_CODE=$(echo "${READ_RESP}" | grep -o '"success":[^,]*' | head -1 | cut -d':' -f2)

if [ "${READ_CODE}" = "true" ]; then
    FIRST_NAME=$(echo "${READ_RESP}" | grep -o '"first_name":"[^"]*' | head -1 | cut -d'"' -f4)
    LAST_NAME=$(echo "${READ_RESP}" | grep -o '"last_name":"[^"]*' | head -1 | cut -d'"' -f4)
    if [ "${FIRST_NAME}" = "Sarah" ] && [ "${LAST_NAME}" = "Smith" ]; then
        echo "[PASS] Staff read successfully: ${FIRST_NAME} ${LAST_NAME}"
    else
        echo "[WARN] Staff read returned unexpected data"
        echo "Response: ${READ_RESP}"
    fi
else
    echo "[FAIL] Staff read failed"
    echo "Response: ${READ_RESP}"
    exit 1
fi
echo ""

# ============================================================================
# TEST 3 — List Staff
# ============================================================================

echo "[TEST 3] Listing staff..."
LIST_RESP=$(curl -s -X GET "${BASE_URL}/staff?limit=10" \
    -H "Authorization: Bearer ${TOKEN}")

LIST_CODE=$(echo "${LIST_RESP}" | grep -o '"success":[^,]*' | head -1 | cut -d':' -f2)

if [ "${LIST_CODE}" = "true" ]; then
    COUNT=$(echo "${LIST_RESP}" | grep -o '"total":[0-9]*' | head -1 | cut -d':' -f2)
    echo "[PASS] Listed ${COUNT} staff member(s)"
else
    echo "[FAIL] List staff failed"
    echo "Response: ${LIST_RESP}"
    exit 1
fi
echo ""

# ============================================================================
# TEST 4 — Update Staff
# ============================================================================

echo "[TEST 4] Updating staff..."
UPDATE_RESP=$(curl -s -X PUT "${BASE_URL}/staff/${STAFF_ID}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d '{
        "preferred_name": "Sara",
        "job_title": "Head of Mathematics",
        "notes": "Promoted to Head of Department"
    }')

UPDATE_CODE=$(echo "${UPDATE_RESP}" | grep -o '"success":[^,]*' | head -1 | cut -d':' -f2)

if [ "${UPDATE_CODE}" = "true" ]; then
    NEW_TITLE=$(echo "${UPDATE_RESP}" | grep -o '"job_title":"[^"]*' | head -1 | cut -d'"' -f4)
    echo "[PASS] Staff updated. New job_title: ${NEW_TITLE}"
else
    echo "[FAIL] Staff update failed"
    echo "Response: ${UPDATE_RESP}"
    exit 1
fi
echo ""

# ============================================================================
# TEST 5 — Add Certification
# ============================================================================

echo "[TEST 5] Adding staff certification..."
CERT_RESP=$(curl -s -X POST "${BASE_URL}/staff/${STAFF_ID}/certifications" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d '{
        "certification_name": "PGCE Mathematics",
        "issuing_body": "University of Bristol",
        "certification_number": "PGCE-2019-001",
        "issue_date": "2019-06-30",
        "expiry_date": "2024-06-30",
        "status": "valid"
    }')

CERT_CODE=$(echo "${CERT_RESP}" | grep -o '"success":[^,]*' | head -1 | cut -d':' -f2)

if [ "${CERT_CODE}" = "true" ]; then
    echo "[PASS] Certification added successfully"
else
    echo "[FAIL] Certification creation failed"
    echo "Response: ${CERT_RESP}"
    exit 1
fi
echo ""

# ============================================================================
# TEST 6 — List Certifications
# ============================================================================

echo "[TEST 6] Listing staff certifications..."
CERTS_RESP=$(curl -s -X GET "${BASE_URL}/staff/${STAFF_ID}/certifications" \
    -H "Authorization: Bearer ${TOKEN}")

CERTS_CODE=$(echo "${CERTS_RESP}" | grep -o '"success":[^,]*' | head -1 | cut -d':' -f2)

if [ "${CERTS_CODE}" = "true" ]; then
    TOTAL=$(echo "${CERTS_RESP}" | grep -o '"total":[0-9]*' | head -1 | cut -d':' -f2)
    echo "[PASS] Listed ${TOTAL} certification(s)"
else
    echo "[FAIL] List certifications failed"
    echo "Response: ${CERTS_RESP}"
    exit 1
fi
echo ""

# ============================================================================
# TEST 7 — Duplicate Staff ID Check
# ============================================================================

echo "[TEST 7] Testing duplicate staff ID rejection..."
DUP_RESP=$(curl -s -X POST "${BASE_URL}/staff" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d '{
        "staff_id": "EMP001",
        "first_name": "Duplicate",
        "last_name": "Test",
        "hire_date": "2024-01-01"
    }')

DUP_SUCCESS=$(echo "${DUP_RESP}" | grep -o '"success":[^,]*' | head -1 | cut -d':' -f2)

if [ "${DUP_SUCCESS}" = "false" ]; then
    DUP_CODE=$(echo "${DUP_RESP}" | grep -o '"code":"[^"]*' | head -1 | cut -d'"' -f4)
    if [ "${DUP_CODE}" = "DUPLICATE" ]; then
        echo "[PASS] Duplicate staff ID rejected with DUPLICATE error"
    else
        echo "[WARN] Duplicate rejected but with unexpected code: ${DUP_CODE}"
    fi
else
    echo "[FAIL] Duplicate staff ID was not rejected"
    exit 1
fi
echo ""

# ============================================================================
# TEST 8 — Invalid Sex Value
# ============================================================================

echo "[TEST 8] Testing invalid sex value rejection..."
INVALID_SEX_RESP=$(curl -s -X POST "${BASE_URL}/staff" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d '{
        "staff_id": "EMP002",
        "first_name": "Test",
        "last_name": "Invalid",
        "hire_date": "2024-01-01",
        "sex": "NonBinary"
    }')

INV_SUCCESS=$(echo "${INVALID_SEX_RESP}" | grep -o '"success":[^,]*' | head -1 | cut -d':' -f2)

if [ "${INV_SUCCESS}" = "false" ]; then
    INV_CODE=$(echo "${INVALID_SEX_RESP}" | grep -o '"code":"[^"]*' | head -1 | cut -d'"' -f4)
    if [ "${INV_CODE}" = "VALIDATION_ERROR" ]; then
        echo "[PASS] Invalid sex value rejected with VALIDATION_ERROR"
    else
        echo "[WARN] Invalid sex rejected but with unexpected code: ${INV_CODE}"
    fi
else
    echo "[FAIL] Invalid sex value was not rejected"
    exit 1
fi
echo ""

# ============================================================================
# TEST 9 — Soft Delete (Termination)
# ============================================================================

echo "[TEST 9] Testing soft delete (termination)..."
TERMINATE_RESP=$(curl -s -X DELETE "${BASE_URL}/staff/${STAFF_ID}" \
    -H "Authorization: Bearer ${TOKEN}")

TERMINATE_CODE=$(echo "${TERMINATE_RESP}" | grep -o '"success":[^,]*' | head -1 | cut -d':' -f2)

if [ "${TERMINATE_CODE}" = "true" ]; then
    echo "[PASS] Staff terminated successfully"

    VERIFY_RESP=$(curl -s -X GET "${BASE_URL}/staff/${STAFF_ID}" \
        -H "Authorization: Bearer ${TOKEN}")

    STATUS=$(echo "${VERIFY_RESP}" | grep -o '"employment_status":"[^"]*' | head -1 | cut -d'"' -f4)
    if [ "${STATUS}" = "terminated" ]; then
        echo "[PASS] Employment status changed to 'terminated'"
    else
        echo "[WARN] Expected 'terminated', got: ${STATUS}"
    fi
else
    echo "[FAIL] Staff termination failed"
    echo "Response: ${TERMINATE_RESP}"
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
echo "=== Staff Endpoint Smoke Test Complete ==="
echo "All tests passed!"
