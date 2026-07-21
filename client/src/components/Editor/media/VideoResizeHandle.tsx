import { useRef } from 'react';
import { resizeMediaByAspectRatio, type MediaDimensions } from './mediaSizing';

interface VideoResizeHandleProps {
  hostRef: React.RefObject<HTMLDivElement | null>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onResizeStart?: () => void;
  onResizeEnd: (dimensions: MediaDimensions) => void;
}

interface ResizeSession {
  startX: number;
  startWidth: number;
  maxWidth: number;
  aspectRatio: number;
  host: HTMLDivElement;
}

export default function VideoResizeHandle({
  hostRef,
  videoRef,
  onResizeStart,
  onResizeEnd,
}: VideoResizeHandleProps) {
  const sessionRef = useRef<ResizeSession | null>(null);

  const startResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    const host = hostRef.current;
    const video = videoRef.current;
    const wrapper = host?.parentElement;
    if (!host || !wrapper) return;
    event.preventDefault();
    event.stopPropagation();
    const hostRect = host.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    const naturalRatio = video?.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 0;
    sessionRef.current = {
      startX: event.clientX,
      startWidth: hostRect.width,
      maxWidth: wrapperRect.width,
      aspectRatio: naturalRatio || (hostRect.height > 0 ? hostRect.width / hostRect.height : 16 / 9),
      host,
    };
    onResizeStart?.();
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const resize = (event: React.PointerEvent<HTMLButtonElement>) => {
    const session = sessionRef.current;
    if (!session) return;
    const dimensions = resizeMediaByAspectRatio(
      session.startWidth + event.clientX - session.startX,
      session.maxWidth,
      session.aspectRatio,
    );
    session.host.style.width = `${dimensions.width}px`;
  };

  const finishResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    const session = sessionRef.current;
    if (!session) return;
    sessionRef.current = null;
    const dimensions = resizeMediaByAspectRatio(
      session.host.getBoundingClientRect().width,
      session.maxWidth,
      session.aspectRatio,
    );
    session.host.style.width = '';
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onResizeEnd(dimensions);
  };

  return (
    <button
      type="button"
      className="feishu-video-resize-handle"
      aria-label="拖动调整视频大小"
      title="拖动调整视频大小"
      onPointerDown={startResize}
      onPointerMove={resize}
      onPointerUp={finishResize}
      onPointerCancel={finishResize}
    />
  );
}
