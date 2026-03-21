import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonate } from '@/hooks/useImpersonate';
import { Loader2, Eye, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { SongDetailModal } from '@/components/SongDetailModal';
import { EditSongModal } from '@/components/EditSongModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { StatusBadge } from '@/components/StatusBadge';

type Song = {
  id: string; title: string; artist: string; genre: string; language: string;
  release_date: string; isrc: string | null; audio_url: string | null;
  cover_url: string | null; status: string; created_at: string; user_id: string;
};

export default function MySongs() {
  const { user } = useAuth();
  const { isImpersonating, impersonatedUserId } = useImpersonate();
  const effectiveUserId = isImpersonating ? impersonatedUserId : user?.id;
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewSong, setViewSong] = useState<Song | null>(null);
  const [editSong, setEditSong] = useState<Song | null>(null);
  const [deleteSong, setDeleteSong] = useState<Song | null>(null);

  const fetchSongs = async () => {
    if (!effectiveUserId) return;
    const { data } = await supabase
      .from('songs')
      .select('*')
      .eq('user_id', effectiveUserId)
      .order('created_at', { ascending: false });
    setSongs((data as Song[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchSongs(); }, [effectiveUserId]);

  const handleDelete = async () => {
    if (!deleteSong) return;
    const { error } = await supabase.from('songs').delete().eq('id', deleteSong.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Song deleted');
    setDeleteSong(null);
    fetchSongs();
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">My Songs</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">View and manage your submissions.</p>
      </div>

      <GlassCard className="animate-fade-in overflow-hidden">
        {songs.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No songs submitted yet.</p>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="border-b border-border/50 text-muted-foreground">
                <th className="text-left py-3 px-4 font-medium">Title</th>
                <th className="text-left py-3 px-4 font-medium hidden sm:table-cell">Artist</th>
                <th className="text-left py-3 px-4 font-medium">Status</th>
                <th className="text-left py-3 px-4 font-medium hidden md:table-cell">Date</th>
                <th className="text-right py-3 px-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {songs.map((song) => (
                <tr key={song.id} className="border-b border-border/30 table-row-hover">
                  <td className="py-3 px-4 text-foreground font-medium">{song.title}</td>
                  <td className="py-3 px-4 text-muted-foreground hidden sm:table-cell">{song.artist}</td>
                  <td className="py-3 px-4"><StatusBadge status={song.status} /></td>
                  <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">
                    {new Date(song.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => setViewSong(song)} className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-all">
                        <Eye className="h-4 w-4" />
                      </button>
                      {song.status === 'pending' && (
                        <button onClick={() => setEditSong(song)} className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-all">
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      <button onClick={() => setDeleteSong(song)} className="p-2 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </GlassCard>

      {viewSong && <SongDetailModal song={viewSong} onClose={() => setViewSong(null)} />}
      {editSong && <EditSongModal song={editSong} onClose={() => setEditSong(null)} onSaved={() => { setEditSong(null); fetchSongs(); }} />}
      {deleteSong && (
        <ConfirmDialog
          title="Delete Song"
          message={`Are you sure you want to delete "${deleteSong.title}"?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteSong(null)}
        />
      )}
    </DashboardLayout>
  );
}
