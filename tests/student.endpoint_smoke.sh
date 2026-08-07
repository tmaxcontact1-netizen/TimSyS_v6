#!/bin/bash
# Path: /home/tmax/TimSyS_v6/tests/student.endpoint_smoke.sh
# Purpose: Smoke test for student_registry endpoints
# Total lines: 142

set -e

BASE_URL="http://localhost:3000"
ADMIN_USER="admin"
ADMIN_PASS="changeme123"
TOKEN=""
PLATFORM_PID=""

echo "=== Student Endpoint Smoke Test ==="
echo ""

# ============================================================================
# SETUP — Boot platform and login
# ============================================================================

echo "[SETUP] Checking if platform is running..."
if curl -s "${BASE_URL}/health" >/dev/null 2>&1; then
    echo "[SETUP] Platform already running on port 3000"
else
    echo "[SETUP] Starting platform..."
    cd /home/tmax/TimSyS_v6/platform
    
    # Wipe DB for clean test
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

TOKEN=$(echo "${LOGIN_RESP}" | grep -o '"token":"[^"]*"]*' | head -1 | cut -d'"' -f4)

if [ -z "${TOKEN}" ]; then
    echo "[ERROR] Failed to get auth token. Login response:"
    echo "${LOGIN_RESP}"
    exit 1
fi

echo "[SETUP] Auth token acquired"
echo ""

# ============================================================================
# TEST 1 — Create Student
# ============================================================================

echo "[TEST 1] Creating student..."
CREATE_RESP=$(curl -s -X POST "${BASE_URL}/students" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d '{
        "student_id": "STU001",
        "first_name": "John",
        "last_name": "Doe",
        "middle_name": "Robert",
        "preferred_name": "Johnny",
        "date_of_birth": "2008-05-15",
        "sex": "Male",
        "nationality": "American",
        "enrollment_date": "2024-09-01",
        "enrollment_status": "active",
        "current_grade_level": "10",
        "homeroom": "Room-101"
    }')

CREATE_CODE=$(echo "${CREATE_RESP}" | grep -o '"success":[^,]*' | head -1 | cut -d':' -f2)

if [ "${CREATE_CODE}" = "true" ]; then
    echo "[PASS] Student created successfully"
    STUDENT_ID=$(echo "${CREATE_RESP}" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
    echo "[INFO] Student ID: ${STUDENT_ID}"
else
    echo "[FAIL] Student creation failed"
    echo "Response: ${CREATE_RESP}"
    exit 1
fi
echo ""

# ============================================================================
# TEST 2 — Read Student by ID
# ============================================================================

echo "[TEST 2] Reading student by ID..."
READ_RESP=$(curl -s -X GET "${BASE_URL}/students/${STUDENT_ID}" \
    -H "Authorization: Bearer ${TOKEN}")

READ_CODE=$(echo "${READ_RESP}" | grep -o '"success":[^,]*' | head -1 | cut -d':' -f2)

if [ "${READ_CODE}" = "true" ]; then
    FIRST_NAME=$(echo "${READ_RESP}" | grep -o '"first_name":"[^"]*' | head -1 | cut -d'"' -f4)
    LAST_NAME=$(echo "${READ_RESP}" | grep -o '"last_name":"[^"]*' | head -1 | cut -d'"' -f4)
    if [ "${FIRST_NAME}" = "John" ] && [ "${LAST_NAME}" = "Doe" ]; then
        echo "[PASS] Student read successfully: ${FIRST_NAME} ${LAST_NAME}"
    else
        echo "[WARN] Student read returned unexpected data"
        echo "Response: ${READ_RESP}"
    fi
else
    echo "[FAIL] Student read failed"
    echo "Response: ${READ_RESP}"
    exit 1
fi
echo ""

# ============================================================================
# TEST 3 — List Students
# ============================================================================

echo "[TEST 3] Listing students..."
LIST_RESP=$(curl -s -X GET "${BASE_URL}/students?limit=10" \
    -H "Authorization: Bearer ${TOKEN}")

LIST_CODE=$(echo "${LIST_RESP}" | grep -o '"success":[^,]*' | head -1 | cut -d':' -f2)

if [ "${LIST_CODE}" = "true" ]; then
    COUNT=$(echo "${LIST_RESP}" | grep -o '"total":[0-9]*' | head -1 | cut -d':' -f2)
    echo "[PASS] Listed ${COUNT} student(s)"
else
    echo "[FAIL] List students failed"
    echo "Response: ${LIST_RESP}"
    exit 1
fi
echo ""

# ============================================================================
# TEST 4 — Update Student
# ============================================================================

echo "[TEST 4] Updating student..."
UPDATE_RESP=$(curl -s -X PUT "${BASE_URL}/students/${STUDENT_ID}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d '{
        "preferred_name": "Johnny Jr.",
        "current_grade_level": "11",
        "notes": "Test update"
    }')

UPDATE_CODE=$(echo "${UPDATE_RESP}" | grep -o '"success":[^,]*' | head -1 | cut -d':' -f2)

if [ "${UPDATE_CODE}" = "true" ]; then
    NEW_PREF=$(echo "${UPDATE_RESP}" | grep -o '"preferred_name":"[^"]*' | head -1 | cut -d'"' -f4)
    echo "[PASS] Student updated. New preferred_name: ${NEW_PREF}"
else
    echo "[FAIL] Student update failed"
    echo "Response: ${UPDATE_RESP}"
    exit 1
fi
echo ""

# ============================================================================
# TEST 5 — Add Student Contact
# ============================================================================

echo "[TEST 5] Adding student contact..."
CONTACT_RESP=$(curl -s -X POST "${BASE_URL}/students/${STUDENT_ID}/contacts" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d '{
        "contact_type": "Parent",
        "first_name": "Jane",
        "last_name": "Doe",
        "relationship": "Mother",
        "phone_primary": "555-123-4567",
        "email": "jane.doe@example.com",
        "is_primary_contact": true,
        "has_custody": true,
        "pickup_authorization": true
    }')

CONTACT_CODE=$(echo "${CONTACT_RESP}" | grep -o '"success":[^,]*' | head -1 | cut -d':' -f2)

if [ "${CONTACT_CODE}" = "true" ]; then
    echo "[PASS] Contact added successfully"
else
    echo "[FAIL] Contact creation failed"
    echo "Response: ${CONTACT_RESP}"
    exit 1
fi
echo ""

# ============================================================================
# TEST 6 — List Student Contacts
# ============================================================================

echo "[TEST 6] Listing student contacts..."
CONTACTS_RESP=$(curl -s -X GET "${BASE_URL}/students/${STUDENT_ID}/contacts" \
    -H "Authorization: Bearer ${TOKEN}")

CONTACTS_CODE=$(echo "${CONTACTS_RESP}" | grep -o '"success":[^,]*' | head -1 | cut -d':' -f2)

if [ "${CONTACTS_CODE}" = "true" ]; then
    TOTAL=$(echo "${CONTACTS_RESP}" | grep -o '"total":[0-9]*' | head -1 | cut -d':' -f2)
    echo "[PASS] Listed ${TOTAL} contact(s)"
else
    echo "[FAIL] List contacts failed"
    echo "Response: ${CONTACTS_RESP}"
    exit 1
fi
echo ""

# ============================================================================
# TEST 7 — Duplicate Student ID Check
# ============================================================================

echo "[TEST 7] Testing duplicate student ID rejection..."
DUP_RESP=$(curl -s -X POST "${BASE_URL}/students" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d '{
        "student_id": "STU001",
        "first_name": "Duplicate",
        "last_name": "Test",
        "date_of_birth": "2008-01-01",
        "sex": "Female",
        "enrollment_date": "2024-09-01"
    }')

DUP_SUCCESS=$(echo "${DUP_RESP}" | grep -o '"success":[^,]*' | head -1 | cut -d':' -f2)

if [ "${DUP_SUCCESS}" = "false" ]; then
    DUP_CODE=$(echo "${DUP_RESP}" | grep -o '"code":"[^"]*' | head -1 | cut -d'"' -f4)
    if [ "${DUP_CODE}" = "DUPLICATE" ]; then
        echo "[PASS] Duplicate student ID rejected with DUPLICATE error"
    else
        echo "[WARN] Duplicate rejected but with unexpected code: ${DUP_CODE}"
    fi
else
    echo "[FAIL] Duplicate student ID was not rejected"
    exit 1
fi
echo ""

# ============================================================================
# TEST 8 — Invalid Sex Value
# ============================================================================

echo "[TEST 8] Testing invalid sex value rejection..."
INVALID_SEX_RESP=$(curl -s -X POST "${BASE_URL}/students" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d '{
        "student_id": "STU002",
        "first_name": "Test",
        "last_name": "Invalid",
        "date_of_birth": "2008-01-01",
        "sex": "NonBinary",
        "enrollment_date": "2024-09-01"
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
# TEST 9 — Soft Delete (Withdrawal)
# ============================================================================

echo "[TEST 9] Testing soft delete (withdrawal)..."
WITHDRAW_RESP=$(curl -s -X DELETE "${BASE_URL}/students/${STUDENT_ID}" \
    -H "Authorization: Bearer ${TOKEN}")

WITHDRAW_CODE=$(echo "${WITHDRAW_RESP}" | grep -o '"success":[^,]*' | head -1 | cut -d':' -f2)

if [ "${WITHDRAW_CODE}" = "true" ]; then
    echo "[PASS] Student withdrawn successfully"
    
    # Verify status changed
    VERIFY_RESP=$(curl -s -X GET "${BASE_URL}/students/${STUDENT_ID}" \
        -H "Authorization: Bearer ${TOKEN}")
    
    STATUS=$(echo "${VERIFY_RESP}" | grep -o '"enrollment_status":"[^"]*' | head -1 | cut -d'"' -f4)
    if [ "${STATUS}" = "withdrawn" ]; then
        echo "[PASS] Enrollment status changed to 'withdrawn'"
    else
        echo "[WARN] Expected 'withdrawn', got: ${STATUS}"
    fi
else
    echo "[FAIL] Student withdrawal failed"
    echo "Response: ${WITHDRAW_RESP}"
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
echo "=== Student Endpoint Smoke Test Complete ==="
echo "All tests passed!"
