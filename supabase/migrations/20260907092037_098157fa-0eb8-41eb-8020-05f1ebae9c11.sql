CREATE TABLE public.newsletter_recipients (
  id uuid primary key default gen_random_uuid(),
  newsletter_id uuid not null references public.newsletters(id) on delete cascade,
  membership_id uuid,
  email text not null,
  name text,
  status text not null default 'sent',
  error text,
  created_at timestamptz not null default now()
);
CREATE INDEX idx_newsletter_recipients_newsletter ON public.newsletter_recipients(newsletter_id);
GRANT SELECT ON public.newsletter_recipients TO authenticated;
GRANT ALL ON public.newsletter_recipients TO service_role;
ALTER TABLE public.newsletter_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view newsletter recipients" ON public.newsletter_recipients FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));