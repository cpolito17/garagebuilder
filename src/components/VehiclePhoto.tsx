import { useEffect, useState } from 'react';
import type { VehicleImage } from '../data/images';

export type PhotoStatus = 'missing' | 'loading' | 'loaded' | 'failed';

/**
 * A real photograph, when one exists.
 *
 * Renders nothing at all when the manifest has no entry for the vehicle, which
 * is the normal state until scripts/fetch-images.ts has run. The identity band
 * below it carries the same information either way, so a missing photo is a
 * shorter card rather than a hole.
 *
 * Geometry is reserved from the manifest's own dimensions so the result grid
 * does not shift as photos decode.
 */
export function VehiclePhoto({
  image,
  sizes = '(min-width: 768px) 400px, 100vw',
  priority = false,
  rounded = true,
  aspect = '16 / 10',
  onStatusChange,
}: {
  image: VehicleImage | undefined;
  sizes?: string;
  priority?: boolean;
  rounded?: boolean;
  aspect?: string;
  onStatusChange?: (status: PhotoStatus) => void;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    onStatusChange?.(image ? 'loading' : 'missing');
  }, [image?.file, onStatusChange]);

  if (!image || failed) return null;

  const src = `/vehicles/${image.file}`;
  const srcSet = image.file2x
    ? `${src} 1x, /vehicles/${image.file2x} 2x`
    : undefined;

  return (
    <div
      className="relative w-full overflow-hidden bg-[--bg-shell]"
      style={{
        aspectRatio: aspect,
        borderTopLeftRadius: rounded ? 'inherit' : undefined,
        borderTopRightRadius: rounded ? 'inherit' : undefined,
      }}
    >
      <img
        src={src}
        srcSet={srcSet}
        sizes={sizes}
        width={image.width}
        height={image.height}
        alt={image.alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => onStatusChange?.('loaded')}
        onError={() => {
          setFailed(true);
          onStatusChange?.('failed');
        }}
        className="h-full w-full object-cover"
      />
    </div>
  );
}
