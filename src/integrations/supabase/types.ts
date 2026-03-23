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
      content_requests: {
        Row: {
          artist_name: string | null
          channel_link: string | null
          copyright_company: string | null
          created_at: string
          id: string
          instagram_audio_link: string | null
          instagram_profile_link: string | null
          isrc: string | null
          official_artist_channel_link: string | null
          reason_for_takedown: string | null
          rejection_reason: string | null
          release_link_1: string | null
          release_link_2: string | null
          release_link_3: string | null
          release_topic_video_link: string | null
          request_type: string
          song_title: string | null
          status: string
          topic_channel_link: string | null
          updated_at: string
          user_id: string
          video_link: string | null
        }
        Insert: {
          artist_name?: string | null
          channel_link?: string | null
          copyright_company?: string | null
          created_at?: string
          id?: string
          instagram_audio_link?: string | null
          instagram_profile_link?: string | null
          isrc?: string | null
          official_artist_channel_link?: string | null
          reason_for_takedown?: string | null
          rejection_reason?: string | null
          release_link_1?: string | null
          release_link_2?: string | null
          release_link_3?: string | null
          release_topic_video_link?: string | null
          request_type: string
          song_title?: string | null
          status?: string
          topic_channel_link?: string | null
          updated_at?: string
          user_id: string
          video_link?: string | null
        }
        Update: {
          artist_name?: string | null
          channel_link?: string | null
          copyright_company?: string | null
          created_at?: string
          id?: string
          instagram_audio_link?: string | null
          instagram_profile_link?: string | null
          isrc?: string | null
          official_artist_channel_link?: string | null
          reason_for_takedown?: string | null
          rejection_reason?: string | null
          release_link_1?: string | null
          release_link_2?: string | null
          release_link_3?: string | null
          release_topic_video_link?: string | null
          request_type?: string
          song_title?: string | null
          status?: string
          topic_channel_link?: string | null
          updated_at?: string
          user_id?: string
          video_link?: string | null
        }
        Relationships: []
      }
      genres: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      labels: {
        Row: {
          b2b_url: string | null
          created_at: string
          id: string
          label_name: string
          rejection_reason: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          b2b_url?: string | null
          created_at?: string
          id?: string
          label_name: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          b2b_url?: string | null
          created_at?: string
          id?: string
          label_name?: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      languages: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string
          artist_name: string | null
          country: string
          created_at: string
          display_id: number
          email: string
          facebook_link: string | null
          id: string
          id_proof_back_url: string | null
          id_proof_front_url: string | null
          instagram_link: string | null
          legal_name: string
          record_label_name: string | null
          spotify_link: string | null
          state: string
          updated_at: string
          user_id: string
          user_type: string
          verification_status: string
          whatsapp_country_code: string
          whatsapp_number: string
          youtube_link: string | null
        }
        Insert: {
          address: string
          artist_name?: string | null
          country: string
          created_at?: string
          display_id?: number
          email: string
          facebook_link?: string | null
          id?: string
          id_proof_back_url?: string | null
          id_proof_front_url?: string | null
          instagram_link?: string | null
          legal_name: string
          record_label_name?: string | null
          spotify_link?: string | null
          state: string
          updated_at?: string
          user_id: string
          user_type: string
          verification_status?: string
          whatsapp_country_code?: string
          whatsapp_number: string
          youtube_link?: string | null
        }
        Update: {
          address?: string
          artist_name?: string | null
          country?: string
          created_at?: string
          display_id?: number
          email?: string
          facebook_link?: string | null
          id?: string
          id_proof_back_url?: string | null
          id_proof_front_url?: string | null
          instagram_link?: string | null
          legal_name?: string
          record_label_name?: string | null
          spotify_link?: string | null
          state?: string
          updated_at?: string
          user_id?: string
          user_type?: string
          verification_status?: string
          whatsapp_country_code?: string
          whatsapp_number?: string
          youtube_link?: string | null
        }
        Relationships: []
      }
      releases: {
        Row: {
          album_name: string | null
          content_type: string
          copyright_line: string | null
          created_at: string
          ep_name: string | null
          id: string
          phonogram_line: string | null
          poster_url: string | null
          rejection_reason: string | null
          release_date: string
          release_type: string
          status: string
          store_selection: string
          upc: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          album_name?: string | null
          content_type?: string
          copyright_line?: string | null
          created_at?: string
          ep_name?: string | null
          id?: string
          phonogram_line?: string | null
          poster_url?: string | null
          rejection_reason?: string | null
          release_date: string
          release_type?: string
          status?: string
          store_selection?: string
          upc?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          album_name?: string | null
          content_type?: string
          copyright_line?: string | null
          created_at?: string
          ep_name?: string | null
          id?: string
          phonogram_line?: string | null
          poster_url?: string | null
          rejection_reason?: string | null
          release_date?: string
          release_type?: string
          status?: string
          store_selection?: string
          upc?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      report_entries: {
        Row: {
          artist: string | null
          c_line: string | null
          country: string | null
          created_at: string | null
          currency: string | null
          downloads: number | null
          id: string
          imported_at: string | null
          isrc: string | null
          label: string | null
          net_generated_revenue: number | null
          p_line: string | null
          reporting_month: string
          sales_type: string | null
          store: string | null
          streams: number | null
          track: string | null
          upc: string | null
          user_id: string
        }
        Insert: {
          artist?: string | null
          c_line?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          downloads?: number | null
          id?: string
          imported_at?: string | null
          isrc?: string | null
          label?: string | null
          net_generated_revenue?: number | null
          p_line?: string | null
          reporting_month: string
          sales_type?: string | null
          store?: string | null
          streams?: number | null
          track?: string | null
          upc?: string | null
          user_id: string
        }
        Update: {
          artist?: string | null
          c_line?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          downloads?: number | null
          id?: string
          imported_at?: string | null
          isrc?: string | null
          label?: string | null
          net_generated_revenue?: number | null
          p_line?: string | null
          reporting_month?: string
          sales_type?: string | null
          store?: string | null
          streams?: number | null
          track?: string | null
          upc?: string | null
          user_id?: string
        }
        Relationships: []
      }
      songs: {
        Row: {
          artist: string
          audio_url: string | null
          cover_url: string | null
          created_at: string
          genre: string
          id: string
          isrc: string | null
          language: string
          release_date: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          artist: string
          audio_url?: string | null
          cover_url?: string | null
          created_at?: string
          genre: string
          id?: string
          isrc?: string | null
          language: string
          release_date: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          artist?: string
          audio_url?: string | null
          cover_url?: string | null
          created_at?: string
          genre?: string
          id?: string
          isrc?: string | null
          language?: string
          release_date?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tracks: {
        Row: {
          apple_music_link: string | null
          audio_type: string
          audio_url: string | null
          callertune_time: string | null
          composer: string | null
          copyright_line: string | null
          created_at: string
          genre: string | null
          id: string
          instagram_link: string | null
          is_new_artist_profile: boolean | null
          isrc: string | null
          language: string | null
          lyricist: string | null
          phonogram_line: string | null
          primary_artist: string | null
          producer: string | null
          release_id: string
          song_title: string
          spotify_link: string | null
          track_order: number
          user_id: string
        }
        Insert: {
          apple_music_link?: string | null
          audio_type?: string
          audio_url?: string | null
          callertune_time?: string | null
          composer?: string | null
          copyright_line?: string | null
          created_at?: string
          genre?: string | null
          id?: string
          instagram_link?: string | null
          is_new_artist_profile?: boolean | null
          isrc?: string | null
          language?: string | null
          lyricist?: string | null
          phonogram_line?: string | null
          primary_artist?: string | null
          producer?: string | null
          release_id: string
          song_title: string
          spotify_link?: string | null
          track_order?: number
          user_id: string
        }
        Update: {
          apple_music_link?: string | null
          audio_type?: string
          audio_url?: string | null
          callertune_time?: string | null
          composer?: string | null
          copyright_line?: string | null
          created_at?: string
          genre?: string | null
          id?: string
          instagram_link?: string | null
          is_new_artist_profile?: boolean | null
          isrc?: string | null
          language?: string | null
          lyricist?: string | null
          phonogram_line?: string | null
          primary_artist?: string | null
          producer?: string | null
          release_id?: string
          song_title?: string
          spotify_link?: string | null
          track_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracks_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      get_auth_emails: {
        Args: { _user_ids: string[] }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      user_owns_isrc: {
        Args: { _isrc: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "user" | "admin"
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
      app_role: ["user", "admin"],
    },
  },
} as const
