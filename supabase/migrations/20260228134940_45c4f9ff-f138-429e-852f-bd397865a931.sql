
-- =============================================
-- 1. TABLES
-- =============================================

-- A) elder_profiles
CREATE TABLE public.elder_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  display_name TEXT NOT NULL,
  age INT,
  gender TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'English',
  timezone TEXT DEFAULT 'Europe/London',
  relationship_label TEXT,
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- B) family_links
CREATE TABLE public.family_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  elder_profile_id UUID NOT NULL REFERENCES public.elder_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(family_user_id, elder_profile_id)
);

-- C) notification_templates
CREATE TABLE public.notification_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  elder_profile_id UUID NOT NULL REFERENCES public.elder_profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('task', 'checkin')),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  schedule_time TEXT NOT NULL DEFAULT '09:00',
  frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'twice_daily', 'custom')),
  voice_mode TEXT NOT NULL DEFAULT 'tts_default' CHECK (voice_mode IN ('family_recorded', 'tts_default')),
  message_text TEXT NOT NULL,
  family_voice_audio_url TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- D) notification_instances
CREATE TABLE public.notification_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.notification_templates(id) ON DELETE CASCADE,
  elder_profile_id UUID NOT NULL REFERENCES public.elder_profiles(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'missed', 'unclear', 'no_response', 'missed_final')),
  reply_audio_url TEXT,
  reply_transcript TEXT,
  classification_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- E) qa_interactions
CREATE TABLE public.qa_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  elder_profile_id UUID NOT NULL REFERENCES public.elder_profiles(id) ON DELETE CASCADE,
  asked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  question_audio_url TEXT,
  question_transcript TEXT,
  answer_text TEXT,
  answer_audio_url TEXT,
  language_used TEXT
);

-- F) mood_settings
CREATE TABLE public.mood_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  elder_profile_id UUID NOT NULL REFERENCES public.elder_profiles(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  frequency TEXT NOT NULL DEFAULT 'once_daily' CHECK (frequency IN ('once_daily', 'twice_daily')),
  time_1 TEXT DEFAULT '10:00',
  time_2 TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(elder_profile_id)
);

-- G) mood_entries
CREATE TABLE public.mood_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  elder_profile_id UUID NOT NULL REFERENCES public.elder_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  mood_score INT NOT NULL CHECK (mood_score >= 1 AND mood_score <= 5),
  selected_tags TEXT[],
  ai_suggested_tags TEXT[],
  mood_audio_url TEXT,
  mood_transcript TEXT,
  acknowledgement_text TEXT
);

-- H) family_dashboard_visits
CREATE TABLE public.family_dashboard_visits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  elder_profile_id UUID NOT NULL REFERENCES public.elder_profiles(id) ON DELETE CASCADE,
  visited_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 2. HELPER FUNCTION: check family link
-- =============================================
CREATE OR REPLACE FUNCTION public.is_family_linked(p_user_id UUID, p_elder_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_links
    WHERE family_user_id = p_user_id AND elder_profile_id = p_elder_id
  );
$$;

-- =============================================
-- 3. ENABLE RLS ON ALL TABLES
-- =============================================
ALTER TABLE public.elder_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_dashboard_visits ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 4. RLS POLICIES
-- =============================================

-- elder_profiles: family can read/create elders they're linked to (or created)
CREATE POLICY "Family can view linked elders" ON public.elder_profiles
  FOR SELECT USING (public.is_family_linked(auth.uid(), id) OR created_by_user_id = auth.uid());

CREATE POLICY "Family can create elder profiles" ON public.elder_profiles
  FOR INSERT WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Family can update linked elders" ON public.elder_profiles
  FOR UPDATE USING (public.is_family_linked(auth.uid(), id));

-- family_links: users can see/create their own links
CREATE POLICY "Users can view own family links" ON public.family_links
  FOR SELECT USING (auth.uid() = family_user_id);

CREATE POLICY "Users can create own family links" ON public.family_links
  FOR INSERT WITH CHECK (auth.uid() = family_user_id);

-- notification_templates: scoped through family_links
CREATE POLICY "Family can view templates" ON public.notification_templates
  FOR SELECT USING (public.is_family_linked(auth.uid(), elder_profile_id));

CREATE POLICY "Family can create templates" ON public.notification_templates
  FOR INSERT WITH CHECK (public.is_family_linked(auth.uid(), elder_profile_id));

CREATE POLICY "Family can update templates" ON public.notification_templates
  FOR UPDATE USING (public.is_family_linked(auth.uid(), elder_profile_id));

CREATE POLICY "Family can delete templates" ON public.notification_templates
  FOR DELETE USING (public.is_family_linked(auth.uid(), elder_profile_id));

-- notification_instances: scoped through family_links + elder access
CREATE POLICY "Family can view instances" ON public.notification_instances
  FOR SELECT USING (public.is_family_linked(auth.uid(), elder_profile_id));

CREATE POLICY "Family can create instances" ON public.notification_instances
  FOR INSERT WITH CHECK (public.is_family_linked(auth.uid(), elder_profile_id));

CREATE POLICY "Family can update instances" ON public.notification_instances
  FOR UPDATE USING (public.is_family_linked(auth.uid(), elder_profile_id));

-- Elder access: allow unauthenticated select/update by elder_profile_id (for elder route)
CREATE POLICY "Elder can view own instances" ON public.notification_instances
  FOR SELECT USING (true);

CREATE POLICY "Elder can update own instances" ON public.notification_instances
  FOR UPDATE USING (true);

-- qa_interactions: elder can insert, family can read
CREATE POLICY "Anyone can insert qa" ON public.qa_interactions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view qa" ON public.qa_interactions
  FOR SELECT USING (true);

-- mood_settings: family can CRUD, elder can read
CREATE POLICY "Family can manage mood settings" ON public.mood_settings
  FOR ALL USING (public.is_family_linked(auth.uid(), elder_profile_id));

CREATE POLICY "Anyone can view mood settings" ON public.mood_settings
  FOR SELECT USING (true);

-- mood_entries: elder can insert, family can read
CREATE POLICY "Anyone can insert mood entries" ON public.mood_entries
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view mood entries" ON public.mood_entries
  FOR SELECT USING (true);

-- family_dashboard_visits: user's own visits
CREATE POLICY "Users manage own visits" ON public.family_dashboard_visits
  FOR ALL USING (auth.uid() = family_user_id);

-- =============================================
-- 5. STORAGE BUCKET
-- =============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('voice-recordings', 'voice-recordings', false);

-- Storage policies for voice-recordings bucket
CREATE POLICY "Authenticated users can upload voice recordings"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'voice-recordings' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read voice recordings"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'voice-recordings' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can read voice recordings for elder playback"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'voice-recordings');

CREATE POLICY "Anyone can upload voice recordings for elder"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'voice-recordings');
