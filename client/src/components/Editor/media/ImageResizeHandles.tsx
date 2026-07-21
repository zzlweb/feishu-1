import { useRef } from 'react';

interface ImageResizeHandlesProps {
  imageRef: React.RefObject<HTMLImageElement | null>;
  onResizeEnd: (width: number) => void;
}

interface ResizeSession {
  startX: number;
  startWidth: number;
  maxWidth: number;
  direction: -1 | 1;
  host: HTMLElement;
}

const MIN_IMAGE_WIDTH = 80;

export default function ImageResizeHandles({
  imageRef,
  onResizeEnd,
}: ImageResizeHandlesProps) {
  const sessionRef = useRef<ResizeSession | null>(null);

  const startResize = (direction: -1 | 1, event: React.PointerEvent<HTMLButtonElement>) => {
    const image = imageRef.current;
    const host = image?.parentElement;
    const wrapper = host?.parentElement;
    if (!image || !host || !wrapper) return;
    event.preventDefault();
    event.stopPropagation();
    const imageRect = image.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    sessionRef.current = {
      startX: event.clientX,
      startWidth: imageRect.width,
      maxWidth: Math.max(MIN_IMAGE_WIDTH, wrapperRect.width),
      direction,
      host,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const resize = (event: React.PointerEvent<HTMLButtonElement>) => {
    const session = sessionRef.current;
    if (!session) return;
    const width = Math.round(Math.min(
      session.maxWidth,
      Math.max(MIN_IMAGE_WIDTH, session.startWidth + (event.clientX - session.startX) * session.direction),
    ));
    session.host.style.width = `${width}px`;
  };

  const finishResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    const session = sessionRef.current;
    if (!session) return;
    sessionRef.current = null;
    const width = Math.round(session.host.getBoundingClientRect().width);
    session.host.style.width = '';
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onResizeEnd(width);
  };

  return (
    <>
      {(['nw', 'ne', 'sw', 'se'] as const).map(position => {
        const direction = position.endsWith('w') ? -1 : 1;
        return (
          <button
            key={position}
            type="button"
            className={`feishu-image-resize-handle feishu-image-resize-handle--${position}`}
            aria-label={`拖动${position.endsWith('w') ? '左' : '右'}${position.startsWith('n') ? '上' : '下'}角调整图片大小`}
            onPointerDown={event => startResize(direction, event)}
            onPointerMove={resize}
            onPointerUp={finishResize}
            onPointerCancel={finishResize}
          />
        );
      })}
    </>
  );
}
