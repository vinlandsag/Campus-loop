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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      campuses: {
        Row: {
          approved_domains: string[]
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          approved_domains?: string[]
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          approved_domains?: string[]
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      event_series: {
        Row: {
          id: string
          organizer_id: string
          campus_id: string | null
          title: string
          slug: string
          description: string | null
          recurrence_type: 'weekly' | 'monthly' | 'custom'
          interval_value: number
          days_of_week: number[] | null
          end_type: 'date' | 'count'
          end_date: string | null
          occurrence_count: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organizer_id: string
          campus_id?: string | null
          title: string
          slug: string
          description?: string | null
          recurrence_type: 'weekly' | 'monthly' | 'custom'
          interval_value?: number
          days_of_week?: number[] | null
          end_type: 'date' | 'count'
          end_date?: string | null
          occurrence_count?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organizer_id?: string
          campus_id?: string | null
          title?: string
          slug?: string
          description?: string | null
          recurrence_type?: 'weekly' | 'monthly' | 'custom'
          interval_value?: number
          days_of_week?: number[] | null
          end_type?: 'date' | 'count'
          end_date?: string | null
          occurrence_count?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      event_registration_teams: {
        Row: {
          id: string
          event_id: string
          name: string
          leader_id: string
          invite_code: string
          status: 'forming' | 'complete' | 'disbanded'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          name: string
          leader_id: string
          invite_code: string
          status?: 'forming' | 'complete' | 'disbanded'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          name?: string
          leader_id?: string
          invite_code?: string
          status?: 'forming' | 'complete' | 'disbanded'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      event_registration_team_members: {
        Row: {
          id: string
          team_id: string
          user_id: string
          event_id: string
          registration_id: string | null
          role: 'leader' | 'member'
          status: 'pending' | 'confirmed'
          joined_at: string
        }
        Insert: {
          id?: string
          team_id: string
          user_id: string
          event_id: string
          registration_id?: string | null
          role?: 'leader' | 'member'
          status?: 'pending' | 'confirmed'
          joined_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          user_id?: string
          event_id?: string
          registration_id?: string | null
          role?: 'leader' | 'member'
          status?: 'pending' | 'confirmed'
          joined_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          active_registrations_count: number
          banner_url: string | null
          campus_id: string | null
          capacity: number | null
          category: string
          cancellation_reason: string | null
          change_notice: string | null
          created_at: string
          description: string | null
          end_time: string
          event_date: string
          id: string
          is_paid: boolean
          location: string
          organizer_id: string
          price: number | null
          rescheduled_at: string | null
          slug: string
          start_time: string
          status: Database["public"]["Enums"]["event_status"]
          timezone: string
          title: string
          updated_at: string
          agenda: Json | null
          speakers: Json | null
          eligibility: string | null
          registration_deadline: string | null
          what_to_bring: string | null
          contact_method: string | null
          accessibility_notes: string | null
          map_url: string | null
          series_id?: string | null
          series_sequence_index?: number | null
          is_series_override?: boolean
          registration_mode?: 'individual' | 'team' | 'both'
          min_team_size?: number | null
          max_team_size?: number | null
          max_teams?: number | null
        }
        Insert: {
          active_registrations_count?: number
          banner_url?: string | null
          campus_id?: string | null
          capacity?: number | null
          category: string
          cancellation_reason?: string | null
          change_notice?: string | null
          created_at?: string
          description?: string | null
          end_time: string
          event_date: string
          id?: string
          is_paid?: boolean
          location: string
          organizer_id: string
          price?: number | null
          rescheduled_at?: string | null
          slug: string
          start_time: string
          status?: Database["public"]["Enums"]["event_status"]
          timezone?: string
          title: string
          updated_at?: string
          agenda?: Json | null
          speakers?: Json | null
          eligibility?: string | null
          registration_deadline?: string | null
          what_to_bring?: string | null
          contact_method?: string | null
          accessibility_notes?: string | null
          map_url?: string | null
          series_id?: string | null
          series_sequence_index?: number | null
          is_series_override?: boolean
          registration_mode?: 'individual' | 'team' | 'both'
          min_team_size?: number | null
          max_team_size?: number | null
          max_teams?: number | null
        }
        Update: {
          active_registrations_count?: number
          banner_url?: string | null
          campus_id?: string | null
          capacity?: number | null
          category?: string
          cancellation_reason?: string | null
          change_notice?: string | null
          created_at?: string
          description?: string | null
          end_time?: string
          event_date?: string
          id?: string
          is_paid?: boolean
          location?: string
          organizer_id?: string
          price?: number | null
          rescheduled_at?: string | null
          slug?: string
          start_time?: string
          status?: Database["public"]["Enums"]["event_status"]
          timezone?: string
          title?: string
          updated_at?: string
          agenda?: Json | null
          speakers?: Json | null
          eligibility?: string | null
          registration_deadline?: string | null
          what_to_bring?: string | null
          contact_method?: string | null
          accessibility_notes?: string | null
          map_url?: string | null
          series_id?: string | null
          series_sequence_index?: number | null
          is_series_override?: boolean
          registration_mode?: 'individual' | 'team' | 'both'
          min_team_size?: number | null
          max_team_size?: number | null
          max_teams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "events_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          dedup_key: string | null
          email_error: string | null
          email_provider: string | null
          email_recipient: string | null
          email_sent_at: string | null
          email_status: "pending" | "sent" | "skipped_no_provider" | "failed" | "opted_out"
          event_id: string | null
          id: string
          is_read: boolean
          link: string | null
          message: string
          title: string
          type: "registration_confirmed" | "event_cancelled" | "event_rescheduled" | "venue_changed" | "reminder_24h" | "reminder_1h" | "waitlist_promoted" | "checked_in" | "reminder" | "announcement"
          user_id: string
        }
        Insert: {
          created_at?: string
          dedup_key?: string | null
          email_error?: string | null
          email_provider?: string | null
          email_recipient?: string | null
          email_sent_at?: string | null
          email_status?: "pending" | "sent" | "skipped_no_provider" | "failed" | "opted_out"
          event_id?: string | null
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          title: string
          type: "registration_confirmed" | "event_cancelled" | "event_rescheduled" | "venue_changed" | "reminder_24h" | "reminder_1h" | "waitlist_promoted" | "checked_in" | "reminder" | "announcement"
          user_id: string
        }
        Update: {
          created_at?: string
          dedup_key?: string | null
          email_error?: string | null
          email_provider?: string | null
          email_recipient?: string | null
          email_sent_at?: string | null
          email_status?: "pending" | "sent" | "skipped_no_provider" | "failed" | "opted_out"
          event_id?: string | null
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          title?: string
          type?: "registration_confirmed" | "event_cancelled" | "event_rescheduled" | "venue_changed" | "reminder_24h" | "reminder_1h" | "waitlist_promoted" | "checked_in" | "reminder" | "announcement"
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notification_preferences: {
        Row: {
          email_enabled: boolean
          event_updates: boolean
          marketing_announcements: boolean
          reminder_1h: boolean
          reminder_24h: boolean
          updated_at: string
          user_id: string
          waitlist_promotions: boolean
        }
        Insert: {
          email_enabled?: boolean
          event_updates?: boolean
          marketing_announcements?: boolean
          reminder_1h?: boolean
          reminder_24h?: boolean
          updated_at?: string
          user_id: string
          waitlist_promotions?: boolean
        }
        Update: {
          email_enabled?: boolean
          event_updates?: boolean
          marketing_announcements?: boolean
          reminder_1h?: boolean
          reminder_24h?: boolean
          updated_at?: string
          user_id?: string
          waitlist_promotions?: boolean
        }
        Relationships: []
      }
      notification_jobs: {
        Row: {
          attempts: number
          created_at: string
          emails_sent_count: number
          emails_skipped_count: number
          error: string | null
          event_id: string
          id: string
          job_type: "reminder_24h" | "reminder_1h" | "reschedule" | "venue_change" | "cancellation" | "registration_confirmed" | "waitlist_promoted"
          max_attempts: number
          processed_at: string | null
          recipients_count: number
          scheduled_for: string
          status: "pending" | "processing" | "completed" | "failed" | "cancelled"
        }
        Insert: {
          attempts?: number
          created_at?: string
          emails_sent_count?: number
          emails_skipped_count?: number
          error?: string | null
          event_id: string
          id?: string
          job_type: "reminder_24h" | "reminder_1h" | "reschedule" | "venue_change" | "cancellation" | "registration_confirmed" | "waitlist_promoted"
          max_attempts?: number
          processed_at?: string | null
          recipients_count?: number
          scheduled_for: string
          status?: "pending" | "processing" | "completed" | "failed" | "cancelled"
        }
        Update: {
          attempts?: number
          created_at?: string
          emails_sent_count?: number
          emails_skipped_count?: number
          error?: string | null
          event_id?: string
          id?: string
          job_type?: "reminder_24h" | "reminder_1h" | "reschedule" | "venue_change" | "cancellation" | "registration_confirmed" | "waitlist_promoted"
          max_attempts?: number
          processed_at?: string | null
          recipients_count?: number
          scheduled_for?: string
          status?: "pending" | "processing" | "completed" | "failed" | "cancelled"
        }
        Relationships: [
          {
            foreignKeyName: "notification_jobs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_feedback: {
        Row: {
          created_at: string
          event_id: string
          feedback: string | null
          has_issue: boolean
          id: string
          issue_category: "venue" | "organization" | "safety" | "audio_visual" | "scheduling" | "other" | null
          issue_description: string | null
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          feedback?: string | null
          has_issue?: boolean
          id?: string
          issue_category?: "venue" | "organization" | "safety" | "audio_visual" | "scheduling" | "other" | null
          issue_description?: string | null
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          feedback?: string | null
          has_issue?: boolean
          id?: string
          issue_category?: "venue" | "organization" | "safety" | "audio_visual" | "scheduling" | "other" | null
          issue_description?: string | null
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_feedback_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_reports: {
        Row: {
          admin_notes: string | null
          created_at: string
          details: string | null
          id: string
          reason: "spam" | "misleading" | "safety_concern" | "fraud" | "inappropriate" | "harassment" | "other"
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: "pending" | "investigating" | "action_taken" | "dismissed"
          target_id: string
          target_type: "event" | "organizer"
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          details?: string | null
          id?: string
          reason: "spam" | "misleading" | "safety_concern" | "fraud" | "inappropriate" | "harassment" | "other"
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: "pending" | "investigating" | "action_taken" | "dismissed"
          target_id: string
          target_type: "event" | "organizer"
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          details?: string | null
          id?: string
          reason?: "spam" | "misleading" | "safety_concern" | "fraud" | "inappropriate" | "harassment" | "other"
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: "pending" | "investigating" | "action_taken" | "dismissed"
          target_id?: string
          target_type?: "event" | "organizer"
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          campus_id: string | null
          college: string | null
          created_at: string
          department: string | null
          email: string
          full_name: string
          id: string
          is_verified: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          year: string | null
          bio: string | null
          website_url: string | null
          instagram_handle: string | null
          contact_email: string | null
          show_college: boolean
          show_department: boolean
          show_email: boolean
          campus_verification_status: "unverified" | "pending" | "verified" | "exception"
          campus_exception_reason: string | null
          campus_verified_at: string | null
          pending_campus_id: string | null
          is_suspended: boolean
          suspended_at: string | null
          suspension_reason: string | null
        }
        Insert: {
          avatar_url?: string | null
          campus_id?: string | null
          college?: string | null
          created_at?: string
          department?: string | null
          email: string
          full_name: string
          id: string
          is_verified?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          year?: string | null
          bio?: string | null
          website_url?: string | null
          instagram_handle?: string | null
          contact_email?: string | null
          show_college?: boolean
          show_department?: boolean
          show_email?: boolean
          campus_verification_status?: "unverified" | "pending" | "verified" | "exception"
          campus_exception_reason?: string | null
          campus_verified_at?: string | null
          pending_campus_id?: string | null
          is_suspended?: boolean
          suspended_at?: string | null
          suspension_reason?: string | null
        }
        Update: {
          avatar_url?: string | null
          campus_id?: string | null
          college?: string | null
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string
          id?: string
          is_verified?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          year?: string | null
          bio?: string | null
          website_url?: string | null
          instagram_handle?: string | null
          contact_email?: string | null
          show_college?: boolean
          show_department?: boolean
          show_email?: boolean
          campus_verification_status?: "unverified" | "pending" | "verified" | "exception"
          campus_exception_reason?: string | null
          campus_verified_at?: string | null
          pending_campus_id?: string | null
          is_suspended?: boolean
          suspended_at?: string | null
          suspension_reason?: string | null
        }
        Relationships: []
      }
      registrations: {
        Row: {
          attendance_visibility: "private" | "friends" | "public"
          checked_in_at: string | null
          checked_in_by: string | null
          event_id: string
          id: string
          registered_at: string
          status: Database["public"]["Enums"]["registration_status"]
          ticket_code: string | null
          user_id: string
          waitlist_position: number | null
        }
        Insert: {
          attendance_visibility?: "private" | "friends" | "public"
          checked_in_at?: string | null
          checked_in_by?: string | null
          event_id: string
          id?: string
          registered_at?: string
          status?: Database["public"]["Enums"]["registration_status"]
          ticket_code?: string | null
          user_id: string
          waitlist_position?: number | null
        }
        Update: {
          attendance_visibility?: "private" | "friends" | "public"
          checked_in_at?: string | null
          checked_in_by?: string | null
          event_id?: string
          id?: string
          registered_at?: string
          status?: Database["public"]["Enums"]["registration_status"]
          ticket_code?: string | null
          user_id?: string
          waitlist_position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_team_members: {
        Row: {
          created_at: string
          event_id: string
          id: string
          invited_by: string | null
          role: "owner" | "editor" | "check_in_staff" | "viewer"
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          invited_by?: string | null
          role: "owner" | "editor" | "check_in_staff" | "viewer"
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          invited_by?: string | null
          role?: "owner" | "editor" | "check_in_staff" | "viewer"
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      event_registration_questions: {
        Row: {
          created_at: string
          event_id: string
          id: string
          is_required: boolean
          options: Json | null
          question_text: string
          question_type: "text" | "select" | "checkbox" | "textarea"
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          is_required?: boolean
          options?: Json | null
          question_text: string
          question_type: "text" | "select" | "checkbox" | "textarea"
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          is_required?: boolean
          options?: Json | null
          question_text?: string
          question_type?: "text" | "select" | "checkbox" | "textarea"
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      registration_answers: {
        Row: {
          answer_text: string
          created_at: string
          id: string
          question_id: string
          registration_id: string
        }
        Insert: {
          answer_text: string
          created_at?: string
          id?: string
          question_id: string
          registration_id: string
        }
        Update: {
          answer_text?: string
          created_at?: string
          id?: string
          question_id?: string
          registration_id?: string
        }
        Relationships: []
      }
      event_announcements: {
        Row: {
          created_at: string
          event_id: string
          id: string
          message: string
          recipient_count: number
          sent_by: string | null
          target_filter: "all" | "registered" | "checked_in" | "waitlisted"
          title: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          message: string
          recipient_count?: number
          sent_by?: string | null
          target_filter?: "all" | "registered" | "checked_in" | "waitlisted"
          title: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          message?: string
          recipient_count?: number
          sent_by?: string | null
          target_filter?: "all" | "registered" | "checked_in" | "waitlisted"
          title?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          id: string
          metadata: Json
          reason: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      system_admins: {
        Row: {
          granted_at: string
          granted_by: string | null
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action: string
          count: number
          created_at: string
          expires_at: string
          id: string
          key: string
          window_start: string
        }
        Insert: {
          action: string
          count?: number
          created_at?: string
          expires_at: string
          id?: string
          key: string
          window_start?: string
        }
        Update: {
          action?: string
          count?: number
          created_at?: string
          expires_at?: string
          id?: string
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      club_follows: {
        Row: {
          created_at: string
          id: string
          notify_on_new_events: boolean
          organizer_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notify_on_new_events?: boolean
          organizer_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notify_on_new_events?: boolean
          organizer_id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_social_preferences: {
        Row: {
          allow_friend_requests: boolean
          created_at: string
          default_attendance_visibility: "private" | "friends" | "public"
          share_attendance_with_friends: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_friend_requests?: boolean
          created_at?: string
          default_attendance_visibility?: "private" | "friends" | "public"
          share_attendance_with_friends?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_friend_requests?: boolean
          created_at?: string
          default_attendance_visibility?: "private" | "friends" | "public"
          share_attendance_with_friends?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          status: "pending" | "accepted" | "declined" | "blocked"
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          status: "pending" | "accepted" | "declined" | "blocked"
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          status?: "pending" | "accepted" | "declined" | "blocked"
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      organizer_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          campus_id: string | null
          college: string | null
          contact_email: string | null
          department: string | null
          full_name: string | null
          id: string | null
          instagram_handle: string | null
          is_verified: boolean | null
          website_url: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_delete_event: {
        Args: {
          p_event_id: string
          p_reason: string
          p_admin_notes?: string | null
        }
        Returns: Json
      }
      get_organizer_profile: {
        Args: {
          p_organizer_id: string
        }
        Returns: {
          avatar_url: string | null
          bio: string | null
          campus_id: string | null
          college: string | null
          contact_email: string | null
          department: string | null
          full_name: string
          id: string
          instagram_handle: string | null
          is_verified: boolean
          website_url: string | null
        }[]
      }
      register_for_event: {
        Args: {
          p_event_id: string
          p_answers?: Json | null
          p_allow_waitlist?: boolean
        }
        Returns: Json
      }
      cancel_registration: {
        Args: {
          p_event_id: string
        }
        Returns: Json
      }
      promote_next_waitlisted_attendee: {
        Args: {
          p_event_id: string
        }
        Returns: Json
      }
      check_in_attendee: {
        Args: {
          p_event_id: string
          p_ticket_code: string
        }
        Returns: Json
      }
      get_event_feedback_aggregate: {
        Args: {
          p_event_id: string
        }
        Returns: Json
      }
      check_rate_limit: {
        Args: {
          p_key: string
          p_action: string
          p_max_requests: number
          p_window_seconds: number
        }
        Returns: Json
      }
      is_admin: {
        Args: {
          p_user_id?: string
        }
        Returns: boolean
      }
      get_organizer_follower_count: {
        Args: {
          p_organizer_id: string
        }
        Returns: number
      }
      get_event_friend_attendance: {
        Args: {
          p_event_id: string
        }
        Returns: Json
      }
      are_friends: {
        Args: {
          user_a: string
          user_b: string
        }
        Returns: boolean
      }
    }
    Enums: {
      event_status: "draft" | "published" | "cancelled" | "completed"
      registration_status: "registered" | "waitlisted" | "checked_in" | "cancelled"
      user_role: "student" | "organizer"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      event_status: ["draft", "published", "cancelled", "completed"],
      registration_status: ["registered", "waitlisted", "cancelled", "checked_in"],
      user_role: ["student", "organizer"],
    },
  },
} as const
