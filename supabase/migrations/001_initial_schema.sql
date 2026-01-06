-- Teacher Companion - Initial Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  school_name TEXT,
  grade_level TEXT,
  timezone TEXT DEFAULT 'America/New_York',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Classrooms
CREATE TABLE public.classrooms (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  grade TEXT,
  subject TEXT,
  school_year TEXT,
  classroom_routines JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto Schedule Rules (for auto-scheduling lessons)
CREATE TABLE public.auto_schedule_rules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  subject TEXT NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Curriculum Sources (one scan session)
CREATE TABLE public.curriculum_sources (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT,
  subject TEXT,
  grade_level TEXT,
  source_type TEXT DEFAULT 'scan',
  status TEXT DEFAULT 'processing',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Curriculum Pages (each image in a scan session)
CREATE TABLE public.curriculum_pages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  curriculum_source_id UUID REFERENCES public.curriculum_sources(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  storage_path TEXT NOT NULL,
  page_number INTEGER NOT NULL,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- OCR Results (raw OCR output per page)
CREATE TABLE public.ocr_results (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  curriculum_page_id UUID REFERENCES public.curriculum_pages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  raw_text TEXT,
  structured_blocks JSONB,
  confidence FLOAT,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extraction Results (structured fields from OCR)
CREATE TABLE public.extraction_results (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  curriculum_source_id UUID REFERENCES public.curriculum_sources(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  detected_fields JSONB NOT NULL DEFAULT '{}',
  user_edits JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lesson Plans
CREATE TABLE public.lesson_plans (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  classroom_id UUID REFERENCES public.classrooms(id) ON DELETE SET NULL,
  curriculum_source_id UUID REFERENCES public.curriculum_sources(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  subject TEXT,
  grade_level TEXT,
  duration_minutes INTEGER,
  sections JSONB NOT NULL DEFAULT '{}',
  objectives TEXT[],
  vocabulary JSONB,
  standards TEXT[],
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Calendar Events
CREATE TABLE public.calendar_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  classroom_id UUID REFERENCES public.classrooms(id) ON DELETE SET NULL,
  lesson_plan_id UUID REFERENCES public.lesson_plans(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN DEFAULT false,
  color TEXT,
  recurring_rule TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attachments
CREATE TABLE public.attachments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  lesson_plan_id UUID REFERENCES public.lesson_plans(id) ON DELETE CASCADE,
  calendar_event_id UUID REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Share Links (for sub packets)
CREATE TABLE public.share_links (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  share_code TEXT NOT NULL UNIQUE,
  pin_hash TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  expires_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  classroom_routines JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_curriculum_sources_user ON public.curriculum_sources(user_id);
CREATE INDEX idx_curriculum_pages_source ON public.curriculum_pages(curriculum_source_id);
CREATE INDEX idx_ocr_results_page ON public.ocr_results(curriculum_page_id);
CREATE INDEX idx_lesson_plans_user ON public.lesson_plans(user_id);
CREATE INDEX idx_calendar_events_user_time ON public.calendar_events(user_id, start_time);
CREATE INDEX idx_share_links_code ON public.share_links(share_code);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_schedule_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocr_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extraction_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Classrooms
CREATE POLICY "Users can manage own classrooms" ON public.classrooms
  FOR ALL USING (auth.uid() = user_id);

-- Auto Schedule Rules
CREATE POLICY "Users can manage own schedule rules" ON public.auto_schedule_rules
  FOR ALL USING (auth.uid() = user_id);

-- Curriculum Sources
CREATE POLICY "Users can manage own curriculum sources" ON public.curriculum_sources
  FOR ALL USING (auth.uid() = user_id);

-- Curriculum Pages
CREATE POLICY "Users can manage own curriculum pages" ON public.curriculum_pages
  FOR ALL USING (auth.uid() = user_id);

-- OCR Results
CREATE POLICY "Users can manage own ocr results" ON public.ocr_results
  FOR ALL USING (auth.uid() = user_id);

-- Extraction Results
CREATE POLICY "Users can manage own extraction results" ON public.extraction_results
  FOR ALL USING (auth.uid() = user_id);

-- Lesson Plans
CREATE POLICY "Users can manage own lesson plans" ON public.lesson_plans
  FOR ALL USING (auth.uid() = user_id);

-- Calendar Events
CREATE POLICY "Users can manage own calendar events" ON public.calendar_events
  FOR ALL USING (auth.uid() = user_id);

-- Attachments
CREATE POLICY "Users can manage own attachments" ON public.attachments
  FOR ALL USING (auth.uid() = user_id);

-- Share Links
CREATE POLICY "Users can manage own share links" ON public.share_links
  FOR ALL USING (auth.uid() = user_id);

-- Create storage buckets (run separately in Supabase dashboard or via API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('curriculum-images', 'curriculum-images', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', false);

-- Storage policies (run after creating buckets)
-- CREATE POLICY "Users upload own images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'curriculum-images' AND (storage.foldername(name))[1] = auth.uid()::text);
-- CREATE POLICY "Users view own images" ON storage.objects FOR SELECT USING (bucket_id = 'curriculum-images' AND (storage.foldername(name))[1] = auth.uid()::text);
-- CREATE POLICY "Users delete own images" ON storage.objects FOR DELETE USING (bucket_id = 'curriculum-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
