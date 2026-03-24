import { useState, useRef, useCallback, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Download, Upload, Image as ImageIcon, RefreshCw } from 'lucide-react';

const SIZE_PRESETS: Record<string, { width: number; height: number; label: string }> = {
  'instagram-post': { width: 1080, height: 1080, label: 'Instagram Post (1080×1080)' },
  'instagram-story': { width: 1080, height: 1920, label: 'Instagram Story (1080×1920)' },
  'facebook-post': { width: 1200, height: 630, label: 'Facebook Post (1200×630)' },
  'facebook-story': { width: 1080, height: 1920, label: 'Facebook Story (1080×1920)' },
  'twitter-post': { width: 1200, height: 675, label: 'Twitter/X Post (1200×675)' },
  'youtube-thumbnail': { width: 1280, height: 720, label: 'YouTube Thumbnail (1280×720)' },
  'youtube-banner': { width: 2560, height: 1440, label: 'YouTube Banner (2560×1440)' },
  'whatsapp-status': { width: 1080, height: 1920, label: 'WhatsApp Status (1080×1920)' },
  'spotify-canvas': { width: 720, height: 1280, label: 'Spotify Canvas (720×1280)' },
};

export default function AdminPosterGenerator() {
  const [songTitle, setSongTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState('');
  const [selectedSize, setSelectedSize] = useState('instagram-post');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Load company logo
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('company_details').select('logo_url').limit(1).single();
      if (data?.logo_url) setLogoUrl(data.logo_url);
    })();
  }, []);

  const handlePosterUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPosterFile(file);
    const url = URL.createObjectURL(file);
    setPosterPreview(url);
  };

  const loadImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  const generatePoster = useCallback(async (canvas: HTMLCanvasElement, forDownload = false) => {
    const preset = SIZE_PRESETS[selectedSize];
    if (!preset || !posterPreview) return;

    const { width, height } = preset;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const isLandscape = width > height;
    const isSquare = width === height;
    const isPortrait = height > width;

    // --- Background gradient ---
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#f5e6e0');
    grad.addColorStop(0.4, '#e8c8c0');
    grad.addColorStop(0.7, '#c9a09a');
    grad.addColorStop(1, '#9a7070');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // --- Load images ---
    let coverImg: HTMLImageElement | null = null;
    let logoImg: HTMLImageElement | null = null;
    try { coverImg = await loadImage(posterPreview); } catch {}
    if (logoUrl) try { logoImg = await loadImage(logoUrl); } catch {}

    const pad = Math.min(width, height) * 0.06;

    // --- Layout calculations ---
    let coverX: number, coverY: number, coverSize: number;
    let titleY: number, artistY: number, taglineY: number;
    let textCenterX: number;
    let logoX: number, logoY: number, logoMaxW: number, logoMaxH: number;
    let newReleaseX: number, newReleaseY: number;

    if (isSquare) {
      coverSize = width * 0.6;
      coverX = (width - coverSize) / 2;
      coverY = height * 0.12;
      titleY = coverY + coverSize + height * 0.08;
      artistY = titleY + height * 0.06;
      taglineY = height * 0.92;
      textCenterX = width / 2;
      logoMaxW = width * 0.2;
      logoMaxH = height * 0.06;
      logoX = pad;
      logoY = pad;
      newReleaseX = width - pad;
      newReleaseY = pad + logoMaxH * 0.3;
    } else if (isPortrait) {
      coverSize = width * 0.75;
      coverX = (width - coverSize) / 2;
      coverY = height * 0.1;
      titleY = coverY + coverSize + height * 0.06;
      artistY = titleY + height * 0.04;
      taglineY = height * 0.92;
      textCenterX = width / 2;
      logoMaxW = width * 0.25;
      logoMaxH = height * 0.04;
      logoX = pad;
      logoY = pad;
      newReleaseX = width - pad;
      newReleaseY = pad + logoMaxH * 0.3;
    } else {
      // Landscape
      coverSize = height * 0.6;
      coverX = pad * 2;
      coverY = (height - coverSize) / 2;
      textCenterX = coverX + coverSize + (width - coverX - coverSize) / 2;
      titleY = height * 0.42;
      artistY = titleY + height * 0.1;
      taglineY = height * 0.88;
      logoMaxW = width * 0.12;
      logoMaxH = height * 0.08;
      logoX = width - pad - logoMaxW;
      logoY = pad;
      newReleaseX = pad;
      newReleaseY = pad + logoMaxH * 0.5;
    }

    // --- Draw cover art with rounded corners and shadow ---
    if (coverImg) {
      const radius = coverSize * 0.04;
      ctx.save();
      // Shadow
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = coverSize * 0.08;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = coverSize * 0.02;
      ctx.beginPath();
      ctx.roundRect(coverX, coverY, coverSize, coverSize, radius);
      ctx.clip();
      ctx.drawImage(coverImg, coverX, coverY, coverSize, coverSize);
      ctx.restore();

      // Border
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(coverX, coverY, coverSize, coverSize, radius);
      ctx.stroke();
      ctx.restore();
    }

    // --- Logo ---
    if (logoImg) {
      const aspect = logoImg.width / logoImg.height;
      let lw = logoMaxW;
      let lh = lw / aspect;
      if (lh > logoMaxH) { lh = logoMaxH; lw = lh * aspect; }
      ctx.drawImage(logoImg, logoX, logoY, lw, lh);
    }

    // --- "NEW RELEASE" badge ---
    const badgeFontSize = Math.round(Math.min(width, height) * 0.028);
    const subBadgeFontSize = Math.round(badgeFontSize * 0.6);
    ctx.save();
    ctx.textAlign = isLandscape ? 'left' : 'right';
    ctx.fillStyle = '#8B1A1A';
    ctx.font = `900 ${badgeFontSize}px "Space Grotesk", sans-serif`;
    ctx.fillText('NEW RELEASE', newReleaseX, newReleaseY);
    ctx.fillStyle = '#444';
    ctx.font = `600 ${subBadgeFontSize}px "Inter", sans-serif`;
    ctx.fillText('BY OUR ARTIST & LABELS', newReleaseX, newReleaseY + badgeFontSize * 1.2);
    ctx.restore();

    // --- Song Title ---
    const titleFontSize = Math.round(Math.min(width, height) * 0.06);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1a1a1a';
    ctx.font = `800 ${titleFontSize}px "Space Grotesk", sans-serif`;
    ctx.fillText(songTitle.toUpperCase(), textCenterX, titleY, (isLandscape ? (width - coverX - coverSize - pad * 4) : width * 0.85));
    ctx.restore();

    // --- Artist Name ---
    const artistFontSize = Math.round(Math.min(width, height) * 0.032);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#555';
    ctx.font = `600 ${artistFontSize}px "Inter", sans-serif`;
    ctx.fillText(artistName, textCenterX, artistY, (isLandscape ? (width - coverX - coverSize - pad * 4) : width * 0.85));
    ctx.restore();

    // --- Torn paper effect at bottom ---
    const tornY = height * 0.85;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, tornY);
    for (let x = 0; x <= width; x += 12) {
      ctx.lineTo(x, tornY + Math.sin(x * 0.08) * 8 + Math.random() * 4);
    }
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // --- "OUT NOW!" tagline ---
    const tagFontSize = Math.round(Math.min(width, height) * 0.022);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8B1A1A';
    ctx.font = `700 ${tagFontSize}px "Inter", sans-serif`;
    ctx.fillText('OUT NOW! AVAILABLE ON ALL MAJOR STREAMING PLATFORMS', width / 2, taglineY, width * 0.9);
    ctx.restore();
  }, [selectedSize, posterPreview, songTitle, artistName, logoUrl]);

  // Live preview
  useEffect(() => {
    if (!posterPreview || !songTitle) return;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    generatePoster(canvas);
  }, [generatePoster, posterPreview, songTitle]);

  const handleDownload = async () => {
    if (!posterPreview || !songTitle) {
      toast.error('Please upload a poster and enter a song title');
      return;
    }
    setGenerating(true);
    try {
      const canvas = document.createElement('canvas');
      await generatePoster(canvas, true);
      const link = document.createElement('a');
      link.download = `${songTitle.replace(/\s+/g, '_')}_${selectedSize}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('Poster downloaded!');
    } catch {
      toast.error('Failed to generate poster');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadAll = async () => {
    if (!posterPreview || !songTitle) {
      toast.error('Please upload a poster and enter a song title');
      return;
    }
    setGenerating(true);
    try {
      for (const key of Object.keys(SIZE_PRESETS)) {
        const prevSize = selectedSize;
        // Temporarily set size for generation
        const preset = SIZE_PRESETS[key];
        const canvas = document.createElement('canvas');
        canvas.width = preset.width;
        canvas.height = preset.height;

        // Generate with this specific size
        const ctx = canvas.getContext('2d')!;
        // Re-run generation logic inline for each size
        setSelectedSize(key);
        await new Promise(r => setTimeout(r, 50));
        await generatePoster(canvas, true);
        
        const link = document.createElement('a');
        link.download = `${songTitle.replace(/\s+/g, '_')}_${key}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        await new Promise(r => setTimeout(r, 300));
      }
      toast.success('All posters downloaded!');
    } catch {
      toast.error('Failed to generate posters');
    } finally {
      setGenerating(false);
    }
  };

  const preset = SIZE_PRESETS[selectedSize];
  const previewAspect = preset ? preset.width / preset.height : 1;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Poster Generator</h1>
          <p className="text-muted-foreground mt-1">Create professional release posters for social media</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form */}
          <div className="glass-card p-5 space-y-5">
            <h2 className="font-display text-lg font-semibold text-foreground">Release Details</h2>

            <div className="space-y-2">
              <Label>Cover Art / Poster</Label>
              <div
                className="relative border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => document.getElementById('poster-upload')?.click()}
              >
                {posterPreview ? (
                  <img src={posterPreview} alt="Cover" className="mx-auto max-h-48 rounded-lg object-contain" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Upload className="h-8 w-8" />
                    <span className="text-sm">Click to upload cover art</span>
                  </div>
                )}
                <input id="poster-upload" type="file" accept="image/*" className="hidden" onChange={handlePosterUpload} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Song Title</Label>
              <Input placeholder="Enter song title" value={songTitle} onChange={e => setSongTitle(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Artist Name</Label>
              <Input placeholder="Enter artist name" value={artistName} onChange={e => setArtistName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Poster Size</Label>
              <Select value={selectedSize} onValueChange={setSelectedSize}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SIZE_PRESETS).map(([key, val]) => (
                    <SelectItem key={key} value={key}>{val.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {logoUrl && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                <img src={logoUrl} alt="Company Logo" className="h-8 w-auto object-contain" />
                <span className="text-sm text-muted-foreground">Company logo will be used</span>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={handleDownload} disabled={generating || !posterPreview || !songTitle} className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                {generating ? 'Generating...' : 'Download Poster'}
              </Button>
              <Button variant="outline" onClick={handleDownloadAll} disabled={generating || !posterPreview || !songTitle} className="flex-1">
                <ImageIcon className="h-4 w-4 mr-2" />
                Download All Sizes
              </Button>
            </div>
          </div>

          {/* Preview */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-foreground">Preview</h2>
              <span className="text-xs text-muted-foreground">{preset?.label}</span>
            </div>
            <div
              className="relative w-full rounded-xl overflow-hidden bg-muted/20 border border-border/50 flex items-center justify-center"
              style={{ aspectRatio: previewAspect, maxHeight: '70vh' }}
            >
              {posterPreview && songTitle ? (
                <canvas
                  ref={previewCanvasRef}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground p-8">
                  <ImageIcon className="h-12 w-12 opacity-30" />
                  <span className="text-sm">Upload cover art and enter details to preview</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
