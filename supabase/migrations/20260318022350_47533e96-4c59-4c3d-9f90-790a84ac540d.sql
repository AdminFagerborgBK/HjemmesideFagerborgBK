
CREATE TABLE public.sponsor_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES public.site_sponsors(id) ON DELETE CASCADE,
  clicked_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.sponsor_clicks ENABLE ROW LEVEL SECURITY;

-- Anyone can insert clicks (public tracking)
CREATE POLICY "Anyone can insert sponsor clicks"
  ON public.sponsor_clicks
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Only admins can read click data
CREATE POLICY "Admins can read sponsor clicks"
  ON public.sponsor_clicks
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

-- Create index for efficient monthly aggregation
CREATE INDEX idx_sponsor_clicks_sponsor_date ON public.sponsor_clicks (sponsor_id, clicked_at);
