import { useEffect, useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonate } from '@/hooks/useImpersonate';
import { StatusBadge } from '@/components/StatusBadge';
import { Loader2, Music, ChevronDown, ChevronRight, Trash2, Eye, Pencil, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { TablePagination, paginateItems } from '@/components/TablePagination';

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
  lyricist: string | null;
  composer: string | null;
  producer: string | null;
  instagram_link: string | null;
  callertune_time: string | null;
  track_order: number;
  is_new_artist_profile: boolean | null;
};

type Release = {
  id: string;
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
  rejection_reason: string | null;
  created_at: string;
  tracks: Track[];
  user_id: string;
  submitted_by_label?: string;
};



export default function MyReleases() {
  const navigate = useNavigate();
  const { user, userType, isSubLabel } = useAuth();
  const { isImpersonating, impersonatedUserId } = useImpersonate();
  const effectiveUserId = isImpersonating ? impersonatedUserId : user?.id;
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewRelease, setViewRelease] = useState<Release | null>(null);
  const [deleteRelease, setDeleteRelease] = useState<Release | null>(null);
  const [releasePage, setReleasePage] = useState(0);
  const [releasePageSize, setReleasePageSize] = useState<number | 'all'>(10);

  const fetchReleases = async () => {
    if (!effectiveUserId) return;

    // Get own releases
    const { data: releasesData } = await supabase
      .from('releases')
      .select('*')
      .eq('user_id', effectiveUserId)
      .order('created_at', { ascending: false });

    let allReleases = (releasesData || []) as any[];

    // For record label users (not sub-labels), also fetch sub-label releases
    let subLabelMap: Record<string, string> = {};
    if (userType === 'record_label' && !isSubLabel) {
      const { data: subLabelsData } = await supabase
        .from('sub_labels')
        .select('sub_user_id, sub_label_name')
        .eq('parent_user_id', effectiveUserId)
        .eq('status', 'active');

      if (subLabelsData && subLabelsData.length > 0) {
        const subUserIds = subLabelsData
          .filter(sl => sl.sub_user_id)
          .map(sl => sl.sub_user_id!);

        subLabelsData.forEach(sl => {
          if (sl.sub_user_id) subLabelMap[sl.sub_user_id] = sl.sub_label_name;
        });

        if (subUserIds.length > 0) {
          const { data: subReleases } = await supabase
            .from('releases')
            .select('*')
            .in('user_id', subUserIds)
            .order('created_at', { ascending: false });

          if (subReleases) {
            allReleases = [...allReleases, ...subReleases];
            // Sort by created_at descending
            allReleases.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          }
        }
      }
    }

    const releaseIds = allReleases.map((r: any) => r.id);
    const { data: tracksData } = releaseIds.length > 0
      ? await supabase.from('tracks').select('*').in('release_id', releaseIds).order('track_order')
      : { data: [] };

    const tracksByRelease: Record<string, Track[]> = {};
    tracksData?.forEach((t: any) => {
      if (!tracksByRelease[t.release_id]) tracksByRelease[t.release_id] = [];
      tracksByRelease[t.release_id].push(t);
    });

    setReleases(allReleases.map((r: any) => ({
      ...r,
      tracks: tracksByRelease[r.id] || [],
      submitted_by_label: subLabelMap[r.user_id] || undefined,
    })));
    setLoading(false);
  };

  useEffect(() => { fetchReleases(); }, [user]);

  const getReleaseName = (r: Release) => {
    if (r.content_type === 'album') return r.album_name || 'Untitled Album';
    if (r.content_type === 'ep') return r.ep_name || 'Untitled EP';
    return r.tracks[0]?.song_title || 'Untitled Single';
  };

  const handleDelete = async () => {
    if (!deleteRelease) return;
    if (deleteRelease.status !== 'pending') {
      toast.error('Only pending releases can be deleted.');
      setDeleteRelease(null);
      return;
    }
    const { error } = await supabase.from('releases').delete().eq('id', deleteRelease.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Release deleted');
    setDeleteRelease(null);
    fetchReleases();
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
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">My Releases</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">View and track all your music submissions.</p>
      </div>

      {releases.length === 0 ? (
        <GlassCard className="animate-fade-in text-center py-12">
          <Music className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No releases yet. Submit your first release!</p>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {(() => {
            const pagedReleases = paginateItems(releases, releasePage, releasePageSize);
            return (
              <>
          {pagedReleases.map((release) => {
            const isExpanded = expandedId === release.id;
            return (
              <GlassCard key={release.id} className="animate-fade-in">
                {/* Release header */}
                <div className="flex items-center gap-4">
                  <button onClick={() => setExpandedId(isExpanded ? null : release.id)} className="text-muted-foreground hover:text-foreground">
                    {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                  </button>

                  {release.poster_url ? (
                    <img src={release.poster_url} alt="" className="h-14 w-14 rounded-lg object-cover border border-border" />
                  ) : (
                    <div className="h-14 w-14 rounded-lg bg-muted/50 flex items-center justify-center border border-border">
                      <Music className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{getReleaseName(release)}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 rounded bg-muted/50 text-muted-foreground capitalize">{release.content_type}</span>
                      {release.release_type === 'transfer' && (
                        <span className="text-xs px-2 py-0.5 rounded bg-accent/50 text-accent-foreground">Transfer</span>
                      )}
                      {release.submitted_by_label && (
                        <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary flex items-center gap-1">
                          <Users className="h-3 w-3" /> {release.submitted_by_label}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">{release.tracks.length} track(s)</span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">{new Date(release.release_date).toLocaleDateString()}</span>
                      {release.upc && (
                        <>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-xs text-muted-foreground">UPC: <span className="font-mono text-foreground">{release.upc}</span></span>
                        </>
                      )}
                    </div>
                  </div>

                  <StatusBadge status={release.status} />
                  {release.status === 'rejected' && release.rejection_reason && (
                    <p className="text-xs text-destructive max-w-[200px] truncate" title={release.rejection_reason}>
                      {release.rejection_reason}
                    </p>
                  )}

                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewRelease(release)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {release.status === 'pending' && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/submit?edit=${release.id}`)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {release.status === 'pending' && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteRelease(release)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Expanded tracks */}
                {isExpanded && (
                  <div className="mt-4 border-t border-border/50 pt-4 space-y-2">
                    {release.upc && (
                      <p className="text-xs text-muted-foreground mb-2">UPC: <span className="text-foreground font-mono">{release.upc}</span></p>
                    )}
                    {release.tracks.map((track) => (
                      <div key={track.id} className="flex items-center gap-3 rounded-lg bg-muted/20 px-4 py-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                          {track.track_order}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{track.song_title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {track.primary_artist} • {track.genre}
                            {track.isrc && <> • ISRC: <span className="font-mono">{track.isrc}</span></>}
                          </p>
                        </div>
                        {track.audio_url && (
                          <audio controls src={track.audio_url} className="h-8 w-48 shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            );
          })}
          <div className="rounded-lg bg-card/50 border border-border/50 overflow-hidden">
            <TablePagination
              totalItems={releases.length}
              currentPage={releasePage}
              pageSize={releasePageSize}
              onPageChange={setReleasePage}
              onPageSizeChange={setReleasePageSize}
              itemLabel="releases"
            />
          </div>
              </>
            );
          })()}
        </div>
      )}

      {/* View Detail Modal */}
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
                <Detail label="Store" value={viewRelease.store_selection === 'worldwide' ? 'Worldwide - All Platforms' : 'Instagram & Facebook Only'} />
                <Detail label="© Line" value={viewRelease.copyright_line || '—'} />
                <Detail label="℗ Line" value={viewRelease.phonogram_line || '—'} />
                <Detail label="Submitted" value={new Date(viewRelease.created_at).toLocaleString()} />
              </div>

              {viewRelease.poster_url && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Poster</p>
                  <img src={viewRelease.poster_url} alt="Poster" className="h-32 w-32 rounded-lg object-cover border border-border" />
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Tracks ({viewRelease.tracks.length})</p>
                <div className="space-y-3">
                  {viewRelease.tracks.map((track) => (
                    <div key={track.id} className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">{track.track_order}</span>
                        <span className="font-medium text-foreground">Track {track.track_order}</span>
                      </div>

                      <Detail label="Song Title" value={track.song_title || '—'} />

                      <Detail label="ISRC" value={track.isrc || '—'} />

                      <div>
                        <p className="text-muted-foreground text-xs">Audio File</p>
                        {track.audio_url ? (
                          <audio controls src={track.audio_url} className="w-full h-8 mt-1" />
                        ) : (
                          <p className="text-foreground break-words">—</p>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Detail label="Audio Type" value={track.audio_type === 'with_vocal' ? 'With Vocal' : 'Instrumental'} />
                        <Detail label="Language" value={track.language || '—'} />
                      </div>

                      <Detail label="Genre" value={track.genre || '—'} />

                      <div className="rounded-lg border border-border/30 bg-muted/10 p-3 space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Primary Artist(s)</p>
                        <div className="space-y-2">
                          {(track.primary_artist?.split(',').map((artist) => artist.trim()).filter(Boolean) || ['—']).map((artist, index) => (
                            <div key={`${track.id}-artist-${index}`} className="rounded-md border border-border/20 bg-background/30 p-3 space-y-2">
                              <p className="text-sm font-medium text-foreground">{artist}</p>
                              {index === 0 && (
                                <>
                                  <div className="flex items-center gap-2 text-xs">
                                    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="#1DB954"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                                    <span className="text-muted-foreground">Spotify Artist Profile URL</span>
                                  </div>
                                  <p className="text-foreground break-all text-xs">{track.spotify_link || '—'}</p>
                                  <div className="flex items-center gap-2 text-xs">
                                    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="#FA243C"><path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043A5.022 5.022 0 0019.7.28C18.96.142 18.21.08 17.46.04 16.95.01 16.44 0 15.93 0H8.07C7.56 0 7.05.01 6.54.04 5.79.08 5.04.142 4.3.28a5.022 5.022 0 00-1.874.61C1.308 1.622.563 2.622.246 3.932a9.23 9.23 0 00-.24 2.19C.003 6.636 0 7.146 0 7.658v8.684c0 .51.003 1.022.006 1.534.007.483.047.966.12 1.444a6.7 6.7 0 00.12.748c.317 1.31 1.062 2.31 2.18 3.043A5.022 5.022 0 004.3 23.72c.74.138 1.49.2 2.24.24.51.03 1.02.04 1.53.04h7.86c.51 0 1.02-.01 1.53-.04.75-.04 1.5-.102 2.24-.24a5.022 5.022 0 001.874-.61c1.118-.734 1.863-1.734 2.18-3.043.073-.245.12-.498.12-.748.073-.478.113-.961.12-1.444.003-.512.006-1.024.006-1.534V7.658c0-.512-.003-1.022-.006-1.534zM17.46 12.15v4.764c0 .317-.01.634-.046.95a2.244 2.244 0 01-.504 1.166 1.632 1.632 0 01-.822.542c-.37.11-.75.143-1.13.143-.38 0-.76-.033-1.13-.143a1.632 1.632 0 01-.822-.542 2.244 2.244 0 01-.504-1.166 4.16 4.16 0 01-.046-.95c0-.316.01-.634.046-.95a2.244 2.244 0 01.504-1.166 1.632 1.632 0 01.822-.542c.37-.11.75-.143 1.13-.143.32 0 .636.024.95.082V9.96l-5.578 1.745v5.96c0 .316-.01.634-.046.95a2.244 2.244 0 01-.504 1.165 1.632 1.632 0 01-.822.542c-.37.11-.75.143-1.13.143-.38 0-.76-.033-1.13-.143a1.632 1.632 0 01-.822-.542 2.244 2.244 0 01-.504-1.166 4.16 4.16 0 01-.046-.95c0-.316.01-.634.046-.95a2.244 2.244 0 01.504-1.165 1.632 1.632 0 01.822-.542c.37-.11.75-.143 1.13-.143.32 0 .636.024.95.082V8.254c0-.36.105-.676.306-.95a1.49 1.49 0 01.798-.53l5.94-1.86c.14-.044.29-.066.44-.066.47 0 .862.34.932.802.01.06.016.12.016.182v6.318z"/></svg>
                                    <span className="text-muted-foreground">Apple Music Artist Profile URL</span>
                                  </div>
                                  <p className="text-foreground break-all text-xs">{track.apple_music_link || '—'}</p>
                                  <Detail label="Create New Profile" value={track.is_new_artist_profile ? 'Yes' : 'No'} />
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <Detail label="Lyricist" value={track.lyricist || '—'} />
                        <Detail label="Composer" value={track.composer || '—'} />
                        <Detail label="Producer" value={track.producer || '—'} />
                      </div>

                      <Detail label="Instagram Profile Link" value={track.instagram_link || '—'} />
                      <Detail label="Callertune Time (MM:SS)" value={track.callertune_time || '—'} />
                    </div>
                  ))}
                </div>
              </div>
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
      <p className="text-foreground break-all">{value}</p>
    </div>
  );
}
