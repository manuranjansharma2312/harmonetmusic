import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { StatusBadge } from '@/components/StatusBadge';
import { Loader2, Music, ChevronDown, ChevronRight, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

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
  created_at: string;
  tracks: Track[];
};

export default function MyReleases() {
  const { user } = useAuth();
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewRelease, setViewRelease] = useState<Release | null>(null);
  const [deleteRelease, setDeleteRelease] = useState<Release | null>(null);

  const fetchReleases = async () => {
    if (!user) return;
    const { data: releasesData } = await supabase
      .from('releases')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!releasesData) { setLoading(false); return; }

    const releaseIds = releasesData.map((r) => r.id);
    const { data: tracksData } = releaseIds.length > 0
      ? await supabase.from('tracks').select('*').in('release_id', releaseIds).order('track_order')
      : { data: [] };

    const tracksByRelease: Record<string, Track[]> = {};
    tracksData?.forEach((t) => {
      if (!tracksByRelease[t.release_id]) tracksByRelease[t.release_id] = [];
      tracksByRelease[t.release_id].push(t);
    });

    setReleases(releasesData.map((r) => ({ ...r, tracks: tracksByRelease[r.id] || [] })));
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
          {releases.map((release) => {
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

                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewRelease(release)}>
                      <Eye className="h-4 w-4" />
                    </Button>
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
                        <Detail label="Audio Type" value={track.audio_type === 'with_vocal' ? 'With Vocal' : 'Instrumental'} />
                        <Detail label="Lyricist" value={track.lyricist || '—'} />
                        <Detail label="Composer" value={track.composer || '—'} />
                        <Detail label="Producer" value={track.producer || '—'} />
                        <Detail label="Callertune" value={track.callertune_time || '—'} />
                      </div>
                      {track.audio_url && <audio controls src={track.audio_url} className="w-full h-8 mt-1" />}
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
      <p className="text-foreground capitalize break-all">{value}</p>
    </div>
  );
}
