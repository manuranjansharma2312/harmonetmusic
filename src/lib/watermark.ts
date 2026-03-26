/**
 * Adds the Harmonet Music logo as a small, always-visible watermark
 * in the bottom-right corner — similar to how Gemini brands its outputs.
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

        // Small logo in bottom-right corner (like Gemini style)
        const logoWidth = Math.round(img.width * 0.18);
        const logoHeight = Math.round((logo.height / logo.width) * logoWidth);
        const margin = Math.round(img.width * 0.025);
        const x = img.width - logoWidth - margin;
        const y = img.height - logoHeight - margin;

        // Pill-shaped frosted background for visibility on ANY image
        const padX = Math.round(logoWidth * 0.12);
        const padY = Math.round(logoHeight * 0.2);
        const bgX = x - padX;
        const bgY = y - padY;
        const bgW = logoWidth + padX * 2;
        const bgH = logoHeight + padY * 2;
        const bgRadius = Math.round(bgH * 0.3);

        // Dark semi-transparent backdrop
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.beginPath();
        ctx.roundRect(bgX, bgY, bgW, bgH, bgRadius);
        ctx.fill();

        // Subtle light border for extra pop
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(bgX, bgY, bgW, bgH, bgRadius);
        ctx.stroke();

        // Draw logo at full opacity
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
