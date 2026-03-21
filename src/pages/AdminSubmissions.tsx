import { useEffect, useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Eye, Pencil, Trash2, CheckCircle, XCircle, Download, Search } from 'lucide-react';
import { toast } from 'sonner';
import { SongDetailModal } from '@/components/SongDetailModal';
import { EditSongModal } from '@/components/EditSongModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { StatusBadge } from '@/components/StatusBadge';

type SongWithEmail = {
  id: string; title: string; artist: string; genre: string; language: string;
  release_date: string; isrc: string | null; audio_url: string | null;
  cover_url: string | null; status: string; created_at: string; user_id: string;
  user_email?: string;
};

export default function AdminSubmissions() {
  const [songs, setSongs] = useState<SongWithEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewSong, setViewSong] = useState<SongWithEmail | null>(null);
  const [editSong, setEditSong] = useState<SongWithEmail | null>(null);
  const [deleteSong, setDeleteSong] = useState<SongWithEmail | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const fetchSongs = async () => {
    const { data } = await supabase.from('songs').select('*').order('created_at', { ascending: false });
    if (data) {
      // fetch user emails
      const userIds = [...new Set(data.map((s) => s.user_id))];
      const emailMap: Record<string, string> = {};

      // We'll use a simple approach - fetch from user_roles + auth
      // Since we can't query auth.users directly from client, we'll show user_id
      // Admin can see the user_id for now
      setSongs(data.map((s) => ({ ...s, user_email: s.user_id.slice(0, 8) + '...' })) as SongWithEmail[]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchSongs(); }, []);

  const filtered = useMemo(() => {
    return songs.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q);
      }
      return true;
    });
  }, [songs, search, statusFilter]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((s) => s.id)));
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    const { error } = await supabase.from('songs').update({ status }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Song ${status}`);
    fetchSongs();
  };

  const handleDelete = async () => {
    if (!deleteSong) return;
    const { error } = await supabase.from('songs').delete().eq('id', deleteSong.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Song deleted');
    setDeleteSong(null);
    fetchSongs();
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    const ids = Array.from(selected);
    const { error } = await supabase.from('songs').delete().in('id', ids);
    setBulkDeleting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${ids.length} songs deleted`);
    setSelected(new Set());
    fetchSongs();
  };

  const exportCSV = () => {
    const data = selected.size > 0
      ? filtered.filter((s) => selected.has(s.id))
      : filtered;

    const headers = ['title', 'artist', 'genre', 'language', 'release_date', 'isrc', 'status', 'user_email'];
    const rows = data.map((s) => headers.map((h) => `"${(s as any)[h] || ''}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `submissions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  const inputClass = "px-4 py-2.5 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm";

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
      <div className="mb-6 sm:mb-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">All Submissions</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">Manage all music submissions.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
          {selected.size > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="px-4 py-2 rounded-lg bg-destructive/20 text-destructive text-sm font-medium hover:bg-destructive/30 transition-all flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              {bulkDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete ({selected.size})
            </button>
          )}
          <button
            onClick={exportCSV}
            className="px-4 py-2 rounded-lg btn-primary-gradient text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className={`${inputClass} w-full pl-10`}
            placeholder="Search by title or artist..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className={`${inputClass} w-full sm:w-[180px]`}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <GlassCard className="animate-fade-in overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No submissions found.</p>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6 pb-1">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-border/50 text-muted-foreground">
                <th className="py-3 px-4 text-left">
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={toggleAll}
                    className="accent-primary"
                  />
                </th>
                <th className="text-left py-3 px-4 font-medium">Title</th>
                <th className="text-left py-3 px-4 font-medium hidden sm:table-cell">Artist</th>
                <th className="text-left py-3 px-4 font-medium hidden md:table-cell">User</th>
                <th className="text-left py-3 px-4 font-medium">Status</th>
                <th className="text-left py-3 px-4 font-medium hidden lg:table-cell">Date</th>
                <th className="text-right py-3 px-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((song) => (
                <tr key={song.id} className="border-b border-border/30 table-row-hover">
                  <td className="py-3 px-4">
                    <input
                      type="checkbox"
                      checked={selected.has(song.id)}
                      onChange={() => toggleSelect(song.id)}
                      className="accent-primary"
                    />
                  </td>
                  <td className="py-3 px-4 text-foreground font-medium min-w-[11rem]">{song.title}</td>
                  <td className="py-3 px-4 text-muted-foreground hidden sm:table-cell">{song.artist}</td>
                  <td className="py-3 px-4 text-muted-foreground hidden md:table-cell text-xs">{song.user_email}</td>
                  <td className="py-3 px-4"><StatusBadge status={song.status} /></td>
                  <td className="py-3 px-4 text-muted-foreground hidden lg:table-cell">
                    {new Date(song.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-0.5 sm:gap-1 whitespace-nowrap">
                      <button onClick={() => setViewSong(song)} className="p-1.5 sm:p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-all">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button onClick={() => setEditSong(song)} className="p-1.5 sm:p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-all">
                        <Pencil className="h-4 w-4" />
                      </button>
                      {song.status !== 'approved' && (
                        <button onClick={() => handleStatusChange(song.id, 'approved')} className="p-1.5 sm:p-2 rounded-lg hover:bg-green-500/20 text-muted-foreground hover:text-green-400 transition-all">
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      )}
                      {song.status !== 'rejected' && (
                        <button onClick={() => handleStatusChange(song.id, 'rejected')} className="p-1.5 sm:p-2 rounded-lg hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-all">
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}
                      <button onClick={() => setDeleteSong(song)} className="p-1.5 sm:p-2 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </GlassCard>

      {viewSong && <SongDetailModal song={viewSong} email={viewSong.user_email} onClose={() => setViewSong(null)} />}
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
