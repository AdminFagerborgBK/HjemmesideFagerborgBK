-- Create historical standings table
CREATE TABLE public.historical_standings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team TEXT NOT NULL DEFAULT 'A-laget',
  year INTEGER NOT NULL,
  division TEXT NOT NULL,
  position INTEGER,
  result TEXT CHECK (result IN ('normal', 'promotion', 'relegation')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team, year)
);

-- Enable RLS
ALTER TABLE public.historical_standings ENABLE ROW LEVEL SECURITY;

-- Public can view
CREATE POLICY "Historical standings are publicly viewable"
  ON public.historical_standings
  FOR SELECT
  USING (true);

-- Insert historical data for A-laget
-- Working backwards: 2025 is 5.div relegated, 2024 was 6.div promoted, 2023 was 5.div relegated...
INSERT INTO public.historical_standings (team, year, division, position, result) VALUES
  ('A-laget', 2008, '4. divisjon', NULL, 'relegation'),
  ('A-laget', 2010, '4. divisjon', NULL, 'relegation'),
  ('A-laget', 2013, '5. divisjon', 2, 'normal'),
  ('A-laget', 2014, '5. divisjon', 1, 'promotion'),
  ('A-laget', 2015, '4. divisjon', 13, 'relegation'),
  ('A-laget', 2016, '5. divisjon', 2, 'normal'),
  ('A-laget', 2017, '5. divisjon', 9, 'normal'),
  ('A-laget', 2018, '5. divisjon', 5, 'normal'),
  ('A-laget', 2019, '5. divisjon', 7, 'normal'),
  ('A-laget', 2021, '5. divisjon', 11, 'normal'),
  ('A-laget', 2022, '5. divisjon', 6, 'normal'),
  ('A-laget', 2023, '5. divisjon', 11, 'relegation'),
  ('A-laget', 2024, '6. divisjon', 2, 'promotion'),
  ('A-laget', 2025, '5. divisjon', 12, 'relegation');