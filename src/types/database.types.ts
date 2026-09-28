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
      ai_requests: {
        Row: {
          created_at: string
          id: string
          input_tokens: number | null
          kind: string
          model: string | null
          output_tokens: number | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          input_tokens?: number | null
          kind: string
          model?: string | null
          output_tokens?: number | null
          status?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          input_tokens?: number | null
          kind?: string
          model?: string | null
          output_tokens?: number | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      blocks: {
        Row: {
          actual_minutes: number | null
          closed_at: string | null
          created_at: string
          ends_at: string
          id: string
          notified_at: string | null
          pinned: boolean
          source: Database["public"]["Enums"]["block_source"]
          starts_at: string
          status: Database["public"]["Enums"]["block_status"]
          task_id: string | null
          updated_at: string
          user_id: string
          work_minutes: number
        }
        Insert: {
          actual_minutes?: number | null
          closed_at?: string | null
          created_at?: string
          ends_at: string
          id?: string
          notified_at?: string | null
          pinned?: boolean
          source?: Database["public"]["Enums"]["block_source"]
          starts_at: string
          status?: Database["public"]["Enums"]["block_status"]
          task_id?: string | null
          updated_at?: string
          user_id?: string
          work_minutes: number
        }
        Update: {
          actual_minutes?: number | null
          closed_at?: string | null
          created_at?: string
          ends_at?: string
          id?: string
          notified_at?: string | null
          pinned?: boolean
          source?: Database["public"]["Enums"]["block_source"]
          starts_at?: string
          status?: Database["public"]["Enums"]["block_status"]
          task_id?: string | null
          updated_at?: string
          user_id?: string
          work_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "blocks_task_same_user"
            columns: ["task_id", "user_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      calendar_feeds: {
        Row: {
          created_at: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          token?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      calendar_subscriptions: {
        Row: {
          created_at: string
          id: string
          last_error: string | null
          last_synced_at: string | null
          name: string
          type_id: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          name: string
          type_id: string
          updated_at?: string
          url: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          name?: string
          type_id?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_subscriptions_type_same_user"
            columns: ["type_id", "user_id"]
            isOneToOne: false
            referencedRelation: "task_types"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      external_events: {
        Row: {
          ends_at: string
          id: string
          starts_at: string
          subscription_id: string
          title: string
          uid: string
          user_id: string
        }
        Insert: {
          ends_at: string
          id?: string
          starts_at: string
          subscription_id: string
          title: string
          uid: string
          user_id: string
        }
        Update: {
          ends_at?: string
          id?: string
          starts_at?: string
          subscription_id?: string
          title?: string
          uid?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_events_subscription_same_user"
            columns: ["subscription_id", "user_id"]
            isOneToOne: false
            referencedRelation: "calendar_subscriptions"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      habit_checks: {
        Row: {
          created_at: string
          day: string
          habit_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day: string
          habit_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          day?: string
          habit_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_checks_habit_same_user"
            columns: ["habit_id", "user_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      habits: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
          weekdays: number[]
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id?: string
          weekdays?: number[]
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
          weekdays?: number[]
        }
        Relationships: []
      }
      monthly_reflections: {
        Row: {
          created_at: string
          goals_next: string | null
          id: string
          month: string
          priorities_change: string | null
          types_review: string | null
          updated_at: string
          user_id: string
          went_badly: string | null
          went_well: string | null
        }
        Insert: {
          created_at?: string
          goals_next?: string | null
          id?: string
          month: string
          priorities_change?: string | null
          types_review?: string | null
          updated_at?: string
          user_id?: string
          went_badly?: string | null
          went_well?: string | null
        }
        Update: {
          created_at?: string
          goals_next?: string | null
          id?: string
          month?: string
          priorities_change?: string | null
          types_review?: string | null
          updated_at?: string
          user_id?: string
          went_badly?: string | null
          went_well?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          daily_energy_limit: number
          day_end: string
          day_start: string
          display_name: string | null
          id: string
          onboarded_at: string | null
          reflection_level: Database["public"]["Enums"]["reflection_level"]
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_energy_limit?: number
          day_end?: string
          day_start?: string
          display_name?: string | null
          id: string
          onboarded_at?: string | null
          reflection_level?: Database["public"]["Enums"]["reflection_level"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_energy_limit?: number
          day_end?: string
          day_start?: string
          display_name?: string | null
          id?: string
          onboarded_at?: string | null
          reflection_level?: Database["public"]["Enums"]["reflection_level"]
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_secret: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_secret: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id?: string
        }
        Update: {
          auth_secret?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      recurring_events: {
        Row: {
          created_at: string
          end_time: string
          id: string
          start_time: string
          title: string
          type_id: string
          updated_at: string
          user_id: string
          valid_from: string
          valid_until: string | null
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          start_time: string
          title: string
          type_id: string
          updated_at?: string
          user_id?: string
          valid_from: string
          valid_until?: string | null
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          start_time?: string
          title?: string
          type_id?: string
          updated_at?: string
          user_id?: string
          valid_from?: string
          valid_until?: string | null
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "recurring_events_type_same_user"
            columns: ["type_id", "user_id"]
            isOneToOne: false
            referencedRelation: "task_types"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      task_types: {
        Row: {
          archived_at: string | null
          color: string
          created_at: string
          energy: number
          id: string
          is_one_off: boolean
          is_rest: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          color?: string
          created_at?: string
          energy?: number
          id?: string
          is_one_off?: boolean
          is_rest?: boolean
          name: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          archived_at?: string | null
          color?: string
          created_at?: string
          energy?: number
          id?: string
          is_one_off?: boolean
          is_rest?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          deadline: string | null
          estimate_minutes: number | null
          fixation: Database["public"]["Enums"]["task_fixation"]
          id: string
          notes: string | null
          priority: number
          session_minutes: number | null
          status: Database["public"]["Enums"]["task_status"]
          type_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          estimate_minutes?: number | null
          fixation?: Database["public"]["Enums"]["task_fixation"]
          id?: string
          notes?: string | null
          priority?: number
          session_minutes?: number | null
          status?: Database["public"]["Enums"]["task_status"]
          type_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          estimate_minutes?: number | null
          fixation?: Database["public"]["Enums"]["task_fixation"]
          id?: string
          notes?: string | null
          priority?: number
          session_minutes?: number | null
          status?: Database["public"]["Enums"]["task_status"]
          type_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_type_same_user"
            columns: ["type_id", "user_id"]
            isOneToOne: false
            referencedRelation: "task_types"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      weekly_reflections: {
        Row: {
          created_at: string
          distractions: number
          fatigue: number
          focus: number
          id: string
          note: string | null
          stress: number
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          distractions: number
          fatigue: number
          focus: number
          id?: string
          note?: string | null
          stress: number
          updated_at?: string
          user_id?: string
          week_start: string
        }
        Update: {
          created_at?: string
          distractions?: number
          fatigue?: number
          focus?: number
          id?: string
          note?: string | null
          stress?: number
          updated_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_plan: {
        Args: { p_new_blocks: Json; p_remove_ids: string[] }
        Returns: number
      }
      claim_push_subscription: {
        Args: {
          p_auth_secret: string
          p_endpoint: string
          p_p256dh: string
          p_user_agent: string
        }
        Returns: string
      }
      is_valid_timezone: { Args: { tz: string }; Returns: boolean }
      replace_external_events: {
        Args: { p_events: Json; p_subscription_id: string }
        Returns: number
      }
      rotate_calendar_feed: { Args: never; Returns: string }
      start_ai_request: { Args: { p_kind: string }; Returns: string }
      type_stats: {
        Args: { p_from: string; p_to: string }
        Returns: {
          actual_minutes: number
          color: string
          done_blocks: number
          is_one_off: boolean
          missed_blocks: number
          planned_minutes: number
          type_id: string
          type_name: string
        }[]
      }
    }
    Enums: {
      block_source: "manual" | "planner" | "ai" | "rest"
      block_status: "planned" | "done" | "missed"
      reflection_level: "basic" | "analytic" | "strategic"
      task_fixation: "hard" | "flexible"
      task_status: "active" | "done" | "cancelled"
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
      block_source: ["manual", "planner", "ai", "rest"],
      block_status: ["planned", "done", "missed"],
      reflection_level: ["basic", "analytic", "strategic"],
      task_fixation: ["hard", "flexible"],
      task_status: ["active", "done", "cancelled"],
    },
  },
} as const
