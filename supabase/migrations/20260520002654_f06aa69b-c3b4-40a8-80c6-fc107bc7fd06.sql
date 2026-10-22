
CREATE TABLE public.video_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL,
  visitor_id text NOT NULL DEFAULT '',
  clicked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_video_clicks_video_id ON public.video_clicks(video_id);
CREATE INDEX idx_video_clicks_clicked_at ON public.video_clicks(clicked_at DESC);

ALTER TABLE public.video_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert video clicks"
  ON public.video_clicks
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Admins can read video clicks"
  ON public.video_clicks
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));
