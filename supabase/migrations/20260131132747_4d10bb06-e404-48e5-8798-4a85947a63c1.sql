-- Tabell for Grasrotandelen-data (manuell oppdatering/cache)
-- Dokumentasjon: Norsk Tipping har ingen offentlig API for Grasrotandelen per organisasjon.
-- Data må oppdateres manuelt basert på utbetalingsrapporter fra Norsk Tipping.
-- Kilde: https://www.norsk-tipping.no/grasrotandelen/for-lag-og-foreninger

CREATE TABLE public.grasrot_yearly (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL,
  amount_nok NUMERIC(12, 2) NOT NULL DEFAULT 0,
  is_confirmed BOOLEAN NOT NULL DEFAULT false,
  source_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_grasrot_year UNIQUE (year)
);

-- Enable RLS
ALTER TABLE public.grasrot_yearly ENABLE ROW LEVEL SECURITY;

-- Public read access (alle kan se grasrot-data)
CREATE POLICY "Grasrot data is publicly viewable"
  ON public.grasrot_yearly
  FOR SELECT
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_grasrot_yearly_updated_at
  BEFORE UPDATE ON public.grasrot_yearly
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Kommentar for dokumentasjon
COMMENT ON TABLE public.grasrot_yearly IS 'Grasrotandelen-beløp per år for Fagerborg BK. Data oppdateres manuelt fra Norsk Tipping sine utbetalingsrapporter. Ingen offentlig API tilgjengelig per januar 2026.';
COMMENT ON COLUMN public.grasrot_yearly.is_confirmed IS 'True hvis beløpet er bekreftet fra offisiell kilde, false hvis estimert';
COMMENT ON COLUMN public.grasrot_yearly.source_note IS 'Kilde for dataen, f.eks. "Norsk Tipping utbetalingsrapport Q4 2025"';