
CREATE TABLE public.livestream_otp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code text NOT NULL,
  match_id uuid REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_livestream_otp_email_match ON public.livestream_otp (email, match_id);
CREATE INDEX idx_livestream_otp_expires ON public.livestream_otp (expires_at);

ALTER TABLE public.livestream_otp ENABLE ROW LEVEL SECURITY;

-- No public access needed - edge function uses service role
