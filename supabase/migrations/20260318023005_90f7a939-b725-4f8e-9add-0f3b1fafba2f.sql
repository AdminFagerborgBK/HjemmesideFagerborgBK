
ALTER TABLE public.sponsor_clicks ADD COLUMN IF NOT EXISTS visitor_id text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_sponsor_clicks_date ON public.sponsor_clicks (clicked_at);
CREATE INDEX IF NOT EXISTS idx_sponsor_clicks_visitor ON public.sponsor_clicks (sponsor_id, visitor_id);
