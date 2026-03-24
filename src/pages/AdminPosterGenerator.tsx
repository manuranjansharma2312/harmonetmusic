import { useState, useRef, useCallback, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Download, Upload, Image as ImageIcon } from 'lucide-react';

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
    const pad = minDim * 0.06;
    const isLandscape = width > height;
    const isPortrait = height > width;

    // === BACKGROUND ===
    // Dark luxurious gradient
    const grad = ctx.createLinearGradient(0, 0, width * 0.3, height);
    grad.addColorStop(0, '#0d0d0d');
    grad.addColorStop(0.5, '#1a1118');
    grad.addColorStop(1, '#0d0d0d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Subtle radial glow behind the art
    const glowCX = isLandscape ? width * 0.35 : width * 0.5;
    const glowCY = isPortrait ? height * 0.32 : height * 0.45;
    const glowR = minDim * 0.7;
    const radGrad = ctx.createRadialGradient(glowCX, glowCY, 0, glowCX, glowCY, glowR);
    radGrad.addColorStop(0, 'rgba(107, 21, 21, 0.25)');
    radGrad.addColorStop(0.6, 'rgba(107, 21, 21, 0.06)');
    radGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = radGrad;
    ctx.fillRect(0, 0, width, height);

    // === LOAD IMAGES ===
    let coverImg: HTMLImageElement | null = null;
    let logoImg: HTMLImageElement | null = null;
    try { coverImg = await loadImage(posterPreview); } catch {}
    if (logoUrl) try { logoImg = await loadImage(logoUrl); } catch {}

    // === LAYOUT ===
    let coverX: number, coverY: number, coverW: number, coverH: number;
    let textAreaX: number, textAreaY: number, textAreaW: number;
    let logoDrawX: number, logoDrawY: number, logoMaxW: number, logoMaxH: number;

    if (isLandscape) {
      // Cover on left, text on right
      coverH = height - pad * 4;
      coverW = coverH; // square cover
      coverX = pad * 2;
      coverY = pad * 2;
      textAreaX = coverX + coverW + pad * 2;
      textAreaW = width - textAreaX - pad * 2;
      textAreaY = coverY;
      logoMaxW = textAreaW * 0.45;
      logoMaxH = height * 0.06;
      logoDrawX = textAreaX;
      logoDrawY = pad * 2;
    } else if (isPortrait) {
      // Cover centered top, text below
      coverW = width - pad * 4;
      coverH = coverW; // square cover
      coverX = pad * 2;
      coverY = height * 0.08;
      textAreaX = pad * 2;
      textAreaW = width - pad * 4;
      textAreaY = coverY + coverH + pad * 1.5;
      logoMaxW = width * 0.3;
      logoMaxH = height * 0.035;
      logoDrawX = pad * 2;
      logoDrawY = pad * 1.2;
    } else {
      // Square
      coverW = width * 0.7;
      coverH = coverW;
      coverX = (width - coverW) / 2;
      coverY = height * 0.1;
      textAreaX = pad * 2;
      textAreaW = width - pad * 4;
      textAreaY = coverY + coverH + pad * 1.2;
      logoMaxW = width * 0.25;
      logoMaxH = height * 0.045;
      logoDrawX = pad * 2;
      logoDrawY = pad * 1.2;
    }

    // === DRAW COVER ART ===
    if (coverImg) {
      const radius = minDim * 0.02;
      // Shadow
      ctx.save();
      ctx.shadowColor = 'rgba(107, 21, 21, 0.5)';
      ctx.shadowBlur = minDim * 0.06;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = minDim * 0.015;
      ctx.beginPath();
      ctx.roundRect(coverX, coverY, coverW, coverH, radius);
      ctx.clip();
      ctx.drawImage(coverImg, coverX, coverY, coverW, coverH);
      ctx.restore();

      // Subtle border
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(coverX, coverY, coverW, coverH, radius);
      ctx.stroke();
      ctx.restore();
    }

    // === LOGO ===
    if (logoImg) {
      const aspect = logoImg.width / logoImg.height;
      let lw = logoMaxW;
      let lh = lw / aspect;
      if (lh > logoMaxH) { lh = logoMaxH; lw = lh * aspect; }
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.drawImage(logoImg, logoDrawX, logoDrawY, lw, lh);
      ctx.restore();
    }

    // === "NEW RELEASE" BADGE ===
    const badgeFontSize = Math.round(minDim * 0.022);
    ctx.save();
    ctx.font = `700 ${badgeFontSize}px "Work Sans", sans-serif`;
    ctx.letterSpacing = `${badgeFontSize * 0.35}px`;
    const badgeText = 'NEW RELEASE';
    if (isLandscape) {
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillText(badgeText, width - pad * 2, pad * 2.5);
    } else {
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillText(badgeText, width - pad * 2, pad * 2);
    }
    ctx.restore();

    // === ACCENT LINE ===
    const lineWidth = minDim * 0.08;
    const lineThickness = Math.max(2, minDim * 0.003);
    if (isLandscape) {
      const lineY = textAreaY + (logoImg ? logoMaxH + pad * 1.5 : pad);
      ctx.save();
      ctx.fillStyle = '#6b1515';
      ctx.fillRect(textAreaX, lineY, lineWidth, lineThickness);
      ctx.restore();
    } else {
      const lineY = textAreaY - pad * 0.5;
      ctx.save();
      ctx.fillStyle = '#6b1515';
      ctx.fillRect(textAreaX, lineY, lineWidth, lineThickness);
      ctx.restore();
    }

    // === SONG TITLE ===
    const titleMaxWidth = isLandscape ? textAreaW - pad : textAreaW;
    const titleFontSize = Math.round(minDim * 0.065);

    // Word-wrap helper
    const wrapText = (text: string, maxWidth: number, font: string): string[] => {
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

    const titleFont = `700 ${titleFontSize}px "Outfit", sans-serif`;
    const titleLines = wrapText(songTitle.toUpperCase(), titleMaxWidth, titleFont);

    let titleStartY: number;
    if (isLandscape) {
      titleStartY = textAreaY + (logoImg ? logoMaxH + pad * 2.5 : pad * 2) + lineThickness;
    } else {
      titleStartY = textAreaY + pad * 0.5;
    }

    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = titleFont;
    const titleLineHeight = titleFontSize * 1.15;
    titleLines.forEach((line, i) => {
      ctx.fillText(line, isLandscape ? textAreaX : textAreaX, titleStartY + i * titleLineHeight);
    });
    ctx.restore();

    // === ARTIST NAME ===
    const artistFontSize = Math.round(minDim * 0.028);
    const artistY = titleStartY + titleLines.length * titleLineHeight + pad * 0.6;
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `400 ${artistFontSize}px "Italiana", sans-serif`;
    ctx.letterSpacing = `${artistFontSize * 0.15}px`;
    ctx.fillText(artistName.toUpperCase(), isLandscape ? textAreaX : textAreaX, artistY, titleMaxWidth);
    ctx.restore();

    // === BOTTOM BAR ===
    const bottomBarH = minDim * 0.06;
    const bottomY = height - bottomBarH;

    // Thin separator line
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad * 2, bottomY);
    ctx.lineTo(width - pad * 2, bottomY);
    ctx.stroke();
    ctx.restore();

    // Bottom text
    const bottomFontSize = Math.round(minDim * 0.016);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = `400 ${bottomFontSize}px "Outfit", sans-serif`;
    ctx.letterSpacing = `${bottomFontSize * 0.2}px`;
    ctx.fillText('AVAILABLE ON ALL MAJOR STREAMING PLATFORMS', width / 2, bottomY + bottomBarH * 0.6);
    ctx.restore();

    // "OUT NOW" pill at bottom right
    const pillFontSize = Math.round(minDim * 0.02);
    const pillText = 'OUT NOW';
    ctx.save();
    ctx.font = `700 ${pillFontSize}px "Outfit", sans-serif`;
    const pillW = ctx.measureText(pillText).width + pillFontSize * 2;
    const pillH = pillFontSize * 2;
    const pillX = width - pad * 2 - pillW;
    const pillY = bottomY - pillH - pad * 0.5;
    // Pill background
    ctx.fillStyle = '#6b1515';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fill();
    // Pill text
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(pillText, pillX + pillW / 2, pillY + pillH * 0.65);
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
