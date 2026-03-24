import { useState, useRef, useCallback, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PosterCropModal } from '@/components/release/PosterCropModal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Download, Upload, Image as ImageIcon } from 'lucide-react';
import harmonetLogo from '@/assets/harmonet-logo.png';

const SIZE_PRESETS: Record<string, { width: number; height: number; label: string }> = {
  '1-1': { width: 1080, height: 1080, label: 'Square (1:1) — 1080×1080' },
  '3-4': { width: 1080, height: 1440, label: 'Portrait (3:4) — 1080×1440' },
  '4-3': { width: 1440, height: 1080, label: 'Landscape (4:3) — 1440×1080' },
  '16-9': { width: 1920, height: 1080, label: 'Wide (16:9) — 1920×1080' },
  '9-16': { width: 1080, height: 1920, label: 'Tall (9:16) — 1080×1920' },
};

let fontsLoaded = false;
async function ensureFonts() {
  if (fontsLoaded) return;
  const outfitBold = new FontFace('Outfit', 'url(/fonts/Outfit-Bold.ttf)', { weight: '700' });
  const outfitReg = new FontFace('Outfit', 'url(/fonts/Outfit-Regular.ttf)', { weight: '400' });
  const italiana = new FontFace('Italiana', 'url(/fonts/Italiana-Regular.ttf)', { weight: '400' });
  const workBold = new FontFace('Work Sans', 'url(/fonts/WorkSans-Bold.ttf)', { weight: '700' });
  await Promise.all([outfitBold.load(), outfitReg.load(), italiana.load(), workBold.load()]);
  document.fonts.add(outfitBold);
  document.fonts.add(outfitReg);
  document.fonts.add(italiana);
  document.fonts.add(workBold);
  fontsLoaded = true;
}

export default function AdminPosterGenerator() {
  const [songTitle, setSongTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [posterPreview, setPosterPreview] = useState('');
  const [selectedSize, setSelectedSize] = useState('1-1');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Crop modal state
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('company_details').select('logo_url').limit(1).single();
      if (data?.logo_url) setLogoUrl(data.logo_url);
    })();
    ensureFonts();
  }, []);

  const handlePosterUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setRawImageSrc(url);
    setCropModalOpen(true);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const handleCropComplete = (croppedFile: File) => {
    const url = URL.createObjectURL(croppedFile);
    setPosterPreview(url);
    setCropModalOpen(false);
    setRawImageSrc('');
  };

  const handleCropCancel = () => {
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

  // Word-wrap helper (static, no ctx dependency in closure)
  const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number, font: string): string[] => {
    ctx.font = font;
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  };

  const generatePoster = useCallback(async (canvas: HTMLCanvasElement, sizeKey?: string) => {
    await ensureFonts();
    const key = sizeKey || selectedSize;
    const preset = SIZE_PRESETS[key];
    if (!preset || !posterPreview) return;

    const { width, height } = preset;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const minDim = Math.min(width, height);
    const maxDim = Math.max(width, height);
    const pad = minDim * 0.05;
    const isLandscape = width > height;
    const isPortrait = height > width;

    // === BACKGROUND — dark luxury ===
    const grad = ctx.createLinearGradient(0, 0, width * 0.3, height);
    grad.addColorStop(0, '#0a0a0a');
    grad.addColorStop(0.5, '#15101a');
    grad.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Radial glow
    const glowCX = isLandscape ? width * 0.32 : width * 0.5;
    const glowCY = isPortrait ? height * 0.3 : height * 0.42;
    const radGrad = ctx.createRadialGradient(glowCX, glowCY, 0, glowCX, glowCY, minDim * 0.75);
    radGrad.addColorStop(0, 'rgba(107, 21, 21, 0.22)');
    radGrad.addColorStop(0.5, 'rgba(107, 21, 21, 0.05)');
    radGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = radGrad;
    ctx.fillRect(0, 0, width, height);

    // === LOAD IMAGES ===
    let coverImg: HTMLImageElement | null = null;
    let logoImg: HTMLImageElement | null = null;
    try { coverImg = await loadImage(posterPreview); } catch {}
    // Use company logo or fallback to bundled Harmonet logo
    const logoSrc = logoUrl || harmonetLogo;
    try { logoImg = await loadImage(logoSrc); } catch {}

    // === LAYOUT CALCULATIONS per aspect ratio ===
    let coverX: number, coverY: number, coverW: number, coverH: number;
    let textX: number, textY: number, textW: number;
    let logoX: number, logoY: number, logoMaxW: number, logoMaxH: number;
    let bottomReserve: number;

    bottomReserve = minDim * 0.08;

    if (isLandscape) {
      // --- 4:3 and 16:9: Cover left, text right ---
      const safePad = pad * 1.8;
      coverH = height - safePad * 2 - bottomReserve;
      coverW = coverH;
      if (coverW > width * 0.42) coverW = coverH = width * 0.42;
      coverX = safePad;
      coverY = safePad;

      textX = coverX + coverW + safePad;
      textW = width - textX - safePad;
      textY = safePad;

      logoMaxW = textW * 0.5;
      logoMaxH = height * 0.07;
      logoX = textX;
      logoY = safePad;
    } else if (isPortrait) {
      // --- 3:4 and 9:16 ---
      const safePad = pad * 1.5;
      // For 9:16, cover should be smaller relative to height
      const ratio = height / width;
      const coverScale = ratio > 1.5 ? 0.45 : 0.58;
      coverW = width - safePad * 2;
      coverH = coverW;
      if (coverH > height * coverScale) {
        coverH = height * coverScale;
        coverW = coverH; // keep square
      }
      coverX = (width - coverW) / 2;
      coverY = height * 0.1;

      textX = safePad;
      textW = width - safePad * 2;
      textY = coverY + coverH + safePad;

      logoMaxW = width * 0.32;
      logoMaxH = height * 0.035;
      logoX = safePad;
      logoY = safePad;
    } else {
      // --- 1:1 Square ---
      const safePad = pad * 1.5;
      coverW = width * 0.65;
      coverH = coverW;
      coverX = (width - coverW) / 2;
      coverY = height * 0.1;

      textX = safePad;
      textW = width - safePad * 2;
      textY = coverY + coverH + safePad;

      logoMaxW = width * 0.28;
      logoMaxH = height * 0.045;
      logoX = safePad;
      logoY = safePad;
    }

    // === DRAW COVER ART ===
    if (coverImg) {
      const radius = minDim * 0.018;
      ctx.save();
      ctx.shadowColor = 'rgba(107, 21, 21, 0.45)';
      ctx.shadowBlur = minDim * 0.05;
      ctx.shadowOffsetY = minDim * 0.012;
      ctx.beginPath();
      ctx.roundRect(coverX, coverY, coverW, coverH, radius);
      ctx.clip();
      ctx.drawImage(coverImg, coverX, coverY, coverW, coverH);
      ctx.restore();

      // Border
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(coverX, coverY, coverW, coverH, radius);
      ctx.stroke();
      ctx.restore();
    }

    // === LOGO (top-left, or top-right of text area for landscape) ===
    let logoDrawnH = 0;
    if (logoImg) {
      const aspect = logoImg.width / logoImg.height;
      let lw = logoMaxW;
      let lh = lw / aspect;
      if (lh > logoMaxH) { lh = logoMaxH; lw = lh * aspect; }
      logoDrawnH = lh;
      ctx.save();
      ctx.globalAlpha = 0.92;
      ctx.drawImage(logoImg, logoX, logoY, lw, lh);
      ctx.restore();
    }

    // === "NEW RELEASE" text — top right, subtle ===
    const badgeFS = Math.round(minDim * 0.018);
    ctx.save();
    ctx.font = `700 ${badgeFS}px "Work Sans", sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    try { ctx.letterSpacing = `${badgeFS * 0.3}px`; } catch {}
    ctx.fillText('NEW RELEASE', width - pad * 1.5, pad * 1.5 + badgeFS);
    ctx.restore();

    // === TEXT SECTION ===
    // Accent line
    const lineW = minDim * 0.07;
    const lineTh = Math.max(2, minDim * 0.0025);
    let accentY: number;

    if (isLandscape) {
      accentY = textY + logoDrawnH + pad * 1.2;
    } else {
      accentY = textY;
    }

    ctx.save();
    ctx.fillStyle = '#6b1515';
    ctx.fillRect(isLandscape ? textX : textX, accentY, lineW, lineTh);
    ctx.restore();

    // Song title
    const titleFS = isLandscape
      ? Math.round(minDim * 0.058)
      : Math.round(minDim * 0.065);
    const titleFont = `700 ${titleFS}px "Outfit", sans-serif`;
    const titleMaxW = textW;
    const titleLines = wrapText(ctx, songTitle.toUpperCase(), titleMaxW, titleFont);
    const titleLineH = titleFS * 1.15;
    const titleStartY = accentY + lineTh + pad * 0.7 + titleFS;

    // Safety: ensure title doesn't go below the bottom reserve
    const titleEndY = titleStartY + (titleLines.length - 1) * titleLineH;
    const maxTitleEndY = height - bottomReserve - pad * 2;

    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = titleFont;
    titleLines.forEach((line, i) => {
      const y = titleStartY + i * titleLineH;
      if (y < maxTitleEndY) {
        ctx.fillText(line, textX, y, titleMaxW);
      }
    });
    ctx.restore();

    // Artist name
    const artistFS = Math.round(minDim * 0.026);
    const artistY = Math.min(titleEndY + pad * 0.8, maxTitleEndY);
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = `400 ${artistFS}px "Italiana", sans-serif`;
    try { ctx.letterSpacing = `${artistFS * 0.12}px`; } catch {}
    ctx.fillText(artistName.toUpperCase(), textX, artistY, titleMaxW);
    ctx.restore();

    // === BOTTOM SECTION ===
    const bottomY = height - bottomReserve;

    // Separator
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad * 1.5, bottomY);
    ctx.lineTo(width - pad * 1.5, bottomY);
    ctx.stroke();
    ctx.restore();

    // Bottom tagline
    const bottomFS = Math.round(minDim * 0.014);
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = `400 ${bottomFS}px "Outfit", sans-serif`;
    try { ctx.letterSpacing = `${bottomFS * 0.15}px`; } catch {}
    ctx.fillText('AVAILABLE ON ALL MAJOR STREAMING PLATFORMS', pad * 1.5, bottomY + bottomReserve * 0.58);
    ctx.restore();

    // "OUT NOW" pill
    const pillFS = Math.round(minDim * 0.018);
    const pillText = 'OUT NOW';
    ctx.save();
    ctx.font = `700 ${pillFS}px "Outfit", sans-serif`;
    const pillTextW = ctx.measureText(pillText).width;
    const pillPadH = pillFS * 1.2;
    const pillPadV = pillFS * 0.55;
    const pillTotalW = pillTextW + pillPadH * 2;
    const pillTotalH = pillFS + pillPadV * 2;
    const pillX = width - pad * 1.5 - pillTotalW;
    const pillY2 = bottomY + (bottomReserve - pillTotalH) / 2;
    ctx.fillStyle = '#6b1515';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY2, pillTotalW, pillTotalH, pillTotalH / 2);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(pillText, pillX + pillTotalW / 2, pillY2 + pillTotalH / 2);
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
      await generatePoster(canvas);
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
        const canvas = document.createElement('canvas');
        await generatePoster(canvas, key);
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
                    <span className="text-sm">Click to upload cover art (auto-crops to square)</span>
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

            {(logoUrl || harmonetLogo) && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                <img src={logoUrl || harmonetLogo} alt="Logo" className="h-8 w-auto object-contain" />
                <span className="text-sm text-muted-foreground">
                  {logoUrl ? 'Company logo will be used' : 'Harmonet Music logo will be used'}
                </span>
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

      {/* Crop Modal */}
      <PosterCropModal
        open={cropModalOpen}
        imageSrc={rawImageSrc}
        onCropComplete={handleCropComplete}
        onCancel={handleCropCancel}
      />
    </DashboardLayout>
  );
}
