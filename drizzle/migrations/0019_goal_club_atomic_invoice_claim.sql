ALTER TABLE public.goal_club_invoices ADD COLUMN IF NOT EXISTS email_attempt_at timestamptz;
CREATE OR REPLACE FUNCTION public.claim_goal_club_invoice(_id uuid) RETURNS SETOF public.goal_club_invoices LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
 UPDATE public.goal_club_invoices SET email_state='sending',email_attempt_at=now(),email_error=NULL WHERE id=_id AND email_state IN ('pending','failed') RETURNING *;
$$;
REVOKE ALL ON FUNCTION public.claim_goal_club_invoice(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_goal_club_invoice(uuid) TO service_role;
COMMENT ON FUNCTION public.claim_goal_club_invoice(uuid) IS 'Claim once before provider send. Sending/uncertain rows require explicit provider reconciliation, never automatic replay.';