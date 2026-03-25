ALTER TABLE public.tracks ADD COLUMN status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.tracks ADD COLUMN rejection_reason text;