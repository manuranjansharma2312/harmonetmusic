import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Music2, Plus } from 'lucide-react';

// Spotify & Apple Music SVG logos inline
const SpotifyIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#1DB954">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

const AppleMusicIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#FA243C">
    <path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043A5.022 5.022 0 0019.7.28C18.96.142 18.21.08 17.46.04 16.95.01 16.44 0 15.93 0H8.07C7.56 0 7.05.01 6.54.04 5.79.08 5.04.142 4.3.28a5.022 5.022 0 00-1.874.61C1.308 1.622.563 2.622.246 3.932a9.23 9.23 0 00-.24 2.19C.003 6.636 0 7.146 0 7.658v8.684c0 .51.003 1.022.006 1.534.007.483.047.966.12 1.444a6.7 6.7 0 00.12.748c.317 1.31 1.062 2.31 2.18 3.043A5.022 5.022 0 004.3 23.72c.74.138 1.49.2 2.24.24.51.03 1.02.04 1.53.04h7.86c.51 0 1.02-.01 1.53-.04.75-.04 1.5-.102 2.24-.24a5.022 5.022 0 001.874-.61c1.118-.734 1.863-1.734 2.18-3.043.073-.245.12-.498.12-.748.073-.478.113-.961.12-1.444.003-.512.006-1.024.006-1.534V7.658c0-.512-.003-1.022-.006-1.534zM17.46 12.15v4.764c0 .317-.01.634-.046.95a2.244 2.244 0 01-.504 1.166 1.632 1.632 0 01-.822.542c-.37.11-.75.143-1.13.143-.38 0-.76-.033-1.13-.143a1.632 1.632 0 01-.822-.542 2.244 2.244 0 01-.504-1.166 4.16 4.16 0 01-.046-.95c0-.316.01-.634.046-.95a2.244 2.244 0 01.504-1.166 1.632 1.632 0 01.822-.542c.37-.11.75-.143 1.13-.143.32 0 .636.024.95.082V9.96l-5.578 1.745v5.96c0 .316-.01.634-.046.95a2.244 2.244 0 01-.504 1.165 1.632 1.632 0 01-.822.542c-.37.11-.75.143-1.13.143-.38 0-.76-.033-1.13-.143a1.632 1.632 0 01-.822-.542 2.244 2.244 0 01-.504-1.166 4.16 4.16 0 01-.046-.95c0-.316.01-.634.046-.95a2.244 2.244 0 01.504-1.165 1.632 1.632 0 01.822-.542c.37-.11.75-.143 1.13-.143.32 0 .636.024.95.082V8.254c0-.36.105-.676.306-.95a1.49 1.49 0 01.798-.53l5.94-1.86c.14-.044.29-.066.44-.066.47 0 .862.34.932.802.01.06.016.12.016.182v6.318z"/>
  </svg>
);

export interface ArtistEntry {
  name: string;
  spotifyLink: string;
  appleMusicLink: string;
  isNewProfile: boolean;
}

export interface TrackData {
  songTitle: string;
  isrc: string;
  audioFile: File | null;
  audioType: 'with_vocal' | 'instrumental';
  language: string;
  genre: string;
  primaryArtists: ArtistEntry[];
  lyricist: string;
  composer: string;
  producer: string;
  instagramLink: string;
  callertuneTime: string;
  copyrightLine: string;
  phonogramLine: string;
}

interface TrackFormProps {
  genres: { id: string; name: string }[];
  languages: { id: string; name: string }[];
  isTransfer: boolean;
  initialData?: TrackData;
  onSubmit: (track: TrackData) => void;
  onCancel: () => void;
}

export function TrackForm({ genres, languages, isTransfer, initialData, onSubmit, onCancel }: TrackFormProps) {
  const [form, setForm] = useState<TrackData>(
    initialData || {
      songTitle: '',
      isrc: '',
      audioFile: null,
      audioType: 'with_vocal',
      language: '',
      genre: '',
      primaryArtists: [{ name: '', spotifyLink: '', appleMusicLink: '', isNewProfile: false }],
      lyricist: '',
      composer: '',
      producer: '',
      instagramLink: '',
      callertuneTime: '',
      copyrightLine: '',
      phonogramLine: '',
    }
  );

  const update = (field: keyof TrackData, value: any) => setForm((p) => ({ ...p, [field]: value }));

  const handleCallertuneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/[^0-9]/g, '');
    if (val.length > 4) val = val.slice(0, 4);
    if (val.length > 2) {
      val = val.slice(0, 2) + ':' + val.slice(2);
    }
    update('callertuneTime', val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.songTitle.trim()) return;
    onSubmit(form);
  };

  const inputClass =
    'w-full px-4 py-3 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Song Title */}
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1">Song Title *</label>
        <input className={inputClass} value={form.songTitle} onChange={(e) => update('songTitle', e.target.value)} required placeholder="Enter song title" />
      </div>

      {/* ISRC - only for transfer */}
      {isTransfer && (
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">ISRC *</label>
          <input className={inputClass} value={form.isrc} onChange={(e) => update('isrc', e.target.value)} required placeholder="e.g. USRC17607839" />
        </div>
      )}

      {/* Audio File */}
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1">Audio File *</label>
        <div className="relative">
          <input type="file" accept=".mp3,.wav,audio/mpeg,audio/wav" onChange={(e) => update('audioFile', e.target.files?.[0] || null)} className="hidden" id="track-audio-upload" />
          <label htmlFor="track-audio-upload" className={`${inputClass} flex min-w-0 cursor-pointer items-center gap-2`}>
            <Upload className="h-4 w-4 shrink-0" />
            <span className="truncate">{form.audioFile?.name || 'Choose audio file'}</span>
          </label>
        </div>
      </div>

      {/* Audio Type */}
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1">Audio Type *</label>
        <select className={inputClass} value={form.audioType} onChange={(e) => update('audioType', e.target.value)}>
          <option value="with_vocal">With Vocal</option>
          <option value="instrumental">Instrumental</option>
        </select>
      </div>

      {/* Language - only if With Vocal */}
      {form.audioType === 'with_vocal' && (
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Language *</label>
          <select className={inputClass} value={form.language} onChange={(e) => update('language', e.target.value)} required>
            <option value="">Select language</option>
            {languages.map((l) => (
              <option key={l.id} value={l.name}>{l.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Genre */}
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1">Genre *</label>
        <select className={inputClass} value={form.genre} onChange={(e) => update('genre', e.target.value)} required>
          <option value="">Select genre</option>
          {genres.map((g) => (
            <option key={g.id} value={g.name}>{g.name}</option>
          ))}
        </select>
      </div>

      {/* Primary Artists (up to 4) */}
      <div className="space-y-4">
        <label className="block text-sm font-medium text-muted-foreground">Primary Artist(s) *</label>
        {form.primaryArtists.map((artist, idx) => {
          const updateArtist = (field: keyof ArtistEntry, value: any) => {
            const updated = [...form.primaryArtists];
            updated[idx] = { ...updated[idx], [field]: value };
            update('primaryArtists', updated);
          };
          return (
            <div key={idx} className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Artist {idx + 1}</span>
                {idx > 0 && (
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-destructive text-xs" onClick={() => {
                    update('primaryArtists', form.primaryArtists.filter((_, i) => i !== idx));
                  }}>Remove</Button>
                )}
              </div>
              <input className={inputClass} value={artist.name} onChange={(e) => updateArtist('name', e.target.value)} required={idx === 0} placeholder="Artist name" />

              {!artist.isNewProfile && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <SpotifyIcon />
                    <input className={inputClass} value={artist.spotifyLink} onChange={(e) => updateArtist('spotifyLink', e.target.value)} placeholder="Spotify Artist Profile URL" />
                  </div>
                  <div className="flex items-center gap-2">
                    <AppleMusicIcon />
                    <input className={inputClass} value={artist.appleMusicLink} onChange={(e) => updateArtist('appleMusicLink', e.target.value)} placeholder="Apple Music Artist Profile URL" />
                  </div>
                </div>
              )}

              <Button
                type="button"
                variant={artist.isNewProfile ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  const updated = [...form.primaryArtists];
                  const newIsNew = !artist.isNewProfile;
                  updated[idx] = {
                    ...updated[idx],
                    isNewProfile: newIsNew,
                    ...(newIsNew ? { spotifyLink: '', appleMusicLink: '' } : {}),
                  };
                  update('primaryArtists', updated);
                }}
              >
                {artist.isNewProfile ? '✓ Creating new profile for this artist' : 'Create new profile for this artist'}
              </Button>
            </div>
          );
        })}

        {form.primaryArtists.length < 4 && (
          <Button type="button" variant="outline" size="sm" className="w-full gap-1" onClick={() => {
            update('primaryArtists', [...form.primaryArtists, { name: '', spotifyLink: '', appleMusicLink: '', isNewProfile: false }]);
          }}>
            <Plus className="h-3.5 w-3.5" /> Add Another Primary Artist
          </Button>
        )}
      </div>

      {/* Lyricist, Composer, Producer */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Lyricist</label>
          <input className={inputClass} value={form.lyricist} onChange={(e) => update('lyricist', e.target.value)} placeholder="Lyricist name" />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Composer</label>
          <input className={inputClass} value={form.composer} onChange={(e) => update('composer', e.target.value)} placeholder="Composer name" />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Producer</label>
          <input className={inputClass} value={form.producer} onChange={(e) => update('producer', e.target.value)} placeholder="Producer name" />
        </div>
      </div>

      {/* Instagram Link */}
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1">Instagram Profile Link</label>
        <input className={inputClass} value={form.instagramLink} onChange={(e) => update('instagramLink', e.target.value)} placeholder="https://instagram.com/yourprofile" />
      </div>

      {/* Callertune Time */}
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1">Callertune Time (MM:SS)</label>
        <input className={inputClass} value={form.callertuneTime} onChange={handleCallertuneChange} placeholder="00:00" maxLength={5} />
      </div>

      {/* © Line & ℗ Line */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">© Line</label>
          <input className={inputClass} value={form.copyrightLine} onChange={(e) => update('copyrightLine', e.target.value)} placeholder="e.g. 2024 Artist Name" />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">℗ Line</label>
          <input className={inputClass} value={form.phonogramLine} onChange={(e) => update('phonogramLine', e.target.value)} placeholder="e.g. 2024 Label Name" />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" className="flex-1 btn-primary-gradient font-semibold text-primary-foreground">
          <Music2 className="h-4 w-4" />
          {initialData ? 'Update Track' : 'Add Track'}
        </Button>
      </div>
    </form>
  );
}
