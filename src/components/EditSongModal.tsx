import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { normalizeIsrc } from '@/lib/isrc';

const GENRES = ['Pop', 'Rock', 'Hip Hop', 'R&B', 'Electronic', 'Jazz', 'Classical', 'Country', 'Folk', 'Reggae', 'Latin', 'Metal', 'Blues', 'Indie', 'Other'];

interface Song {
  id: string; title: string; artist: string; genre: string; language: string;
  release_date: string; isrc: string | null; status: string;
}

export function EditSongModal({ song, onClose, onSaved }: { song: Song; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: song.title, artist: song.artist, genre: song.genre,
    language: song.language, release_date: song.release_date, isrc: song.isrc || '',
  });
  const [saving, setSaving] = useState(false);

  const updateField = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));
  const inputClass = "w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm";

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from('songs').update({
      title: form.title, artist: form.artist, genre: form.genre,
      language: form.language, release_date: form.release_date, isrc: normalizeIsrc(form.isrc),
    }).eq('id', song.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Song updated!');
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      <div className="glass-strong rounded-2xl p-4 sm:p-6 max-w-lg w-full relative animate-scale-in max-h-[90vh] overflow-y-auto overflow-x-hidden" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-5 w-5" />
        </button>
        <h2 className="font-display text-xl font-bold text-foreground mb-4">Edit Song</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Title</label>
            <input className={inputClass} value={form.title} onChange={(e) => updateField('title', e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Artist</label>
            <input className={inputClass} value={form.artist} onChange={(e) => updateField('artist', e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Genre</label>
            <select className={inputClass} value={form.genre} onChange={(e) => updateField('genre', e.target.value)}>
              {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Language</label>
            <input className={inputClass} value={form.language} onChange={(e) => updateField('language', e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Release Date</label>
            <input type="date" className={inputClass} value={form.release_date} onChange={(e) => updateField('release_date', e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">ISRC</label>
            <input className={inputClass} value={form.isrc} onChange={(e) => updateField('isrc', e.target.value.toUpperCase())} />
          </div>
          <button type="submit" disabled={saving} className="w-full py-3 rounded-lg btn-primary-gradient text-primary-foreground font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Changes
          </button>
        </form>
      </div>
    </div>
  );
}
