import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { downloadImageSource } from './imageBlockUtils';
import './ImageViewer.less';

interface ImageViewerProps {
  src: string;
  alt?: string;
  fileName?: string;
  onClose: () => void;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
const SCALE_STEP = 0.25;

function clampScale(value: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

export default function ImageViewer({
  src,
  alt = '',
  fileName = 'image',
  onClose,
}: ImageViewerProps) {
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === '+' || event.key === '=') setScale(value => clampScale(value + SCALE_STEP));
      if (event.key === '-') setScale(value => clampScale(value - SCALE_STEP));
      if (event.key === '0') setScale(1);
      if (event.key.toLowerCase() === 'r') setRotation(value => value + 90);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (!src) return null;

  const handleBackdropMouseDown = (event: React.MouseEvent<HTMLElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return createPortal(
    <div
      className="feishu-image-viewer"
      role="dialog"
      aria-modal="true"
      aria-label="图片预览"
      onMouseDown={handleBackdropMouseDown}
    >
      <button type="button" className="feishu-image-viewer__close" aria-label="关闭预览" onClick={onClose}>×</button>
      <div className="feishu-image-viewer__stage" onMouseDown={handleBackdropMouseDown}>
        <img
          className="feishu-image-viewer__image"
          src={src}
          alt={alt}
          draggable={false}
          style={{ transform: `scale(${scale}) rotate(${rotation}deg)` }}
          onMouseDown={event => event.stopPropagation()}
        />
      </div>
      <div
        className="feishu-image-viewer__toolbar"
        role="toolbar"
        aria-label="图片预览工具栏"
        onMouseDown={event => event.stopPropagation()}
      >
        <button type="button" aria-label="缩小" title="缩小 (-)" onClick={() => setScale(value => clampScale(value - SCALE_STEP))}>−</button>
        <span aria-live="polite">{Math.round(scale * 100)}%</span>
        <button type="button" aria-label="放大" title="放大 (+)" onClick={() => setScale(value => clampScale(value + SCALE_STEP))}>＋</button>
        <button type="button" aria-label="恢复实际大小" title="恢复实际大小 (0)" onClick={() => setScale(1)}>1:1</button>
        <button type="button" aria-label="顺时针旋转" title="旋转查看 (R)" onClick={() => setRotation(value => value + 90)}>↻</button>
        <button type="button" aria-label="下载图片" title="下载图片" onClick={() => downloadImageSource(src, fileName)}>↓</button>
      </div>
    </div>,
    document.body,
  );
}
