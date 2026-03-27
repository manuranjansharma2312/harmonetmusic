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
      agreement_templates: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_credit_transactions: {
        Row: {
          created_at: string
          credits: number
          id: string
          note: string | null
          order_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits: number
          id?: string
          note?: string | null
          order_id?: string | null
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits?: number
          id?: string
          note?: string | null
          order_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_credit_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "ai_plan_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_credits: {
        Row: {
          id: string
          total_credits: number
          updated_at: string
          used_credits: number
          user_id: string
        }
        Insert: {
          id?: string
          total_credits?: number
          updated_at?: string
          used_credits?: number
          user_id: string
        }
        Update: {
          id?: string
          total_credits?: number
          updated_at?: string
          used_credits?: number
          user_id?: string
        }
        Relationships: []
      }
      ai_generated_images: {
        Row: {
          created_at: string
          credits_used: number
          id: string
          image_url: string | null
          prompt: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_used?: number
          id?: string
          image_url?: string | null
          prompt: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_used?: number
          id?: string
          image_url?: string | null
          prompt?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_plan_orders: {
        Row: {
          created_at: string
          id: string
          payment_note: string | null
          plan_id: string
          rejection_reason: string | null
          screenshot_url: string | null
          status: string
          transaction_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payment_note?: string | null
          plan_id: string
          rejection_reason?: string | null
          screenshot_url?: string | null
          status?: string
          transaction_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payment_note?: string | null
          plan_id?: string
          rejection_reason?: string | null
          screenshot_url?: string | null
          status?: string
          transaction_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_plan_orders_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "ai_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_plans: {
        Row: {
          created_at: string
          credits: number
          description: string | null
          id: string
          is_active: boolean
          name: string
          price: number
          tag: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits?: number
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          price?: number
          tag?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits?: number
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          tag?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_settings: {
        Row: {
          api_provider: string
          credits_per_image: number
          custom_api_key: string | null
          free_credits: number
          id: string
          image_sizes: Json
          is_enabled: boolean
          lifetime_free_all_users: boolean
          lifetime_free_enabled: boolean
          lifetime_free_user_ids: string[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          api_provider?: string
          credits_per_image?: number
          custom_api_key?: string | null
          free_credits?: number
          id?: string
          image_sizes?: Json
          is_enabled?: boolean
          lifetime_free_all_users?: boolean
          lifetime_free_enabled?: boolean
          lifetime_free_user_ids?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          api_provider?: string
          credits_per_image?: number
          custom_api_key?: string | null
          free_credits?: number
          id?: string
          image_sizes?: Json
          is_enabled?: boolean
          lifetime_free_all_users?: boolean
          lifetime_free_enabled?: boolean
          lifetime_free_user_ids?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      bank_detail_audit_logs: {
        Row: {
          bank_detail_id: string
          changed_by: string
          changes: Json
          created_at: string
          id: string
        }
        Insert: {
          bank_detail_id: string
          changed_by: string
          changes?: Json
          created_at?: string
          id?: string
        }
        Update: {
          bank_detail_id?: string
          changed_by?: string
          changes?: Json
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_detail_audit_logs_bank_detail_id_fkey"
            columns: ["bank_detail_id"]
            isOneToOne: false
            referencedRelation: "bank_details"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_details: {
        Row: {
          account_holder_name: string
          account_number: string
          bank_address: string | null
          bank_name: string
          branch_name: string | null
          country: string | null
          created_at: string
          iban: string | null
          id: string
          ifsc_code: string | null
          is_locked: boolean
          payment_method: string
          swift_bic: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_holder_name: string
          account_number: string
          bank_address?: string | null
          bank_name: string
          branch_name?: string | null
          country?: string | null
          created_at?: string
          iban?: string | null
          id?: string
          ifsc_code?: string | null
          is_locked?: boolean
          payment_method?: string
          swift_bic?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_holder_name?: string
          account_number?: string
          bank_address?: string | null
          bank_name?: string
          branch_name?: string | null
          country?: string | null
          created_at?: string
          iban?: string | null
          id?: string
          ifsc_code?: string | null
          is_locked?: boolean
          payment_method?: string
          swift_bic?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      company_details: {
        Row: {
          address: string
          company_name: string
          id: string
          logo_url: string | null
          registration_ids: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string
          company_name?: string
          id?: string
          logo_url?: string | null
          registration_ids?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string
          company_name?: string
          id?: string
          logo_url?: string | null
          registration_ids?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      contact_support: {
        Row: {
          content: string
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
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
          payment_screenshot_url: string | null
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
          transaction_id: string | null
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
          payment_screenshot_url?: string | null
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
          transaction_id?: string | null
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
          payment_screenshot_url?: string | null
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
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
          video_link?: string | null
        }
        Relationships: []
      }
      email_accounts: {
        Row: {
          account_name: string
          created_at: string
          from_email: string
          from_name: string
          id: string
          is_default: boolean
          is_enabled: boolean
          provider: string
          reply_to_email: string | null
          smtp_encryption: string
          smtp_host: string
          smtp_password: string
          smtp_port: number
          smtp_username: string
          updated_at: string
        }
        Insert: {
          account_name: string
          created_at?: string
          from_email?: string
          from_name?: string
          id?: string
          is_default?: boolean
          is_enabled?: boolean
          provider?: string
          reply_to_email?: string | null
          smtp_encryption?: string
          smtp_host?: string
          smtp_password?: string
          smtp_port?: number
          smtp_username?: string
          updated_at?: string
        }
        Update: {
          account_name?: string
          created_at?: string
          from_email?: string
          from_name?: string
          id?: string
          is_default?: boolean
          is_enabled?: boolean
          provider?: string
          reply_to_email?: string | null
          smtp_encryption?: string
          smtp_host?: string
          smtp_password?: string
          smtp_port?: number
          smtp_username?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_categories: {
        Row: {
          created_at: string
          default_account_id: string | null
          id: string
          key: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_account_id?: string | null
          id?: string
          key: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_account_id?: string | null
          id?: string
          key?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_categories_default_account_id_fkey"
            columns: ["default_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_logs: {
        Row: {
          body_html: string | null
          error_message: string | null
          id: string
          recipient_email: string
          sent_at: string
          sent_by: string | null
          status: string
          subject: string | null
          template_key: string
          template_label: string | null
        }
        Insert: {
          body_html?: string | null
          error_message?: string | null
          id?: string
          recipient_email: string
          sent_at?: string
          sent_by?: string | null
          status?: string
          subject?: string | null
          template_key: string
          template_label?: string | null
        }
        Update: {
          body_html?: string | null
          error_message?: string | null
          id?: string
          recipient_email?: string
          sent_at?: string
          sent_by?: string | null
          status?: string
          subject?: string | null
          template_key?: string
          template_label?: string | null
        }
        Relationships: []
      }
      email_settings: {
        Row: {
          from_email: string | null
          from_name: string | null
          id: string
          is_enabled: boolean | null
          provider: string
          reply_to_email: string | null
          smtp_encryption: string | null
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: number | null
          smtp_username: string | null
          test_email_sent_at: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          from_email?: string | null
          from_name?: string | null
          id?: string
          is_enabled?: boolean | null
          provider?: string
          reply_to_email?: string | null
          smtp_encryption?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_username?: string | null
          test_email_sent_at?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          from_email?: string | null
          from_name?: string | null
          id?: string
          is_enabled?: boolean | null
          provider?: string
          reply_to_email?: string | null
          smtp_encryption?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_username?: string | null
          test_email_sent_at?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body_html: string
          category: string
          created_at: string | null
          email_account_id: string | null
          id: string
          is_enabled: boolean | null
          subject: string
          trigger_key: string
          trigger_label: string
          updated_at: string | null
          updated_by: string | null
          variables: string[] | null
        }
        Insert: {
          body_html?: string
          category?: string
          created_at?: string | null
          email_account_id?: string | null
          id?: string
          is_enabled?: boolean | null
          subject?: string
          trigger_key: string
          trigger_label: string
          updated_at?: string | null
          updated_by?: string | null
          variables?: string[] | null
        }
        Update: {
          body_html?: string
          category?: string
          created_at?: string | null
          email_account_id?: string | null
          id?: string
          is_enabled?: boolean | null
          subject?: string
          trigger_key?: string
          trigger_label?: string
          updated_at?: string | null
          updated_by?: string | null
          variables?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_email_account_id_fkey"
            columns: ["email_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
        ]
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
      invoices: {
        Row: {
          amount: number
          billing_name: string
          created_at: string
          harmonet_share_percent: number
          id: string
          invoice_date: string
          items: Json
          taxes: Json
          updated_at: string
          user_display_id: number
        }
        Insert: {
          amount: number
          billing_name: string
          created_at?: string
          harmonet_share_percent?: number
          id?: string
          invoice_date: string
          items?: Json
          taxes?: Json
          updated_at?: string
          user_display_id: number
        }
        Update: {
          amount?: number
          billing_name?: string
          created_at?: string
          harmonet_share_percent?: number
          id?: string
          invoice_date?: string
          items?: Json
          taxes?: Json
          updated_at?: string
          user_display_id?: number
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
      notice_reads: {
        Row: {
          id: string
          notice_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          id?: string
          notice_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          id?: string
          notice_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notice_reads_notice_id_fkey"
            columns: ["notice_id"]
            isOneToOne: false
            referencedRelation: "notices"
            referencedColumns: ["id"]
          },
        ]
      }
      notices: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          image_url: string | null
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          title?: string
          updated_at?: string
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
          hidden_cut_percent: number
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
          hidden_cut_percent?: number
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
          hidden_cut_percent?: number
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
      promotion_orders: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          rejection_reason: string | null
          screenshot_url: string | null
          starts_from: string | null
          status: string
          total_amount: number
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          rejection_reason?: string | null
          screenshot_url?: string | null
          starts_from?: string | null
          status?: string
          total_amount?: number
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          rejection_reason?: string | null
          screenshot_url?: string | null
          starts_from?: string | null
          status?: string
          total_amount?: number
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "promotion_products"
            referencedColumns: ["id"]
          },
        ]
      }
      promotion_products: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          platform: string | null
          price_per_unit: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          platform?: string | null
          price_per_unit?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          platform?: string | null
          price_per_unit?: number
          updated_at?: string
        }
        Relationships: []
      }
      promotion_settings: {
        Row: {
          id: string
          is_enabled: boolean
          qr_code_url: string | null
          takedown_amount: number
          takedown_payment_enabled: boolean
          takedown_tax_enabled: boolean
          tax_percent: number
          taxes: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          is_enabled?: boolean
          qr_code_url?: string | null
          takedown_amount?: number
          takedown_payment_enabled?: boolean
          takedown_tax_enabled?: boolean
          tax_percent?: number
          taxes?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          is_enabled?: boolean
          qr_code_url?: string | null
          takedown_amount?: number
          takedown_payment_enabled?: boolean
          takedown_tax_enabled?: boolean
          tax_percent?: number
          taxes?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      release_transfers: {
        Row: {
          from_user_id: string
          id: string
          isrcs: string[]
          release_id: string
          release_name: string
          to_user_id: string
          transferred_at: string
          transferred_by: string
        }
        Insert: {
          from_user_id: string
          id?: string
          isrcs?: string[]
          release_id: string
          release_name?: string
          to_user_id: string
          transferred_at?: string
          transferred_by: string
        }
        Update: {
          from_user_id?: string
          id?: string
          isrcs?: string[]
          release_id?: string
          release_name?: string
          to_user_id?: string
          transferred_at?: string
          transferred_by?: string
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
          platform_links: Json
          poster_url: string | null
          rejection_reason: string | null
          release_date: string
          release_type: string
          slug: string | null
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
          platform_links?: Json
          poster_url?: string | null
          rejection_reason?: string | null
          release_date: string
          release_type?: string
          slug?: string | null
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
          platform_links?: Json
          poster_url?: string | null
          rejection_reason?: string | null
          release_date?: string
          release_type?: string
          slug?: string | null
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
          cut_percent_snapshot: number | null
          downloads: number | null
          id: string
          imported_at: string | null
          isrc: string | null
          label: string | null
          net_generated_revenue: number | null
          p_line: string | null
          reporting_month: string
          revenue_frozen: boolean
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
          cut_percent_snapshot?: number | null
          downloads?: number | null
          id?: string
          imported_at?: string | null
          isrc?: string | null
          label?: string | null
          net_generated_revenue?: number | null
          p_line?: string | null
          reporting_month: string
          revenue_frozen?: boolean
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
          cut_percent_snapshot?: number | null
          downloads?: number | null
          id?: string
          imported_at?: string | null
          isrc?: string | null
          label?: string | null
          net_generated_revenue?: number | null
          p_line?: string | null
          reporting_month?: string
          revenue_frozen?: boolean
          sales_type?: string | null
          store?: string | null
          streams?: number | null
          track?: string | null
          upc?: string | null
          user_id?: string
        }
        Relationships: []
      }
      revenue_settings: {
        Row: {
          id: string
          updated_at: string
          updated_by: string | null
          withdrawal_threshold: number
        }
        Insert: {
          id?: string
          updated_at?: string
          updated_by?: string | null
          withdrawal_threshold?: number
        }
        Update: {
          id?: string
          updated_at?: string
          updated_by?: string | null
          withdrawal_threshold?: number
        }
        Relationships: []
      }
      signature_audit_logs: {
        Row: {
          action: string
          created_at: string
          document_id: string
          id: string
          ip_address: string | null
          metadata: Json | null
          recipient_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          created_at?: string
          document_id: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          recipient_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          document_id?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          recipient_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_audit_logs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "signature_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_audit_logs_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "signature_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_documents: {
        Row: {
          certificate_url: string | null
          created_at: string
          created_by: string
          description: string | null
          document_hash: string
          document_url: string
          expires_at: string | null
          id: string
          signed_pdf_url: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          certificate_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          document_hash: string
          document_url: string
          expires_at?: string | null
          id?: string
          signed_pdf_url?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          certificate_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          document_hash?: string
          document_url?: string
          expires_at?: string | null
          id?: string
          signed_pdf_url?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      signature_fields: {
        Row: {
          created_at: string
          document_id: string
          height: number
          id: string
          page_number: number
          recipient_id: string
          signature_image_url: string | null
          signed: boolean
          width: number
          x_position: number
          y_position: number
        }
        Insert: {
          created_at?: string
          document_id: string
          height?: number
          id?: string
          page_number?: number
          recipient_id: string
          signature_image_url?: string | null
          signed?: boolean
          width?: number
          x_position: number
          y_position: number
        }
        Update: {
          created_at?: string
          document_id?: string
          height?: number
          id?: string
          page_number?: number
          recipient_id?: string
          signature_image_url?: string | null
          signed?: boolean
          width?: number
          x_position?: number
          y_position?: number
        }
        Relationships: [
          {
            foreignKeyName: "signature_fields_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "signature_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_fields_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "signature_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_otp_logs: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          ip_address: string | null
          otp_code: string
          recipient_id: string
          verified: boolean | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          ip_address?: string | null
          otp_code: string
          recipient_id: string
          verified?: boolean | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          otp_code?: string
          recipient_id?: string
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_otp_logs_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "signature_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_recipients: {
        Row: {
          created_at: string
          document_id: string
          email: string
          geolocation: string | null
          id: string
          ip_address: string | null
          name: string
          otp_verified: boolean | null
          signature_data: string | null
          signature_type: string | null
          signed_at: string | null
          signing_order: number
          signing_token: string | null
          status: string
          token_expires_at: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          document_id: string
          email: string
          geolocation?: string | null
          id?: string
          ip_address?: string | null
          name: string
          otp_verified?: boolean | null
          signature_data?: string | null
          signature_type?: string | null
          signed_at?: string | null
          signing_order?: number
          signing_token?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          document_id?: string
          email?: string
          geolocation?: string | null
          id?: string
          ip_address?: string | null
          name?: string
          otp_verified?: boolean | null
          signature_data?: string | null
          signature_type?: string | null
          signed_at?: string | null
          signing_order?: number
          signing_token?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_recipients_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "signature_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_settings: {
        Row: {
          auto_send_completion: boolean
          completion_email_body: string
          completion_email_subject: string
          default_expiry_days: number
          id: string
          issued_by_address: string
          issued_by_email: string
          issued_by_name: string
          signing_email_body: string
          signing_email_subject: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auto_send_completion?: boolean
          completion_email_body?: string
          completion_email_subject?: string
          default_expiry_days?: number
          id?: string
          issued_by_address?: string
          issued_by_email?: string
          issued_by_name?: string
          signing_email_body?: string
          signing_email_subject?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auto_send_completion?: boolean
          completion_email_body?: string
          completion_email_subject?: string
          default_expiry_days?: number
          id?: string
          issued_by_address?: string
          issued_by_email?: string
          issued_by_name?: string
          signing_email_body?: string
          signing_email_subject?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          auto_clear_cache_enabled: boolean
          auto_clear_cache_interval: number
          debounce_delay: number
          enable_anti_inspection: boolean
          enable_background_animations: boolean
          enable_console_logs: boolean
          enable_error_reporting: boolean
          enable_image_lazy_load: boolean
          enable_lazy_loading: boolean
          enable_page_transitions: boolean
          enable_prefetch: boolean
          enable_realtime: boolean
          enable_text_selection: boolean
          enable_toast_notifications: boolean
          id: string
          image_quality: number
          maintenance_message: string
          maintenance_mode: boolean
          max_table_rows: number
          max_upload_size_mb: number
          query_cache_time: number
          query_retry_count: number
          query_stale_time: number
          session_timeout: number
          toast_duration: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auto_clear_cache_enabled?: boolean
          auto_clear_cache_interval?: number
          debounce_delay?: number
          enable_anti_inspection?: boolean
          enable_background_animations?: boolean
          enable_console_logs?: boolean
          enable_error_reporting?: boolean
          enable_image_lazy_load?: boolean
          enable_lazy_loading?: boolean
          enable_page_transitions?: boolean
          enable_prefetch?: boolean
          enable_realtime?: boolean
          enable_text_selection?: boolean
          enable_toast_notifications?: boolean
          id?: string
          image_quality?: number
          maintenance_message?: string
          maintenance_mode?: boolean
          max_table_rows?: number
          max_upload_size_mb?: number
          query_cache_time?: number
          query_retry_count?: number
          query_stale_time?: number
          session_timeout?: number
          toast_duration?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auto_clear_cache_enabled?: boolean
          auto_clear_cache_interval?: number
          debounce_delay?: number
          enable_anti_inspection?: boolean
          enable_background_animations?: boolean
          enable_console_logs?: boolean
          enable_error_reporting?: boolean
          enable_image_lazy_load?: boolean
          enable_lazy_loading?: boolean
          enable_page_transitions?: boolean
          enable_prefetch?: boolean
          enable_realtime?: boolean
          enable_text_selection?: boolean
          enable_toast_notifications?: boolean
          id?: string
          image_quality?: number
          maintenance_message?: string
          maintenance_mode?: boolean
          max_table_rows?: number
          max_upload_size_mb?: number
          query_cache_time?: number
          query_retry_count?: number
          query_stale_time?: number
          session_timeout?: number
          toast_duration?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      smart_link_api_configs: {
        Row: {
          api_key: string | null
          api_name: string
          api_url: string | null
          created_at: string
          id: string
          is_enabled: boolean
          notes: string | null
          updated_at: string
        }
        Insert: {
          api_key?: string | null
          api_name: string
          api_url?: string | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          notes?: string | null
          updated_at?: string
        }
        Update: {
          api_key?: string | null
          api_name?: string
          api_url?: string | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      smart_link_platforms: {
        Row: {
          created_at: string
          icon_url: string | null
          id: string
          is_active: boolean
          name: string
          placeholder: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name: string
          placeholder?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name?: string
          placeholder?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      smart_link_settings: {
        Row: {
          auto_fetch_enabled: boolean
          id: string
          is_enabled: boolean
          search_enabled: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auto_fetch_enabled?: boolean
          id?: string
          is_enabled?: boolean
          search_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auto_fetch_enabled?: boolean
          id?: string
          is_enabled?: boolean
          search_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      smart_links: {
        Row: {
          artist_name: string
          created_at: string
          id: string
          platform_links: Json
          poster_url: string | null
          rejection_reason: string | null
          slug: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          artist_name?: string
          created_at?: string
          id?: string
          platform_links?: Json
          poster_url?: string | null
          rejection_reason?: string | null
          slug?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          artist_name?: string
          created_at?: string
          id?: string
          platform_links?: Json
          poster_url?: string | null
          rejection_reason?: string | null
          slug?: string | null
          status?: string
          title?: string
          updated_at?: string
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
      sub_labels: {
        Row: {
          agreement_end_date: string
          agreement_start_date: string
          b2b_url: string | null
          created_at: string
          email: string
          id: string
          parent_label_name: string
          parent_user_id: string
          percentage_cut: number
          phone: string
          rejection_reason: string | null
          status: string
          sub_label_name: string
          sub_user_id: string | null
          updated_at: string
          withdrawal_threshold: number
        }
        Insert: {
          agreement_end_date: string
          agreement_start_date: string
          b2b_url?: string | null
          created_at?: string
          email: string
          id?: string
          parent_label_name: string
          parent_user_id: string
          percentage_cut?: number
          phone: string
          rejection_reason?: string | null
          status?: string
          sub_label_name: string
          sub_user_id?: string | null
          updated_at?: string
          withdrawal_threshold?: number
        }
        Update: {
          agreement_end_date?: string
          agreement_start_date?: string
          b2b_url?: string | null
          created_at?: string
          email?: string
          id?: string
          parent_label_name?: string
          parent_user_id?: string
          percentage_cut?: number
          phone?: string
          rejection_reason?: string | null
          status?: string
          sub_label_name?: string
          sub_user_id?: string | null
          updated_at?: string
          withdrawal_threshold?: number
        }
        Relationships: []
      }
      terms_and_conditions: {
        Row: {
          content: string
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
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
          rejection_reason: string | null
          release_id: string
          singer: string | null
          song_title: string
          spotify_link: string | null
          status: string
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
          rejection_reason?: string | null
          release_id: string
          singer?: string | null
          song_title: string
          spotify_link?: string | null
          status?: string
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
          rejection_reason?: string | null
          release_id?: string
          singer?: string | null
          song_title?: string
          spotify_link?: string | null
          status?: string
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
      tutorials: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          subject: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          subject: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
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
      withdrawal_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      youtube_report_entries: {
        Row: {
          artist: string | null
          c_line: string | null
          country: string | null
          created_at: string | null
          currency: string | null
          cut_percent_snapshot: number | null
          downloads: number | null
          id: string
          imported_at: string | null
          isrc: string | null
          label: string | null
          net_generated_revenue: number | null
          p_line: string | null
          reporting_month: string
          revenue_frozen: boolean
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
          cut_percent_snapshot?: number | null
          downloads?: number | null
          id?: string
          imported_at?: string | null
          isrc?: string | null
          label?: string | null
          net_generated_revenue?: number | null
          p_line?: string | null
          reporting_month: string
          revenue_frozen?: boolean
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
          cut_percent_snapshot?: number | null
          downloads?: number | null
          id?: string
          imported_at?: string | null
          isrc?: string | null
          label?: string | null
          net_generated_revenue?: number | null
          p_line?: string | null
          reporting_month?: string
          revenue_frozen?: boolean
          sales_type?: string | null
          store?: string | null
          streams?: number | null
          track?: string | null
          upc?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_ai_images: { Args: never; Returns: undefined }
      cleanup_rejected_smart_links: { Args: never; Returns: undefined }
      deduct_ai_credit: {
        Args: { _amount: number; _user_id: string }
        Returns: boolean
      }
      get_ai_settings_public: {
        Args: never
        Returns: {
          credits_per_image: number
          free_credits: number
          id: string
          image_sizes: Json
          is_enabled: boolean
          lifetime_free_all_users: boolean
          lifetime_free_enabled: boolean
          lifetime_free_user_ids: string[]
        }[]
      }
      get_auth_emails: {
        Args: { _user_ids: string[] }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      get_signing_data: { Args: { _token: string }; Returns: Json }
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
      init_ai_credits: {
        Args: { _free_credits: number; _user_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_parent_label: { Args: { _child_user_id: string }; Returns: boolean }
      log_ai_credit_transaction: {
        Args: {
          _credits: number
          _note?: string
          _type: string
          _user_id: string
        }
        Returns: undefined
      }
      log_signature_audit: {
        Args: {
          _action: string
          _ip: string
          _metadata?: Json
          _token: string
          _user_agent: string
        }
        Returns: undefined
      }
      request_signing_otp: {
        Args: { _ip: string; _token: string }
        Returns: boolean
      }
      submit_signature:
        | {
            Args: {
              _ip: string
              _signature_data: string
              _signature_type: string
              _token: string
              _user_agent: string
            }
            Returns: boolean
          }
        | {
            Args: {
              _geolocation?: string
              _ip: string
              _signature_data: string
              _signature_type: string
              _token: string
              _user_agent: string
            }
            Returns: boolean
          }
      user_owns_isrc: {
        Args: { _isrc: string; _user_id: string }
        Returns: boolean
      }
      verify_signing_otp: {
        Args: { _ip: string; _otp: string; _token: string }
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
