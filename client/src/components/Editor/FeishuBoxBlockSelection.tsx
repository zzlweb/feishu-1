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
  canArmBoxSelect,
  canStartBoxSelect,
  deleteSelectableUnits,
  findUnitsInClientRect,
  measureUnitBand,
  normalizeClientRect,
  setBoxSelectionStore,
  type ClientRect,
  type SelectableUnit,
} from './boxSelectionModel';
import './FeishuBoxBlockSelection.less';

const ARM_TIMEOUT_MS = 5000;
const MIN_DRAG_PX = 3;

interface DragState {
  startX: number;
  startY: number;
}

interface Props {
  editor: Editor | null;
  editorAreaRef: RefObject<HTMLDivElement | null>;
  readOnly?: boolean;
}

function isUiChrome(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(
    '.block-inline-tools, .feishu-table-chrome, .context-menu, .context-submenu-flyout, .context-add-below-flyout, .slash-menu, .selection-bubble, .editor-page-link-pop, .feishu-box-selection-layer',
  ));
}

export default function BoxBlockSelectionLayer({ editor, editorAreaRef, readOnly }: Props) {
  const [armed, setArmed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragRect, setDragRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [selectedUnits, setSelectedUnits] = useState<SelectableUnit[]>([]);
  const [selectionBands, setSelectionBands] = useState<Array<{ id: string; top: number; left: number; width: number; height: number }>>([]);

  const armedRef = useRef(false);
  const draggingRef = useRef(false);
  const dragRef = useRef<DragState | null>(null);
  const selectedRef = useRef<SelectableUnit[]>([]);
  const armTimerRef = useRef<number | null>(null);

  const editorRef = useRef(editor);
  editorRef.current = editor;

  const clearSelection = useCallback(() => {
    selectedRef.current = [];
    setSelectedUnits([]);
    setSelectionBands([]);
    setDragRect(null);
    dragRef.current = null;
    draggingRef.current = false;
    setDragging(false);
    document.body.classList.remove('feishu-box-select-dragging');
  }, []);

  const disarm = useCallback(() => {
    armedRef.current = false;
    setArmed(false);
    editorAreaRef.current?.classList.remove('feishu-box-select-armed');
    if (armTimerRef.current != null) {
      window.clearTimeout(armTimerRef.current);
      armTimerRef.current = null;
    }
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

  const finalizeSelection = useCallback((clientRect: ClientRect) => {
    const ed = editorRef.current;
    if (!ed) return;
    const units = findUnitsInClientRect(ed, clientRect);
    selectedRef.current = units;
    setSelectedUnits(units);
    syncSelectionBands(units);
    document.body.classList.remove('feishu-box-select-dragging');
    if (units.length > 0) {
      ed.view.focus();
    }
  }, [syncSelectionBands]);

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

  const beginDrag = useCallback((clientX: number, clientY: number) => {
    disarm();
    draggingRef.current = true;
    setDragging(true);
    dragRef.current = { startX: clientX, startY: clientY };
    document.body.classList.add('feishu-box-select-dragging');
    updateDragOverlay({
      left: clientX,
      top: clientY,
      right: clientX,
      bottom: clientY,
    });
  }, [disarm, updateDragOverlay]);

  const armBoxSelect = useCallback(() => {
    armedRef.current = true;
    setArmed(true);
    editorAreaRef.current?.classList.add('feishu-box-select-armed');
    if (armTimerRef.current != null) window.clearTimeout(armTimerRef.current);
    armTimerRef.current = window.setTimeout(() => {
      armTimerRef.current = null;
      disarm();
    }, ARM_TIMEOUT_MS);
  }, [disarm, editorAreaRef]);

  useLayoutEffect(() => {
    setBoxSelectionStore({
      getSelectedUnits: () => selectedRef.current,
      clearSelection: () => {
        clearSelection();
        disarm();
      },
      isActive: () => selectedRef.current.length > 0,
    });
    return () => setBoxSelectionStore(null);
  }, [clearSelection, disarm]);

  useEffect(() => {
    if (readOnly) return;

    const onDocMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current || !dragRef.current) return;
      e.preventDefault();
      const rect = normalizeClientRect(
        { left: dragRef.current.startX, top: dragRef.current.startY, right: dragRef.current.startX, bottom: dragRef.current.startY },
        { left: e.clientX, top: e.clientY, right: e.clientX, bottom: e.clientY },
      );
      updateDragOverlay(rect);
    };

    const onDocMouseUp = (e: MouseEvent) => {
      if (!draggingRef.current || !dragRef.current) return;

      const rect = normalizeClientRect(
        { left: dragRef.current.startX, top: dragRef.current.startY, right: dragRef.current.startX, bottom: dragRef.current.startY },
        { left: e.clientX, top: e.clientY, right: e.clientX, bottom: e.clientY },
      );

      draggingRef.current = false;
      setDragging(false);
      dragRef.current = null;
      setDragRect(null);

      const w = rect.right - rect.left;
      const h = rect.bottom - rect.top;
      if (w >= MIN_DRAG_PX || h >= MIN_DRAG_PX) {
        finalizeSelection(rect);
      } else {
        syncSelectionBands([]);
        document.body.classList.remove('feishu-box-select-dragging');
      }
    };

    document.addEventListener('mousemove', onDocMouseMove, true);
    document.addEventListener('mouseup', onDocMouseUp, true);
    return () => {
      document.removeEventListener('mousemove', onDocMouseMove, true);
      document.removeEventListener('mouseup', onDocMouseUp, true);
      document.body.classList.remove('feishu-box-select-dragging');
    };
  }, [finalizeSelection, readOnly, syncSelectionBands, updateDragOverlay]);

  useEffect(() => {
    if (readOnly || !editor) return;
    const area = editorAreaRef.current;
    if (!area) return;

    const onDoubleClick = (e: MouseEvent) => {
      if (isUiChrome(e.target)) return;
      if (!canArmBoxSelect(e.target, area)) return;
      e.preventDefault();
      e.stopPropagation();
      clearSelection();
      armBoxSelect();
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || isUiChrome(e.target)) return;

      const canStart = armedRef.current || canStartBoxSelect(e.target, area, e.clientY);

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

      e.preventDefault();
      e.stopPropagation();
      beginDrag(e.clientX, e.clientY);
    };

    area.addEventListener('dblclick', onDoubleClick, true);
    area.addEventListener('mousedown', onMouseDown, true);
    return () => {
      area.removeEventListener('dblclick', onDoubleClick, true);
      area.removeEventListener('mousedown', onMouseDown, true);
    };
  }, [armBoxSelect, beginDrag, clearSelection, disarm, editor, editorAreaRef, readOnly]);

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
      className={`feishu-box-selection-layer${armed ? ' feishu-box-selection-layer--armed' : ''}${dragging ? ' feishu-box-selection-layer--dragging' : ''}${selectedUnits.length > 0 ? ' feishu-box-selection-layer--has-selection' : ''}`}
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
