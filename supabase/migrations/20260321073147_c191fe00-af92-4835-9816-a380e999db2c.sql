
-- Create genres table (admin-managed)
CREATE TABLE public.genres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.genres ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view genres" ON public.genres FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert genres" ON public.genres FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update genres" ON public.genres FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete genres" ON public.genres FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Create languages table (admin-managed)
CREATE TABLE public.languages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.languages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view languages" ON public.languages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert languages" ON public.languages FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update languages" ON public.languages FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete languages" ON public.languages FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Create releases table
CREATE TABLE public.releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  release_type text NOT NULL DEFAULT 'new_release',
  content_type text NOT NULL DEFAULT 'single',
  album_name text,
  ep_name text,
  upc text,
  poster_url text,
  release_date date NOT NULL,
  copyright_line text,
  phonogram_line text,
  store_selection text NOT NULL DEFAULT 'worldwide',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own releases" ON public.releases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own releases" ON public.releases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pending releases" ON public.releases FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "Users can delete own releases" ON public.releases FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all releases" ON public.releases FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update any release" ON public.releases FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete any release" ON public.releases FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Create tracks table
CREATE TABLE public.tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id uuid NOT NULL REFERENCES public.releases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  song_title text NOT NULL,
  isrc text,
  audio_url text,
  audio_type text NOT NULL DEFAULT 'with_vocal',
  language text,
  genre text,
  primary_artist text,
  spotify_link text,
  apple_music_link text,
  is_new_artist_profile boolean DEFAULT false,
  lyricist text,
  composer text,
  producer text,
  instagram_link text,
  callertune_time text,
  track_order integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tracks" ON public.tracks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tracks" ON public.tracks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tracks" ON public.tracks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tracks" ON public.tracks FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all tracks" ON public.tracks FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update any track" ON public.tracks FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete any track" ON public.tracks FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed genres
INSERT INTO public.genres (name) VALUES ('Pop'), ('Rock'), ('Hip Hop'), ('R&B'), ('Electronic'), ('Jazz'), ('Classical'), ('Country'), ('Folk'), ('Reggae'), ('Latin'), ('Metal'), ('Blues'), ('Indie'), ('Devotional'), ('Bollywood'), ('Punjabi'), ('Ghazal'), ('Sufi'), ('Lo-fi');

-- Seed languages
INSERT INTO public.languages (name) VALUES ('English'), ('Hindi'), ('Punjabi'), ('Tamil'), ('Telugu'), ('Bengali'), ('Marathi'), ('Gujarati'), ('Kannada'), ('Malayalam'), ('Urdu'), ('Spanish'), ('French'), ('Korean'), ('Japanese'), ('Arabic'), ('Portuguese'), ('German');

-- Create poster storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('posters', 'posters', true);

-- Storage policies for posters
CREATE POLICY "Users can upload posters" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'posters' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Anyone can view posters" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'posters');
CREATE POLICY "Users can delete own posters" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'posters' AND (storage.foldername(name))[1] = auth.uid()::text);
