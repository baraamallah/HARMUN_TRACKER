-- Supabase Schema for MUN Attendance Tracker

-- 1. Profiles table to store application-specific user data
-- Linked to Supabase Auth's auth.users table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  role TEXT DEFAULT 'user', -- 'admin', 'user'
  can_access_superior_admin BOOLEAN DEFAULT FALSE,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Participants table
CREATE TABLE public.participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  school TEXT NOT NULL,
  committee TEXT NOT NULL,
  country TEXT,
  status TEXT DEFAULT 'Absent',
  image_url TEXT,
  notes TEXT,
  additional_details TEXT,
  class_grade TEXT,
  email TEXT,
  phone TEXT,
  attended BOOLEAN DEFAULT FALSE,
  check_in_time TIMESTAMPTZ,
  day_attendance JSONB DEFAULT '{"day1": false, "day2": false}'::jsonb,
  check_in_times JSONB DEFAULT '{"day1": null, "day2": null}'::jsonb,
  status_history JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on participants
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

-- 3. Staff Members table
CREATE TABLE public.staff_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Optional link to auth user
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  department TEXT,
  team TEXT,
  email TEXT,
  phone TEXT,
  contact_info TEXT,
  status TEXT DEFAULT 'Off Duty',
  notes TEXT,
  image_url TEXT,
  permissions JSONB DEFAULT '{"canEditParticipants": false, "canEditParticipantStatus": false, "canEditStaff": false, "canEditStaffStatus": false}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on staff_members
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

-- 4. System lookup tables
CREATE TABLE public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.committees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.staff_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on system tables
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.committees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_teams ENABLE ROW LEVEL SECURITY;

-- 5. System Configuration
CREATE TABLE public.system_config (
  id TEXT PRIMARY KEY, -- e.g., 'main_settings'
  default_attendance_status TEXT DEFAULT 'Absent',
  default_staff_status TEXT DEFAULT 'Off Duty',
  event_logo_url TEXT,
  current_conference_day TEXT DEFAULT 'day1',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on system_config
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- --- RLS POLICIES ---

-- Helper function to check if user is superior admin
CREATE OR REPLACE FUNCTION public.is_superior_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT can_access_superior_admin
    FROM public.profiles
    WHERE id = auth.uid()
  ) OR (auth.jwt() ->> 'email' = 'jules@example.com'); -- Replace with actual owner email or handle via seed
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT role = 'admin'
    FROM public.profiles
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Superior admins can manage all profiles" ON public.profiles
  FOR ALL USING (public.is_superior_admin());

-- Participants Policies
CREATE POLICY "Participants are viewable by everyone" ON public.participants
  FOR SELECT USING (true);

CREATE POLICY "Admins and Superior Admins can manage participants" ON public.participants
  FOR ALL USING (public.is_admin() OR public.is_superior_admin());

-- Staff Members Policies
CREATE POLICY "Staff members are viewable by admins" ON public.staff_members
  FOR SELECT USING (public.is_admin() OR public.is_superior_admin());

CREATE POLICY "Admins and Superior Admins can manage staff members" ON public.staff_members
  FOR ALL USING (public.is_admin() OR public.is_superior_admin());

-- System Tables Policies (Public read, Superior Admin write)
CREATE POLICY "Schools are viewable by everyone" ON public.schools FOR SELECT USING (true);
CREATE POLICY "Committees are viewable by everyone" ON public.committees FOR SELECT USING (true);
CREATE POLICY "Staff teams are viewable by everyone" ON public.staff_teams FOR SELECT USING (true);
CREATE POLICY "Config is viewable by everyone" ON public.system_config FOR SELECT USING (true);

CREATE POLICY "Superior admins can manage schools" ON public.schools FOR ALL USING (public.is_superior_admin());
CREATE POLICY "Superior admins can manage committees" ON public.committees FOR ALL USING (public.is_superior_admin());
CREATE POLICY "Superior admins can manage staff teams" ON public.staff_teams FOR ALL USING (public.is_superior_admin());
CREATE POLICY "Superior admins can manage config" ON public.system_config FOR ALL USING (public.is_superior_admin());

-- --- INDEXES ---
CREATE INDEX idx_participants_school ON public.participants(school);
CREATE INDEX idx_participants_committee ON public.participants(committee);
CREATE INDEX idx_participants_status ON public.participants(status);
CREATE INDEX idx_staff_members_team ON public.staff_members(team);

-- --- FUNCTIONS & TRIGGERS ---

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_participants_updated_at BEFORE UPDATE ON public.participants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_staff_members_updated_at BEFORE UPDATE ON public.staff_members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to handle new user registration and create a profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
