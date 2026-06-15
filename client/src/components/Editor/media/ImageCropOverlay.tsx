import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getRenderedImageBounds, type CropRect, type RenderedImageBounds } from './imageBlockUtils';
import './ImageCropOverlay.less';

interface ImageCropOverlayProps {
  imageRef: React.RefObject<HTMLImageElement | null>;
  crop: CropRect | null;
  onCropChange: (crop: CropRect) => void;
  onBoundsChange: (bounds: RenderedImageBounds) => void;
}

type DragHandle = 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';

const MIN_SIZE = 48;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeRect(rect: CropRect, bounds: RenderedImageBounds): CropRect {
  const width = clamp(rect.width, MIN_SIZE, bounds.width);
  const height = clamp(rect.height, MIN_SIZE, bounds.height);
  const x = clamp(rect.x, 0, bounds.width - width);
  const y = clamp(rect.y, 0, bounds.height - height);
  return { x, y, width, height };
}

function resizeRectFromHandle(
  start: CropRect,
  handle: DragHandle,
  dx: number,
  dy: number,
  bounds: RenderedImageBounds,
): CropRect {
  if (handle === 'move') {
    return normalizeRect({ ...start, x: start.x + dx, y: start.y + dy }, bounds);
  }

  let left = start.x;
  let top = start.y;
  let right = start.x + start.width;
  let bottom = start.y + start.height;

  if (handle.includes('w')) left = clamp(start.x + dx, 0, right - MIN_SIZE);
  if (handle.includes('e')) right = clamp(right + dx, left + MIN_SIZE, bounds.width);
  if (handle.includes('n')) top = clamp(start.y + dy, 0, bottom - MIN_SIZE);
  if (handle.includes('s')) bottom = clamp(bottom + dy, top + MIN_SIZE, bounds.height);

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function fullBounds(bounds: RenderedImageBounds): CropRect {
  return { x: 0, y: 0, width: bounds.width, height: bounds.height };
}

function rectsEqual(a: CropRect, b: CropRect): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

function boundsEqual(a: RenderedImageBounds, b: RenderedImageBounds): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

export default function ImageCropOverlay({
  imageRef,
  crop,
  onCropChange,
  onBoundsChange,
}: ImageCropOverlayProps) {
  const [rendered, setRendered] = useState<RenderedImageBounds>({ x: 0, y: 0, width: 0, height: 0 });
  const didInitCropRef = useRef(false);
  const dragRef = useRef<{ handle: DragHandle; startX: number; startY: number; startCrop: CropRect } | null>(null);
  const cropRef = useRef(crop);
  const onCropChangeRef = useRef(onCropChange);
  const onBoundsChangeRef = useRef(onBoundsChange);

  cropRef.current = crop;
  onCropChangeRef.current = onCropChange;
  onBoundsChangeRef.current = onBoundsChange;

  const syncBounds = useCallback(() => {
    const img = imageRef.current;
    if (!img) return;
    const next = getRenderedImageBounds(img);
    if (!next.width || !next.height) return;

    setRendered(prev => (boundsEqual(prev, next) ? prev : next));
    onBoundsChangeRef.current(next);

    if (!didInitCropRef.current) {
      didInitCropRef.current = true;
      onCropChangeRef.current(fullBounds(next));
      return;
    }

    const currentCrop = cropRef.current;
    if (!currentCrop) return;
    const normalized = normalizeRect(currentCrop, next);
    if (!rectsEqual(normalized, currentCrop)) {
      onCropChangeRef.current(normalized);
    }
  }, [imageRef]);

  useLayoutEffect(() => {
    didInitCropRef.current = false;
    syncBounds();
  }, [syncBounds]);

  useEffect(() => {
    const img = imageRef.current;
    if (!img) return undefined;
    const observer = new ResizeObserver(() => syncBounds());
    observer.observe(img);
    if (!img.complete) img.addEventListener('load', syncBounds);
    window.addEventListener('resize', syncBounds);
    return () => {
      observer.disconnect();
      img.removeEventListener('load', syncBounds);
      window.removeEventListener('resize', syncBounds);
    };
  }, [imageRef, syncBounds]);

  const activeCrop = crop && crop.width > 0 ? normalizeRect(crop, rendered) : null;

  const startDrag = (handle: DragHandle, event: React.PointerEvent) => {
    if (!activeCrop) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = {
      handle,
      startX: event.clientX,
      startY: event.clientY,
      startCrop: activeCrop,
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || !rendered.width || !rendered.height) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;

    onCropChange(resizeRectFromHandle(drag.startCrop, drag.handle, dx, dy, rendered));
  };

  const endDrag = (event: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  if (!activeCrop || !rendered.width || !rendered.height) return null;

  return (
    <div
      className="feishu-image-crop-layer"
      style={{
        left: rendered.x,
        top: rendered.y,
        width: rendered.width,
        height: rendered.height,
      }}
      data-no-marquee-selection="true"
      onMouseDown={e => e.stopPropagation()}
    >
      <div
        className="feishu-image-crop-layer__shade feishu-image-crop-layer__shade--top"
        style={{ height: activeCrop.y }}
      />
      <div
        className="feishu-image-crop-layer__shade feishu-image-crop-layer__shade--left"
        style={{
          top: activeCrop.y,
          width: activeCrop.x,
          height: activeCrop.height,
        }}
      />
      <div
        className="feishu-image-crop-layer__box"
        style={{
          left: activeCrop.x,
          top: activeCrop.y,
          width: activeCrop.width,
          height: activeCrop.height,
        }}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className="feishu-image-crop-layer__move"
          onPointerDown={event => startDrag('move', event)}
        />
        {(['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'] as DragHandle[]).map(handle => (
          <div
            key={handle}
            className={`feishu-image-crop-layer__handle feishu-image-crop-layer__handle--${handle}`}
            onPointerDown={event => startDrag(handle, event)}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          />
        ))}
      </div>
      <div
        className="feishu-image-crop-layer__shade feishu-image-crop-layer__shade--right"
        style={{
          left: activeCrop.x + activeCrop.width,
          top: activeCrop.y,
          width: Math.max(0, rendered.width - activeCrop.x - activeCrop.width),
          height: activeCrop.height,
        }}
      />
      <div
        className="feishu-image-crop-layer__shade feishu-image-crop-layer__shade--bottom"
        style={{
          top: activeCrop.y + activeCrop.height,
          height: Math.max(0, rendered.height - activeCrop.y - activeCrop.height),
        }}
      />
    </div>
  );
}
