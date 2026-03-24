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
    new FontFace('Bricolage Grotesque', 'url(/fonts/BricolageGrotesque-Bold.ttf)', { weight: '700' }),
    new FontFace('Bricolage Grotesque', 'url(/fonts/BricolageGrotesque-Regular.ttf)', { weight: '400' }),
    new FontFace('Instrument Sans', 'url(/fonts/InstrumentSans-Bold.ttf)', { weight: '700' }),
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

  const fitSingleLineFontSize = (
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    startSize: number,
    minSize: number,
    getFont: (size: number) => string,
  ) => {
    for (let size = startSize; size >= minSize; size -= 1) {
      ctx.font = getFont(size);
      if (ctx.measureText(text).width <= maxWidth) return size;
    }
    return minSize;
  };

  const generatePoster = useCallback(
    async (canvas: HTMLCanvasElement) => {
      await ensureFonts();

      const W = POSTER_W;
      const H = POSTER_H;
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // === BACKGROUND ===
      const bg = ctx.createLinearGradient(0, 0, W * 0.3, H);
      bg.addColorStop(0, '#0e0202');
      bg.addColorStop(0.4, '#280909');
      bg.addColorStop(0.7, '#350d0d');
      bg.addColorStop(1, '#0e0202');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const glow = ctx.createRadialGradient(W * 0.5, H * 0.35, 0, W * 0.5, H * 0.35, W * 0.75);
      glow.addColorStop(0, 'rgba(140, 25, 25, 0.22)');
      glow.addColorStop(0.5, 'rgba(90, 15, 15, 0.06)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);

      // === LOAD IMAGES ===
      let coverImg: HTMLImageElement | null = null;
      let logoImg: HTMLImageElement | null = null;
      try { coverImg = await loadImage(posterPreview); } catch {}
      try { logoImg = await loadImage(harmonetLogoWhite); } catch {}

      // === STRICT ZONE LAYOUT (1080 x 1350) ===
      // Zone 1: Top row       y: 0   → 140   (140px)
      // Zone 2: Cover art     y: 140 → 890   (750px)
      // Zone 3: Title/Artist  y: 920 → 1140  (220px)
      // Zone 4: Bottom row    y: 1200 → 1350 (150px)

      const M = 70; // side margin

      // --- ZONE 1: Logo + NEW RELEASES (y: 30 to 130) ---
      if (logoImg) {
        const lh = 80;
        const lw = (logoImg.width / logoImg.height) * lh;
        ctx.drawImage(logoImg, M, 35, lw, lh);
      }

      ctx.save();
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 48px "Outfit", sans-serif';
      ctx.fillText('NEW RELEASES', W - M, 75);
      ctx.restore();

      // --- ZONE 2: Cover art (y: 150 to 900) ---
      const coverSize = 750;
      const coverX = (W - coverSize) / 2;
      const coverY = 148;
      const radius = 14;

      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(coverX, coverY, coverSize, coverSize, radius);
      ctx.fill();
      ctx.restore();

      if (coverImg) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(coverX, coverY, coverSize, coverSize, radius);
        ctx.clip();
        ctx.drawImage(coverImg, coverX, coverY, coverSize, coverSize);
        ctx.restore();
      }

      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(coverX, coverY, coverSize, coverSize, radius);
      ctx.stroke();
      ctx.restore();

      // --- ZONE 3: Song Title + Artist (y: 930 to 1160) ---
      const maxTitleW = W - M * 2;
      const maxArtistW = W - M * 2 - 40;

      const titleUpper = songTitle.trim().toUpperCase();
      let titleH = 0;

      if (titleUpper) {
        const sz = fitSingleLineFontSize(
          ctx,
          titleUpper,
          maxTitleW,
          72,
          16,
          (size) => `700 ${size}px "Outfit", sans-serif`,
        );

        ctx.save();
        ctx.font = `700 ${sz}px "Outfit", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 3;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(titleUpper, W / 2, 940);
        ctx.restore();
        titleH = sz;
      }

      const artistText = artistName.trim();
      if (artistText) {
        const artistY = 940 + titleH + (titleUpper ? 18 : 0);
        const sz = fitSingleLineFontSize(
          ctx,
          artistText,
          maxArtistW,
          38,
          12,
          (size) => `400 ${size}px "Outfit", sans-serif`,
        );

        ctx.save();
        ctx.font = `400 ${sz}px "Outfit", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 6;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillText(artistText, W / 2, artistY);
        ctx.restore();
      }

      // --- ZONE 4: Bottom row (y: ~1210 to 1310) ---
      ctx.save();
      ctx.font = '700 70px "Outfit", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#ffffff';
      ctx.fillText('OUT NOW', M, H - 50);
      ctx.restore();

      ctx.save();
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '700 22px "Outfit", sans-serif';
      ctx.fillText('STREAMING PLATFORMS!', W - M, H - 50);
      ctx.fillText('AVAILABLE ON ALL MAJOR', W - M, H - 80);
      ctx.restore();
    },
    [posterPreview, songTitle, artistName],
  );

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    const run = async () => {
      await generatePoster(canvas);
      // Re-draw once more after a brief delay to catch async image loads
      if (!cancelled) {
        await new Promise((r) => setTimeout(r, 100));
        if (!cancelled) await generatePoster(canvas);
      }
    };
    run();
    return () => { cancelled = true; };
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
      const nameParts = [songTitle.trim(), artistName.trim()].filter(Boolean).join(' - ') || 'poster';
      link.download = `${nameParts.replace(/\s+/g, '_')}.png`;
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
                {(posterPreview || songTitle || artistName) ? (
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
