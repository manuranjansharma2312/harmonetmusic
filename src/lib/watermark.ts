/**
 * Adds the Harmonet Music logo as a watermark to a base64 image.
 * Returns a new base64 data URL with the watermark applied.
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

        // Calculate logo size — 20% of image width, centered at bottom
        const logoWidth = Math.round(img.width * 0.25);
        const logoHeight = Math.round((logo.height / logo.width) * logoWidth);
        const x = (img.width - logoWidth) / 2;
        const y = img.height - logoHeight - Math.round(img.height * 0.04);

        // Semi-transparent background behind logo for visibility
        const padX = logoWidth * 0.08;
        const padY = logoHeight * 0.15;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        const bgRadius = 12;
        const bgX = x - padX;
        const bgY = y - padY;
        const bgW = logoWidth + padX * 2;
        const bgH = logoHeight + padY * 2;
        ctx.beginPath();
        ctx.roundRect(bgX, bgY, bgW, bgH, bgRadius);
        ctx.fill();

        // Draw logo with slight transparency
        ctx.globalAlpha = 0.9;
        ctx.drawImage(logo, x, y, logoWidth, logoHeight);
        ctx.globalAlpha = 1.0;

        resolve(canvas.toDataURL('image/png'));
      };
      logo.onerror = () => resolve(imageDataUrl); // Fallback: return original if logo fails
      logo.src = '/images/harmonet-watermark.png';
    };
    img.onerror = () => reject(new Error('Failed to load image for watermark'));
    img.src = imageDataUrl;
  });
}
