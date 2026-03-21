
-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  user_type TEXT NOT NULL CHECK (user_type IN ('artist', 'record_label')),
  artist_name TEXT,
  record_label_name TEXT,
  legal_name TEXT NOT NULL,
  email TEXT NOT NULL,
  whatsapp_country_code TEXT NOT NULL DEFAULT '+91',
  whatsapp_number TEXT NOT NULL,
  instagram_link TEXT,
  facebook_link TEXT,
  spotify_link TEXT,
  youtube_link TEXT,
  country TEXT NOT NULL,
  state TEXT NOT NULL,
  address TEXT NOT NULL,
  id_proof_front_url TEXT,
  id_proof_back_url TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update all profiles (for verify/reject)
CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for ID proofs
INSERT INTO storage.buckets (id, name, public) VALUES ('id-proofs', 'id-proofs', false);

-- Only authenticated users can upload their own ID proofs
CREATE POLICY "Users can upload own id proofs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'id-proofs' AND auth.uid() IS NOT NULL AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can view their own ID proofs
CREATE POLICY "Users can view own id proofs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'id-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Admins can view all ID proofs (using a function to avoid direct auth check issues)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
$$;

CREATE POLICY "Admins can view all id proofs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'id-proofs' AND public.is_admin());
