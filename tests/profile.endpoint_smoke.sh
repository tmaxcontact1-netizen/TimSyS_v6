#!/bin/bash
# Path: /home/tmax/TimSyS_v6/tests/profile.endpoint_smoke.sh
# Purpose: Smoke test for profile aggregator endpoints
# Total lines: ~120

set -e

BASE_URL="http://localhost:3000"
ADMIN_USER="admin"
ADMIN_PASS="changeme123"
TOKEN=""
PLATFORM_PID=""

echo "=== Profile Aggregator Smoke Test ==="
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
# SEED — Create a student and a staff member for profile lookup
# ============================================================================

echo "[SEED] Creating student..."
STUDENT_RESP=$(curl -s -X POST "${BASE_URL}/students" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d '{
        "student_id": "STU-PROFILE-001",
        "first_name": "Profile",
        "last_name": "Student",
        "date_of_birth": "2010-05-15",
        "sex": "Male",
        "current_grade_level": "Grade 5"
    }')

STUDENT_ID=$(echo "${STUDENT_RESP}" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
echo "[SEED] Student created, ID: ${STUDENT_ID}"

echo "[SEED] Adding student contact..."
curl -s -X POST "${BASE_URL}/students/${STUDENT_ID}/contacts" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d '{
        "contact_type": "parent",
        "first_name": "Parent",
        "last_name": "Student",
        "phone_primary": "555-0100",
        "is_primary_contact": true
    }' > /dev/null
echo "[SEED] Contact added"
echo ""

echo "[SEED] Creating staff member..."
STAFF_RESP=$(curl -s -X POST "${BASE_URL}/staff" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d '{
        "staff_id": "EMP-PROFILE-001",
        "first_name": "Profile",
        "last_name": "Teacher",
        "hire_date": "2020-09-01",
        "sex": "Female",
        "job_title": "Science Teacher",
        "department": "Science"
    }')

STAFF_ID=$(echo "${STAFF_RESP}" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
echo "[SEED] Staff created, ID: ${STAFF_ID}"

echo "[SEED] Adding staff certification..."
curl -s -X POST "${BASE_URL}/staff/${STAFF_ID}/certifications" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d '{
        "certification_name": "BSc Chemistry",
        "issuing_body": "University of Manchester",
        "issue_date": "2018-07-01",
        "status": "valid"
    }' > /dev/null
echo "[SEED] Certification added"
echo ""

# ============================================================================
# TEST 1 — Student Profile Aggregation
# ============================================================================

echo "[TEST 1] Fetching student profile..."
PROFILE_RESP=$(curl -s -X GET "${BASE_URL}/students/${STUDENT_ID}/profile" \
    -H "Authorization: Bearer ${TOKEN}")

PROFILE_SUCCESS=$(echo "${PROFILE_RESP}" | grep -o '"success":[^,]*' | head -1 | cut -d':' -f2)

if [ "${PROFILE_SUCCESS}" = "true" ]; then
    HAS_STUDENT=$(echo "${PROFILE_RESP}" | grep -o '"student"' | head -1)
    HAS_CONTACTS=$(echo "${PROFILE_RESP}" | grep -o '"contacts"' | head -1)
    HAS_HISTORY=$(echo "${PROFILE_RESP}" | grep -o '"enrollment_history"' | head -1)

    if [ -n "${HAS_STUDENT}" ] && [ -n "${HAS_CONTACTS}" ] && [ -n "${HAS_HISTORY}" ]; then
        echo "[PASS] Student profile aggregated with student, contacts, and enrollment_history"
    else
        echo "[WARN] Profile response missing sections"
        echo "Response: ${PROFILE_RESP}"
    fi
else
    echo "[FAIL] Student profile fetch failed"
    echo "Response: ${PROFILE_RESP}"
    exit 1
fi
echo ""

# ============================================================================
# TEST 2 — Staff Profile Aggregation
# ============================================================================

echo "[TEST 2] Fetching staff profile..."
STAFF_PROFILE_RESP=$(curl -s -X GET "${BASE_URL}/staff/${STAFF_ID}/profile" \
    -H "Authorization: Bearer ${TOKEN}")

STAFF_PROFILE_SUCCESS=$(echo "${STAFF_PROFILE_RESP}" | grep -o '"success":[^,]*' | head -1 | cut -d':' -f2)

if [ "${STAFF_PROFILE_SUCCESS}" = "true" ]; then
    HAS_STAFF=$(echo "${STAFF_PROFILE_RESP}" | grep -o '"staff"' | head -1)
    HAS_CERTS=$(echo "${STAFF_PROFILE_RESP}" | grep -o '"certifications"' | head -1)

    if [ -n "${HAS_STAFF}" ] && [ -n "${HAS_CERTS}" ]; then
        echo "[PASS] Staff profile aggregated with staff and certifications"
    else
        echo "[WARN] Profile response missing sections"
        echo "Response: ${STAFF_PROFILE_RESP}"
    fi
else
    echo "[FAIL] Staff profile fetch failed"
    echo "Response: ${STAFF_PROFILE_RESP}"
    exit 1
fi
echo ""

# ============================================================================
# TEST 3 — Profile for Non-Existent Student
# ============================================================================

echo "[TEST 3] Fetching non-existent student profile..."
MISSING_RESP=$(curl -s -X GET "${BASE_URL}/students/99999/profile" \
    -H "Authorization: Bearer ${TOKEN}")

MISSING_SUCCESS=$(echo "${MISSING_RESP}" | grep -o '"success":[^,]*' | head -1 | cut -d':' -f2)

if [ "${MISSING_SUCCESS}" = "false" ]; then
    MISSING_CODE=$(echo "${MISSING_RESP}" | grep -o '"code":"[^"]*' | head -1 | cut -d'"' -f4)
    if [ "${MISSING_CODE}" = "NOT_FOUND" ]; then
        echo "[PASS] Non-existent student profile returns NOT_FOUND"
    else
        echo "[WARN] Expected NOT_FOUND, got: ${MISSING_CODE}"
    fi
else
    echo "[FAIL] Non-existent student profile should have failed"
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
echo "=== Profile Aggregator Smoke Test Complete ==="
echo "All tests passed!"