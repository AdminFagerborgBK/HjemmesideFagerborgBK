CREATE TABLE public.instagram_feed_cache (
 account text PRIMARY KEY DEFAULT 'fagerborg_bk',
 posts jsonb NOT NULL DEFAULT '[]'::jsonb,
 page_token text,
 instagram_id text,
 status text NOT NULL DEFAULT 'not_checked',
 last_error text,
 last_success_at timestamptz,
 last_attempt_at timestamptz,
 expires_at timestamptz NOT NULL DEFAULT '-infinity',
 next_retry_at timestamptz NOT NULL DEFAULT '-infinity',
 failure_count integer NOT NULL DEFAULT 0,
 lease_id uuid,
 lease_until timestamptz NOT NULL DEFAULT '-infinity'
);
GRANT ALL ON public.instagram_feed_cache TO service_role;
REVOKE ALL ON public.instagram_feed_cache FROM anon, authenticated;
ALTER TABLE public.instagram_feed_cache ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.instagram_feed_cache IS 'Server-only Instagram credentials and last good feed. Access only through instagram-feed function.';
CREATE TABLE public.instagram_feed_oauth_states (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 redirect_uri text NOT NULL,
 expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes')
);
GRANT ALL ON public.instagram_feed_oauth_states TO service_role;
REVOKE ALL ON public.instagram_feed_oauth_states FROM anon, authenticated;
ALTER TABLE public.instagram_feed_oauth_states ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.claim_instagram_feed_refresh(p_account text, p_lease_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE claimed boolean;
BEGIN
 INSERT INTO public.instagram_feed_cache(account) VALUES (p_account) ON CONFLICT DO NOTHING;
 UPDATE public.instagram_feed_cache SET lease_id = p_lease_id, lease_until = now() + interval '90 seconds', last_attempt_at = now()
 WHERE account = p_account AND expires_at <= now() AND next_retry_at <= now() AND lease_until <= now();
 claimed := FOUND;
 RETURN claimed;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_instagram_feed_refresh(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_instagram_feed_refresh(text, uuid) TO service_role;