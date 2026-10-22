CREATE TABLE public.player_enrollment_settings (
 id integer PRIMARY KEY DEFAULT 1 CHECK(id=1),
 season integer NOT NULL DEFAULT 2027,
 groups jsonb NOT NULL DEFAULT '{"A-laget":"https://spond.com/invite/RSPTA","B-laget":"https://spond.com/invite/RSPTA"}',
 transfer_url text NOT NULL DEFAULT 'https://go-printer.scrive.com/go/public/index?hash=3d99b137-e4dd-42e1-b29e-4a2a52d7111d&',
 transfer_contact text NOT NULL DEFAULT 'Ragnar', transfer_email text NOT NULL DEFAULT 'rag-pun@online.no',
 membership_ore integer CHECK(membership_ore>=0), training_ore_a integer CHECK(training_ore_a>=0), training_ore_b integer CHECK(training_ore_b>=0),
 membership_due date, first_training_due date, payment_channel text NOT NULL DEFAULT 'Spond',
 fees_confirmed boolean NOT NULL DEFAULT false, legal_reviewed boolean NOT NULL DEFAULT false,
 current_agreement_id uuid, updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.player_enrollment_settings TO authenticated;
GRANT ALL ON public.player_enrollment_settings TO service_role;
ALTER TABLE public.player_enrollment_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY player_settings_admin ON public.player_enrollment_settings FOR SELECT TO authenticated USING(public.is_admin(auth.uid()));
CREATE TABLE public.player_agreements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), version text NOT NULL UNIQUE CHECK(length(version)<=100), season integer NOT NULL DEFAULT 2027,
 body text NOT NULL CHECK(length(body)<=50000), pdf_path text NOT NULL, original_path text,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','ready','retired')), created_by uuid,
 created_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
GRANT SELECT ON public.player_agreements TO authenticated;
GRANT ALL ON public.player_agreements TO service_role;
ALTER TABLE public.player_agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY player_agreements_admin ON public.player_agreements FOR SELECT TO authenticated USING(public.is_admin(auth.uid()));
CREATE TABLE public.player_applications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid,
 full_name text NOT NULL CHECK(length(full_name) BETWEEN 2 AND 200), birth_date date NOT NULL,
 email text NOT NULL CHECK(length(email)<=255), phone text NOT NULL CHECK(length(phone)<=50), previous_club text NOT NULL DEFAULT '' CHECK(length(previous_club)<=300),
 payment_choice text NOT NULL CHECK(payment_choice IN('annual','quarterly','monthly')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','rejected')), team text CHECK(team IN('A-laget','B-laget')),
 approved_by uuid, approved_at timestamptz, agreement_id uuid REFERENCES public.player_agreements(id),
 agreement_confirmed_at timestamptz, agreement_identity jsonb, payment_snapshot jsonb, payment_confirmed_at timestamptz,
 spond_self_confirmed_at timestamptz, transfer_self_confirmed_at timestamptz,
 spond_verified_at timestamptz, spond_verified_by uuid,
 eligibility_verified_at timestamptz, eligibility_verified_by uuid, eligible_from date,
 payment_verified_at timestamptz, payment_verified_by uuid, payment_source text CHECK(payment_source IN('manual_spond','manual_bank')), payment_reference text,
 training_override_ore integer CHECK(training_override_ore>=0), custom_schedule jsonb,
 notes text NOT NULL DEFAULT '' CHECK(length(notes)<=3000), is_test boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
GRANT SELECT ON public.player_applications TO authenticated;
GRANT ALL ON public.player_applications TO service_role;
ALTER TABLE public.player_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY player_applications_read ON public.player_applications FOR SELECT TO authenticated USING(deleted_at IS NULL AND (public.is_admin(auth.uid()) OR user_id=auth.uid()));
CREATE UNIQUE INDEX player_application_active_email ON public.player_applications(lower(email)) WHERE deleted_at IS NULL AND status!='rejected' AND is_test=false;
CREATE TABLE public.player_invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), application_id uuid NOT NULL REFERENCES public.player_applications(id),
 token_hash text NOT NULL UNIQUE, raw_token text NOT NULL,
 expires_at timestamptz NOT NULL DEFAULT (now()+interval '30 days'), revoked_at timestamptz,
 agreement_id uuid REFERENCES public.player_agreements(id), snapshot jsonb NOT NULL,
 email_state text NOT NULL DEFAULT 'pending' CHECK(email_state IN('pending','sending','sent','failed','uncertain')),
 email_id text, email_error text, email_attempt_at timestamptz, email_sent_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), created_by uuid
);
GRANT ALL ON public.player_invitations TO service_role;
ALTER TABLE public.player_invitations ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.player_onboarding_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), application_id uuid NOT NULL REFERENCES public.player_applications(id),
 actor_id uuid, event text NOT NULL, details jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.player_onboarding_events TO authenticated;
GRANT ALL ON public.player_onboarding_events TO service_role;
ALTER TABLE public.player_onboarding_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY player_events_admin ON public.player_onboarding_events FOR SELECT TO authenticated USING(public.is_admin(auth.uid()));
CREATE FUNCTION public.create_player_invitation(p_application_id uuid,p_actor uuid,p_agreement_id uuid,p_snapshot jsonb,p_resend boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE a public.player_applications; existing_id uuid; invite_id uuid; token text;
BEGIN
 SELECT * INTO a FROM public.player_applications WHERE id=p_application_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND OR a.status!='approved' THEN RAISE EXCEPTION 'Approved application required'; END IF;
 SELECT id INTO existing_id FROM public.player_invitations WHERE application_id=a.id AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1;
 IF existing_id IS NOT NULL AND NOT p_resend THEN RETURN existing_id; END IF;
 IF a.agreement_confirmed_at IS NOT NULL AND a.agreement_id IS DISTINCT FROM p_agreement_id THEN RAISE EXCEPTION 'Accepted version is immutable'; END IF;
 IF p_resend THEN UPDATE public.player_invitations SET revoked_at=now() WHERE application_id=a.id AND revoked_at IS NULL; END IF;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 INSERT INTO public.player_invitations(application_id,token_hash,raw_token,agreement_id,snapshot,created_by) VALUES(a.id,encode(extensions.digest(token,'sha256'),'hex'),token,p_agreement_id,p_snapshot,p_actor) RETURNING id INTO invite_id;
 UPDATE public.player_applications SET agreement_id=p_agreement_id,payment_snapshot=p_snapshot->'payment',updated_at=now() WHERE id=a.id;
 INSERT INTO public.player_onboarding_events(application_id,actor_id,event) VALUES(a.id,p_actor,CASE WHEN p_resend THEN 'invitation_resent' ELSE 'invitation_created' END);
 RETURN invite_id;
END; $$;
REVOKE ALL ON FUNCTION public.create_player_invitation(uuid,uuid,uuid,jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_player_invitation(uuid,uuid,uuid,jsonb,boolean) TO service_role;
CREATE FUNCTION public.protect_player_agreement_version() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF (OLD.status='ready' OR EXISTS(SELECT 1 FROM public.player_invitations WHERE agreement_id=OLD.id)) AND (NEW.body IS DISTINCT FROM OLD.body OR NEW.pdf_path IS DISTINCT FROM OLD.pdf_path OR NEW.version IS DISTINCT FROM OLD.version) THEN RAISE EXCEPTION 'Create a new agreement version'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER immutable_player_agreement BEFORE UPDATE ON public.player_agreements FOR EACH ROW EXECUTE FUNCTION public.protect_player_agreement_version();
CREATE POLICY player_docs_admin_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='player-documents' AND public.is_admin(auth.uid()));
CREATE POLICY player_docs_admin_select ON storage.objects FOR SELECT TO authenticated USING(bucket_id='player-documents' AND public.is_admin(auth.uid()));