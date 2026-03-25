import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, Upload, Plus, Trash2, Music, CheckCircle2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { TrackForm, type TrackData } from '@/components/release/TrackForm';
import { PosterCropModal } from '@/components/release/PosterCropModal';
import { normalizeIsrc } from '@/lib/isrc';

const CONTENT_TYPES = [
  { value: 'single', label: 'Single' },
  { value: 'album', label: 'Album' },
  { value: 'ep', label: 'EP' },
];

const STORE_OPTIONS = [
  { value: 'worldwide', label: 'Worldwide - All Platforms' },
  { value: 'instagram_facebook', label: 'Instagram & Facebook Only' },
];

export default function NewRelease() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editReleaseId = searchParams.get('edit');
  const [submitting, setSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);
  const [submitStep, setSubmitStep] = useState('');
  const [loadingEdit, setLoadingEdit] = useState(!!editReleaseId);

  const [releaseOwnerId, setReleaseOwnerId] = useState<string | null>(null);
  // Release-level state
  const [releaseType, setReleaseType] = useState<'new_release' | 'transfer'>('new_release');
  const [contentType, setContentType] = useState('single');
  const [albumName, setAlbumName] = useState('');
  const [epName, setEpName] = useState('');
  const [upc, setUpc] = useState('');
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState<string | null>(null);
  const [existingPosterUrl, setExistingPosterUrl] = useState<string | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [releaseDate, setReleaseDate] = useState('');
  const [storeSelection, setStoreSelection] = useState('worldwide');
  const [agreePolicy, setAgreePolicy] = useState(false);

  const [copyrightLine, setCopyrightLine] = useState('');
  const [phonogramLine, setPhonogramLine] = useState('');

  // Track state
  const [tracks, setTracks] = useState<TrackData[]>([]);
  const [showTrackForm, setShowTrackForm] = useState(false);
  const [editingTrackIndex, setEditingTrackIndex] = useState<number | null>(null);

  // Genres & Languages from DB
  const [genres, setGenres] = useState<{ id: string; name: string }[]>([]);
  const [languages, setLanguages] = useState<{ id: string; name: string }[]>([]);
  const [approvedLabels, setApprovedLabels] = useState<string[]>([]);
  const [hasAnyLabels, setHasAnyLabels] = useState<boolean | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [genresRes, langsRes, labelsRes, allLabelsRes] = await Promise.all([
        supabase.from('genres').select('id, name').order('name'),
        supabase.from('languages').select('id, name').order('name'),
        supabase.from('labels').select('label_name').eq('status', 'approved').order('label_name'),
        supabase.from('labels').select('id', { count: 'exact', head: true }),
      ]);
      if (genresRes.data) setGenres(genresRes.data);
      if (langsRes.data) setLanguages(langsRes.data);
      if (labelsRes.data) setApprovedLabels((labelsRes.data as any[]).map(l => l.label_name));
      setHasAnyLabels((allLabelsRes.count ?? 0) > 0);
    };
    fetchData();
  }, []);

  // Load existing release for edit mode
  useEffect(() => {
    if (!editReleaseId || !user) return;
    const loadRelease = async () => {
      setLoadingEdit(true);
      const isAdmin = role === 'admin';
      
      // Admin can edit any release; user can only edit own
      let query = supabase.from('releases').select('*').eq('id', editReleaseId);
      if (!isAdmin) query = query.eq('user_id', user.id);
      const { data: release } = await query.single();

      if (!release || (!isAdmin && release.status !== 'pending')) {
        toast.error('Release not found or cannot be edited.');
        navigate(isAdmin ? '/admin/submissions' : '/my-releases');
        return;
      }

      setReleaseOwnerId(release.user_id);
      setReleaseType(release.release_type as 'new_release' | 'transfer');
      setContentType(release.content_type);
      setAlbumName(release.album_name || '');
      setEpName(release.ep_name || '');
      setUpc(release.upc || '');
      setReleaseDate(release.release_date);
      setStoreSelection(release.store_selection);
      setCopyrightLine(release.copyright_line || '');
      setPhonogramLine(release.phonogram_line || '');
      if (release.poster_url) {
        setExistingPosterUrl(release.poster_url);
        setPosterPreview(release.poster_url);
      }

      const { data: tracksData } = await supabase
        .from('tracks')
        .select('*')
        .eq('release_id', editReleaseId)
        .order('track_order');

      if (tracksData) {
        setTracks(tracksData.map(t => ({
          songTitle: t.song_title,
          isrc: t.isrc || '',
          audioFile: null,
          audioType: t.audio_type as 'with_vocal' | 'instrumental',
          language: t.language || '',
          genre: t.genre || '',
          primaryArtists: [{
            name: t.primary_artist || '',
            spotifyLink: t.spotify_link || '',
            appleMusicLink: t.apple_music_link || '',
            isNewProfile: t.is_new_artist_profile || false,
          }],
          singer: (t as any).singer || '',
          lyricist: t.lyricist || '',
          composer: t.composer || '',
          producer: t.producer || '',
          instagramLink: t.instagram_link || '',
          callertuneTime: t.callertune_time || '',
          _existingAudioUrl: t.audio_url || undefined,
          _trackId: t.id,
        })));
      }

      setLoadingEdit(false);
    };
    loadRelease();
  }, [editReleaseId, user]);

  useEffect(() => {
    if (posterFile) {
      const url = URL.createObjectURL(posterFile);
      setPosterPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setPosterPreview(null);
  }, [posterFile]);

  const handlePosterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file.');
      return;
    }
    const img = new Image();
    img.onload = () => {
      if (img.width === 3000 && img.height === 3000) {
        // Perfect size — convert to JPG if needed
        if (file.type === 'image/jpeg') {
          setPosterFile(file);
        } else {
          const canvas = document.createElement('canvas');
          canvas.width = 3000;
          canvas.height = 3000;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            canvas.toBlob((blob) => {
              if (blob) setPosterFile(new File([blob], 'poster.jpg', { type: 'image/jpeg' }));
            }, 'image/jpeg', 0.92);
          }
        }
      } else {
        // Show crop modal
        setCropImageSrc(URL.createObjectURL(file));
        setShowCropModal(true);
      }
    };
    img.src = URL.createObjectURL(file);
  };

  const handleCropComplete = (croppedFile: File) => {
    setPosterFile(croppedFile);
    setShowCropModal(false);
    if (cropImageSrc) {
      URL.revokeObjectURL(cropImageSrc);
      setCropImageSrc(null);
    }
    toast.success('Poster cropped to 3000×3000!');
  };

  const handleCropCancel = () => {
    setShowCropModal(false);
    if (cropImageSrc) {
      URL.revokeObjectURL(cropImageSrc);
      setCropImageSrc(null);
    }
  };

  const maxTracks = contentType === 'single' ? 1 : Infinity;
  const canAddTrack = tracks.length < maxTracks;

  const handleAddTrack = (track: TrackData) => {
    if (editingTrackIndex !== null) {
      setTracks((prev) => prev.map((t, i) => (i === editingTrackIndex ? track : t)));
      setEditingTrackIndex(null);
    } else {
      setTracks((prev) => [...prev, track]);
    }
    setShowTrackForm(false);
  };

  const handleRemoveTrack = (index: number) => {
    setTracks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (tracks.length === 0) {
      toast.error('Please add at least one track.');
      return;
    }
    if (!agreePolicy) {
      toast.error('Please agree to the policy.');
      return;
    }
    if (!releaseDate) {
      toast.error('Please select a release date.');
      return;
    }

    setSubmitting(true);
    setSubmitProgress(0);
    setSubmitStep('Uploading poster...');

    const totalSteps = 2 + tracks.length; // poster + release record + each track
    let completed = 0;
    const advance = (step: string) => {
      completed++;
      setSubmitProgress(Math.round((completed / totalSteps) * 100));
      setSubmitStep(step);
    };

    try {
      // Upload poster
      let poster_url = existingPosterUrl;
      if (posterFile) {
        const path = `${user.id}/${Date.now()}-${posterFile.name}`;
        const { error } = await supabase.storage.from('posters').upload(path, posterFile);
        if (error) throw error;
        const { data: urlData } = supabase.storage.from('posters').getPublicUrl(path);
        poster_url = urlData.publicUrl;
      }
      advance(editReleaseId ? 'Updating release...' : 'Creating release...');

      if (editReleaseId) {
        // UPDATE existing release
        const { error: releaseError } = await supabase
          .from('releases')
          .update({
            release_type: releaseType,
            content_type: contentType,
            album_name: contentType === 'album' ? albumName : null,
            ep_name: contentType === 'ep' ? epName : null,
            upc: upc || null,
            poster_url,
            release_date: releaseDate,
            store_selection: storeSelection,
            copyright_line: copyrightLine || null,
            phonogram_line: phonogramLine || null,
            status: 'pending',
            rejection_reason: null,
          })
          .eq('id', editReleaseId);

        if (releaseError) throw releaseError;
        advance(`Updating tracks...`);

        // Delete existing tracks and re-insert
        await supabase.from('tracks').delete().eq('release_id', editReleaseId);

        for (let i = 0; i < tracks.length; i++) {
          const track = tracks[i] as TrackData & { _existingAudioUrl?: string; _trackId?: string };
          let audio_url = track._existingAudioUrl || null;

          if (track.audioFile) {
            setSubmitStep(`Uploading audio for track ${i + 1} of ${tracks.length}...`);
            const path = `${user.id}/${Date.now()}-${track.audioFile.name}`;
            const { error } = await supabase.storage.from('audio').upload(path, track.audioFile);
            if (error) throw error;
            const { data: urlData } = supabase.storage.from('audio').getPublicUrl(path);
            audio_url = urlData.publicUrl;
          }

          const { error: trackError } = await supabase.from('tracks').insert({
            release_id: editReleaseId,
            user_id: releaseOwnerId || user.id,
            song_title: track.songTitle,
            isrc: normalizeIsrc(track.isrc),
            audio_url,
            audio_type: track.audioType,
            language: track.language || null,
            genre: track.genre || null,
            primary_artist: track.primaryArtists.map(a => a.name).filter(Boolean).join(', ') || null,
            spotify_link: track.primaryArtists[0]?.spotifyLink || null,
            apple_music_link: track.primaryArtists[0]?.appleMusicLink || null,
            is_new_artist_profile: track.primaryArtists.some(a => a.isNewProfile),
            singer: track.singer || null,
            lyricist: track.lyricist || null,
            composer: track.composer || null,
            producer: track.producer || null,
            instagram_link: track.instagramLink || null,
            callertune_time: track.callertuneTime || null,
            track_order: i + 1,
          });

          if (trackError) throw trackError;
          if (i < tracks.length - 1) advance(`Updating track ${i + 2} of ${tracks.length}...`);
        }

        setSubmitProgress(100);
        setSubmitStep('Done!');
        toast.success('Release updated successfully!');
        setTimeout(() => navigate(role === 'admin' ? '/admin/submissions' : '/my-releases'), 800);
      } else {
        // CREATE new release
        const { data: release, error: releaseError } = await supabase
          .from('releases')
          .insert({
            user_id: user.id,
            release_type: releaseType,
            content_type: contentType,
            album_name: contentType === 'album' ? albumName : null,
            ep_name: contentType === 'ep' ? epName : null,
            upc: upc || null,
            poster_url,
            release_date: releaseDate,
            store_selection: storeSelection,
            copyright_line: copyrightLine || null,
            phonogram_line: phonogramLine || null,
          })
          .select('id')
          .single();

        if (releaseError) throw releaseError;
        advance(`Uploading track 1 of ${tracks.length}...`);

        for (let i = 0; i < tracks.length; i++) {
          const track = tracks[i];
          let audio_url = null;

          if (track.audioFile) {
            setSubmitStep(`Uploading audio for track ${i + 1} of ${tracks.length}...`);
            const path = `${user.id}/${Date.now()}-${track.audioFile.name}`;
            const { error } = await supabase.storage.from('audio').upload(path, track.audioFile);
            if (error) throw error;
            const { data: urlData } = supabase.storage.from('audio').getPublicUrl(path);
            audio_url = urlData.publicUrl;
          }

          const { error: trackError } = await supabase.from('tracks').insert({
            release_id: release.id,
            user_id: user.id,
            song_title: track.songTitle,
            isrc: normalizeIsrc(track.isrc),
            audio_url,
            audio_type: track.audioType,
            language: track.language || null,
            genre: track.genre || null,
            primary_artist: track.primaryArtists.map(a => a.name).filter(Boolean).join(', ') || null,
            spotify_link: track.primaryArtists[0]?.spotifyLink || null,
            apple_music_link: track.primaryArtists[0]?.appleMusicLink || null,
            is_new_artist_profile: track.primaryArtists.some(a => a.isNewProfile),
            singer: track.singer || null,
            lyricist: track.lyricist || null,
            composer: track.composer || null,
            producer: track.producer || null,
            instagram_link: track.instagramLink || null,
            callertune_time: track.callertuneTime || null,
            track_order: i + 1,
          });

          if (trackError) throw trackError;
          if (i < tracks.length - 1) advance(`Uploading track ${i + 2} of ${tracks.length}...`);
        }

        setSubmitProgress(100);
        setSubmitStep('Done!');
        toast.success('Release submitted successfully!');
        setTimeout(() => navigate('/my-releases'), 800);
      }
    } catch (err: any) {
      toast.error(err.message || 'Submission failed');
      setSubmitting(false);
      setSubmitProgress(0);
      setSubmitStep('');
    }
  };

  const inputClass =
    'w-full px-4 py-3 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm';

  // Block access if user has no labels
  if (hasAnyLabels === false) {
    return (
      <DashboardLayout>
        <Dialog open onOpenChange={() => navigate('/my-labels')}>
          <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>Add a Label First</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              You need to add at least one label before creating a release. Your approved labels will appear in the © Line and ℗ Line fields.
            </p>
            <DialogFooter>
              <Button onClick={() => navigate('/my-labels')} className="btn-primary-gradient text-primary-foreground font-semibold">
                Go to My Labels
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    );
  }

  // Submitting progress screen
  if (submitting) {
    return (
      <DashboardLayout>
        <div className="mx-auto w-full max-w-md flex flex-col items-center justify-center min-h-[50vh]">
          <GlassCard glow className="w-full text-center animate-fade-in">
            <div className="space-y-6 py-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
              <div>
                <h2 className="text-xl font-display font-bold text-foreground mb-1">{editReleaseId ? 'Updating Release' : 'Submitting Release'}</h2>
                <p className="text-sm text-muted-foreground">{submitStep}</p>
              </div>
              <div className="w-full bg-muted/50 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${submitProgress}%` }}
                />
              </div>
              <p className="text-lg font-bold text-primary">{submitProgress}%</p>
            </div>
          </GlassCard>
        </div>
      </DashboardLayout>
    );
  }

  if (showTrackForm) {
    return (
      <DashboardLayout>
        <div className="mx-auto w-full max-w-2xl">
          <div className="mb-6 text-left">
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
              {editingTrackIndex !== null ? 'Edit Track' : 'Add Track'}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Fill in the track details below.
            </p>
          </div>
          <GlassCard glow className="w-full animate-fade-in">
            <TrackForm
              key={editingTrackIndex ?? 'new'}
              genres={genres}
              languages={languages}
              isTransfer={releaseType === 'transfer'}
              initialData={editingTrackIndex !== null ? tracks[editingTrackIndex] : undefined}
              onSubmit={handleAddTrack}
              onCancel={() => {
                setShowTrackForm(false);
                setEditingTrackIndex(null);
              }}
            />
          </GlassCard>
        </div>
      </DashboardLayout>
    );
  }

  if (loadingEdit) {
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
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 text-left sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
            {editReleaseId ? 'Edit Release' : 'New Release'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            {editReleaseId ? 'Update the details of your pending release.' : 'Fill in the details to distribute your music.'}
          </p>
        </div>

        <GlassCard glow className="w-full animate-fade-in">
          <div className="space-y-6">
            {/* Release Type */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-3">Release Type *</label>
              <div className="flex gap-4">
                <label className={`flex items-center gap-2 cursor-pointer rounded-lg border px-4 py-3 text-sm transition-all ${releaseType === 'new_release' ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                  <input type="radio" name="releaseType" value="new_release" checked={releaseType === 'new_release'} onChange={() => setReleaseType('new_release')} className="sr-only" />
                  <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${releaseType === 'new_release' ? 'border-primary' : 'border-muted-foreground'}`}>
                    {releaseType === 'new_release' && <div className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                  New Release
                </label>
                <label className={`flex items-center gap-2 cursor-pointer rounded-lg border px-4 py-3 text-sm transition-all ${releaseType === 'transfer' ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                  <input type="radio" name="releaseType" value="transfer" checked={releaseType === 'transfer'} onChange={() => setReleaseType('transfer')} className="sr-only" />
                  <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${releaseType === 'transfer' ? 'border-primary' : 'border-muted-foreground'}`}>
                    {releaseType === 'transfer' && <div className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                  Transfer from Another Distributor
                </label>
              </div>
            </div>

            {/* Content Type */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Content Type *</label>
              <select className={inputClass} value={contentType} onChange={(e) => { setContentType(e.target.value); setTracks([]); }}>
                {CONTENT_TYPES.map((ct) => (
                  <option key={ct.value} value={ct.value}>{ct.label}</option>
                ))}
              </select>
            </div>

            {/* Album Name */}
            {contentType === 'album' && (
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Album Name *</label>
                <input className={inputClass} value={albumName} onChange={(e) => setAlbumName(e.target.value)} required placeholder="Enter album name" />
              </div>
            )}

            {/* EP Name */}
            {contentType === 'ep' && (
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">EP Name *</label>
                <input className={inputClass} value={epName} onChange={(e) => setEpName(e.target.value)} required placeholder="Enter EP name" />
              </div>
            )}

            {/* UPC */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">UPC</label>
              <input className={inputClass} value={upc} onChange={(e) => setUpc(e.target.value)} placeholder="Enter UPC code" />
            </div>

            {/* Poster Upload */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Upload Poster * <span className="text-xs text-muted-foreground">(3000×3000 px, JPG only)</span>
              </label>
              <div className="relative">
                <input type="file" accept="image/*" onChange={handlePosterChange} className="hidden" id="poster-upload" />
                <label htmlFor="poster-upload" className={`${inputClass} flex min-w-0 cursor-pointer items-center gap-2`}>
                  <Upload className="h-4 w-4 shrink-0" />
                  <span className="truncate">{posterFile?.name || 'Choose poster image'}</span>
                </label>
              </div>
              {posterPreview && (
                <div className="mt-3">
                  <img src={posterPreview} alt="Poster preview" className="h-32 w-32 rounded-lg object-cover border border-border" />
                </div>
              )}
            </div>

            {/* Release Date */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Release Date *</label>
              <input type="date" className={inputClass} value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} required />
            </div>

            {/* Store Selection */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Select Stores *</label>
              <select className={inputClass} value={storeSelection} onChange={(e) => setStoreSelection(e.target.value)}>
                {STORE_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* © Line & ℗ Line */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">© Line</label>
                <select className={inputClass} value={copyrightLine} onChange={(e) => setCopyrightLine(e.target.value)}>
                  <option value="">Select label</option>
                  {approvedLabels.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
                {approvedLabels.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">No approved labels yet. <button type="button" className="text-primary hover:underline" onClick={() => navigate('/my-labels')}>Add labels</button></p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">℗ Line</label>
                <select className={inputClass} value={phonogramLine} onChange={(e) => setPhonogramLine(e.target.value)}>
                  <option value="">Select label</option>
                  {approvedLabels.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
                {approvedLabels.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">No approved labels yet. <button type="button" className="text-primary hover:underline" onClick={() => navigate('/my-labels')}>Add labels</button></p>
                )}
              </div>
            </div>

            {/* Tracks Section */}
            <div className="border-t border-border pt-5">
              <h2 className="text-lg font-semibold text-foreground mb-3">
                Tracks {tracks.length > 0 && <span className="text-sm font-normal text-muted-foreground">({tracks.length} added)</span>}
              </h2>

              {tracks.length > 0 && (
                <div className="space-y-2 mb-4">
                  {tracks.map((track, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                          {i + 1}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{track.songTitle}</p>
                          <p className="text-xs text-muted-foreground">{track.primaryArtists.map(a => a.name).filter(Boolean).join(', ')} • {track.genre}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingTrackIndex(i); setShowTrackForm(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveTrack(i)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {canAddTrack && (
                <Button variant="outline" className="w-full gap-2" onClick={() => setShowTrackForm(true)}>
                  <Plus className="h-4 w-4" />
                  Add Track
                </Button>
              )}

              {!canAddTrack && contentType === 'single' && tracks.length >= 1 && (
                <p className="text-xs text-muted-foreground text-center">Single releases can only have one track.</p>
              )}
            </div>

            {/* Agree Policy */}
            {tracks.length > 0 && (
              <>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="agree-policy"
                    checked={agreePolicy}
                    onChange={(e) => setAgreePolicy(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <label htmlFor="agree-policy" className="text-sm text-muted-foreground">
                    I agree to the terms and conditions and confirm that I have the rights to distribute this content.
                  </label>
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !agreePolicy}
                  className="w-full btn-primary-gradient py-3 font-semibold text-primary-foreground"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editReleaseId ? 'Update Release' : 'Submit Release'}
                </Button>
              </>
            )}
          </div>
        </GlassCard>
      </div>

      <PosterCropModal
        open={showCropModal}
        imageSrc={cropImageSrc || ''}
        onCropComplete={handleCropComplete}
        onCancel={handleCropCancel}
      />
    </DashboardLayout>
  );
}
