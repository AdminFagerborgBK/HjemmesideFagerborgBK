ALTER TABLE public.player_invitations ALTER COLUMN raw_token SET DEFAULT '';
COMMENT ON COLUMN public.player_invitations.raw_token IS 'DEPRECATED: always empty; only SHA-256 token_hash is retained. Existing link hashes remain valid.';
CREATE FUNCTION public.create_hashed_player_invitation(p_application_id uuid,p_actor uuid,p_agreement_id uuid,p_snapshot jsonb,p_token_hash text,p_resend boolean DEFAULT false) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE a public.player_applications; existing_id uuid; invite_id uuid;
BEGIN
 IF p_token_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid invitation hash'; END IF;
 SELECT * INTO a FROM public.player_applications WHERE id=p_application_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND OR a.status<>'approved' THEN RAISE EXCEPTION 'Approved application required'; END IF;
 SELECT id INTO existing_id FROM public.player_invitations WHERE application_id=a.id AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1;
 IF existing_id IS NOT NULL AND NOT p_resend THEN RETURN existing_id; END IF;
 IF a.agreement_confirmed_at IS NOT NULL AND a.agreement_id IS DISTINCT FROM p_agreement_id THEN RAISE EXCEPTION 'Accepted version is immutable'; END IF;
 IF p_resend THEN UPDATE public.player_invitations SET revoked_at=now() WHERE application_id=a.id AND revoked_at IS NULL; END IF;
 INSERT INTO public.player_invitations(application_id,token_hash,raw_token,agreement_id,snapshot,created_by) VALUES(a.id,p_token_hash,'',p_agreement_id,p_snapshot,p_actor) RETURNING id INTO invite_id;
 UPDATE public.player_applications SET agreement_id=p_agreement_id,payment_snapshot=p_snapshot->'payment',updated_at=now() WHERE id=a.id;
 INSERT INTO public.player_onboarding_events(application_id,actor_id,event) VALUES(a.id,p_actor,CASE WHEN p_resend THEN 'invitation_resent' ELSE 'invitation_created' END);
 RETURN invite_id;
END; $$;
REVOKE ALL ON FUNCTION public.create_hashed_player_invitation(uuid,uuid,uuid,jsonb,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_hashed_player_invitation(uuid,uuid,uuid,jsonb,text,boolean) TO service_role;
CREATE OR REPLACE FUNCTION public.create_player_invitation(p_application_id uuid,p_actor uuid,p_agreement_id uuid,p_snapshot jsonb,p_resend boolean DEFAULT false) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$ BEGIN RAISE EXCEPTION 'Legacy plaintext invitation creation retired; use hash-only runtime issuance'; END; $$;
REVOKE ALL ON FUNCTION public.create_player_invitation(uuid,uuid,uuid,jsonb,boolean) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.player_invitations FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.player_invitations TO service_role;