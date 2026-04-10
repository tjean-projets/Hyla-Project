export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          avatar_url: string | null
          phone: string | null
          email: string | null
          role: 'conseillere' | 'manager' | 'admin'
          sponsor_user_id: string | null
          invite_code: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string
          avatar_url?: string | null
          phone?: string | null
          email?: string | null
          role?: 'conseillere' | 'manager' | 'admin'
          sponsor_user_id?: string | null
          invite_code?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          avatar_url?: string | null
          phone?: string | null
          email?: string | null
          role?: 'conseillere' | 'manager' | 'admin'
          sponsor_user_id?: string | null
          invite_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          id: string
          user_id: string
          name: string
          position: number
          color: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          position?: number
          color?: string
          created_at?: string
        }
        Update: {
          name?: string
          position?: number
          color?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          id: string
          user_id: string
          first_name: string
          last_name: string
          phone: string | null
          email: string | null
          address: string | null
          source: string | null
          status: Database["public"]["Enums"]["contact_status"]
          priority: Database["public"]["Enums"]["contact_priority"]
          tags: string[]
          pipeline_stage_id: string | null
          notes: string | null
          last_contacted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          first_name: string
          last_name: string
          phone?: string | null
          email?: string | null
          address?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["contact_status"]
          priority?: Database["public"]["Enums"]["contact_priority"]
          tags?: string[]
          pipeline_stage_id?: string | null
          notes?: string | null
          last_contacted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          first_name?: string
          last_name?: string
          phone?: string | null
          email?: string | null
          address?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["contact_status"]
          priority?: Database["public"]["Enums"]["contact_priority"]
          tags?: string[]
          pipeline_stage_id?: string | null
          notes?: string | null
          last_contacted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_pipeline_stage_id_fkey"
            columns: ["pipeline_stage_id"]
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          }
        ]
      }
      team_members: {
        Row: {
          id: string
          user_id: string
          contact_id: string | null
          first_name: string
          last_name: string
          internal_id: string | null
          sponsor_id: string | null
          level: number
          status: Database["public"]["Enums"]["member_status"]
          phone: string | null
          email: string | null
          joined_at: string | null
          matching_names: string[]
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          contact_id?: string | null
          first_name: string
          last_name: string
          internal_id?: string | null
          sponsor_id?: string | null
          level?: number
          status?: Database["public"]["Enums"]["member_status"]
          phone?: string | null
          email?: string | null
          joined_at?: string | null
          matching_names?: string[]
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          first_name?: string
          last_name?: string
          internal_id?: string | null
          sponsor_id?: string | null
          level?: number
          status?: Database["public"]["Enums"]["member_status"]
          phone?: string | null
          email?: string | null
          joined_at?: string | null
          matching_names?: string[]
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_sponsor_id_fkey"
            columns: ["sponsor_id"]
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_contact_id_fkey"
            columns: ["contact_id"]
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          }
        ]
      }
      deals: {
        Row: {
          id: string
          user_id: string
          contact_id: string | null
          amount: number
          product: string | null
          deal_type: string | null
          status: Database["public"]["Enums"]["deal_status"]
          signed_at: string | null
          validated_at: string | null
          sold_by: string | null
          commission_direct: number
          commission_actual: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          contact_id?: string | null
          amount?: number
          product?: string | null
          deal_type?: string | null
          status?: Database["public"]["Enums"]["deal_status"]
          signed_at?: string | null
          validated_at?: string | null
          sold_by?: string | null
          commission_direct?: number
          commission_actual?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          amount?: number
          product?: string | null
          deal_type?: string | null
          status?: Database["public"]["Enums"]["deal_status"]
          signed_at?: string | null
          validated_at?: string | null
          sold_by?: string | null
          commission_direct?: number
          commission_actual?: number
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_sold_by_fkey"
            columns: ["sold_by"]
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          }
        ]
      }
      commission_imports: {
        Row: {
          id: string
          user_id: string
          file_name: string
          file_url: string | null
          period: string
          status: Database["public"]["Enums"]["import_status"]
          column_mapping: Json
          stats: Json
          notes: string | null
          uploaded_at: string
          processed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          file_name: string
          file_url?: string | null
          period: string
          status?: Database["public"]["Enums"]["import_status"]
          column_mapping?: Json
          stats?: Json
          notes?: string | null
          uploaded_at?: string
          processed_at?: string | null
        }
        Update: {
          file_name?: string
          file_url?: string | null
          period?: string
          status?: Database["public"]["Enums"]["import_status"]
          column_mapping?: Json
          stats?: Json
          notes?: string | null
          processed_at?: string | null
        }
        Relationships: []
      }
      commission_import_rows: {
        Row: {
          id: string
          import_id: string
          raw_data: Json
          matched_member_id: string | null
          is_owner_row: boolean
          match_confidence: number
          match_status: Database["public"]["Enums"]["match_status"]
          amount: number
          details: string | null
          created_at: string
        }
        Insert: {
          id?: string
          import_id: string
          raw_data?: Json
          matched_member_id?: string | null
          is_owner_row?: boolean
          match_confidence?: number
          match_status?: Database["public"]["Enums"]["match_status"]
          amount?: number
          details?: string | null
          created_at?: string
        }
        Update: {
          raw_data?: Json
          matched_member_id?: string | null
          is_owner_row?: boolean
          match_confidence?: number
          match_status?: Database["public"]["Enums"]["match_status"]
          amount?: number
          details?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_import_rows_import_id_fkey"
            columns: ["import_id"]
            referencedRelation: "commission_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_import_rows_matched_member_id_fkey"
            columns: ["matched_member_id"]
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          }
        ]
      }
      commissions: {
        Row: {
          id: string
          user_id: string
          period: string
          type: Database["public"]["Enums"]["commission_type"]
          amount: number
          source: Database["public"]["Enums"]["commission_source"]
          deal_id: string | null
          team_member_id: string | null
          import_row_id: string | null
          status: Database["public"]["Enums"]["commission_status"]
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          period: string
          type: Database["public"]["Enums"]["commission_type"]
          amount?: number
          source?: Database["public"]["Enums"]["commission_source"]
          deal_id?: string | null
          team_member_id?: string | null
          import_row_id?: string | null
          status?: Database["public"]["Enums"]["commission_status"]
          notes?: string | null
          created_at?: string
        }
        Update: {
          period?: string
          type?: Database["public"]["Enums"]["commission_type"]
          amount?: number
          source?: Database["public"]["Enums"]["commission_source"]
          deal_id?: string | null
          team_member_id?: string | null
          import_row_id?: string | null
          status?: Database["public"]["Enums"]["commission_status"]
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commissions_deal_id_fkey"
            columns: ["deal_id"]
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_team_member_id_fkey"
            columns: ["team_member_id"]
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_import_row_id_fkey"
            columns: ["import_row_id"]
            referencedRelation: "commission_import_rows"
            referencedColumns: ["id"]
          }
        ]
      }
      tasks: {
        Row: {
          id: string
          user_id: string
          contact_id: string | null
          title: string
          description: string | null
          type: Database["public"]["Enums"]["task_type"]
          status: Database["public"]["Enums"]["task_status"]
          due_date: string | null
          completed_at: string | null
          auto_generated: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          contact_id?: string | null
          title: string
          description?: string | null
          type?: Database["public"]["Enums"]["task_type"]
          status?: Database["public"]["Enums"]["task_status"]
          due_date?: string | null
          completed_at?: string | null
          auto_generated?: boolean
          created_at?: string
        }
        Update: {
          contact_id?: string | null
          title?: string
          description?: string | null
          type?: Database["public"]["Enums"]["task_type"]
          status?: Database["public"]["Enums"]["task_status"]
          due_date?: string | null
          completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          }
        ]
      }
      appointments: {
        Row: {
          id: string
          user_id: string
          contact_id: string | null
          title: string
          type: Database["public"]["Enums"]["appointment_type"]
          status: Database["public"]["Enums"]["appointment_status"]
          date: string
          duration: number
          location: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          contact_id?: string | null
          title: string
          type?: Database["public"]["Enums"]["appointment_type"]
          status?: Database["public"]["Enums"]["appointment_status"]
          date: string
          duration?: number
          location?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          contact_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["appointment_type"]
          status?: Database["public"]["Enums"]["appointment_status"]
          date?: string
          duration?: number
          location?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_contact_id_fkey"
            columns: ["contact_id"]
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          }
        ]
      }
      contact_notes: {
        Row: {
          id: string
          contact_id: string
          user_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          contact_id: string
          user_id: string
          content: string
          created_at?: string
        }
        Update: {
          content?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_notes_contact_id_fkey"
            columns: ["contact_id"]
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          }
        ]
      }
      user_settings: {
        Row: {
          id: string
          user_id: string
          column_mappings: Json
          mlm_config: Json
          notification_prefs: Json
          owner_matching_names: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          column_mappings?: Json
          mlm_config?: Json
          notification_prefs?: Json
          owner_matching_names?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          column_mappings?: Json
          mlm_config?: Json
          notification_prefs?: Json
          owner_matching_names?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      public_leads: {
        Row: {
          id: string
          profile_id: string
          first_name: string
          last_name: string
          phone: string
          email: string | null
          message: string | null
          intent: 'acheter' | 'devenir_conseiller' | 'en_savoir_plus'
          source: 'bio' | 'story' | 'direct'
          status: 'nouveau' | 'converti'
          created_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          first_name: string
          last_name: string
          phone: string
          email?: string | null
          message?: string | null
          intent: 'acheter' | 'devenir_conseiller' | 'en_savoir_plus'
          source?: 'bio' | 'story' | 'direct'
          status?: 'nouveau' | 'converti'
          created_at?: string
        }
        Update: {
          first_name?: string
          last_name?: string
          phone?: string
          email?: string | null
          message?: string | null
          intent?: 'acheter' | 'devenir_conseiller' | 'en_savoir_plus'
          source?: 'bio' | 'story' | 'direct'
          status?: 'nouveau' | 'converti'
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          role: Database["public"]["Enums"]["app_role"]
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          role?: Database["public"]["Enums"]["app_role"]
          created_at?: string
        }
        Update: {
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_dashboard_kpis: {
        Args: {
          p_user_id: string
          p_period_start?: string
          p_period_end?: string
        }
        Returns: Json
      }
      consolidate_import_commissions: {
        Args: {
          p_import_id: string
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          _user_id: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "partner"
      contact_status: "prospect" | "cliente" | "recrue" | "inactive" | "perdue"
      contact_priority: "basse" | "normale" | "haute" | "urgente"
      deal_status: "en_cours" | "signee" | "annulee" | "en_attente" | "livree"
      task_type: "relance" | "rdv" | "demo" | "suivi" | "admin" | "autre"
      task_status: "a_faire" | "en_cours" | "terminee" | "annulee"
      appointment_type: "rdv" | "demo" | "suivi" | "recrutement"
      appointment_status: "planifie" | "realise" | "annule" | "reporte"
      commission_type: "directe" | "reseau"
      commission_source: "vente" | "import"
      commission_status: "detectee" | "validee" | "en_attente" | "non_reconnue"
      import_status: "en_cours" | "traite" | "partiel" | "erreur"
      match_status: "auto" | "manuel" | "non_reconnu"
      member_status: "actif" | "inactif"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never
