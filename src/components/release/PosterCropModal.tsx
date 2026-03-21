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

interface PosterCropModalProps {
  open: boolean;
  imageSrc: string;
  onCropComplete: (croppedFile: File) => void;
  onCancel: () => void;
}

function centerAspectCrop(mediaWidth: number, mediaHeight: number) {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 90 }, 1, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight
  );
}

export function PosterCropModal({ open, imageSrc, onCropComplete, onCancel }: PosterCropModalProps) {
  const [crop, setCrop] = useState<Crop>();
  const imgRef = useRef<HTMLImageElement | null>(null);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    imgRef.current = e.currentTarget;
    setCrop(centerAspectCrop(naturalWidth, naturalHeight));
  }, []);

  const handleCrop = useCallback(async () => {
    const image = imgRef.current;
    if (!image || !crop) return;

    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const pixelCrop = {
      x: (crop.x ?? 0) * scaleX,
      y: (crop.y ?? 0) * scaleY,
      width: (crop.width ?? 0) * scaleX,
      height: (crop.height ?? 0) * scaleY,
    };

    canvas.width = 3000;
    canvas.height = 3000;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      3000,
      3000
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], 'poster-cropped.jpg', { type: 'image/jpeg' });
        onCropComplete(file);
      },
      'image/jpeg',
      0.92
    );
  }, [crop, onCropComplete]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Crop Cover Art (3000 × 3000)</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center overflow-hidden rounded-lg bg-muted/30">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            aspect={1}
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
