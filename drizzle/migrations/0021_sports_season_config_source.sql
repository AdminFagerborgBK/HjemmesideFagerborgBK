ALTER TABLE public.sports_seasons ADD COLUMN IF NOT EXISTS config_source text NOT NULL DEFAULT 'manual';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sports_seasons_config_source_check') THEN
    ALTER TABLE public.sports_seasons ADD CONSTRAINT sports_seasons_config_source_check CHECK (config_source IN ('manual','discovered'));
  END IF;
END $$;
COMMENT ON COLUMN public.sports_seasons.config_source IS 'manual = admin-entered tournament IDs (override); discovered = validated automatically from fotball.no team pages';