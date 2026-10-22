-- Add more site_pages for Om klubben sections
INSERT INTO site_pages (key, title, body) VALUES 
  ('history', 'Historie', '## Fagerborgs historie

### 1914-1918 – Den spede begynnelse
14. mai 1914 ble idrettsgruppen innenfor Fagerborg Ynglingeforening stiftet...'),
  ('facilities', 'Bane & Anlegg', '## Bane og anlegg

### Klubbhuset
Leies av Frigg og ligger i Gydas vei 14...'),
  ('records', 'Klubbrekorder', '## Klubbrekorder

### Tilskuerrekord
- Over 1000 tilskuere på Dælenenga mot Spartacus (1948)...'),
  ('standings_history', 'Tabellhistorikk', '## Tabellplasseringer

Historiske tabellplasseringer for Fagerborg BK...')
ON CONFLICT (key) DO NOTHING;

-- Create site_sponsors table for sponsor management
CREATE TABLE IF NOT EXISTS public.site_sponsors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  website_url TEXT,
  tier TEXT NOT NULL DEFAULT 'partner' CHECK (tier IN ('main', 'partner')),
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.site_sponsors ENABLE ROW LEVEL SECURITY;

-- Public can view active sponsors
CREATE POLICY "Public can view active sponsors"
  ON public.site_sponsors
  FOR SELECT
  USING (is_active = true);

-- Admins can manage sponsors
CREATE POLICY "Admins can manage sponsors"
  ON public.site_sponsors
  FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_site_sponsors_updated_at
  BEFORE UPDATE ON public.site_sponsors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();