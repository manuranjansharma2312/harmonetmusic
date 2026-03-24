import { useState, useRef, useCallback, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PosterCropModal } from '@/components/release/PosterCropModal';
import { toast } from 'sonner';
import { Download, Upload, Image as ImageIcon } from 'lucide-react';
import harmonetLogo from '@/assets/harmonet-logo.png';
import harmonetLogoWhite from '@/assets/harmonet-logo-white.png';

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

  const fonts = [
    new FontFace('Outfit', 'url(/fonts/Outfit-Bold.ttf)', { weight: '700' }),
    new FontFace('Outfit', 'url(/fonts/Outfit-Regular.ttf)', { weight: '400' }),
    new FontFace('Italiana', 'url(/fonts/Italiana-Regular.ttf)', { weight: '400' }),
    new FontFace('Work Sans', 'url(/fonts/WorkSans-Bold.ttf)', { weight: '700' }),
  ];

  await Promise.all(fonts.map((font) => font.load()));
  fonts.forEach((font) => document.fonts.add(font));
  fontsLoaded = true;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, font: string) {
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

function fitSingleLineFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startSize: number,
  minSize: number,
  getFont: (size: number) => string,
) {
  for (let size = startSize; size >= minSize; size -= 1) {
    ctx.font = getFont(size);
    if (ctx.measureText(text).width <= maxWidth) return size;
  }

  return minSize;
}

function clampLineWithEllipsis(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  let output = text.trim();
  while (output.length > 0 && ctx.measureText(`${output}…`).width > maxWidth) {
    output = output.slice(0, -1).trimEnd();
  }
  return output ? `${output}…` : '…';
}

function fitTitleBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxHeight: number,
  startSize: number,
  minSize: number,
  maxLines: number,
) {
  for (let size = startSize; size >= minSize; size -= 2) {
    const font = `700 ${size}px "Outfit", sans-serif`;
    ctx.font = font;
    let lines = wrapText(ctx, text, maxWidth, font);
    const lineHeight = size * 1.08;

    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] = clampLineWithEllipsis(ctx, lines[maxLines - 1], maxWidth);
    }

    if (lines.length * lineHeight <= maxHeight) {
      return { font, fontSize: size, lines, lineHeight };
    }
  }

  const fallbackFont = `700 ${minSize}px "Outfit", sans-serif`;
  ctx.font = fallbackFont;
  let lines = wrapText(ctx, text, maxWidth, fallbackFont).slice(0, maxLines);
  if (lines.length === maxLines) {
    lines[maxLines - 1] = clampLineWithEllipsis(ctx, lines[maxLines - 1], maxWidth);
  }

  return {
    font: fallbackFont,
    fontSize: minSize,
    lines,
    lineHeight: minSize * 1.08,
  };
}

export default function AdminPosterGenerator() {
  const [songTitle, setSongTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [posterPreview, setPosterPreview] = useState('');
  const [selectedSize, setSelectedSize] = useState('1-1');
  const [generating, setGenerating] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState('');
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
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

  const generatePoster = useCallback(
    async (canvas: HTMLCanvasElement, sizeKey?: string) => {
      await ensureFonts();
      const key = sizeKey || selectedSize;
      const preset = SIZE_PRESETS[key];
      if (!preset || !posterPreview) return;

      const { width, height } = preset;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const minDim = Math.min(width, height);
      const aspectRatio = height / width;
      const isLandscape = width > height;
      const isPortrait = height > width;
      const isTallPortrait = aspectRatio > 1.5;

      const margin = minDim * (isLandscape ? 0.055 : 0.06);
      const bottomBarH = minDim * (isLandscape ? 0.11 : 0.12);
      const bottomY = height - bottomBarH;

      const backgroundGradient = ctx.createLinearGradient(0, 0, width * 0.4, height);
      backgroundGradient.addColorStop(0, '#080808');
      backgroundGradient.addColorStop(0.5, '#100c14');
      backgroundGradient.addColorStop(1, '#080808');
      ctx.fillStyle = backgroundGradient;
      ctx.fillRect(0, 0, width, height);

      const glowX = isLandscape ? width * 0.3 : width * 0.5;
      const glowY = isPortrait ? height * 0.28 : height * 0.4;
      const radialGlow = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, minDim * 0.8);
      radialGlow.addColorStop(0, 'rgba(107,21,21,0.18)');
      radialGlow.addColorStop(0.5, 'rgba(107,21,21,0.04)');
      radialGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = radialGlow;
      ctx.fillRect(0, 0, width, height);

      let coverImg: HTMLImageElement | null = null;
      let logoImg: HTMLImageElement | null = null;
      try {
        coverImg = await loadImage(posterPreview);
      } catch {}
      try {
        logoImg = await loadImage(harmonetLogoWhite);
      } catch {}

      const logoAspect = logoImg ? logoImg.width / logoImg.height : 3.2;

      let coverX = 0;
      let coverY = 0;
      let coverS = 0;
      let textX = 0;
      let textY = 0;
      let textW = 0;
      let logoX = margin;
      let logoY = margin;
      let logoW = 0;
      let logoH = minDim * 0.085;

      if (isLandscape) {
        const usableH = bottomY - margin * 2;
        coverS = Math.min(usableH * 0.92, width * 0.37);
        coverX = margin;
        coverY = margin + (usableH - coverS) / 2;
        textX = coverX + coverS + margin * 1.2;
        textW = width - textX - margin;
        const maxLogoW = textW * 0.72;
        logoW = logoH * logoAspect;
        if (logoW > maxLogoW) {
          logoW = maxLogoW;
          logoH = logoW / logoAspect;
        }
        textY = logoY + logoH + margin * 0.75;
      } else {
        const maxLogoW = width * (isTallPortrait ? 0.62 : 0.68);
        logoW = logoH * logoAspect;
        if (logoW > maxLogoW) {
          logoW = maxLogoW;
          logoH = logoW / logoAspect;
        }

        if (isPortrait) {
          coverS = width * (isTallPortrait ? 0.56 : 0.62);
        } else {
          coverS = width * 0.5;
        }

        coverX = (width - coverS) / 2;
        coverY = logoY + logoH + margin * 0.75;
        textX = margin;
        textW = width - margin * 2;
        textY = coverY + coverS + margin * 0.85;

        const minimumTextSpace = minDim * (isTallPortrait ? 0.34 : 0.24);
        const availableTextSpace = bottomY - margin * 0.6 - textY;
        if (availableTextSpace < minimumTextSpace) {
          const deficit = minimumTextSpace - availableTextSpace;
          coverS = Math.max(minDim * 0.4, coverS - deficit);
          coverX = (width - coverS) / 2;
          textY = coverY + coverS + margin * 0.85;
        }
      }

      if (coverImg) {
        const radius = minDim * 0.015;
        ctx.save();
        ctx.shadowColor = 'rgba(107,21,21,0.4)';
        ctx.shadowBlur = minDim * 0.04;
        ctx.shadowOffsetY = minDim * 0.01;
        ctx.beginPath();
        ctx.roundRect(coverX, coverY, coverS, coverS, radius);
        ctx.clip();
        ctx.drawImage(coverImg, coverX, coverY, coverS, coverS);
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(coverX, coverY, coverS, coverS, radius);
        ctx.stroke();
        ctx.restore();
      }

      if (logoImg) {
        ctx.save();
        ctx.globalAlpha = 0.97;
        ctx.drawImage(logoImg, logoX, logoY, logoW, logoH);
        ctx.restore();
      }

      const badgeText = 'NEW RELEASE';
      const badgeAvailableWidth = Math.max(width * 0.12, width - (logoX + logoW) - margin * 2);
      const badgeFontSize = fitSingleLineFontSize(
        ctx,
        badgeText,
        badgeAvailableWidth,
        Math.round(minDim * 0.028),
        Math.round(minDim * 0.018),
        (size) => `700 ${size}px "Work Sans", sans-serif`,
      );
      ctx.save();
      ctx.font = `700 ${badgeFontSize}px "Work Sans", sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255,255,255,0.34)';
      ctx.fillText(badgeText, width - margin, logoY + Math.max(logoH * 0.72, badgeFontSize));
      ctx.restore();

      const accentLineWidth = minDim * 0.07;
      const accentLineHeight = Math.max(3, minDim * 0.004);
      ctx.save();
      ctx.fillStyle = '#6b1515';
      ctx.fillRect(textX, textY, accentLineWidth, accentLineHeight);
      ctx.restore();

      const textTop = textY + accentLineHeight + margin * 0.45;
      const textBottom = bottomY - margin * 0.55;

      const artistText = artistName.trim().toUpperCase();
      const artistFontSize = artistText
        ? fitSingleLineFontSize(
            ctx,
            artistText,
            textW,
            Math.round(minDim * 0.042),
            Math.round(minDim * 0.024),
            (size) => `400 ${size}px "Italiana", sans-serif`,
          )
        : 0;
      const artistReserve = artistText ? artistFontSize * 1.5 + margin * 0.45 : 0;

      const maxTitleHeight = Math.max(minDim * 0.08, textBottom - textTop - artistReserve);
      const titleBlock = fitTitleBlock(
        ctx,
        songTitle.trim().toUpperCase(),
        textW,
        maxTitleHeight,
        Math.round(minDim * (isLandscape ? 0.072 : 0.082)),
        Math.round(minDim * 0.04),
        isTallPortrait ? 4 : 3,
      );

      ctx.save();
      ctx.font = titleBlock.font;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      titleBlock.lines.forEach((line, index) => {
        const y = textTop + titleBlock.fontSize + index * titleBlock.lineHeight;
        ctx.fillText(line, textX, y, textW);
      });
      ctx.restore();

      const titleBottom = textTop + titleBlock.fontSize + (titleBlock.lines.length - 1) * titleBlock.lineHeight;
      if (artistText) {
        const artistY = Math.min(titleBottom + margin * 0.65, textBottom);
        ctx.save();
        ctx.font = `400 ${artistFontSize}px "Italiana", sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillText(artistText, textX, artistY, textW);
        ctx.restore();
      }

      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(margin, bottomY);
      ctx.lineTo(width - margin, bottomY);
      ctx.stroke();
      ctx.restore();

      const outNowText = 'OUT NOW';
      const outNowFontSize = fitSingleLineFontSize(
        ctx,
        outNowText,
        width * 0.2,
        Math.round(minDim * 0.028),
        Math.round(minDim * 0.02),
        (size) => `700 ${size}px "Outfit", sans-serif`,
      );
      ctx.font = `700 ${outNowFontSize}px "Outfit", sans-serif`;
      const outNowTextWidth = ctx.measureText(outNowText).width;
      const outNowPillW = outNowTextWidth + outNowFontSize * 1.8;
      const outNowPillH = outNowFontSize * 2.3;
      const outNowX = width - margin - outNowPillW;
      const outNowY = bottomY + (bottomBarH - outNowPillH) / 2;

      ctx.save();
      ctx.fillStyle = '#6b1515';
      ctx.beginPath();
      ctx.roundRect(outNowX, outNowY, outNowPillW, outNowPillH, outNowPillH / 2);
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 ${outNowFontSize}px "Outfit", sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(outNowText, outNowX + outNowPillW / 2, outNowY + outNowPillH / 2);
      ctx.restore();

      const taglineText = 'AVAILABLE ON ALL MAJOR STREAMING PLATFORMS';
      const taglineAvailableWidth = Math.max(width * 0.18, outNowX - margin * 2);
      const taglineFontSize = fitSingleLineFontSize(
        ctx,
        taglineText,
        taglineAvailableWidth,
        Math.round(minDim * 0.022),
        Math.round(minDim * 0.0125),
        (size) => `400 ${size}px "Outfit", sans-serif`,
      );

      ctx.save();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = `400 ${taglineFontSize}px "Outfit", sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.58)';
      ctx.fillText(taglineText, margin, bottomY + bottomBarH / 2, taglineAvailableWidth);
      ctx.restore();
    },
    [posterPreview, selectedSize],
  );

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
        await new Promise((resolve) => setTimeout(resolve, 300));
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
          <p className="mt-1 text-muted-foreground">Create professional release posters for social media</p>
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

            <div className="space-y-2">
              <Label>Poster Size</Label>
              <Select value={selectedSize} onValueChange={setSelectedSize}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SIZE_PRESETS).map(([key, val]) => (
                    <SelectItem key={key} value={key}>
                      {val.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3 rounded-lg bg-muted/30 p-3">
              <img src={harmonetLogo} alt="Harmonet Music" className="h-8 w-auto object-contain" />
              <span className="text-sm text-muted-foreground">Your attached Harmonet Music logo will be used on the poster</span>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={handleDownload} disabled={generating || !posterPreview || !songTitle} className="flex-1">
                <Download className="mr-2 h-4 w-4" />
                {generating ? 'Generating...' : 'Download Poster'}
              </Button>
              <Button variant="outline" onClick={handleDownloadAll} disabled={generating || !posterPreview || !songTitle} className="flex-1">
                <ImageIcon className="mr-2 h-4 w-4" />
                Download All Sizes
              </Button>
            </div>
          </div>

          <div className="glass-card space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-foreground">Preview</h2>
              <span className="text-xs text-muted-foreground">{preset?.label}</span>
            </div>
            <div
              className="relative flex w-full items-center justify-center overflow-hidden rounded-xl border border-border/50 bg-muted/20"
              style={{ aspectRatio: previewAspect, maxHeight: '70vh' }}
            >
              {posterPreview && songTitle ? (
                <canvas ref={previewCanvasRef} className="h-full w-full object-contain" />
              ) : (
                <div className="flex flex-col items-center gap-2 p-8 text-muted-foreground">
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
        onCancel={() => {
          setCropModalOpen(false);
          setRawImageSrc('');
        }}
      />
    </DashboardLayout>
  );
}
