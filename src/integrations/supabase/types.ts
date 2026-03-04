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
      achievements: {
        Row: {
          condition_type: string
          condition_value: number | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          key: string
          reward_fear: number | null
          reward_watermelons: number | null
          title: string
        }
        Insert: {
          condition_type?: string
          condition_value?: number | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          key: string
          reward_fear?: number | null
          reward_watermelons?: number | null
          title: string
        }
        Update: {
          condition_type?: string
          condition_value?: number | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          key?: string
          reward_fear?: number | null
          reward_watermelons?: number | null
          title?: string
        }
        Relationships: []
      }
      ai_settings: {
        Row: {
          id: string
          name: string
          prompt: string
          section_id: string
          service: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          prompt?: string
          section_id: string
          service?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          prompt?: string
          section_id?: string
          service?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_texts: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      audio_settings: {
        Row: {
          id: string
          key: string
          label: string | null
          updated_at: string
          value: string
        }
        Insert: {
          id?: string
          key: string
          label?: string | null
          updated_at?: string
          value: string
        }
        Update: {
          id?: string
          key?: string
          label?: string | null
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          friend_name: string
          id: string
          role: string
          telegram_id: number
        }
        Insert: {
          content: string
          created_at?: string
          friend_name: string
          id?: string
          role: string
          telegram_id: number
        }
        Update: {
          content?: string
          created_at?: string
          friend_name?: string
          id?: string
          role?: string
          telegram_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_telegram_id_fkey"
            columns: ["telegram_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["telegram_id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          description: string | null
          end_at: string | null
          event_type: string
          icon: string | null
          id: string
          is_active: boolean
          reward_energy: number | null
          reward_fear: number | null
          reward_watermelons: number | null
          start_at: string | null
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_at?: string | null
          event_type?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          reward_energy?: number | null
          reward_fear?: number | null
          reward_watermelons?: number | null
          start_at?: string | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_at?: string | null
          event_type?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          reward_energy?: number | null
          reward_fear?: number | null
          reward_watermelons?: number | null
          start_at?: string | null
          title?: string
        }
        Relationships: []
      }
      friends: {
        Row: {
          added_at: string
          friend_name: string
          friend_telegram_id: number | null
          id: string
          is_ai_enabled: boolean
          telegram_id: number
        }
        Insert: {
          added_at?: string
          friend_name: string
          friend_telegram_id?: number | null
          id?: string
          is_ai_enabled?: boolean
          telegram_id: number
        }
        Update: {
          added_at?: string
          friend_name?: string
          friend_telegram_id?: number | null
          id?: string
          is_ai_enabled?: boolean
          telegram_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "friends_friend_telegram_id_fkey"
            columns: ["friend_telegram_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["telegram_id"]
          },
          {
            foreignKeyName: "friends_telegram_id_fkey"
            columns: ["telegram_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["telegram_id"]
          },
        ]
      }
      gallery: {
        Row: {
          created_at: string
          id: string
          image_url: string
          label: string | null
          telegram_id: number
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          label?: string | null
          telegram_id: number
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          label?: string | null
          telegram_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "gallery_telegram_id_fkey"
            columns: ["telegram_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["telegram_id"]
          },
        ]
      }
      leaderboard_cache: {
        Row: {
          avatar_url: string | null
          display_name: string
          fear: number
          rank: number | null
          telegram_id: number
          telekinesis_level: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          display_name: string
          fear?: number
          rank?: number | null
          telegram_id: number
          telekinesis_level?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          display_name?: string
          fear?: number
          rank?: number | null
          telegram_id?: number
          telekinesis_level?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_cache_telegram_id_fkey"
            columns: ["telegram_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["telegram_id"]
          },
        ]
      }
      media_items: {
        Row: {
          created_at: string
          id: string
          label: string | null
          sort_order: number
          type: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          sort_order?: number
          type: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          sort_order?: number
          type?: string
          url?: string
        }
        Relationships: []
      }
      player_achievements: {
        Row: {
          achievement_id: string
          id: string
          telegram_id: number
          unlocked_at: string
        }
        Insert: {
          achievement_id: string
          id?: string
          telegram_id: number
          unlocked_at?: string
        }
        Update: {
          achievement_id?: string
          id?: string
          telegram_id?: number
          unlocked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_achievements_telegram_id_fkey"
            columns: ["telegram_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["telegram_id"]
          },
        ]
      }
      player_events: {
        Row: {
          assigned_at: string
          completed_at: string | null
          event_id: string
          id: string
          status: string
          telegram_id: number
        }
        Insert: {
          assigned_at?: string
          completed_at?: string | null
          event_id: string
          id?: string
          status?: string
          telegram_id: number
        }
        Update: {
          assigned_at?: string
          completed_at?: string | null
          event_id?: string
          id?: string
          status?: string
          telegram_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_events_telegram_id_fkey"
            columns: ["telegram_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["telegram_id"]
          },
        ]
      }
      player_inventory: {
        Row: {
          id: string
          item_id: string
          purchased_at: string
          telegram_id: number
        }
        Insert: {
          id?: string
          item_id: string
          purchased_at?: string
          telegram_id: number
        }
        Update: {
          id?: string
          item_id?: string
          purchased_at?: string
          telegram_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_inventory_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "shop_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_inventory_telegram_id_fkey"
            columns: ["telegram_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["telegram_id"]
          },
        ]
      }
      player_stats: {
        Row: {
          avatar_url: string | null
          boss_level: number
          character_gender: string | null
          character_name: string | null
          character_style: string | null
          created_at: string
          custom_settings: Json | null
          energy: number
          fear: number
          id: string
          lore: string | null
          max_energy: number
          telegram_id: number
          telekinesis_level: number
          total_clicks: number
          updated_at: string
          watermelons: number
        }
        Insert: {
          avatar_url?: string | null
          boss_level?: number
          character_gender?: string | null
          character_name?: string | null
          character_style?: string | null
          created_at?: string
          custom_settings?: Json | null
          energy?: number
          fear?: number
          id?: string
          lore?: string | null
          max_energy?: number
          telegram_id: number
          telekinesis_level?: number
          total_clicks?: number
          updated_at?: string
          watermelons?: number
        }
        Update: {
          avatar_url?: string | null
          boss_level?: number
          character_gender?: string | null
          character_name?: string | null
          character_style?: string | null
          created_at?: string
          custom_settings?: Json | null
          energy?: number
          fear?: number
          id?: string
          lore?: string | null
          max_energy?: number
          telegram_id?: number
          telekinesis_level?: number
          total_clicks?: number
          updated_at?: string
          watermelons?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_stats_telegram_id_fkey"
            columns: ["telegram_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["telegram_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          first_name: string
          id: string
          last_name: string | null
          photo_url: string | null
          profile_url: string | null
          referral_code: string | null
          role: string
          telegram_id: number
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string | null
          photo_url?: string | null
          profile_url?: string | null
          referral_code?: string | null
          role?: string
          telegram_id: number
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string | null
          photo_url?: string | null
          profile_url?: string | null
          referral_code?: string | null
          role?: string
          telegram_id?: number
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      shop_items: {
        Row: {
          cost: number
          currency: string
          description: string | null
          icon: string
          id: string
          name: string
          sort_order: number
          type: string
          updated_at: string
        }
        Insert: {
          cost?: number
          currency?: string
          description?: string | null
          icon?: string
          id: string
          name: string
          sort_order?: number
          type: string
          updated_at?: string
        }
        Update: {
          cost?: number
          currency?: string
          description?: string | null
          icon?: string
          id?: string
          name?: string
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      store_config: {
        Row: {
          id: string
          key: string
          label: string | null
          updated_at: string
          value: number
        }
        Insert: {
          id?: string
          key: string
          label?: string | null
          updated_at?: string
          value?: number
        }
        Update: {
          id?: string
          key?: string
          label?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
