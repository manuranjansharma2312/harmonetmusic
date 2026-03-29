
-- Update cut_percent for linked channels
UPDATE youtube_cms_links SET cut_percent = 15 WHERE channel_name = 'Music Vibes Official' AND status = 'linked';
UPDATE youtube_cms_links SET cut_percent = 20 WHERE channel_name = 'Vocal Harmony Channel' AND status = 'linked';
UPDATE youtube_cms_links SET cut_percent = 10 WHERE channel_name = 'Rhythm Studios Official' AND status = 'linked';

-- Insert demo CMS report entries
INSERT INTO cms_report_entries (channel_name, reporting_month, label, track, artist, currency, streams, downloads, net_generated_revenue) VALUES
  ('Music Vibes Official', 'January 2026', 'Vibes Records', 'Midnight Dreams', 'DJ Pulse', 'INR', 125000, 3200, 4500.50),
  ('Music Vibes Official', 'January 2026', 'Vibes Records', 'Summer Breeze', 'Luna Sky', 'INR', 98000, 2800, 3200.75),
  ('Music Vibes Official', 'January 2026', 'Vibes Records', 'Electric Soul', 'DJ Pulse', 'INR', 75000, 1500, 2100.00),
  ('Music Vibes Official', 'February 2026', 'Vibes Records', 'Midnight Dreams', 'DJ Pulse', 'INR', 140000, 3800, 5200.25),
  ('Music Vibes Official', 'February 2026', 'Vibes Records', 'Summer Breeze', 'Luna Sky', 'INR', 110000, 3100, 3800.00),
  ('Music Vibes Official', 'February 2026', 'Vibes Records', 'Neon Lights', 'Aria Moon', 'INR', 65000, 1200, 1850.50),
  ('Music Vibes Official', 'March 2026', 'Vibes Records', 'Midnight Dreams', 'DJ Pulse', 'INR', 160000, 4200, 6100.00),
  ('Music Vibes Official', 'March 2026', 'Vibes Records', 'Ocean Waves', 'Luna Sky', 'INR', 88000, 2400, 2900.25),
  ('Vocal Harmony Channel', 'January 2026', 'Harmony Label', 'Golden Voice', 'Sarah Belle', 'INR', 200000, 5000, 7500.00),
  ('Vocal Harmony Channel', 'January 2026', 'Harmony Label', 'Whisper Song', 'Mark Tone', 'INR', 150000, 4200, 5800.50),
  ('Vocal Harmony Channel', 'February 2026', 'Harmony Label', 'Golden Voice', 'Sarah Belle', 'INR', 220000, 5500, 8200.00),
  ('Vocal Harmony Channel', 'February 2026', 'Harmony Label', 'Crystal Clear', 'Sarah Belle', 'INR', 95000, 2000, 3100.75),
  ('Vocal Harmony Channel', 'March 2026', 'Harmony Label', 'Golden Voice', 'Sarah Belle', 'INR', 250000, 6000, 9500.00),
  ('Vocal Harmony Channel', 'March 2026', 'Harmony Label', 'Whisper Song', 'Mark Tone', 'INR', 180000, 4800, 6800.25);
