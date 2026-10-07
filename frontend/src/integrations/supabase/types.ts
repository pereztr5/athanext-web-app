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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      about_content: {
        Row: {
          created_at: string | null
          display_order: number | null
          icon_name: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          metadata: Json | null
          section_description: string
          section_key: string
          section_subtitle: string | null
          section_title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          icon_name?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          metadata?: Json | null
          section_description: string
          section_key: string
          section_subtitle?: string | null
          section_title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          icon_name?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          metadata?: Json | null
          section_description?: string
          section_key?: string
          section_subtitle?: string | null
          section_title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      about_items: {
        Row: {
          category: string | null
          created_at: string | null
          description: string
          display_order: number
          id: string
          image_url: string | null
          is_active: boolean | null
          item_type: string
          metadata: Json | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description: string
          display_order: number
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          item_type: string
          metadata?: Json | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          item_type?: string
          metadata?: Json | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      about_story: {
        Row: {
          brand_name: string
          created_at: string | null
          description: string
          id: string
          image_url: string | null
          is_active: boolean | null
          paragraphs: string[]
          stats: Json | null
          tagline: string
          title: string
          updated_at: string | null
        }
        Insert: {
          brand_name: string
          created_at?: string | null
          description: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          paragraphs: string[]
          stats?: Json | null
          tagline: string
          title: string
          updated_at?: string | null
        }
        Update: {
          brand_name?: string
          created_at?: string | null
          description?: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          paragraphs?: string[]
          stats?: Json | null
          tagline?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      appointments: {
        Row: {
          coach_id: string
          created_at: string
          duration_minutes: number
          id: string
          location: string | null
          notes: string | null
          payment_intent_id: string | null
          payment_status: string
          scheduled_at: string
          service_type: string
          status: string
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          duration_minutes?: number
          id?: string
          location?: string | null
          notes?: string | null
          payment_intent_id?: string | null
          payment_status?: string
          scheduled_at: string
          service_type: string
          status?: string
          total_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          location?: string | null
          notes?: string | null
          payment_intent_id?: string | null
          payment_status?: string
          scheduled_at?: string
          service_type?: string
          status?: string
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_appointments_coach_id"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_profiles: {
        Row: {
          bio: string | null
          cover_image_urls: string[]
          created_at: string
          current_year: string | null
          date_of_birth: string
          dominant_hand: string | null
          full_name: string
          gpa: number | null
          graduation_year: string | null
          height: string | null
          high_school: string | null
          highlight_video_url: string | null
          id: string
          instagram_handle: string | null
          location: string | null
          pathway_tags: string[]
          phone_number: string | null
          position: string | null
          profile_completed: boolean
          profile_image_url: string | null
          season_goal: string | null
          sport: string
          tags: string[]
          updated_at: string
          user_id: string | null
          weight: string | null
        }
        Insert: {
          bio?: string | null
          cover_image_urls?: string[]
          created_at?: string
          current_year?: string | null
          date_of_birth: string
          dominant_hand?: string | null
          full_name: string
          gpa?: number | null
          graduation_year?: string | null
          height?: string | null
          high_school?: string | null
          highlight_video_url?: string | null
          id?: string
          instagram_handle?: string | null
          location?: string | null
          pathway_tags?: string[]
          phone_number?: string | null
          position?: string | null
          profile_completed?: boolean
          profile_image_url?: string | null
          season_goal?: string | null
          sport: string
          tags?: string[]
          updated_at?: string
          user_id?: string | null
          weight?: string | null
        }
        Update: {
          bio?: string | null
          cover_image_urls?: string[]
          created_at?: string
          current_year?: string | null
          date_of_birth?: string
          dominant_hand?: string | null
          full_name?: string
          gpa?: number | null
          graduation_year?: string | null
          height?: string | null
          high_school?: string | null
          highlight_video_url?: string | null
          id?: string
          instagram_handle?: string | null
          location?: string | null
          pathway_tags?: string[]
          phone_number?: string | null
          position?: string | null
          profile_completed?: boolean
          profile_image_url?: string | null
          season_goal?: string | null
          sport?: string
          tags?: string[]
          updated_at?: string
          user_id?: string | null
          weight?: string | null
        }
        Relationships: []
      }
      brands: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          logo_url: string | null
          name: string
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          logo_url?: string | null
          name: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brands_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_achievements: {
        Row: {
          coach_id: string
          created_at: string
          description: string | null
          id: string
          title: string
          updated_at: string
          year: number | null
        }
        Insert: {
          coach_id: string
          created_at?: string
          description?: string | null
          id?: string
          title: string
          updated_at?: string
          year?: number | null
        }
        Update: {
          coach_id?: string
          created_at?: string
          description?: string | null
          id?: string
          title?: string
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_achievements_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_coach_achievements_coach_id"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_applications: {
        Row: {
          application_status: string
          background_check_consent: boolean
          certifications: string
          created_at: string
          current_coaching_role: string | null
          email: string
          full_name: string
          id: string
          instagram_handle: string | null
          insurance_confirmation: boolean
          linkedin_url: string | null
          phone_number: string
          sport: string
          updated_at: string
          user_id: string | null
          website_url: string | null
          why_join: string
          years_experience: number
        }
        Insert: {
          application_status?: string
          background_check_consent?: boolean
          certifications: string
          created_at?: string
          current_coaching_role?: string | null
          email: string
          full_name: string
          id?: string
          instagram_handle?: string | null
          insurance_confirmation?: boolean
          linkedin_url?: string | null
          phone_number: string
          sport: string
          updated_at?: string
          user_id?: string | null
          website_url?: string | null
          why_join: string
          years_experience: number
        }
        Update: {
          application_status?: string
          background_check_consent?: boolean
          certifications?: string
          created_at?: string
          current_coaching_role?: string | null
          email?: string
          full_name?: string
          id?: string
          instagram_handle?: string | null
          insurance_confirmation?: boolean
          linkedin_url?: string | null
          phone_number?: string
          sport?: string
          updated_at?: string
          user_id?: string | null
          website_url?: string | null
          why_join?: string
          years_experience?: number
        }
        Relationships: []
      }
      coach_athlete_notes: {
        Row: {
          athlete_id: string
          coach_id: string
          private_note: string
          updated_at: string
        }
        Insert: {
          athlete_id: string
          coach_id: string
          private_note?: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          coach_id?: string
          private_note?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_athlete_notes_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_athlete_notes_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_availability: {
        Row: {
          coach_id: string
          created_at: string
          end_date: string
          id: string
          repeats_weekly: boolean
          start_date: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          end_date: string
          id?: string
          repeats_weekly?: boolean
          start_date: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          end_date?: string
          id?: string
          repeats_weekly?: boolean
          start_date?: string
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_availability_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_availability_slot_occurrences: {
        Row: {
          availability_id: string | null
          coach_id: string
          created_at: string
          details: Json
          disabled_reason: string | null
          duration_minutes: number
          end_time: string
          id: string
          is_draft: boolean
          is_enabled: boolean
          location: string
          max_bookings_per_slot: number
          occurrence_date: string
          offered_to: string[]
          pillar_slot: string | null
          place: string | null
          position: string | null
          price: number
          series_id: string | null
          session_name: string
          session_type: string
          start_time: string
          updated_at: string
          visibility: string
          weekly_slot_id: string | null
        }
        Insert: {
          availability_id?: string | null
          coach_id: string
          created_at?: string
          details?: Json
          disabled_reason?: string | null
          duration_minutes: number
          end_time: string
          id?: string
          is_draft?: boolean
          is_enabled?: boolean
          location: string
          max_bookings_per_slot?: number
          occurrence_date: string
          offered_to?: string[]
          pillar_slot?: string | null
          place?: string | null
          position?: string | null
          price: number
          series_id?: string | null
          session_name: string
          session_type: string
          start_time: string
          updated_at?: string
          visibility?: string
          weekly_slot_id?: string | null
        }
        Update: {
          availability_id?: string | null
          coach_id?: string
          created_at?: string
          details?: Json
          disabled_reason?: string | null
          duration_minutes?: number
          end_time?: string
          id?: string
          is_draft?: boolean
          is_enabled?: boolean
          location?: string
          max_bookings_per_slot?: number
          occurrence_date?: string
          offered_to?: string[]
          pillar_slot?: string | null
          place?: string | null
          position?: string | null
          price?: number
          series_id?: string | null
          session_name?: string
          session_type?: string
          start_time?: string
          updated_at?: string
          visibility?: string
          weekly_slot_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_availability_slot_occurrences_availability_id_fkey"
            columns: ["availability_id"]
            isOneToOne: false
            referencedRelation: "coach_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_availability_slot_occurrences_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_availability_slot_occurrences_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "coach_session_series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_availability_slot_occurrences_weekly_slot_id_fkey"
            columns: ["weekly_slot_id"]
            isOneToOne: false
            referencedRelation: "coach_availability_weekly_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_availability_slots_v2: {
        Row: {
          availability_id: string
          created_at: string
          day_of_week: number
          duration_minutes: number
          end_time: string
          id: string
          is_enabled: boolean
          location: string
          max_bookings_per_slot: number
          pillar_slot: string | null
          price: number
          session_name: string
          session_type: string
          start_time: string
          updated_at: string
        }
        Insert: {
          availability_id: string
          created_at?: string
          day_of_week: number
          duration_minutes: number
          end_time: string
          id?: string
          is_enabled?: boolean
          location: string
          max_bookings_per_slot?: number
          pillar_slot?: string | null
          price: number
          session_name: string
          session_type: string
          start_time: string
          updated_at?: string
        }
        Update: {
          availability_id?: string
          created_at?: string
          day_of_week?: number
          duration_minutes?: number
          end_time?: string
          id?: string
          is_enabled?: boolean
          location?: string
          max_bookings_per_slot?: number
          pillar_slot?: string | null
          price?: number
          session_name?: string
          session_type?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_availability_slots_v2_availability_id_fkey"
            columns: ["availability_id"]
            isOneToOne: false
            referencedRelation: "coach_availability_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_availability_v2: {
        Row: {
          coach_id: string
          created_at: string
          end_date: string
          id: string
          start_date: string
          updated_at: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          end_date: string
          id?: string
          start_date: string
          updated_at?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          end_date?: string
          id?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_availability_v2_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_availability_weekly_slots: {
        Row: {
          availability_id: string
          created_at: string
          day_of_week: number
          duration_minutes: number
          end_time: string
          id: string
          is_enabled: boolean
          location: string
          max_bookings_per_slot: number
          pillar_slot: string | null
          price: number
          session_name: string
          session_type: string
          start_time: string
          updated_at: string
        }
        Insert: {
          availability_id: string
          created_at?: string
          day_of_week: number
          duration_minutes: number
          end_time: string
          id?: string
          is_enabled?: boolean
          location: string
          max_bookings_per_slot?: number
          pillar_slot?: string | null
          price: number
          session_name: string
          session_type: string
          start_time: string
          updated_at?: string
        }
        Update: {
          availability_id?: string
          created_at?: string
          day_of_week?: number
          duration_minutes?: number
          end_time?: string
          id?: string
          is_enabled?: boolean
          location?: string
          max_bookings_per_slot?: number
          pillar_slot?: string | null
          price?: number
          session_name?: string
          session_type?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_availability_weekly_slots_availability_id_fkey"
            columns: ["availability_id"]
            isOneToOne: false
            referencedRelation: "coach_availability"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_brands: {
        Row: {
          brand_id: string
          coach_id: string
          created_at: string
          display_order: number
        }
        Insert: {
          brand_id: string
          coach_id: string
          created_at?: string
          display_order?: number
        }
        Update: {
          brand_id?: string
          coach_id?: string
          created_at?: string
          display_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "coach_brands_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_brands_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_busy_blocks: {
        Row: {
          coach_id: string
          ends_at: string
          id: string
          source: string
          starts_at: string
        }
        Insert: {
          coach_id: string
          ends_at: string
          id?: string
          source?: string
          starts_at: string
        }
        Update: {
          coach_id?: string
          ends_at?: string
          id?: string
          source?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_busy_blocks_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_calendar_connections: {
        Row: {
          access_token: string | null
          access_token_expires_at: string | null
          account_email: string | null
          can_write: boolean
          coach_id: string
          connected_at: string
          last_synced_at: string | null
          provider: string
          refresh_token: string
          sync_error: string | null
        }
        Insert: {
          access_token?: string | null
          access_token_expires_at?: string | null
          account_email?: string | null
          can_write?: boolean
          coach_id: string
          connected_at?: string
          last_synced_at?: string | null
          provider?: string
          refresh_token: string
          sync_error?: string | null
        }
        Update: {
          access_token?: string | null
          access_token_expires_at?: string | null
          account_email?: string | null
          can_write?: boolean
          coach_id?: string
          connected_at?: string
          last_synced_at?: string | null
          provider?: string
          refresh_token?: string
          sync_error?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_calendar_connections_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: true
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_certifications: {
        Row: {
          certification_name: string
          coach_id: string
          created_at: string
          expiry_date: string | null
          id: string
          issue_date: string | null
          issuing_organization: string | null
          updated_at: string
        }
        Insert: {
          certification_name: string
          coach_id: string
          created_at?: string
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          issuing_organization?: string | null
          updated_at?: string
        }
        Update: {
          certification_name?: string
          coach_id?: string
          created_at?: string
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          issuing_organization?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_certifications_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_coach_certifications_coach_id"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_client_referrals: {
        Row: {
          athlete_first_name: string | null
          athlete_id: string | null
          client_email: string
          client_name: string | null
          coach_id: string
          confirmed_at: string | null
          created_at: string
          expires_at: string | null
          id: string
          initiated_by: string
          invite_token: string | null
          relationship_source: string | null
          status: string
        }
        Insert: {
          athlete_first_name?: string | null
          athlete_id?: string | null
          client_email: string
          client_name?: string | null
          coach_id: string
          confirmed_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          initiated_by?: string
          invite_token?: string | null
          relationship_source?: string | null
          status?: string
        }
        Update: {
          athlete_first_name?: string | null
          athlete_id?: string | null
          client_email?: string
          client_name?: string | null
          coach_id?: string
          confirmed_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          initiated_by?: string
          invite_token?: string | null
          relationship_source?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_client_referrals_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_client_referrals_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_invoices: {
        Row: {
          amount: number
          athlete_id: string | null
          athlete_name: string
          coach_id: string
          created_at: string
          due_date: string
          family_name: string
          id: string
          last_reminded_at: string | null
          note: string | null
          paid_at: string | null
          paid_method: string | null
          reminders: number
          service: string
          status: string
          stripe_payment_intent: string | null
          stripe_session_id: string | null
        }
        Insert: {
          amount: number
          athlete_id?: string | null
          athlete_name?: string
          coach_id: string
          created_at?: string
          due_date: string
          family_name?: string
          id?: string
          last_reminded_at?: string | null
          note?: string | null
          paid_at?: string | null
          paid_method?: string | null
          reminders?: number
          service: string
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
        }
        Update: {
          amount?: number
          athlete_id?: string | null
          athlete_name?: string
          coach_id?: string
          created_at?: string
          due_date?: string
          family_name?: string
          id?: string
          last_reminded_at?: string | null
          note?: string | null
          paid_at?: string | null
          paid_method?: string | null
          reminders?: number
          service?: string
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_invoices_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_invoices_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_packages: {
        Row: {
          coach_id: string
          created_at: string
          description: string | null
          display_order: number | null
          duration_minutes: number
          features: Json | null
          id: string
          is_active: boolean
          package_name: string
          price_per_session: number | null
          session_count: number
          total_price: number
          updated_at: string
          validity_days: number
        }
        Insert: {
          coach_id: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          duration_minutes: number
          features?: Json | null
          id?: string
          is_active?: boolean
          package_name: string
          price_per_session?: number | null
          session_count: number
          total_price: number
          updated_at?: string
          validity_days: number
        }
        Update: {
          coach_id?: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          duration_minutes?: number
          features?: Json | null
          id?: string
          is_active?: boolean
          package_name?: string
          price_per_session?: number | null
          session_count?: number
          total_price?: number
          updated_at?: string
          validity_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "coach_packages_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_payout_accounts: {
        Row: {
          bank_last4: string | null
          charges_enabled: boolean
          coach_id: string
          created_at: string
          details_submitted: boolean
          payout_day: string
          payouts_enabled: boolean
          stripe_account_id: string
          transfers_active: boolean
          updated_at: string
        }
        Insert: {
          bank_last4?: string | null
          charges_enabled?: boolean
          coach_id: string
          created_at?: string
          details_submitted?: boolean
          payout_day?: string
          payouts_enabled?: boolean
          stripe_account_id: string
          transfers_active?: boolean
          updated_at?: string
        }
        Update: {
          bank_last4?: string | null
          charges_enabled?: boolean
          coach_id?: string
          created_at?: string
          details_submitted?: boolean
          payout_day?: string
          payouts_enabled?: boolean
          stripe_account_id?: string
          transfers_active?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_payout_accounts_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: true
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_reviews: {
        Row: {
          coach_id: string
          created_at: string
          id: string
          rating: number
          review_text: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          id?: string
          rating: number
          review_text?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          id?: string
          rating?: number
          review_text?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_reviews_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_coach_reviews_coach_id"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_session_series: {
        Row: {
          coach_id: string
          created_at: string
          day_of_week: number
          details: Json
          duration_minutes: number
          ends_on: string | null
          id: string
          is_active: boolean
          location: string
          max_bookings_per_slot: number
          offered_to: string[]
          pillar_slot: string | null
          place: string | null
          position: string | null
          price: number
          session_name: string
          session_type: string
          start_time: string
          starts_on: string
          updated_at: string
          visibility: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          day_of_week: number
          details?: Json
          duration_minutes: number
          ends_on?: string | null
          id?: string
          is_active?: boolean
          location: string
          max_bookings_per_slot?: number
          offered_to?: string[]
          pillar_slot?: string | null
          place?: string | null
          position?: string | null
          price: number
          session_name: string
          session_type: string
          start_time: string
          starts_on: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          day_of_week?: number
          details?: Json
          duration_minutes?: number
          ends_on?: string | null
          id?: string
          is_active?: boolean
          location?: string
          max_bookings_per_slot?: number
          offered_to?: string[]
          pillar_slot?: string | null
          place?: string | null
          position?: string | null
          price?: number
          session_name?: string
          session_type?: string
          start_time?: string
          starts_on?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_session_series_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_share_events: {
        Row: {
          coach_id: string
          created_at: string
          event_type: string
          id: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          event_type: string
          id?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          event_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_share_events_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_slot_bookings: {
        Row: {
          athlete_id: string
          availability_id: string | null
          canceled_at: string | null
          cancellation_reason: string | null
          coach_id: string
          created_at: string
          created_by: string | null
          credit_purchase_id: string | null
          expires_at: string | null
          google_event_id: string | null
          id: string
          notes: string | null
          occurrence_id: string
          payment_status: string
          status: string
          stripe_payment_intent: string | null
          stripe_session_id: string | null
          updated_at: string
          weekly_slot_id: string | null
        }
        Insert: {
          athlete_id: string
          availability_id?: string | null
          canceled_at?: string | null
          cancellation_reason?: string | null
          coach_id: string
          created_at?: string
          created_by?: string | null
          credit_purchase_id?: string | null
          expires_at?: string | null
          google_event_id?: string | null
          id?: string
          notes?: string | null
          occurrence_id: string
          payment_status?: string
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          weekly_slot_id?: string | null
        }
        Update: {
          athlete_id?: string
          availability_id?: string | null
          canceled_at?: string | null
          cancellation_reason?: string | null
          coach_id?: string
          created_at?: string
          created_by?: string | null
          credit_purchase_id?: string | null
          expires_at?: string | null
          google_event_id?: string | null
          id?: string
          notes?: string | null
          occurrence_id?: string
          payment_status?: string
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          weekly_slot_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_slot_bookings_athlete_id_fkey1"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_slot_bookings_availability_id_fkey"
            columns: ["availability_id"]
            isOneToOne: false
            referencedRelation: "coach_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_slot_bookings_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_slot_bookings_credit_purchase_id_fkey"
            columns: ["credit_purchase_id"]
            isOneToOne: false
            referencedRelation: "package_purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_slot_bookings_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "coach_availability_slot_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_slot_bookings_weekly_slot_id_fkey"
            columns: ["weekly_slot_id"]
            isOneToOne: false
            referencedRelation: "coach_availability_weekly_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_slug_redirects: {
        Row: {
          coach_id: string
          created_at: string
          slug: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          slug: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_slug_redirects_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_sport_pillars: {
        Row: {
          coach_id: string
          created_at: string
          id: string
          sport: Database["public"]["Enums"]["sport_type"] | null
          sport_pillar_id: string | null
        }
        Insert: {
          coach_id: string
          created_at?: string
          id?: string
          sport?: Database["public"]["Enums"]["sport_type"] | null
          sport_pillar_id?: string | null
        }
        Update: {
          coach_id?: string
          created_at?: string
          id?: string
          sport?: Database["public"]["Enums"]["sport_type"] | null
          sport_pillar_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_sport_pillars_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_sport_pillars_sport_pillar_id_fkey"
            columns: ["sport_pillar_id"]
            isOneToOne: false
            referencedRelation: "sport_pillars"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_time_off: {
        Row: {
          coach_id: string
          created_at: string
          id: string
          note: string | null
          off_date: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          id?: string
          note?: string | null
          off_date: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          id?: string
          note?: string | null
          off_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_time_off_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      coaches: {
        Row: {
          affiliate_links: Json
          age_max: number | null
          age_min: number | null
          availability: Json | null
          bio: string | null
          booking_window_weeks: number
          cancellation_policy: string | null
          company: string | null
          cover_image_urls: string[] | null
          created_at: string
          deactivated_at: string | null
          deals_enabled: boolean
          email: string | null
          favourite_positions: string[] | null
          hourly_rate: number
          id: string
          image_url: string | null
          instagram_handle: string | null
          is_verified: boolean | null
          languages: string[] | null
          listed: boolean
          locations: string[]
          name: string
          new_family_booking: string
          pathway_tags: string[]
          pay_mode: string
          pay_note: string | null
          position: string | null
          positions: string[] | null
          profile_faqs: Json
          profile_image_url: string | null
          rating: number | null
          requires_booking_confirmation: boolean
          response_time_hours: number | null
          session_types: string[] | null
          slug: string
          specialties: string[]
          status: string | null
          total_reviews: number | null
          updated_at: string
          years_experience: number | null
        }
        Insert: {
          affiliate_links?: Json
          age_max?: number | null
          age_min?: number | null
          availability?: Json | null
          bio?: string | null
          booking_window_weeks?: number
          cancellation_policy?: string | null
          company?: string | null
          cover_image_urls?: string[] | null
          created_at?: string
          deactivated_at?: string | null
          deals_enabled?: boolean
          email?: string | null
          favourite_positions?: string[] | null
          hourly_rate?: number
          id?: string
          image_url?: string | null
          instagram_handle?: string | null
          is_verified?: boolean | null
          languages?: string[] | null
          listed?: boolean
          locations?: string[]
          name: string
          new_family_booking?: string
          pathway_tags?: string[]
          pay_mode?: string
          pay_note?: string | null
          position?: string | null
          positions?: string[] | null
          profile_faqs?: Json
          profile_image_url?: string | null
          rating?: number | null
          requires_booking_confirmation?: boolean
          response_time_hours?: number | null
          session_types?: string[] | null
          slug: string
          specialties?: string[]
          status?: string | null
          total_reviews?: number | null
          updated_at?: string
          years_experience?: number | null
        }
        Update: {
          affiliate_links?: Json
          age_max?: number | null
          age_min?: number | null
          availability?: Json | null
          bio?: string | null
          booking_window_weeks?: number
          cancellation_policy?: string | null
          company?: string | null
          cover_image_urls?: string[] | null
          created_at?: string
          deactivated_at?: string | null
          deals_enabled?: boolean
          email?: string | null
          favourite_positions?: string[] | null
          hourly_rate?: number
          id?: string
          image_url?: string | null
          instagram_handle?: string | null
          is_verified?: boolean | null
          languages?: string[] | null
          listed?: boolean
          locations?: string[]
          name?: string
          new_family_booking?: string
          pathway_tags?: string[]
          pay_mode?: string
          pay_note?: string | null
          position?: string | null
          positions?: string[] | null
          profile_faqs?: Json
          profile_image_url?: string | null
          rating?: number | null
          requires_booking_confirmation?: boolean
          response_time_hours?: number | null
          session_types?: string[] | null
          slug?: string
          specialties?: string[]
          status?: string | null
          total_reviews?: number | null
          updated_at?: string
          years_experience?: number | null
        }
        Relationships: []
      }
      configurations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      contact_submissions: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          message: string
          status: string
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          message: string
          status?: string
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          message?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      contact_us: {
        Row: {
          contact_number: string
          created_at: string
          email: string
          id: string
          location: string
          updated_at: string
        }
        Insert: {
          contact_number: string
          created_at?: string
          email: string
          id?: string
          location: string
          updated_at?: string
        }
        Update: {
          contact_number?: string
          created_at?: string
          email?: string
          id?: string
          location?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          last_read_at: string | null
          role: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          last_read_at?: string | null
          role?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          last_read_at?: string | null
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_group: boolean | null
          last_message_at: string | null
          last_message_text: string | null
          owner_coach_id: string | null
          title: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_group?: boolean | null
          last_message_at?: string | null
          last_message_text?: string | null
          owner_coach_id?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_group?: boolean | null
          last_message_at?: string | null
          last_message_text?: string | null
          owner_coach_id?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_owner_coach_id_fkey"
            columns: ["owner_coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      faq_items: {
        Row: {
          answer: Json
          id: string
          position: number
          question: Json
          type: string
        }
        Insert: {
          answer: Json
          id?: string
          position: number
          question: Json
          type: string
        }
        Update: {
          answer?: Json
          id?: string
          position?: number
          question?: Json
          type?: string
        }
        Relationships: []
      }
      faqs: {
        Row: {
          answer: string
          category: string | null
          created_at: string
          id: string
          is_active: boolean
          order: number
          question: string
          updated_at: string
        }
        Insert: {
          answer: string
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          order?: number
          question: string
          updated_at?: string
        }
        Update: {
          answer?: string
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          order?: number
          question?: string
          updated_at?: string
        }
        Relationships: []
      }
      free_consultation_tracking: {
        Row: {
          appointment_id: string | null
          coach_id: string
          created_at: string | null
          id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          appointment_id?: string | null
          coach_id: string
          created_at?: string | null
          id?: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          appointment_id?: string | null
          coach_id?: string
          created_at?: string | null
          id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "free_consultation_tracking_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      gear_purchases: {
        Row: {
          amount: number
          athlete_id: string
          coach_id: string | null
          created_at: string
          currency: string
          id: string
          purchased_at: string
          refunded_amount: number
          shopify_line_id: string
          shopify_order_id: string
          title: string
        }
        Insert: {
          amount: number
          athlete_id: string
          coach_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          purchased_at?: string
          refunded_amount?: number
          shopify_line_id?: string
          shopify_order_id: string
          title: string
        }
        Update: {
          amount?: number
          athlete_id?: string
          coach_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          purchased_at?: string
          refunded_amount?: number
          shopify_line_id?: string
          shopify_order_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "gear_purchases_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gear_purchases_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      group_session_offers: {
        Row: {
          closes_at: string
          coach_id: string
          created_at: string
          id: string
          occurrence_ids: string[]
          title: string
        }
        Insert: {
          closes_at: string
          coach_id: string
          created_at?: string
          id?: string
          occurrence_ids: string[]
          title: string
        }
        Update: {
          closes_at?: string
          coach_id?: string
          created_at?: string
          id?: string
          occurrence_ids?: string[]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_session_offers_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          edited_at: string | null
          id: string
          offer_id: string | null
          sender_id: string
          status: string | null
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          edited_at?: string | null
          id?: string
          offer_id?: string | null
          sender_id: string
          status?: string | null
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          offer_id?: string | null
          sender_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "group_session_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_coaches: {
        Row: {
          coach_id: string
          joined_at: string
          organization_id: string
          rate: number | null
          shown: boolean
          sort_order: number
        }
        Insert: {
          coach_id: string
          joined_at?: string
          organization_id: string
          rate?: number | null
          shown?: boolean
          sort_order?: number
        }
        Update: {
          coach_id?: string
          joined_at?: string
          organization_id?: string
          rate?: number | null
          shown?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "organization_coaches_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: true
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_coaches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invites: {
        Row: {
          coach_id: string | null
          email: string | null
          id: string
          kind: string
          organization_id: string
          rate: number
          responded_at: string | null
          sent_at: string
          status: string
          token: string
        }
        Insert: {
          coach_id?: string | null
          email?: string | null
          id?: string
          kind?: string
          organization_id: string
          rate: number
          responded_at?: string | null
          sent_at?: string
          status?: string
          token?: string
        }
        Update: {
          coach_id?: string | null
          email?: string | null
          id?: string
          kind?: string
          organization_id?: string
          rate?: number
          responded_at?: string | null
          sent_at?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_rate_history: {
        Row: {
          coach_id: string
          effective_from: string
          id: string
          organization_id: string
          rate: number
        }
        Insert: {
          coach_id: string
          effective_from?: string
          id?: string
          organization_id: string
          rate: number
        }
        Update: {
          coach_id?: string
          effective_from?: string
          id?: string
          organization_id?: string
          rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "organization_rate_history_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_rate_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          about: string
          created_at: string
          id: string
          line: string
          logo_url: string | null
          name: string
          owner_coach_id: string
          pricing: Json
          slug: string
          updated_at: string
        }
        Insert: {
          about?: string
          created_at?: string
          id?: string
          line?: string
          logo_url?: string | null
          name: string
          owner_coach_id: string
          pricing?: Json
          slug: string
          updated_at?: string
        }
        Update: {
          about?: string
          created_at?: string
          id?: string
          line?: string
          logo_url?: string | null
          name?: string
          owner_coach_id?: string
          pricing?: Json
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_owner_coach_id_fkey"
            columns: ["owner_coach_id"]
            isOneToOne: true
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      package_purchases: {
        Row: {
          coach_id: string
          created_at: string
          expiry_date: string
          id: string
          package_id: string | null
          payment_intent_id: string | null
          purchase_date: string
          sessions_remaining: number
          sessions_total: number
          source: string
          source_booking_id: string | null
          status: string
          stripe_balance_txn: string | null
          stripe_charge_id: string | null
          stripe_fee: number | null
          stripe_fee_currency: string | null
          stripe_net_amount: number | null
          stripe_payment_intent: string | null
          stripe_session_id: string | null
          total_amount: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          coach_id: string
          created_at?: string
          expiry_date: string
          id?: string
          package_id?: string | null
          payment_intent_id?: string | null
          purchase_date?: string
          sessions_remaining: number
          sessions_total: number
          source?: string
          source_booking_id?: string | null
          status?: string
          stripe_balance_txn?: string | null
          stripe_charge_id?: string | null
          stripe_fee?: number | null
          stripe_fee_currency?: string | null
          stripe_net_amount?: number | null
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          total_amount?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          coach_id?: string
          created_at?: string
          expiry_date?: string
          id?: string
          package_id?: string | null
          payment_intent_id?: string | null
          purchase_date?: string
          sessions_remaining?: number
          sessions_total?: number
          source?: string
          source_booking_id?: string | null
          status?: string
          stripe_balance_txn?: string | null
          stripe_charge_id?: string | null
          stripe_fee?: number | null
          stripe_fee_currency?: string | null
          stripe_net_amount?: number | null
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          total_amount?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "package_purchases_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_purchases_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "coach_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_purchases_source_booking_id_fkey"
            columns: ["source_booking_id"]
            isOneToOne: false
            referencedRelation: "coach_slot_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partnership_inquiries: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          organization: string
          partnership_interest: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          organization: string
          partnership_interest: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          organization?: string
          partnership_interest?: string
        }
        Relationships: []
      }
      partnership_purchases: {
        Row: {
          created_at: string | null
          id: string
          order_count: number
          partnership_id: string | null
          stripe_balance_txn: string | null
          stripe_charge_id: string | null
          stripe_fee: number | null
          stripe_fee_currency: string | null
          stripe_net_amount: number | null
          stripe_payment_intent: string | null
          stripe_session_id: string | null
          total_amount: number
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_count: number
          partnership_id?: string | null
          stripe_balance_txn?: string | null
          stripe_charge_id?: string | null
          stripe_fee?: number | null
          stripe_fee_currency?: string | null
          stripe_net_amount?: number | null
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          total_amount: number
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          order_count?: number
          partnership_id?: string | null
          stripe_balance_txn?: string | null
          stripe_charge_id?: string | null
          stripe_fee?: number | null
          stripe_fee_currency?: string | null
          stripe_net_amount?: number | null
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          total_amount?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partnership_purchases_partnership_id_fkey"
            columns: ["partnership_id"]
            isOneToOne: false
            referencedRelation: "partnerships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partnership_purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partnerships: {
        Row: {
          benefits: Json | null
          created_at: string
          cta_label: string | null
          demo_video_url: string | null
          description: string
          detailed_description: string | null
          duration: string
          features: Json | null
          id: string
          is_active: boolean
          logo: string | null
          name: string
          preview_images: string[] | null
          price: number
          sport_type: Database["public"]["Enums"]["sport_type"] | null
          status: Database["public"]["Enums"]["partnership_status"]
          stripe_price_id: string | null
        }
        Insert: {
          benefits?: Json | null
          created_at?: string
          cta_label?: string | null
          demo_video_url?: string | null
          description: string
          detailed_description?: string | null
          duration?: string
          features?: Json | null
          id?: string
          is_active?: boolean
          logo?: string | null
          name: string
          preview_images?: string[] | null
          price?: number
          sport_type?: Database["public"]["Enums"]["sport_type"] | null
          status?: Database["public"]["Enums"]["partnership_status"]
          stripe_price_id?: string | null
        }
        Update: {
          benefits?: Json | null
          created_at?: string
          cta_label?: string | null
          demo_video_url?: string | null
          description?: string
          detailed_description?: string | null
          duration?: string
          features?: Json | null
          id?: string
          is_active?: boolean
          logo?: string | null
          name?: string
          preview_images?: string[] | null
          price?: number
          sport_type?: Database["public"]["Enums"]["sport_type"] | null
          status?: Database["public"]["Enums"]["partnership_status"]
          stripe_price_id?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          booking_id: string
          coach_offer_amount: number
          currency: string
          id: string
          payment_id: number
          platform_fee_amount: number
          slot_id: string
          stripe_balance_txn: string | null
          stripe_charge_id: string | null
          stripe_fee_currency: string | null
          stripe_fees: number | null
          stripe_net_amount: number | null
          stripe_payment_intent: string | null
          stripe_price_amount: number
          stripe_session_id: string | null
          total_amount: number
          transaction_time: string
          type: string
        }
        Insert: {
          booking_id: string
          coach_offer_amount?: number
          currency?: string
          id?: string
          payment_id?: never
          platform_fee_amount?: number
          slot_id: string
          stripe_balance_txn?: string | null
          stripe_charge_id?: string | null
          stripe_fee_currency?: string | null
          stripe_fees?: number | null
          stripe_net_amount?: number | null
          stripe_payment_intent?: string | null
          stripe_price_amount?: number
          stripe_session_id?: string | null
          total_amount: number
          transaction_time?: string
          type: string
        }
        Update: {
          booking_id?: string
          coach_offer_amount?: number
          currency?: string
          id?: string
          payment_id?: never
          platform_fee_amount?: number
          slot_id?: string
          stripe_balance_txn?: string | null
          stripe_charge_id?: string | null
          stripe_fee_currency?: string | null
          stripe_fees?: number | null
          stripe_net_amount?: number | null
          stripe_payment_intent?: string | null
          stripe_price_amount?: number
          stripe_session_id?: string | null
          total_amount?: number
          transaction_time?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "coach_slot_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "coach_availability_slot_occurrences"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_transfers: {
        Row: {
          amount: number
          booking_id: string | null
          coach_id: string
          created_at: string
          currency: string
          error: string | null
          id: string
          invoice_id: string | null
          kind: string
          organization_id: string | null
          package_purchase_id: string | null
          sent_at: string | null
          status: string
          stripe_charge_id: string | null
          stripe_transfer_id: string | null
        }
        Insert: {
          amount: number
          booking_id?: string | null
          coach_id: string
          created_at?: string
          currency?: string
          error?: string | null
          id?: string
          invoice_id?: string | null
          kind: string
          organization_id?: string | null
          package_purchase_id?: string | null
          sent_at?: string | null
          status?: string
          stripe_charge_id?: string | null
          stripe_transfer_id?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string | null
          coach_id?: string
          created_at?: string
          currency?: string
          error?: string | null
          id?: string
          invoice_id?: string | null
          kind?: string
          organization_id?: string | null
          package_purchase_id?: string | null
          sent_at?: string | null
          status?: string
          stripe_charge_id?: string | null
          stripe_transfer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payout_transfers_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "coach_slot_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_transfers_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_transfers_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "coach_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_transfers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_transfers_package_purchase_id_fkey"
            columns: ["package_purchase_id"]
            isOneToOne: false
            referencedRelation: "package_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_policy: {
        Row: {
          content: string
          created_at: string
          id: string
          is_published: boolean
          last_updated: string
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_published?: boolean
          last_updated: string
          title?: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_published?: boolean
          last_updated?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      security_audit_logs: {
        Row: {
          accessed_user_id: string | null
          action: string
          id: string
          ip_address: unknown
          success: boolean | null
          table_name: string
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          accessed_user_id?: string | null
          action: string
          id?: string
          ip_address?: unknown
          success?: boolean | null
          table_name: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          accessed_user_id?: string | null
          action?: string
          id?: string
          ip_address?: unknown
          success?: boolean | null
          table_name?: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      session_feedback_v2: {
        Row: {
          coach_id: string
          created_at: string
          created_by: string | null
          edit_count: number
          id: string
          no_show: boolean
          rating: number | null
          slot_id: string
          status: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          created_by?: string | null
          edit_count?: number
          id?: string
          no_show?: boolean
          rating?: number | null
          slot_id: string
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          created_by?: string | null
          edit_count?: number
          id?: string
          no_show?: boolean
          rating?: number | null
          slot_id?: string
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_feedback_v2_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_feedback_v2_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: true
            referencedRelation: "coach_availability_slot_occurrences"
            referencedColumns: ["id"]
          },
        ]
      }
      session_scores: {
        Row: {
          coach_id: string
          score: number
          slot_id: string
          updated_at: string
        }
        Insert: {
          coach_id: string
          score: number
          slot_id: string
          updated_at?: string
        }
        Update: {
          coach_id?: string
          score?: number
          slot_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_scores_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_scores_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: true
            referencedRelation: "coach_availability_slot_occurrences"
            referencedColumns: ["id"]
          },
        ]
      }
      slot_attendance_v2: {
        Row: {
          athlete_id: string
          attendance: Database["public"]["Enums"]["attendance_status"]
          booking_id: string
          created_at: string
          created_by: string | null
          id: string
          reason_absent: string | null
          slot_id: string
          updated_at: string
        }
        Insert: {
          athlete_id: string
          attendance?: Database["public"]["Enums"]["attendance_status"]
          booking_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          reason_absent?: string | null
          slot_id: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          attendance?: Database["public"]["Enums"]["attendance_status"]
          booking_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          reason_absent?: string | null
          slot_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "slot_attendance_v2_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_attendance_v2_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "coach_slot_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_attendance_v2_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "coach_availability_slot_occurrences"
            referencedColumns: ["id"]
          },
        ]
      }
      slot_feedback_v2: {
        Row: {
          athlete_id: string
          athlete_rated_at: string | null
          booking_id: string
          coach_edit_count: number
          coach_id: string | null
          coach_notes: string | null
          coach_only_notes: string | null
          coach_rating_of_athlete: number | null
          comment: string | null
          created_at: string
          created_by: string | null
          edit_count: number
          feedback_to_athlete: string | null
          highlighted_skills: string[] | null
          id: string
          rating: number | null
          skills: string[] | null
          slot_id: string
          status: string
          updated_at: string
        }
        Insert: {
          athlete_id: string
          athlete_rated_at?: string | null
          booking_id: string
          coach_edit_count?: number
          coach_id?: string | null
          coach_notes?: string | null
          coach_only_notes?: string | null
          coach_rating_of_athlete?: number | null
          comment?: string | null
          created_at?: string
          created_by?: string | null
          edit_count?: number
          feedback_to_athlete?: string | null
          highlighted_skills?: string[] | null
          id?: string
          rating?: number | null
          skills?: string[] | null
          slot_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          athlete_rated_at?: string | null
          booking_id?: string
          coach_edit_count?: number
          coach_id?: string | null
          coach_notes?: string | null
          coach_only_notes?: string | null
          coach_rating_of_athlete?: number | null
          comment?: string | null
          created_at?: string
          created_by?: string | null
          edit_count?: number
          feedback_to_athlete?: string | null
          highlighted_skills?: string[] | null
          id?: string
          rating?: number | null
          skills?: string[] | null
          slot_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "slot_feedback_v2_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_feedback_v2_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "coach_slot_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_feedback_v2_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_feedback_v2_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "coach_availability_slot_occurrences"
            referencedColumns: ["id"]
          },
        ]
      }
      sport_pillars: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          sport: Database["public"]["Enums"]["sport_type"] | null
          title: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          sport?: Database["public"]["Enums"]["sport_type"] | null
          title?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          sport?: Database["public"]["Enums"]["sport_type"] | null
          title?: string | null
        }
        Relationships: []
      }
      sports_options: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      sports_votes: {
        Row: {
          created_at: string
          id: string
          sport_option_id: string
          voter_ip_hash: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          sport_option_id: string
          voter_ip_hash?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          sport_option_id?: string
          voter_ip_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_sports_votes_sport_option_id"
            columns: ["sport_option_id"]
            isOneToOne: false
            referencedRelation: "sports_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sports_votes_sport_option_id_fkey"
            columns: ["sport_option_id"]
            isOneToOne: false
            referencedRelation: "sports_options"
            referencedColumns: ["id"]
          },
        ]
      }
      terms_and_conditions: {
        Row: {
          content: string
          created_at: string
          id: string
          is_active: boolean
          last_updated: string
          title: string
          updated_at: string
          version: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_updated: string
          title: string
          updated_at?: string
          version?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_updated?: string
          title?: string
          updated_at?: string
          version?: string | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          athlete_id: string | null
          coach_id: string | null
          created_at: string | null
          date_of_birth: string | null
          deletion_requested_at: string | null
          email: string
          gender: Database["public"]["Enums"]["gender_type"] | null
          guardian_relationship: string | null
          id: string
          image_url: string | null
          instagram_handle: string | null
          is_active: boolean
          is_admin: boolean
          is_profile_completed: boolean
          name: string
          notification_prefs: Json
          notifications_seen_at: string | null
          persona_type: string | null
          phone_number: string | null
          position: string | null
          sport: string | null
          timezone: string | null
          updated_at: string | null
          website: string | null
          zip_code: string | null
        }
        Insert: {
          athlete_id?: string | null
          coach_id?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          deletion_requested_at?: string | null
          email: string
          gender?: Database["public"]["Enums"]["gender_type"] | null
          guardian_relationship?: string | null
          id?: string
          image_url?: string | null
          instagram_handle?: string | null
          is_active?: boolean
          is_admin?: boolean
          is_profile_completed?: boolean
          name: string
          notification_prefs?: Json
          notifications_seen_at?: string | null
          persona_type?: string | null
          phone_number?: string | null
          position?: string | null
          sport?: string | null
          timezone?: string | null
          updated_at?: string | null
          website?: string | null
          zip_code?: string | null
        }
        Update: {
          athlete_id?: string | null
          coach_id?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          deletion_requested_at?: string | null
          email?: string
          gender?: Database["public"]["Enums"]["gender_type"] | null
          guardian_relationship?: string | null
          id?: string
          image_url?: string | null
          instagram_handle?: string | null
          is_active?: boolean
          is_admin?: boolean
          is_profile_completed?: boolean
          name?: string
          notification_prefs?: Json
          notifications_seen_at?: string | null
          persona_type?: string | null
          phone_number?: string | null
          position?: string | null
          sport?: string | null
          timezone?: string | null
          updated_at?: string | null
          website?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acknowledge_coach_referral: {
        Args: { _accept: boolean; _referral_id: string }
        Returns: undefined
      }
      admin_org_owner_ids: { Args: never; Returns: string[] }
      admin_prepare_account_deletion: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      admin_set_org_owner: {
        Args: { p_coach_id: string; p_enabled: boolean }
        Returns: string
      }
      allocate_coach_slug: {
        Args: { p_coach_id?: string; p_name: string }
        Returns: string
      }
      attest_coach_referral: {
        Args: { _answer: string; _referral_id: string }
        Returns: undefined
      }
      booking_coach_card: {
        Args: { p_athlete_id: string; p_coach_id: string }
        Returns: Json
      }
      cancel_my_booking: {
        Args: { p_booking_id: string; p_reason?: string }
        Returns: Json
      }
      cancel_organization_invite: {
        Args: { p_invite_id: string }
        Returns: undefined
      }
      canonical_pillar: { Args: { p_title: string }; Returns: string }
      ccr_confirm_row: {
        Args: { _athlete: string; _referral_id: string; _source: string }
        Returns: string
      }
      change_organization_rate: {
        Args: { p_coach_id: string; p_rate: number }
        Returns: string
      }
      check_contact_rate_limit: {
        Args: { p_email: string; p_minutes?: number }
        Returns: boolean
      }
      claim_coach_referral: {
        Args: { _answer: string; _token: string }
        Returns: string
      }
      cleanup_old_partnership_inquiries: {
        Args: { retention_days?: number }
        Returns: number
      }
      coach_book_athlete: {
        Args: {
          p_athlete_id: string
          p_occurrence_ids: string[]
          p_payment: string
        }
        Returns: string[]
      }
      coach_credits_left: {
        Args: { p_athlete_id: string; p_coach_id: string }
        Returns: number
      }
      coach_is_busy: {
        Args: {
          p_coach_id: string
          p_date: string
          p_end: string
          p_start: string
        }
        Returns: boolean
      }
      coach_roster_ids: { Args: { p_coach_id: string }; Returns: string[] }
      coach_undo_booking: { Args: { p_booking_ids: string[] }; Returns: number }
      create_coach_invoice: {
        Args: {
          p_amount: number
          p_athlete_id: string
          p_due: string
          p_note: string
          p_service: string
        }
        Returns: string
      }
      current_athlete_id: { Args: never; Returns: string }
      current_coach_id: { Args: never; Returns: string }
      delete_old_pending_bookings: { Args: never; Returns: undefined }
      detect_spam_submission: {
        Args: { p_email: string; p_message: string }
        Returns: boolean
      }
      eastern_timestamp: {
        Args: { p_date: string; p_time: string }
        Returns: string
      }
      ensure_coach_channel: { Args: { p_coach_id: string }; Returns: string }
      expire_booking_requests: {
        Args: { p_coach_id?: string }
        Returns: number
      }
      extend_rolling_availability: {
        Args: { p_availability_id?: string }
        Returns: number
      }
      fill_session_series: { Args: { p_series_id?: string }; Returns: number }
      get_athlete_home: { Args: never; Returns: Json }
      get_athlete_profile_stats: {
        Args: { p_athlete_id: string }
        Returns: {
          average_rating: number
          coaches_worked_with: number
          hours_trained: number
          sessions_completed: number
        }[]
      }
      get_athlete_session: { Args: { p_occurrence_id: string }; Returns: Json }
      get_bookable_sessions: {
        Args: { p_coach_id: string; p_from: string; p_to: string }
        Returns: Json
      }
      get_bookings_by_user_id: {
        Args: { athlete_id_param?: string; coach_id_param?: string }
        Returns: {
          athlete_count: number
          athletes_names: string[]
          availability_id: string
          booking_id: string
          coach_id: string
          coach_name: string
          has_session_feedback: boolean
          has_slot_feedback: boolean
          occurrence_id: string
          pillar_slot: string
          session_date: string
          slot_duration: number
          slot_end_time: string
          slot_location: string
          slot_price: number
          slot_session_name: string
          slot_session_type: string
          slot_start_time: string
          weekly_slot_id: string
        }[]
      }
      get_coach_athlete: { Args: { p_athlete_id: string }; Returns: Json }
      get_coach_athlete_options: {
        Args: never
        Returns: {
          athlete_id: string
          full_name: string
          last_session_date: string
          user_id: string
        }[]
      }
      get_coach_availability: {
        Args: { coach_id_param: string }
        Returns: {
          coach_id: string
          created_at: string
          end_date: string
          id: string
          occurrences: Json
          start_date: string
          updated_at: string
          weekly_slots: Json
        }[]
      }
      get_coach_availability_v2: {
        Args: { coach_id_param: string }
        Returns: {
          coach_id: string
          created_at: string
          end_date: string
          id: string
          slots: Json
          start_date: string
          updated_at: string
        }[]
      }
      get_coach_booking_requests: {
        Args: never
        Returns: {
          athlete_birth_date: string
          athlete_id: string
          athlete_name: string
          athlete_photo: string
          athlete_position: string
          booking_id: string
          capacity: number
          end_time: string
          expires_at: string
          location: string
          notes: string
          occurrence_date: string
          occurrence_id: string
          payment_status: string
          place: string
          price: number
          requested_at: string
          session_name: string
          session_type: string
          start_time: string
          taken: number
        }[]
      }
      get_coach_channel: {
        Args: { p_coach_id: string }
        Returns: {
          conversation_id: string
          is_member: boolean
          member_count: number
          title: string
        }[]
      }
      get_coach_earnings: { Args: { p_days: number }; Returns: Json }
      get_coach_payments: { Args: never; Returns: Json }
      get_coach_rating_stats: {
        Args: { p_coach_id: string }
        Returns: {
          average_rating: number
          five_star: number
          four_star: number
          one_star: number
          three_star: number
          total_reviews: number
          two_star: number
        }[]
      }
      get_coach_reviews_public: {
        Args: { coach_uuid?: string }
        Returns: {
          coach_id: string
          created_at: string
          id: string
          rating: number
          review_text: string
          reviewer_name: string
          updated_at: string
        }[]
      }
      get_coach_roster: { Args: never; Returns: Json }
      get_coach_schedule: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      get_coach_session: { Args: { p_occurrence_id: string }; Returns: Json }
      get_coach_session_feedback_screen_v2: {
        Args: { p_slot_id: string }
        Returns: {
          athlete_age: string
          athlete_avatar: string
          athlete_bio: string
          athlete_email: string
          athlete_goals: string
          athlete_hometown: string
          athlete_id: string
          athlete_interests: string[]
          athlete_level: string
          athlete_name: string
          athlete_position: string
          athlete_school: string
          attendance: string
          availability_id: string
          booking_id: string
          coach_edit_count: number
          coach_id: string
          coach_notes: string
          coach_only_notes: string
          coach_rating_of_athlete: number
          comment: string
          edit_count: number
          feedback_to_athlete: string
          highlighted_skills: string[]
          pillar_slot: string
          rating: number
          reason_absent: string
          session_date: string
          session_edit_count: number
          session_rating: number
          session_summary: string
          slot_end_time: string
          slot_id: string
          slot_location: string
          slot_price: number
          slot_session_name: string
          slot_start_time: string
        }[]
      }
      get_coaches_public: {
        Args: never
        Returns: {
          age_max: number
          age_min: number
          availability: Json
          bio: string
          cancellation_policy: string
          coach_position: string
          company: string
          cover_image_urls: string[]
          created_at: string
          favourite_positions: string[]
          hourly_rate: number
          id: string
          image_url: string
          instagram_handle: string
          is_verified: boolean
          languages: string[]
          locations: string[]
          name: string
          pathway_tags: string[]
          positions: string[]
          profile_image_url: string
          rating: number
          response_time_hours: number
          session_types: string[]
          specialties: string[]
          sport_type: string
          status: string
          total_reviews: number
          updated_at: string
          years_experience: number
          zip_code: string
        }[]
      }
      get_community_members: {
        Args: { p_conversation_id: string }
        Returns: {
          avatar_url: string
          display_name: string
          is_you: boolean
          role: string
        }[]
      }
      get_conversation_safeguard: {
        Args: { p_conversation_id: string }
        Returns: Json
      }
      get_family_invoice: { Args: { p_invoice_id: string }; Returns: Json }
      get_feedback_due: { Args: never; Returns: Json }
      get_feedback_screen: { Args: { p_slot_id: string }; Returns: Json }
      get_group_offer: { Args: { p_offer_id: string }; Returns: Json }
      get_my_coaches: { Args: never; Returns: Json }
      get_my_notifications: { Args: never; Returns: Json }
      get_my_organization: { Args: never; Returns: Json }
      get_or_create_my_coach_channel: { Args: never; Returns: string }
      get_organization_invite: { Args: { p_token: string }; Returns: Json }
      get_organization_sessions: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      get_organizations_public: { Args: never; Returns: Json }
      get_partnership_summary: {
        Args: never
        Returns: {
          full_name: string
          order_count: number
          order_date: string
          orders_today_count: number
          partner_name: string
          total_amount: number
          total_partnerships_count: number
        }[]
      }
      get_payment_reports: {
        Args: never
        Returns: {
          athlete_name: string
          coach_name: string
          coach_offer_amount: number
          net_amount: number
          payment_id: number
          platform_fee: number
          slot_name: string
          stripe_fee: number
          transaction_time: string
        }[]
      }
      get_pillar_coaches: {
        Args: { p_pillar: string; p_position?: string }
        Returns: Json
      }
      get_referral_invite: {
        Args: { _token: string }
        Returns: {
          client_name: string
          coach_id: string
          coach_name: string
          coach_slug: string
          email_matches: boolean
          is_athlete: boolean
          masked_email: string
          state: string
        }[]
      }
      get_roster_book_payment: { Args: { p_athlete_id: string }; Returns: Json }
      get_roster_open_times: {
        Args: { p_athlete_id: string; p_limit?: number }
        Returns: Json
      }
      get_session_for_booking: {
        Args: { p_occurrence_id: string }
        Returns: Json
      }
      get_session_roster: {
        Args: { p_occurrence_id: string }
        Returns: {
          display_name: string
          is_you: boolean
        }[]
      }
      get_sports_vote_counts: {
        Args: never
        Returns: {
          description: string
          icon: string
          id: string
          name: string
          vote_count: number
        }[]
      }
      get_sports_vote_results: {
        Args: never
        Returns: {
          sport_description: string
          sport_icon: string
          sport_name: string
          sport_option_id: string
          vote_count: number
        }[]
      }
      get_user_free_consultation_count: {
        Args: { p_user_id: string }
        Returns: {
          per_coach_count: Json
          total_used: number
        }[]
      }
      get_waiting_suggestions: {
        Args: never
        Returns: {
          athlete_id: string
          athlete_name: string
          end_time: string
          occurrence_date: string
          occurrence_id: string
          price: number
          start_time: string
          suggested_at: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      invite_organization_coach: {
        Args: { p_email: string; p_rate: number }
        Returns: string
      }
      is_coach_client: {
        Args: { p_athlete_id: string; p_coach_id: string }
        Returns: boolean
      }
      is_conversation_admin: {
        Args: { p_conversation_id: string }
        Returns: boolean
      }
      is_conversation_member: {
        Args: { p_conversation_id: string }
        Returns: boolean
      }
      is_my_athlete: { Args: { p_athlete_id: string }; Returns: boolean }
      is_own_client: {
        Args: { p_athlete_id: string; p_coach_id: string }
        Returns: boolean
      }
      is_reserved_coach_slug: { Args: { p_slug: string }; Returns: boolean }
      join_coach_channel: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      join_coach_community: { Args: { p_coach_id: string }; Returns: string }
      leave_coach_channel: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      log_pii_access: {
        Args: {
          p_accessed_user_id: string
          p_action: string
          p_table_name: string
        }
        Returns: undefined
      }
      mark_coach_invoice_paid: {
        Args: { p_invoice_id: string }
        Returns: undefined
      }
      mark_notifications_seen: { Args: never; Returns: undefined }
      message_session_families: {
        Args: { p_body: string; p_occurrence_id: string }
        Returns: number
      }
      message_session_families_to: {
        Args: { p_athlete_id: string; p_body: string }
        Returns: undefined
      }
      my_organization_id: { Args: never; Returns: string }
      notification_allowed: {
        Args: { p_channel: string; p_kind: string; p_user_id: string }
        Returns: boolean
      }
      open_family_conversation: {
        Args: { p_athlete_id: string }
        Returns: string
      }
      organization_slug: {
        Args: { p_name: string; p_org_id?: string }
        Returns: string
      }
      plan_booking_transfers: {
        Args: { p_booking_id: string }
        Returns: {
          amount: number
          booking_id: string | null
          coach_id: string
          created_at: string
          currency: string
          error: string | null
          id: string
          invoice_id: string | null
          kind: string
          organization_id: string | null
          package_purchase_id: string | null
          sent_at: string | null
          status: string
          stripe_charge_id: string | null
          stripe_transfer_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "payout_transfers"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      plan_invoice_transfers: {
        Args: { p_invoice_id: string }
        Returns: {
          amount: number
          booking_id: string | null
          coach_id: string
          created_at: string
          currency: string
          error: string | null
          id: string
          invoice_id: string | null
          kind: string
          organization_id: string | null
          package_purchase_id: string | null
          sent_at: string | null
          status: string
          stripe_charge_id: string | null
          stripe_transfer_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "payout_transfers"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      plan_package_transfers: {
        Args: { p_purchase_id: string }
        Returns: {
          amount: number
          booking_id: string | null
          coach_id: string
          created_at: string
          currency: string
          error: string | null
          id: string
          invoice_id: string | null
          kind: string
          organization_id: string | null
          package_purchase_id: string | null
          sent_at: string | null
          status: string
          stripe_charge_id: string | null
          stripe_transfer_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "payout_transfers"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      prepare_account_deletion: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      record_coach_share_event: {
        Args: { p_coach_id: string; p_event_type: string }
        Returns: undefined
      }
      redeem_coach_credit: { Args: { p_booking_id: string }; Returns: string }
      register_athlete_referral: {
        Args: { _coach_id: string }
        Returns: string
      }
      remind_coach_invoice: { Args: { p_invoice_id: string }; Returns: number }
      remove_organization_coach: {
        Args: { p_coach_id: string }
        Returns: undefined
      }
      rename_coach_slug: {
        Args: { p_coach_id: string; p_new_slug: string }
        Returns: string
      }
      request_session_time: {
        Args: {
          p_coach_id: string
          p_date: string
          p_note?: string
          p_pillar?: string
          p_start: string
        }
        Returns: string
      }
      resend_coach_referral: { Args: { _referral_id: string }; Returns: string }
      resend_organization_invite: {
        Args: { p_invite_id: string }
        Returns: string
      }
      resolve_coach_by_slug_or_id: { Args: { p_key: string }; Returns: string }
      respond_organization_invite: {
        Args: { p_accept: boolean; p_token: string }
        Returns: undefined
      }
      respond_to_booking_request: {
        Args: { p_accept: boolean; p_booking_id: string }
        Returns: string
      }
      run_due_account_deletions: { Args: never; Returns: number }
      save_organization_page: {
        Args: {
          p_about: string
          p_coaches: Json
          p_line: string
          p_logo_url: string
          p_name: string
          p_pricing: Json
        }
        Returns: string
      }
      schedule_cancel_session: {
        Args: { p_message: string; p_occurrence_id: string }
        Returns: number
      }
      schedule_clear_day: {
        Args: { p_date: string; p_note?: string }
        Returns: number
      }
      schedule_copy_groups: {
        Args: { p_days: number; p_from: string; p_to: string }
        Returns: number
      }
      schedule_create_sessions: { Args: { p_session: Json }; Returns: Json }
      schedule_drop_future: { Args: { p_series_id: string }; Returns: number }
      schedule_offer_session: {
        Args: {
          p_athlete_ids: string[]
          p_message: string
          p_occurrence_ids: string[]
          p_post_to_channel: boolean
        }
        Returns: Json
      }
      schedule_publish_groups: {
        Args: {
          p_closes_at: string
          p_from: string
          p_link_base: string
          p_message: string
          p_post_to_channel: boolean
          p_title: string
          p_to: string
        }
        Returns: string
      }
      schedule_remove_session: {
        Args: { p_occurrence_id: string }
        Returns: undefined
      }
      schedule_reschedule_session: {
        Args: {
          p_date: string
          p_message: string
          p_occurrence_id: string
          p_start: string
        }
        Returns: number
      }
      schedule_restore_day: { Args: { p_date: string }; Returns: number }
      schedule_set_rules: {
        Args: { p_booking_window_weeks: number; p_new_family_booking: string }
        Returns: undefined
      }
      schedule_stop_series: { Args: { p_series_id: string }; Returns: number }
      schedule_update_draft: {
        Args: { p_occurrence_id: string; p_session: Json }
        Returns: undefined
      }
      schedule_update_series: {
        Args: {
          p_location: string
          p_place: string
          p_series_id: string
          p_start_time: string
        }
        Returns: number
      }
      set_coach_athlete_note: {
        Args: { p_athlete_id: string; p_note: string }
        Returns: undefined
      }
      set_session_note: {
        Args: { p_booking_id: string; p_note: string }
        Returns: undefined
      }
      short_display_name: { Args: { p_full_name: string }; Returns: string }
      slugify_coach_name: { Args: { p_name: string }; Returns: string }
      submit_session_feedback: {
        Args: {
          p_absent: string[]
          p_score: number
          p_slot_id: string
          p_summary: string
        }
        Returns: Json
      }
      suggest_booking_time: {
        Args: {
          p_booking_id: string
          p_date: string
          p_message: string
          p_start: string
        }
        Returns: string
      }
      sync_availability_occurrences: {
        Args: { p_availability_id: string }
        Returns: undefined
      }
      upsert_occurrences: {
        Args: { p_availability_id: string; p_slots: Json }
        Returns: {
          availability_id: string | null
          coach_id: string
          created_at: string
          details: Json
          disabled_reason: string | null
          duration_minutes: number
          end_time: string
          id: string
          is_draft: boolean
          is_enabled: boolean
          location: string
          max_bookings_per_slot: number
          occurrence_date: string
          offered_to: string[]
          pillar_slot: string | null
          place: string | null
          position: string | null
          price: number
          series_id: string | null
          session_name: string
          session_type: string
          start_time: string
          updated_at: string
          visibility: string
          weekly_slot_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "coach_availability_slot_occurrences"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      upsert_occurrences_edit: {
        Args: { p_availability_id: string; p_slots: Json }
        Returns: {
          availability_id: string | null
          coach_id: string
          created_at: string
          details: Json
          disabled_reason: string | null
          duration_minutes: number
          end_time: string
          id: string
          is_draft: boolean
          is_enabled: boolean
          location: string
          max_bookings_per_slot: number
          occurrence_date: string
          offered_to: string[]
          pillar_slot: string | null
          place: string | null
          position: string | null
          price: number
          series_id: string | null
          session_name: string
          session_type: string
          start_time: string
          updated_at: string
          visibility: string
          weekly_slot_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "coach_availability_slot_occurrences"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      upsert_session_feedback_v2: {
        Args: { p_rating: number; p_slot_id: string; p_summary?: string }
        Returns: undefined
      }
      upsert_slot_attendance_v2: {
        Args: { p_attendance_records: Json }
        Returns: undefined
      }
      upsert_slot_feedback_v2: {
        Args: { p_feedback_records: Json }
        Returns: undefined
      }
      validate_instagram_handle: { Args: { handle: string }; Returns: boolean }
      validate_phone_number: { Args: { phone: string }; Returns: boolean }
      visible_sessions: {
        Args: {
          p_athlete_id: string
          p_coach_id: string
          p_from: string
          p_to: string
        }
        Returns: {
          booked_count: number
          capacity: number
          coach_id: string
          details: Json
          duration_minutes: number
          end_time: string
          id: string
          location: string
          my_status: string
          occurrence_date: string
          pillar: string
          place: string
          position: string
          price: number
          session_name: string
          session_type: string
          start_time: string
          visibility: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "coach"
      attendance_status: "present" | "absent" | "no_show"
      gender_type: "male" | "female" | "other"
      partnership_status: "Available Now" | "Coming Soon"
      persona_type: "athlete" | "parent" | "coach"
      sport_type:
        | "soccer"
        | "rowing"
        | "basketball"
        | "tennis"
        | "swimming"
        | "track_field"
        | "other"
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
      app_role: ["admin", "moderator", "user", "coach"],
      attendance_status: ["present", "absent", "no_show"],
      gender_type: ["male", "female", "other"],
      partnership_status: ["Available Now", "Coming Soon"],
      persona_type: ["athlete", "parent", "coach"],
      sport_type: [
        "soccer",
        "rowing",
        "basketball",
        "tennis",
        "swimming",
        "track_field",
        "other",
      ],
    },
  },
} as const
