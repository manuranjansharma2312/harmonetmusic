import { useEffect, useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Eye, Pencil, Trash2, Download, Search, ChevronDown, ChevronRight, Music, Save, Users, Image, Volume2, ImageOff, VolumeX, Upload } from 'lucide-react';
import { TablePagination, paginateItems } from '@/components/TablePagination';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { RejectReasonModal } from '@/components/RejectReasonModal';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/CopyButton';
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
  track_order: number;
  status: string;
  rejection_reason: string | null;
  singer: string | null;
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
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  tracks?: Track[];
  user_email?: string;
  user_name?: string;
  user_display_id?: number;
  user_type?: string;
  sub_label_name?: string;
  parent_label_name?: string;
};

type ParsedImportTrack = {
  song_title: string;
  isrc: string;
  primary_artist: string;
  singer: string;
  audio_type: string;
  language: string;
  genre: string;
  lyricist: string;
  composer: string;
  producer: string;
  spotify_link: string;
  apple_music_link: string;
  instagram_link: string;
  callertune_time: string;
  is_new_artist_profile: boolean;
  track_order: number;
};

type ParsedImportRelease = {
  user_id: string;
  user_identifier: string;
  release_type: string;
  content_type: string;
  album_name: string;
  ep_name: string;
  upc: string;
  release_date: string;
  copyright_line: string;
  phonogram_line: string;
  store_selection: string;
  status: string;
  tracks: ParsedImportTrack[];
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
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectTrackTarget, setRejectTrackTarget] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);

  // ISRC/UPC inline editing
  const [editingIsrc, setEditingIsrc] = useState<Record<string, string>>({});
  const [editingUpc, setEditingUpc] = useState<Record<string, string>>({});

  // CSV Import
  const [showImportModal, setShowImportModal] = useState(false);
  const [importParsedData, setImportParsedData] = useState<ParsedImportRelease[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importParsing, setImportParsing] = useState(false);

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { current += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ',') { result.push(current.trim()); current = ''; }
        else { current += ch; }
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleImportCSV = async (file: File) => {
    setImportParsing(true);
    setImportErrors([]);
    setImportParsedData([]);

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      setImportErrors(['CSV file is empty or has no data rows.']);
      setImportParsing(false);
      return;
    }

    const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim());

    // Find column indices
    const col = (names: string[]) => headers.findIndex((h) => names.some((n) => h.includes(n)));
    const iUserID = col(['user id', 'display id', 'userid']);
    const iUserEmail = col(['user email', 'email']);
    const iReleaseType = col(['release type']);
    const iContentType = col(['content type']);
    const iReleaseName = col(['release name', 'album name']);
    const iUpc = col(['upc']);
    const iReleaseDate = col(['release date']);
    const iCopyright = col(['copyright']);
    const iPhonogram = col(['phonogram']);
    const iStore = col(['store selection', 'store']);
    const iStatus = col(['status']);
    const iTrackNo = col(['track']);
    const iSongTitle = col(['song title']);
    const iIsrc = col(['isrc']);
    const iPrimaryArtist = col(['primary artist', 'artist']);
    const iNewArtist = col(['new artist']);
    const iAudioType = col(['audio type']);
    const iLanguage = col(['language']);
    const iGenre = col(['genre']);
    const iLyricist = col(['lyricist']);
    const iComposer = col(['composer']);
    const iProducer = col(['producer']);
    const iSpotify = col(['spotify']);
    const iApple = col(['apple']);
    const iInstagram = col(['instagram']);
    const iCallertune = col(['callertune']);
    const iSinger = col(['singer']);

    // We need at least user identifier and song title
    if (iUserID === -1 && iUserEmail === -1) {
      setImportErrors(['CSV must have a "User ID" or "User Email" column.']);
      setImportParsing(false);
      return;
    }
    if (iSongTitle === -1) {
      setImportErrors(['CSV must have a "Song Title" column.']);
      setImportParsing(false);
      return;
    }

    // Parse rows
    const dataRows = lines.slice(1).map((l) => parseCSVLine(l));
    const g = (row: string[], idx: number) => (idx >= 0 ? row[idx] || '' : '');

    // Collect unique user identifiers and resolve to user_ids
    const identifiers = new Set<string>();
    dataRows.forEach((row) => {
      const uid = g(row, iUserID).replace('#', '').trim();
      const email = g(row, iUserEmail).trim();
      if (uid) identifiers.add(`id:${uid}`);
      else if (email) identifiers.add(`email:${email}`);
    });

    // Fetch all profiles to map display_id and email to user_id
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('user_id, display_id, email');

    const displayIdToUserId: Record<string, string> = {};
    const emailToUserId: Record<string, string> = {};
    allProfiles?.forEach((p) => {
      displayIdToUserId[String(p.display_id)] = p.user_id;
      emailToUserId[p.email.toLowerCase()] = p.user_id;
    });

    // Group rows into releases
    const errors: string[] = [];
    const releasesMap = new Map<string, ParsedImportRelease>();

    dataRows.forEach((row, rowIdx) => {
      const lineNum = rowIdx + 2;
      const rawId = g(row, iUserID).replace('#', '').trim();
      const rawEmail = g(row, iUserEmail).trim().toLowerCase();

      let userId = '';
      let userIdentifier = '';
      if (rawId) {
        userId = displayIdToUserId[rawId] || '';
        userIdentifier = `#${rawId}`;
        if (!userId) errors.push(`Row ${lineNum}: User ID #${rawId} not found.`);
      } else if (rawEmail) {
        userId = emailToUserId[rawEmail] || '';
        userIdentifier = rawEmail;
        if (!userId) errors.push(`Row ${lineNum}: Email "${rawEmail}" not found.`);
      } else {
        errors.push(`Row ${lineNum}: No User ID or Email provided.`);
        return;
      }

      if (!userId) return;

      const songTitle = g(row, iSongTitle);
      if (!songTitle) { errors.push(`Row ${lineNum}: Song Title is empty.`); return; }

      const contentType = g(row, iContentType).toLowerCase().replace(/ /g, '_') || 'single';
      const releaseName = g(row, iReleaseName) || songTitle;
      const releaseDate = g(row, iReleaseDate) || new Date().toISOString().split('T')[0];

      // Create a unique key per release (user + release name + content type + release date)
      const releaseKey = `${userId}|${releaseName}|${contentType}|${releaseDate}`;

      if (!releasesMap.has(releaseKey)) {
        const rawStatus = g(row, iStatus).toLowerCase().replace(/ /g, '_');
        const status = ['pending', 'processing', 'approved', 'rejected', 'takedown'].includes(rawStatus) ? rawStatus : 'pending';
        const rawReleaseType = g(row, iReleaseType).toLowerCase().replace(/ /g, '_');
        const releaseType = ['new_release', 'transfer'].includes(rawReleaseType) ? rawReleaseType : 'new_release';
        const rawStore = g(row, iStore).toLowerCase().replace(/ /g, '_');
        const storeSelection = ['worldwide', 'instagram_facebook'].includes(rawStore) ? rawStore : 'worldwide';

        releasesMap.set(releaseKey, {
          user_id: userId,
          user_identifier: userIdentifier,
          release_type: releaseType,
          content_type: contentType,
          album_name: contentType === 'album' ? releaseName : '',
          ep_name: contentType === 'ep' ? releaseName : '',
          upc: g(row, iUpc),
          release_date: releaseDate,
          copyright_line: g(row, iCopyright),
          phonogram_line: g(row, iPhonogram),
          store_selection: storeSelection,
          status,
          tracks: [],
        });
      }

      const release = releasesMap.get(releaseKey)!;
      const trackOrder = parseInt(g(row, iTrackNo)) || release.tracks.length + 1;
      const rawAudioType = g(row, iAudioType).toLowerCase().replace(/ /g, '_');
      const audioType = ['with_vocal', 'instrumental'].includes(rawAudioType) ? rawAudioType : 'with_vocal';

      release.tracks.push({
        song_title: songTitle,
        isrc: g(row, iIsrc),
        primary_artist: g(row, iPrimaryArtist),
        singer: g(row, iSinger),
        audio_type: audioType,
        language: g(row, iLanguage),
        genre: g(row, iGenre),
        lyricist: g(row, iLyricist),
        composer: g(row, iComposer),
        producer: g(row, iProducer),
        spotify_link: g(row, iSpotify),
        apple_music_link: g(row, iApple),
        instagram_link: g(row, iInstagram),
        callertune_time: g(row, iCallertune),
        is_new_artist_profile: g(row, iNewArtist).toLowerCase() === 'yes',
        track_order: trackOrder,
      });
    });

    setImportParsedData(Array.from(releasesMap.values()));
    setImportErrors(errors);
    setImportParsing(false);
  };

  const handleConfirmImport = async () => {
    if (importParsedData.length === 0) return;
    setImporting(true);

    let successCount = 0;
    const errors: string[] = [];

    for (const rel of importParsedData) {
      const { data: releaseData, error: releaseError } = await supabase
        .from('releases')
        .insert({
          user_id: rel.user_id,
          release_type: rel.release_type,
          content_type: rel.content_type,
          album_name: rel.album_name || null,
          ep_name: rel.ep_name || null,
          upc: rel.upc || null,
          release_date: rel.release_date,
          copyright_line: rel.copyright_line || null,
          phonogram_line: rel.phonogram_line || null,
          store_selection: rel.store_selection,
          status: rel.status,
        })
        .select('id')
        .single();

      if (releaseError || !releaseData) {
        errors.push(`Failed to create release for ${rel.user_identifier}: ${releaseError?.message}`);
        continue;
      }

      const tracksToInsert = rel.tracks.map((t) => ({
        release_id: releaseData.id,
        user_id: rel.user_id,
        song_title: t.song_title,
        isrc: t.isrc || null,
        primary_artist: t.primary_artist || null,
        singer: t.singer || null,
        audio_type: t.audio_type,
        language: t.language || null,
        genre: t.genre || null,
        lyricist: t.lyricist || null,
        composer: t.composer || null,
        producer: t.producer || null,
        spotify_link: t.spotify_link || null,
        apple_music_link: t.apple_music_link || null,
        instagram_link: t.instagram_link || null,
        callertune_time: t.callertune_time || null,
        is_new_artist_profile: t.is_new_artist_profile,
        track_order: t.track_order,
        status: rel.status,
      }));

      const { error: tracksError } = await supabase.from('tracks').insert(tracksToInsert);
      if (tracksError) {
        errors.push(`Failed to insert tracks for ${rel.user_identifier}: ${tracksError.message}`);
      } else {
        successCount++;
      }
    }

    setImporting(false);
    setShowImportModal(false);
    setImportParsedData([]);
    setImportErrors([]);

    if (errors.length > 0) {
      toast.error(`Import completed with ${errors.length} error(s). ${successCount} release(s) imported.`);
    } else {
      toast.success(`Successfully imported ${successCount} release(s)!`);
    }
    fetchReleases();
  };


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

    // Fetch sub-label info for sub_label type users
    const { data: subLabelsData } = await supabase
      .from('sub_labels')
      .select('sub_user_id, sub_label_name, parent_label_name');

    const subLabelInfoMap: Record<string, { sub_label_name: string; parent_label_name: string }> = {};
    subLabelsData?.forEach((sl) => {
      if (sl.sub_user_id) {
        subLabelInfoMap[sl.sub_user_id] = {
          sub_label_name: sl.sub_label_name,
          parent_label_name: sl.parent_label_name,
        };
      }
    });

    const emailMap: Record<string, string> = {};
    const nameMap: Record<string, string> = {};
    const displayIdMap: Record<string, number> = {};
    const userTypeMap: Record<string, string> = {};
    profiles?.forEach((p) => {
      emailMap[p.user_id] = p.email;
      userTypeMap[p.user_id] = p.user_type;
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
        user_type: userTypeMap[r.user_id],
        sub_label_name: subLabelInfoMap[r.user_id]?.sub_label_name,
        parent_label_name: subLabelInfoMap[r.user_id]?.parent_label_name,
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

  const paginated = useMemo(() => paginateItems(filtered, page, pageSize), [filtered, page, pageSize]);

  // Reset page on filter change
  useEffect(() => { setPage(0); }, [search, statusFilter]);

  const getReleaseName = (r: Release) => {
    if (r.content_type === 'album') return r.album_name || 'Untitled Album';
    if (r.content_type === 'ep') return r.ep_name || 'Untitled EP';
    return r.tracks?.[0]?.song_title || 'Untitled Single';
  };

  const handleStatusChange = async (id: string, status: string) => {
    if (status === 'rejected') {
      setRejectTarget(id);
      return;
    }
    const { error } = await supabase.from('releases').update({ status, rejection_reason: null }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    // Also update all tracks of this release to the same status
    const { error: trackError } = await supabase.from('tracks').update({ status, rejection_reason: null }).eq('release_id', id);
    if (trackError) { toast.error('Release updated but failed to update tracks: ' + trackError.message); }
    toast.success(`Status changed to ${status} (all tracks updated)`);
    fetchReleases();
    if (viewRelease?.id === id) {
      setViewRelease((prev) => prev ? {
        ...prev, status, rejection_reason: null,
        tracks: prev.tracks?.map((t) => ({ ...t, status, rejection_reason: null })),
      } : null);
    }
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!rejectTarget) return;
    const { error } = await supabase.from('releases').update({ status: 'rejected', rejection_reason: reason }).eq('id', rejectTarget);
    if (error) { toast.error(error.message); return; }
    // Also reject all tracks
    await supabase.from('tracks').update({ status: 'rejected', rejection_reason: reason }).eq('release_id', rejectTarget);
    toast.success('Release and all tracks rejected');
    setRejectTarget(null);
    fetchReleases();
    if (viewRelease?.id === rejectTarget) {
      setViewRelease((prev) => prev ? {
        ...prev, status: 'rejected', rejection_reason: reason,
        tracks: prev.tracks?.map((t) => ({ ...t, status: 'rejected', rejection_reason: reason })),
      } : null);
    }
  };

  const handleTrackStatusChange = async (trackId: string, status: string) => {
    if (status === 'rejected') {
      setRejectTrackTarget(trackId);
      return;
    }
    const { error } = await supabase.from('tracks').update({ status, rejection_reason: null } as any).eq('id', trackId);
    if (error) { toast.error(error.message); return; }
    toast.success(`Track status changed to ${status}`);
    fetchReleases();
    if (viewRelease) {
      setViewRelease((prev) => prev ? {
        ...prev,
        tracks: prev.tracks?.map((t) => t.id === trackId ? { ...t, status, rejection_reason: null } : t),
      } : null);
    }
  };

  const handleTrackRejectConfirm = async (reason: string) => {
    if (!rejectTrackTarget) return;
    const { error } = await supabase.from('tracks').update({ status: 'rejected', rejection_reason: reason } as any).eq('id', rejectTrackTarget);
    if (error) { toast.error(error.message); return; }
    toast.success('Track rejected');
    setRejectTrackTarget(null);
    fetchReleases();
    if (viewRelease) {
      setViewRelease((prev) => prev ? {
        ...prev,
        tracks: prev.tracks?.map((t) => t.id === rejectTrackTarget ? { ...t, status: 'rejected', rejection_reason: reason } : t),
      } : null);
    }
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

  const [bulkDeletingAudio, setBulkDeletingAudio] = useState(false);
  const [bulkDeletingPoster, setBulkDeletingPoster] = useState(false);
  const [confirmBulkAction, setConfirmBulkAction] = useState<'audio' | 'poster' | null>(null);

  const handleBulkDeleteAudio = async () => {
    setBulkDeletingAudio(true);
    const ids = Array.from(selected);
    const selectedReleases = releases.filter(r => ids.includes(r.id));
    let deletedCount = 0;

    for (const release of selectedReleases) {
      if (!release.tracks) continue;
      for (const track of release.tracks) {
        if (track.audio_url) {
          const path = getStoragePath(track.audio_url, 'audio');
          if (path) await supabase.storage.from('audio').remove([path]);
          await supabase.from('tracks').update({ audio_url: null }).eq('id', track.id);
          deletedCount++;
        }
      }
    }

    setBulkDeletingAudio(false);
    setConfirmBulkAction(null);
    toast.success(`Deleted audio files from ${deletedCount} tracks across ${ids.length} releases`);
    setSelected(new Set());
    fetchReleases();
  };

  const handleBulkDeletePoster = async () => {
    setBulkDeletingPoster(true);
    const ids = Array.from(selected);
    const selectedReleases = releases.filter(r => ids.includes(r.id));
    let deletedCount = 0;

    for (const release of selectedReleases) {
      if (release.poster_url) {
        const path = getStoragePath(release.poster_url, 'posters');
        if (path) await supabase.storage.from('posters').remove([path]);
        await supabase.from('releases').update({ poster_url: null }).eq('id', release.id);
        deletedCount++;
      }
    }

    setBulkDeletingPoster(false);
    setConfirmBulkAction(null);
    toast.success(`Deleted poster images from ${deletedCount} releases`);
    setSelected(new Set());
    fetchReleases();
  };

  // Extract storage path from public URL
  const getStoragePath = (url: string, bucket: string) => {
    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(url.substring(idx + marker.length));
  };

  const handleDownloadFile = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error('Failed to download file');
    }
  };

  const handleBulkDownloadAudio = async () => {
    const ids = Array.from(selected);
    const selectedReleases = releases.filter(r => ids.includes(r.id));
    let count = 0;
    for (const release of selectedReleases) {
      if (!release.tracks) continue;
      for (const track of release.tracks) {
        if (track.audio_url) {
          const ext = track.audio_url.split('.').pop()?.split('?')[0] || 'mp3';
          await handleDownloadFile(track.audio_url, `${track.song_title || 'track'}.${ext}`);
          count++;
        }
      }
    }
    if (count === 0) toast.error('No audio files found in selected releases');
    else toast.success(`Downloaded ${count} audio file(s)`);
  };

  const handleBulkDownloadPoster = async () => {
    const ids = Array.from(selected);
    const selectedReleases = releases.filter(r => ids.includes(r.id));
    let count = 0;
    for (const release of selectedReleases) {
      if (release.poster_url) {
        const name = getReleaseName(release);
        const ext = release.poster_url.split('.').pop()?.split('?')[0] || 'jpg';
        await handleDownloadFile(release.poster_url, `${name}-poster.${ext}`);
        count++;
      }
    }
    if (count === 0) toast.error('No poster images found in selected releases');
    else toast.success(`Downloaded ${count} poster(s)`);
  };

  const handleDeletePoster = async (releaseId: string, posterUrl: string) => {
    const path = getStoragePath(posterUrl, 'posters') || getStoragePath(posterUrl, 'covers');
    const bucket = posterUrl.includes('/posters/') ? 'posters' : 'covers';
    if (path) {
      await supabase.storage.from(bucket).remove([path]);
    }
    const { error } = await supabase.from('releases').update({ poster_url: null }).eq('id', releaseId);
    if (error) { toast.error('Failed to delete poster'); return; }
    toast.success('Poster deleted');
    fetchReleases();
    if (viewRelease?.id === releaseId) setViewRelease((prev) => prev ? { ...prev, poster_url: null } : null);
  };

  const handleDeleteAudio = async (trackId: string, audioUrl: string) => {
    const path = getStoragePath(audioUrl, 'audio');
    if (path) {
      await supabase.storage.from('audio').remove([path]);
    }
    const { error } = await supabase.from('tracks').update({ audio_url: null }).eq('id', trackId);
    if (error) { toast.error('Failed to delete audio'); return; }
    toast.success('Audio deleted');
    fetchReleases();
    if (viewRelease) {
      setViewRelease((prev) => prev ? {
        ...prev,
        tracks: prev.tracks?.map((t) => t.id === trackId ? { ...t, audio_url: null } : t),
      } : null);
    }
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
    if (data.length === 0) { toast.error('No releases to export'); return; }

    const headers = [
      'Release Name', 'Release Type', 'Content Type', 'UPC', 'Status',
      'Release Date', 'Store Selection', 'Copyright ©', 'Phonogram ℗',
      'Poster URL', 'Rejection Reason',
      'Submitted By', 'User ID', 'User Email',
      'Track #', 'Song Title', 'ISRC', 'Primary Artist', 'New Artist Profile',
      'Audio Type', 'Language', 'Genre',
      'Lyricist', 'Composer', 'Producer',
      'Spotify Link', 'Apple Music Link', 'Instagram Link',
      'Callertune Time', 'Audio URL',
    ];

    const fmt = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    const rows: string[][] = [];
    data.forEach((r) => {
      const releaseFields = [
        getReleaseName(r), fmt(r.release_type), fmt(r.content_type), r.upc || '', fmt(r.status),
        r.release_date, fmt(r.store_selection), r.copyright_line || '', r.phonogram_line || '',
        r.poster_url || '', r.rejection_reason || '',
        r.user_name || '', r.user_display_id ? `#${r.user_display_id}` : '', r.user_email || '',
      ];

      const tracks = r.tracks?.length ? r.tracks : [null];
      tracks.forEach((t, i) => {
        const trackFields = t ? [
          String(t.track_order), t.song_title || '', t.isrc || '', t.primary_artist || '',
          t.is_new_artist_profile ? 'Yes' : 'No',
          fmt(t.audio_type || ''), t.language || '', t.genre || '',
          t.lyricist || '', t.composer || '', t.producer || '',
          t.spotify_link || '', t.apple_music_link || '', t.instagram_link || '',
          t.callertune_time || '', t.audio_url || '',
        ] : Array(16).fill('');

        rows.push([...releaseFields, ...trackFields]);
      });
    });

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell: string) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `releases-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${data.length} release(s)`);
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
      <div className="mb-6 sm:mb-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">All Submissions</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">Manage all music releases and tracks.</p>
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV} className="shrink-0 self-start sm:self-auto">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-muted/30 border border-border/50">
            <span className="text-xs font-medium text-muted-foreground self-center mr-1">{selected.size} selected:</span>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleBulkDownloadAudio}>
              <Download className="h-3.5 w-3.5" /> Audio
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleBulkDownloadPoster}>
              <Download className="h-3.5 w-3.5" /> Posters
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setConfirmBulkAction('audio')} disabled={bulkDeletingAudio}>
              {bulkDeletingAudio ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <VolumeX className="h-3.5 w-3.5" />}
              Del Audio
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setConfirmBulkAction('poster')} disabled={bulkDeletingPoster}>
              {bulkDeletingPoster ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageOff className="h-3.5 w-3.5" />}
              Del Posters
            </Button>
            <Button variant="destructive" size="sm" className="h-8 text-xs" onClick={handleBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete ({selected.size})
            </Button>
          </div>
        )}
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
          <>
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
                {paginated.map((release) => {
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
                            <div className="flex items-center gap-1.5">
                              <p className="text-foreground font-medium">{release.user_name || 'Unknown'}</p>
                              {release.user_display_id && (
                                <span className="font-mono font-bold text-primary">(#{release.user_display_id})</span>
                              )}
                            </div>
                            {release.user_type === 'sub_label' && release.sub_label_name ? (
                              <div className="mt-0.5">
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                                  <Users className="h-3 w-3" /> {release.sub_label_name}
                                </span>
                                <p className="text-muted-foreground mt-0.5">↳ Under: {release.parent_label_name}</p>
                              </div>
                            ) : (
                              <p className="text-muted-foreground">{release.user_display_id ? (release.user_email || '—') : 'No profile'}</p>
                            )}
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
                          {release.status === 'rejected' && release.rejection_reason && (
                            <p className="text-xs text-destructive mt-1 max-w-[180px] truncate" title={release.rejection_reason}>
                              {release.rejection_reason}
                            </p>
                          )}
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
                        <tr key={track.id} className={`border-b border-border/20 ${track.status === 'rejected' ? 'bg-destructive/5' : 'bg-muted/10'}`}>
                          <td className="py-2 px-3"></td>
                          <td className="py-2 px-3"></td>
                          <td className="py-2 px-3" colSpan={2}>
                            <div className="flex items-center gap-2">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">{track.track_order}</div>
                              <div>
                                <p className="text-sm text-foreground">{track.song_title}</p>
                                <p className="text-xs text-muted-foreground">{track.primary_artist} • {track.genre} • {track.audio_type}</p>
                                {track.status === 'rejected' && track.rejection_reason && (
                                  <p className="text-xs text-destructive mt-0.5 max-w-[250px] truncate" title={track.rejection_reason}>{track.rejection_reason}</p>
                                )}
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
                          <td className="py-2 px-3">
                            <select
                              className="bg-transparent border border-border rounded px-2 py-1 text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                              value={track.status || 'pending'}
                              onChange={(e) => handleTrackStatusChange(track.id, e.target.value)}
                            >
                              {STATUSES.map((s) => (
                                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-3 hidden lg:table-cell"></td>
                          <td className="py-2 px-3">
                            {track.audio_url ? (
                              <div className="flex items-center gap-1">
                                <audio controls src={track.audio_url} className="h-8 max-w-[150px]" />
                                <button
                                  onClick={() => handleDownloadFile(track.audio_url!, `${track.song_title || 'track'}.${track.audio_url!.split('.').pop()?.split('?')[0] || 'mp3'}`)}
                                  className="p-1 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-all"
                                  title="Download audio"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground/50">No audio</span>
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
          <TablePagination
            totalItems={filtered.length}
            currentPage={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            itemLabel="releases"
          />
          </>
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
                <Detail label="UPC" value={viewRelease.upc || '—'} copyable />
                <Detail label="Store" value={viewRelease.store_selection} />
                <Detail label="© Line" value={viewRelease.copyright_line || '—'} copyable />
                <Detail label="℗ Line" value={viewRelease.phonogram_line || '—'} copyable />
                <Detail label="Submitted By" value={viewRelease.user_name || '—'} copyable />
                <Detail label="Email" value={viewRelease.user_email || '—'} copyable />
                <Detail label="User ID" value={viewRelease.user_display_id ? `#${viewRelease.user_display_id}` : '—'} />
                <Detail label="Submitted" value={new Date(viewRelease.created_at).toLocaleString()} />
              </div>

              {viewRelease.poster_url ? (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Poster</p>
                  <div className="relative inline-block">
                    <img src={viewRelease.poster_url} alt="Poster" className="h-32 w-32 rounded-lg object-cover border border-border" />
                    <button
                      onClick={() => handleDownloadFile(viewRelease.poster_url!, `${getReleaseName(viewRelease)}-poster.${viewRelease.poster_url!.split('.').pop()?.split('?')[0] || 'jpg'}`)}
                      className="absolute -top-2 -left-2 p-1 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-all"
                      title="Download poster"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeletePoster(viewRelease.id, viewRelease.poster_url!)}
                      className="absolute -top-2 -right-2 p-1 rounded-full bg-destructive text-destructive-foreground hover:opacity-90 transition-all"
                      title="Delete poster"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Poster</p>
                  <div className="h-32 w-32 rounded-lg border border-dashed border-border flex items-center justify-center bg-muted/30">
                    <Image className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                </div>
              )}

              {viewRelease.tracks && viewRelease.tracks.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Tracks ({viewRelease.tracks.length})</p>
                  <div className="space-y-3">
                    {viewRelease.tracks.map((track) => (
                      <div key={track.id} className={`rounded-lg border p-4 space-y-3 ${track.status === 'rejected' ? 'border-destructive/50 bg-destructive/5' : 'border-border/50 bg-muted/20'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">{track.track_order}</span>
                            <span className="font-medium text-foreground">{track.song_title}</span>
                          </div>
                          {(viewRelease.content_type === 'album' || viewRelease.content_type === 'ep') && (
                            <div className="flex items-center gap-2">
                              <select
                                className="bg-transparent border border-border rounded px-2 py-1 text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                                value={track.status || 'pending'}
                                onChange={(e) => handleTrackStatusChange(track.id, e.target.value)}
                              >
                                {STATUSES.map((s) => (
                                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                        {track.status === 'rejected' && track.rejection_reason && (
                          <div className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
                            <span className="font-medium">Rejection Reason:</span> {track.rejection_reason}
                          </div>
                        )}

                        {/* ISRC, Audio Type, Language, Genre — before artist */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <Detail label="ISRC" value={track.isrc || '—'} copyable />
                          <Detail label="Audio Type" value={track.audio_type === 'with_vocal' ? 'With Vocal' : 'Instrumental'} />
                          <Detail label="Language" value={track.language || '—'} />
                          <Detail label="Genre" value={track.genre || '—'} />
                        </div>

                        {/* Primary Artist with profile links */}
                        <div className="rounded-lg border border-border/30 bg-muted/10 p-3 space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Primary Artist</p>
                          <p className="text-sm font-medium text-foreground">{track.primary_artist || '—'}</p>
                          {track.spotify_link && (
                            <div className="flex items-center gap-2 text-xs">
                              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="#1DB954"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                              <a href={track.spotify_link} target="_blank" rel="noopener noreferrer" className="text-foreground hover:text-primary truncate break-all flex-1">{track.spotify_link}</a>
                              <CopyButton value={track.spotify_link} />
                            </div>
                          )}
                          {track.apple_music_link && (
                            <div className="flex items-center gap-2 text-xs">
                              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="#FA243C"><path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043A5.022 5.022 0 0019.7.28C18.96.142 18.21.08 17.46.04 16.95.01 16.44 0 15.93 0H8.07C7.56 0 7.05.01 6.54.04 5.79.08 5.04.142 4.3.28a5.022 5.022 0 00-1.874.61C1.308 1.622.563 2.622.246 3.932a9.23 9.23 0 00-.24 2.19C.003 6.636 0 7.146 0 7.658v8.684c0 .51.003 1.022.006 1.534.007.483.047.966.12 1.444a6.7 6.7 0 00.12.748c.317 1.31 1.062 2.31 2.18 3.043A5.022 5.022 0 004.3 23.72c.74.138 1.49.2 2.24.24.51.03 1.02.04 1.53.04h7.86c.51 0 1.02-.01 1.53-.04.75-.04 1.5-.102 2.24-.24a5.022 5.022 0 001.874-.61c1.118-.734 1.863-1.734 2.18-3.043.073-.245.12-.498.12-.748.073-.478.113-.961.12-1.444.003-.512.006-1.024.006-1.534V7.658c0-.512-.003-1.022-.006-1.534zM17.46 12.15v4.764c0 .317-.01.634-.046.95a2.244 2.244 0 01-.504 1.166 1.632 1.632 0 01-.822.542c-.37.11-.75.143-1.13.143-.38 0-.76-.033-1.13-.143a1.632 1.632 0 01-.822-.542 2.244 2.244 0 01-.504-1.166 4.16 4.16 0 01-.046-.95c0-.316.01-.634.046-.95a2.244 2.244 0 01.504-1.166 1.632 1.632 0 01.822-.542c.37-.11.75-.143 1.13-.143.32 0 .636.024.95.082V9.96l-5.578 1.745v5.96c0 .316-.01.634-.046.95a2.244 2.244 0 01-.504 1.165 1.632 1.632 0 01-.822.542c-.37.11-.75.143-1.13.143-.38 0-.76-.033-1.13-.143a1.632 1.632 0 01-.822-.542 2.244 2.244 0 01-.504-1.166 4.16 4.16 0 01-.046-.95c0-.316.01-.634.046-.95a2.244 2.244 0 01.504-1.165 1.632 1.632 0 01.822-.542c.37-.11.75-.143 1.13-.143.32 0 .636.024.95.082V8.254c0-.36.105-.676.306-.95a1.49 1.49 0 01.798-.53l5.94-1.86c.14-.044.29-.066.44-.066.47 0 .862.34.932.802.01.06.016.12.016.182v6.318z"/></svg>
                              <a href={track.apple_music_link} target="_blank" rel="noopener noreferrer" className="text-foreground hover:text-primary truncate break-all flex-1">{track.apple_music_link}</a>
                              <CopyButton value={track.apple_music_link} />
                            </div>
                          )}
                          {track.is_new_artist_profile && (
                            <span className="inline-block text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">✓ New profile requested</span>
                          )}
                        </div>

                        {/* Credits */}
                        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                          <Detail label="Singer" value={(track as any).singer || '—'} />
                          <Detail label="Lyricist" value={track.lyricist || '—'} />
                          <Detail label="Composer" value={track.composer || '—'} />
                          <Detail label="Producer" value={track.producer || '—'} />
                        </div>

                        {/* Additional info */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {track.instagram_link && track.instagram_link !== '—' ? (
                            <div>
                              <p className="text-muted-foreground text-xs">Instagram</p>
                              <div className="flex items-center gap-1">
                                <a href={track.instagram_link} target="_blank" rel="noopener noreferrer" className="text-foreground hover:text-primary break-all">{track.instagram_link}</a>
                                <CopyButton value={track.instagram_link} />
                              </div>
                            </div>
                          ) : (
                            <Detail label="Instagram" value="—" />
                          )}
                          <Detail label="Callertune" value={track.callertune_time || '—'} />
                        </div>

                        {track.audio_url ? (
                          <div className="flex items-center gap-2 mt-1">
                            <audio controls src={track.audio_url} className="flex-1 h-8" />
                            <button
                              onClick={() => handleDownloadFile(track.audio_url!, `${track.song_title || 'track'}.${track.audio_url!.split('.').pop()?.split('?')[0] || 'mp3'}`)}
                              className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all"
                              title="Download audio"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteAudio(track.id, track.audio_url!)}
                              className="p-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all"
                              title="Delete audio"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 mt-1 p-2 rounded-lg border border-dashed border-border bg-muted/20">
                            <Volume2 className="h-4 w-4 text-muted-foreground/50" />
                            <span className="text-xs text-muted-foreground/50">No audio file</span>
                          </div>
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

      {confirmBulkAction && (
        <ConfirmDialog
          title={confirmBulkAction === 'audio' ? 'Delete Audio Files' : 'Delete Poster Images'}
          message={confirmBulkAction === 'audio'
            ? `Are you sure you want to delete all audio files from ${selected.size} selected release(s)? The track records will remain but audio files will be permanently removed from storage.`
            : `Are you sure you want to delete poster images from ${selected.size} selected release(s)? The release records will remain but poster files will be permanently removed from storage.`
          }
          onConfirm={confirmBulkAction === 'audio' ? handleBulkDeleteAudio : handleBulkDeletePoster}
          onCancel={() => setConfirmBulkAction(null)}
        />
      )}

      <RejectReasonModal
        open={!!rejectTarget}
        title="Reject Release"
        onConfirm={handleRejectConfirm}
        onCancel={() => setRejectTarget(null)}
      />

      <RejectReasonModal
        open={!!rejectTrackTarget}
        title="Reject Track"
        onConfirm={handleTrackRejectConfirm}
        onCancel={() => setRejectTrackTarget(null)}
      />
    </DashboardLayout>
  );
}

function Detail({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
  const showCopy = copyable && value && value !== '—';
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <div className="flex items-center gap-1">
        <p className="text-foreground capitalize break-all">{value}</p>
        {showCopy && <CopyButton value={value} />}
      </div>
    </div>
  );
}
