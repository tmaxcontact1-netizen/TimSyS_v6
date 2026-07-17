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