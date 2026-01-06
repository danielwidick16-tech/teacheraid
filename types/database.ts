export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          school_name: string | null
          grade_level: string | null
          timezone: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          school_name?: string | null
          grade_level?: string | null
          timezone?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          school_name?: string | null
          grade_level?: string | null
          timezone?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      classrooms: {
        Row: {
          id: string
          user_id: string
          name: string
          grade: string | null
          subject: string | null
          school_year: string | null
          classroom_routines: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          grade?: string | null
          subject?: string | null
          school_year?: string | null
          classroom_routines?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          grade?: string | null
          subject?: string | null
          school_year?: string | null
          classroom_routines?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classrooms_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      auto_schedule_rules: {
        Row: {
          id: string
          user_id: string
          subject: string
          day_of_week: number
          start_time: string
          end_time: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          subject: string
          day_of_week: number
          start_time: string
          end_time: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          subject?: string
          day_of_week?: number
          start_time?: string
          end_time?: string
          is_active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_schedule_rules_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      curriculum_sources: {
        Row: {
          id: string
          user_id: string
          name: string | null
          subject: string | null
          grade_level: string | null
          source_type: string
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name?: string | null
          subject?: string | null
          grade_level?: string | null
          source_type?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string | null
          subject?: string | null
          grade_level?: string | null
          source_type?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_sources_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      curriculum_pages: {
        Row: {
          id: string
          curriculum_source_id: string
          user_id: string
          storage_path: string
          page_number: number
          file_name: string | null
          file_size: number | null
          mime_type: string | null
          created_at: string
        }
        Insert: {
          id?: string
          curriculum_source_id: string
          user_id: string
          storage_path: string
          page_number: number
          file_name?: string | null
          file_size?: number | null
          mime_type?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          curriculum_source_id?: string
          user_id?: string
          storage_path?: string
          page_number?: number
          file_name?: string | null
          file_size?: number | null
          mime_type?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_pages_curriculum_source_id_fkey"
            columns: ["curriculum_source_id"]
            referencedRelation: "curriculum_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_pages_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      ocr_results: {
        Row: {
          id: string
          curriculum_page_id: string
          user_id: string
          raw_text: string | null
          structured_blocks: Json | null
          confidence: number | null
          status: string
          error_message: string | null
          processing_time_ms: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          curriculum_page_id: string
          user_id: string
          raw_text?: string | null
          structured_blocks?: Json | null
          confidence?: number | null
          status?: string
          error_message?: string | null
          processing_time_ms?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          curriculum_page_id?: string
          user_id?: string
          raw_text?: string | null
          structured_blocks?: Json | null
          confidence?: number | null
          status?: string
          error_message?: string | null
          processing_time_ms?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocr_results_curriculum_page_id_fkey"
            columns: ["curriculum_page_id"]
            referencedRelation: "curriculum_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_results_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      extraction_results: {
        Row: {
          id: string
          curriculum_source_id: string
          user_id: string
          detected_fields: Json
          user_edits: Json | null
          final_fields: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          curriculum_source_id: string
          user_id: string
          detected_fields?: Json
          user_edits?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          curriculum_source_id?: string
          user_id?: string
          detected_fields?: Json
          user_edits?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "extraction_results_curriculum_source_id_fkey"
            columns: ["curriculum_source_id"]
            referencedRelation: "curriculum_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extraction_results_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      lesson_plans: {
        Row: {
          id: string
          user_id: string
          classroom_id: string | null
          curriculum_source_id: string | null
          title: string
          subject: string | null
          grade_level: string | null
          duration_minutes: number | null
          sections: Json
          objectives: string[] | null
          vocabulary: Json | null
          standards: string[] | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          classroom_id?: string | null
          curriculum_source_id?: string | null
          title: string
          subject?: string | null
          grade_level?: string | null
          duration_minutes?: number | null
          sections?: Json
          objectives?: string[] | null
          vocabulary?: Json | null
          standards?: string[] | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          classroom_id?: string | null
          curriculum_source_id?: string | null
          title?: string
          subject?: string | null
          grade_level?: string | null
          duration_minutes?: number | null
          sections?: Json
          objectives?: string[] | null
          vocabulary?: Json | null
          standards?: string[] | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_plans_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_plans_classroom_id_fkey"
            columns: ["classroom_id"]
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_plans_curriculum_source_id_fkey"
            columns: ["curriculum_source_id"]
            referencedRelation: "curriculum_sources"
            referencedColumns: ["id"]
          }
        ]
      }
      calendar_events: {
        Row: {
          id: string
          user_id: string
          classroom_id: string | null
          lesson_plan_id: string | null
          title: string
          description: string | null
          event_type: string
          start_time: string
          end_time: string
          all_day: boolean
          color: string | null
          recurring_rule: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          classroom_id?: string | null
          lesson_plan_id?: string | null
          title: string
          description?: string | null
          event_type: string
          start_time: string
          end_time: string
          all_day?: boolean
          color?: string | null
          recurring_rule?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          classroom_id?: string | null
          lesson_plan_id?: string | null
          title?: string
          description?: string | null
          event_type?: string
          start_time?: string
          end_time?: string
          all_day?: boolean
          color?: string | null
          recurring_rule?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_classroom_id_fkey"
            columns: ["classroom_id"]
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_lesson_plan_id_fkey"
            columns: ["lesson_plan_id"]
            referencedRelation: "lesson_plans"
            referencedColumns: ["id"]
          }
        ]
      }
      attachments: {
        Row: {
          id: string
          user_id: string
          lesson_plan_id: string | null
          calendar_event_id: string | null
          storage_path: string
          file_name: string
          file_size: number | null
          mime_type: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          lesson_plan_id?: string | null
          calendar_event_id?: string | null
          storage_path: string
          file_name: string
          file_size?: number | null
          mime_type?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          lesson_plan_id?: string | null
          calendar_event_id?: string | null
          storage_path?: string
          file_name?: string
          file_size?: number | null
          mime_type?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_lesson_plan_id_fkey"
            columns: ["lesson_plan_id"]
            referencedRelation: "lesson_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          }
        ]
      }
      share_links: {
        Row: {
          id: string
          user_id: string
          share_code: string
          pin_hash: string | null
          start_date: string
          end_date: string
          expires_at: string | null
          view_count: number
          is_active: boolean
          classroom_routines: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          share_code: string
          pin_hash?: string | null
          start_date: string
          end_date: string
          expires_at?: string | null
          view_count?: number
          is_active?: boolean
          classroom_routines?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          share_code?: string
          pin_hash?: string | null
          start_date?: string
          end_date?: string
          expires_at?: string | null
          view_count?: number
          is_active?: boolean
          classroom_routines?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_links_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      share_link_events: {
        Row: {
          id: string
          share_link_id: string
          calendar_event_id: string
        }
        Insert: {
          id?: string
          share_link_id: string
          calendar_event_id: string
        }
        Update: {
          id?: string
          share_link_id?: string
          calendar_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_link_events_share_link_id_fkey"
            columns: ["share_link_id"]
            referencedRelation: "share_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_link_events_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          }
        ]
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

// Helper types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Classroom = Database['public']['Tables']['classrooms']['Row']
export type AutoScheduleRule = Database['public']['Tables']['auto_schedule_rules']['Row']
export type CurriculumSource = Database['public']['Tables']['curriculum_sources']['Row']
export type CurriculumPage = Database['public']['Tables']['curriculum_pages']['Row']
export type OcrResult = Database['public']['Tables']['ocr_results']['Row']
export type ExtractionResult = Database['public']['Tables']['extraction_results']['Row']
export type LessonPlan = Database['public']['Tables']['lesson_plans']['Row']
export type CalendarEvent = Database['public']['Tables']['calendar_events']['Row']
export type Attachment = Database['public']['Tables']['attachments']['Row']
export type ShareLink = Database['public']['Tables']['share_links']['Row']
