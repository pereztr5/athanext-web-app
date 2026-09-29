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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      athlete_profiles: {
        Row: {
          id: string
          user_id: string
          full_name: string
          date_of_birth: string
          sport: string
          position: string | null
          phone_number: string | null
          location: string | null
          tags: string[]
          pathway_tags: string[]
          profile_image_url: string | null
          cover_image_urls: string[]
          bio: string | null
          graduation_year: number | null
          current_year: string | null
          high_school: string | null
          gpa: number | null
          height: string | null
          weight: string | null
          dominant_hand: string | null
          profile_completed: boolean
          instagram_handle: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          full_name: string
          date_of_birth: string
          sport: string
          position?: string | null
          phone_number?: string | null
          location?: string | null
          tags?: string[]
          pathway_tags?: string[]
          profile_image_url?: string | null
          cover_image_urls?: string[]
          bio?: string | null
          graduation_year?: number | null
          current_year?: string | null
          high_school?: string | null
          gpa?: number | null
          height?: string | null
          weight?: string | null
          dominant_hand?: string | null
          profile_completed?: boolean
          instagram_handle?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          full_name?: string
          date_of_birth?: string
          sport?: string
          position?: string | null
          phone_number?: string | null
          location?: string | null
          tags?: string[]
          pathway_tags?: string[]
          profile_image_url?: string | null
          cover_image_urls?: string[]
          email?: string
          bio?: string | null
          graduation_year?: number | null
          current_year?: string | null
          high_school?: string | null
          gpa?: number | null
          height?: string | null
          weight?: string | null
          dominant_hand?: string | null
          profile_completed?: boolean
          instagram_handle?: string | null
          created_at?: string
          updated_at?: string
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
      coach_availability: {
        Row: {
          coach_id: string
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          start_time: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          start_time: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          start_time?: string
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
          {
            foreignKeyName: "fk_coach_availability_coach_id"
            columns: ["coach_id"]
            isOneToOne: false
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
      coaches: {
        Row: {
          availability: Json | null
          bio: string | null
          cancellation_policy: string | null
          company: string | null
          cover_image_urls: string[] | null
          created_at: string
          email: string | null
          favourite_positions: string[] | null
          hourly_rate: number
          id: string
          image_url: string | null
          instagram_handle: string | null
          is_verified: boolean | null
          requires_booking_confirmation: boolean
          languages: string[] | null
          locations: string[]
          name: string
          coach_position: string | null
          pathway_tags: string[]
          positions: string[] | null
          profile_faqs: Json
          profile_image_url: string | null
          rating: number | null
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
          availability?: Json | null
          bio?: string | null
          cancellation_policy?: string | null
          company?: string | null
          cover_image_urls?: string[] | null
          created_at?: string
          email?: string | null
          favourite_positions?: string[] | null
          hourly_rate?: number
          id?: string
          image_url?: string | null
          instagram_handle?: string | null
          is_verified?: boolean | null
          requires_booking_confirmation?: boolean
          languages?: string[] | null
          locations?: string[]
          name: string
          position?: string | null
          pathway_tags?: string[]
          positions?: string[] | null
          profile_faqs?: Json
          profile_image_url?: string | null
          rating?: number | null
          response_time_hours?: number | null
          session_types?: string[] | null
          slug?: string
          specialties?: string[]
          status?: string | null
          total_reviews?: number | null
          updated_at?: string
          years_experience?: number | null
        }
        Update: {
          availability?: Json | null
          bio?: string | null
          cancellation_policy?: string | null
          company?: string | null
          cover_image_urls?: string[] | null
          created_at?: string
          email?: string | null
          favourite_positions?: string[] | null
          hourly_rate?: number
          id?: string
          image_url?: string | null
          instagram_handle?: string | null
          is_verified?: boolean | null
          requires_booking_confirmation?: boolean
          languages?: string[] | null
          locations?: string[]
          name?: string
          position?: string | null
          pathway_tags?: string[]
          positions?: string[] | null
          profile_faqs?: Json
          profile_image_url?: string | null
          rating?: number | null
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
      conversations: {
        Row: {
          id: string
          created_by: string | null
          is_group: boolean | null
          owner_coach_id: string | null
          title: string | null
          last_message_text: string | null
          last_message_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          created_by?: string | null
          is_group?: boolean | null
          owner_coach_id?: string | null
          title?: string | null
          last_message_text?: string | null
          last_message_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          created_by?: string | null
          is_group?: boolean | null
          owner_coach_id?: string | null
          title?: string | null
          last_message_text?: string | null
          last_message_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          id: string
          conversation_id: string
          user_id: string
          last_read_at: string | null
          role: string | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          user_id: string
          last_read_at?: string | null
          role?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          user_id?: string
          last_read_at?: string | null
          role?: string | null
          created_at?: string
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
      messages: {
        Row: {
          id: string
          conversation_id: string
          sender_id: string
          body: string
          created_at: string
          edited_at: string | null
          status: string | null
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_id: string
          body: string
          created_at?: string
          edited_at?: string | null
          status?: string | null
        }
        Update: {
          id?: string
          conversation_id?: string
          sender_id?: string
          body?: string
          created_at?: string
          edited_at?: string | null
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
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
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
      package_purchases: {
        Row: {
          coach_id: string
          created_at: string
          expiry_date: string
          id: string
          package_id: string
          payment_intent_id: string | null
          purchase_date: string
          sessions_remaining: number
          sessions_total: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          expiry_date: string
          id?: string
          package_id: string
          payment_intent_id?: string | null
          purchase_date?: string
          sessions_remaining: number
          sessions_total: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          expiry_date?: string
          id?: string
          package_id?: string
          payment_intent_id?: string | null
          purchase_date?: string
          sessions_remaining?: number
          sessions_total?: number
          status?: string
          updated_at?: string
          user_id?: string
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
      partnerships: {
        Row: {
          benefits: Json | null
          created_at: string
          cta_label: string
          demo_video_url: string | null
          description: string
          detailed_description: string | null
          features: Json | null
          id: string
          is_active: boolean
          logo: string
          name: string
          preview_images: string[] | null
          price: number
          status: Database["public"]["Enums"]["partnership_status"]
          stripe_price_id: string | null
        }
        Insert: {
          benefits?: Json | null
          created_at?: string
          cta_label: string
          demo_video_url?: string | null
          description: string
          detailed_description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean
          logo: string
          name: string
          preview_images?: string[] | null
          price?: number
          status?: Database["public"]["Enums"]["partnership_status"]
          stripe_price_id?: string | null
        }
        Update: {
          benefits?: Json | null
          created_at?: string
          cta_label?: string
          demo_video_url?: string | null
          description?: string
          detailed_description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean
          logo?: string
          name?: string
          preview_images?: string[] | null
          price?: number
          status?: Database["public"]["Enums"]["partnership_status"]
          stripe_price_id?: string | null
        }
        Relationships: []
      }
      security_audit_logs: {
        Row: {
          accessed_user_id: string | null
          action: string
          id: string
          ip_address: unknown | null
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
          ip_address?: unknown | null
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
          ip_address?: unknown | null
          success?: boolean | null
          table_name?: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      slot_feedback_v2: {
        Row: {
          athlete_id: string
          booking_id: string
          coach_id: string | null
          coach_notes: string | null
          coach_only_notes: string | null
          athlete_rated_at: string | null
          coach_rating_of_athlete: number | null
          comment: string | null
          created_at: string
          created_by: string | null
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
          coach_id?: string | null
          coach_notes?: string | null
          coach_only_notes?: string | null
          coach_rating_of_athlete?: number | null
          comment?: string | null
          created_at?: string
          created_by?: string | null
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
          coach_id?: string | null
          coach_notes?: string | null
          coach_only_notes?: string | null
          coach_rating_of_athlete?: number | null
          comment?: string | null
          created_at?: string
          created_by?: string | null
          feedback_to_athlete?: string | null
          highlighted_skills?: string[] | null
          id?: string
          rating?: number | null
          skills?: string[] | null
          slot_id?: string
          status?: string
          updated_at?: string
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
      user_profiles: {
        Row: {
          athlete_id: string | null
          coach_id: string | null
          created_at: string | null
          date_of_birth: string | null
          email: string
          gender: string | null
          id: string
          is_profile_completed: boolean | null
          instagram_handle: string | null
          name: string
          persona_type: string | null
          phone_number: string | null
          position: string | null
          sport: string | null
          updated_at: string | null
          image_url: string | null
          website: string | null
          zip_code: string | null
          timezone: string | null
        }
        Insert: {
          athlete_id?: string | null
          coach_id?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email: string
          gender?: string | null
          id?: string
          is_profile_completed?: boolean | null
          instagram_handle?: string | null
          name: string
          persona_type?: string | null
          phone_number?: string | null
          position?: string | null
          sport?: string | null
          updated_at?: string | null
          website?: string | null
          zip_code?: string | null
          timezone?: string | null
        }
        Update: {
          athlete_id?: string | null
          coach_id?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string
          gender?: string | null
          id?: string
          is_profile_completed?: boolean | null
          instagram_handle?: string | null
          name?: string
          persona_type?: string | null
          phone_number?: string | null
          position?: string | null
          sport?: string | null
          updated_at?: string | null
          website?: string | null
          zip_code?: string | null
          timezone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
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
      resolve_coach_by_slug_or_id: {
        Args: { p_key: string }
        Returns: string
      }
      rename_coach_slug: {
        Args: { p_coach_id: string; p_new_slug: string }
        Returns: string
      }
      record_coach_share_event: {
        Args: { p_coach_id: string; p_event_type: string }
        Returns: undefined
      }
      allocate_coach_slug: {
        Args: { p_name: string; p_coach_id?: string }
        Returns: string
      }
      slugify_coach_name: {
        Args: { p_name: string }
        Returns: string
      }
      cleanup_old_partnership_inquiries: {
        Args: { retention_days?: number }
        Returns: number
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
      get_coach_feedback_v2: {
        Args: { p_coach_id: string }
        Returns: {
          athlete_id: string
          coach_id: string
          comment: string
          created_at: string
          id: string
          rating: number
          reviewer_name: string
        }[]
      }
      get_coaches_public: {
        Args: Record<PropertyKey, never>
        Returns: {
          availability: Json
          bio: string
          cancellation_policy: string
          coach_position: string
          company: string
          created_at: string
          is_verified: boolean
          hourly_rate: number
          id: string
          image_url: string
          instagram_handle: string
          languages: string[]
          locations: string[]
          name: string
          positions: string[]
          profile_image_url: string
          rating: number
          response_time_hours: number
          session_types: string[]
          specialties: string[]
          pathway_tags: string[]
          zip_code: string
          status: string
          total_reviews: number
          updated_at: string
          years_experience: number
        }[]
      }
      get_sports_vote_counts: {
        Args: Record<PropertyKey, never>
        Returns: {
          description: string
          icon: string
          id: string
          name: string
          vote_count: number
        }[]
      }
      get_sports_vote_results: {
        Args: Record<PropertyKey, never>
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_pii_access: {
        Args: {
          p_accessed_user_id: string
          p_action: string
          p_table_name: string
        }
        Returns: undefined
      }
      validate_instagram_handle: {
        Args: { handle: string }
        Returns: boolean
      }
      validate_phone_number: {
        Args: { phone: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "coach"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
