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

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, font: string): string[] {
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
}

export default function AdminPosterGenerator() {
  const [songTitle, setSongTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [posterPreview, setPosterPreview] = useState('');
  const [selectedSize, setSelectedSize] = useState('1-1');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
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
    const isLandscape = width > height;
    const isPortrait = height > width;

    // ─── BACKGROUND ─────────────────────────────────
    const grad = ctx.createLinearGradient(0, 0, width * 0.4, height);
    grad.addColorStop(0, '#0a0a0a');
    grad.addColorStop(0.5, '#120e16');
    grad.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Radial glow
    const glowCX = isLandscape ? width * 0.3 : width * 0.5;
    const glowCY = isPortrait ? height * 0.28 : height * 0.4;
    const rg = ctx.createRadialGradient(glowCX, glowCY, 0, glowCX, glowCY, minDim * 0.8);
    rg.addColorStop(0, 'rgba(107,21,21,0.20)');
    rg.addColorStop(0.5, 'rgba(107,21,21,0.04)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, width, height);

    // ─── LOAD IMAGES ─────────────────────────────────
    let coverImg: HTMLImageElement | null = null;
    let logoImg: HTMLImageElement | null = null;
    try { coverImg = await loadImage(posterPreview); } catch {}
    try { logoImg = await loadImage(logoUrl || harmonetLogo); } catch {}

    // ─── SPACING SYSTEM ──────────────────────────────
    const margin = minDim * 0.055;
    const bottomBarH = minDim * 0.07;
    const usableH = height - margin * 2 - bottomBarH;

    // ─── LOGO SIZE (big, on white pill) ──────────────
    const logoH = minDim * 0.06;
    const logoPadH = logoH * 0.3; // vertical padding inside pill
    const logoPadW = logoH * 0.4; // horizontal padding inside pill
    const logoPillH = logoH + logoPadH * 2;

    // ─── LAYOUT per size ─────────────────────────────
    let coverX: number, coverY: number, coverS: number;
    let textX: number, textY: number, textW: number;
    let logoX: number, logoY: number;

    if (isLandscape) {
      // 4:3 or 16:9 — cover left, text right
      coverS = Math.min(usableH, width * 0.38);
      coverX = margin;
      coverY = margin;
      const rightStart = coverX + coverS + margin;
      textX = rightStart;
      textW = width - rightStart - margin;
      // Logo top of text area
      logoX = textX;
      logoY = margin;
      textY = logoY + logoPillH + margin * 0.8;
    } else if (isPortrait) {
      // 3:4 or 9:16
      const ratio = height / width;
      // 9:16 needs smaller cover to leave room for text
      const coverFraction = ratio > 1.6 ? 0.42 : 0.55;
      coverS = Math.min(width - margin * 2, usableH * coverFraction);
      coverX = (width - coverS) / 2;
      // Logo at top
      logoX = margin;
      logoY = margin;
      coverY = logoY + logoPillH + margin * 0.6;
      textX = margin;
      textW = width - margin * 2;
      textY = coverY + coverS + margin;
    } else {
      // 1:1 square
      coverS = width * 0.58;
      coverX = (width - coverS) / 2;
      logoX = margin;
      logoY = margin;
      coverY = logoY + logoPillH + margin * 0.5;
      textX = margin;
      textW = width - margin * 2;
      textY = coverY + coverS + margin * 0.8;
    }

    // ─── DRAW COVER ART ──────────────────────────────
    if (coverImg) {
      const r = minDim * 0.015;
      ctx.save();
      ctx.shadowColor = 'rgba(107,21,21,0.4)';
      ctx.shadowBlur = minDim * 0.04;
      ctx.shadowOffsetY = minDim * 0.01;
      ctx.beginPath();
      ctx.roundRect(coverX, coverY, coverS, coverS, r);
      ctx.clip();
      ctx.drawImage(coverImg, coverX, coverY, coverS, coverS);
      ctx.restore();
      // border
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(coverX, coverY, coverS, coverS, r);
      ctx.stroke();
      ctx.restore();
    }

    // ─── LOGO on white pill ──────────────────────────
    if (logoImg) {
      const aspect = logoImg.width / logoImg.height;
      let lh = logoH;
      let lw = lh * aspect;
      const maxLW = isLandscape ? textW * 0.7 : width * 0.45;
      if (lw > maxLW) { lw = maxLW; lh = lw / aspect; }
      const pillW = lw + logoPadW * 2;
      const pillH2 = lh + logoPadH * 2;
      const pillR = pillH2 * 0.2;
      // White pill background
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.roundRect(logoX, logoY, pillW, pillH2, pillR);
      ctx.fill();
      ctx.restore();
      // Draw logo inside pill
      ctx.drawImage(logoImg, logoX + logoPadW, logoY + logoPadH, lw, lh);
    }

    // ─── "NEW RELEASE" badge — top right ─────────────
    const badgeFS = Math.round(minDim * 0.016);
    ctx.save();
    ctx.font = `700 ${badgeFS}px "Work Sans", sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    try { ctx.letterSpacing = `${badgeFS * 0.3}px`; } catch {}
    ctx.fillText('NEW RELEASE', width - margin, margin + badgeFS);
    ctx.restore();

    // ─── ACCENT LINE ─────────────────────────────────
    const lineW = minDim * 0.06;
    const lineTh = Math.max(2.5, minDim * 0.003);
    ctx.save();
    ctx.fillStyle = '#6b1515';
    ctx.fillRect(textX, textY, lineW, lineTh);
    ctx.restore();

    // ─── SONG TITLE ──────────────────────────────────
    const titleFS = isLandscape
      ? Math.round(minDim * 0.06)
      : Math.round(minDim * 0.07);
    const titleFont = `700 ${titleFS}px "Outfit", sans-serif`;
    const titleLines = wrapText(ctx, songTitle.toUpperCase(), textW, titleFont);
    const titleLH = titleFS * 1.18;
    const titleStartY = textY + lineTh + margin * 0.5 + titleFS;

    // Clamp: don't draw below bottom bar
    const maxTextBottom = height - bottomBarH - margin * 0.5;

    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = titleFont;
    titleLines.forEach((line, i) => {
      const y = titleStartY + i * titleLH;
      if (y < maxTextBottom) ctx.fillText(line, textX, y, textW);
    });
    ctx.restore();

    // ─── ARTIST NAME ─────────────────────────────────
    const lastTitleY = titleStartY + (titleLines.length - 1) * titleLH;
    const artistFS = Math.round(minDim * 0.03);
    const artistY = Math.min(lastTitleY + margin * 0.7, maxTextBottom - artistFS);

    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `400 ${artistFS}px "Italiana", sans-serif`;
    try { ctx.letterSpacing = `${artistFS * 0.12}px`; } catch {}
    ctx.fillText(artistName.toUpperCase(), textX, artistY, textW);
    ctx.restore();

    // ─── BOTTOM BAR ──────────────────────────────────
    const bottomY = height - bottomBarH;

    // Separator line
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin, bottomY);
    ctx.lineTo(width - margin, bottomY);
    ctx.stroke();
    ctx.restore();

    // "OUT NOW" pill — bottom right
    const pillFS = Math.round(minDim * 0.02);
    ctx.save();
    ctx.font = `700 ${pillFS}px "Outfit", sans-serif`;
    const pillText = 'OUT NOW';
    const ptw = ctx.measureText(pillText).width;
    const pW = ptw + pillFS * 2;
    const pH = pillFS * 2.2;
    const pX = width - margin - pW;
    const pY = bottomY + (bottomBarH - pH) / 2;
    ctx.fillStyle = '#6b1515';
    ctx.beginPath();
    ctx.roundRect(pX, pY, pW, pH, pH / 2);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(pillText, pX + pW / 2, pY + pH / 2);
    ctx.restore();

    // Bottom tagline — left of pill
    const tagFS = Math.round(minDim * 0.013);
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.font = `400 ${tagFS}px "Outfit", sans-serif`;
    try { ctx.letterSpacing = `${tagFS * 0.15}px`; } catch {}
    const tagMaxW = pX - margin * 2;
    ctx.fillText('AVAILABLE ON ALL MAJOR STREAMING PLATFORMS', margin, bottomY + bottomBarH / 2, tagMaxW);
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
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SIZE_PRESETS).map(([key, val]) => (
                    <SelectItem key={key} value={key}>{val.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <img src={logoUrl || harmonetLogo} alt="Logo" className="h-8 w-auto object-contain" />
              <span className="text-sm text-muted-foreground">
                {logoUrl ? 'Company logo will be used' : 'Harmonet Music logo will be used'}
              </span>
            </div>

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
                <canvas ref={previewCanvasRef} className="w-full h-full object-contain" />
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

      <PosterCropModal
        open={cropModalOpen}
        imageSrc={rawImageSrc}
        onCropComplete={handleCropComplete}
        onCancel={() => { setCropModalOpen(false); setRawImageSrc(''); }}
      />
    </DashboardLayout>
  );
}
