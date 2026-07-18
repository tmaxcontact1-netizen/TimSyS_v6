# Architectural Decisions

## Session 2026-07-17

### Token Revocation Strategy
- **Decision:** SQLite table (`token_revocation`)
- **Deferral:** Bloom filter optimization (performance)
- **Trigger:** Scale issues or latency requirements

### Session Duration Policy
- **Current:** JWT TTL 24h, no refresh token, no rotation
- **Decision needed:** Before production deployment with real users
- **Risk:** Security vulnerability if default admin credentials remain unchanged

### Rate Limiting Storage
- **Current:** In-memory Map (resets on restart)
- **Decision needed:** Redis or DB-backed before production
- **Impact:** Multi-instance deployments will have inconsistent rate limits

### CSRF Strategy
- **Current:** Bearer tokens only, header check is preventive
- **Decision needed:** If cookie-based auth added later
- **Note:** Non-blocking for now

# Architectural Decisions

## Session 2026-07-17

### JWT Session Token Inclusion

**Decision:** Include `sessionId` in JWT payload.

**Rationale:** Without session identifier, deterministic JWT signing produces identical tokens for identical user states. When password change triggers session revocation (wildcard `*` for user_id), new login produces same token which is immediately rejected.

**Implementation:**
- `auth.issueToken(user, sessionId)` now accepts sessionId parameter
- JWT payload: `{ userId, permissions, sessionId }`
- `user_management/login` passes `session.sessionId` to `issueToken`

**Trade-offs:**
- JWT size increases negligibly (~36 bytes for UUID)
- Requires session tracking to persist across requests
- Enables proper session invalidation semantics

**Alternative Considered:** Random nonce in JWT payload. Rejected: sessionId already generated for other purposes, provides stronger linkage between token and session store.

**Status:** IMPLEMENTED

### Token Revocation Strategy

**Decision:** SQLite table with wildcard support (`token_revocation`).

**Rationale:** Simple, fits existing DB infrastructure, supports both token-specific and user-wide revocation.

**Deferment:** Bloom filter optimization for large-scale token validation.

**Status:** IMPLEMENTED

### Test Suite Isolation

**Decision:** Per-suite SQLite databases with unique DB_PATH.

**Rationale:** Prevents database locking conflicts and state bleeding between Jest test suites.

**Status:** IMPLEMENTED

**Lesson Learned:** Some bugs only manifest under specific test ordering (cross-suite contamination). Integration tests must be idempotent and handle state left by previous suites.

# Architectural Decisions

## Session 2026-07-18

### Password Change Prompt for New Users

**Decision:** New users created via `createUser` have `must_change_password = 1`. Login detects this flag, includes it in JWT payload and API response. Middleware (`passwordChangeRequired.js`) blocks protected routes until password is changed.

**Whitelisted routes while pending:**
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/users/:id/change-password`

**Status:** IMPLEMENTED

### Wildcard Revocation vs Targeted Revocation in Password Change

**Decision:** Use `destroyUserSessions()` + `revokeToken()` (specific token hash) instead of `forceLogout()` (wildcard `*` revocation) for password changes.

**Rationale:** `forceLogout()` inserts a wildcard `*` record in `token_revocation` for the user. This permanently blocks ALL future tokens for that user, not just existing ones. New tokens issued after the password change are immediately rejected because the wildcard match has no expiry.

**Failed Attempt:** Tried comparing JWT `iat` against `revoked_at` timestamp. Failed because JWT `iat` is in seconds — password change and new login occurred in the same second, making the comparison unreliable.

**Solution:** Don't use wildcard revocation for password changes. Destroy sessions and revoke the specific current token. New sessions/tokens are unaffected.

**Rule:** `forceLogout()` should only be used for permanent lockout scenarios (account deletion, security incident). Password changes require targeted revocation only.

**Status:** IMPLEMENTED


# Architectural Decisions

## Session 2026-07-18 (Session 6)

### Intelligence Service as Shared Platform Service

**Decision:** Implement intelligence (metadata, insights, logic) as a shared service package at `/shared/services/intelligence/` rather than standalone engines in `/engine/`.

**Rationale:** All modules should consume intelligence through the same backend service. Service package (folder) allows metadata, insights, and logic to evolve independently within one service boundary. Consistent with existing service injection pattern — modules declare `"dependencies": ["intelligence"]` and receive `ctx.intelligence` automatically.

**Structure:**
- `index.js` — facade, delegates to sub-modules
- `store.js` — SQLite persistence (3 tables: metadata, insights, rules)
- `metadata.js` — entity tagging and classification
- `insights.js` — synthesis engine
- `logic.js` — rule evaluation engine

**Wiring:**
- `wire.js` imports and injects `intelligence` into module Context
- `resolve.js` adds `intelligence` to `PLATFORM_SERVICES` set so dependency resolution skips it

**Constitution Deviation:** Phases 10-11 specify `/engine/gap-analysis/` and `/engine/recommendation/` as standalone engines. This decision consolidates intelligence capabilities into a shared service instead. Constitution update deferred until gap analysis and recommendation features are actually implemented.

**Status:** IMPLEMENTED (placeholder logic — synthesis and rule evaluation methods return sample data. Real implementation deferred until application modules exist to provide data.)

# Architectural Decisions

## Session 2026-07-18 (Session 7)

### Intelligence Service Implementation

**Decision:** Replaced placeholder methods in metadata.js, insights.js, and logic.js with full implementations.

**metadata.js suggest():**
- Rule-based pattern detection: email domain classification (.edu, .gov), student/teacher/course entity classification, grade level categorization
- Risk indicators: attendance_rate < 0.75, GPA < 2.0 flagged as at_risk/academic_risk
- Confidence scoring: 0.95 (>5 tags), 0.85 (>2 tags), 0.70 (otherwise), 0.50 (no tags)
- Returns: { tags[], classifications[], confidence }

**insights.js synthesize():**
- DB-backed aggregation querying students table for attendance and GPA metrics
- Alert levels: critical (< 0.75 attendance, < 2.0 GPA), warning (< 0.85 attendance)
- Trend tracking: stable/declining (attendance), positive/concerning (GPA)
- Returns: { summary, metrics, trends[], alerts[] }

**logic.js _matchesConditions():**
- Condition evaluation engine supporting 9 operators: ==, !=, <, >, <=, >=, contains, in, not_in, exists
- Dot notation field access via _getFieldValue() (e.g., "profile.email")
- Rule evaluation with priority scoring and action trigger collection
- Returns: { matchedRules[], triggers[], score }

**Intelligence Service Tests:**
- tests/unit/intelligence.test.js — 7 unit tests
- Covers metadata classification, risk detection, condition evaluation, field extraction
- Note: Tests use direct module calls (not Object.create) to ensure prototype methods work correctly

**Status:** IMPLEMENTED

### Recurring Test File Path Bug

**Decision:** Test files under tests/unit/ must use ../../shared (not ../../../shared) for require paths.

**Root Cause:** tests/unit/ is two levels deep from project root, not three. Recurring pattern across sessions.

**Prevention:** Standardize require path depth for test files going forward.
