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
      elder_profiles: {
        Row: {
          age: number | null
          created_at: string
          created_by_user_id: string
          display_name: string
          gender: string | null
          id: string
          preferred_language: string
          relationship_label: string | null
          timezone: string | null
        }
        Insert: {
          age?: number | null
          created_at?: string
          created_by_user_id: string
          display_name: string
          gender?: string | null
          id?: string
          preferred_language?: string
          relationship_label?: string | null
          timezone?: string | null
        }
        Update: {
          age?: number | null
          created_at?: string
          created_by_user_id?: string
          display_name?: string
          gender?: string | null
          id?: string
          preferred_language?: string
          relationship_label?: string | null
          timezone?: string | null
        }
        Relationships: []
      }
      family_dashboard_visits: {
        Row: {
          elder_profile_id: string
          family_user_id: string
          id: string
          visited_at: string
        }
        Insert: {
          elder_profile_id: string
          family_user_id: string
          id?: string
          visited_at?: string
        }
        Update: {
          elder_profile_id?: string
          family_user_id?: string
          id?: string
          visited_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_dashboard_visits_elder_profile_id_fkey"
            columns: ["elder_profile_id"]
            isOneToOne: false
            referencedRelation: "elder_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      family_links: {
        Row: {
          created_at: string
          elder_profile_id: string
          family_user_id: string
          id: string
        }
        Insert: {
          created_at?: string
          elder_profile_id: string
          family_user_id: string
          id?: string
        }
        Update: {
          created_at?: string
          elder_profile_id?: string
          family_user_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_links_elder_profile_id_fkey"
            columns: ["elder_profile_id"]
            isOneToOne: false
            referencedRelation: "elder_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mood_entries: {
        Row: {
          acknowledgement_text: string | null
          ai_suggested_tags: string[] | null
          created_at: string
          elder_profile_id: string
          id: string
          mood_audio_url: string | null
          mood_score: number
          mood_transcript: string | null
          selected_tags: string[] | null
        }
        Insert: {
          acknowledgement_text?: string | null
          ai_suggested_tags?: string[] | null
          created_at?: string
          elder_profile_id: string
          id?: string
          mood_audio_url?: string | null
          mood_score: number
          mood_transcript?: string | null
          selected_tags?: string[] | null
        }
        Update: {
          acknowledgement_text?: string | null
          ai_suggested_tags?: string[] | null
          created_at?: string
          elder_profile_id?: string
          id?: string
          mood_audio_url?: string | null
          mood_score?: number
          mood_transcript?: string | null
          selected_tags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "mood_entries_elder_profile_id_fkey"
            columns: ["elder_profile_id"]
            isOneToOne: false
            referencedRelation: "elder_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mood_settings: {
        Row: {
          elder_profile_id: string
          frequency: string
          id: string
          is_enabled: boolean
          time_1: string | null
          time_2: string | null
          updated_at: string
        }
        Insert: {
          elder_profile_id: string
          frequency?: string
          id?: string
          is_enabled?: boolean
          time_1?: string | null
          time_2?: string | null
          updated_at?: string
        }
        Update: {
          elder_profile_id?: string
          frequency?: string
          id?: string
          is_enabled?: boolean
          time_1?: string | null
          time_2?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mood_settings_elder_profile_id_fkey"
            columns: ["elder_profile_id"]
            isOneToOne: true
            referencedRelation: "elder_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_instances: {
        Row: {
          classification_label: string | null
          created_at: string
          elder_profile_id: string
          id: string
          reply_audio_url: string | null
          reply_transcript: string | null
          scheduled_at: string
          status: string
          template_id: string
        }
        Insert: {
          classification_label?: string | null
          created_at?: string
          elder_profile_id: string
          id?: string
          reply_audio_url?: string | null
          reply_transcript?: string | null
          scheduled_at?: string
          status?: string
          template_id: string
        }
        Update: {
          classification_label?: string | null
          created_at?: string
          elder_profile_id?: string
          id?: string
          reply_audio_url?: string | null
          reply_transcript?: string | null
          scheduled_at?: string
          status?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_instances_elder_profile_id_fkey"
            columns: ["elder_profile_id"]
            isOneToOne: false
            referencedRelation: "elder_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_instances_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "notification_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          category: string
          created_at: string
          elder_profile_id: string
          family_voice_audio_url: string | null
          frequency: string
          id: string
          is_enabled: boolean
          message_text: string
          schedule_time: string
          title: string
          type: string
          voice_mode: string
        }
        Insert: {
          category: string
          created_at?: string
          elder_profile_id: string
          family_voice_audio_url?: string | null
          frequency?: string
          id?: string
          is_enabled?: boolean
          message_text: string
          schedule_time?: string
          title: string
          type: string
          voice_mode?: string
        }
        Update: {
          category?: string
          created_at?: string
          elder_profile_id?: string
          family_voice_audio_url?: string | null
          frequency?: string
          id?: string
          is_enabled?: boolean
          message_text?: string
          schedule_time?: string
          title?: string
          type?: string
          voice_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_templates_elder_profile_id_fkey"
            columns: ["elder_profile_id"]
            isOneToOne: false
            referencedRelation: "elder_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_interactions: {
        Row: {
          answer_audio_url: string | null
          answer_text: string | null
          asked_at: string
          elder_profile_id: string
          id: string
          language_used: string | null
          question_audio_url: string | null
          question_transcript: string | null
        }
        Insert: {
          answer_audio_url?: string | null
          answer_text?: string | null
          asked_at?: string
          elder_profile_id: string
          id?: string
          language_used?: string | null
          question_audio_url?: string | null
          question_transcript?: string | null
        }
        Update: {
          answer_audio_url?: string | null
          answer_text?: string | null
          asked_at?: string
          elder_profile_id?: string
          id?: string
          language_used?: string | null
          question_audio_url?: string | null
          question_transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qa_interactions_elder_profile_id_fkey"
            columns: ["elder_profile_id"]
            isOneToOne: false
            referencedRelation: "elder_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_family_linked: {
        Args: { p_elder_id: string; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
