import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useOverlayRegistration } from '../overlay';
import { FsButton } from './FsButton';

export interface FsDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

export function FsDialog({
  open,
  title,
  children,
  onClose,
  onConfirm,
  confirmText = '确定',
  cancelText = '取消',
  danger = false,
}: FsDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const contains = useCallback((target: Node) => Boolean(panelRef.current?.contains(target)), []);
  useOverlayRegistration({ open, onClose, contains });

  useEffect(() => {
    if (!open) return undefined;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>('[autofocus], button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !panel) return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'));
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', trapFocus);
    return () => document.removeEventListener('keydown', trapFocus);
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="fs-dialog-backdrop" role="presentation">
      <div ref={panelRef} className="fs-dialog" role="dialog" aria-modal="true" aria-labelledby="fs-dialog-title">
        <h2 id="fs-dialog-title" className="fs-dialog__title">{title}</h2>
        <div className="fs-dialog__body">{children}</div>
        <div className="fs-dialog__footer">
          <FsButton onClick={onClose}>{cancelText}</FsButton>
          {onConfirm && <FsButton variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmText}</FsButton>}
        </div>
      </div>
    </div>,
    document.body,
  );
}

