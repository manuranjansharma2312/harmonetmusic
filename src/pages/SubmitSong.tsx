import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';

const GENRES = ['Pop', 'Rock', 'Hip Hop', 'R&B', 'Electronic', 'Jazz', 'Classical', 'Country', 'Folk', 'Reggae', 'Latin', 'Metal', 'Blues', 'Indie', 'Other'];

export default function SubmitSong() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '', artist: '', genre: GENRES[0], language: '', release_date: '', isrc: '',
  });
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const updateField = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);

    try {
      let audio_url = null;
      let cover_url = null;

      if (audioFile) {
        const path = `${user.id}/${Date.now()}-${audioFile.name}`;
        const { error } = await supabase.storage.from('audio').upload(path, audioFile);
        if (error) throw error;
        const { data: urlData } = supabase.storage.from('audio').getPublicUrl(path);
        audio_url = urlData.publicUrl;
      }

      if (coverFile) {
        const path = `${user.id}/${Date.now()}-${coverFile.name}`;
        const { error } = await supabase.storage.from('covers').upload(path, coverFile);
        if (error) throw error;
        const { data: urlData } = supabase.storage.from('covers').getPublicUrl(path);
        cover_url = urlData.publicUrl;
      }

      const { error } = await supabase.from('songs').insert({
        user_id: user.id,
        title: form.title,
        artist: form.artist,
        genre: form.genre,
        language: form.language,
        release_date: form.release_date,
        isrc: form.isrc || null,
        audio_url,
        cover_url,
      });

      if (error) throw error;
      toast.success('Song submitted successfully!');
      navigate('/my-songs');
    } catch (err: any) {
      toast.error(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full px-4 py-3 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm";

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 text-left sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">Submit a Song</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">Fill in the details to distribute your music.</p>
        </div>

        <GlassCard glow className="w-full animate-fade-in">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Song Title *</label>
                <input className={inputClass} value={form.title} onChange={(e) => updateField('title', e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Artist Name *</label>
                <input className={inputClass} value={form.artist} onChange={(e) => updateField('artist', e.target.value)} required />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Genre *</label>
                <select className={inputClass} value={form.genre} onChange={(e) => updateField('genre', e.target.value)}>
                  {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Language *</label>
                <input className={inputClass} value={form.language} onChange={(e) => updateField('language', e.target.value)} required />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Release Date *</label>
                <input type="date" className={inputClass} value={form.release_date} onChange={(e) => updateField('release_date', e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">ISRC (optional)</label>
                <input className={inputClass} value={form.isrc} onChange={(e) => updateField('isrc', e.target.value)} placeholder="e.g. USRC17607839" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Audio File (MP3/WAV)</label>
                <div className="relative">
                  <input
                    type="file"
                    accept=".mp3,.wav,audio/mpeg,audio/wav"
                    onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="audio-upload"
                  />
                  <label htmlFor="audio-upload" className={`${inputClass} flex min-w-0 cursor-pointer items-center gap-2`}>
                    <Upload className="h-4 w-4" />
                    <span className="truncate">{audioFile?.name || 'Choose audio file'}</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Cover Art (Image)</label>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="cover-upload"
                  />
                  <label htmlFor="cover-upload" className={`${inputClass} flex min-w-0 cursor-pointer items-center gap-2`}>
                    <Upload className="h-4 w-4" />
                    <span className="truncate">{coverFile?.name || 'Choose cover image'}</span>
                  </label>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg btn-primary-gradient py-3 font-semibold text-primary-foreground disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit Song
            </button>
          </form>
        </GlassCard>
      </div>
    </DashboardLayout>
  );
}
