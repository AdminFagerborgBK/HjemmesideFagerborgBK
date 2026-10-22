export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          created_at: string
          id: string
          payload: Json | null
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json | null
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json | null
          type?: string
        }
        Relationships: []
      }
      admin_role_definitions: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          id: string
          name: string
          permissions: Database["public"]["Enums"]["admin_permission"][]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          name: string
          permissions?: Database["public"]["Enums"]["admin_permission"][]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          name?: string
          permissions?: Database["public"]["Enums"]["admin_permission"][]
          updated_at?: string
        }
        Relationships: []
      }
      division_matches: {
        Row: {
          away_score: number | null
          away_team: string
          created_at: string
          division_fiks_id: string
          fiks_id: string
          home_score: number | null
          home_team: string
          id: string
          match_date: string
          match_url: string | null
          round_number: number | null
          status: string
          updated_at: string
          venue: string | null
        }
        Insert: {
          away_score?: number | null
          away_team: string
          created_at?: string
          division_fiks_id?: string
          fiks_id: string
          home_score?: number | null
          home_team: string
          id?: string
          match_date: string
          match_url?: string | null
          round_number?: number | null
          status?: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          away_score?: number | null
          away_team?: string
          created_at?: string
          division_fiks_id?: string
          fiks_id?: string
          home_score?: number | null
          home_team?: string
          id?: string
          match_date?: string
          match_url?: string | null
          round_number?: number | null
          status?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: []
      }
      goal_club_entries: {
        Row: {
          amount_per_goal: number
          created_at: string
          deleted_at: string | null
          email: string
          goal_guess: number
          id: string
          is_anonymous: boolean
          is_company: boolean
          name: string
          phone: string | null
          season: number
        }
        Insert: {
          amount_per_goal?: number
          created_at?: string
          deleted_at?: string | null
          email: string
          goal_guess: number
          id?: string
          is_anonymous?: boolean
          is_company?: boolean
          name: string
          phone?: string | null
          season?: number
        }
        Update: {
          amount_per_goal?: number
          created_at?: string
          deleted_at?: string | null
          email?: string
          goal_guess?: number
          id?: string
          is_anonymous?: boolean
          is_company?: boolean
          name?: string
          phone?: string | null
          season?: number
        }
        Relationships: []
      }
      goal_club_invoices: {
        Row: {
          amount_per_goal: number
          created_at: string
          due_date: string
          email: string
          email_attempt_at: string | null
          email_error: string | null
          email_id: string | null
          email_state: string
          entry_id: string
          goals: number
          id: string
          is_winner: boolean
          name: string
          paid_at: string | null
          reference: string
          season: number
          sent_at: string | null
          total_nok: number
        }
        Insert: {
          amount_per_goal: number
          created_at?: string
          due_date: string
          email: string
          email_attempt_at?: string | null
          email_error?: string | null
          email_id?: string | null
          email_state?: string
          entry_id: string
          goals: number
          id?: string
          is_winner?: boolean
          name: string
          paid_at?: string | null
          reference: string
          season: number
          sent_at?: string | null
          total_nok: number
        }
        Update: {
          amount_per_goal?: number
          created_at?: string
          due_date?: string
          email?: string
          email_attempt_at?: string | null
          email_error?: string | null
          email_id?: string | null
          email_state?: string
          entry_id?: string
          goals?: number
          id?: string
          is_winner?: boolean
          name?: string
          paid_at?: string | null
          reference?: string
          season?: number
          sent_at?: string | null
          total_nok?: number
        }
        Relationships: [
          {
            foreignKeyName: "goal_club_invoices_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "goal_club_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_club_invoices_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "goal_club_public"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_club_season_closures: {
        Row: {
          completed_at: string | null
          created_at: string
          failed_count: number
          final_position: number | null
          goals: number
          league: string | null
          season: number
          sent_count: number
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          failed_count?: number
          final_position?: number | null
          goals: number
          league?: string | null
          season: number
          sent_count?: number
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          failed_count?: number
          final_position?: number | null
          goals?: number
          league?: string | null
          season?: number
          sent_count?: number
          status?: string
        }
        Relationships: []
      }
      graphic_backgrounds: {
        Row: {
          created_at: string
          id: string
          image_url: string
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      grasrot_fetch_status: {
        Row: {
          id: number
          last_attempt_at: string | null
          last_error: string | null
          last_source_hash: string | null
          last_success_at: string | null
          updated_at: string
        }
        Insert: {
          id?: number
          last_attempt_at?: string | null
          last_error?: string | null
          last_source_hash?: string | null
          last_success_at?: string | null
          updated_at?: string
        }
        Update: {
          id?: number
          last_attempt_at?: string | null
          last_error?: string | null
          last_source_hash?: string | null
          last_success_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      grasrot_yearly: {
        Row: {
          amount_nok: number
          created_at: string
          id: string
          is_confirmed: boolean
          num_supporters: number | null
          source_note: string | null
          updated_at: string
          year: number
        }
        Insert: {
          amount_nok?: number
          created_at?: string
          id?: string
          is_confirmed?: boolean
          num_supporters?: number | null
          source_note?: string | null
          updated_at?: string
          year: number
        }
        Update: {
          amount_nok?: number
          created_at?: string
          id?: string
          is_confirmed?: boolean
          num_supporters?: number | null
          source_note?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      historical_standings: {
        Row: {
          created_at: string
          division: string
          id: string
          locked: boolean
          position: number | null
          result: string | null
          table_url: string | null
          team: string
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          division: string
          id?: string
          locked?: boolean
          position?: number | null
          result?: string | null
          table_url?: string | null
          team?: string
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          division?: string
          id?: string
          locked?: boolean
          position?: number | null
          result?: string | null
          table_url?: string | null
          team?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      instagram_feed_cache: {
        Row: {
          account: string
          expires_at: string
          failure_count: number
          instagram_id: string | null
          last_attempt_at: string | null
          last_error: string | null
          last_success_at: string | null
          lease_id: string | null
          lease_until: string
          next_retry_at: string
          page_token: string | null
          posts: Json
          status: string
        }
        Insert: {
          account?: string
          expires_at?: string
          failure_count?: number
          instagram_id?: string | null
          last_attempt_at?: string | null
          last_error?: string | null
          last_success_at?: string | null
          lease_id?: string | null
          lease_until?: string
          next_retry_at?: string
          page_token?: string | null
          posts?: Json
          status?: string
        }
        Update: {
          account?: string
          expires_at?: string
          failure_count?: number
          instagram_id?: string | null
          last_attempt_at?: string | null
          last_error?: string | null
          last_success_at?: string | null
          lease_id?: string | null
          lease_until?: string
          next_retry_at?: string
          page_token?: string | null
          posts?: Json
          status?: string
        }
        Relationships: []
      }
      instagram_feed_oauth_states: {
        Row: {
          expires_at: string
          id: string
          redirect_uri: string
          user_id: string
        }
        Insert: {
          expires_at?: string
          id?: string
          redirect_uri: string
          user_id: string
        }
        Update: {
          expires_at?: string
          id?: string
          redirect_uri?: string
          user_id?: string
        }
        Relationships: []
      }
      instagram_posts: {
        Row: {
          alt_text: string | null
          created_at: string
          deleted_at: string | null
          focus_x: number
          focus_y: number
          id: string
          image_url: string
          instagram_url: string
          is_video: boolean
          published: boolean
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          deleted_at?: string | null
          focus_x?: number
          focus_y?: number
          id?: string
          image_url: string
          instagram_url: string
          is_video?: boolean
          published?: boolean
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          deleted_at?: string | null
          focus_x?: number
          focus_y?: number
          id?: string
          image_url?: string
          instagram_url?: string
          is_video?: boolean
          published?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      livestream_access: {
        Row: {
          created_at: string
          email: string | null
          expires_at: string
          id: string
          match_id: string
          token: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          expires_at: string
          id?: string
          match_id: string
          token: string
        }
        Update: {
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          match_id?: string
          token?: string
        }
        Relationships: []
      }
      livestream_otp: {
        Row: {
          code: string
          created_at: string
          email: string
          expires_at: string
          id: string
          match_id: string
          used: boolean
        }
        Insert: {
          code: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          match_id: string
          used?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          match_id?: string
          used?: boolean
        }
        Relationships: []
      }
      livestream_stats: {
        Row: {
          action: string
          created_at: string
          id: string
          match_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          match_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          match_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "livestream_stats_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "livestream_stats_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches_public"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          away_score: number | null
          competition: string
          created_at: string
          fiks_id: string | null
          home_score: number | null
          id: string
          is_cancelled: boolean
          is_home: boolean
          livestream_url: string | null
          match_date: string
          opponent: string
          opponent_logo_url: string | null
          status: string
          team: string
          time_tbd: boolean
          updated_at: string
          venue: string
          venue_maps_url: string | null
          venue_tbd: boolean
        }
        Insert: {
          away_score?: number | null
          competition?: string
          created_at?: string
          fiks_id?: string | null
          home_score?: number | null
          id?: string
          is_cancelled?: boolean
          is_home?: boolean
          livestream_url?: string | null
          match_date: string
          opponent: string
          opponent_logo_url?: string | null
          status?: string
          team: string
          time_tbd?: boolean
          updated_at?: string
          venue: string
          venue_maps_url?: string | null
          venue_tbd?: boolean
        }
        Update: {
          away_score?: number | null
          competition?: string
          created_at?: string
          fiks_id?: string | null
          home_score?: number | null
          id?: string
          is_cancelled?: boolean
          is_home?: boolean
          livestream_url?: string | null
          match_date?: string
          opponent?: string
          opponent_logo_url?: string | null
          status?: string
          team?: string
          time_tbd?: boolean
          updated_at?: string
          venue?: string
          venue_maps_url?: string | null
          venue_tbd?: boolean
        }
        Relationships: []
      }
      memberships: {
        Row: {
          address: string | null
          birth_date: string | null
          city: string | null
          created_at: string
          email: string
          first_name: string
          id: string
          interests: string[]
          last_name: string
          membership_type: string
          newsletter_opt_out: boolean
          notes: string | null
          phone: string | null
          postal_code: string | null
          status: string
          team_group: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          city?: string | null
          created_at?: string
          email: string
          first_name: string
          id?: string
          interests?: string[]
          last_name: string
          membership_type?: string
          newsletter_opt_out?: boolean
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          status?: string
          team_group?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          city?: string | null
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          interests?: string[]
          last_name?: string
          membership_type?: string
          newsletter_opt_out?: boolean
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          status?: string
          team_group?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      news: {
        Row: {
          author: string | null
          carousel_order: number
          category: string
          content: string
          created_at: string
          deleted_at: string | null
          excerpt: string | null
          facebook_post_id: string | null
          id: string
          image_focal_y: number
          image_url: string | null
          is_featured: boolean | null
          is_published: boolean | null
          match_id: string | null
          published_at: string | null
          scheduled_facebook: boolean
          show_match_highlights: boolean
          slug: string
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          author?: string | null
          carousel_order?: number
          category?: string
          content: string
          created_at?: string
          deleted_at?: string | null
          excerpt?: string | null
          facebook_post_id?: string | null
          id?: string
          image_focal_y?: number
          image_url?: string | null
          is_featured?: boolean | null
          is_published?: boolean | null
          match_id?: string | null
          published_at?: string | null
          scheduled_facebook?: boolean
          show_match_highlights?: boolean
          slug: string
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          author?: string | null
          carousel_order?: number
          category?: string
          content?: string
          created_at?: string
          deleted_at?: string | null
          excerpt?: string | null
          facebook_post_id?: string | null
          id?: string
          image_focal_y?: number
          image_url?: string | null
          is_featured?: boolean | null
          is_published?: boolean | null
          match_id?: string | null
          published_at?: string | null
          scheduled_facebook?: boolean
          show_match_highlights?: boolean
          slug?: string
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "news_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches_public"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_recipients: {
        Row: {
          created_at: string
          email: string
          error: string | null
          id: string
          membership_id: string | null
          name: string | null
          newsletter_id: string
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          error?: string | null
          id?: string
          membership_id?: string | null
          name?: string | null
          newsletter_id: string
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          error?: string | null
          id?: string
          membership_id?: string | null
          name?: string | null
          newsletter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_recipients_newsletter_id_fkey"
            columns: ["newsletter_id"]
            isOneToOne: false
            referencedRelation: "newsletters"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletters: {
        Row: {
          automatic_month: string | null
          body_html: string
          created_at: string
          delivery_state: string
          generated_at: string
          id: string
          sent_at: string | null
          sent_count: number | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          automatic_month?: string | null
          body_html: string
          created_at?: string
          delivery_state?: string
          generated_at?: string
          id?: string
          sent_at?: string | null
          sent_count?: number | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          automatic_month?: string | null
          body_html?: string
          created_at?: string
          delivery_state?: string
          generated_at?: string
          id?: string
          sent_at?: string | null
          sent_count?: number | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      player_agreements: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          original_path: string | null
          pdf_path: string
          season: number
          status: string
          version: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          original_path?: string | null
          pdf_path: string
          season?: number
          status?: string
          version: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          original_path?: string | null
          pdf_path?: string
          season?: number
          status?: string
          version?: string
        }
        Relationships: []
      }
      player_applications: {
        Row: {
          agreement_confirmed_at: string | null
          agreement_id: string | null
          agreement_identity: Json | null
          approved_at: string | null
          approved_by: string | null
          birth_date: string
          created_at: string
          custom_schedule: Json | null
          deleted_at: string | null
          eligibility_verified_at: string | null
          eligibility_verified_by: string | null
          eligible_from: string | null
          email: string
          full_name: string
          id: string
          is_test: boolean
          notes: string
          payment_choice: string
          payment_confirmed_at: string | null
          payment_reference: string | null
          payment_snapshot: Json | null
          payment_source: string | null
          payment_verified_at: string | null
          payment_verified_by: string | null
          phone: string
          previous_club: string
          spond_self_confirmed_at: string | null
          spond_verified_at: string | null
          spond_verified_by: string | null
          status: string
          team: string | null
          training_override_ore: number | null
          transfer_self_confirmed_at: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          agreement_confirmed_at?: string | null
          agreement_id?: string | null
          agreement_identity?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          birth_date: string
          created_at?: string
          custom_schedule?: Json | null
          deleted_at?: string | null
          eligibility_verified_at?: string | null
          eligibility_verified_by?: string | null
          eligible_from?: string | null
          email: string
          full_name: string
          id?: string
          is_test?: boolean
          notes?: string
          payment_choice: string
          payment_confirmed_at?: string | null
          payment_reference?: string | null
          payment_snapshot?: Json | null
          payment_source?: string | null
          payment_verified_at?: string | null
          payment_verified_by?: string | null
          phone: string
          previous_club?: string
          spond_self_confirmed_at?: string | null
          spond_verified_at?: string | null
          spond_verified_by?: string | null
          status?: string
          team?: string | null
          training_override_ore?: number | null
          transfer_self_confirmed_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          agreement_confirmed_at?: string | null
          agreement_id?: string | null
          agreement_identity?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          birth_date?: string
          created_at?: string
          custom_schedule?: Json | null
          deleted_at?: string | null
          eligibility_verified_at?: string | null
          eligibility_verified_by?: string | null
          eligible_from?: string | null
          email?: string
          full_name?: string
          id?: string
          is_test?: boolean
          notes?: string
          payment_choice?: string
          payment_confirmed_at?: string | null
          payment_reference?: string | null
          payment_snapshot?: Json | null
          payment_source?: string | null
          payment_verified_at?: string | null
          payment_verified_by?: string | null
          phone?: string
          previous_club?: string
          spond_self_confirmed_at?: string | null
          spond_verified_at?: string | null
          spond_verified_by?: string | null
          status?: string
          team?: string | null
          training_override_ore?: number | null
          transfer_self_confirmed_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_applications_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "player_agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      player_enrollment_settings: {
        Row: {
          current_agreement_id: string | null
          fees_confirmed: boolean
          first_training_due: string | null
          groups: Json
          id: number
          legal_reviewed: boolean
          membership_due: string | null
          membership_ore: number | null
          payment_channel: string
          season: number
          training_ore_a: number | null
          training_ore_b: number | null
          transfer_contact: string
          transfer_email: string
          transfer_url: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          current_agreement_id?: string | null
          fees_confirmed?: boolean
          first_training_due?: string | null
          groups?: Json
          id?: number
          legal_reviewed?: boolean
          membership_due?: string | null
          membership_ore?: number | null
          payment_channel?: string
          season?: number
          training_ore_a?: number | null
          training_ore_b?: number | null
          transfer_contact?: string
          transfer_email?: string
          transfer_url?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          current_agreement_id?: string | null
          fees_confirmed?: boolean
          first_training_due?: string | null
          groups?: Json
          id?: number
          legal_reviewed?: boolean
          membership_due?: string | null
          membership_ore?: number | null
          payment_channel?: string
          season?: number
          training_ore_a?: number | null
          training_ore_b?: number | null
          transfer_contact?: string
          transfer_email?: string
          transfer_url?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      player_invitations: {
        Row: {
          agreement_id: string | null
          application_id: string
          created_at: string
          created_by: string | null
          email_attempt_at: string | null
          email_error: string | null
          email_id: string | null
          email_sent_at: string | null
          email_state: string
          expires_at: string
          id: string
          raw_token: string
          revoked_at: string | null
          snapshot: Json
          token_hash: string
        }
        Insert: {
          agreement_id?: string | null
          application_id: string
          created_at?: string
          created_by?: string | null
          email_attempt_at?: string | null
          email_error?: string | null
          email_id?: string | null
          email_sent_at?: string | null
          email_state?: string
          expires_at?: string
          id?: string
          raw_token?: string
          revoked_at?: string | null
          snapshot: Json
          token_hash: string
        }
        Update: {
          agreement_id?: string | null
          application_id?: string
          created_at?: string
          created_by?: string | null
          email_attempt_at?: string | null
          email_error?: string | null
          email_id?: string | null
          email_sent_at?: string | null
          email_state?: string
          expires_at?: string
          id?: string
          raw_token?: string
          revoked_at?: string | null
          snapshot?: Json
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_invitations_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "player_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_invitations_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "player_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      player_onboarding_events: {
        Row: {
          actor_id: string | null
          application_id: string
          created_at: string
          details: Json | null
          event: string
          id: string
        }
        Insert: {
          actor_id?: string | null
          application_id: string
          created_at?: string
          details?: Json | null
          event: string
          id?: string
        }
        Update: {
          actor_id?: string | null
          application_id?: string
          created_at?: string
          details?: Json | null
          event?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_onboarding_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "player_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          appearances: number | null
          assists: number | null
          bio: string | null
          birth_date: string | null
          clean_sheets: number | null
          created_at: string
          goals: number | null
          height_cm: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          nationality: string | null
          number: number | null
          position: string
          team: string
          updated_at: string
        }
        Insert: {
          appearances?: number | null
          assists?: number | null
          bio?: string | null
          birth_date?: string | null
          clean_sheets?: number | null
          created_at?: string
          goals?: number | null
          height_cm?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          nationality?: string | null
          number?: number | null
          position: string
          team?: string
          updated_at?: string
        }
        Update: {
          appearances?: number | null
          assists?: number | null
          bio?: string | null
          birth_date?: string | null
          clean_sheets?: number | null
          created_at?: string
          goals?: number | null
          height_cm?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          nationality?: string | null
          number?: number | null
          position?: string
          team?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_pages: {
        Row: {
          body: string | null
          id: string
          key: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body?: string | null
          id?: string
          key: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string | null
          id?: string
          key?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      site_posts: {
        Row: {
          body: string
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          excerpt: string | null
          id: string
          published_at: string | null
          slug: string
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          excerpt?: string | null
          id?: string
          published_at?: string | null
          slug: string
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          excerpt?: string | null
          id?: string
          published_at?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_roster: {
        Row: {
          birth_date: string | null
          career_history: Json | null
          category: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          deleted_at: string | null
          fotball_no_url: string | null
          full_name: string
          id: string
          nifs_url: string | null
          photo_url: string | null
          role_or_position: string | null
          shirt_number: number | null
          show_email: boolean
          show_phone: boolean
          status: Database["public"]["Enums"]["roster_status"]
          team: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          birth_date?: string | null
          career_history?: Json | null
          category?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          deleted_at?: string | null
          fotball_no_url?: string | null
          full_name: string
          id?: string
          nifs_url?: string | null
          photo_url?: string | null
          role_or_position?: string | null
          shirt_number?: number | null
          show_email?: boolean
          show_phone?: boolean
          status?: Database["public"]["Enums"]["roster_status"]
          team?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          birth_date?: string | null
          career_history?: Json | null
          category?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          deleted_at?: string | null
          fotball_no_url?: string | null
          full_name?: string
          id?: string
          nifs_url?: string | null
          photo_url?: string | null
          role_or_position?: string | null
          shirt_number?: number | null
          show_email?: boolean
          show_phone?: boolean
          status?: Database["public"]["Enums"]["roster_status"]
          team?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      site_sponsors: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          sort_order: number
          tier: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          sort_order?: number
          tier?: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          sort_order?: number
          tier?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      site_videos: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_protected: boolean
          match_id: string | null
          protected_password: string | null
          published_at: string | null
          scheduled_facebook: boolean
          scheduled_tiktok: boolean
          sort_order: number
          status: Database["public"]["Enums"]["content_status"]
          thumbnail_url: string | null
          title: string
          updated_at: string
          video_url: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_protected?: boolean
          match_id?: string | null
          protected_password?: string | null
          published_at?: string | null
          scheduled_facebook?: boolean
          scheduled_tiktok?: boolean
          sort_order?: number
          status?: Database["public"]["Enums"]["content_status"]
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          video_url: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_protected?: boolean
          match_id?: string | null
          protected_password?: string | null
          published_at?: string | null
          scheduled_facebook?: boolean
          scheduled_tiktok?: boolean
          sort_order?: number
          status?: Database["public"]["Enums"]["content_status"]
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_videos_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_videos_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches_public"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_clicks: {
        Row: {
          clicked_at: string
          id: string
          sponsor_id: string
          visitor_id: string
        }
        Insert: {
          clicked_at?: string
          id?: string
          sponsor_id: string
          visitor_id?: string
        }
        Update: {
          clicked_at?: string
          id?: string
          sponsor_id?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_clicks_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "site_sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      sports_seasons: {
        Row: {
          is_active: boolean
          season: number
          teams: Json
          timezone: string
          updated_at: string
        }
        Insert: {
          is_active?: boolean
          season: number
          teams: Json
          timezone?: string
          updated_at?: string
        }
        Update: {
          is_active?: boolean
          season?: number
          teams?: Json
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      standings: {
        Row: {
          created_at: string
          drawn: number
          form: string[] | null
          goal_difference: number
          goals_against: number
          goals_for: number
          id: string
          league: string
          logo_url: string | null
          lost: number
          played: number
          points: number
          position: number
          season: string
          team: string
          team_name: string
          team_url: string | null
          updated_at: string
          won: number
        }
        Insert: {
          created_at?: string
          drawn?: number
          form?: string[] | null
          goal_difference?: number
          goals_against?: number
          goals_for?: number
          id?: string
          league?: string
          logo_url?: string | null
          lost?: number
          played?: number
          points?: number
          position?: number
          season?: string
          team: string
          team_name: string
          team_url?: string | null
          updated_at?: string
          won?: number
        }
        Update: {
          created_at?: string
          drawn?: number
          form?: string[] | null
          goal_difference?: number
          goals_against?: number
          goals_for?: number
          id?: string
          league?: string
          logo_url?: string | null
          lost?: number
          played?: number
          points?: number
          position?: number
          season?: string
          team?: string
          team_name?: string
          team_url?: string | null
          updated_at?: string
          won?: number
        }
        Relationships: []
      }
      sync_status: {
        Row: {
          id: string
          job_key: string
          last_attempt_at: string | null
          last_details: Json | null
          last_error: string | null
          last_success_at: string | null
          last_updated_count: number | null
          updated_at: string
        }
        Insert: {
          id?: string
          job_key: string
          last_attempt_at?: string | null
          last_details?: Json | null
          last_error?: string | null
          last_success_at?: string | null
          last_updated_count?: number | null
          updated_at?: string
        }
        Update: {
          id?: string
          job_key?: string
          last_attempt_at?: string | null
          last_details?: Json | null
          last_error?: string | null
          last_success_at?: string | null
          last_updated_count?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          admin_role_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          admin_role_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          admin_role_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_admin_role_id_fkey"
            columns: ["admin_role_id"]
            isOneToOne: false
            referencedRelation: "admin_role_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          created_at: string
          id: string
          maps_url: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          maps_url: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          maps_url?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      video_clicks: {
        Row: {
          clicked_at: string
          id: string
          video_id: string
          visitor_id: string
        }
        Insert: {
          clicked_at?: string
          id?: string
          video_id: string
          visitor_id?: string
        }
        Update: {
          clicked_at?: string
          id?: string
          video_id?: string
          visitor_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      goal_club_public: {
        Row: {
          amount_per_goal: number | null
          created_at: string | null
          goal_guess: number | null
          id: string | null
          is_anonymous: boolean | null
          is_company: boolean | null
          name: string | null
          season: number | null
        }
        Insert: {
          amount_per_goal?: number | null
          created_at?: string | null
          goal_guess?: number | null
          id?: string | null
          is_anonymous?: boolean | null
          is_company?: never
          name?: never
          season?: number | null
        }
        Update: {
          amount_per_goal?: number | null
          created_at?: string | null
          goal_guess?: number | null
          id?: string | null
          is_anonymous?: boolean | null
          is_company?: never
          name?: never
          season?: number | null
        }
        Relationships: []
      }
      matches_public: {
        Row: {
          away_score: number | null
          competition: string | null
          created_at: string | null
          fiks_id: string | null
          home_score: number | null
          id: string | null
          is_cancelled: boolean | null
          is_home: boolean | null
          match_date: string | null
          opponent: string | null
          opponent_logo_url: string | null
          status: string | null
          team: string | null
          time_tbd: boolean | null
          updated_at: string | null
          venue: string | null
          venue_maps_url: string | null
          venue_tbd: boolean | null
        }
        Insert: {
          away_score?: number | null
          competition?: string | null
          created_at?: string | null
          fiks_id?: string | null
          home_score?: number | null
          id?: string | null
          is_cancelled?: boolean | null
          is_home?: boolean | null
          match_date?: string | null
          opponent?: string | null
          opponent_logo_url?: string | null
          status?: string | null
          team?: string | null
          time_tbd?: boolean | null
          updated_at?: string | null
          venue?: string | null
          venue_maps_url?: string | null
          venue_tbd?: boolean | null
        }
        Update: {
          away_score?: number | null
          competition?: string | null
          created_at?: string | null
          fiks_id?: string | null
          home_score?: number | null
          id?: string | null
          is_cancelled?: boolean | null
          is_home?: boolean | null
          match_date?: string | null
          opponent?: string | null
          opponent_logo_url?: string | null
          status?: string | null
          team?: string | null
          time_tbd?: boolean | null
          updated_at?: string | null
          venue?: string | null
          venue_maps_url?: string | null
          venue_tbd?: boolean | null
        }
        Relationships: []
      }
      site_roster_public: {
        Row: {
          birth_date: string | null
          career_history: Json | null
          category: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          fotball_no_url: string | null
          full_name: string | null
          id: string | null
          photo_url: string | null
          role_or_position: string | null
          shirt_number: number | null
          show_email: boolean | null
          show_phone: boolean | null
          status: Database["public"]["Enums"]["roster_status"] | null
          team: string | null
          updated_at: string | null
        }
        Insert: {
          birth_date?: string | null
          career_history?: Json | null
          category?: string | null
          contact_email?: never
          contact_phone?: never
          created_at?: string | null
          fotball_no_url?: string | null
          full_name?: string | null
          id?: string | null
          photo_url?: string | null
          role_or_position?: string | null
          shirt_number?: number | null
          show_email?: boolean | null
          show_phone?: boolean | null
          status?: Database["public"]["Enums"]["roster_status"] | null
          team?: string | null
          updated_at?: string | null
        }
        Update: {
          birth_date?: string | null
          career_history?: Json | null
          category?: string | null
          contact_email?: never
          contact_phone?: never
          created_at?: string | null
          fotball_no_url?: string | null
          full_name?: string | null
          id?: string | null
          photo_url?: string | null
          role_or_position?: string | null
          shirt_number?: number | null
          show_email?: boolean | null
          show_phone?: boolean | null
          status?: Database["public"]["Enums"]["roster_status"] | null
          team?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      site_videos_public: {
        Row: {
          category: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string | null
          is_protected: boolean | null
          match_id: string | null
          published_at: string | null
          sort_order: number | null
          status: Database["public"]["Enums"]["content_status"] | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string | null
          video_url: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string | null
          is_protected?: boolean | null
          match_id?: string | null
          published_at?: string | null
          sort_order?: number | null
          status?: Database["public"]["Enums"]["content_status"] | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string | null
          video_url?: never
        }
        Update: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string | null
          is_protected?: boolean | null
          match_id?: string | null
          published_at?: string | null
          sort_order?: number | null
          status?: Database["public"]["Enums"]["content_status"] | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string | null
          video_url?: never
        }
        Relationships: [
          {
            foreignKeyName: "site_videos_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_videos_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      claim_goal_club_invoice: {
        Args: { _id: string }
        Returns: {
          amount_per_goal: number
          created_at: string
          due_date: string
          email: string
          email_attempt_at: string | null
          email_error: string | null
          email_id: string | null
          email_state: string
          entry_id: string
          goals: number
          id: string
          is_winner: boolean
          name: string
          paid_at: string | null
          reference: string
          season: number
          sent_at: string | null
          total_nok: number
        }[]
        SetofOptions: {
          from: "*"
          to: "goal_club_invoices"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_instagram_feed_refresh: {
        Args: { p_account: string; p_lease_id: string }
        Returns: boolean
      }
      create_hashed_player_invitation: {
        Args: {
          p_actor: string
          p_agreement_id: string
          p_application_id: string
          p_resend?: boolean
          p_snapshot: Json
          p_token_hash: string
        }
        Returns: string
      }
      create_player_invitation: {
        Args: {
          p_actor: string
          p_agreement_id: string
          p_application_id: string
          p_resend?: boolean
          p_snapshot: Json
        }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      replace_sports_standings: { Args: { p_rows: Json }; Returns: number }
      reschedule_scheduled_publish: { Args: never; Returns: undefined }
    }
    Enums: {
      admin_permission:
        | "posts_read"
        | "posts_write"
        | "videos_read"
        | "videos_write"
        | "roster_read"
        | "roster_write"
        | "sponsors_read"
        | "sponsors_write"
        | "pages_read"
        | "pages_write"
        | "board_read"
        | "board_write"
        | "settings_read"
        | "settings_write"
        | "members_read"
        | "members_write"
      app_role: "user" | "site_admin" | "superadmin"
      content_status: "draft" | "published"
      roster_status: "active" | "inactive"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      admin_permission: [
        "posts_read",
        "posts_write",
        "videos_read",
        "videos_write",
        "roster_read",
        "roster_write",
        "sponsors_read",
        "sponsors_write",
        "pages_read",
        "pages_write",
        "board_read",
        "board_write",
        "settings_read",
        "settings_write",
        "members_read",
        "members_write",
      ],
      app_role: ["user", "site_admin", "superadmin"],
      content_status: ["draft", "published"],
      roster_status: ["active", "inactive"],
    },
  },
} as const
