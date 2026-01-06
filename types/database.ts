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
      // Scanner Mode tables
      assignments: {
        Row: {
          id: string
          user_id: string
          classroom_id: string | null
          title: string
          subject: string | null
          description: string | null
          total_points: number
          due_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          classroom_id?: string | null
          title: string
          subject?: string | null
          description?: string | null
          total_points?: number
          due_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          classroom_id?: string | null
          title?: string
          subject?: string | null
          description?: string | null
          total_points?: number
          due_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_classroom_id_fkey"
            columns: ["classroom_id"]
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          }
        ]
      }
      students: {
        Row: {
          id: string
          user_id: string
          classroom_id: string | null
          first_name: string
          last_name: string
          student_id: string | null
          email: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          classroom_id?: string | null
          first_name: string
          last_name: string
          student_id?: string | null
          email?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          classroom_id?: string | null
          first_name?: string
          last_name?: string
          student_id?: string | null
          email?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_classroom_id_fkey"
            columns: ["classroom_id"]
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          }
        ]
      }
      scanner_sessions: {
        Row: {
          id: string
          user_id: string
          mode: 'grade' | 'key'
          assignment_id: string | null
          status: 'active' | 'completed' | 'cancelled'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          mode: 'grade' | 'key'
          assignment_id?: string | null
          status?: 'active' | 'completed' | 'cancelled'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          mode?: 'grade' | 'key'
          assignment_id?: string | null
          status?: 'active' | 'completed' | 'cancelled'
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scanner_sessions_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scanner_sessions_assignment_id_fkey"
            columns: ["assignment_id"]
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          }
        ]
      }
      scanned_documents: {
        Row: {
          id: string
          session_id: string
          user_id: string
          student_id: string | null
          assignment_id: string | null
          pages: Json
          ocr_raw: Json | null
          status: 'pending' | 'processing' | 'completed' | 'error'
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          session_id: string
          user_id: string
          student_id?: string | null
          assignment_id?: string | null
          pages?: Json
          ocr_raw?: Json | null
          status?: 'pending' | 'processing' | 'completed' | 'error'
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          user_id?: string
          student_id?: string | null
          assignment_id?: string | null
          pages?: Json
          ocr_raw?: Json | null
          status?: 'pending' | 'processing' | 'completed' | 'error'
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scanned_documents_session_id_fkey"
            columns: ["session_id"]
            referencedRelation: "scanner_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scanned_documents_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      extracted_questions: {
        Row: {
          id: string
          document_id: string
          user_id: string
          question_number: number
          region_bbox: Json | null
          page_index: number
          extracted_text: string | null
          confidence: number | null
          question_type: 'multiple_choice' | 'fill_in' | 'short_answer' | 'true_false' | 'math' | 'unknown' | null
          created_at: string
        }
        Insert: {
          id?: string
          document_id: string
          user_id: string
          question_number: number
          region_bbox?: Json | null
          page_index?: number
          extracted_text?: string | null
          confidence?: number | null
          question_type?: 'multiple_choice' | 'fill_in' | 'short_answer' | 'true_false' | 'math' | 'unknown' | null
          created_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          user_id?: string
          question_number?: number
          region_bbox?: Json | null
          page_index?: number
          extracted_text?: string | null
          confidence?: number | null
          question_type?: 'multiple_choice' | 'fill_in' | 'short_answer' | 'true_false' | 'math' | 'unknown' | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "extracted_questions_document_id_fkey"
            columns: ["document_id"]
            referencedRelation: "scanned_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extracted_questions_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      answer_keys: {
        Row: {
          id: string
          user_id: string
          assignment_id: string
          title: string
          source_type: 'teacher' | 'synthesized'
          rubric: Json
          total_points: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          assignment_id: string
          title: string
          source_type?: 'teacher' | 'synthesized'
          rubric?: Json
          total_points?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          assignment_id?: string
          title?: string
          source_type?: 'teacher' | 'synthesized'
          rubric?: Json
          total_points?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "answer_keys_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_keys_assignment_id_fkey"
            columns: ["assignment_id"]
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          }
        ]
      }
      answer_key_items: {
        Row: {
          id: string
          answer_key_id: string
          question_number: number
          correct_answer: string
          accepted_variants: Json
          points: number
          question_type: 'multiple_choice' | 'fill_in' | 'short_answer' | 'true_false' | 'math' | 'unknown' | null
          rubric_notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          answer_key_id: string
          question_number: number
          correct_answer: string
          accepted_variants?: Json
          points?: number
          question_type?: 'multiple_choice' | 'fill_in' | 'short_answer' | 'true_false' | 'math' | 'unknown' | null
          rubric_notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          answer_key_id?: string
          question_number?: number
          correct_answer?: string
          accepted_variants?: Json
          points?: number
          question_type?: 'multiple_choice' | 'fill_in' | 'short_answer' | 'true_false' | 'math' | 'unknown' | null
          rubric_notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "answer_key_items_answer_key_id_fkey"
            columns: ["answer_key_id"]
            referencedRelation: "answer_keys"
            referencedColumns: ["id"]
          }
        ]
      }
      grades: {
        Row: {
          id: string
          user_id: string
          student_id: string | null
          assignment_id: string
          document_id: string | null
          answer_key_id: string | null
          total_points: number
          earned_points: number
          percentage: number | null
          per_question: Json
          feedback_summary: string | null
          status: 'draft' | 'finalized' | 'exported'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          student_id?: string | null
          assignment_id: string
          document_id?: string | null
          answer_key_id?: string | null
          total_points: number
          earned_points: number
          percentage?: number | null
          per_question?: Json
          feedback_summary?: string | null
          status?: 'draft' | 'finalized' | 'exported'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          student_id?: string | null
          assignment_id?: string
          document_id?: string | null
          answer_key_id?: string | null
          total_points?: number
          earned_points?: number
          percentage?: number | null
          per_question?: Json
          feedback_summary?: string | null
          status?: 'draft' | 'finalized' | 'exported'
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grades_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_assignment_id_fkey"
            columns: ["assignment_id"]
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          }
        ]
      }
      question_grades: {
        Row: {
          id: string
          grade_id: string
          question_number: number
          student_answer: string | null
          correct_answer: string | null
          points_possible: number | null
          points_earned: number | null
          is_correct: boolean | null
          confidence: number | null
          needs_review: boolean
          teacher_override: boolean
          feedback: string | null
          created_at: string
        }
        Insert: {
          id?: string
          grade_id: string
          question_number: number
          student_answer?: string | null
          correct_answer?: string | null
          points_possible?: number | null
          points_earned?: number | null
          is_correct?: boolean | null
          confidence?: number | null
          needs_review?: boolean
          teacher_override?: boolean
          feedback?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          grade_id?: string
          question_number?: number
          student_answer?: string | null
          correct_answer?: string | null
          points_possible?: number | null
          points_earned?: number | null
          is_correct?: boolean | null
          confidence?: number | null
          needs_review?: boolean
          teacher_override?: boolean
          feedback?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_grades_grade_id_fkey"
            columns: ["grade_id"]
            referencedRelation: "grades"
            referencedColumns: ["id"]
          }
        ]
      }
      scan_templates: {
        Row: {
          id: string
          user_id: string
          assignment_id: string | null
          name: string
          page_dimensions: Json | null
          question_regions: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          assignment_id?: string | null
          name: string
          page_dimensions?: Json | null
          question_regions?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          assignment_id?: string | null
          name?: string
          page_dimensions?: Json | null
          question_regions?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scan_templates_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_templates_assignment_id_fkey"
            columns: ["assignment_id"]
            referencedRelation: "assignments"
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

// Scanner Mode types
export type Assignment = Database['public']['Tables']['assignments']['Row']
export type Student = Database['public']['Tables']['students']['Row']
export type ScannerSession = Database['public']['Tables']['scanner_sessions']['Row']
export type ScannedDocument = Database['public']['Tables']['scanned_documents']['Row']
export type ExtractedQuestion = Database['public']['Tables']['extracted_questions']['Row']
export type AnswerKey = Database['public']['Tables']['answer_keys']['Row']
export type AnswerKeyItem = Database['public']['Tables']['answer_key_items']['Row']
export type Grade = Database['public']['Tables']['grades']['Row']
export type QuestionGrade = Database['public']['Tables']['question_grades']['Row']
export type ScanTemplate = Database['public']['Tables']['scan_templates']['Row']
