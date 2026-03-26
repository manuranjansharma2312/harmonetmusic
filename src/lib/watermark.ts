/**
 * Adds the Harmonet Music logo as a watermark to a base64 image.
 * Places a subtle dark gradient banner at the bottom with the logo centered.
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

        // Dark gradient banner at the bottom for logo visibility
        const bannerHeight = Math.round(img.height * 0.12);
        const gradient = ctx.createLinearGradient(0, img.height - bannerHeight * 1.5, 0, img.height);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(0.4, 'rgba(0, 0, 0, 0.5)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.75)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, img.height - bannerHeight * 1.5, img.width, bannerHeight * 1.5);

        // Calculate logo size — 30% of image width, centered in the banner
        const logoWidth = Math.round(img.width * 0.30);
        const logoHeight = Math.round((logo.height / logo.width) * logoWidth);
        const x = (img.width - logoWidth) / 2;
        const y = img.height - bannerHeight / 2 - logoHeight / 2;

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
