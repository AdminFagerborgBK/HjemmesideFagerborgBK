-- Allow service role to delete expired OTP codes
ALTER TABLE public.livestream_otp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage OTP codes"
  ON public.livestream_otp
  FOR ALL
  USING (true)
  WITH CHECK (true);
