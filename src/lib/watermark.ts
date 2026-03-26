/**
 * Adds the Harmonet Music logo as a clearly visible watermark
 * in the bottom-right corner on every AI-generated image.
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

        // Logo sizing — 22% of image width for clear visibility
        const logoWidth = Math.round(img.width * 0.22);
        const logoHeight = Math.round((logo.height / logo.width) * logoWidth);
        const margin = Math.round(img.width * 0.03);
        const x = img.width - logoWidth - margin;
        const y = img.height - logoHeight - margin;

        // White rounded-rect background so logo is always readable
        const padX = Math.round(logoWidth * 0.1);
        const padY = Math.round(logoHeight * 0.12);
        const bgX = x - padX;
        const bgY = y - padY;
        const bgW = logoWidth + padX * 2;
        const bgH = logoHeight + padY * 2;
        const bgRadius = Math.round(bgH * 0.15);

        // Solid white background with slight transparency
        ctx.save();
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(bgX, bgY, bgW, bgH, bgRadius);
        ctx.fill();
        ctx.restore();

        // Thin border for definition
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(bgX, bgY, bgW, bgH, bgRadius);
        ctx.stroke();

        // Draw logo at full opacity on the white background
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
