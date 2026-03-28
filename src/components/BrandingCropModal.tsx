import { useState, useRef, useCallback } from 'react';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface BrandingCropModalProps {
  open: boolean;
  imageSrc: string;
  aspect?: number;
  title?: string;
  outputSize?: { width: number; height: number };
  onCropComplete: (croppedFile: File) => void;
  onCancel: () => void;
}

function initCrop(mediaWidth: number, mediaHeight: number, aspect?: number) {
  if (aspect) {
    return centerCrop(
      makeAspectCrop({ unit: '%', width: 80 }, aspect, mediaWidth, mediaHeight),
      mediaWidth,
      mediaHeight,
    );
  }
  // Free crop – start with 80% centered
  return centerCrop(
    { unit: '%' as const, width: 80, height: 80, x: 10, y: 10 },
    mediaWidth,
    mediaHeight,
  );
}

export function BrandingCropModal({
  open,
  imageSrc,
  aspect,
  title = 'Crop Image',
  outputSize,
  onCropComplete,
  onCancel,
}: BrandingCropModalProps) {
  const [crop, setCrop] = useState<Crop>();
  const imgRef = useRef<HTMLImageElement | null>(null);

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { naturalWidth, naturalHeight } = e.currentTarget;
      imgRef.current = e.currentTarget;
      setCrop(initCrop(naturalWidth, naturalHeight, aspect));
    },
    [aspect],
  );

  const handleCrop = useCallback(async () => {
    const image = imgRef.current;
    if (!image || !crop) return;

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const px = {
      x: (crop.x ?? 0) * scaleX,
      y: (crop.y ?? 0) * scaleY,
      width: (crop.width ?? 0) * scaleX,
      height: (crop.height ?? 0) * scaleY,
    };

    const outW = outputSize?.width ?? Math.round(px.width);
    const outH = outputSize?.height ?? Math.round(px.height);

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(image, px.x, px.y, px.width, px.height, 0, 0, outW, outH);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], 'cropped.png', { type: 'image/png' });
        onCropComplete(file);
      },
      'image/png',
      1,
    );
  }, [crop, onCropComplete, outputSize]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center overflow-hidden rounded-lg bg-muted/30">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            aspect={aspect}
            className="max-h-[60vh]"
          >
            <img
              src={imageSrc}
              onLoad={onImageLoad}
              alt="Crop preview"
              className="max-h-[60vh] w-auto"
            />
          </ReactCrop>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleCrop}>Crop &amp; Use</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
