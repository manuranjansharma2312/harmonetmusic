import { useEffect, useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Eye, Pencil, Trash2, Download, Search, ChevronDown, ChevronRight, Music, Save } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

const STATUSES = ['pending', 'processing', 'approved', 'rejected', 'takedown'];

type Track = {
  id: string;
  song_title: string;
  isrc: string | null;
  audio_url: string | null;
  audio_type: string;
  language: string | null;
  genre: string | null;
  primary_artist: string | null;
  spotify_link: string | null;
  apple_music_link: string | null;
  is_new_artist_profile: boolean;
  lyricist: string | null;
  composer: string | null;
  producer: string | null;
  instagram_link: string | null;
  callertune_time: string | null;
  copyright_line: string | null;
  phonogram_line: string | null;
  track_order: number;
};

type Release = {
  id: string;
  user_id: string;
  release_type: string;
  content_type: string;
  album_name: string | null;
  ep_name: string | null;
  upc: string | null;
  poster_url: string | null;
  release_date: string;
  copyright_line: string | null;
  phonogram_line: string | null;
  store_selection: string;
  status: string;
  created_at: string;
  updated_at: string;
  tracks?: Track[];
  user_email?: string;
  user_name?: string;
  user_display_id?: number;
};

export default function AdminSubmissions() {
  const navigate = useNavigate();
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteRelease, setDeleteRelease] = useState<Release | null>(null);
  const [viewRelease, setViewRelease] = useState<Release | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // ISRC/UPC inline editing
  const [editingIsrc, setEditingIsrc] = useState<Record<string, string>>({});
  const [editingUpc, setEditingUpc] = useState<Record<string, string>>({});

  const fetchReleases = async () => {
    const { data: releasesData } = await supabase
      .from('releases')
      .select('*')
      .order('created_at', { ascending: false });

    if (!releasesData) { setLoading(false); return; }

    // Fetch tracks for all releases
    const releaseIds = releasesData.map((r) => r.id);
    const { data: tracksData } = await supabase
      .from('tracks')
      .select('*')
      .in('release_id', releaseIds)
      .order('track_order');

    // Fetch user info from profiles
    const userIds = [...new Set(releasesData.map((r) => r.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, email, artist_name, record_label_name, legal_name, display_id, user_type')
      .in('user_id', userIds);

    const emailMap: Record<string, string> = {};
    const nameMap: Record<string, string> = {};
    const displayIdMap: Record<string, number> = {};
    profiles?.forEach((p) => {
      emailMap[p.user_id] = p.email;
      nameMap[p.user_id] = p.user_type === 'label'
        ? (p.record_label_name || p.legal_name || p.email)
        : (p.artist_name || p.legal_name || p.email);
      displayIdMap[p.user_id] = p.display_id;
    });

    // Fallback: fetch auth emails for users without profiles
    const missingUserIds = userIds.filter((uid) => !emailMap[uid]);
    if (missingUserIds.length > 0) {
      const { data: authEmails } = await supabase.rpc('get_auth_emails', { _user_ids: missingUserIds });
      authEmails?.forEach((ae: { user_id: string; email: string }) => {
        emailMap[ae.user_id] = ae.email;
        nameMap[ae.user_id] = ae.email;
      });
    }

    const tracksByRelease: Record<string, Track[]> = {};
    tracksData?.forEach((t) => {
      if (!tracksByRelease[t.release_id]) tracksByRelease[t.release_id] = [];
      tracksByRelease[t.release_id].push(t);
    });

    setReleases(
      releasesData.map((r) => ({
        ...r,
        tracks: tracksByRelease[r.id] || [],
        user_email: emailMap[r.user_id] || r.user_id.slice(0, 8),
        user_name: nameMap[r.user_id] || r.user_id.slice(0, 8),
        user_display_id: displayIdMap[r.user_id],
      }))
    );
    setLoading(false);
  };

  useEffect(() => { fetchReleases(); }, []);

  const filtered = useMemo(() => {
    return releases.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const name = r.album_name || r.ep_name || r.tracks?.[0]?.song_title || '';
        const artist = r.tracks?.[0]?.primary_artist || '';
        return name.toLowerCase().includes(q) || artist.toLowerCase().includes(q) || (r.user_email || '').toLowerCase().includes(q) || (r.user_name || '').toLowerCase().includes(q) || String(r.user_display_id || '').includes(q);
      }
      return true;
    });
  }, [releases, search, statusFilter]);

  const getReleaseName = (r: Release) => {
    if (r.content_type === 'album') return r.album_name || 'Untitled Album';
    if (r.content_type === 'ep') return r.ep_name || 'Untitled EP';
    return r.tracks?.[0]?.song_title || 'Untitled Single';
  };

  const handleStatusChange = async (id: string, status: string) => {
    const { error } = await supabase.from('releases').update({ status }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Status changed to ${status}`);
    fetchReleases();
  };

  const handleDelete = async () => {
    if (!deleteRelease) return;
    const { error } = await supabase.from('releases').delete().eq('id', deleteRelease.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Release deleted');
    setDeleteRelease(null);
    fetchReleases();
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    const ids = Array.from(selected);
    const { error } = await supabase.from('releases').delete().in('id', ids);
    setBulkDeleting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${ids.length} releases deleted`);
    setSelected(new Set());
    fetchReleases();
  };

  const handleSaveUpc = async (releaseId: string) => {
    const upc = editingUpc[releaseId];
    if (upc === undefined) return;
    const { error } = await supabase.from('releases').update({ upc }).eq('id', releaseId);
    if (error) { toast.error(error.message); return; }
    toast.success('UPC saved');
    setEditingUpc((p) => { const n = { ...p }; delete n[releaseId]; return n; });
    fetchReleases();
  };

  const handleSaveIsrc = async (trackId: string) => {
    const isrc = editingIsrc[trackId];
    if (isrc === undefined) return;
    const { error } = await supabase.from('tracks').update({ isrc }).eq('id', trackId);
    if (error) { toast.error(error.message); return; }
    toast.success('ISRC saved');
    setEditingIsrc((p) => { const n = { ...p }; delete n[trackId]; return n; });
    fetchReleases();
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.id)));
  };

  const exportCSV = () => {
    const data = selected.size > 0 ? filtered.filter((r) => selected.has(r.id)) : filtered;
    const headers = ['Release Name', 'Type', 'Content Type', 'UPC', 'Artist', 'Status', 'Release Date', 'User', 'Tracks', 'Store'];
    const rows = data.map((r) => [
      getReleaseName(r), r.release_type, r.content_type, r.upc || '',
      r.tracks?.[0]?.primary_artist || '', r.status, r.release_date, r.user_email || '',
      r.tracks?.length || 0, r.store_selection,
    ].map((v) => `"${v}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `releases-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  const inputClass = 'px-4 py-2.5 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm';

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
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">Manage all music releases and tracks.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
          {selected.size > 0 && (
            <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete ({selected.size})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input className={`${inputClass} w-full pl-10`} placeholder="Search by name, artist, or user..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className={`${inputClass} w-full sm:w-[180px]`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      <GlassCard className="animate-fade-in overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No submissions found.</p>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6 pb-1">
            <table className="w-full min-w-[750px] text-sm">
              <thead>
                <tr className="border-b border-border/50 text-muted-foreground">
                  <th className="py-3 px-3 text-left w-8">
                    <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} className="accent-primary" />
                  </th>
                  <th className="py-3 px-3 text-left w-8"></th>
                  <th className="text-left py-3 px-3 font-medium">Release</th>
                  <th className="text-left py-3 px-3 font-medium">Type</th>
                  <th className="text-left py-3 px-3 font-medium hidden md:table-cell">UPC</th>
                  <th className="text-left py-3 px-3 font-medium hidden md:table-cell">Submitted By</th>
                  <th className="text-left py-3 px-3 font-medium">Status</th>
                  <th className="text-left py-3 px-3 font-medium hidden lg:table-cell">Date</th>
                  <th className="text-right py-3 px-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((release) => {
                  const isExpanded = expandedId === release.id;
                  return (
                    <>
                      <tr key={release.id} className="border-b border-border/30 table-row-hover">
                        <td className="py-3 px-3">
                          <input type="checkbox" checked={selected.has(release.id)} onChange={() => toggleSelect(release.id)} className="accent-primary" />
                        </td>
                        <td className="py-3 px-3">
                          <button onClick={() => setExpandedId(isExpanded ? null : release.id)} className="text-muted-foreground hover:text-foreground">
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-3">
                            {release.poster_url ? (
                              <img src={release.poster_url} alt="" className="h-10 w-10 rounded object-cover" />
                            ) : (
                              <div className="h-10 w-10 rounded bg-muted/50 flex items-center justify-center"><Music className="h-4 w-4 text-muted-foreground" /></div>
                            )}
                            <div>
                              <p className="font-medium text-foreground">{getReleaseName(release)}</p>
                              <p className="text-xs text-muted-foreground">{release.tracks?.length || 0} track(s)</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-xs px-2 py-1 rounded bg-muted/50 text-muted-foreground capitalize">{release.content_type}</span>
                        </td>
                        <td className="py-3 px-3 hidden md:table-cell">
                          <div className="flex items-center gap-1">
                            {editingUpc[release.id] !== undefined ? (
                              <>
                                <input
                                  className="px-2 py-1 rounded bg-muted/50 border border-border text-foreground text-xs w-32"
                                  value={editingUpc[release.id]}
                                  onChange={(e) => setEditingUpc((p) => ({ ...p, [release.id]: e.target.value }))}
                                  placeholder="Enter UPC"
                                />
                                <button onClick={() => handleSaveUpc(release.id)} className="p-1 hover:bg-primary/20 rounded text-primary"><Save className="h-3.5 w-3.5" /></button>
                              </>
                            ) : (
                              <button onClick={() => setEditingUpc((p) => ({ ...p, [release.id]: release.upc || '' }))} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                                {release.upc || <span className="italic text-muted-foreground/50">Add UPC</span>}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 hidden md:table-cell">
                          <div className="text-xs">
                            <p className="text-foreground font-medium">{release.user_name || 'Unknown'}</p>
                            <p className="text-muted-foreground">{release.user_email || '—'}</p>
                            <p className="text-muted-foreground font-mono">
                              {release.user_display_id ? `#${release.user_display_id}` : 'No profile'}
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <select
                            className="bg-transparent border-none text-xs cursor-pointer focus:outline-none"
                            value={release.status}
                            onChange={(e) => handleStatusChange(release.id, e.target.value)}
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-3 text-muted-foreground hidden lg:table-cell text-xs">
                          {new Date(release.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center justify-end gap-0.5">
                            <button onClick={() => navigate(`/submit?edit=${release.id}`)} className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-all"><Pencil className="h-4 w-4" /></button>
                            <button onClick={() => setViewRelease(release)} className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-all"><Eye className="h-4 w-4" /></button>
                            <button onClick={() => setDeleteRelease(release)} className="p-1.5 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded tracks */}
                      {isExpanded && release.tracks?.map((track) => (
                        <tr key={track.id} className="bg-muted/10 border-b border-border/20">
                          <td className="py-2 px-3"></td>
                          <td className="py-2 px-3"></td>
                          <td className="py-2 px-3" colSpan={2}>
                            <div className="flex items-center gap-2">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">{track.track_order}</div>
                              <div>
                                <p className="text-sm text-foreground">{track.song_title}</p>
                                <p className="text-xs text-muted-foreground">{track.primary_artist} • {track.genre} • {track.audio_type}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-2 px-3 hidden md:table-cell">
                            <div className="flex items-center gap-1">
                              {editingIsrc[track.id] !== undefined ? (
                                <>
                                  <input
                                    className="px-2 py-1 rounded bg-muted/50 border border-border text-foreground text-xs w-32"
                                    value={editingIsrc[track.id]}
                                    onChange={(e) => setEditingIsrc((p) => ({ ...p, [track.id]: e.target.value }))}
                                    placeholder="Enter ISRC"
                                  />
                                  <button onClick={() => handleSaveIsrc(track.id)} className="p-1 hover:bg-primary/20 rounded text-primary"><Save className="h-3.5 w-3.5" /></button>
                                </>
                              ) : (
                                <button onClick={() => setEditingIsrc((p) => ({ ...p, [track.id]: track.isrc || '' }))} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                                  {track.isrc || <span className="italic text-muted-foreground/50">Add ISRC</span>}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3 hidden md:table-cell"></td>
                          <td className="py-2 px-3"></td>
                          <td className="py-2 px-3 hidden lg:table-cell"></td>
                          <td className="py-2 px-3">
                            {track.audio_url && (
                              <a href={track.audio_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">Play</a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* View Release Detail Modal */}
      {viewRelease && (
        <Dialog open={!!viewRelease} onOpenChange={() => setViewRelease(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{getReleaseName(viewRelease)}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <Detail label="Release Type" value={viewRelease.release_type === 'new_release' ? 'New Release' : 'Transfer'} />
                <Detail label="Content Type" value={viewRelease.content_type} />
                <Detail label="Status" value={viewRelease.status} />
                <Detail label="Release Date" value={viewRelease.release_date} />
                <Detail label="UPC" value={viewRelease.upc || '—'} />
                <Detail label="Store" value={viewRelease.store_selection} />
                <Detail label="© Line" value={viewRelease.copyright_line || '—'} />
                <Detail label="℗ Line" value={viewRelease.phonogram_line || '—'} />
                <Detail label="Submitted By" value={viewRelease.user_name || '—'} />
                <Detail label="Email" value={viewRelease.user_email || '—'} />
                <Detail label="User ID" value={viewRelease.user_display_id ? `#${viewRelease.user_display_id}` : viewRelease.user_id.slice(0, 8)} />
                <Detail label="Submitted" value={new Date(viewRelease.created_at).toLocaleString()} />
              </div>

              {viewRelease.poster_url && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Poster</p>
                  <img src={viewRelease.poster_url} alt="Poster" className="h-32 w-32 rounded-lg object-cover border border-border" />
                </div>
              )}

              {viewRelease.tracks && viewRelease.tracks.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Tracks ({viewRelease.tracks.length})</p>
                  <div className="space-y-3">
                    {viewRelease.tracks.map((track) => (
                      <div key={track.id} className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">{track.track_order}</span>
                          <span className="font-medium text-foreground">{track.song_title}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <Detail label="Artist" value={track.primary_artist || '—'} />
                          <Detail label="ISRC" value={track.isrc || '—'} />
                          <Detail label="Genre" value={track.genre || '—'} />
                          <Detail label="Language" value={track.language || '—'} />
                          <Detail label="Audio Type" value={track.audio_type} />
                          <Detail label="Lyricist" value={track.lyricist || '—'} />
                          <Detail label="Composer" value={track.composer || '—'} />
                          <Detail label="Producer" value={track.producer || '—'} />
                          <Detail label="Callertune" value={track.callertune_time || '—'} />
                          <Detail label="Instagram" value={track.instagram_link || '—'} />
                          {track.spotify_link && <Detail label="Spotify" value={track.spotify_link} />}
                          {track.apple_music_link && <Detail label="Apple Music" value={track.apple_music_link} />}
                          {track.is_new_artist_profile && <Detail label="New Profile" value="Yes" />}
                        </div>
                        {track.audio_url && (
                          <audio controls src={track.audio_url} className="w-full h-8 mt-1" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewRelease(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {deleteRelease && (
        <ConfirmDialog
          title="Delete Release"
          message={`Are you sure you want to delete "${getReleaseName(deleteRelease)}"? This will also delete all tracks.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteRelease(null)}
        />
      )}
    </DashboardLayout>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-foreground capitalize break-all">{value}</p>
    </div>
  );
}
