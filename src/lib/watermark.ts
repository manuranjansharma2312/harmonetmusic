/**
 * Adds the Harmonet Music white logo as a watermark with a dark
 * frosted-glass backdrop — visible on ANY background (Gemini-style).
 */
export async function addWatermark(imageDataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const logo = new Image();
      logo.crossOrigin = 'anonymous';
      logo.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(imageDataUrl); return; }

        // Draw the generated image
        ctx.drawImage(img, 0, 0);

        // Logo sizing — 18% of image width
        const logoWidth = Math.round(img.width * 0.18);
        const logoHeight = Math.round((logo.height / logo.width) * logoWidth);
        const padX = Math.round(logoWidth * 0.12);
        const padY = Math.round(logoHeight * 0.35);
        const margin = Math.round(img.width * 0.025);

        const bgW = logoWidth + padX * 2;
        const bgH = logoHeight + padY * 2;
        const bgX = img.width - bgW - margin;
        const bgY = img.height - bgH - margin;
        const bgRadius = Math.round(bgH * 0.28);

        // Dark frosted pill background — ensures white logo pops on ANY image
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.roundRect(bgX, bgY, bgW, bgH, bgRadius);
        ctx.fill();
        ctx.restore();

        // Subtle light border for polish
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(bgX, bgY, bgW, bgH, bgRadius);
        ctx.stroke();
        ctx.restore();

        // Draw the white logo on top
        const x = bgX + padX;
        const y = bgY + padY;
        ctx.drawImage(logo, x, y, logoWidth, logoHeight);

        resolve(canvas.toDataURL('image/png'));
      };
      logo.onerror = () => resolve(imageDataUrl);
      logo.src = '/images/harmonet-watermark.png';
    };
    img.onerror = () => reject(new Error('Failed to load image for watermark'));
    img.src = imageDataUrl;
  });
}
