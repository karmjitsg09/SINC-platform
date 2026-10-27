-- ============================================================
-- SINC PLATFORM — DURABLE PUSH NOTIFICATION IDEMPOTENCY SCHEMA
-- Migration: 20261025_push_idempotency_keys.sql
-- ============================================================

-- 1. PUSH IDEMPOTENCY KEYS TABLE
CREATE TABLE IF NOT EXISTS public.push_idempotency_keys (
  key TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('IN_PROGRESS', 'DISPATCHED', 'FAILED')),
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- 2. INDEXES FOR FAST EXPIRATION LOOKUPS & CLEANUP
CREATE INDEX IF NOT EXISTS idx_push_idempotency_expires ON public.push_idempotency_keys (expires_at);
CREATE INDEX IF NOT EXISTS idx_push_idempotency_status ON public.push_idempotency_keys (status);

-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- Strict server-only access: RLS enabled with NO client access policies.
-- Anonymous and Authenticated client roles have zero read or write access.
-- Only the service_role key (which bypasses RLS in Supabase) can access this table.
ALTER TABLE public.push_idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Note: In PostgreSQL, enabling RLS with no policies denies all SELECT, INSERT,
-- UPDATE, and DELETE operations to non-superuser/non-service_role roles.
-- Client browsers connecting with anon or user JWT cannot read or manipulate keys.

-- ============================================================
-- 4. CLEANUP APPROACH FOR EXPIRED ROWS (DOCUMENTED, UNSCHEDULED)
-- ============================================================
-- In production, expired idempotency keys can be cleaned up periodically using:
--
-- Approach A: Supabase pg_cron extension (run hourly):
--   SELECT cron.schedule(
--     'purge-expired-push-idempotency-keys',
--     '0 * * * *',
--     $$DELETE FROM public.push_idempotency_keys WHERE expires_at < NOW()$$
--   );
--
-- Approach B: Scheduled Supabase Edge Function or Cloudflare Worker:
--   DELETE FROM public.push_idempotency_keys WHERE expires_at < NOW();
--
-- Approach C: Application-level opportunistic purge during low-traffic windows.
-- (Note: Per safety constraints, do NOT schedule cron in production during audit).
-- ============================================================

