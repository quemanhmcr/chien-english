-- SUPABASE SETUP SCRIPT (Full Identity & Learning Platform)

-- 1. Create lessons table
CREATE TABLE IF NOT EXISTS public.lessons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  level TEXT DEFAULT 'Beginner',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create exercises table
CREATE TABLE IF NOT EXISTS public.exercises (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID REFERENCES public.lessons ON DELETE CASCADE NOT NULL,
  vietnamese TEXT NOT NULL,
  hint TEXT,
  difficulty TEXT DEFAULT 'Medium',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  streak_current INTEGER DEFAULT 0,
  last_active_at TIMESTAMP WITH TIME ZONE
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 5. Admin Check Function (Prevents Infinite Recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RLS Policies for Lessons & Exercises
DROP POLICY IF EXISTS "Lessons are viewable by everyone." ON public.lessons;
CREATE POLICY "Lessons are viewable by everyone." ON public.lessons FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage lessons." ON public.lessons;
CREATE POLICY "Admins can manage lessons." ON public.lessons FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Exercises are viewable by everyone." ON public.exercises;
CREATE POLICY "Exercises are viewable by everyone." ON public.exercises FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage exercises." ON public.exercises;
CREATE POLICY "Admins can manage exercises." ON public.exercises FOR ALL USING (public.is_admin());

-- 7. RLS Policies for Profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Admins have full access to profiles." ON public.profiles;
CREATE POLICY "Admins have full access to profiles." ON public.profiles FOR ALL USING (public.is_admin());

-- 8. User Progress Tracking
CREATE TABLE IF NOT EXISTS public.user_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  lesson_id UUID REFERENCES public.lessons ON DELETE CASCADE NOT NULL,
  score INTEGER NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Individual Exercise Progress Tracking
CREATE TABLE IF NOT EXISTS public.user_exercise_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  exercise_id UUID REFERENCES public.exercises ON DELETE CASCADE NOT NULL,
  is_completed BOOLEAN DEFAULT true,
  last_score INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, exercise_id)
);

ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_exercise_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own progress." ON public.user_progress;
CREATE POLICY "Users can view their own progress." ON public.user_progress FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own progress." ON public.user_progress;
CREATE POLICY "Users can insert their own progress." ON public.user_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can view all progress." ON public.user_progress;
CREATE POLICY "Admins can view all progress." ON public.user_progress FOR SELECT USING (public.is_admin());

-- RLS for user_exercise_progress
DROP POLICY IF EXISTS "Users can view own exercise progress." ON public.user_exercise_progress;
CREATE POLICY "Users can view own exercise progress." ON public.user_exercise_progress FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own exercise progress." ON public.user_exercise_progress;
CREATE POLICY "Users can update own exercise progress." ON public.user_exercise_progress FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can view all exercise progress." ON public.user_exercise_progress;
CREATE POLICY "Admins can view all exercise progress." ON public.user_exercise_progress FOR SELECT USING (public.is_admin());

-- 9. Trigger for handling new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    'student'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- INITIAL ADMIN SETUP
-- Run this manually if you want to make yourself an admin:
-- UPDATE public.profiles SET role = 'admin' WHERE id = 'YOUR_USER_ID_HERE';
