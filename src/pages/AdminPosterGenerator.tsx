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

      // === BACKGROUND: rich dark red/maroon gradient ===
      const bg = ctx.createLinearGradient(0, 0, W * 0.3, H);
      bg.addColorStop(0, '#0e0202');
      bg.addColorStop(0.4, '#280909');
      bg.addColorStop(0.7, '#350d0d');
      bg.addColorStop(1, '#0e0202');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Radial glow
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

      // === LAYOUT ZONES ===
      const sideMargin = 70;
      const topMargin = 55;
      const bottomMargin = 50;

      // --- TOP ROW: Logo + "NEW RELEASES" ---
      const logoH = 90;
      if (logoImg) {
        const logoW = (logoImg.width / logoImg.height) * logoH;
        ctx.drawImage(logoImg, sideMargin, topMargin, logoW, logoH);
      }

      ctx.save();
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 50px "Bricolage Grotesque", sans-serif';
      ctx.fillText('NEW RELEASES', W - sideMargin, topMargin + logoH / 2);
      ctx.restore();

      // --- COVER ART ---
      const coverGap = 40; // gap below top row
      const coverTopY = topMargin + logoH + coverGap;
      const coverPadX = 95;
      const coverSize = W - coverPadX * 2; // ~890px
      const coverX = coverPadX;
      const coverY = coverTopY;
      const radius = 14;

      // White fill
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(coverX, coverY, coverSize, coverSize, radius);
      ctx.fill();
      ctx.restore();

      // Image
      if (coverImg) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(coverX, coverY, coverSize, coverSize, radius);
        ctx.clip();
        ctx.drawImage(coverImg, coverX, coverY, coverSize, coverSize);
        ctx.restore();
      }

      // Subtle border
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(coverX, coverY, coverSize, coverSize, radius);
      ctx.stroke();
      ctx.restore();

      // --- TEXT ZONE: Song Title + Artist ---
      const textGap = 40;
      const textTopY = coverY + coverSize + textGap;
      const maxTextW = W - sideMargin * 2;

      // Bottom zone starts here — "OUT NOW" area
      const outNowH = 85;
      const streamingH = 60;
      const bottomZoneH = Math.max(outNowH, streamingH) + bottomMargin;
      const bottomZoneTopY = H - bottomZoneH;

      // Song Title — premium display font, bold
      const titleUpper = songTitle.trim().toUpperCase();
      let titleRenderedH = 0;

      if (titleUpper) {
        let titleSize = 74;
        for (let s = 74; s >= 30; s -= 2) {
          ctx.font = `700 ${s}px "Bricolage Grotesque", sans-serif`;
          if (ctx.measureText(titleUpper).width <= maxTextW) {
            titleSize = s;
            break;
          }
          titleSize = s;
        }

        ctx.save();
        ctx.font = `700 ${titleSize}px "Bricolage Grotesque", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 14;
        ctx.shadowOffsetY = 4;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(titleUpper, W / 2, textTopY, maxTextW);
        ctx.restore();

        titleRenderedH = titleSize;
      }

      // Artist Name — clean, readable
      const artistText = artistName.trim();
      if (artistText) {
        const artistGapFromTitle = titleUpper ? 20 : 0;
        const artistTopY = textTopY + titleRenderedH + artistGapFromTitle;

        let artistSize = 40;
        for (let s = 40; s >= 20; s -= 2) {
          ctx.font = `400 ${s}px "Bricolage Grotesque", sans-serif`;
          if (ctx.measureText(artistText).width <= maxTextW) {
            artistSize = s;
            break;
          }
          artistSize = s;
        }

        ctx.save();
        ctx.font = `400 ${artistSize}px "Bricolage Grotesque", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillText(artistText, W / 2, artistTopY, maxTextW);
        ctx.restore();
      }

      // --- BOTTOM ROW ---
      // "OUT NOW" — bottom-left, anchored
      ctx.save();
      ctx.font = '700 74px "Bricolage Grotesque", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#ffffff';
      ctx.fillText('OUT NOW', sideMargin, H - bottomMargin);
      ctx.restore();

      // "AVAILABLE ON ALL MAJOR / STREAMING PLATFORMS!" — bottom-right
      ctx.save();
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '700 22px "Instrument Sans", sans-serif';
      ctx.fillText('STREAMING PLATFORMS!', W - sideMargin, H - bottomMargin);
      ctx.fillText('AVAILABLE ON ALL MAJOR', W - sideMargin, H - bottomMargin - 32);
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
