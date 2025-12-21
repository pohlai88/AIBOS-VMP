-- Migration: VMP Sessions Table (PostgreSQL Session Store)
-- Created: 2025-12-22
-- Description: Creates session table for connect-pg-simple (production session store)
-- Critical: Required for production deployment (replaces MemoryStore)

-- ============================================================================
-- SESSION TABLE (for connect-pg-simple)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
)
WITH (OIDS=FALSE);

-- Primary key
ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;

-- Index for expiration cleanup
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- Comments
COMMENT ON TABLE "session" IS 'Express session store for connect-pg-simple. Stores session data for authenticated users.';
COMMENT ON COLUMN "session"."sid" IS 'Session ID (primary key)';
COMMENT ON COLUMN "session"."sess" IS 'Session data (JSON)';
COMMENT ON COLUMN "session"."expire" IS 'Session expiration timestamp';

-- ============================================================================
-- CLEANUP FUNCTION (Optional - for automatic session cleanup)
-- ============================================================================
-- Note: connect-pg-simple handles cleanup automatically, but you can also
-- run this manually or via cron if needed:
-- DELETE FROM "session" WHERE expire < NOW();

