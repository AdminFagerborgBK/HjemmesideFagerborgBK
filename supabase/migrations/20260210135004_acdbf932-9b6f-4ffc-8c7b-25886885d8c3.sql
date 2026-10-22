-- Add podcast visibility setting (default hidden)
INSERT INTO public.site_settings (key, value)
VALUES ('show_podcast', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;