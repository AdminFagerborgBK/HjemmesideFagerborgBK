export interface Match {
  id: string;
  team: 'A-laget' | 'B-laget';
  opponent: string;
  match_date: string;
  venue: string;
  is_home: boolean;
  home_score: number | null;
  away_score: number | null;
  competition: string;
  status: 'upcoming' | 'live' | 'finished';
  fiks_id: string | null;
  is_cancelled: boolean;
  opponent_logo_url: string | null;
  venue_maps_url: string | null;
  time_tbd: boolean;
  venue_tbd: boolean;
  /** Only readable by admins — public views exclude this column. */
  livestream_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Player {
  id: string;
  name: string;
  position: string;
  number: number | null;
  nationality: string;
  birth_date: string | null;
  height_cm: number | null;
  image_url: string | null;
  team: 'A-laget' | 'B-laget';
  goals: number;
  assists: number;
  appearances: number;
  clean_sheets: number;
  bio: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface News {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  image_url: string | null;
  category: string;
  author: string;
  is_featured: boolean;
  is_published: boolean;
  published_at: string;
  view_count: number;
  created_at: string;
  updated_at: string;
  match_id: string | null;
  show_match_highlights: boolean;
  carousel_order?: number;
}

export interface Membership {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  birth_date: string | null;
  membership_type: string;
  status: 'pending' | 'active' | 'expired' | 'cancelled';
  notes: string | null;
  created_at: string;
  updated_at: string;
}
