import { X } from 'lucide-react';
import { StatusBadge } from './StatusBadge';

interface Song {
  id: string; title: string; artist: string; genre: string; language: string;
  release_date: string; isrc: string | null; audio_url: string | null;
  cover_url: string | null; status: string; created_at: string;
}

export function SongDetailModal({ song, onClose, email }: { song: Song; onClose: () => void; email?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      <div
        className="glass-strong rounded-2xl p-6 max-w-lg w-full relative animate-scale-in max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-5 w-5" />
        </button>

        <h2 className="font-display text-xl font-bold text-foreground mb-4">Song Details</h2>

        {song.cover_url && (
          <img src={song.cover_url} alt={song.title} className="w-full h-48 object-cover rounded-xl mb-4" />
        )}

        <div className="space-y-3 text-sm">
          <Row label="Title" value={song.title} />
          <Row label="Artist" value={song.artist} />
          <Row label="Genre" value={song.genre} />
          <Row label="Language" value={song.language} />
          <Row label="Release Date" value={song.release_date} />
          {song.isrc && <Row label="ISRC" value={song.isrc} />}
          {email && <Row label="User Email" value={email} />}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <StatusBadge status={song.status} />
          </div>
          <Row label="Submitted" value={new Date(song.created_at).toLocaleDateString()} />
          {song.audio_url && (
            <div>
              <span className="text-muted-foreground block mb-2">Audio</span>
              <audio controls className="w-full" src={song.audio_url} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  );
}
