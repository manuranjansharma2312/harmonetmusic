import { memo } from 'react';

export const BackgroundBlobs = memo(function BackgroundBlobs() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div
        className="floating-blob animate-float"
        style={{
          width: 400,
          height: 400,
          background: 'radial-gradient(circle, hsl(0 67% 25%), transparent)',
          top: '10%',
          left: '5%',
        }}
      />
      <div
        className="floating-blob"
        style={{
          width: 300,
          height: 300,
          background: 'radial-gradient(circle, hsl(0 50% 20%), transparent)',
          bottom: '15%',
          right: '10%',
          animation: 'float 8s ease-in-out infinite reverse',
        }}
      />
      <div
        className="floating-blob"
        style={{
          width: 200,
          height: 200,
          background: 'radial-gradient(circle, hsl(0 67% 30%), transparent)',
          top: '60%',
          left: '40%',
          animation: 'float 10s ease-in-out infinite',
        }}
      />
    </div>
  );
});
