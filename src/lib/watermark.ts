/**
 * Adds the Harmonet Music logo as a clearly visible watermark
 * in the bottom-right corner on every AI-generated image.
 * Uses the self-contained app logo (dark bg + white text) for universal visibility.
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

        // Logo sizing — 20% of image width
        const logoWidth = Math.round(img.width * 0.20);
        const logoHeight = Math.round((logo.height / logo.width) * logoWidth);
        const margin = Math.round(img.width * 0.025);
        const x = img.width - logoWidth - margin;
        const y = img.height - logoHeight - margin;

        // Rounded clipping for the logo
        const radius = Math.round(logoHeight * 0.15);
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x, y, logoWidth, logoHeight, radius);
        ctx.clip();
        ctx.drawImage(logo, x, y, logoWidth, logoHeight);
        ctx.restore();

        // Subtle border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(x, y, logoWidth, logoHeight, radius);
        ctx.stroke();

        resolve(canvas.toDataURL('image/png'));
      };
      logo.onerror = () => resolve(imageDataUrl);
      logo.src = '/images/harmonet-watermark.png';
    };
    img.onerror = () => reject(new Error('Failed to load image for watermark'));
    img.src = imageDataUrl;
  });
}
