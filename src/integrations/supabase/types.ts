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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      academies: {
        Row: {
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          owner_user_id: string
          slug: string
          storage_quota_mb: number
          storage_used_mb: number
          updated_at: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_user_id: string
          slug: string
          storage_quota_mb?: number
          storage_used_mb?: number
          updated_at?: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_user_id?: string
          slug?: string
          storage_quota_mb?: number
          storage_used_mb?: number
          updated_at?: string
        }
        Relationships: []
      }
      academy_access: {
        Row: {
          academy_id: string
          granted_at: string
          granted_by: string | null
          user_id: string
        }
        Insert: {
          academy_id: string
          granted_at?: string
          granted_by?: string | null
          user_id: string
        }
        Update: {
          academy_id?: string
          granted_at?: string
          granted_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_access_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_file_progress: {
        Row: {
          completed_at: string
          file_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          file_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          file_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_file_progress_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "academy_files"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_files: {
        Row: {
          academy_id: string
          category: string | null
          created_at: string
          description: string | null
          file_size_mb: number | null
          file_type: string
          file_url: string
          id: string
          is_external: boolean
          section_id: string | null
          sort_order: number
          title: string
          uploaded_by: string
        }
        Insert: {
          academy_id: string
          category?: string | null
          created_at?: string
          description?: string | null
          file_size_mb?: number | null
          file_type: string
          file_url: string
          id?: string
          is_external?: boolean
          section_id?: string | null
          sort_order?: number
          title: string
          uploaded_by: string
        }
        Update: {
          academy_id?: string
          category?: string | null
          created_at?: string
          description?: string | null
          file_size_mb?: number | null
          file_type?: string
          file_url?: string
          id?: string
          is_external?: boolean
          section_id?: string | null
          sort_order?: number
          title?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_files_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_files_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "academy_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_lesson_comments: {
        Row: {
          body: string
          created_at: string
          file_id: string
          id: string
          parent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          file_id: string
          id?: string
          parent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          file_id?: string
          id?: string
          parent_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_lesson_comments_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "academy_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_lesson_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "academy_lesson_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_sections: {
        Row: {
          academy_id: string
          created_at: string
          description: string | null
          id: string
          sort_order: number
          title: string
        }
        Insert: {
          academy_id: string
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number
          title: string
        }
        Update: {
          academy_id?: string
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_sections_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          contact_id: string | null
          created_at: string
          date: string
          duration: number | null
          id: string
          location: string | null
          notes: string | null
          status: Database["public"]["Enums"]["appointment_status"]
          title: string
          type: Database["public"]["Enums"]["appointment_type"]
          user_id: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          date: string
          duration?: number | null
          id?: string
          location?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          title: string
          type?: Database["public"]["Enums"]["appointment_type"]
          user_id: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          date?: string
          duration?: number | null
          id?: string
          location?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          title?: string
          type?: Database["public"]["Enums"]["appointment_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          color: string
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          owner_id: string
          slug: string
          start_date: string | null
          status: string
          tag: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          owner_id: string
          slug: string
          start_date?: string | null
          status?: string
          tag: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          owner_id?: string
          slug?: string
          start_date?: string | null
          status?: string
          tag?: string
          updated_at?: string
        }
        Relationships: []
      }
      commission_import_rows: {
        Row: {
          amount: number | null
          created_at: string
          details: string | null
          id: string
          import_id: string
          is_owner_row: boolean
          match_confidence: number | null
          match_status: Database["public"]["Enums"]["match_status"]
          matched_member_id: string | null
          raw_data: Json
        }
        Insert: {
          amount?: number | null
          created_at?: string
          details?: string | null
          id?: string
          import_id: string
          is_owner_row?: boolean
          match_confidence?: number | null
          match_status?: Database["public"]["Enums"]["match_status"]
          matched_member_id?: string | null
          raw_data?: Json
        }
        Update: {
          amount?: number | null
          created_at?: string
          details?: string | null
          id?: string
          import_id?: string
          is_owner_row?: boolean
          match_confidence?: number | null
          match_status?: Database["public"]["Enums"]["match_status"]
          matched_member_id?: string | null
          raw_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "commission_import_rows_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "commission_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_import_rows_matched_member_id_fkey"
            columns: ["matched_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_imports: {
        Row: {
          column_mapping: Json | null
          file_name: string
          file_url: string | null
          id: string
          notes: string | null
          period: string
          processed_at: string | null
          stats: Json | null
          status: Database["public"]["Enums"]["import_status"]
          uploaded_at: string
          user_id: string
        }
        Insert: {
          column_mapping?: Json | null
          file_name: string
          file_url?: string | null
          id?: string
          notes?: string | null
          period: string
          processed_at?: string | null
          stats?: Json | null
          status?: Database["public"]["Enums"]["import_status"]
          uploaded_at?: string
          user_id: string
        }
        Update: {
          column_mapping?: Json | null
          file_name?: string
          file_url?: string | null
          id?: string
          notes?: string | null
          period?: string
          processed_at?: string | null
          stats?: Json | null
          status?: Database["public"]["Enums"]["import_status"]
          uploaded_at?: string
          user_id?: string
        }
        Relationships: []
      }
      commissions: {
        Row: {
          amount: number
          created_at: string
          deal_id: string | null
          id: string
          import_row_id: string | null
          notes: string | null
          period: string
          source: Database["public"]["Enums"]["commission_source"]
          status: Database["public"]["Enums"]["commission_status"]
          team_member_id: string | null
          type: Database["public"]["Enums"]["commission_type"]
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          deal_id?: string | null
          id?: string
          import_row_id?: string | null
          notes?: string | null
          period: string
          source?: Database["public"]["Enums"]["commission_source"]
          status?: Database["public"]["Enums"]["commission_status"]
          team_member_id?: string | null
          type: Database["public"]["Enums"]["commission_type"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          deal_id?: string | null
          id?: string
          import_row_id?: string | null
          notes?: string | null
          period?: string
          source?: Database["public"]["Enums"]["commission_source"]
          status?: Database["public"]["Enums"]["commission_status"]
          team_member_id?: string | null
          type?: Database["public"]["Enums"]["commission_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_import_row_id_fkey"
            columns: ["import_row_id"]
            isOneToOne: false
            referencedRelation: "commission_import_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_link_clicks: {
        Row: {
          campaign_id: string | null
          contact_id: string | null
          created_at: string
          id: string
          profile_owner_id: string
          source: string
          user_agent: string | null
        }
        Insert: {
          campaign_id?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          profile_owner_id: string
          source: string
          user_agent?: string | null
        }
        Update: {
          campaign_id?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          profile_owner_id?: string
          source?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_link_clicks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_link_clicks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_notes: {
        Row: {
          contact_id: string
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          contact_id: string
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          contact_id?: string
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_notes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: string | null
          campaign_id: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          last_contacted_at: string | null
          last_name: string
          link_source: string | null
          notes: string | null
          phone: string | null
          pipeline_stage_id: string | null
          priority: Database["public"]["Enums"]["contact_priority"]
          source: string | null
          status: Database["public"]["Enums"]["contact_status"]
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          campaign_id?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          last_contacted_at?: string | null
          last_name: string
          link_source?: string | null
          notes?: string | null
          phone?: string | null
          pipeline_stage_id?: string | null
          priority?: Database["public"]["Enums"]["contact_priority"]
          source?: string | null
          status?: Database["public"]["Enums"]["contact_status"]
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          campaign_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          last_contacted_at?: string | null
          last_name?: string
          link_source?: string | null
          notes?: string | null
          phone?: string | null
          pipeline_stage_id?: string | null
          priority?: Database["public"]["Enums"]["contact_priority"]
          source?: string | null
          status?: Database["public"]["Enums"]["contact_status"]
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_pipeline_stage_id_fkey"
            columns: ["pipeline_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          amount: number
          bank_fees_offered: boolean
          commission_actual: number | null
          commission_direct: number | null
          contact_id: string | null
          created_at: string
          deal_type: string | null
          id: string
          loss_reason: string | null
          loss_reason_category: string | null
          notes: string | null
          payment_months: number | null
          payment_type: string
          product: string | null
          signed_at: string | null
          sold_at: string | null
          sold_by: string | null
          status: Database["public"]["Enums"]["deal_status"]
          updated_at: string
          user_id: string
          validated_at: string | null
        }
        Insert: {
          amount?: number
          bank_fees_offered?: boolean
          commission_actual?: number | null
          commission_direct?: number | null
          contact_id?: string | null
          created_at?: string
          deal_type?: string | null
          id?: string
          loss_reason?: string | null
          loss_reason_category?: string | null
          notes?: string | null
          payment_months?: number | null
          payment_type?: string
          product?: string | null
          signed_at?: string | null
          sold_at?: string | null
          sold_by?: string | null
          status?: Database["public"]["Enums"]["deal_status"]
          updated_at?: string
          user_id: string
          validated_at?: string | null
        }
        Update: {
          amount?: number
          bank_fees_offered?: boolean
          commission_actual?: number | null
          commission_direct?: number | null
          contact_id?: string | null
          created_at?: string
          deal_type?: string | null
          id?: string
          loss_reason?: string | null
          loss_reason_category?: string | null
          notes?: string | null
          payment_months?: number | null
          payment_type?: string
          product?: string | null
          signed_at?: string | null
          sold_at?: string | null
          sold_by?: string | null
          status?: Database["public"]["Enums"]["deal_status"]
          updated_at?: string
          user_id?: string
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_sold_by_fkey"
            columns: ["sold_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      formation_lessons: {
        Row: {
          content_type: string
          content_url: string | null
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          module_id: string
          position: number
          title: string
        }
        Insert: {
          content_type?: string
          content_url?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          module_id: string
          position?: number
          title: string
        }
        Update: {
          content_type?: string
          content_url?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          module_id?: string
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "formation_lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "formation_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      formation_modules: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          position: number
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          user_id: string
          visible_from_level: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          position?: number
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          user_id: string
          visible_from_level?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          position?: number
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
          visible_from_level?: string | null
        }
        Relationships: []
      }
      formation_progress: {
        Row: {
          completed_at: string | null
          id: string
          lesson_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          lesson_id: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          lesson_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "formation_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "formation_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      member_objectives: {
        Row: {
          actions: string | null
          created_at: string | null
          custom_answers: Json | null
          filled_at: string | null
          filled_by_member: boolean | null
          follow_up_1mo_at: string | null
          follow_up_1mo_done_at: string | null
          follow_up_3mo_at: string | null
          follow_up_3mo_done_at: string | null
          id: string
          notes_1an: string | null
          notes_3mois: string | null
          notes_mois: string | null
          objectif_1an: string | null
          objectif_3mois: string | null
          objectif_mois: string | null
          recrues_objectif_1an: number | null
          recrues_objectif_3mois: number | null
          recrues_objectif_mois: number | null
          start_date: string | null
          team_member_id: string
          token: string
          updated_at: string | null
          user_id: string
          ventes_objectif_1an: number | null
          ventes_objectif_3mois: number | null
          ventes_objectif_mois: number | null
        }
        Insert: {
          actions?: string | null
          created_at?: string | null
          custom_answers?: Json | null
          filled_at?: string | null
          filled_by_member?: boolean | null
          follow_up_1mo_at?: string | null
          follow_up_1mo_done_at?: string | null
          follow_up_3mo_at?: string | null
          follow_up_3mo_done_at?: string | null
          id?: string
          notes_1an?: string | null
          notes_3mois?: string | null
          notes_mois?: string | null
          objectif_1an?: string | null
          objectif_3mois?: string | null
          objectif_mois?: string | null
          recrues_objectif_1an?: number | null
          recrues_objectif_3mois?: number | null
          recrues_objectif_mois?: number | null
          start_date?: string | null
          team_member_id: string
          token: string
          updated_at?: string | null
          user_id: string
          ventes_objectif_1an?: number | null
          ventes_objectif_3mois?: number | null
          ventes_objectif_mois?: number | null
        }
        Update: {
          actions?: string | null
          created_at?: string | null
          custom_answers?: Json | null
          filled_at?: string | null
          filled_by_member?: boolean | null
          follow_up_1mo_at?: string | null
          follow_up_1mo_done_at?: string | null
          follow_up_3mo_at?: string | null
          follow_up_3mo_done_at?: string | null
          id?: string
          notes_1an?: string | null
          notes_3mois?: string | null
          notes_mois?: string | null
          objectif_1an?: string | null
          objectif_3mois?: string | null
          objectif_mois?: string | null
          recrues_objectif_1an?: number | null
          recrues_objectif_3mois?: number | null
          recrues_objectif_mois?: number | null
          start_date?: string | null
          team_member_id?: string
          token?: string
          updated_at?: string | null
          user_id?: string
          ventes_objectif_1an?: number | null
          ventes_objectif_3mois?: number | null
          ventes_objectif_mois?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "member_objectives_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      objectif_form_config: {
        Row: {
          created_at: string | null
          id: string
          questions: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          questions?: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          questions?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      personal_challenges: {
        Row: {
          created_at: string
          description: string | null
          end_date: string
          id: string
          objective_type: string
          reward: string | null
          start_date: string
          status: string
          target_value: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date: string
          id?: string
          objective_type?: string
          reward?: string | null
          start_date: string
          status?: string
          target_value?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string
          id?: string
          objective_type?: string
          reward?: string | null
          start_date?: string
          status?: string
          target_value?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          position: number
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          position?: number
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          challenge_start_date: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          invite_code: string | null
          onboarding_completed_at: string | null
          phone: string | null
          plan: string | null
          plan_current_period_end: string | null
          plan_status: string | null
          role: string
          sponsor_user_id: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          challenge_start_date?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          invite_code?: string | null
          onboarding_completed_at?: string | null
          phone?: string | null
          plan?: string | null
          plan_current_period_end?: string | null
          plan_status?: string | null
          role?: string
          sponsor_user_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          challenge_start_date?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          invite_code?: string | null
          onboarding_completed_at?: string | null
          phone?: string | null
          plan?: string | null
          plan_current_period_end?: string | null
          plan_status?: string | null
          role?: string
          sponsor_user_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      public_leads: {
        Row: {
          assigned_at: string | null
          assigned_to_member_id: string | null
          campaign_id: string | null
          created_at: string | null
          email: string | null
          first_name: string
          id: string
          intent: string
          last_name: string
          message: string | null
          phone: string
          profile_id: string
          source: string
          status: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_to_member_id?: string | null
          campaign_id?: string | null
          created_at?: string | null
          email?: string | null
          first_name: string
          id?: string
          intent: string
          last_name: string
          message?: string | null
          phone: string
          profile_id: string
          source?: string
          status?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_to_member_id?: string | null
          campaign_id?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string
          id?: string
          intent?: string
          last_name?: string
          message?: string | null
          phone?: string
          profile_id?: string
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_leads_assigned_to_member_id_fkey"
            columns: ["assigned_to_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_leads_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_survey_responses: {
        Row: {
          answers: Json
          created_at: string
          id: string
          respondent_name: string | null
          respondent_phone: string | null
          survey_id: string
        }
        Insert: {
          answers?: Json
          created_at?: string
          id?: string
          respondent_name?: string | null
          respondent_phone?: string | null
          survey_id: string
        }
        Update: {
          answers?: Json
          created_at?: string
          id?: string
          respondent_name?: string | null
          respondent_phone?: string | null
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "social_surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      social_surveys: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          questions: Json
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          questions?: Json
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          questions?: Json
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      task_columns: {
        Row: {
          base_status: Database["public"]["Enums"]["task_status"]
          color: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          base_status?: Database["public"]["Enums"]["task_status"]
          color?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          base_status?: Database["public"]["Enums"]["task_status"]
          color?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          auto_generated: boolean
          column_id: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          status: Database["public"]["Enums"]["task_status"]
          title: string
          type: Database["public"]["Enums"]["task_type"]
          user_id: string
        }
        Insert: {
          auto_generated?: boolean
          column_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          type?: Database["public"]["Enums"]["task_type"]
          user_id: string
        }
        Update: {
          auto_generated?: boolean
          column_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          type?: Database["public"]["Enums"]["task_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "task_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      team_challenge_participants: {
        Row: {
          added_at: string
          challenge_id: string
          member_id: string
        }
        Insert: {
          added_at?: string
          challenge_id: string
          member_id: string
        }
        Update: {
          added_at?: string
          challenge_id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_challenge_participants_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "team_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_challenge_participants_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      team_challenges: {
        Row: {
          created_at: string
          description: string | null
          end_date: string
          id: string
          objective_type: string
          participants_mode: string
          reward: string | null
          start_date: string
          status: string
          target_value: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date: string
          id?: string
          objective_type?: string
          participants_mode?: string
          reward?: string | null
          start_date: string
          status?: string
          target_value?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string
          id?: string
          objective_type?: string
          participants_mode?: string
          reward?: string | null
          start_date?: string
          status?: string
          target_value?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          city: string | null
          contact_id: string | null
          created_at: string
          email: string | null
          first_name: string
          hyla_level: string
          id: string
          internal_id: string | null
          joined_at: string | null
          last_name: string
          lat: number | null
          level: number
          linked_user_id: string | null
          lng: number | null
          matching_names: string[] | null
          notes: string | null
          phone: string | null
          slug: string | null
          sponsor_id: string | null
          status: Database["public"]["Enums"]["member_status"]
          supabase_user_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          city?: string | null
          contact_id?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          hyla_level?: string
          id?: string
          internal_id?: string | null
          joined_at?: string | null
          last_name: string
          lat?: number | null
          level?: number
          linked_user_id?: string | null
          lng?: number | null
          matching_names?: string[] | null
          notes?: string | null
          phone?: string | null
          slug?: string | null
          sponsor_id?: string | null
          status?: Database["public"]["Enums"]["member_status"]
          supabase_user_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string | null
          contact_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          hyla_level?: string
          id?: string
          internal_id?: string | null
          joined_at?: string | null
          last_name?: string
          lat?: number | null
          level?: number
          linked_user_id?: string | null
          lng?: number | null
          matching_names?: string[] | null
          notes?: string | null
          phone?: string | null
          slug?: string | null
          sponsor_id?: string | null
          status?: Database["public"]["Enums"]["member_status"]
          supabase_user_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          can_grant_academie_access: boolean
          challenges_disabled: boolean
          city: string | null
          column_mappings: Json | null
          created_at: string
          hyla_level: string
          id: string
          is_content_manager: boolean
          lat: number | null
          lng: number | null
          message_templates: Json | null
          mlm_config: Json | null
          monthly_ca_target: number | null
          monthly_sales_target: number | null
          notification_prefs: Json | null
          owner_matching_names: string[] | null
          respire_academie_access: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          can_grant_academie_access?: boolean
          challenges_disabled?: boolean
          city?: string | null
          column_mappings?: Json | null
          created_at?: string
          hyla_level?: string
          id?: string
          is_content_manager?: boolean
          lat?: number | null
          lng?: number | null
          message_templates?: Json | null
          mlm_config?: Json | null
          monthly_ca_target?: number | null
          monthly_sales_target?: number | null
          notification_prefs?: Json | null
          owner_matching_names?: string[] | null
          respire_academie_access?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          can_grant_academie_access?: boolean
          challenges_disabled?: boolean
          city?: string | null
          column_mappings?: Json | null
          created_at?: string
          hyla_level?: string
          id?: string
          is_content_manager?: boolean
          lat?: number | null
          lng?: number | null
          message_templates?: Json | null
          mlm_config?: Json | null
          monthly_ca_target?: number | null
          monthly_sales_target?: number | null
          notification_prefs?: Json | null
          owner_matching_names?: string[] | null
          respire_academie_access?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      campaign_stats: { Args: { p_campaign_id: string }; Returns: Json }
      consolidate_import_commissions: {
        Args: { p_import_id: string }
        Returns: undefined
      }
      generate_invite_code: { Args: never; Returns: string }
      get_dashboard_kpis: {
        Args: {
          p_period_end?: string
          p_period_start?: string
          p_user_id: string
        }
        Returns: Json
      }
      get_downline: {
        Args: { root_user_id: string }
        Returns: {
          depth: number
          user_id: string
        }[]
      }
      get_team_tree: {
        Args: { p_user_id: string }
        Returns: {
          depth: number
          first_name: string
          hyla_level: string
          id: string
          internal_id: string
          last_name: string
          level: number
          linked_user_id: string
          matching_names: string[]
          owner_user_id: string
          parent_member_id: string
          status: string
          user_id: string
        }[]
      }
      grant_academie_access: {
        Args: { p_target_user_id: string; p_value: boolean }
        Returns: undefined
      }
      has_academy_access: { Args: { p_academy_id: string }; Returns: boolean }
      is_academy_owner: { Args: { p_academy_id: string }; Returns: boolean }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      appointment_status: "planifie" | "realise" | "annule" | "reporte"
      appointment_type: "rdv" | "demo" | "suivi" | "recrutement"
      commission_source: "vente" | "import"
      commission_status: "detectee" | "validee" | "en_attente" | "non_reconnue"
      commission_type: "directe" | "reseau"
      contact_priority: "basse" | "normale" | "haute" | "urgente"
      contact_status:
        | "prospect"
        | "cliente"
        | "recrue"
        | "inactive"
        | "perdue"
        | "partenaire"
      deal_status:
        | "en_cours"
        | "signee"
        | "annulee"
        | "en_attente"
        | "livree"
        | "en_financement"
      import_status: "en_cours" | "traite" | "partiel" | "erreur"
      match_status: "auto" | "manuel" | "non_reconnu"
      member_status: "actif" | "inactif"
      task_status: "a_faire" | "en_cours" | "terminee" | "annulee"
      task_type:
        | "relance"
        | "rdv"
        | "demo"
        | "suivi"
        | "admin"
        | "autre"
        | "formation"
        | "contenu"
        | "livraison"
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
      appointment_status: ["planifie", "realise", "annule", "reporte"],
      appointment_type: ["rdv", "demo", "suivi", "recrutement"],
      commission_source: ["vente", "import"],
      commission_status: ["detectee", "validee", "en_attente", "non_reconnue"],
      commission_type: ["directe", "reseau"],
      contact_priority: ["basse", "normale", "haute", "urgente"],
      contact_status: [
        "prospect",
        "cliente",
        "recrue",
        "inactive",
        "perdue",
        "partenaire",
      ],
      deal_status: [
        "en_cours",
        "signee",
        "annulee",
        "en_attente",
        "livree",
        "en_financement",
      ],
      import_status: ["en_cours", "traite", "partiel", "erreur"],
      match_status: ["auto", "manuel", "non_reconnu"],
      member_status: ["actif", "inactif"],
      task_status: ["a_faire", "en_cours", "terminee", "annulee"],
      task_type: [
        "relance",
        "rdv",
        "demo",
        "suivi",
        "admin",
        "autre",
        "formation",
        "contenu",
        "livraison",
      ],
    },
  },
} as const
A new version of Supabase CLI is available: v2.109.1 (currently installed v2.90.0)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli
