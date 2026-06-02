import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { valueText, type BaseField, type BaseRecord, type BaseTable, type BaseView, type CellValue, type GridViewConfig, type SelectChoice } from './bitableModel';
import { createPortal } from 'react-dom';
import type { Ref } from 'react';
import { BitableGridCellExpand } from './BitableGridCellExpand';
import { GridFieldHeader, GridFieldMenuIcon, attachmentCellLabel } from './BitableViewShared';

export interface GridFieldMenuPosition {
  left: number;
  top: number;
  anchorLeft: number;
  anchorTop: number;
}

export type GridFieldMenuAction =
  | 'rename'
  | 'description'
  | 'duplicate'
  | 'hide'
  | 'insertLeft'
  | 'insertRight'
  | 'sortAsc'
  | 'sortDesc'
  | 'group'
  | 'filter'
  | 'delete';

export interface BitableGridViewProps {
  table: BaseTable;
  activeView: BaseView;
  records: BaseRecord[];
  selectedIds: Set<string>;
  addField: () => void;
  addRecord: () => string;
  insertRecordAt?: (index: number, count: number, initialTitle?: string) => string[];
  removeRecords?: (recordIds: string[], requireConfirm?: boolean) => void;
  changeCell: (recordId: string, fieldId: string, value: CellValue) => void;
  pickFiles: (recordId: string, fieldId?: string) => void;
  toggleRecordSelection: (recordId: string) => void;
  toggleAllRecordSelection: () => void;
  reorderRecords: (fromIndex: number, toIndex: number) => void;
  openRecord?: (recordId: string) => void;
  onFocusedRecordChange?: (recordId: string | null) => void;
  onOpenComment?: (recordId: string) => void;
  selectBlock: () => void;
  onFieldMenuAction: (fieldId: string, action: GridFieldMenuAction, position?: GridFieldMenuPosition) => void;
  onColumnWidthChange: (fieldId: string, width: number) => void;
}

const INDEX_WIDTH = 56;
const ADD_FIELD_WIDTH = 54;
const DEFAULT_FIELD_WIDTH = 160;
const MIN_FIELD_WIDTH = 80;
const MAX_FIELD_WIDTH = 420;
const HEADER_HEIGHT = 32;
const ROW_HEIGHT = 32;
const RESIZE_HIT_WIDTH = 10;

function GridFieldContextMenu({
  menuRef,
  field,
  isPrimaryField,
  canDelete,
  left,
  top,
  onAction,
}: {
  menuRef: Ref<HTMLDivElement>;
  field: BaseField;
  isPrimaryField: boolean;
  canDelete: boolean;
  left: number;
  top: number;
  onAction: (fieldId: string, action: GridFieldMenuAction) => void;
}) {
  const run = (action: GridFieldMenuAction) => onAction(field.id, action);

  return (
    <div
      ref={menuRef}
      id="bitable-contextmenu"
      className={`base-grid-field-menu bitable-contextmenu${isPrimaryField ? ' is-primary-field' : ''}`}
      style={{ left, top }}
      data-no-marquee-selection="true"
      data-floating-panel="true"
      role="menu"
    >
      <button type="button" role="menuitem" onClick={() => run('rename')}><GridFieldMenuIcon name="rename" />修改字段/列</button>
      <button type="button" role="menuitem" onClick={() => run('description')}><GridFieldMenuIcon name="description" />编辑字段/列描述</button>
      <button type="button" role="menuitem" onClick={() => run('duplicate')}><GridFieldMenuIcon name="duplicate" />复制字段/列</button>
      {!isPrimaryField && (
        <button type="button" role="menuitem" onClick={() => run('hide')}><GridFieldMenuIcon name="hide" />隐藏字段</button>
      )}
      <div className="base-grid-field-menu__divider" role="separator" />
      {!isPrimaryField && (
        <button type="button" role="menuitem" onClick={() => run('insertLeft')}><GridFieldMenuIcon name="insertLeft" />向左插入字段/列</button>
      )}
      <button type="button" role="menuitem" onClick={() => run('insertRight')}><GridFieldMenuIcon name="insertRight" />向右插入字段/列</button>
      <div className="base-grid-field-menu__divider" role="separator" />
      <button type="button" role="menuitem" onClick={() => run('sortAsc')}>
        <GridFieldMenuIcon name="sortAsc" />
        <span className="base-grid-field-menu__label">
          按<span className="base-grid-field-menu__order">A 到 Z</span>排序
        </span>
      </button>
      <button type="button" role="menuitem" onClick={() => run('sortDesc')}>
        <GridFieldMenuIcon name="sortDesc" />
        <span className="base-grid-field-menu__label">
          按<span className="base-grid-field-menu__order">Z 到 A</span>排序
        </span>
      </button>
      <div className="base-grid-field-menu__divider" role="separator" />
      <button type="button" role="menuitem" onClick={() => run('group')}>
        <GridFieldMenuIcon name="group" />
        <span className="base-grid-field-menu__label">
          按<span className="base-grid-field-menu__field-name">{field.name}</span>分组
        </span>
      </button>
      <button type="button" role="menuitem" onClick={() => run('filter')}>
        <GridFieldMenuIcon name="filter" />
        <span className="base-grid-field-menu__label">
          按<span className="base-grid-field-menu__field-name">{field.name}</span>筛选
        </span>
      </button>
      {!isPrimaryField && (
        <>
          <div className="base-grid-field-menu__divider" role="separator" />
          <button type="button" role="menuitem" disabled={!canDelete} onClick={() => run('delete')}>
            <GridFieldMenuIcon name="delete" />删除字段/列
          </button>
        </>
      )}
    </div>
  );
}

function GridCellContextMenu({
  menuRef,
  left,
  top,
  onInsertAbove,
  onInsertBelow,
  onViewDetails,
  onAddChildRecord,
  onAddComment,
  onDeleteRecord,
}: {
  menuRef: RefObject<HTMLDivElement>;
  left: number;
  top: number;
  onInsertAbove: (count: number) => void;
  onInsertBelow: (count: number) => void;
  onViewDetails: () => void;
  onAddChildRecord: () => void;
  onAddComment: () => void;
  onDeleteRecord: () => void;
}) {
  const [aboveCount, setAboveCount] = useState('1');
  const [belowCount, setBelowCount] = useState('1');

  const handleAboveChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (/^\d*$/.test(val)) {
      setAboveCount(val);
    }
  };

  const handleBelowChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (/^\d*$/.test(val)) {
      setBelowCount(val);
    }
  };

  return (
    <div
      ref={menuRef}
      id="bitable-contextmenu"
      className="b-menu bitable-noselect white J-bitable-container bitable-hover-scrollbar-sm bitable-contextmenu"
      style={{ left, top, maxHeight: 'unset', overflowY: 'auto' }}
      onMouseDown={e => e.stopPropagation()}
    >
      <ul className="ud__menu ud__menu-root ud__menu-vertical ud-scrollbar" dir="ltr" role="menu" tabIndex={0} data-menu-list="true">
        <li
          className="b-menu__item"
          role="menuitem"
          onClick={() => {
            const count = parseInt(aboveCount, 10) || 1;
            onInsertAbove(count);
          }}
        >
          <span className="universe-icon icon rotate-270">
            <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" data-icon="InsertRightOutlined">
              <path d="M23.147 12.64a.8.8 0 0 0 0-1.28l-5.867-4.4A.8.8 0 0 0 16 7.6V11H2a1 1 0 0 0 0 2h14v3.4a.8.8 0 0 0 1.28.64l5.867-4.4Z" fill="currentColor"></path>
            </svg>
          </span>
          <span>
            向上插入{' '}
            <input
              className="bitable-input-number sheet-menu__input-number"
              value={aboveCount}
              onChange={handleAboveChange}
              onMouseDown={e => e.stopPropagation()}
              onClick={e => e.stopPropagation()}
            />{' '}
            行
          </span>
        </li>
        <li
          className="b-menu__item"
          role="menuitem"
          onClick={() => {
            const count = parseInt(belowCount, 10) || 1;
            onInsertBelow(count);
          }}
        >
          <span className="universe-icon icon rotate-270">
            <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" data-icon="InsertLeftOutlined">
              <path d="M1.087 12.873a.8.8 0 0 1 0-1.28l5.866-4.4a.8.8 0 0 1 1.28.64v3.4h14a1 1 0 1 1 0 2h-14v3.4a.8.8 0 0 1-1.28.64l-5.866-4.4Z" fill="currentColor"></path>
            </svg>
          </span>
          <span>
            向下插入{' '}
            <input
              className="bitable-input-number sheet-menu__input-number"
              value={belowCount}
              onChange={handleBelowChange}
              onMouseDown={e => e.stopPropagation()}
              onClick={e => e.stopPropagation()}
            />{' '}
            行
          </span>
        </li>
        <li className="ud__menu-item-divider b-menu__divider" role="separator"></li>
        <li className="b-menu__item" role="menuitem" onClick={onViewDetails}>
          <span className="universe-icon icon">
            <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" data-icon="MultipleWindowsCenterOutlined">
              <path d="M18 9a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9Z" fill="currentColor"></path>
              <path d="M1 19a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v14ZM21 5v14H3V5h18Z" fill="currentColor"></path>
            </svg>
          </span>
          查看详情
        </li>
        <li className="b-menu__item" role="menuitem" onClick={onAddChildRecord}>
          <span className="universe-icon icon">
            <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" data-icon="TaskviewCountOutlined">
              <path d="M4.003 4.01v13.025a3 3 0 0 0 3 3h7.188a3.335 3.335 0 0 0 6.505-1.03 3.333 3.333 0 0 0-6.523-.97h-7.17a1 1 0 0 1-1-1v-6.037h8.23a3.335 3.335 0 0 0 6.434-1.23 3.333 3.333 0 0 0-6.577-.77H6.003V4.01a1 1 0 1 0-2 0Zm13.36 16.461a1.467 1.467 0 1 1 0-2.933 1.467 1.467 0 0 1 0 2.933ZM18.8 9.77a1.467 1.467 0 1 1-2.933 0 1.467 1.467 0 0 1 2.933 0Z" fill="currentColor"></path>
            </svg>
          </span>
          添加子记录
        </li>
        <li className="b-menu__item" role="menuitem" onClick={onAddComment}>
          <span className="universe-icon icon">
            <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" data-icon="AddCommentOutlined">
              <path d="M7 11a1 1 0 0 1 1-1h8a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1Z" fill="currentColor"></path>
              <path d="M2 5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v11.5a2 2 0 0 1-2 2h-3.812a.5.5 0 0 0-.33.124l-2.541 2.224a2 2 0 0 1-2.634 0l-2.542-2.224a.5.5 0 0 0-.329-.124H4a2 2 0 0 1-2-2V5Zm2 0v11.5h3.812a2.5 2.5 0 0 1 1.646.619L12 19.343l2.542-2.224a2.5 2.5 0 0 1 1.646-.619H20V5H4Z" fill="currentColor"></path>
            </svg>
          </span>
          添加评论
        </li>
        <li className="ud__menu-item-divider b-menu__divider" role="separator"></li>
        <li className="b-menu__item" role="menuitem" onClick={onDeleteRecord}>
          <span className="universe-icon icon">
            <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" data-icon="DeleteTrashOutlined">
              <path d="M8 4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2h5a1 1 0 1 1 0 2h-1v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6H3a1 1 0 0 1 0-2h5ZM6 6v14h12V6H6Zm4 3a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1Zm4 0a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1Z" fill="currentColor"></path>
            </svg>
          </span>
          删除记录
        </li>
      </ul>
    </div>
  );
}

type GridColumn = { field: BaseField; left: number; width: number };
type EditingCell = { recordId: string; fieldId: string; left: number; top: number; width: number; value: string };
type SelectedCell = { recordId: string; fieldId: string; rowIndex: number };
type SelectEditor = {
  recordId: string;
  fieldId: string;
  left: number;
  top: number;
  width: number;
  value: string;
  query: string;
};
type ResizeState = { fieldId: string; startX: number; startWidth: number; width: number };

function clampWidth(width: number) {
  return Math.max(MIN_FIELD_WIDTH, Math.min(MAX_FIELD_WIDTH, Math.round(width)));
}

function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number) {
  if (maxWidth <= 0 || !text) return;
  let value = text;
  if (ctx.measureText(value).width <= maxWidth) {
    ctx.fillText(value, x, y);
    return;
  }
  while (value.length > 1 && ctx.measureText(`${value}...`).width > maxWidth) value = value.slice(0, -1);
  ctx.fillText(`${value}...`, x, y);
}

function textColorForBackground(background: string) {
  const hex = background.replace('#', '');
  if (hex.length !== 6) return '#1f2329';
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 170 ? '#1f2329' : '#fff';
}

function findChoice(field: BaseField, value: string): SelectChoice | null {
  return field.options?.choices?.find(choice => choice.name === value) ?? null;
}

function isSelectField(field: BaseField) {
  return field.type === 'single_select' || field.type === 'multi_select';
}

function getSelectValues(record: BaseRecord, field: BaseField): string[] {
  const value = record.fields[field.id];
  if (field.type === 'multi_select') {
    if (Array.isArray(value) && value.length && typeof value[0] !== 'object') {
      return (value as string[]).map(item => String(item).trim()).filter(Boolean);
    }
    return valueText(value).split(',').map(item => item.trim()).filter(Boolean);
  }
  const text = valueText(value);
  return text ? [text] : [];
}

function drawChevron(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.strokeStyle = '#646a73';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - 4, y - 2);
  ctx.lineTo(x, y + 2);
  ctx.lineTo(x + 4, y - 2);
  ctx.stroke();
}

function findColumn(columns: GridColumn[], x: number) {
  return columns.find(column => x >= column.left && x < column.left + column.width) || null;
}

function findResizeColumn(columns: GridColumn[], x: number) {
  return columns.find(column => Math.abs(x - (column.left + column.width)) <= RESIZE_HIT_WIDTH / 2) || null;
}

function pointFromCanvas(event: ReactPointerEvent<HTMLCanvasElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function rowIndexFromClientY(shell: HTMLDivElement | null, clientY: number, recordCount: number) {
  const canvas = shell?.querySelector('.base-grid-canvas');
  const rect = canvas?.getBoundingClientRect();
  if (!rect) return null;
  const y = clientY - rect.top - HEADER_HEIGHT;
  const index = Math.floor(y / ROW_HEIGHT);
  if (index < 0 || index >= recordCount) return null;
  return index;
}

export function BitableGridView({
  table,
  activeView,
  records,
  selectedIds,
  addField,
  addRecord,
  insertRecordAt,
  removeRecords,
  changeCell,
  pickFiles,
  toggleRecordSelection,
  toggleAllRecordSelection,
  reorderRecords,
  openRecord,
  onFocusedRecordChange,
  onOpenComment,
  selectBlock,
  onFieldMenuAction,
  onColumnWidthChange,
}: BitableGridViewProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const cellMenuRef = useRef<HTMLDivElement>(null);
  const selectEditorRef = useRef<HTMLDivElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const pendingCellFocusRef = useRef<{ recordId: string; fieldId: string } | null>(null);
  const [fieldMenu, setFieldMenu] = useState<{ fieldId: string; left: number; top: number; columnLeft: number } | null>(null);
  const [cellContextMenu, setCellContextMenu] = useState<{
    recordId: string;
    rowIndex: number;
    left: number;
    top: number;
  } | null>(null);
  const [hoverRow, setHoverRow] = useState<number | null>(null);
  const [hoverCell, setHoverCell] = useState<{ rowIndex: number; fieldId: string } | null>(null);
  const [hoverAddRow, setHoverAddRow] = useState(false);
  const [hoverHeaderFieldId, setHoverHeaderFieldId] = useState<string | null>(null);
  const [hoverResizeFieldId, setHoverResizeFieldId] = useState<string | null>(null);
  const [activeResize, setActiveResize] = useState<ResizeState | null>(null);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [selectEditor, setSelectEditor] = useState<SelectEditor | null>(null);
  const [rowDrag, setRowDrag] = useState<{ fromIndex: number; overIndex: number } | null>(null);
  const visibleFields = table.fields.filter(field => !(activeView.hiddenFieldIds || []).includes(field.id));
  const isAllSelected = records.length > 0 && selectedIds.size === records.length;
  const isPartiallySelected = selectedIds.size > 0 && selectedIds.size < records.length;
  const addRowIndex = records.length;
  const rowCount = addRowIndex + 1;
  const gridBodyBottom = HEADER_HEIGHT + rowCount * ROW_HEIGHT;
  const gridConfig = activeView.config as GridViewConfig;
  const fieldWidths = gridConfig.fieldWidths || {};
  const menuField = fieldMenu ? visibleFields.find(field => field.id === fieldMenu.fieldId) : null;

  const columns = useMemo(() => {
    let left = INDEX_WIDTH;
    return visibleFields.map(field => {
      const width = activeResize?.fieldId === field.id ? activeResize.width : clampWidth(Number(fieldWidths[field.id]) || DEFAULT_FIELD_WIDTH);
      const column = { field, left, width };
      left += width;
      return column;
    });
  }, [activeResize, fieldWidths, visibleFields]);

  const canvasWidth = Math.max(INDEX_WIDTH + ADD_FIELD_WIDTH, INDEX_WIDTH + ADD_FIELD_WIDTH + columns.reduce((sum, column) => sum + column.width, 0));
  const dataWidth = columns.length > 0 ? columns[columns.length - 1].left + columns[columns.length - 1].width : INDEX_WIDTH;
  const canvasHeight = gridBodyBottom;

  const addFromAddRow = (column: GridColumn | null) => {
    if (activeView.locked) return;
    const recordId = addRecord();
    const focusColumn = column ?? columns.find(item => item.field.id === table.primaryFieldId) ?? columns[0];
    if (focusColumn) pendingCellFocusRef.current = { recordId, fieldId: focusColumn.field.id };
  };

  useEffect(() => {
    if (!fieldMenu) return;
    const close = (event: globalThis.MouseEvent) => {
      if (!(event.target instanceof Node)) return;
      if (menuRef.current?.contains(event.target)) return;
      setFieldMenu(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [fieldMenu]);

  useEffect(() => {
    if (!selectEditor) return;
    const close = (event: globalThis.MouseEvent) => {
      if (!(event.target instanceof Node)) return;
      if (shellRef.current?.contains(event.target)) return;
      setSelectEditor(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [selectEditor]);

  useEffect(() => {
    if (!cellContextMenu) return;
    const close = (event: globalThis.MouseEvent) => {
      if (!(event.target instanceof Node)) return;
      if (cellMenuRef.current?.contains(event.target)) return;
      setCellContextMenu(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [cellContextMenu]);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editingCell?.recordId, editingCell?.fieldId]);

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = isPartiallySelected;
  }, [isPartiallySelected]);

  useEffect(() => {
    onFocusedRecordChange?.(selectedCell?.recordId ?? null);
  }, [onFocusedRecordChange, selectedCell?.recordId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(canvasWidth * dpr);
    canvas.height = Math.round(canvasHeight * dpr);
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    records.forEach((record, rowIndex) => {
      if (selectedIds.has(record.id)) {
        ctx.fillStyle = '#e8f3ff';
        ctx.fillRect(0, HEADER_HEIGHT + rowIndex * ROW_HEIGHT, dataWidth, ROW_HEIGHT);
      }
    });

    if (rowDrag) {
      const markerY = HEADER_HEIGHT + rowDrag.overIndex * ROW_HEIGHT;
      ctx.fillStyle = '#3370ff';
      ctx.fillRect(0, markerY - 1, dataWidth, 2);
    }

    if (hoverRow != null && hoverRow >= 0 && hoverRow < records.length && !selectedIds.has(records[hoverRow].id)) {
      ctx.fillStyle = '#f2f3f5';
      ctx.fillRect(0, HEADER_HEIGHT + hoverRow * ROW_HEIGHT, dataWidth, ROW_HEIGHT);
    }

    if (hoverHeaderFieldId) {
      const headerColumn = columns.find(column => column.field.id === hoverHeaderFieldId);
      if (headerColumn) {
        ctx.fillStyle = '#f2f3f5';
        ctx.fillRect(headerColumn.left, 0, headerColumn.width, HEADER_HEIGHT);
      }
    }

    ctx.strokeStyle = '#dee0e3';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const verticals = [0, ...columns.map(column => column.left + column.width)];
    verticals.forEach(x => {
      const crisp = Math.round(x) + 0.5;
      ctx.moveTo(crisp, 0);
      ctx.lineTo(crisp, canvasHeight);
    });
    for (let row = 0; row <= rowCount + 2; row += 1) {
      const y = Math.round(HEADER_HEIGHT + row * ROW_HEIGHT) + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(dataWidth, y);
    }
    ctx.moveTo(0.5, 0.5);
    ctx.lineTo(dataWidth - 0.5, 0.5);
    ctx.stroke();

    columns.forEach(column => {
      if (hoverResizeFieldId === column.field.id || activeResize?.fieldId === column.field.id) {
        ctx.strokeStyle = '#3370ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(column.left + column.width + 0.5, 0);
        ctx.lineTo(column.left + column.width + 0.5, gridBodyBottom);
        ctx.stroke();
        ctx.strokeStyle = '#8f959e';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(column.left + column.width - 3, 7);
        ctx.lineTo(column.left + column.width - 3, 25);
        ctx.moveTo(column.left + column.width + 3, 7);
        ctx.lineTo(column.left + column.width + 3, 25);
        ctx.stroke();
      }
    });

    ctx.font = '13px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textBaseline = 'middle';
    records.forEach((record, rowIndex) => {
      const y = HEADER_HEIGHT + rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
      ctx.font = '13px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      columns.forEach(column => {
        const text = column.field.type === 'attachment'
          ? attachmentCellLabel(record, column.field.id)
          : valueText(record.fields[column.field.id]);
        if (isSelectField(column.field)) {
          const values = getSelectValues(record, column.field);
          const isSelected = selectedCell?.recordId === record.id && selectedCell?.fieldId === column.field.id;
          const isEditingSelect = selectEditor?.recordId === record.id && selectEditor?.fieldId === column.field.id;
          const isHovered = hoverCell?.rowIndex === rowIndex && hoverCell?.fieldId === column.field.id;
          if (values.length || isSelected || isEditingSelect || isHovered) drawChevron(ctx, column.left + column.width - 14, y);
        } else {
          ctx.fillStyle = column.field.type === 'attachment' ? '#646a73' : '#1f2329';
          drawText(ctx, text, column.left + 10, y, column.width - 20);
        }
      });
    });

    if (selectedCell) {
      const column = columns.find(item => item.field.id === selectedCell.fieldId);
      if (column) {
        const x = Math.round(column.left);
        const y = Math.round(HEADER_HEIGHT + selectedCell.rowIndex * ROW_HEIGHT);
        ctx.strokeStyle = '#3370ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, column.width - 2, ROW_HEIGHT - 2);
      }
    }

    if (hoverAddRow) {
      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(0, HEADER_HEIGHT + addRowIndex * ROW_HEIGHT, dataWidth, ROW_HEIGHT);
    }

    const indexCenterX = INDEX_WIDTH / 2;
    const addRowY = HEADER_HEIGHT + addRowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8f959e';
    ctx.font = '16px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText('+', indexCenterX, addRowY);
    ctx.textAlign = 'left';

  }, [activeResize, addRowIndex, canvasHeight, canvasWidth, dataWidth, columns, gridBodyBottom, hoverAddRow, hoverCell, hoverHeaderFieldId, hoverResizeFieldId, hoverRow, records, rowCount, rowDrag, selectEditor, selectedCell, selectedIds]);

  const commitEditingCell = () => {
    if (!editingCell) return;
    changeCell(editingCell.recordId, editingCell.fieldId, editingCell.value);
    setEditingCell(null);
  };

  const openSelectEditor = (record: BaseRecord, column: GridColumn, rowIndex: number) => {
    if (activeView.locked) return;
    setSelectEditor({
      recordId: record.id,
      fieldId: column.field.id,
      left: column.left,
      top: HEADER_HEIGHT + rowIndex * ROW_HEIGHT + ROW_HEIGHT,
      width: column.width,
      value: valueText(record.fields[column.field.id]),
      query: '',
    });
  };

  const openFieldMenuAt = (fieldId: string, menuLeft: number, menuTop: number, columnLeft: number) => {
    setFieldMenu(current => current?.fieldId === fieldId
      ? null
      : { fieldId, left: Math.max(0, menuLeft - 170), top: menuTop + 6, columnLeft });
  };

  const clearSelectValue = (record: BaseRecord, field: BaseField, valueToRemove: string) => {
    if (field.type === 'single_select') {
      changeCell(record.id, field.id, '');
      return;
    }
    changeCell(record.id, field.id, getSelectValues(record, field).filter(item => item !== valueToRemove));
  };

  const startEditing = (record: BaseRecord, column: GridColumn, rowIndex: number) => {
    if (activeView.locked || column.field.type === 'attachment' || isSelectField(column.field)) return;
    setEditingCell({
      recordId: record.id,
      fieldId: column.field.id,
      left: column.left,
      top: HEADER_HEIGHT + rowIndex * ROW_HEIGHT,
      width: column.width,
      value: valueText(record.fields[column.field.id]),
    });
  };

  useEffect(() => {
    const pending = pendingCellFocusRef.current;
    if (!pending) return;
    const rowIndex = records.findIndex(record => record.id === pending.recordId);
    if (rowIndex < 0) return;
    const column = columns.find(item => item.field.id === pending.fieldId);
    const record = records[rowIndex];
    if (!column || !record) return;
    pendingCellFocusRef.current = null;
    setSelectedCell({ recordId: record.id, fieldId: column.field.id, rowIndex });
    if (column.field.type === 'attachment') {
      pickFiles(record.id, column.field.id);
      return;
    }
    if (isSelectField(column.field)) {
      openSelectEditor(record, column, rowIndex);
      return;
    }
    startEditing(record, column, rowIndex);
  }, [records, columns]);

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const point = pointFromCanvas(event);
    if (activeResize) {
      const width = clampWidth(activeResize.startWidth + event.clientX - activeResize.startX);
      setActiveResize(current => current ? { ...current, width } : current);
      return;
    }
    const resizeColumn = point.y < HEADER_HEIGHT ? findResizeColumn(columns, point.x) : null;
    setHoverResizeFieldId(resizeColumn?.field.id || null);
    if (point.y < HEADER_HEIGHT && point.x < dataWidth) {
      setHoverHeaderFieldId(findColumn(columns, point.x)?.field.id ?? null);
    } else {
      setHoverHeaderFieldId(null);
    }
    const rowIndex = Math.floor((point.y - HEADER_HEIGHT) / ROW_HEIGHT);
    if (point.y >= HEADER_HEIGHT && rowIndex === addRowIndex) {
      setHoverAddRow(true);
      setHoverRow(null);
      setHoverCell(null);
      event.currentTarget.style.cursor = point.x < INDEX_WIDTH ? 'pointer' : 'default';
      return;
    }
    setHoverAddRow(false);
    const nextHoverRow = point.y >= HEADER_HEIGHT && rowIndex >= 0 && rowIndex < records.length ? rowIndex : null;
    setHoverRow(nextHoverRow);
    if (nextHoverRow != null && point.x >= INDEX_WIDTH && point.x < dataWidth) {
      const column = findColumn(columns, point.x);
      setHoverCell(column ? { rowIndex: nextHoverRow, fieldId: column.field.id } : null);
    } else {
      setHoverCell(null);
    }
    event.currentTarget.style.cursor = resizeColumn ? 'ew-resize' : 'default';
  };

  const handlePointerLeave = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.relatedTarget instanceof Node && shellRef.current?.contains(event.relatedTarget)) return;
    if (!activeResize) {
      setHoverRow(null);
      setHoverCell(null);
      setHoverAddRow(false);
      setHoverHeaderFieldId(null);
      setHoverResizeFieldId(null);
      event.currentTarget.style.cursor = 'default';
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    const point = pointFromCanvas(event);
    const resizeColumn = point.y < gridBodyBottom ? findResizeColumn(columns, point.x) : null;
    if (resizeColumn) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setActiveResize({ fieldId: resizeColumn.field.id, startX: event.clientX, startWidth: resizeColumn.width, width: resizeColumn.width });
      setEditingCell(null);
      return;
    }
    if (editingCell) commitEditingCell();
    setFieldMenu(null);
    setSelectEditor(null);
    setCellContextMenu(null);
    if (point.y < HEADER_HEIGHT) return;
    const rowIndex = Math.floor((point.y - HEADER_HEIGHT) / ROW_HEIGHT);
    if (rowIndex < 0) return;
    if (rowIndex === addRowIndex) {
      if (point.x < INDEX_WIDTH) addFromAddRow(null);
      return;
    }
    const record = records[rowIndex];
    if (point.x < INDEX_WIDTH) {
      setSelectedCell(null);
      return;
    }
    if (point.x >= dataWidth) {
      selectBlock();
      return;
    }
    const column = findColumn(columns, point.x);
    if (!column) return;
    setSelectedCell({ recordId: record.id, fieldId: column.field.id, rowIndex });
    if (column.field.type === 'attachment') {
      pickFiles(record.id, column.field.id);
      return;
    }
    if (isSelectField(column.field)) {
      openSelectEditor(record, column, rowIndex);
      return;
    }
    startEditing(record, column, rowIndex);
  };

  const handleContextMenu = (event: React.MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (editingCell) commitEditingCell();
    setFieldMenu(null);
    setSelectEditor(null);

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (y < HEADER_HEIGHT) return;

    const rowIndex = Math.floor((y - HEADER_HEIGHT) / ROW_HEIGHT);
    if (rowIndex < 0 || rowIndex >= records.length) return;

    const record = records[rowIndex];
    const column = findColumn(columns, x);
    if (column) {
      setSelectedCell({ recordId: record.id, fieldId: column.field.id, rowIndex });
    }

    const shellRect = shellRef.current?.getBoundingClientRect();
    if (shellRect) {
      setCellContextMenu({
        recordId: record.id,
        rowIndex,
        left: event.clientX - shellRect.left,
        top: event.clientY - shellRect.top,
      });
    }
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!activeResize) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    onColumnWidthChange(activeResize.fieldId, activeResize.width);
    setActiveResize(null);
  };

  const runFieldAction = (fieldId: string, action: GridFieldMenuAction) => {
    const shellRect = shellRef.current?.getBoundingClientRect();
    const canvasView = shellRef.current?.querySelector('.base-grid-canvas-view');
    const canvasRect = canvasView?.getBoundingClientRect();
    const position: GridFieldMenuPosition | undefined = fieldMenu && canvasRect
      ? {
          left: (shellRect?.left || 0) + fieldMenu.left,
          top: (shellRect?.top || 0) + fieldMenu.top,
          anchorLeft: canvasRect.left + fieldMenu.columnLeft,
          anchorTop: canvasRect.top,
        }
      : undefined;
    setFieldMenu(null);
    onFieldMenuAction(fieldId, action, position);
  };
  const canRemoveMenuField = Boolean(menuField && menuField.id !== table.primaryFieldId && table.fields.length > 1);
  const selectField = selectEditor ? visibleFields.find(field => field.id === selectEditor.fieldId) : null;
  const selectRecord = selectEditor ? records.find(record => record.id === selectEditor.recordId) : null;
  const selectChoices = selectField?.options?.choices?.filter(choice => choice.name.trim()) ?? [];
  const filteredSelectChoices = selectEditor
    ? selectChoices.filter(choice => choice.name.toLowerCase().includes(selectEditor.query.trim().toLowerCase()))
    : [];
  const selectEditorPortalStyle = (() => {
    if (!selectEditor) return null;
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    const width = Math.max(188, selectEditor.width);
    const listHeight = filteredSelectChoices.length
      ? Math.min(188, filteredSelectChoices.length * 32)
      : 44;
    const panelHeight = 12 + 34 + listHeight + (selectEditor.value ? 35 : 0);
    const margin = 8;
    const rawLeft = (canvasRect?.left ?? 0) + selectEditor.left;
    const rawTop = (canvasRect?.top ?? 0) + selectEditor.top + 4;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || rawLeft + width;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || rawTop + panelHeight;
    const aboveTop = (canvasRect?.top ?? 0) + selectEditor.top - ROW_HEIGHT - panelHeight - 4;
    return {
      left: Math.max(margin, Math.min(rawLeft, viewportWidth - width - margin)),
      top: rawTop + panelHeight > viewportHeight - margin
        ? Math.max(margin, aboveTop)
        : Math.max(margin, rawTop),
      width,
    };
  })();

  return (
    <div className="base-grid-shell" ref={shellRef}>
      <div className="base-grid-scroll base-grid-canvas-scroll">
        <div className="base-grid-canvas-view" style={{ width: canvasWidth, height: canvasHeight }}>
          <canvas
            className="base-grid-canvas"
            ref={canvasRef}
            role="grid"
            aria-label="多维表格"
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onContextMenu={handleContextMenu}
          />
          <div className="base-grid-over-layer">
            <div className="base-grid-index-rail" style={{ width: INDEX_WIDTH, height: canvasHeight }}>
              <label
                className="base-grid-index-header"
                style={{ width: INDEX_WIDTH, height: HEADER_HEIGHT }}
                onMouseDown={event => event.stopPropagation()}
              >
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  className="base-grid-index-checkbox"
                  checked={isAllSelected}
                  disabled={activeView.locked || records.length === 0}
                  onChange={() => toggleAllRecordSelection()}
                  aria-label="全选"
                />
              </label>
              {records.map((record, rowIndex) => {
                const showControls = hoverRow === rowIndex || selectedIds.has(record.id);
                return (
                  <div
                    key={record.id}
                    className={`base-grid-index-row${showControls ? ' is-active' : ''}${rowDrag?.overIndex === rowIndex ? ' is-drop-target' : ''}`}
                    style={{ top: HEADER_HEIGHT + rowIndex * ROW_HEIGHT, width: INDEX_WIDTH, height: ROW_HEIGHT }}
                    onMouseEnter={() => setHoverRow(rowIndex)}
                    onMouseLeave={() => setHoverRow(current => (current === rowIndex ? null : current))}
                    onMouseDown={event => event.stopPropagation()}
                  >
                    {showControls ? (
                      <>
                        <button
                          type="button"
                          className="base-grid-row-drag-handle"
                          aria-label={`拖拽第 ${rowIndex + 1} 行`}
                          disabled={activeView.locked}
                          onPointerDown={event => {
                            if (activeView.locked) return;
                            event.preventDefault();
                            event.stopPropagation();
                            event.currentTarget.setPointerCapture(event.pointerId);
                            setRowDrag({ fromIndex: rowIndex, overIndex: rowIndex });
                          }}
                          onPointerMove={event => {
                            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
                            const overIndex = rowIndexFromClientY(shellRef.current, event.clientY, records.length);
                            if (overIndex == null) return;
                            setRowDrag(current => current ? { ...current, overIndex } : current);
                          }}
                          onPointerUp={event => {
                            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
                            event.currentTarget.releasePointerCapture(event.pointerId);
                            setRowDrag(current => {
                              if (current) reorderRecords(current.fromIndex, current.overIndex);
                              return null;
                            });
                          }}
                          onPointerCancel={event => {
                            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                              event.currentTarget.releasePointerCapture(event.pointerId);
                            }
                            setRowDrag(null);
                          }}
                        >
                          <span className="base-grid-row-drag-handle__dots" aria-hidden />
                        </button>
                        <input
                          type="checkbox"
                          className="base-grid-index-checkbox"
                          checked={selectedIds.has(record.id)}
                          disabled={activeView.locked}
                          onChange={() => toggleRecordSelection(record.id)}
                          aria-label={`选择第 ${rowIndex + 1} 行`}
                        />
                      </>
                    ) : (
                      <span className="base-grid-index-row__number">{rowIndex + 1}</span>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                className="base-grid-add-row-hit base-grid-add-row-hit--footer"
                style={{
                  top: HEADER_HEIGHT + addRowIndex * ROW_HEIGHT,
                  left: 0,
                  width: INDEX_WIDTH,
                  height: ROW_HEIGHT,
                }}
                aria-label="新增记录"
                disabled={activeView.locked}
                onMouseDown={event => event.stopPropagation()}
                onClick={() => addFromAddRow(null)}
              />
            </div>
            {columns.map(column => (
              <div
                key={column.field.id}
                className={`base-grid-overlay-header${hoverHeaderFieldId === column.field.id ? ' is-hovered' : ''}`}
                style={{ left: column.left, top: 0, width: column.width, height: HEADER_HEIGHT }}
              >
                <GridFieldHeader
                  field={column.field}
                  primaryFieldId={table.primaryFieldId}
                  isMenuOpen={fieldMenu?.fieldId === column.field.id}
                  onMenuClick={event => {
                    const shellRect = shellRef.current?.getBoundingClientRect();
                    const left = shellRect ? event.clientX - shellRect.left : column.left;
                    openFieldMenuAt(column.field.id, left, HEADER_HEIGHT, column.left);
                  }}
                />
              </div>
            ))}
            <button
              type="button"
              className="base-grid-overlay-header-add"
              style={{ left: dataWidth, top: 0, width: ADD_FIELD_WIDTH, height: HEADER_HEIGHT }}
              aria-label="新增字段"
              onClick={addField}
            >
              +
            </button>
            {selectedCell && !editingCell && !selectEditor && (() => {
              const primaryColumn = columns.find(column => column.field.id === table.primaryFieldId) ?? columns[0];
              if (!primaryColumn || selectedCell.fieldId !== primaryColumn.field.id) return null;
              return (
                <BitableGridCellExpand
                  style={{
                    left: primaryColumn.left + primaryColumn.width - 28,
                    top: HEADER_HEIGHT + selectedCell.rowIndex * ROW_HEIGHT + (ROW_HEIGHT - 24) / 2,
                  }}
                  onOpen={() => openRecord?.(selectedCell.recordId)}
                />
              );
            })()}
            {hoverRow != null && !editingCell && !selectEditor && selectedCell?.rowIndex !== hoverRow && records[hoverRow] && (() => {
              const primaryColumn = columns.find(column => column.field.id === table.primaryFieldId) ?? columns[0];
              if (!primaryColumn) return null;
              return (
              <div
                className="base-grid-row-hover-actions"
                style={{
                  left: primaryColumn.left,
                  top: HEADER_HEIGHT + hoverRow * ROW_HEIGHT,
                  width: primaryColumn.width,
                  height: ROW_HEIGHT,
                }}
              >
                <button
                  type="button"
                  className="base-grid-row-hover-actions__view"
                  onClick={event => {
                    event.stopPropagation();
                    openRecord?.(records[hoverRow].id);
                  }}
                >
                  <span className="base-record-view-icon" aria-hidden />
                  查看
                </button>
                <button
                  type="button"
                  className="base-grid-row-hover-actions__add"
                  aria-label="在下方新增记录"
                  onClick={event => {
                    event.stopPropagation();
                    const focusColumn = primaryColumn ?? columns.find(column => column.field.id === table.primaryFieldId) ?? columns[0];
                    if (insertRecordAt) {
                      const [recordId] = insertRecordAt(hoverRow + 1, 1);
                      if (recordId && focusColumn) pendingCellFocusRef.current = { recordId, fieldId: focusColumn.field.id };
                    } else {
                      const recordId = addRecord();
                      if (focusColumn) pendingCellFocusRef.current = { recordId, fieldId: focusColumn.field.id };
                    }
                  }}
                >
                  +
                </button>
              </div>
              );
            })()}
            {records.map((record, rowIndex) => columns.map(column => {
              if (!isSelectField(column.field)) return null;
              const values = getSelectValues(record, column.field);
              if (!values.length) return null;
              const isSelected = selectedCell?.recordId === record.id && selectedCell?.fieldId === column.field.id;
              const isHovered = hoverCell?.rowIndex === rowIndex && hoverCell?.fieldId === column.field.id;
              const showRemove = !activeView.locked && (isSelected || isHovered);
              return (
                <div
                  key={`${record.id}-${column.field.id}`}
                  className="base-grid-select-cell"
                  style={{
                    left: column.left,
                    top: HEADER_HEIGHT + rowIndex * ROW_HEIGHT,
                    width: column.width,
                    height: ROW_HEIGHT,
                  }}
                >
                  <div className="base-grid-select-cell__tags">
                    {values.map(value => {
                      const choice = findChoice(column.field, value);
                      const background = choice?.color || '#e8f0ff';
                      const color = textColorForBackground(background);
                      return (
                        <span
                          key={value}
                          className="base-grid-select-tag"
                          style={{ backgroundColor: background, color }}
                        >
                          <span className="base-grid-select-tag__label">{value}</span>
                          {showRemove && (
                            <button
                              type="button"
                              className="base-grid-select-tag__remove"
                              aria-label={`删除 ${value}`}
                              onMouseDown={event => event.stopPropagation()}
                              onClick={event => {
                                event.stopPropagation();
                                clearSelectValue(record, column.field, value);
                                if (selectEditor?.recordId === record.id && selectEditor.fieldId === column.field.id) {
                                  setSelectEditor(null);
                                }
                              }}
                            >
                              ×
                            </button>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            }))}
          </div>
          {editingCell && (
            <input
              ref={inputRef}
              className="base-grid-cell-editor"
              style={{ left: editingCell.left, top: editingCell.top, width: editingCell.width, height: ROW_HEIGHT }}
              value={editingCell.value}
              onChange={event => setEditingCell(current => current ? { ...current, value: event.target.value } : current)}
              onBlur={commitEditingCell}
              onKeyDown={event => {
                if (event.key === 'Enter') commitEditingCell();
                if (event.key === 'Escape') setEditingCell(null);
              }}
            />
          )}
          {selectEditor && selectField && selectEditorPortalStyle && createPortal(
            <div
              ref={selectEditorRef}
              className="base-grid-select-editor--portal"
              style={selectEditorPortalStyle}
              data-floating-panel="true"
              data-no-marquee-selection="true"
              onMouseDown={event => event.stopPropagation()}
            >
              <input
                className="base-grid-select-editor__search"
                type="text"
                autoFocus
                placeholder="查找选项"
                value={selectEditor.query}
                onChange={event => setSelectEditor(current => current ? { ...current, query: event.target.value } : current)}
                onKeyDown={event => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    setSelectEditor(null);
                  }
                }}
              />
              <div className="base-grid-select-editor__list">
                {filteredSelectChoices.length ? filteredSelectChoices.map(choice => {
                  const selected = selectField?.type === 'multi_select' && selectRecord
                    ? getSelectValues(selectRecord, selectField).includes(choice.name)
                    : choice.name === selectEditor.value;
                  return (
                    <button
                      key={choice.id}
                      type="button"
                      className={`base-grid-select-editor__item${selected ? ' is-selected' : ''}`}
                      onClick={() => {
                        if (selectField?.type === 'multi_select' && selectRecord) {
                          const current = getSelectValues(selectRecord, selectField);
                          const next = selected
                            ? current.filter(name => name !== choice.name)
                            : [...current, choice.name];
                          changeCell(selectEditor.recordId, selectEditor.fieldId, next);
                          return;
                        }
                        changeCell(selectEditor.recordId, selectEditor.fieldId, choice.name);
                        setSelectEditor(null);
                      }}
                    >
                      <span className="base-grid-select-editor__tag" style={{ backgroundColor: choice.color, color: textColorForBackground(choice.color) }}>{choice.name}</span>
                      {selected && <span className="base-grid-select-editor__check" aria-hidden>✓</span>}
                    </button>
                  );
                }) : (
                  <div className="base-grid-select-editor__empty">{selectChoices.length ? '没有匹配选项' : '请先在字段设置中添加选项'}</div>
                )}
              </div>
              {(selectField?.type === 'multi_select'
                ? selectRecord && getSelectValues(selectRecord, selectField).length > 0
                : Boolean(selectEditor.value)) && (
                <button
                  type="button"
                  className="base-grid-select-editor__clear"
                  onClick={() => {
                    changeCell(selectEditor.recordId, selectEditor.fieldId, selectField?.type === 'multi_select' ? [] : '');
                    setSelectEditor(null);
                  }}
                >
                  清空
                </button>
              )}
            </div>,
            document.body,
          )}
        </div>
      </div>
      {fieldMenu && menuField && (
        <GridFieldContextMenu
          menuRef={menuRef}
          field={menuField}
          isPrimaryField={menuField.id === table.primaryFieldId}
          canDelete={canRemoveMenuField}
          left={fieldMenu.left}
          top={fieldMenu.top}
          onAction={runFieldAction}
        />
      )}
      {cellContextMenu && (
        <GridCellContextMenu
          menuRef={cellMenuRef}
          left={cellContextMenu.left}
          top={cellContextMenu.top}
          onInsertAbove={count => {
            if (insertRecordAt) {
              insertRecordAt(cellContextMenu.rowIndex, count);
            }
            setCellContextMenu(null);
          }}
          onInsertBelow={count => {
            if (insertRecordAt) {
              insertRecordAt(cellContextMenu.rowIndex + 1, count);
            }
            setCellContextMenu(null);
          }}
          onViewDetails={() => {
            openRecord?.(cellContextMenu.recordId);
            setCellContextMenu(null);
          }}
          onAddChildRecord={() => {
            if (insertRecordAt) {
              insertRecordAt(cellContextMenu.rowIndex + 1, 1, '  子记录');
            }
            setCellContextMenu(null);
          }}
          onAddComment={() => {
            onOpenComment?.(cellContextMenu.recordId);
            setCellContextMenu(null);
          }}
          onDeleteRecord={() => {
            if (removeRecords) {
              removeRecords([cellContextMenu.recordId], true);
            }
            setCellContextMenu(null);
          }}
        />
      )}
      <div className="base-grid-footer">
        {`${records.length} 条记录`}
      </div>
    </div>
  );
}
