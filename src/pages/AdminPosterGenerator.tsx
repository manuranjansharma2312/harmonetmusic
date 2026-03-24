import { useState, useRef, useCallback, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PosterCropModal } from '@/components/release/PosterCropModal';
import { toast } from 'sonner';
import { Download, Upload, Image as ImageIcon } from 'lucide-react';
import harmonetLogo from '@/assets/harmonet-logo.png';
import harmonetLogoWhite from '@/assets/harmonet-logo-white.png';

// Fixed poster size matching the template
const POSTER_W = 1080;
const POSTER_H = 1350;

let fontsLoaded = false;

async function ensureFonts() {
  if (fontsLoaded) return;
  const fonts = [
    new FontFace('Outfit', 'url(/fonts/Outfit-Bold.ttf)', { weight: '700' }),
    new FontFace('Outfit', 'url(/fonts/Outfit-Regular.ttf)', { weight: '400' }),
    new FontFace('Work Sans', 'url(/fonts/WorkSans-Bold.ttf)', { weight: '700' }),
  ];
  await Promise.all(fonts.map((f) => f.load()));
  fonts.forEach((f) => document.fonts.add(f));
  fontsLoaded = true;
}

export default function AdminPosterGenerator() {
  const [songTitle, setSongTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [posterPreview, setPosterPreview] = useState('');
  const [generating, setGenerating] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState('');
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => { ensureFonts(); }, []);

  const handlePosterUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRawImageSrc(URL.createObjectURL(file));
    setCropModalOpen(true);
    e.target.value = '';
  };

  const handleCropComplete = (croppedFile: File) => {
    setPosterPreview(URL.createObjectURL(croppedFile));
    setCropModalOpen(false);
    setRawImageSrc('');
  };

  const loadImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  const generatePoster = useCallback(
    async (canvas: HTMLCanvasElement) => {
      await ensureFonts();
      if (!posterPreview) return;

      const W = POSTER_W;
      const H = POSTER_H;
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // === BACKGROUND: dark red/maroon gradient ===
      const bg = ctx.createLinearGradient(0, 0, W * 0.5, H);
      bg.addColorStop(0, '#1a0505');
      bg.addColorStop(0.35, '#2d0a0a');
      bg.addColorStop(0.65, '#3a0e0e');
      bg.addColorStop(1, '#1a0505');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Radial glow in center
      const glow = ctx.createRadialGradient(W * 0.5, H * 0.38, 0, W * 0.5, H * 0.38, W * 0.7);
      glow.addColorStop(0, 'rgba(120, 20, 20, 0.25)');
      glow.addColorStop(0.6, 'rgba(80, 12, 12, 0.08)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);

      // === LOAD IMAGES ===
      let coverImg: HTMLImageElement | null = null;
      let logoImg: HTMLImageElement | null = null;
      try { coverImg = await loadImage(posterPreview); } catch {}
      try { logoImg = await loadImage(harmonetLogoWhite); } catch {}

      const margin = 60;

      // === TOP SECTION (y: 0 → ~180) ===
      // Logo top-left
      if (logoImg) {
        const logoH = 100;
        const logoW = (logoImg.width / logoImg.height) * logoH;
        ctx.save();
        ctx.globalAlpha = 0.95;
        ctx.drawImage(logoImg, margin, margin, logoW, logoH);
        ctx.restore();
      }

      // "NEW RELEASES" top-right — large bold
      ctx.save();
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 58px "Outfit", sans-serif';
      ctx.fillText('NEW RELEASES', W - margin, margin + 65);
      ctx.restore();

      // === COVER ART AREA (centered white rounded rect) ===
      const coverMarginX = 80;
      const coverTop = 200;
      const coverSize = W - coverMarginX * 2; // 920px square
      const coverX = coverMarginX;
      const coverY = coverTop;
      const radius = 20;

      // White background for cover area
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(coverX, coverY, coverSize, coverSize, radius);
      ctx.fill();
      ctx.restore();

      // Draw cover image inside the white rect
      if (coverImg) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(coverX, coverY, coverSize, coverSize, radius);
        ctx.clip();
        ctx.drawImage(coverImg, coverX, coverY, coverSize, coverSize);
        ctx.restore();
      }

      // Subtle border on cover
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(coverX, coverY, coverSize, coverSize, radius);
      ctx.stroke();
      ctx.restore();

      // === SONG TITLE & ARTIST (below cover) ===
      const textAreaTop = coverY + coverSize + 30;
      const textAreaBottom = H - 160; // reserve space for bottom section
      const availableTextH = textAreaBottom - textAreaTop;

      if (songTitle.trim()) {
        // Song title - large bold
        const maxTitleSize = 52;
        const minTitleSize = 28;
        const titleUpper = songTitle.trim().toUpperCase();
        let titleSize = maxTitleSize;
        
        for (let s = maxTitleSize; s >= minTitleSize; s -= 2) {
          ctx.font = `700 ${s}px "Outfit", sans-serif`;
          if (ctx.measureText(titleUpper).width <= W - margin * 2) {
            titleSize = s;
            break;
          }
          titleSize = s;
        }

        ctx.save();
        ctx.font = `700 ${titleSize}px "Outfit", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(titleUpper, W / 2, textAreaTop + titleSize, W - margin * 2);
        ctx.restore();

        // Artist name below song title
        if (artistName.trim()) {
          const artistUpper = artistName.trim().toUpperCase();
          const artistSize = Math.max(22, Math.min(32, titleSize - 14));
          ctx.save();
          ctx.font = `400 ${artistSize}px "Outfit", sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.fillText(artistUpper, W / 2, textAreaTop + titleSize + artistSize + 12, W - margin * 2);
          ctx.restore();
        }
      }

      // === BOTTOM SECTION ===
      const bottomY = H - 120;

      // "OUT NOW" - large bold, bottom-left
      ctx.save();
      ctx.font = '700 72px "Outfit", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('OUT NOW', margin, bottomY + 10);
      ctx.restore();

      // "AVAILABLE ON ALL MAJOR STREAMING PLATFORMS!" - bottom-right
      ctx.save();
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '700 22px "Outfit", sans-serif';
      ctx.fillText('AVAILABLE ON ALL MAJOR', W - margin, bottomY - 18);
      ctx.fillText('STREAMING PLATFORMS!', W - margin, bottomY + 12);
      ctx.restore();
    },
    [posterPreview, songTitle, artistName],
  );

  useEffect(() => {
    if (!posterPreview) return;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    generatePoster(canvas);
  }, [generatePoster, posterPreview, songTitle, artistName]);

  const handleDownload = async () => {
    if (!posterPreview) {
      toast.error('Please upload a poster image');
      return;
    }
    setGenerating(true);
    try {
      const canvas = document.createElement('canvas');
      await generatePoster(canvas);
      const link = document.createElement('a');
      link.download = `${(songTitle || 'poster').replace(/\s+/g, '_')}_poster.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('Poster downloaded!');
    } catch {
      toast.error('Failed to generate poster');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Poster Generator</h1>
          <p className="mt-1 text-muted-foreground">Create professional release posters</p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="glass-card space-y-5 p-5">
            <h2 className="font-display text-lg font-semibold text-foreground">Release Details</h2>

            <div className="space-y-2">
              <Label>Cover Art / Poster</Label>
              <div
                className="relative cursor-pointer rounded-xl border-2 border-dashed border-border p-6 text-center transition-colors hover:border-primary/50"
                onClick={() => document.getElementById('poster-upload')?.click()}
              >
                {posterPreview ? (
                  <img src={posterPreview} alt="Cover" className="mx-auto max-h-48 rounded-lg object-contain" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Upload className="h-8 w-8" />
                    <span className="text-sm">Click to upload cover art (auto-crops to square)</span>
                  </div>
                )}
                <input id="poster-upload" type="file" accept="image/*" className="hidden" onChange={handlePosterUpload} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Song Title</Label>
              <Input placeholder="Enter song title" value={songTitle} onChange={(e) => setSongTitle(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Artist Name</Label>
              <Input placeholder="Enter artist name" value={artistName} onChange={(e) => setArtistName(e.target.value)} />
            </div>

            <div className="flex items-center gap-3 rounded-lg bg-muted/30 p-3">
              <img src={harmonetLogo} alt="Harmonet Music" className="h-8 w-auto object-contain" />
              <span className="text-sm text-muted-foreground">Harmonet Music logo is included on the poster</span>
            </div>

            <Button onClick={handleDownload} disabled={generating || !posterPreview} className="w-full">
              <Download className="mr-2 h-4 w-4" />
              {generating ? 'Generating...' : 'Download Poster'}
            </Button>
          </div>

          <div className="glass-card space-y-4 p-5">
            <h2 className="font-display text-lg font-semibold text-foreground">Preview</h2>
            <div
              className="relative flex w-full items-center justify-center overflow-hidden rounded-xl border border-border/50 bg-muted/20"
              style={{ aspectRatio: POSTER_W / POSTER_H, maxHeight: '70vh' }}
            >
              {posterPreview ? (
                <canvas ref={previewCanvasRef} className="h-full w-full object-contain" />
              ) : (
                <div className="flex flex-col items-center gap-2 p-8 text-muted-foreground">
                  <ImageIcon className="h-12 w-12 opacity-30" />
                  <span className="text-sm">Upload cover art to preview</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <PosterCropModal
        open={cropModalOpen}
        imageSrc={rawImageSrc}
        onCropComplete={handleCropComplete}
        onCancel={() => {
          setCropModalOpen(false);
          setRawImageSrc('');
        }}
      />
    </DashboardLayout>
  );
}
