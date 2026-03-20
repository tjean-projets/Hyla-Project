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
      admin_settings: {
        Row: {
          address: string
          city: string
          cni_url: string | null
          company_name: string
          created_at: string | null
          email: string
          first_name: string
          id: string
          justificatif_domicile_url: string | null
          kbis_url: string | null
          last_name: string
          orias_number: string
          phone: string
          postal_code: string
          rib_url: string | null
          siret: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address?: string
          city?: string
          cni_url?: string | null
          company_name?: string
          created_at?: string | null
          email?: string
          first_name?: string
          id?: string
          justificatif_domicile_url?: string | null
          kbis_url?: string | null
          last_name?: string
          orias_number?: string
          phone?: string
          postal_code?: string
          rib_url?: string | null
          siret?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address?: string
          city?: string
          cni_url?: string | null
          company_name?: string
          created_at?: string | null
          email?: string
          first_name?: string
          id?: string
          justificatif_domicile_url?: string | null
          kbis_url?: string | null
          last_name?: string
          orias_number?: string
          phone?: string
          postal_code?: string
          rib_url?: string | null
          siret?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      commission_rates: {
        Row: {
          contract_type: Database["public"]["Enums"]["contract_type"]
          created_at: string | null
          id: string
          partner_id: string
          rate_percent: number
          updated_at: string | null
        }
        Insert: {
          contract_type: Database["public"]["Enums"]["contract_type"]
          created_at?: string | null
          id?: string
          partner_id: string
          rate_percent?: number
          updated_at?: string | null
        }
        Update: {
          contract_type?: Database["public"]["Enums"]["contract_type"]
          created_at?: string | null
          id?: string
          partner_id?: string
          rate_percent?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_rates_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_events: {
        Row: {
          created_at: string | null
          created_by: string | null
          event_type: string
          id: string
          lead_id: string
          new_value: Json | null
          old_value: Json | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          event_type: string
          id?: string
          lead_id: string
          new_value?: Json | null
          old_value?: Json | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          event_type?: string
          id?: string
          lead_id?: string
          new_value?: Json | null
          old_value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          admin_notes: string | null
          annual_premium_estimated: number | null
          annual_premium_final: number | null
          banque: string | null
          commission_estimated: number | null
          commission_final: number | null
          consent_confirmed: boolean
          consent_document_url: string | null
          consent_text_version: string | null
          consent_timestamp: string | null
          contract_type: Database["public"]["Enums"]["contract_type"] | null
          created_at: string | null
          email: string | null
          first_name: string
          id: string
          is_paid: boolean
          last_name: string
          lost_reason: string | null
          montant: number | null
          notes_partner: string | null
          paid_at: string | null
          paiement_compagnie_recu: boolean
          partner_id: string
          payment_reference: string | null
          phone: string
          status: Database["public"]["Enums"]["lead_status"]
          type_projet: string | null
          updated_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          annual_premium_estimated?: number | null
          annual_premium_final?: number | null
          banque?: string | null
          commission_estimated?: number | null
          commission_final?: number | null
          consent_confirmed?: boolean
          consent_document_url?: string | null
          consent_text_version?: string | null
          consent_timestamp?: string | null
          contract_type?: Database["public"]["Enums"]["contract_type"] | null
          created_at?: string | null
          email?: string | null
          first_name: string
          id?: string
          is_paid?: boolean
          last_name: string
          lost_reason?: string | null
          montant?: number | null
          notes_partner?: string | null
          paid_at?: string | null
          paiement_compagnie_recu?: boolean
          partner_id: string
          payment_reference?: string | null
          phone: string
          status?: Database["public"]["Enums"]["lead_status"]
          type_projet?: string | null
          updated_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          annual_premium_estimated?: number | null
          annual_premium_final?: number | null
          banque?: string | null
          commission_estimated?: number | null
          commission_final?: number | null
          consent_confirmed?: boolean
          consent_document_url?: string | null
          consent_text_version?: string | null
          consent_timestamp?: string | null
          contract_type?: Database["public"]["Enums"]["contract_type"] | null
          created_at?: string | null
          email?: string | null
          first_name?: string
          id?: string
          is_paid?: boolean
          last_name?: string
          lost_reason?: string | null
          montant?: number | null
          notes_partner?: string | null
          paid_at?: string | null
          paiement_compagnie_recu?: boolean
          partner_id?: string
          payment_reference?: string | null
          phone?: string
          status?: Database["public"]["Enums"]["lead_status"]
          type_projet?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      partner_documents: {
        Row: {
          created_at: string | null
          document_type: string
          file_name: string
          file_url: string
          id: string
          lead_id: string | null
          partner_id: string
          validation_status: string
        }
        Insert: {
          created_at?: string | null
          document_type: string
          file_name: string
          file_url: string
          id?: string
          lead_id?: string | null
          partner_id: string
          validation_status?: string
        }
        Update: {
          created_at?: string | null
          document_type?: string
          file_name?: string
          file_url?: string
          id?: string
          lead_id?: string | null
          partner_id?: string
          validation_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_documents_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_documents_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          created_at: string | null
          display_name: string
          email: string
          id: string
          invite_code: string
          invite_expires_at: string
          invite_used_at: string | null
          is_active: boolean | null
          partner_type: Database["public"]["Enums"]["partner_type"] | null
          total_leads: number
          total_revenue: number
          total_signed: number
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          display_name: string
          email: string
          id?: string
          invite_code: string
          invite_expires_at: string
          invite_used_at?: string | null
          is_active?: boolean | null
          partner_type?: Database["public"]["Enums"]["partner_type"] | null
          total_leads?: number
          total_revenue?: number
          total_signed?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string
          email?: string
          id?: string
          invite_code?: string
          invite_expires_at?: string
          invite_used_at?: string | null
          is_active?: boolean | null
          partner_type?: Database["public"]["Enums"]["partner_type"] | null
          total_leads?: number
          total_revenue?: number
          total_signed?: number
          user_id?: string | null
        }
        Relationships: []
      }
      product_commission_configs: {
        Row: {
          commission_mode: string
          contract_type: Database["public"]["Enums"]["contract_type"]
          created_at: string | null
          fixed_rate_percent: number
          id: string
          updated_at: string | null
        }
        Insert: {
          commission_mode?: string
          contract_type: Database["public"]["Enums"]["contract_type"]
          created_at?: string | null
          fixed_rate_percent?: number
          id?: string
          updated_at?: string | null
        }
        Update: {
          commission_mode?: string
          contract_type?: Database["public"]["Enums"]["contract_type"]
          created_at?: string | null
          fixed_rate_percent?: number
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      product_tier_rules: {
        Row: {
          contract_type: Database["public"]["Enums"]["contract_type"]
          created_at: string | null
          id: string
          max_signed: number | null
          min_signed: number
          rate_percent: number
          tier_name: string
        }
        Insert: {
          contract_type: Database["public"]["Enums"]["contract_type"]
          created_at?: string | null
          id?: string
          max_signed?: number | null
          min_signed: number
          rate_percent: number
          tier_name: string
        }
        Update: {
          contract_type?: Database["public"]["Enums"]["contract_type"]
          created_at?: string | null
          id?: string
          max_signed?: number | null
          min_signed?: number
          rate_percent?: number
          tier_name?: string
        }
        Relationships: []
      }
      tier_rules: {
        Row: {
          created_at: string | null
          id: string
          max_signed: number | null
          min_signed: number
          rate_percent: number
          tier_name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          max_signed?: number | null
          min_signed: number
          rate_percent: number
          tier_name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          max_signed?: number | null
          min_signed?: number
          rate_percent?: number
          tier_name?: string
        }
        Relationships: []
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
      wallets: {
        Row: {
          available_balance: number
          id: string
          partner_id: string
          pending_balance: number
          total_balance: number
          updated_at: string
        }
        Insert: {
          available_balance?: number
          id?: string
          partner_id: string
          pending_balance?: number
          total_balance?: number
          updated_at?: string
        }
        Update: {
          available_balance?: number
          id?: string
          partner_id?: string
          pending_balance?: number
          total_balance?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: true
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_requests: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          lead_ids: string[]
          partner_id: string
          processed_at: string | null
          status: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          id?: string
          lead_ids?: string[]
          partner_id: string
          processed_at?: string | null
          status?: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          lead_ids?: string[]
          partner_id?: string
          processed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_48h_alerts: { Args: never; Returns: number }
      get_motivation_data: {
        Args: { p_partner_id: string }
        Returns: {
          bonus_potentiel: number
          current_rate: number
          current_tier_name: string
          dossiers_manquants: number
          next_rate: number
          next_tier_name: string
          signed_count: number
        }[]
      }
      get_partner_id_for_user: { Args: { _user_id: string }; Returns: string }
      get_partner_tier: {
        Args: { p_partner_id: string }
        Returns: {
          max_signed: number
          min_signed: number
          rate_percent: number
          signed_count: number
          tier_name: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      recalculate_partner_commissions: {
        Args: { p_partner_id: string }
        Returns: {
          current_rate: number
          extra_potential: number
          next_rate: number
          updated_count: number
        }[]
      }
      sync_wallet_balance: {
        Args: { p_partner_id: string }
        Returns: undefined
      }
      validate_partner_invite: {
        Args: { p_invite_code: string }
        Returns: {
          id: string
          invite_expires_at: string
          invite_used_at: string
          is_active: boolean
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "partner"
      contract_type:
        | "emprunteur"
        | "prevoyance"
        | "rc_pro"
        | "sante"
        | "decennale"
      lead_status:
        | "NOUVEAU"
        | "EN_COURS"
        | "DEVIS_ENVOYE"
        | "SIGNATURE"
        | "CONTACT"
        | "SIMULATION"
        | "SIGNE"
        | "REFUSE"
        | "PERDU"
      partner_type: "professional" | "private"
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
      app_role: ["admin", "partner"],
      contract_type: [
        "emprunteur",
        "prevoyance",
        "rc_pro",
        "sante",
        "decennale",
      ],
      lead_status: [
        "NOUVEAU",
        "EN_COURS",
        "DEVIS_ENVOYE",
        "SIGNATURE",
        "CONTACT",
        "SIMULATION",
        "SIGNE",
        "REFUSE",
        "PERDU",
      ],
      partner_type: ["professional", "private"],
    },
  },
} as const
