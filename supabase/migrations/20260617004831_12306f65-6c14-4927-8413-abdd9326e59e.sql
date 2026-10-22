-- Fix: Remove broken public policies that exposed sensitive data

-- 1. livestream_otp: drop the policy that mistakenly granted full access to anon/authenticated
DROP POLICY IF EXISTS "Service role can manage OTP codes" ON public.livestream_otp;
-- service_role bypasses RLS automatically; no policy needed.

-- 2. goal_club_entries: drop public SELECT policy that exposed email/phone/name
-- Public consumers should query the goal_club_public view (anonymised, no PII).
DROP POLICY IF EXISTS "Public can view goal club entries" ON public.goal_club_entries;