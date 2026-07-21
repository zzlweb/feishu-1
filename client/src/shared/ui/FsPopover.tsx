import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useOverlayRegistration } from '../overlay';

export interface FsPopoverProps {
  open: boolean;
  anchor: ReactElement;
  children: ReactNode;
  onClose: () => void;
  className?: string;
  width?: number;
}

export function FsPopover({ open, anchor, children, onClose, className = '', width }: FsPopoverProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' });

  const contains = useCallback((target: Node) => (
    Boolean(anchorRef.current?.contains(target) || panelRef.current?.contains(target))
  ), []);
  useOverlayRegistration({ open, onClose, contains });

  useLayoutEffect(() => {
    if (!open) return undefined;
    const update = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      const panel = panelRef.current?.getBoundingClientRect();
      if (!rect) return;
      const panelWidth = width ?? panel?.width ?? 240;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - panelWidth - 8));
      const below = rect.bottom + 4;
      const top = panel && below + panel.height > window.innerHeight - 8
        ? Math.max(8, rect.top - panel.height - 4)
        : below;
      setStyle({ left, top, width, visibility: 'visible' });
    };
    update();
    window.addEventListener('resize', update);
    document.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      document.removeEventListener('scroll', update, true);
    };
  }, [open, width]);

  return (
    <>
      <span ref={anchorRef} className="fs-popover__anchor">{anchor}</span>
      {open && createPortal(
        <div ref={panelRef} className={`fs-popover ${className}`.trim()} style={style} data-floating-panel="true">
          {children}
        </div>,
        document.body,
      )}
    </>
  );
}
