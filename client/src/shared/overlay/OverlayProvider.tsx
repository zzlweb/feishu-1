import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';

interface OverlayEntry {
  id: string;
  closeOnEscape: boolean;
  closeOnOutsidePointer: boolean;
  contains: (target: Node) => boolean;
  onClose: () => void;
  restoreFocusTo: HTMLElement | null;
}

interface OverlayRegistry {
  register: (entry: OverlayEntry) => () => void;
}

const OverlayContext = createContext<OverlayRegistry | null>(null);

export function OverlayProvider({ children }: { children: ReactNode }) {
  const entriesRef = useRef<OverlayEntry[]>([]);

  const register = useCallback((entry: OverlayEntry) => {
    entriesRef.current = [...entriesRef.current.filter(item => item.id !== entry.id), entry];

    return () => {
      const wasRegistered = entriesRef.current.some(item => item.id === entry.id);
      entriesRef.current = entriesRef.current.filter(item => item.id !== entry.id);
      if (wasRegistered && entry.restoreFocusTo?.isConnected) {
        window.requestAnimationFrame(() => entry.restoreFocusTo?.focus({ preventScroll: true }));
      }
    };
  }, []);

  useEffect(() => {
    const closeTopmost = (predicate: (entry: OverlayEntry) => boolean) => {
      const entry = [...entriesRef.current].reverse().find(predicate);
      entry?.onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      closeTopmost(entry => entry.closeOnEscape);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      const topmost = entriesRef.current[entriesRef.current.length - 1];
      if (!topmost || !topmost.closeOnOutsidePointer || topmost.contains(event.target)) return;
      topmost.onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, []);

  return <OverlayContext.Provider value={{ register }}>{children}</OverlayContext.Provider>;
}

export interface OverlayRegistrationOptions {
  open: boolean;
  onClose: () => void;
  contains: (target: Node) => boolean;
  closeOnEscape?: boolean;
  closeOnOutsidePointer?: boolean;
  restoreFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Registers an overlay in application stacking order. Only the topmost overlay
 * reacts to Escape or an outside pointer, and focus returns to its opener.
 */
export function useOverlayRegistration({
  open,
  onClose,
  contains,
  closeOnEscape = true,
  closeOnOutsidePointer = true,
  restoreFocusRef,
}: OverlayRegistrationOptions) {
  const registry = useContext(OverlayContext);
  const reactId = useId();
  const idRef = useRef(`overlay-${reactId}`);
  const onCloseRef = useRef(onClose);
  const containsRef = useRef(contains);
  onCloseRef.current = onClose;
  containsRef.current = contains;

  useEffect(() => {
    if (!open) return undefined;
    const restoreFocusTo = restoreFocusRef?.current
      ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const entry: OverlayEntry = {
      id: idRef.current,
      closeOnEscape,
      closeOnOutsidePointer,
      contains: target => containsRef.current(target),
      onClose: () => onCloseRef.current(),
      restoreFocusTo,
    };

    if (registry) return registry.register(entry);

    // Isolated component tests and embeds may render without the app provider.
    const handleKeyDown = (event: KeyboardEvent) => {
      if (closeOnEscape && event.key === 'Escape' && !event.defaultPrevented) entry.onClose();
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (closeOnOutsidePointer && event.target instanceof Node && !entry.contains(event.target)) {
        entry.onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
      if (restoreFocusTo?.isConnected) restoreFocusTo.focus({ preventScroll: true });
    };
  }, [closeOnEscape, closeOnOutsidePointer, open, registry, restoreFocusRef]);
}
