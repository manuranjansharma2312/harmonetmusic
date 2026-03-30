import { useState, useRef, useCallback, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PosterCropModal } from '@/components/release/PosterCropModal';
import { toast } from 'sonner';
import { Download, Upload, Image as ImageIcon } from 'lucide-react';
import harmonetLogoWhite from '@/assets/harmonet-logo-white.png';

const POSTER_W = 1080;
const POSTER_H = 1350;

let fontsLoaded = false;

async function ensureFonts() {
  if (fontsLoaded) return;

  const fonts = [
    new FontFace('Outfit', 'url(/fonts/Outfit-Bold.ttf)', { weight: '700' }),
    new FontFace('Outfit', 'url(/fonts/Outfit-Regular.ttf)', { weight: '400' }),
  ];

  await Promise.all(fonts.map((font) => font.load()));
  fonts.forEach((font) => document.fonts.add(font));
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
  const imageCacheRef = useRef(new Map<string, HTMLImageElement>());
  const previewFrameRef = useRef<number | null>(null);

  useEffect(() => {
    ensureFonts();
  }, []);

  useEffect(() => {
    return () => {
      if (previewFrameRef.current) {
        cancelAnimationFrame(previewFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (rawImageSrc.startsWith('blob:')) URL.revokeObjectURL(rawImageSrc);
    };
  }, [rawImageSrc]);

  useEffect(() => {
    return () => {
      if (posterPreview.startsWith('blob:')) URL.revokeObjectURL(posterPreview);
    };
  }, [posterPreview]);

  const handlePosterUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (rawImageSrc.startsWith('blob:')) URL.revokeObjectURL(rawImageSrc);
    setRawImageSrc(URL.createObjectURL(file));
    setCropModalOpen(true);
    e.target.value = '';
  };

  const handleCropComplete = (croppedFile: File) => {
    if (posterPreview.startsWith('blob:')) URL.revokeObjectURL(posterPreview);
    setPosterPreview(URL.createObjectURL(croppedFile));
    setCropModalOpen(false);
    setRawImageSrc('');
  };

  const loadImage = useCallback((src: string): Promise<HTMLImageElement> => {
    if (!src) return Promise.reject(new Error('Missing image source'));

    const cached = imageCacheRef.current.get(src);
    if (cached) return Promise.resolve(cached);

    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imageCacheRef.current.set(src, img);
        resolve(img);
      };
      img.onerror = reject;
      img.src = src;
    });
  }, []);

  const fitSingleLineFontSize = useCallback(
    (
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
    },
    [],
  );

  const generatePoster = useCallback(
    async (canvas: HTMLCanvasElement) => {
      await ensureFonts();

      const W = POSTER_W;
      const H = POSTER_H;
      canvas.width = W;
      canvas.height = H;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

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

      let coverImg: HTMLImageElement | null = null;
      let logoImg: HTMLImageElement | null = null;

      if (posterPreview) {
        try {
          coverImg = await loadImage(posterPreview);
        } catch {
          coverImg = null;
        }
      }

      try {
        logoImg = await loadImage(harmonetLogoWhite);
      } catch {
        logoImg = null;
      }

      const sideMargin = 70;
      const topRowY = 35;
      const topRowHeight = 95;
      const coverSize = 750;
      const coverX = (W - coverSize) / 2;
      const coverY = 148;
      const radius = 14;
      const textTopY = 940;
      const bottomRowY = H - 50;
      const maxTitleW = W - sideMargin * 2;
      const maxArtistW = W - sideMargin * 2 - 40;

      if (logoImg) {
        const logoHeight = 80;
        const logoWidth = (logoImg.width / logoImg.height) * logoHeight;
        ctx.drawImage(logoImg, sideMargin, topRowY, logoWidth, logoHeight);
      }

      ctx.save();
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 48px "Outfit", sans-serif';
      ctx.fillText('NEW RELEASES', W - sideMargin, topRowY + topRowHeight / 2 - 8);
      ctx.restore();

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
      } else {
        ctx.save();
        ctx.fillStyle = 'rgba(10,10,10,0.12)';
        ctx.beginPath();
        ctx.roundRect(coverX, coverY, coverSize, coverSize, radius);
        ctx.fill();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = '400 28px "Outfit", sans-serif';
        ctx.fillText('UPLOAD COVER ART', W / 2, coverY + coverSize / 2);
        ctx.restore();
      }

      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(coverX, coverY, coverSize, coverSize, radius);
      ctx.stroke();
      ctx.restore();

      const titleUpper = songTitle.trim().toUpperCase();
      let titleHeight = 0;

      if (titleUpper) {
        const titleSize = fitSingleLineFontSize(
          ctx,
          titleUpper,
          maxTitleW,
          72,
          16,
          (size) => `700 ${size}px "Outfit", sans-serif`,
        );

        ctx.save();
        ctx.font = `700 ${titleSize}px "Outfit", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 3;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(titleUpper, W / 2, textTopY);
        ctx.restore();

        titleHeight = titleSize;
      }

      const artistText = artistName.trim();
      if (artistText) {
        const artistY = textTopY + titleHeight + (titleUpper ? 18 : 0);
        const artistSize = fitSingleLineFontSize(
          ctx,
          artistText,
          maxArtistW,
          38,
          12,
          (size) => `400 ${size}px "Outfit", sans-serif`,
        );

        ctx.save();
        ctx.font = `400 ${artistSize}px "Outfit", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 6;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillText(artistText, W / 2, artistY);
        ctx.restore();
      }

      ctx.save();
      ctx.font = '700 70px "Outfit", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#ffffff';
      ctx.fillText('OUT NOW', sideMargin, bottomRowY);
      ctx.restore();

      ctx.save();
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '700 22px "Outfit", sans-serif';
      ctx.fillText('STREAMING PLATFORMS!', W - sideMargin, bottomRowY);
      ctx.fillText('AVAILABLE ON ALL MAJOR', W - sideMargin, bottomRowY - 30);
      ctx.restore();
    },
    [artistName, fitSingleLineFontSize, loadImage, posterPreview, songTitle],
  );

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    if (!posterPreview && !songTitle && !artistName) return;

    if (previewFrameRef.current) {
      cancelAnimationFrame(previewFrameRef.current);
    }

    previewFrameRef.current = requestAnimationFrame(() => {
      generatePoster(canvas);
    });

    return () => {
      if (previewFrameRef.current) {
        cancelAnimationFrame(previewFrameRef.current);
        previewFrameRef.current = null;
      }
    };
  }, [artistName, generatePoster, posterPreview, songTitle]);

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

  const hasPreview = Boolean(posterPreview || songTitle || artistName);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Out Now Poster Generator</h1>
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
              {hasPreview ? (
                <canvas ref={previewCanvasRef} className="h-full w-full object-contain" />
              ) : (
                <div className="flex flex-col items-center gap-2 p-8 text-muted-foreground">
                  <ImageIcon className="h-12 w-12 opacity-30" />
                  <span className="text-sm">Upload cover art or enter text to preview</span>
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
