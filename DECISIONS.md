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
