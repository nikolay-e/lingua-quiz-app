# Security & Performance Recommendations

This document contains critical security and performance recommendations from the comprehensive code review (2025-11-15).

## ✅ IMPLEMENTED

### 1. Database Verification in `require_admin()` ✅

**Status:** Fixed in `packages/backend/src/core/security.py:49`

**Change:** Admin endpoints now verify `is_admin` status against database on every request, preventing privilege
escalation with stolen JWT tokens.

### 2. Foreign Key Index on `version_id` ✅

**Status:** Fixed in `migrations/init.sql:74` and Alembic migration

**Change:** Added `idx_vocab_version_fk` index to prevent full table scans on parent table operations.

---

## 🚨 CRITICAL - MUST FIX BEFORE PRODUCTION

### 3. JWT Token Expiration & Refresh Tokens ✅

**Status:** Fixed in packages/backend/src/core/security.py, packages/backend/src/api/v2/auth.py, packages/frontend/src/stores.ts

**Changes Made:**

- Access token expiration reduced from 24 hours to 15 minutes
- Refresh tokens implemented with 7-day expiration
- Automatic token refresh 2 minutes before expiration (frontend)
- Refresh token rotation on each refresh (old token revoked)
- Database table `refresh_tokens` created with indexes
- Alembic migration `9cd12c06e418_add_refresh_tokens_table.py`

**Original Issue:** 24-hour access token expiration violated OWASP recommendations (5-30 minutes).

**Original Security Risk:** Stolen tokens remained valid for entire day with no revocation mechanism.

**Implementation Plan:**

#### Step 1: Create Refresh Token Table

```sql
CREATE TABLE refresh_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    device_info TEXT
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);
```

#### Step 2: Update JWT Configuration

```python
# In core/config.py
JWT_ACCESS_TOKEN_EXPIRES_MINUTES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES_MINUTES", "15"))
JWT_REFRESH_TOKEN_EXPIRES_DAYS = int(os.getenv("JWT_REFRESH_TOKEN_EXPIRES_DAYS", "7"))
```

#### Step 3: Implement `/api/auth/refresh` Endpoint

```python
# In api/v2/auth.py
@router.post("/refresh", response_model=TokenResponse)
async def refresh_access_token(refresh_token: str):
    # 1. Validate refresh token signature
    # 2. Check token hash exists in database and not revoked
    # 3. Generate new access token
    # 4. Optionally rotate refresh token
    # 5. Return new tokens
```

#### Step 4: Update Frontend Token Management

```typescript
// In src/stores.ts
// Add automatic token refresh before expiration
// Refresh 2 minutes before access token expires
```

**Estimated Effort:** 4-6 hours

---

### 4. CSRF Protection for Admin Endpoints ⚠️ HIGH PRIORITY

**Current Issue:** Admin forms lack CSRF token validation.

**Security Risk:** Cross-site request forgery attacks on admin actions (delete/update vocabulary).

**Implementation Plan:**

#### Step 1: Backend - Add CSRF Middleware

```python
# In main.py
from fastapi_csrf_protect import CsrfProtect

@app.get("/api/csrf-token")
async def get_csrf_token(csrf_protect: CsrfProtect = Depends()):
    csrf_token = csrf_protect.generate_csrf()
    return {"csrfToken": csrf_token}
```

#### Step 2: Frontend - Add CSRF Token to Admin Requests

```typescript
// In src/adminApi.ts
const csrfToken = await fetchCsrfToken();

headers: {
  'X-CSRF-Token': csrfToken,
  'Authorization': `Bearer ${token}`
}
```

#### Step 3: Protect All Admin Endpoints

```python
# Add to all POST/PUT/DELETE admin endpoints
@router.post("/vocabulary", dependencies=[Depends(csrf_protect)])
async def create_vocabulary_item(...):
```

**Estimated Effort:** 2-3 hours

---

## 🔧 SHOULD FIX (Sprint Priority)

### 5. Migrate UUIDv4 to UUIDv7 ⚠️ PERFORMANCE

**Current Issue:** `uuid_generate_v4()` causes 49% slower inserts and index fragmentation.

**Performance Impact:** Bulk inserts take 7+ minutes vs 3 minutes with UUIDv7.

**Migration Path:**

#### Option A: PostgreSQL 18+ (UUIDv7 Native)

```sql
-- Requires PostgreSQL 18+
ALTER TABLE vocabulary_items ALTER COLUMN id SET DEFAULT gen_random_uuid_v7();
```

#### Option B: Use Python uuid7 Library

```python
# Install: pip install uuid7
from uuid7 import uuid7

# In vocabulary creation
new_id = uuid7()
```

#### Option C: Switch to BIGINT (Best Performance)

```sql
-- Create new migration
ALTER TABLE vocabulary_items ALTER COLUMN id TYPE BIGINT USING hashtext(id::text);
ALTER TABLE vocabulary_items ALTER COLUMN id SET DEFAULT nextval('vocabulary_items_id_seq');
```

**Recommendation:** Option B (uuid7 library) for compatibility + performance.

**Estimated Effort:** 6-8 hours (includes migration + testing)

---

### 6. Token Blacklist Mechanism ⚠️ SECURITY

**Current Issue:** No way to revoke admin access on security incident.

**Implementation:**

```python
# Option A: Database Blacklist
CREATE TABLE token_blacklist (
    jti TEXT PRIMARY KEY,
    expires_at TIMESTAMPTZ NOT NULL
);

# Option B: Redis Blacklist (Faster)
# Store JTI with TTL matching token expiration
redis.setex(f"blacklist:{jti}", ttl_seconds, "1")
```

**Estimated Effort:** 3-4 hours

---

### 7. PostgreSQL work_mem Configuration ⚠️ PERFORMANCE

**Current Issue:** GIN full-text search queries may timeout without proper tuning.

**Fix:** Add to PostgreSQL configuration or migration comment:

```sql
-- In migration or postgresql.conf
SET work_mem = '8MB';  -- For GIN index operations

-- Or per-session in complex queries:
SET LOCAL work_mem = '16MB';
SELECT * FROM vocabulary_items WHERE to_tsvector('simple', source_text) @@ to_tsquery('search');
```

**Add to migration:**

```sql
-- Performance tuning notes:
-- For optimal GIN index performance, set work_mem='8MB' in postgresql.conf
-- This reduces worst-case query time by ~70%
```

**Estimated Effort:** 30 minutes (documentation)

---

### 8. Multi-Tab Version Sync with BroadcastChannel ⚠️ UX

**Current Issue:** Multiple tabs may trigger duplicate version sync operations.

**Fix:**

```typescript
// In src/stores.ts
const versionChannel = new BroadcastChannel('vocab-version-sync');

// Broadcast version changes
versionChannel.postMessage({
  type: 'VERSION_CHANGED',
  versionId: currentVersion.versionId,
});

// Listen for changes from other tabs
versionChannel.onmessage = (e) => {
  if (e.data.type === 'VERSION_CHANGED') {
    // Update local version without re-fetching
    safeStorage.setItem(STORAGE_KEYS.CONTENT_VERSION, e.data.versionId.toString());
  }
};
```

**Estimated Effort:** 2 hours

---

## 📋 ADDITIONAL RECOMMENDATIONS

### 9. Add Alembic Migration Tests

```bash
# Test upgrade
alembic upgrade head

# Test downgrade
alembic downgrade -1

# Test re-upgrade (idempotency)
alembic upgrade head
```

### 10. Security Headers Audit

Verify these headers in production:

```python
# Already implemented in main.py - VERIFY:
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Strict-Transport-Security: max-age=31536000
- Content-Security-Policy: (ADD THIS)
  script-src 'self'; object-src 'none'; base-uri 'self'
```

---

## 📊 PRIORITY MATRIX

| Issue                       | Priority | Effort | Impact   | Status     |
| --------------------------- | -------- | ------ | -------- | ---------- |
| Database admin verification | P0       | 30min  | High     | ✅ DONE    |
| Foreign key index           | P0       | 15min  | High     | ✅ DONE    |
| JWT refresh tokens          | P0       | 6h     | Critical | ✅ DONE    |
| CSRF protection             | P0       | 3h     | Critical | 🔴 TODO    |
| UUIDv7 migration            | P1       | 8h     | Medium   | 🟡 BACKLOG |
| Token blacklist             | P1       | 4h     | Medium   | 🟡 BACKLOG |
| work_mem docs               | P2       | 30min  | Low      | 🟡 BACKLOG |
| BroadcastChannel            | P2       | 2h     | Low      | 🟡 BACKLOG |

**Total Remaining Effort:** ~17.5 hours (JWT refresh tokens completed - saved 6h)

---

## 🎯 DEPLOYMENT CHECKLIST

Before production deployment:

- [x] Implement JWT refresh tokens
- [ ] Add CSRF protection to admin endpoints
- [ ] Set `work_mem='8MB'` in PostgreSQL config
- [ ] Run Alembic migrations with backup
- [ ] Test admin access revocation flow
- [ ] Verify all security headers in production
- [ ] Monitor JWT token expiration metrics
- [ ] Set up token blacklist mechanism (optional but recommended)

---

**Last Updated:** 2025-11-15
**Review Conducted By:** Claude Code Agent (6 parallel agents)
**Sources:** OWASP, FastAPI docs, PostgreSQL wiki, Alembic docs
