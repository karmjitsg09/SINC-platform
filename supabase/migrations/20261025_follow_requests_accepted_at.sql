-- ============================================================
-- SINC PLATFORM — FOLLOW REQUESTS ACCEPTED_AT AUDIT TIMESTAMP
-- Migration: 20261025_follow_requests_accepted_at.sql
-- ============================================================

-- 1. Add dedicated accepted_at column to public.follow_requests
-- Provides an immutable timestamp specifically recording when a follow request
-- transitioned to 'accepted' status, decoupling acceptance audit from generic row updates.
ALTER TABLE public.follow_requests
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

-- 2. Partial index for fast lookups on accepted requests and freshness checking
CREATE INDEX IF NOT EXISTS idx_follow_requests_accepted_at
  ON public.follow_requests (accepted_at)
  WHERE status = 'accepted';

-- 3. Database trigger: sets NEW.accepted_at := NOW() only when OLD.status <> 'accepted' AND NEW.status = 'accepted';
-- on every other update it keeps OLD.accepted_at (ignoring any client-supplied value).
CREATE OR REPLACE FUNCTION public.set_follow_request_accepted_at()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status <> 'accepted' AND NEW.status = 'accepted' THEN
      NEW.accepted_at := NOW();
    ELSE
      -- On every other update, preserve OLD.accepted_at and ignore client-supplied values
      NEW.accepted_at := OLD.accepted_at;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.status = 'accepted' THEN
      NEW.accepted_at := NOW();
    ELSE
      NEW.accepted_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_follow_request_accepted_at ON public.follow_requests;
CREATE TRIGGER trg_follow_request_accepted_at
  BEFORE INSERT OR UPDATE ON public.follow_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_follow_request_accepted_at();
