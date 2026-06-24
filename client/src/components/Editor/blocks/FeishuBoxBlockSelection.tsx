import type { Editor } from '@tiptap/react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import {
  applyBoxSelectionToEditor,
  canStartBoxSelect,
  collectSelectableUnits,
  findSelectableUnitAtPoint,
  findUnitsInClientRect,
  isBlankEditorPoint,
  isListItemEmpty,
  isListItemTextArea,
  isListSelectableUnit,
  isListTextPoint,
  measureUnitBand,
  normalizeClientRect,
  normalizeSelectedUnits,
  setBoxSelectionStore,
  type ClientRect,
  type SelectableUnit,
} from './boxSelectionModel';
import { handleEditorBlankAreaClick } from './feishuTrailingParagraph';
import './FeishuBoxBlockSelection.less';

const MIN_DRAG_PX = 3;
const AUTO_SCROLL_EDGE_PX = 40;
const AUTO_SCROLL_MAX_PX = 18;

interface DragState {
  startX: number;
  startY: number;
  pointerId: number;
}

interface Props {
  editor: Editor | null;
  editorAreaRef: RefObject<HTMLDivElement | null>;
  editorContainerRef: RefObject<HTMLDivElement | null>;
  readOnly?: boolean;
}

function isUiChrome(target: EventTarget | null): boolean {
  const element = target instanceof Element
    ? target
    : target instanceof Text ? target.parentElement : null;
  return Boolean(element?.closest(
    '.block-inline-tools, .feishu-table-chrome, .feishu-table-chrome-mount, .context-menu, .context-submenu-flyout, .context-add-below-flyout, .slash-menu, .slash-submenu-portal, .slash-table-grid-flyout, .selection-bubble, .editor-page-link-pop, .feishu-box-selection-layer, .column-resize-handle, .block-plus-menu-shell, .feishu-table-host, .tableWrapper, .feishu-columns-node, .feishu-columns-block',
  ));
}

function findScrollContainer(element: HTMLElement | null): HTMLElement | Window {
  let current = element?.parentElement ?? null;
  while (current) {
    const style = window.getComputedStyle(current);
    if (/(auto|scroll)/.test(`${style.overflowY}${style.overflow}`) && current.scrollHeight > current.clientHeight) {
      return current;
    }
    current = current.parentElement;
  }
  return window;
}

function getScrollContainerRect(container: HTMLElement | Window): DOMRect {
  if (container instanceof Window) {
    return new DOMRect(0, 0, window.innerWidth, window.innerHeight);
  }
  return container.getBoundingClientRect();
}

function getMarqueePointerHost(container: HTMLElement | null, area: HTMLElement): HTMLElement {
  return container?.closest<HTMLElement>('.doc-page-workspace')
    ?? container?.closest<HTMLElement>('.doc-content-col')
    ?? container?.closest<HTMLElement>('.editor-wrap')
    ?? container
    ?? area;
}

function scrollContainerBy(container: HTMLElement | Window, deltaY: number): void {
  if (container instanceof Window) window.scrollBy({ top: deltaY });
  else container.scrollTop += deltaY;
}

export default function BoxBlockSelectionLayer({ editor, editorAreaRef, editorContainerRef, readOnly }: Props) {
  const [dragging, setDragging] = useState(false);
  const [dragRect, setDragRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [selectedUnits, setSelectedUnits] = useState<SelectableUnit[]>([]);
  const [selectionBands, setSelectionBands] = useState<Array<{ id: string; top: number; left: number; width: number; height: number }>>([]);

  const draggingRef = useRef(false);
  const pendingDragRef = useRef<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const selectedRef = useRef<SelectableUnit[]>([]);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const autoScrollRef = useRef<number | null>(null);
  const scrollContainerRef = useRef<HTMLElement | Window | null>(null);
  const shiftAnchorIdRef = useRef<string | null>(null);

  const editorRef = useRef(editor);
  editorRef.current = editor;

  const clearSelection = useCallback(() => {
    selectedRef.current = [];
    shiftAnchorIdRef.current = null;
    setSelectedUnits([]);
    setSelectionBands([]);
    setDragRect(null);
    pendingDragRef.current = null;
    dragRef.current = null;
    draggingRef.current = false;
    setDragging(false);
    document.body.classList.remove('feishu-box-select-dragging');
    editorAreaRef.current?.removeAttribute('data-selection-mode');
  }, []);

  const disarm = useCallback(() => {
    editorAreaRef.current?.classList.remove('feishu-box-select-armed');
  }, [editorAreaRef]);

  const syncSelectionBands = useCallback((units: SelectableUnit[]) => {
    const area = editorAreaRef.current;
    if (!area) {
      setSelectionBands([]);
      return;
    }
    const areaRect = area.getBoundingClientRect();
    setSelectionBands(units.map(unit => ({
      id: unit.id,
      ...measureUnitBand(unit, areaRect),
    })));
  }, [editorAreaRef]);

  const selectUnits = useCallback((units: SelectableUnit[]) => {
    const normalized = normalizeSelectedUnits(units);
    selectedRef.current = normalized;
    if (normalized.length > 0) shiftAnchorIdRef.current = normalized[0].id;
    setSelectedUnits(normalized);
    syncSelectionBands(normalized);
  }, [syncSelectionBands]);

  const finalizeSelection = useCallback((clientRect: ClientRect) => {
    const ed = editorRef.current;
    if (!ed) return;
    const units = findUnitsInClientRect(ed, clientRect);
    selectUnits(units);
    document.body.classList.remove('feishu-box-select-dragging');
    editorAreaRef.current?.removeAttribute('data-selection-mode');
    if (units.length > 0) {
      shiftAnchorIdRef.current = units[0].id;
      applyBoxSelectionToEditor(ed, units);
    }
  }, [editorAreaRef, selectUnits]);

  const updateDragOverlay = useCallback((clientRect: ClientRect) => {
    const area = editorAreaRef.current;
    const ed = editorRef.current;
    if (!area) return;
    const areaRect = area.getBoundingClientRect();
    setDragRect({
      left: clientRect.left - areaRect.left,
      top: clientRect.top - areaRect.top,
      width: Math.max(0, clientRect.right - clientRect.left),
      height: Math.max(0, clientRect.bottom - clientRect.top),
    });
    if (ed) {
      syncSelectionBands(findUnitsInClientRect(ed, clientRect));
    }
  }, [editorAreaRef, syncSelectionBands]);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRef.current != null) {
      window.cancelAnimationFrame(autoScrollRef.current);
      autoScrollRef.current = null;
    }
  }, []);

  const tickAutoScroll = useCallback(() => {
    if (!draggingRef.current || !dragRef.current || !lastPointerRef.current || !scrollContainerRef.current) {
      autoScrollRef.current = null;
      return;
    }

    const container = scrollContainerRef.current;
    const bounds = getScrollContainerRect(container);
    const y = lastPointerRef.current.y;
    let delta = 0;
    if (y < bounds.top + AUTO_SCROLL_EDGE_PX) {
      delta = -Math.ceil(((bounds.top + AUTO_SCROLL_EDGE_PX - y) / AUTO_SCROLL_EDGE_PX) * AUTO_SCROLL_MAX_PX);
    } else if (y > bounds.bottom - AUTO_SCROLL_EDGE_PX) {
      delta = Math.ceil(((y - (bounds.bottom - AUTO_SCROLL_EDGE_PX)) / AUTO_SCROLL_EDGE_PX) * AUTO_SCROLL_MAX_PX);
    }

    if (delta !== 0) {
      scrollContainerBy(container, delta);
      const rect = normalizeClientRect(
        { left: dragRef.current.startX, top: dragRef.current.startY, right: dragRef.current.startX, bottom: dragRef.current.startY },
        { left: lastPointerRef.current.x, top: lastPointerRef.current.y, right: lastPointerRef.current.x, bottom: lastPointerRef.current.y },
      );
      updateDragOverlay(rect);
    }

    autoScrollRef.current = window.requestAnimationFrame(tickAutoScroll);
  }, [updateDragOverlay]);

  const ensureAutoScroll = useCallback(() => {
    if (autoScrollRef.current != null) return;
    autoScrollRef.current = window.requestAnimationFrame(tickAutoScroll);
  }, [tickAutoScroll]);

  const beginDrag = useCallback((clientX: number, clientY: number, pointerId: number) => {
    disarm();
    draggingRef.current = true;
    setDragging(true);
    dragRef.current = { startX: clientX, startY: clientY, pointerId };
    lastPointerRef.current = { x: clientX, y: clientY };
    scrollContainerRef.current = findScrollContainer(editorAreaRef.current);
    window.getSelection()?.removeAllRanges();
    document.body.classList.add('feishu-box-select-dragging');
    editorAreaRef.current?.setAttribute('data-selection-mode', 'block-marquee');
    updateDragOverlay({
      left: clientX,
      top: clientY,
      right: clientX,
      bottom: clientY,
    });
    ensureAutoScroll();
  }, [disarm, editorAreaRef, ensureAutoScroll, updateDragOverlay]);

  useLayoutEffect(() => {
    setBoxSelectionStore({
      getSelectedUnits: () => selectedRef.current,
      selectUnits,
      clearSelection: () => {
        clearSelection();
        disarm();
      },
      isActive: () => selectedRef.current.length > 0,
      isMarqueeActive: () => draggingRef.current,
    });
    return () => setBoxSelectionStore(null);
  }, [clearSelection, disarm, selectUnits]);

  useEffect(() => {
    if (readOnly) return;

    const finishDrag = (clientX: number, clientY: number) => {
      if (!draggingRef.current || !dragRef.current) return;

      const rect = normalizeClientRect(
        { left: dragRef.current.startX, top: dragRef.current.startY, right: dragRef.current.startX, bottom: dragRef.current.startY },
        { left: clientX, top: clientY, right: clientX, bottom: clientY },
      );

      draggingRef.current = false;
      setDragging(false);
      dragRef.current = null;
      lastPointerRef.current = null;
      scrollContainerRef.current = null;
      setDragRect(null);
      stopAutoScroll();

      const w = rect.right - rect.left;
      const h = rect.bottom - rect.top;
      if (w >= MIN_DRAG_PX || h >= MIN_DRAG_PX) {
        finalizeSelection(rect);
      } else {
        syncSelectionBands([]);
        document.body.classList.remove('feishu-box-select-dragging');
        editorAreaRef.current?.removeAttribute('data-selection-mode');
      }
    };

    const onDocPointerMove = (e: PointerEvent) => {
      if (!draggingRef.current && pendingDragRef.current) {
        const dx = Math.abs(e.clientX - pendingDragRef.current.startX);
        const dy = Math.abs(e.clientY - pendingDragRef.current.startY);
        if (dx < MIN_DRAG_PX && dy < MIN_DRAG_PX) return;
        e.preventDefault();
        window.getSelection()?.removeAllRanges();
        beginDrag(pendingDragRef.current.startX, pendingDragRef.current.startY, pendingDragRef.current.pointerId);
        pendingDragRef.current = null;
      }
      if (!draggingRef.current || !dragRef.current) return;
      e.preventDefault();
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      const rect = normalizeClientRect(
        { left: dragRef.current.startX, top: dragRef.current.startY, right: dragRef.current.startX, bottom: dragRef.current.startY },
        { left: e.clientX, top: e.clientY, right: e.clientX, bottom: e.clientY },
      );
      updateDragOverlay(rect);
      ensureAutoScroll();
    };

    const releasePointerCapture = (pointerId: number) => {
      editorContainerRef.current?.releasePointerCapture?.(pointerId);
      editorAreaRef.current?.releasePointerCapture?.(pointerId);
      const area = editorAreaRef.current;
      if (area) {
        getMarqueePointerHost(editorContainerRef.current, area).releasePointerCapture?.(pointerId);
      }
    };

    const onDocPointerUp = (e: PointerEvent) => {
      if (!draggingRef.current && pendingDragRef.current) {
        const pending = pendingDragRef.current;
        releasePointerCapture(pending.pointerId);
        pendingDragRef.current = null;

        const area = editorAreaRef.current;
        const ed = editorRef.current;
        const tiptap = area?.querySelector('.tiptap, .ProseMirror');
        if (
          ed
          && tiptap instanceof HTMLElement
          && isBlankEditorPoint(pending.startX, pending.startY, tiptap)
        ) {
          handleEditorBlankAreaClick(ed, pending.startX, pending.startY);
        }
        return;
      }
      releasePointerCapture(e.pointerId);
      finishDrag(e.clientX, e.clientY);
    };

    const onDocPointerCancel = (e: PointerEvent) => {
      releasePointerCapture(e.pointerId);
      pendingDragRef.current = null;
      draggingRef.current = false;
      setDragging(false);
      dragRef.current = null;
      lastPointerRef.current = null;
      scrollContainerRef.current = null;
      setDragRect(null);
      stopAutoScroll();
      document.body.classList.remove('feishu-box-select-dragging');
      editorAreaRef.current?.removeAttribute('data-selection-mode');
    };

    document.addEventListener('pointermove', onDocPointerMove, true);
    document.addEventListener('pointerup', onDocPointerUp, true);
    document.addEventListener('pointercancel', onDocPointerCancel, true);
    return () => {
      document.removeEventListener('pointermove', onDocPointerMove, true);
      document.removeEventListener('pointerup', onDocPointerUp, true);
      document.removeEventListener('pointercancel', onDocPointerCancel, true);
      document.body.classList.remove('feishu-box-select-dragging');
      stopAutoScroll();
    };
  }, [beginDrag, clearSelection, editorAreaRef, editorContainerRef, ensureAutoScroll, finalizeSelection, readOnly, selectUnits, stopAutoScroll, syncSelectionBands, updateDragOverlay]);

  useEffect(() => {
    if (readOnly || !editor) return;
    const area = editorAreaRef.current;
    const container = editorContainerRef.current ?? area;
    if (!area || !container) return;
    const pointerHost = getMarqueePointerHost(container, area);

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || isUiChrome(e.target)) return;
      if (!pointerHost.contains(e.target as Node)) return;

      if (e.shiftKey && selectedRef.current.length > 0) {
        const unit = findSelectableUnitAtPoint(editor, e.clientX, e.clientY);
        const anchorId = shiftAnchorIdRef.current || selectedRef.current[0]?.id;
        const allUnits = collectSelectableUnits(editor);
        const anchorIndex = allUnits.findIndex(item => item.id === anchorId);
        const targetIndex = unit ? allUnits.findIndex(item => item.id === unit.id) : -1;
        if (anchorIndex >= 0 && targetIndex >= 0) {
          e.preventDefault();
          const [from, to] = anchorIndex < targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
          const rangeUnits = allUnits.slice(from, to + 1);
          selectUnits(rangeUnits);
          applyBoxSelectionToEditor(editor, rangeUnits);
          return;
        }
      }

      const unitAtPoint = findSelectableUnitAtPoint(editor, e.clientX, e.clientY);
      const targetElement = e.target instanceof Element
        ? e.target
        : e.target instanceof Text ? e.target.parentElement : null;
      if (
        unitAtPoint
        && isListSelectableUnit(unitAtPoint)
        && targetElement
        && isListItemTextArea(targetElement)
        && !isListItemEmpty(unitAtPoint.dom)
        && !isListTextPoint(targetElement, e.clientX, e.clientY)
      ) {
        if (selectedRef.current.length > 0) clearSelection();
        e.preventDefault();
        pointerHost.setPointerCapture?.(e.pointerId);
        pendingDragRef.current = { startX: e.clientX, startY: e.clientY, pointerId: e.pointerId };
        return;
      }

      const canStart = canStartBoxSelect(e.target, area, e.clientX, e.clientY, pointerHost);

      if (!canStart) {
        if (selectedRef.current.length > 0) {
          clearSelection();
          disarm();
        }
        return;
      }

      if (selectedRef.current.length > 0) {
        clearSelection();
      }

      pointerHost.setPointerCapture?.(e.pointerId);
      pendingDragRef.current = { startX: e.clientX, startY: e.clientY, pointerId: e.pointerId };
    };

    pointerHost.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      pointerHost.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [beginDrag, clearSelection, disarm, editor, editorAreaRef, editorContainerRef, readOnly]);

  useEffect(() => {
    if (!editor) return;
    const resync = () => {
      if (selectedRef.current.length > 0) syncSelectionBands(selectedRef.current);
    };
    window.addEventListener('resize', resync);
    document.addEventListener('scroll', resync, true);
    editor.on('update', resync);
    return () => {
      window.removeEventListener('resize', resync);
      document.removeEventListener('scroll', resync, true);
      editor.off('update', resync);
    };
  }, [editor, syncSelectionBands]);

  useEffect(() => {
    if (readOnly) {
      clearSelection();
      disarm();
    }
  }, [clearSelection, disarm, readOnly]);

  if (readOnly) return null;

  return (
    <div
      className={`feishu-box-selection-layer${dragging ? ' feishu-box-selection-layer--dragging' : ''}${selectedUnits.length > 0 ? ' feishu-box-selection-layer--has-selection' : ''}`}
      aria-hidden
    >
      {dragRect && (
        <div
          className="feishu-box-selection-rect"
          style={{
            top: dragRect.top,
            left: dragRect.left,
            width: dragRect.width,
            height: dragRect.height,
          }}
        />
      )}
      {selectionBands.map(band => (
        <div
          key={band.id}
          className="feishu-box-selection-band"
          style={{
            top: band.top,
            left: band.left,
            width: band.width,
            height: band.height,
          }}
        />
      ))}
    </div>
  );
}
