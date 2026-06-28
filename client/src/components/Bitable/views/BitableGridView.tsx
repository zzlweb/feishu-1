import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { valueText, buildRecordTreeMeta, buildGridDisplayRows, filterRecordsByCollapsedAncestors, getRecordSubtreeIds, getRootDisplayNumber, resolveGridRowHeight, resolveRecordInsertIndex, normalizeMultiSelectIds, getMultiSelectChoices, findSelectChoice, RECORD_TREE_INDENT, type BaseField, type BaseRecord, type BaseTable, type BaseView, type CellValue, type GridDisplayRow, type GridViewConfig, type RecordTreeRowMeta, type SelectChoice } from '../model/bitableModel';
import { createPortal } from 'react-dom';
import type { Ref } from 'react';
import { BITABLE_BLOCK_EXPAND_ALL } from '../BitableContextMenu';
import { BitableGridCellExpand } from '../shared/BitableGridCellExpand';
import { GridFieldHeader, GridFieldMenuIcon, BitableTooltip, attachmentCellLabel, resolveBitableBleedRightEdge } from '../shared/BitableViewShared';

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
  addField: (anchor: { left: number; top: number }) => void;
  addRecord: () => string;
  insertRecordAt?: (index: number, count: number, initialTitle?: string) => string[];
  insertChildRecord?: (parentRecordId: string, initialTitle?: string) => string;
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
  addSelectChoice?: (fieldId: string, name: string) => string | null;
}

const INDEX_WIDTH = 56;
const ADD_FIELD_WIDTH = 44;
const BITABLE_GRID_MIN_WIDTH = 860;
const BITABLE_EDGE_MARGIN = 72;
const DEFAULT_FIELD_WIDTH = 160;
const MIN_FIELD_WIDTH = 80;
const MAX_FIELD_WIDTH = 420;
const HEADER_HEIGHT = 32;
const RESIZE_HIT_WIDTH = 10;
const TREE_TOGGLE_SIZE = 16;
const PRIMARY_CELL_PADDING = 8;
const TREE_ANCHOR_X = 10;
const TREE_TOGGLE_LEFT = TREE_ANCHOR_X - TREE_TOGGLE_SIZE / 2;
const PRIMARY_TEXT_START = TREE_TOGGLE_LEFT + TREE_TOGGLE_SIZE;

const FIELD_MENU_WIDTH = 188;
const FIELD_MENU_WIDTH_PRIMARY = 220;
const FIELD_MENU_ESTIMATED_HEIGHT = 420;

function computeFieldMenuViewportPosition(
  clientX: number,
  clientY: number,
  isPrimaryField: boolean,
) {
  const menuWidth = isPrimaryField ? FIELD_MENU_WIDTH_PRIMARY : FIELD_MENU_WIDTH;
  const margin = 8;
  let left = clientX - menuWidth + 28;
  left = Math.max(margin, Math.min(left, window.innerWidth - menuWidth - margin));
  let top = clientY + 6;
  if (top + FIELD_MENU_ESTIMATED_HEIGHT > window.innerHeight - margin) {
    top = Math.max(margin, window.innerHeight - FIELD_MENU_ESTIMATED_HEIGHT - margin);
  }
  return { left, top };
}

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
      className={`base-grid-field-menu base-grid-field-menu--portal bitable-contextmenu${isPrimaryField ? ' is-primary-field' : ''}`}
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
  deleteOnly = false,
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
  deleteOnly?: boolean;
  onInsertAbove: (count: number) => void;
  onInsertBelow: (count: number) => void;
  onViewDetails: () => void;
  onAddChildRecord: () => void;
  onAddComment: () => void;
  onDeleteRecord: () => void;
}) {
  const [aboveCount, setAboveCount] = useState('1');
  const [belowCount, setBelowCount] = useState('1');
  const menuWidth = 220;
  const menuHeight = deleteOnly ? 44 : 284;
  const margin = 8;
  const viewportWidth = typeof window === 'undefined' ? left + menuWidth + margin : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? top + menuHeight + margin : window.innerHeight;
  const fixedLeft = Math.max(margin, Math.min(left, viewportWidth - menuWidth - margin));
  const fixedTop = Math.max(margin, Math.min(top, viewportHeight - menuHeight - margin));

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
      className="b-menu bitable-noselect white J-bitable-container bitable-hover-scrollbar-sm bitable-contextmenu base-grid-cell-menu--portal"
      style={{ left: fixedLeft, top: fixedTop, width: menuWidth, maxHeight: `calc(100vh - ${margin * 2}px)`, overflowY: 'auto' }}
      onMouseDown={e => e.stopPropagation()}
    >
      <ul className="ud__menu ud__menu-root ud__menu-vertical ud-scrollbar" dir="ltr" role="menu" tabIndex={0} data-menu-list="true">
        {deleteOnly ? (
          <li className="b-menu__item" role="menuitem" onClick={onDeleteRecord}>
            <span className="universe-icon icon">
              <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" data-icon="DeleteTrashOutlined">
                <path d="M8 4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2h5a1 1 0 1 1 0 2h-1v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6H3a1 1 0 0 1 0-2h5ZM6 6v14h12V6H6Zm4 3a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1Zm4 0a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1Z" fill="currentColor"></path>
              </svg>
            </span>
            删除记录
          </li>
        ) : (
          <>
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
          </>
        )}
      </ul>
    </div>
  );
}

type GridColumn = { field: BaseField; left: number; width: number };
type EditingCell = { recordId: string; fieldId: string; left: number; top: number; width: number; paddingLeft: number; paddingRight: number; value: string };
type SelectedCell = { recordId: string; fieldId: string; rowIndex: number };
type CellRangeSelection = {
  /** -1 表示表头行，0+ 表示数据行。 */
  anchorRow: number;
  anchorCol: number;
  focusRow: number;
  focusCol: number;
};
type CellSelectDrag = {
  pointerId: number;
  anchorRow: number;
  anchorCol: number;
  moved: boolean;
};
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

const SELECT_CELL_INSET_LEFT = 8;
const SELECT_CELL_INSET_RIGHT = 26;
const SELECT_TAG_GAP = 4;
const SELECT_TAG_FONT = '12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const SELECT_TAG_MIN_WIDTH = 32;
const SELECT_TAG_MIN_WIDTH_WITH_REMOVE = 44;
const SELECT_TAG_MORE_MIN_WIDTH = 28;
const SELECT_TAG_MAX_LABEL_WIDTH = 96;

let selectTagMeasureCtx: CanvasRenderingContext2D | null = null;

function getSelectTagMeasureCtx() {
  if (selectTagMeasureCtx) return selectTagMeasureCtx;
  const canvas = document.createElement('canvas');
  selectTagMeasureCtx = canvas.getContext('2d');
  if (selectTagMeasureCtx) selectTagMeasureCtx.font = SELECT_TAG_FONT;
  return selectTagMeasureCtx;
}

function measureSelectTagLabelWidth(label: string) {
  const ctx = getSelectTagMeasureCtx();
  if (!ctx) return label.length * 7;
  return ctx.measureText(label).width;
}

function measureSelectTagWidth(label: string, withRemove: boolean) {
  const labelWidth = Math.min(measureSelectTagLabelWidth(label), SELECT_TAG_MAX_LABEL_WIDTH);
  const horizontalPadding = withRemove ? 10 : 16;
  const removeWidth = withRemove ? 17 : 0;
  return Math.max(
    withRemove ? SELECT_TAG_MIN_WIDTH_WITH_REMOVE : SELECT_TAG_MIN_WIDTH,
    Math.ceil(horizontalPadding + labelWidth + removeWidth),
  );
}

function measureSelectMoreTagWidth(overflowCount: number) {
  const label = `+${overflowCount}`;
  const labelWidth = measureSelectTagLabelWidth(label);
  return Math.max(SELECT_TAG_MORE_MIN_WIDTH, Math.ceil(labelWidth + 16));
}

function layoutSelectTags(choices: SelectChoice[], availableWidth: number, showRemove: boolean) {
  if (!choices.length || availableWidth <= 0) {
    return { visible: choices, overflowCount: 0 };
  }
  if (choices.length === 1) {
    return { visible: choices, overflowCount: 0 };
  }

  const widths = choices.map(choice => measureSelectTagWidth(choice.name, showRemove));
  const totalWidth = widths.reduce((sum, width, index) => sum + width + (index > 0 ? SELECT_TAG_GAP : 0), 0);
  if (totalWidth <= availableWidth) {
    return { visible: choices, overflowCount: 0 };
  }

  let used = 0;
  let visibleCount = 0;
  for (let index = 0; index < choices.length; index += 1) {
    const hiddenCount = choices.length - index - 1;
    const moreWidth = hiddenCount > 0 ? measureSelectMoreTagWidth(hiddenCount) + SELECT_TAG_GAP : 0;
    const tagWidth = widths[index] + (visibleCount > 0 ? SELECT_TAG_GAP : 0);
    if (used + tagWidth + moreWidth <= availableWidth) {
      used += tagWidth;
      visibleCount += 1;
    } else {
      break;
    }
  }

  if (visibleCount <= 0) visibleCount = 1;
  const overflowCount = choices.length - visibleCount;
  return {
    visible: choices.slice(0, visibleCount),
    overflowCount,
  };
}

function GridSelectCellTags({
  choices,
  availableWidth,
  showRemove,
  isMulti,
  onRemove,
  onMoreClick,
}: {
  choices: SelectChoice[];
  availableWidth: number;
  showRemove: boolean;
  isMulti: boolean;
  onRemove: (choiceId: string) => void;
  onMoreClick?: () => void;
}) {
  const { visible, overflowCount } = useMemo(
    () => (isMulti ? layoutSelectTags(choices, availableWidth, showRemove) : { visible: choices, overflowCount: 0 }),
    [availableWidth, choices, isMulti, showRemove],
  );

  return (
    <>
      {visible.map(choice => {
        const background = choice.color || '#e8f0ff';
        const color = textColorForBackground(background);
        return (
          <span
            key={choice.id}
            className="base-grid-select-tag"
            style={{ backgroundColor: background, color }}
          >
            <span className="base-grid-select-tag__label">{choice.name}</span>
            {showRemove && (
              <button
                type="button"
                className="base-grid-select-tag__remove"
                aria-label={`删除 ${choice.name}`}
                onMouseDown={event => event.stopPropagation()}
                onClick={event => {
                  event.stopPropagation();
                  onRemove(choice.id);
                }}
              >
                ×
              </button>
            )}
          </span>
        );
      })}
      {overflowCount > 0 && (
        <span
          className="base-grid-select-tag base-grid-select-tag--more"
          title={choices.slice(visible.length).map(choice => choice.name).join('、')}
          onMouseDown={event => event.stopPropagation()}
          onClick={event => {
            event.stopPropagation();
            onMoreClick?.();
          }}
        >
          +{overflowCount}
        </span>
      )}
    </>
  );
}

function drawRecordTreeGuides(
  ctx: CanvasRenderingContext2D,
  columnLeft: number,
  rowTop: number,
  rowHeight: number,
  meta: RecordTreeRowMeta,
  isCollapsed: boolean,
) {
  const midY = rowTop + rowHeight / 2;
  const anchorX = columnLeft + TREE_ANCHOR_X;
  ctx.save();
  ctx.strokeStyle = '#c9cdd4';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);

  if (meta.depth === 0 && meta.hasChildren && !isCollapsed) {
    ctx.beginPath();
    ctx.moveTo(anchorX + 0.5, midY + TREE_TOGGLE_SIZE / 2 - 2);
    ctx.lineTo(anchorX + 0.5, rowTop + rowHeight);
    ctx.stroke();
  }

  if (meta.depth <= 0) {
    ctx.setLineDash([]);
    ctx.restore();
    return;
  }

  const baseX = columnLeft + TREE_TOGGLE_LEFT;
  meta.guideContinues.forEach((continues, level) => {
    const x = baseX + level * RECORD_TREE_INDENT + 8;
    if (!continues) return;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, rowTop);
    ctx.lineTo(x + 0.5, rowTop + rowHeight);
    ctx.stroke();
  });
  const branchX = baseX + (meta.depth - 1) * RECORD_TREE_INDENT + 8;
  const endX = branchX + 10;
  ctx.beginPath();
  ctx.moveTo(branchX + 0.5, rowTop);
  ctx.lineTo(branchX + 0.5, meta.isLastChild ? midY : rowTop + rowHeight);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(branchX + 0.5, midY);
  ctx.lineTo(endX, midY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function primaryCellTextOffset(meta: RecordTreeRowMeta) {
  if (meta.depth > 0) return PRIMARY_TEXT_START + meta.depth * RECORD_TREE_INDENT;
  return PRIMARY_TEXT_START;
}

function cellTextInset(column: GridColumn, meta: RecordTreeRowMeta | undefined, primaryFieldId: string) {
  if (column.field.id === primaryFieldId && meta) return primaryCellTextOffset(meta);
  return PRIMARY_CELL_PADDING;
}

function getCellEditorLayout(column: GridColumn, meta: RecordTreeRowMeta | undefined, isPrimaryField: boolean) {
  const paddingRight = PRIMARY_CELL_PADDING;
  if (!isPrimaryField || !meta) {
    return { left: column.left, width: column.width, paddingLeft: PRIMARY_CELL_PADDING, paddingRight };
  }
  if (meta.depth === 0 && meta.hasChildren) {
    return {
      left: column.left + PRIMARY_TEXT_START,
      width: column.width - PRIMARY_TEXT_START,
      paddingLeft: 4,
      paddingRight,
    };
  }
  if (meta.depth === 0) {
    return {
      left: column.left,
      width: column.width,
      paddingLeft: PRIMARY_TEXT_START,
      paddingRight,
    };
  }
  const editInset = primaryCellTextOffset(meta) - 4;
  return {
    left: column.left + editInset,
    width: column.width - editInset,
    paddingLeft: 4,
    paddingRight,
  };
}

function isTreeToggleHit(
  point: { x: number; y: number },
  column: GridColumn,
  rowIndex: number,
  rowHeight: number,
  primaryFieldId: string,
  meta: RecordTreeRowMeta | undefined,
) {
  if (!meta?.hasChildren || column.field.id !== primaryFieldId) return false;
  const toggleLeft = column.left + TREE_TOGGLE_LEFT;
  const toggleTop = HEADER_HEIGHT + rowIndex * rowHeight + (rowHeight - TREE_TOGGLE_SIZE) / 2;
  return point.x >= toggleLeft
    && point.x <= toggleLeft + TREE_TOGGLE_SIZE
    && point.y >= toggleTop
    && point.y <= toggleTop + TREE_TOGGLE_SIZE;
}

function textColorForBackground(background: string) {
  const hex = background.replace('#', '');
  if (hex.length !== 6) return '#1f2329';
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 170 ? '#1f2329' : '#fff';
}

function isSelectField(field: BaseField) {
  return field.type === 'single_select' || field.type === 'multi_select';
}

function getSelectValues(record: BaseRecord, field: BaseField): string[] {
  const value = record.fields[field.id];
  if (field.type === 'multi_select') {
    return normalizeMultiSelectIds(field, value);
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

function isMultiCellRange(range: CellRangeSelection | null) {
  if (!range) return false;
  return range.anchorRow !== range.focusRow || range.anchorCol !== range.focusCol;
}

function getSelectionRecordIds(range: CellRangeSelection, gridRows: GridDisplayRow[]): string[] {
  const minRow = Math.min(range.anchorRow, range.focusRow);
  const maxRow = Math.max(range.anchorRow, range.focusRow);
  const ids: string[] = [];
  for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
    if (rowIndex < 0) continue;
    const row = gridRows[rowIndex];
    if (row?.kind === 'record') ids.push(row.record.id);
  }
  return ids;
}

function isMultiRowSelection(range: CellRangeSelection | null, gridRows: GridDisplayRow[]) {
  if (!range) return false;
  return getSelectionRecordIds(range, gridRows).length > 1;
}

function drawCellRangeSelection(
  ctx: CanvasRenderingContext2D,
  range: CellRangeSelection,
  columns: GridColumn[],
  gridRows: GridDisplayRow[],
  rowHeight: number,
) {
  if (!isMultiCellRange(range) && range.anchorRow !== -1) return;
  const minRow = Math.min(range.anchorRow, range.focusRow);
  const maxRow = Math.max(range.anchorRow, range.focusRow);
  const minCol = Math.min(range.anchorCol, range.focusCol);
  const maxCol = Math.max(range.anchorCol, range.focusCol);
  ctx.fillStyle = '#e8f3ff';
  for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
    if (rowIndex !== -1 && gridRows[rowIndex]?.kind !== 'record') continue;
    const top = rowIndex === -1 ? 0 : HEADER_HEIGHT + rowIndex * rowHeight;
    const height = rowIndex === -1 ? HEADER_HEIGHT : rowHeight;
    for (let colIndex = minCol; colIndex <= maxCol; colIndex += 1) {
      const column = columns[colIndex];
      if (!column) continue;
      ctx.fillRect(column.left, top, column.width, height);
    }
  }
}

function isPointInCellRange(
  point: { x: number; y: number },
  range: CellRangeSelection | null,
  columns: GridColumn[],
  rowHeight: number,
) {
  if (!range || (!isMultiCellRange(range) && range.anchorRow !== -1)) return false;
  const minRow = Math.min(range.anchorRow, range.focusRow);
  const maxRow = Math.max(range.anchorRow, range.focusRow);
  const minCol = Math.min(range.anchorCol, range.focusCol);
  const maxCol = Math.max(range.anchorCol, range.focusCol);
  const rowIndex = point.y < HEADER_HEIGHT ? -1 : Math.floor((point.y - HEADER_HEIGHT) / rowHeight);
  if (rowIndex < minRow || rowIndex > maxRow) return false;
  const column = findColumn(columns, point.x);
  if (!column) return false;
  const colIndex = columns.findIndex(item => item.field.id === column.field.id);
  return colIndex >= minCol && colIndex <= maxCol;
}

function isHeaderColumnInRange(range: CellRangeSelection | null, fieldId: string, columns: GridColumn[]) {
  if (!range || (!isMultiCellRange(range) && range.anchorRow !== -1)) return false;
  const minRow = Math.min(range.anchorRow, range.focusRow);
  const maxRow = Math.max(range.anchorRow, range.focusRow);
  if (minRow > -1 || maxRow < -1) return false;
  const columnIndex = columns.findIndex(column => column.field.id === fieldId);
  if (columnIndex < 0) return false;
  const minCol = Math.min(range.anchorCol, range.focusCol);
  const maxCol = Math.max(range.anchorCol, range.focusCol);
  return columnIndex >= minCol && columnIndex <= maxCol;
}

function resolveSelectableCellAtPoint(
  point: { x: number; y: number },
  params: {
    gridRows: GridDisplayRow[];
    columns: GridColumn[];
    dataWidth: number;
    addRowIndex: number;
    rowHeight: number;
    primaryFieldId: string;
    treeMeta: RecordTreeRowMeta[];
    displayRecords: BaseRecord[];
  },
): { rowIndex: number; colIndex: number; record: BaseRecord | null; column: GridColumn } | null {
  const {
    gridRows,
    columns,
    dataWidth,
    addRowIndex,
    rowHeight,
    primaryFieldId,
    treeMeta,
    displayRecords,
  } = params;
  if (point.x < INDEX_WIDTH || point.x >= dataWidth) return null;
  if (point.y < HEADER_HEIGHT) {
    const column = findColumn(columns, point.x);
    if (!column) return null;
    const colIndex = columns.findIndex(item => item.field.id === column.field.id);
    return colIndex >= 0 ? { rowIndex: -1, colIndex, record: null, column } : null;
  }
  const rowIndex = Math.floor((point.y - HEADER_HEIGHT) / rowHeight);
  if (rowIndex < 0 || rowIndex >= addRowIndex) return null;
  const row = gridRows[rowIndex];
  if (row?.kind !== 'record') return null;
  const column = findColumn(columns, point.x);
  if (!column) return null;
  const colIndex = columns.findIndex(item => item.field.id === column.field.id);
  if (colIndex < 0) return null;
  const record = row.record;
  const recordIndex = displayRecords.findIndex(item => item.id === record.id);
  const meta = recordIndex >= 0 ? treeMeta[recordIndex] : undefined;
  if (isTreeToggleHit(point, column, rowIndex, rowHeight, primaryFieldId, meta)) return null;
  return { rowIndex, colIndex, record, column };
}

function resolveDragFocusFromPoint(
  point: { x: number; y: number },
  params: {
    gridRows: GridDisplayRow[];
    columns: GridColumn[];
    dataWidth: number;
    addRowIndex: number;
    rowHeight: number;
  },
): { rowIndex: number; colIndex: number } | null {
  const { gridRows, columns, dataWidth, addRowIndex, rowHeight } = params;
  if (!columns.length) return null;
  let rowIndex = point.y < HEADER_HEIGHT ? -1 : Math.floor((point.y - HEADER_HEIGHT) / rowHeight);
  if (rowIndex >= addRowIndex) rowIndex = addRowIndex - 1;
  if (rowIndex < -1) rowIndex = -1;
  if (rowIndex !== -1 && gridRows[rowIndex]?.kind !== 'record') return null;
  const x = Math.max(INDEX_WIDTH, Math.min(point.x, dataWidth - 1));
  const column = findColumn(columns, x) ?? columns[columns.length - 1];
  const colIndex = columns.findIndex(item => item.field.id === column.field.id);
  if (colIndex < 0) return null;
  return { rowIndex, colIndex };
}

function findResizeColumn(columns: GridColumn[], x: number) {
  return columns.find(column => Math.abs(x - (column.left + column.width)) <= RESIZE_HIT_WIDTH / 2) || null;
}

function pointFromCanvas(
  event: { clientX: number; clientY: number; currentTarget: EventTarget & Element },
  scrollOffsetX: number,
) {
  const rect = event.currentTarget.getBoundingClientRect();
  /* rect 已包含父级 translateX(-scrollOffsetX)，这里不能再叠加 scrollOffsetX */
  void scrollOffsetX;
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function rowIndexFromClientY(shell: HTMLDivElement | null, clientY: number, recordCount: number, rowHeight: number) {
  const canvas = shell?.querySelector('.base-grid-canvas');
  const rect = canvas?.getBoundingClientRect();
  if (!rect) return null;
  const y = clientY - rect.top - HEADER_HEIGHT;
  const index = Math.floor(y / rowHeight);
  if (index < 0 || index >= recordCount) return null;
  return index;
}

function recordAtGridRow(gridRows: GridDisplayRow[], rowIndex: number): BaseRecord | null {
  const row = gridRows[rowIndex];
  return row?.kind === 'record' ? row.record : null;
}

function recordRowsFromGrid(gridRows: GridDisplayRow[]): BaseRecord[] {
  return gridRows
    .filter((row): row is Extract<GridDisplayRow, { kind: 'record' }> => row.kind === 'record')
    .map(row => row.record);
}

function drawGridGroupRow(
  ctx: CanvasRenderingContext2D,
  row: Extract<GridDisplayRow, { kind: 'group' }>,
  rowIndex: number,
  headerHeight: number,
  rowHeight: number,
  contentRight: number,
  collapsed: boolean,
) {
  const top = headerHeight + rowIndex * rowHeight;
  ctx.fillStyle = '#f5f6f7';
  ctx.fillRect(0, top, contentRight, rowHeight);
  const textX = INDEX_WIDTH + PRIMARY_CELL_PADDING + row.level * 16;
  const chevron = collapsed ? '▸' : '▾';
  const label = `${chevron} ${row.label}`;
  const countText = `${row.count} 条记录`;
  ctx.font = '13px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textBaseline = 'middle';
  const y = top + rowHeight / 2;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#1f2329';
  const countWidth = ctx.measureText(countText).width;
  const labelMaxWidth = Math.max(0, contentRight - 12 - countWidth - 8 - textX);
  drawText(ctx, label, textX, y, labelMaxWidth);
  ctx.fillStyle = '#8f959e';
  ctx.textAlign = 'right';
  ctx.fillText(countText, contentRight - 12, y);
  ctx.textAlign = 'left';
}

function isValidTreeDropTarget(
  records: BaseRecord[],
  displayRecords: BaseRecord[],
  fromDisplayIndex: number,
  toDisplayIndex: number,
) {
  if (fromDisplayIndex === toDisplayIndex) return false;
  const fromRecord = displayRecords[fromDisplayIndex];
  const toRecord = displayRecords[toDisplayIndex];
  if (!fromRecord || !toRecord) return false;
  const fromRecordsIndex = records.findIndex(record => record.id === fromRecord.id);
  const toRecordsIndex = records.findIndex(record => record.id === toRecord.id);
  if (fromRecordsIndex < 0 || toRecordsIndex < 0) return false;
  const subtreeIds = getRecordSubtreeIds(records, fromRecordsIndex);
  return !(subtreeIds.has(toRecord.id) && toRecord.id !== fromRecord.id);
}

export function BitableGridView({
  table,
  activeView,
  records,
  selectedIds,
  addField,
  addRecord,
  insertRecordAt,
  insertChildRecord,
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
  addSelectChoice,
}: BitableGridViewProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasScrollRef = useRef<HTMLDivElement>(null);
  const hTrackRef = useRef<HTMLDivElement>(null);
  const scrollLeftRef = useRef(0);
  const anchorWidthRef = useRef(0);
  const layoutOriginRef = useRef({ blockLeft: 0, bleedLeft: 0 });
  const prevCanvasWidthRef = useRef(0);
  const prevMaxScrollLeftRef = useRef(0);
  const pendingFoldScrollRef = useRef(false);
  const frozenCanvasRef = useRef<HTMLCanvasElement>(null);
  const hThumbDragRef = useRef<{ startX: number; startScrollLeft: number } | null>(null);
  const fieldMenuOpenAtRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const cellMenuRef = useRef<HTMLDivElement>(null);
  const selectEditorRef = useRef<HTMLDivElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const pendingCellFocusRef = useRef<{ recordId: string; fieldId: string; scrollAlign?: 'nearest' | 'end' } | null>(null);
  const suppressBlurCommitRef = useRef(false);
  const editingCellRef = useRef<EditingCell | null>(null);
  const selectedCellRef = useRef<SelectedCell | null>(null);
  const cellSelectDragRef = useRef<CellSelectDrag | null>(null);
  const [fieldMenu, setFieldMenu] = useState<{ fieldId: string; left: number; top: number; columnLeft: number } | null>(null);
  const [cellContextMenu, setCellContextMenu] = useState<{
    recordId: string;
    recordIds: string[];
    rowIndex: number;
    left: number;
    top: number;
    deleteOnly: boolean;
  } | null>(null);
  const [hoverRow, setHoverRow] = useState<number | null>(null);
  const [hoverCell, setHoverCell] = useState<{ rowIndex: number; fieldId: string } | null>(null);
  const [hoverAddRow, setHoverAddRow] = useState(false);
  const [hoverHeaderFieldId, setHoverHeaderFieldId] = useState<string | null>(null);
  const [hoverResizeFieldId, setHoverResizeFieldId] = useState<string | null>(null);
  const [activeResize, setActiveResize] = useState<ResizeState | null>(null);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [selectionRange, setSelectionRange] = useState<CellRangeSelection | null>(null);
  const [selectEditor, setSelectEditor] = useState<SelectEditor | null>(null);
  const [rowDrag, setRowDrag] = useState<{ fromIndex: number; overIndex: number } | null>(null);
  const [collapsedRecordIds, setCollapsedRecordIds] = useState<Set<string>>(() => new Set());
  const [collapsedGroupKeys, setCollapsedGroupKeys] = useState<Set<string>>(() => new Set());
  const visibleFields = table.fields.filter(field => !(activeView.hiddenFieldIds || []).includes(field.id));
  const gridConfig = activeView.config as GridViewConfig;
  const treeRecords = useMemo(
    () => filterRecordsByCollapsedAncestors(records, collapsedRecordIds),
    [records, collapsedRecordIds],
  );
  const groupFieldIds = gridConfig.groupByFieldIds ?? [];
  const groupSortDirections = gridConfig.groupSortDirections ?? [];
  const gridRows = useMemo(
    () => buildGridDisplayRows(table, treeRecords, groupFieldIds, collapsedGroupKeys, groupSortDirections, activeView),
    [table, treeRecords, groupFieldIds, groupSortDirections, collapsedGroupKeys, activeView],
  );
  const displayRecords = useMemo(() => recordRowsFromGrid(gridRows), [gridRows]);
  const isAllSelected = records.length > 0 && selectedIds.size === records.length;
  const isPartiallySelected = selectedIds.size > 0 && selectedIds.size < records.length;
  const ROW_HEIGHT = resolveGridRowHeight(gridConfig);
  const addRowIndex = gridRows.length;
  const rowCount = addRowIndex + 1;
  const gridBodyBottom = HEADER_HEIGHT + rowCount * ROW_HEIGHT;
  const fieldWidths = gridConfig.fieldWidths || {};
  const menuField = fieldMenu ? visibleFields.find(field => field.id === fieldMenu.fieldId) : null;
  const treeMeta = useMemo(() => buildRecordTreeMeta(displayRecords, records), [displayRecords, records]);

  useEffect(() => {
    setCollapsedGroupKeys(new Set());
  }, [groupFieldIds.join('|')]);

  const toggleGroupCollapse = (groupKey: string) => {
    setCollapsedGroupKeys(current => {
      const next = new Set(current);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  const toggleRecordCollapse = (recordId: string) => {
    setCollapsedRecordIds(current => {
      const next = new Set(current);
      if (next.has(recordId)) next.delete(recordId);
      else next.add(recordId);
      return next;
    });
  };

  const expandRecord = (recordId: string) => {
    setCollapsedRecordIds(current => {
      if (!current.has(recordId)) return current;
      const next = new Set(current);
      next.delete(recordId);
      return next;
    });
  };

  const columns = useMemo(() => {
    let left = INDEX_WIDTH;
    return visibleFields.map(field => {
      const width = activeResize?.fieldId === field.id ? activeResize.width : clampWidth(Number(fieldWidths[field.id]) || DEFAULT_FIELD_WIDTH);
      const column = { field, left, width };
      left += width;
      return column;
    });
  }, [activeResize, fieldWidths, visibleFields]);

  const dataWidth = columns.length > 0 ? columns[columns.length - 1].left + columns[columns.length - 1].width : INDEX_WIDTH;
  const rawGridContentRight = dataWidth + ADD_FIELD_WIDTH;
  const columnResizeGuide = useMemo(() => {
    const fieldId = activeResize?.fieldId ?? hoverResizeFieldId;
    if (!fieldId) return null;
    const column = columns.find(item => item.field.id === fieldId);
    if (!column) return null;
    return { x: column.left + column.width, height: gridBodyBottom };
  }, [activeResize, columns, gridBodyBottom, hoverResizeFieldId]);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [layoutCaps, setLayoutCaps] = useState({
    anchor: 0,
    maxBleedWidth: 0,
    trackWidth: 0,
    shiftMax: 0,
    widthExpandMax: 0,
    expandScrollMax: 0,
    panScrollMax: 0,
    bleedLeft: 0,
  });
  const [scrollLeft, setScrollLeft] = useState(0);
  const [foldMode, setFoldMode] = useState(false);
  const [hThumbDragging, setHThumbDragging] = useState(false);
  const [hoverAddFieldHeader, setHoverAddFieldHeader] = useState(false);
  const canvasWidth = Math.max(BITABLE_GRID_MIN_WIDTH, INDEX_WIDTH + ADD_FIELD_WIDTH, rawGridContentRight, viewportWidth);
  const gridContentRight = canvasWidth;
  const addFieldLeft = dataWidth;
  const addFieldWidth = gridContentRight - dataWidth;
  const canvasHeight = gridBodyBottom;
  const frozenColumn = columns[0];
  const freezeWidth = INDEX_WIDTH + (frozenColumn?.width ?? DEFAULT_FIELD_WIDTH);
  const { anchor, maxBleedWidth, trackWidth, shiftMax, panScrollMax } = layoutCaps;
  const isFrozenScroll = foldMode;
  const baseScrollWidth = trackWidth || anchor || viewportWidth;
  const wideLimit = maxBleedWidth || baseScrollWidth;
  const restingDisplayWidth = anchor > 0
    ? Math.min(
      baseScrollWidth || wideLimit,
      Math.max(anchor, Math.min(canvasWidth, baseScrollWidth || canvasWidth)),
    )
    : viewportWidth;
  const contentMaxScrollLeft = Math.max(0, canvasWidth - baseScrollWidth);
  const maxScrollLeft = isFrozenScroll
    ? Math.max(0, canvasWidth - baseScrollWidth)
    : contentMaxScrollLeft;
  const cappedShiftMax = shiftMax;
  const nonFrozenBlockShift = Math.min(cappedShiftMax, scrollLeft);
  const shouldFreezeColumns = foldMode || scrollLeft > nonFrozenBlockShift + 0.5;
  const overlayInFrozenZone = (left: number) => shouldFreezeColumns && left < freezeWidth;
  /* 可以向左利用空白，但不能越过 syncLayoutCaps 算出的目录/侧栏安全边界 */
  const blockShift = shouldFreezeColumns
    ? cappedShiftMax
    : nonFrozenBlockShift;
  const shiftedDisplayWidth = Math.min(
    wideLimit,
    Math.max(restingDisplayWidth, Math.min(canvasWidth, baseScrollWidth + blockShift)),
  );
  const displayWidth = scrollLeft > 0 || shouldFreezeColumns
    ? shiftedDisplayWidth
    : restingDisplayWidth;
  const panAmount = Math.max(0, scrollLeft - blockShift);
  const canvasScrollOffsetX = shouldFreezeColumns ? freezeWidth + panAmount : panAmount;
  const gridHeaderFollowX = blockShift;
  /* 滚动区 overlay 坐标与 canvas 一致；冻结列改在 viewport 层单独绘制，避免被 scroll-pane 裁切 */
  const resolveOverlayLeft = (left: number) => left;
  const exceedsExtendWidth = maxBleedWidth > 0 && canvasWidth > maxBleedWidth;
  const scrollTrackWidth = baseScrollWidth;

  const hScrollMetrics = useMemo(() => {
    const trackWidth = scrollTrackWidth > 0 ? scrollTrackWidth : viewportWidth;
    if (trackWidth <= 0 || maxScrollLeft <= 0) {
      return { trackWidth, thumbWidth: 0, thumbLeft: 0, travel: 0 };
    }
    // 与原生滚动条一致：clientWidth / scrollWidth，其中 scrollWidth = client + maxScrollLeft
    const virtualScrollWidth = trackWidth + maxScrollLeft;
    let thumbWidth = Math.max(48, Math.round((trackWidth * trackWidth) / virtualScrollWidth));
    thumbWidth = Math.min(thumbWidth, Math.max(48, trackWidth - 48));
    const travel = Math.max(0, trackWidth - thumbWidth);
    const thumbLeft = travel > 0 ? (scrollLeft / maxScrollLeft) * travel : 0;
    return { trackWidth, thumbWidth, thumbLeft, travel };
  }, [maxScrollLeft, scrollLeft, scrollTrackWidth, viewportWidth]);

  const applyScrollLeft = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(next, maxScrollLeft));
    scrollLeftRef.current = clamped;
    setScrollLeft(clamped);
  }, [maxScrollLeft]);

  const scrollToAddColumn = useCallback(() => {
    applyScrollLeft(maxScrollLeft);
  }, [applyScrollLeft, maxScrollLeft]);

  const openAddFieldPanelAt = useCallback((anchor: { left: number; top: number }) => {
    addField(anchor);
    scrollToAddColumn();
  }, [addField, scrollToAddColumn]);

  const syncLayoutCaps = useCallback(() => {
    const block = wrapRef.current?.closest<HTMLElement>('.feishu-bitable-block');
    const shell = shellRef.current;
    if (!block || !shell) {
      setViewportWidth(shell?.clientWidth ?? 0);
      return;
    }
    const columnHost = block.closest<HTMLElement>('.feishu-columns-block__col');
    if (columnHost) {
      const blockLeftNow = block.getBoundingClientRect().left;
      const anchorWidth = Math.max(
        BITABLE_GRID_MIN_WIDTH,
        columnHost.clientWidth || block.clientWidth || shell.clientWidth,
      );
      anchorWidthRef.current = anchorWidth;
      layoutOriginRef.current = { blockLeft: blockLeftNow, bleedLeft: blockLeftNow };
      block.style.setProperty('--bitable-bleed-left', `${blockLeftNow}px`);
      block.style.setProperty('--bitable-block-left', `${blockLeftNow}px`);
      block.style.setProperty('--bitable-anchor-width', `${anchorWidth}px`);
      block.style.setProperty('--bitable-anchor-scroll-width', `${anchorWidth}px`);
      block.classList.remove('is-grid-hscroll-active');
      setLayoutCaps({
        anchor: anchorWidth,
        maxBleedWidth: anchorWidth,
        trackWidth: anchorWidth,
        shiftMax: 0,
        widthExpandMax: 0,
        expandScrollMax: 0,
        panScrollMax: 0,
        bleedLeft: blockLeftNow,
      });
      setViewportWidth(Math.max(INDEX_WIDTH + ADD_FIELD_WIDTH, anchorWidth));
      return;
    }
    const blockLeftNow = block.getBoundingClientRect().left;
    const bleedHost = block.closest<HTMLElement>('.doc-page-workspace')
      ?? block.closest<HTMLElement>('.editor-container')
      ?? block.parentElement;
    const bleedLeftNow = bleedHost?.getBoundingClientRect().left ?? blockLeftNow;

    if (scrollLeftRef.current <= 0 && !foldMode) {
      anchorWidthRef.current = Math.max(
        BITABLE_GRID_MIN_WIDTH,
        block.getBoundingClientRect().width
          || block.parentElement?.clientWidth
          || shell.clientWidth,
      );
      layoutOriginRef.current = { blockLeft: blockLeftNow, bleedLeft: bleedLeftNow };
    } else if (!anchorWidthRef.current) {
      anchorWidthRef.current = Math.max(
        BITABLE_GRID_MIN_WIDTH,
        block.getBoundingClientRect().width
          || block.parentElement?.clientWidth
          || shell.clientWidth,
      );
      layoutOriginRef.current = { blockLeft: blockLeftNow, bleedLeft: bleedLeftNow };
    }

    const anchorWidth = anchorWidthRef.current;
    const { blockLeft } = layoutOriginRef.current;
    const rightEdge = resolveBitableBleedRightEdge(block, BITABLE_EDGE_MARGIN);
    const pageMain = block.closest<HTMLElement>('.doc-page-main');
    const catalogueRail = pageMain?.querySelector<HTMLElement>('.doc-page-catalogue-rail');
    const railRect = catalogueRail?.getBoundingClientRect();
    const railVisible = Boolean(
      catalogueRail
      && railRect
      && railRect.width > 1
      && getComputedStyle(catalogueRail).display !== 'none',
    );
    const railRight = railVisible && railRect ? railRect.right : 0;
    const safeLeft = Math.max(
      BITABLE_EDGE_MARGIN,
      railRight ? railRight + 8 : 0,
    );
    const nextMaxBleedWidth = Math.max(
      INDEX_WIDTH + ADD_FIELD_WIDTH,
      rightEdge - safeLeft,
    );
    const nextShiftMax = Math.max(0, blockLeft - safeLeft);
    const nextTrackWidth = Math.max(
      INDEX_WIDTH + ADD_FIELD_WIDTH,
      nextMaxBleedWidth - nextShiftMax,
    );
    const nextWidthExpandMax = Math.max(0, nextMaxBleedWidth - anchorWidth);
    const nextPanScrollMax = Math.max(0, canvasWidth - nextMaxBleedWidth);
    const nextMaxScrollLeft = Math.max(0, canvasWidth - nextTrackWidth);

    block.style.setProperty('--bitable-bleed-left', `${safeLeft}px`);
    block.style.setProperty('--bitable-block-left', `${blockLeft}px`);
    block.style.setProperty('--bitable-anchor-width', `${anchorWidth}px`);
    block.style.setProperty('--bitable-anchor-scroll-width', `${nextTrackWidth}px`);
    block.classList.toggle(
      'is-grid-hscroll-active',
      nextMaxScrollLeft > 0,
    );

    setLayoutCaps({
      anchor: anchorWidth,
      maxBleedWidth: nextMaxBleedWidth,
      trackWidth: nextTrackWidth,
      shiftMax: nextShiftMax,
      widthExpandMax: nextWidthExpandMax,
      expandScrollMax: 0,
      panScrollMax: nextPanScrollMax,
      bleedLeft: safeLeft,
    });
    setViewportWidth(Math.max(INDEX_WIDTH + ADD_FIELD_WIDTH, anchorWidth));
  }, [canvasWidth, foldMode]);

  useEffect(() => {
    const block = wrapRef.current?.closest<HTMLElement>('.feishu-bitable-block');
    if (!block) return;
    block.style.setProperty('--bitable-display-width', `${displayWidth}px`);
    block.style.setProperty('--bitable-block-shift', `${blockShift}px`);
    block.style.setProperty('--bitable-grid-header-follow-x', `${gridHeaderFollowX}px`);
    block.classList.toggle(
      'is-grid-bleed-active',
      blockShift > 0 || displayWidth > anchor + 1 || panScrollMax > 0,
    );
    block.dispatchEvent(new CustomEvent('bitable-grid-scroll', { bubbles: true }));
  }, [anchor, blockShift, displayWidth, gridHeaderFollowX, panScrollMax]);

  useEffect(() => {
    const block = wrapRef.current?.closest<HTMLElement>('.feishu-bitable-block');
    if (!block) return;
    const onExpandAll = () => setCollapsedRecordIds(new Set());
    block.addEventListener(BITABLE_BLOCK_EXPAND_ALL, onExpandAll);
    return () => block.removeEventListener(BITABLE_BLOCK_EXPAND_ALL, onExpandAll);
  }, []);

  useEffect(() => {
    syncLayoutCaps();
    const onResize = () => {
      layoutOriginRef.current = { blockLeft: 0, bleedLeft: 0 };
      anchorWidthRef.current = 0;
      syncLayoutCaps();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [syncLayoutCaps]);

  const prevScrollLeftForLayoutRef = useRef(0);
  useEffect(() => {
    if (scrollLeft <= 0 && prevScrollLeftForLayoutRef.current > 0 && !foldMode) {
      layoutOriginRef.current = { blockLeft: 0, bleedLeft: 0 };
      syncLayoutCaps();
    }
    prevScrollLeftForLayoutRef.current = scrollLeft;
  }, [foldMode, scrollLeft, syncLayoutCaps]);

  useEffect(() => {
    const prevWidth = prevCanvasWidthRef.current;
    const prevMaxScrollLeft = prevMaxScrollLeftRef.current;
    const widthGrew = prevWidth > 0 && canvasWidth > prevWidth;
    const wasAtScrollEnd = prevMaxScrollLeft > 0 && scrollLeftRef.current >= prevMaxScrollLeft - 1;

    if (widthGrew && wasAtScrollEnd && exceedsExtendWidth) {
      setFoldMode(true);
      pendingFoldScrollRef.current = true;
    }

    prevCanvasWidthRef.current = canvasWidth;
    prevMaxScrollLeftRef.current = isFrozenScroll
      ? Math.max(0, canvasWidth - maxBleedWidth)
      : contentMaxScrollLeft;
  }, [canvasWidth, contentMaxScrollLeft, exceedsExtendWidth, isFrozenScroll, maxBleedWidth, maxScrollLeft]);

  useEffect(() => {
    if (scrollLeft <= 0) {
      setFoldMode(false);
      pendingFoldScrollRef.current = false;
    }
  }, [scrollLeft]);

  useEffect(() => {
    if (!foldMode || !pendingFoldScrollRef.current) return;
    pendingFoldScrollRef.current = false;
    applyScrollLeft(maxScrollLeft);
  }, [applyScrollLeft, foldMode, maxScrollLeft]);

  useEffect(() => {
    if (scrollLeftRef.current > maxScrollLeft) {
      applyScrollLeft(maxScrollLeft);
    }
  }, [applyScrollLeft, maxScrollLeft]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      const delta = event.shiftKey
        ? event.deltaY
        : (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : 0);
      if (!delta || maxScrollLeft <= 0) return;
      event.preventDefault();
      applyScrollLeft(scrollLeftRef.current + delta);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [applyScrollLeft, maxScrollLeft]);

  const handleHTrackPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (maxScrollLeft <= 0 || hTrackRef.current == null) return;
    if ((event.target as HTMLElement).classList.contains('base-grid-hscroll__thumb')) return;
    const rect = hTrackRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const clickX = event.clientX - rect.left;
    const { thumbWidth, travel } = hScrollMetrics;
    const effectiveTravel = travel > 0 ? travel : Math.max(1, rect.width - thumbWidth);
    const nextLeft = Math.max(0, Math.min(clickX - thumbWidth / 2, effectiveTravel));
    applyScrollLeft((nextLeft / effectiveTravel) * maxScrollLeft);
  };

  const handleHThumbPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (maxScrollLeft <= 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    hThumbDragRef.current = { startX: event.clientX, startScrollLeft: scrollLeftRef.current };
    setHThumbDragging(true);
  };

  const handleHThumbPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = hThumbDragRef.current;
    if (!drag || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const rect = hTrackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || maxScrollLeft <= 0) return;
    const { thumbWidth } = hScrollMetrics;
    const effectiveTravel = Math.max(1, rect.width - thumbWidth);
    const deltaScroll = ((event.clientX - drag.startX) / effectiveTravel) * maxScrollLeft;
    applyScrollLeft(drag.startScrollLeft + deltaScroll);
  };

  const finishHThumbDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    hThumbDragRef.current = null;
    setHThumbDragging(false);
  };

  const addFromAddRow = (column: GridColumn | null) => {
    if (activeView.locked) return;
    const recordId = addRecord();
    const focusColumn = column ?? columns.find(item => item.field.id === table.primaryFieldId) ?? columns[0];
    if (focusColumn) pendingCellFocusRef.current = { recordId, fieldId: focusColumn.field.id, scrollAlign: 'end' };
  };

  useEffect(() => {
    if (!fieldMenu) return;
    let removeListener: (() => void) | null = null;
    const timer = window.setTimeout(() => {
      const close = (event: globalThis.MouseEvent) => {
        if (Date.now() - fieldMenuOpenAtRef.current < 250) return;
        if (!(event.target instanceof Node)) return;
        if (event.target instanceof Element) {
          if (event.target.closest('.base-grid-field-menu')) return;
          if (event.target.closest('.base-grid-field-chevron')) return;
          if (event.target.closest('.base-grid-overlay-header')) return;
        }
        setFieldMenu(null);
      };
      document.addEventListener('mousedown', close);
      removeListener = () => document.removeEventListener('mousedown', close);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      removeListener?.();
    };
  }, [fieldMenu]);

  useEffect(() => {
    if (!selectEditor) return;
    const close = (event: globalThis.MouseEvent) => {
      if (!(event.target instanceof Node)) return;
      if (selectEditorRef.current?.contains(event.target)) return;
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
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = isPartiallySelected;
  }, [isPartiallySelected]);

  useEffect(() => {
    if (!selectionRange) return;
    const ids = getSelectionRecordIds(selectionRange, gridRows);
    if (ids.length === 0 || ids.some(id => !records.some(record => record.id === id))) {
      setSelectionRange(null);
      setSelectedCell(null);
    }
  }, [gridRows, records, selectionRange]);

  useEffect(() => {
    if (!selectedCell) return;
    if (!displayRecords.some(record => record.id === selectedCell.recordId)) {
      setSelectedCell(null);
      setSelectionRange(null);
    }
  }, [displayRecords, selectedCell]);

  useEffect(() => {
    if (!selectedCell && !editingCell && !selectEditor) return;
    const clearCellFocus = (event: globalThis.MouseEvent) => {
      if (!(event.target instanceof Node)) return;
      const target = event.target;
      if (target instanceof Element) {
        if (target.closest('.base-grid-select-editor')) return;
        if (target.closest('.base-grid-field-menu')) return;
        if (target.closest('.base-grid-cell-menu--portal')) return;
        if (target.closest('.base-grid-cell-editor')) return;
        if (cellMenuRef.current?.contains(target)) return;
        if (selectEditorRef.current?.contains(target)) return;
        if (wrapRef.current?.contains(target) && target.closest('.base-grid-canvas')) return;
      }
      if (editingCellRef.current) commitEditingCell();
      setSelectedCell(null);
      setSelectionRange(null);
      setSelectEditor(null);
    };
    document.addEventListener('mousedown', clearCellFocus, true);
    return () => document.removeEventListener('mousedown', clearCellFocus, true);
  }, [selectedCell, editingCell, selectEditor]);

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

    displayRecords.forEach((record, rowIndex) => {
      const visualIndex = gridRows.findIndex(row => row.kind === 'record' && row.record.id === record.id);
      if (visualIndex < 0) return;
      if (selectedIds.has(record.id)) {
        ctx.fillStyle = '#e8f3ff';
        ctx.fillRect(0, HEADER_HEIGHT + visualIndex * ROW_HEIGHT, dataWidth, ROW_HEIGHT);
      }
    });

    const activeCellRowIndex = selectedCell?.rowIndex ?? null;
    const hasMultiCellSelection = isMultiCellRange(selectionRange);
    if (
      !hasMultiCellSelection
      && activeCellRowIndex != null
      && activeCellRowIndex >= 0
      &&       activeCellRowIndex < gridRows.length
      && gridRows[activeCellRowIndex]?.kind === 'record'
      && !selectedIds.has((gridRows[activeCellRowIndex] as Extract<GridDisplayRow, { kind: 'record' }>).record.id)
    ) {
      ctx.fillStyle = '#e8f3ff';
      ctx.fillRect(0, HEADER_HEIGHT + activeCellRowIndex * ROW_HEIGHT, dataWidth, ROW_HEIGHT);
    }

    if (selectionRange) {
      drawCellRangeSelection(ctx, selectionRange, columns, gridRows, ROW_HEIGHT);
    }

    if (rowDrag) {
      const fromRecord = recordAtGridRow(gridRows, rowDrag.fromIndex);
      if (fromRecord) {
        const fromRecordsIndex = records.findIndex(record => record.id === fromRecord.id);
        if (fromRecordsIndex >= 0) {
          const subtreeIds = getRecordSubtreeIds(records, fromRecordsIndex);
          gridRows.forEach((row, rowIndex) => {
            if (row.kind !== 'record' || !subtreeIds.has(row.record.id)) return;
            ctx.fillStyle = 'rgba(51, 112, 255, 0.1)';
            ctx.fillRect(0, HEADER_HEIGHT + rowIndex * ROW_HEIGHT, dataWidth, ROW_HEIGHT);
          });
        }
      }
    }

    if (
      hoverRow != null
      && hoverRow >= 0
      &&       hoverRow < gridRows.length
      && gridRows[hoverRow]?.kind === 'record'
      && hoverRow !== activeCellRowIndex
      && !selectedIds.has((gridRows[hoverRow] as Extract<GridDisplayRow, { kind: 'record' }>).record.id)
    ) {
      ctx.fillStyle = '#f2f3f5';
      ctx.fillRect(0, HEADER_HEIGHT + hoverRow * ROW_HEIGHT, dataWidth, ROW_HEIGHT);
    }

    if (hoverHeaderFieldId) {
      const headerColumn = columns.find(column => column.field.id === hoverHeaderFieldId);
      if (headerColumn && !isHeaderColumnInRange(selectionRange, headerColumn.field.id, columns)) {
        ctx.fillStyle = '#f2f3f5';
        ctx.fillRect(headerColumn.left, 0, headerColumn.width, HEADER_HEIGHT);
      }
    }

    ctx.strokeStyle = '#dee0e3';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const addRowTop = HEADER_HEIGHT + addRowIndex * ROW_HEIGHT;
    const addFieldCrisp = Math.round(addFieldLeft) + 0.5;
    const contentRightCrisp = gridContentRight - 0.5;
    const verticals = [0, ...columns.map(column => column.left + column.width), gridContentRight];
    verticals.forEach(x => {
      const crisp = Math.round(x) + 0.5;
      const isLeftEdge = Math.round(x) <= 0;
      const isAddFieldEdge = Math.round(x) === Math.round(addFieldLeft);
      if (isAddFieldEdge) {
        // 表头区先画分隔线，表体区白底后会重绘
        ctx.moveTo(crisp, 0);
        ctx.lineTo(crisp, HEADER_HEIGHT);
        return;
      }
      ctx.moveTo(crisp, 0);
      ctx.lineTo(crisp, isLeftEdge ? canvasHeight : addRowTop);
    });
    // 数据区横线；右侧「新增字段」列保持合并样式，不绘制行间横线
    for (let row = 0; row <= rowCount; row += 1) {
      const y = Math.round(HEADER_HEIGHT + row * ROW_HEIGHT) + 0.5;
      const lineRight = row === rowCount ? contentRightCrisp : addFieldCrisp;
      ctx.moveTo(0, y);
      ctx.lineTo(lineRight, y);
    }
    const headerBottomY = Math.round(HEADER_HEIGHT) + 0.5;
    ctx.moveTo(addFieldCrisp, headerBottomY);
    ctx.lineTo(contentRightCrisp, headerBottomY);
    ctx.moveTo(0.5, 0.5);
    ctx.lineTo(contentRightCrisp, 0.5);
    ctx.stroke();

    if (hoverAddFieldHeader) {
      ctx.fillStyle = '#f5f8ff';
      ctx.fillRect(addFieldLeft, 0, addFieldWidth, HEADER_HEIGHT);
    }

    ctx.font = '13px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textBaseline = 'middle';
    gridRows.forEach((row, rowIndex) => {
      if (row.kind === 'group') {
        drawGridGroupRow(ctx, row, rowIndex, HEADER_HEIGHT, ROW_HEIGHT, addFieldLeft, collapsedGroupKeys.has(row.key));
        return;
      }
      const record = row.record;
      const y = HEADER_HEIGHT + rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
      const rowTop = HEADER_HEIGHT + rowIndex * ROW_HEIGHT;
      const recordIndex = displayRecords.findIndex(item => item.id === record.id);
      const meta = recordIndex >= 0 ? treeMeta[recordIndex] : undefined;
      ctx.font = '13px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      columns.forEach(column => {
        const text = column.field.type === 'attachment'
          ? attachmentCellLabel(record, column.field.id)
          : valueText(record.fields[column.field.id]);
        if (column.field.id === table.primaryFieldId && meta) {
          drawRecordTreeGuides(ctx, column.left, rowTop, ROW_HEIGHT, meta, collapsedRecordIds.has(record.id));
        }
        if (isSelectField(column.field)) {
          const values = column.field.type === 'multi_select'
            ? getMultiSelectChoices(column.field, record.fields[column.field.id])
            : getSelectValues(record, column.field);
          const isSelected = selectedCell?.recordId === record.id && selectedCell?.fieldId === column.field.id;
          const isEditingSelect = selectEditor?.recordId === record.id && selectEditor?.fieldId === column.field.id;
          const isHovered = hoverCell?.rowIndex === rowIndex && hoverCell?.fieldId === column.field.id;
          const hasSelectValues = values.length > 0;
          if (hasSelectValues || isSelected || isEditingSelect || isHovered) drawChevron(ctx, column.left + column.width - 14, y);
        } else {
          const isEditingCell = editingCell?.recordId === record.id && editingCell?.fieldId === column.field.id;
          if (!isEditingCell) {
            ctx.fillStyle = column.field.type === 'attachment' ? '#646a73' : '#1f2329';
            const textInset = cellTextInset(column, meta, table.primaryFieldId);
            const textX = column.left + textInset;
            drawText(ctx, text, textX, y, column.width - textInset - PRIMARY_CELL_PADDING);
          }
        }
      });
    });

    if (selectedCell && !editingCell && gridRows[selectedCell.rowIndex]?.kind === 'record') {
      const column = columns.find(item => item.field.id === selectedCell.fieldId);
      if (column) {
        const record = recordAtGridRow(gridRows, selectedCell.rowIndex);
        const recordIndex = record ? displayRecords.findIndex(item => item.id === record.id) : -1;
        const meta = recordIndex >= 0 ? treeMeta[recordIndex] : undefined;
        const isPrimaryField = column.field.id === table.primaryFieldId;
        const layout = getCellEditorLayout(column, meta, isPrimaryField);
        const x = Math.round(layout.left);
        const y = Math.round(HEADER_HEIGHT + selectedCell.rowIndex * ROW_HEIGHT);
        ctx.strokeStyle = '#3370ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, layout.width - 2, ROW_HEIGHT - 2);
      }
    }

    if (hoverAddRow) {
      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(0, HEADER_HEIGHT + addRowIndex * ROW_HEIGHT, addFieldLeft, ROW_HEIGHT);
    }

    // 新增字段列：表头以下合并为整块白底，覆盖分组行等背景
    ctx.fillStyle = '#fff';
    ctx.fillRect(addFieldLeft, HEADER_HEIGHT, addFieldWidth, Math.max(0, addRowTop - HEADER_HEIGHT));

    // 白底会盖住网格线，需重绘新增字段列左右边线与右边线
    ctx.strokeStyle = '#dee0e3';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const addFieldRightCrisp = Math.round(gridContentRight) + 0.5;
    ctx.moveTo(addFieldCrisp, HEADER_HEIGHT);
    ctx.lineTo(addFieldCrisp, canvasHeight);
    ctx.moveTo(addFieldRightCrisp, HEADER_HEIGHT);
    ctx.lineTo(addFieldRightCrisp, canvasHeight);
    ctx.stroke();

    if (shouldFreezeColumns && frozenCanvasRef.current) {
      const frozen = frozenCanvasRef.current;
      const fDpr = window.devicePixelRatio || 1;
      const frozenWidth = INDEX_WIDTH + (columns[0]?.width ?? DEFAULT_FIELD_WIDTH);
      frozen.width = Math.round(frozenWidth * fDpr);
      frozen.height = Math.round(canvasHeight * fDpr);
      frozen.style.width = `${frozenWidth}px`;
      frozen.style.height = `${canvasHeight}px`;
      const fCtx = frozen.getContext('2d');
      if (fCtx) {
        fCtx.setTransform(fDpr, 0, 0, fDpr, 0, 0);
        fCtx.clearRect(0, 0, frozenWidth, canvasHeight);
        fCtx.drawImage(
          canvas,
          0,
          0,
          frozenWidth * fDpr,
          canvasHeight * fDpr,
          0,
          0,
          frozenWidth,
          canvasHeight,
        );
      }
    }

  }, [activeResize, addFieldLeft, addFieldWidth, addRowIndex, canvasHeight, canvasWidth, collapsedGroupKeys, collapsedRecordIds, columns, dataWidth, displayRecords, editingCell, gridBodyBottom, gridContentRight, gridRows, hoverAddFieldHeader, hoverAddRow, hoverCell, hoverHeaderFieldId, hoverRow, records, rowCount, rowDrag, scrollLeft, selectEditor, selectedCell, selectionRange, selectedIds, shouldFreezeColumns, table.primaryFieldId, treeMeta]);

  const commitEditingCell = () => {
    const current = editingCellRef.current;
    if (!current) return;
    changeCell(current.recordId, current.fieldId, current.value);
    setEditingCell(null);
  };

  const beginTextEdit = (
    record: BaseRecord,
    column: GridColumn,
    rowIndex: number,
    value?: string,
  ) => {
    if (activeView.locked || column.field.type === 'attachment' || isSelectField(column.field)) return;
    const recordIndex = displayRecords.findIndex(item => item.id === record.id);
    const meta = recordIndex >= 0 ? treeMeta[recordIndex] : undefined;
    const isPrimaryField = column.field.id === table.primaryFieldId;
    const layout = getCellEditorLayout(column, meta, isPrimaryField);
    setEditingCell({
      recordId: record.id,
      fieldId: column.field.id,
      left: layout.left,
      top: HEADER_HEIGHT + rowIndex * ROW_HEIGHT,
      width: layout.width,
      paddingLeft: layout.paddingLeft,
      paddingRight: layout.paddingRight,
      value: value ?? valueText(record.fields[column.field.id]),
    });
  };

  editingCellRef.current = editingCell;
  selectedCellRef.current = selectedCell;

  const openSelectEditor = (record: BaseRecord, column: GridColumn, rowIndex: number) => {
    if (activeView.locked) return;
    setSelectEditor({
      recordId: record.id,
      fieldId: column.field.id,
      left: column.left,
      top: HEADER_HEIGHT + rowIndex * ROW_HEIGHT,
      width: column.width,
      value: valueText(record.fields[column.field.id]),
      query: '',
    });
  };

  const openFieldMenuAt = (
    fieldId: string,
    clientX: number,
    clientY: number,
    columnLeft: number,
    toggle = true,
  ) => {
    const isPrimary = fieldId === table.primaryFieldId;
    const { left, top } = computeFieldMenuViewportPosition(clientX, clientY, isPrimary);
    fieldMenuOpenAtRef.current = Date.now();
    setCellContextMenu(null);
    setSelectEditor(null);
    setFieldMenu(current => {
      if (toggle && current?.fieldId === fieldId) return null;
      return { fieldId, left, top, columnLeft };
    });
  };

  const fieldMenuPortalRoot = wrapRef.current?.closest<HTMLElement>('.feishu-bitable-block') ?? document.body;

  const clearSelectValue = (record: BaseRecord, field: BaseField, choiceId: string) => {
    if (field.type === 'single_select') {
      changeCell(record.id, field.id, '');
      return;
    }
    changeCell(record.id, field.id, getSelectValues(record, field).filter(item => item !== choiceId));
  };

  const startEditing = (record: BaseRecord, column: GridColumn, rowIndex: number) => {
    beginTextEdit(record, column, rowIndex);
  };

  useEffect(() => {
    if (!editingCell) return;
    suppressBlurCommitRef.current = true;
    const focusInput = () => {
      const input = inputRef.current;
      if (!input) return;
      input.focus({ preventScroll: true });
      const length = input.value.length;
      input.setSelectionRange(length, length);
      suppressBlurCommitRef.current = false;
    };
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(focusInput);
    });
    return () => cancelAnimationFrame(frame);
  }, [editingCell?.recordId, editingCell?.fieldId]);

  useEffect(() => {
    if (activeView.locked || selectEditor) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const currentEdit = editingCellRef.current;
      const currentSelect = selectedCellRef.current;
      if (!currentEdit && !currentSelect) return;

      const target = event.target;
      if (target instanceof HTMLInputElement && target.classList.contains('base-grid-select-editor__search')) return;
      if (target instanceof HTMLInputElement && target.classList.contains('base-grid-cell-editor')) return;

      const isPrintable = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;

      if (event.key === 'Escape') {
        if (currentEdit) {
          event.preventDefault();
          event.stopImmediatePropagation();
          setEditingCell(null);
        }
        return;
      }

      if (!currentEdit && currentSelect && (isPrintable || event.key === 'Enter' || event.key === 'F2')) {
        const record = recordAtGridRow(gridRows, currentSelect.rowIndex);
        const column = columns.find(item => item.field.id === currentSelect.fieldId);
        if (!record || !column || column.field.type === 'attachment' || isSelectField(column.field)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (isPrintable) {
          beginTextEdit(record, column, currentSelect.rowIndex, event.key);
        } else {
          beginTextEdit(record, column, currentSelect.rowIndex);
        }
        return;
      }

      if (currentEdit && isPrintable) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setEditingCell(current => {
          if (!current) return current;
          return { ...current, value: current.value + event.key };
        });
        requestAnimationFrame(() => {
          const input = inputRef.current;
          if (!input) return;
          input.focus({ preventScroll: true });
          const length = input.value.length;
          input.setSelectionRange(length, length);
        });
        return;
      }

      if (currentEdit && event.key === 'Backspace') {
        event.preventDefault();
        event.stopImmediatePropagation();
        setEditingCell(current => {
          if (!current) return current;
          return { ...current, value: current.value.slice(0, -1) };
        });
        requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
        return;
      }

      if (currentEdit && (event.key === 'Delete' || event.key === 'Enter')) {
        event.stopImmediatePropagation();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [activeView.locked, selectEditor, gridRows, columns, treeMeta, table.primaryFieldId]);

  useEffect(() => {
    const pending = pendingCellFocusRef.current;
    if (!pending) return;
    const rowIndex = gridRows.findIndex(row => row.kind === 'record' && row.record.id === pending.recordId);
    if (rowIndex < 0) return;
    const column = columns.find(item => item.field.id === pending.fieldId);
    const record = recordAtGridRow(gridRows, rowIndex);
    if (!column || !record) return;
    pendingCellFocusRef.current = null;
    const rowTop = HEADER_HEIGHT + rowIndex * ROW_HEIGHT;
    const scrollRoot = canvasScrollRef.current;
    if (scrollRoot) {
      const canvasRect = scrollRoot.getBoundingClientRect();
      const workspace = scrollRoot.closest<HTMLElement>('.doc-page-workspace');
      if (workspace) {
        const workspaceRect = workspace.getBoundingClientRect();
        const rowScreenTop = canvasRect.top + rowTop;
        const rowScreenBottom = rowScreenTop + ROW_HEIGHT;
        if (rowScreenBottom > workspaceRect.bottom) {
          workspace.scrollTop += rowScreenBottom - workspaceRect.bottom;
        } else if (pending.scrollAlign !== 'end' && rowScreenTop < workspaceRect.top) {
          workspace.scrollTop += rowScreenTop - workspaceRect.top;
        }
      }
    }
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
  }, [gridRows, columns, ROW_HEIGHT]);

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const point = pointFromCanvas(event, canvasScrollOffsetX);
    if (activeResize) {
      const width = clampWidth(activeResize.startWidth + event.clientX - activeResize.startX);
      setActiveResize(current => current ? { ...current, width } : current);
      return;
    }
    const cellDrag = cellSelectDragRef.current;
    if (cellDrag && event.currentTarget.hasPointerCapture(event.pointerId)) {
      const focus = resolveDragFocusFromPoint(point, {
        gridRows,
        columns,
        dataWidth,
        addRowIndex,
        rowHeight: ROW_HEIGHT,
      });
      if (focus) {
        cellDrag.moved = cellDrag.moved
          || focus.rowIndex !== cellDrag.anchorRow
          || focus.colIndex !== cellDrag.anchorCol;
        setSelectionRange({
          anchorRow: cellDrag.anchorRow,
          anchorCol: cellDrag.anchorCol,
          focusRow: focus.rowIndex,
          focusCol: focus.colIndex,
        });
        const row = gridRows[focus.rowIndex];
        const column = columns[focus.colIndex];
        if (row?.kind === 'record' && column) {
          setSelectedCell({
            recordId: row.record.id,
            fieldId: column.field.id,
            rowIndex: focus.rowIndex,
          });
        } else if (focus.rowIndex === -1) {
          setSelectedCell(null);
        }
      }
      event.currentTarget.style.cursor = 'cell';
      return;
    }
    const resizeColumn = point.y < HEADER_HEIGHT ? findResizeColumn(columns, point.x) : null;
    const isAddFieldHeaderPoint = point.y < HEADER_HEIGHT && point.x >= addFieldLeft && point.x < gridContentRight;
    setHoverResizeFieldId(resizeColumn?.field.id || null);
    if (point.y < HEADER_HEIGHT && point.x < dataWidth) {
      setHoverHeaderFieldId(findColumn(columns, point.x)?.field.id ?? null);
      setHoverAddFieldHeader(false);
    } else if (isAddFieldHeaderPoint) {
      setHoverHeaderFieldId(null);
      setHoverAddFieldHeader(true);
      event.currentTarget.style.cursor = 'pointer';
    } else {
      setHoverHeaderFieldId(null);
      setHoverAddFieldHeader(false);
    }
    const rowIndex = Math.floor((point.y - HEADER_HEIGHT) / ROW_HEIGHT);
    if (point.y >= HEADER_HEIGHT && rowIndex === addRowIndex && point.x < gridContentRight) {
      setHoverAddRow(true);
      setHoverRow(null);
      setHoverCell(null);
      setHoverAddFieldHeader(false);
      event.currentTarget.style.cursor = 'pointer';
      return;
    }
    setHoverAddRow(false);
    const nextHoverRow = point.y >= HEADER_HEIGHT && rowIndex >= 0 && rowIndex < gridRows.length ? rowIndex : null;
    setHoverRow(nextHoverRow);
    if (nextHoverRow != null && gridRows[nextHoverRow]?.kind === 'record' && point.x >= INDEX_WIDTH && point.x < dataWidth) {
      const column = findColumn(columns, point.x);
      setHoverCell(column ? { rowIndex: nextHoverRow, fieldId: column.field.id } : null);
    } else {
      setHoverCell(null);
    }
    const isSelectedRangePoint = isPointInCellRange(point, selectionRange, columns, ROW_HEIGHT);
    event.currentTarget.style.cursor = resizeColumn
      ? 'ew-resize'
      : isAddFieldHeaderPoint || isSelectedRangePoint
        ? 'pointer'
        : 'default';
  };

  const handlePointerLeave = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.relatedTarget instanceof Node && shellRef.current?.contains(event.relatedTarget)) return;
    if (!activeResize) {
      setHoverRow(null);
      setHoverCell(null);
      setHoverAddRow(false);
      setHoverAddFieldHeader(false);
      setHoverHeaderFieldId(null);
      setHoverResizeFieldId(null);
      event.currentTarget.style.cursor = 'default';
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const point = pointFromCanvas(event, canvasScrollOffsetX);
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
    if (point.y < HEADER_HEIGHT) {
      if (point.x >= addFieldLeft && point.x < gridContentRight && !activeView.locked) {
        setSelectedCell(null);
        setSelectionRange(null);
        setSelectEditor(null);
        openAddFieldPanelAt({
          left: event.clientX - 320,
          top: event.clientY + 4,
        });
        return;
      }
      const hit = resolveSelectableCellAtPoint(point, {
        gridRows,
        columns,
        dataWidth,
        addRowIndex,
        rowHeight: ROW_HEIGHT,
        primaryFieldId: table.primaryFieldId,
        treeMeta,
        displayRecords,
      });
      if (!hit) {
        setSelectedCell(null);
        setSelectionRange(null);
        setSelectEditor(null);
        return;
      }
      cellSelectDragRef.current = {
        pointerId: event.pointerId,
        anchorRow: hit.rowIndex,
        anchorCol: hit.colIndex,
        moved: false,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      setSelectedCell(null);
      setSelectionRange({
        anchorRow: hit.rowIndex,
        anchorCol: hit.colIndex,
        focusRow: hit.rowIndex,
        focusCol: hit.colIndex,
      });
      return;
    }
    const rowIndex = Math.floor((point.y - HEADER_HEIGHT) / ROW_HEIGHT);
    if (rowIndex < 0) return;
    if (rowIndex === addRowIndex) {
      if (point.x < gridContentRight) addFromAddRow(null);
      return;
    }
    if (rowIndex >= gridRows.length) return;
    const row = gridRows[rowIndex];
    if (row.kind === 'group') {
      toggleGroupCollapse(row.key);
      return;
    }
    const record = row.record;
    if (point.x < INDEX_WIDTH) {
      setSelectedCell(null);
      setSelectionRange(null);
      return;
    }
    if (point.x >= dataWidth) {
      setSelectedCell(null);
      setSelectionRange(null);
      setSelectEditor(null);
      selectBlock();
      return;
    }
    const hit = resolveSelectableCellAtPoint(point, {
      gridRows,
      columns,
      dataWidth,
      addRowIndex,
      rowHeight: ROW_HEIGHT,
      primaryFieldId: table.primaryFieldId,
      treeMeta,
      displayRecords,
    });
    if (!hit) {
      const column = findColumn(columns, point.x);
      const recordIndex = displayRecords.findIndex(item => item.id === record.id);
      const meta = recordIndex >= 0 ? treeMeta[recordIndex] : undefined;
      if (column && isTreeToggleHit(point, column, rowIndex, ROW_HEIGHT, table.primaryFieldId, meta)) {
        toggleRecordCollapse(record.id);
      }
      return;
    }
    const { rowIndex: hitRowIndex, colIndex, record: hitRecord, column } = hit;
    if (!hitRecord) return;
    cellSelectDragRef.current = {
      pointerId: event.pointerId,
      anchorRow: hitRowIndex,
      anchorCol: colIndex,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectionRange({
      anchorRow: hitRowIndex,
      anchorCol: colIndex,
      focusRow: hitRowIndex,
      focusCol: colIndex,
    });
    setSelectedCell({ recordId: hitRecord.id, fieldId: column.field.id, rowIndex: hitRowIndex });
  };

  const openRowContextMenu = (
    recordId: string,
    rowIndex: number,
    clientX: number,
    clientY: number,
    options?: { fieldId?: string; recordIds?: string[]; deleteOnly?: boolean },
  ) => {
    if (editingCell) commitEditingCell();
    setSelectEditor(null);
    setFieldMenu(null);
    const recordIds = options?.recordIds ?? [recordId];
    if (options?.fieldId) {
      setSelectedCell({ recordId, fieldId: options.fieldId, rowIndex });
    }
    setCellContextMenu({
      recordId,
      recordIds,
      rowIndex,
      left: clientX,
      top: clientY,
      deleteOnly: options?.deleteOnly ?? false,
    });
  };

  const gridPointFromClient = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const handleGridContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const point = gridPointFromClient(event.clientX, event.clientY);
    if (!point) return;

    if (point.y < HEADER_HEIGHT) {
      if (point.x >= addFieldLeft && point.x < gridContentRight) return;
      const column = findColumn(columns, point.x);
      if (column) {
        openFieldMenuAt(column.field.id, event.clientX, event.clientY, column.left, false);
      }
      return;
    }

    const rowIndex = Math.floor((point.y - HEADER_HEIGHT) / ROW_HEIGHT);
    if (rowIndex < 0 || rowIndex >= gridRows.length) return;
    const row = gridRows[rowIndex];
    if (row.kind !== 'record') return;

    if (
      selectionRange
      && isMultiRowSelection(selectionRange, gridRows)
      && isPointInCellRange(point, selectionRange, columns, ROW_HEIGHT)
    ) {
      const recordIds = getSelectionRecordIds(selectionRange, gridRows);
      if (recordIds.length > 0) {
        openRowContextMenu(recordIds[0], rowIndex, event.clientX, event.clientY, {
          recordIds,
          deleteOnly: true,
        });
        return;
      }
    }

    const record = row.record;
    const column = findColumn(columns, point.x);
    openRowContextMenu(
      record.id,
      rowIndex,
      event.clientX,
      event.clientY,
      { fieldId: column?.field.id },
    );
  };

  const handleCanvasDoubleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (activeView.locked) return;
    if (editingCell) commitEditingCell();

    const point = pointFromCanvas(event, canvasScrollOffsetX);
    const hit = resolveSelectableCellAtPoint(point, {
      gridRows,
      columns,
      dataWidth,
      addRowIndex,
      rowHeight: ROW_HEIGHT,
      primaryFieldId: table.primaryFieldId,
      treeMeta,
      displayRecords,
    });
    if (!hit?.record) return;

    const { record, column, rowIndex } = hit;
    setSelectionRange(null);
    setCellContextMenu(null);
    setFieldMenu(null);
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

  const handleIndexRowContextMenu = (
    event: React.MouseEvent,
    record: BaseRecord,
    rowIndex: number,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (selectionRange && isMultiRowSelection(selectionRange, gridRows)) {
      const minRow = Math.min(selectionRange.anchorRow, selectionRange.focusRow);
      const maxRow = Math.max(selectionRange.anchorRow, selectionRange.focusRow);
      if (rowIndex >= minRow && rowIndex <= maxRow) {
        const recordIds = getSelectionRecordIds(selectionRange, gridRows);
        if (recordIds.length > 0) {
          openRowContextMenu(recordIds[0], rowIndex, event.clientX, event.clientY, {
            recordIds,
            deleteOnly: true,
          });
          return;
        }
      }
    }
    openRowContextMenu(record.id, rowIndex, event.clientX, event.clientY);
  };

  const suppressBrowserContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const cellDrag = cellSelectDragRef.current;
    if (cellDrag && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      cellSelectDragRef.current = null;
      const record = recordAtGridRow(gridRows, cellDrag.anchorRow);
      const column = columns[cellDrag.anchorCol];
      if (!cellDrag.moved && record && column) {
        setSelectionRange(null);
        if (column.field.type === 'attachment') {
          pickFiles(record.id, column.field.id);
        } else if (isSelectField(column.field)) {
          openSelectEditor(record, column, cellDrag.anchorRow);
        } else {
          startEditing(record, column, cellDrag.anchorRow);
        }
      }
      return;
    }
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
          left: fieldMenu.left,
          top: fieldMenu.top,
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
  const selectQuery = selectEditor?.query.trim() ?? '';
  const filteredSelectChoices = selectEditor
    ? selectChoices.filter(choice => choice.name.toLowerCase().includes(selectQuery.toLowerCase()))
    : [];
  const hasExactSelectMatch = Boolean(
    selectQuery && selectChoices.some(choice => choice.name.toLowerCase() === selectQuery.toLowerCase()),
  );
  const showCreateSelectOption = Boolean(
    selectQuery && !hasExactSelectMatch && !activeView.locked && addSelectChoice,
  );

  const applySelectChoice = (choice: SelectChoice, closeEditor = true) => {
    if (!selectEditor || !selectField) return;
    if (selectField.type === 'multi_select' && selectRecord) {
      const current = getSelectValues(selectRecord, selectField);
      const next = current.includes(choice.id)
        ? current.filter(id => id !== choice.id)
        : [...current, choice.id];
      changeCell(selectEditor.recordId, selectEditor.fieldId, next);
      if (closeEditor) setSelectEditor(null);
      else setSelectEditor(current => current ? { ...current, query: '' } : current);
      return;
    }
    changeCell(selectEditor.recordId, selectEditor.fieldId, choice.name);
    if (closeEditor) setSelectEditor(null);
  };

  const handleCreateSelectOption = () => {
    if (!selectEditor || !selectField || !selectQuery || !addSelectChoice) return;
    const createdId = addSelectChoice(selectEditor.fieldId, selectQuery);
    if (!createdId) return;
    const createdChoice = selectField.options?.choices?.find(item => item.id === createdId)
      ?? selectChoices.find(item => item.id === createdId);
    if (!createdChoice) return;
    applySelectChoice(createdChoice, selectField.type !== 'multi_select');
  };

  const selectEditorPortalStyle = (() => {
    if (!selectEditor) return null;
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    const width = Math.max(200, selectEditor.width);
    const listItemCount = filteredSelectChoices.length + (showCreateSelectOption ? 1 : 0);
    const searchHeight = 36;
    const listHeight = listItemCount > 0 ? Math.min(188, listItemCount * 32 + 4) : 0;
    const showClear = selectField?.type === 'multi_select'
      ? Boolean(selectRecord && getSelectValues(selectRecord, selectField).length > 0)
      : Boolean(selectEditor.value);
    const clearHeight = showClear ? 32 : 0;
    const panelHeight = searchHeight + listHeight + clearHeight + (listHeight > 0 ? 1 : 0);
    const margin = 8;
    const gap = 2;
    const rawLeft = (canvasRect?.left ?? 0) + resolveOverlayLeft(selectEditor.left);
    const cellTop = (canvasRect?.top ?? 0) + selectEditor.top;
    const cellBottom = cellTop + ROW_HEIGHT;
    const belowTop = cellBottom + gap;
    const aboveTop = cellTop - panelHeight - gap;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || rawLeft + width;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || belowTop + panelHeight;
    const shellRect = shellRef.current?.getBoundingClientRect();
    const minTop = Math.max(margin, (shellRect?.top ?? 0) + HEADER_HEIGHT);

    let top = belowTop;
    if (belowTop + panelHeight > viewportHeight - margin) {
      top = aboveTop >= minTop ? aboveTop : Math.max(minTop, viewportHeight - margin - panelHeight);
    }

    return {
      left: Math.max(margin, Math.min(rawLeft, viewportWidth - width - margin)),
      top,
      width,
      maxHeight: viewportHeight - top - margin,
    };
  })();

  return (
    <div
      className={`base-grid-wrap${hThumbDragging ? ' is-hscroll-dragging' : ''}`}
      ref={wrapRef}
      data-no-marquee-selection="true"
      onMouseDown={event => event.stopPropagation()}
    >
    <div
      className="base-grid-shell"
      ref={shellRef}
    >
      <div className="base-grid-scroll base-grid-canvas-scroll" ref={canvasScrollRef}>
        <div className={`base-grid-canvas-viewport${shouldFreezeColumns ? ' is-frozen-scroll' : ''}`}>
        {rowDrag && (
          <div
            className="base-grid-row-drop-guide"
            style={{ top: HEADER_HEIGHT + rowDrag.overIndex * ROW_HEIGHT - 1 }}
            aria-hidden
          />
        )}
        {shouldFreezeColumns && (
          <div
            className="base-grid-frozen-pane"
            style={{ width: freezeWidth, height: canvasHeight }}
            aria-hidden
          >
            <canvas ref={frozenCanvasRef} className="base-grid-frozen-canvas" />
          </div>
        )}
        {shouldFreezeColumns && (
          <div
            className="base-grid-frozen-overlays"
            style={{ width: freezeWidth, height: canvasHeight }}
          >
            {columns.filter(column => overlayInFrozenZone(column.left)).map(column => (
              <div
                key={`frozen-header-${column.field.id}`}
                className={`base-grid-overlay-header base-grid-frozen-overlay-header${hoverHeaderFieldId === column.field.id ? ' is-hovered' : ''}${isHeaderColumnInRange(selectionRange, column.field.id, columns) ? ' is-selected' : ''}`}
                style={{ left: column.left, top: 0, width: column.width, height: HEADER_HEIGHT }}
              >
                <GridFieldHeader
                  field={column.field}
                  primaryFieldId={table.primaryFieldId}
                  isMenuOpen={fieldMenu?.fieldId === column.field.id}
                  onMenuClick={event => {
                    openFieldMenuAt(column.field.id, event.clientX, event.clientY, column.left, false);
                  }}
                  onHeaderContextMenu={event => {
                    openFieldMenuAt(column.field.id, event.clientX, event.clientY, column.left, false);
                  }}
                />
              </div>
            ))}
            {(() => {
              const primaryColumn = columns.find(column => column.field.id === table.primaryFieldId) ?? columns[0];
              if (!primaryColumn || !overlayInFrozenZone(primaryColumn.left)) return null;
              return gridRows.map((row, rowIndex) => {
                if (row.kind !== 'record') return null;
                const record = row.record;
                const recordIndex = displayRecords.findIndex(item => item.id === record.id);
                const meta = recordIndex >= 0 ? treeMeta[recordIndex] : undefined;
                if (!meta?.hasChildren) return null;
                const isCollapsed = collapsedRecordIds.has(record.id);
                return (
                  <button
                    key={`frozen-tree-toggle-${record.id}`}
                    type="button"
                    tabIndex={-1}
                    className={`base-grid-tree-toggle${isCollapsed ? ' is-collapsed' : ''}`}
                    style={{
                      left: primaryColumn.left + TREE_TOGGLE_LEFT,
                      top: HEADER_HEIGHT + rowIndex * ROW_HEIGHT + (ROW_HEIGHT - TREE_TOGGLE_SIZE) / 2,
                    }}
                    aria-label={isCollapsed ? '展开子记录' : '收起子记录'}
                    onMouseDown={event => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onClick={event => {
                      event.preventDefault();
                      event.stopPropagation();
                      toggleRecordCollapse(record.id);
                    }}
                  >
                    <span className="base-grid-tree-toggle__icon" aria-hidden />
                  </button>
                );
              });
            })()}
            {selectedCell && !editingCell && !selectEditor && (() => {
              const primaryColumn = columns.find(column => column.field.id === table.primaryFieldId) ?? columns[0];
              if (!primaryColumn || !overlayInFrozenZone(primaryColumn.left) || selectedCell.fieldId !== primaryColumn.field.id) return null;
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
            {hoverRow != null && !editingCell && !selectEditor && selectedCell?.rowIndex !== hoverRow && gridRows[hoverRow]?.kind === 'record' && (() => {
              const primaryColumn = columns.find(column => column.field.id === table.primaryFieldId) ?? columns[0];
              if (!primaryColumn || !overlayInFrozenZone(primaryColumn.left)) return null;
              const hoverRecord = (gridRows[hoverRow] as Extract<GridDisplayRow, { kind: 'record' }>).record;
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
                      openRecord?.(hoverRecord.id);
                    }}
                  >
                    <span className="base-record-view-icon" aria-hidden />
                    查看
                  </button>
                  <BitableTooltip tip="添加子记录" tipClassName="bitable-portal-tooltip--sub-record" className="base-grid-row-hover-actions__add-tip">
                    <button
                      type="button"
                      className="base-grid-row-hover-actions__add"
                      aria-label="添加子记录"
                      onClick={event => {
                        event.stopPropagation();
                        const focusColumn = primaryColumn ?? columns.find(column => column.field.id === table.primaryFieldId) ?? columns[0];
                        const recordId = insertChildRecord
                          ? insertChildRecord(hoverRecord.id)
                          : insertRecordAt
                            ? insertRecordAt(hoverRow + 1, 1)[0]
                            : addRecord();
                        if (recordId) {
                          expandRecord(hoverRecord.id);
                          if (focusColumn) pendingCellFocusRef.current = { recordId, fieldId: focusColumn.field.id };
                        }
                      }}
                    >
                      +
                    </button>
                  </BitableTooltip>
                </div>
              );
            })()}
            {gridRows.map((row, rowIndex) => {
              if (row.kind !== 'record') return null;
              const record = row.record;
              return columns.map(column => {
              if (!isSelectField(column.field) || !overlayInFrozenZone(column.left)) return null;
              const choices = column.field.type === 'multi_select'
                ? getMultiSelectChoices(column.field, record.fields[column.field.id])
                : (() => {
                  const name = valueText(record.fields[column.field.id]);
                  const choice = name ? findSelectChoice(column.field, name) : null;
                  return choice ? [choice] : [];
                })();
              if (!choices.length) return null;
              const isSelected = selectedCell?.recordId === record.id && selectedCell?.fieldId === column.field.id;
              const showRemove = !activeView.locked && isSelected;
              return (
                <div
                  key={`frozen-select-${record.id}-${column.field.id}`}
                  className={`base-grid-select-cell${isSelected ? ' is-active' : ''}`}
                  style={{
                    left: column.left,
                    top: HEADER_HEIGHT + rowIndex * ROW_HEIGHT,
                    width: column.width,
                    height: ROW_HEIGHT,
                  }}
                >
                  <div className="base-grid-select-cell__tags">
                    <GridSelectCellTags
                      choices={choices}
                      availableWidth={Math.max(0, column.width - SELECT_CELL_INSET_LEFT - SELECT_CELL_INSET_RIGHT)}
                      showRemove={showRemove}
                      isMulti={column.field.type === 'multi_select'}
                      onRemove={choiceId => {
                        clearSelectValue(record, column.field, choiceId);
                        if (selectEditor?.recordId === record.id && selectEditor.fieldId === column.field.id) {
                          setSelectEditor(null);
                        }
                      }}
                      onMoreClick={() => {
                        if (activeView.locked) return;
                        setSelectedCell({ recordId: record.id, fieldId: column.field.id, rowIndex });
                        openSelectEditor(record, column, rowIndex);
                      }}
                    />
                  </div>
                </div>
              );
            });
            })}
            {editingCell && overlayInFrozenZone(editingCell.left) && (
              <input
                ref={inputRef}
                className="base-grid-cell-editor"
                autoFocus
                style={{
                  left: editingCell.left,
                  top: editingCell.top,
                  width: editingCell.width,
                  height: ROW_HEIGHT,
                  paddingLeft: editingCell.paddingLeft,
                  paddingRight: editingCell.paddingRight,
                }}
                value={editingCell.value}
                onMouseDown={event => event.stopPropagation()}
                onPointerDown={event => event.stopPropagation()}
                onChange={event => setEditingCell(current => current ? { ...current, value: event.target.value } : current)}
                onBlur={() => {
                  requestAnimationFrame(() => {
                    if (suppressBlurCommitRef.current) return;
                    if (document.activeElement === inputRef.current) return;
                    if (shellRef.current?.contains(document.activeElement)) return;
                    commitEditingCell();
                  });
                }}
                onKeyDown={event => {
                  event.stopPropagation();
                  if (event.key === 'Enter') commitEditingCell();
                  if (event.key === 'Escape') setEditingCell(null);
                }}
              />
            )}
          </div>
        )}
        <div
          className="base-grid-index-rail base-grid-index-rail--pinned"
          style={{ width: INDEX_WIDTH, height: canvasHeight }}
        >
          <label
            className="base-grid-index-header"
            style={{ width: INDEX_WIDTH, height: HEADER_HEIGHT }}
            onMouseDown={event => event.stopPropagation()}
            onContextMenu={suppressBrowserContextMenu}
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
          {gridRows.map((row, rowIndex) => {
            if (row.kind !== 'record') return null;
            const record = row.record;
            const recordIndex = displayRecords.findIndex(item => item.id === record.id);
            const meta = recordIndex >= 0 ? treeMeta[recordIndex] : undefined;
            if (!meta) return null;
            const displayNumber = getRootDisplayNumber(record, displayRecords, records);
            const isCellActiveRow = selectedCell?.rowIndex === rowIndex;
            const showControls = hoverRow === rowIndex || selectedIds.has(record.id) || isCellActiveRow;
            return (
              <div
                key={record.id}
                className={`base-grid-index-row${showControls ? ' is-active' : ''}${isCellActiveRow ? ' is-cell-active' : ''}${meta.depth > 0 ? ' is-child' : ''}`}
                style={{ top: HEADER_HEIGHT + rowIndex * ROW_HEIGHT, width: INDEX_WIDTH, height: ROW_HEIGHT }}
                onMouseEnter={() => setHoverRow(rowIndex)}
                onMouseLeave={() => setHoverRow(current => (current === rowIndex ? null : current))}
                onMouseDown={event => event.stopPropagation()}
                onContextMenu={event => handleIndexRowContextMenu(event, record, rowIndex)}
              >
                {showControls ? (
                  <>
                    <button
                      type="button"
                      className="base-grid-row-drag-handle"
                      aria-label={displayNumber != null ? `拖拽第 ${displayNumber} 行` : '拖拽行'}
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
                        const overIndex = rowIndexFromClientY(shellRef.current, event.clientY, gridRows.length, ROW_HEIGHT);
                        if (overIndex == null) return;
                        setRowDrag(current => {
                          if (!current) return current;
                          const fromRecord = recordAtGridRow(gridRows, current.fromIndex);
                          const toRecord = recordAtGridRow(gridRows, overIndex);
                          if (!fromRecord || !toRecord) return { ...current, overIndex: current.fromIndex };
                          const fromDisplayIndex = displayRecords.findIndex(item => item.id === fromRecord.id);
                          const toDisplayIndex = displayRecords.findIndex(item => item.id === toRecord.id);
                          if (!isValidTreeDropTarget(records, displayRecords, fromDisplayIndex, toDisplayIndex)) {
                            return { ...current, overIndex: current.fromIndex };
                          }
                          return { ...current, overIndex };
                        });
                      }}
                      onPointerUp={event => {
                        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
                        event.currentTarget.releasePointerCapture(event.pointerId);
                        setRowDrag(current => {
                          if (current) {
                            const fromRecord = recordAtGridRow(gridRows, current.fromIndex);
                            const toRecord = recordAtGridRow(gridRows, current.overIndex);
                            if (fromRecord && toRecord) {
                              const fromDisplayIndex = displayRecords.findIndex(item => item.id === fromRecord.id);
                              const toDisplayIndex = displayRecords.findIndex(item => item.id === toRecord.id);
                              if (isValidTreeDropTarget(records, displayRecords, fromDisplayIndex, toDisplayIndex)) {
                                const fromIndex = records.findIndex(item => item.id === fromRecord.id);
                                const toIndex = records.findIndex(item => item.id === toRecord.id);
                                reorderRecords(fromIndex, toIndex);
                              }
                            }
                          }
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
                      aria-label={displayNumber != null ? `选择第 ${displayNumber} 行` : '选择行'}
                    />
                  </>
                ) : displayNumber != null ? (
                  <span className="base-grid-index-row__number">{displayNumber}</span>
                ) : null}
              </div>
            );
          })}
          <BitableTooltip tip="新增记录" placement="top">
            <button
              type="button"
              className="base-grid-add-row-hit base-grid-add-row-hit--footer base-grid-add-row-hit--index"
              style={{
                top: HEADER_HEIGHT + addRowIndex * ROW_HEIGHT,
                left: 0,
                width: INDEX_WIDTH,
                height: ROW_HEIGHT,
              }}
              aria-label="新增记录"
              disabled={activeView.locked}
              onMouseDown={event => event.stopPropagation()}
              onContextMenu={suppressBrowserContextMenu}
              onClick={() => addFromAddRow(null)}
            />
          </BitableTooltip>
        </div>
        <div
          className="base-grid-scroll-pane"
          style={shouldFreezeColumns ? { marginLeft: freezeWidth, width: `calc(100% - ${freezeWidth}px)` } : undefined}
        >
        <div
          className="base-grid-canvas-view"
          style={{
            width: canvasWidth,
            height: canvasHeight,
            transform: canvasScrollOffsetX ? `translate3d(${-canvasScrollOffsetX}px, 0, 0)` : undefined,
          }}
          onContextMenu={handleGridContextMenu}
        >
          <canvas
            className="base-grid-canvas"
            ref={canvasRef}
            role="grid"
            aria-label="多维表格"
            onMouseDown={event => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onDoubleClick={handleCanvasDoubleClick}
          />
          <div className="base-grid-over-layer">
            {columns.map(column => {
              if (overlayInFrozenZone(column.left)) return null;
              return (
              <div
                key={column.field.id}
                className={`base-grid-overlay-header${hoverHeaderFieldId === column.field.id ? ' is-hovered' : ''}${isHeaderColumnInRange(selectionRange, column.field.id, columns) ? ' is-selected' : ''}`}
                style={{ left: resolveOverlayLeft(column.left), top: 0, width: column.width, height: HEADER_HEIGHT }}
              >
                <GridFieldHeader
                  field={column.field}
                  primaryFieldId={table.primaryFieldId}
                  isMenuOpen={fieldMenu?.fieldId === column.field.id}
                  onMenuClick={event => {
                    openFieldMenuAt(column.field.id, event.clientX, event.clientY, column.left, false);
                  }}
                  onHeaderContextMenu={event => {
                    openFieldMenuAt(column.field.id, event.clientX, event.clientY, column.left, false);
                  }}
                />
              </div>
              );
            })}
            {columnResizeGuide && (
              <div
                className="base-grid-column-resize-guide"
                style={{
                  left: columnResizeGuide.x,
                  top: 0,
                  height: columnResizeGuide.height,
                }}
                aria-hidden
              />
            )}
            <div
              className={`base-grid-add-field-column${hoverAddFieldHeader ? ' is-hovered' : ''}`}
              style={{
                left: addFieldLeft,
                top: 0,
                width: addFieldWidth,
                height: canvasHeight,
              }}
            >
              <BitableTooltip tip="新增字段" placement="bottom">
                <button
                  type="button"
                  className="base-grid-add-field-column__header"
                  aria-label="新增字段"
                  disabled={activeView.locked}
                  onMouseDown={event => event.stopPropagation()}
                  onClick={event => {
                    event.stopPropagation();
                    const rect = event.currentTarget.getBoundingClientRect();
                    openAddFieldPanelAt({
                      left: rect.right - 320,
                      top: rect.bottom + 4,
                    });
                  }}
                >
                  +
                </button>
              </BitableTooltip>
            </div>
            {(() => {
              const primaryColumn = columns.find(column => column.field.id === table.primaryFieldId) ?? columns[0];
              if (!primaryColumn || overlayInFrozenZone(primaryColumn.left)) return null;
              return gridRows.map((row, rowIndex) => {
                if (row.kind !== 'record') return null;
                const record = row.record;
                const recordIndex = displayRecords.findIndex(item => item.id === record.id);
                const meta = recordIndex >= 0 ? treeMeta[recordIndex] : undefined;
                if (!meta?.hasChildren) return null;
                const isCollapsed = collapsedRecordIds.has(record.id);
                return (
                  <button
                    key={`tree-toggle-${record.id}`}
                    type="button"
                    tabIndex={-1}
                    className={`base-grid-tree-toggle${isCollapsed ? ' is-collapsed' : ''}`}
                    style={{
                      left: resolveOverlayLeft(primaryColumn.left + TREE_TOGGLE_LEFT),
                      top: HEADER_HEIGHT + rowIndex * ROW_HEIGHT + (ROW_HEIGHT - TREE_TOGGLE_SIZE) / 2,
                    }}
                    aria-label={isCollapsed ? '展开子记录' : '收起子记录'}
                    onMouseDown={event => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onClick={event => {
                      event.preventDefault();
                      event.stopPropagation();
                      toggleRecordCollapse(record.id);
                    }}
                  >
                    <span className="base-grid-tree-toggle__icon" aria-hidden />
                  </button>
                );
              });
            })()}
            {selectedCell && !editingCell && !selectEditor && (() => {
              const primaryColumn = columns.find(column => column.field.id === table.primaryFieldId) ?? columns[0];
              if (!primaryColumn || overlayInFrozenZone(primaryColumn.left) || selectedCell.fieldId !== primaryColumn.field.id) return null;
              return (
                <BitableGridCellExpand
                  style={{
                    left: resolveOverlayLeft(primaryColumn.left + primaryColumn.width - 28),
                    top: HEADER_HEIGHT + selectedCell.rowIndex * ROW_HEIGHT + (ROW_HEIGHT - 24) / 2,
                  }}
                  onOpen={() => openRecord?.(selectedCell.recordId)}
                />
              );
            })()}
            {hoverRow != null && !editingCell && !selectEditor && selectedCell?.rowIndex !== hoverRow && gridRows[hoverRow]?.kind === 'record' && (() => {
              const primaryColumn = columns.find(column => column.field.id === table.primaryFieldId) ?? columns[0];
              if (!primaryColumn || overlayInFrozenZone(primaryColumn.left)) return null;
              const hoverRecord = (gridRows[hoverRow] as Extract<GridDisplayRow, { kind: 'record' }>).record;
              return (
              <div
                className="base-grid-row-hover-actions"
                style={{
                  left: resolveOverlayLeft(primaryColumn.left),
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
                    openRecord?.(hoverRecord.id);
                  }}
                >
                  <span className="base-record-view-icon" aria-hidden />
                  查看
                </button>
                <BitableTooltip tip="添加子记录" tipClassName="bitable-portal-tooltip--sub-record" className="base-grid-row-hover-actions__add-tip">
                  <button
                    type="button"
                    className="base-grid-row-hover-actions__add"
                    aria-label="添加子记录"
                    onClick={event => {
                      event.stopPropagation();
                      const focusColumn = primaryColumn ?? columns.find(column => column.field.id === table.primaryFieldId) ?? columns[0];
                      const recordId = insertChildRecord
                        ? insertChildRecord(hoverRecord.id)
                        : insertRecordAt
                          ? insertRecordAt(hoverRow + 1, 1)[0]
                          : addRecord();
                      if (recordId) {
                        expandRecord(hoverRecord.id);
                        if (focusColumn) pendingCellFocusRef.current = { recordId, fieldId: focusColumn.field.id };
                      }
                    }}
                  >
                    +
                  </button>
                </BitableTooltip>
              </div>
              );
            })()}
            {gridRows.map((row, rowIndex) => {
              if (row.kind !== 'record') return null;
              const record = row.record;
              return columns.map(column => {
              if (!isSelectField(column.field) || overlayInFrozenZone(column.left)) return null;
              const choices = column.field.type === 'multi_select'
                ? getMultiSelectChoices(column.field, record.fields[column.field.id])
                : (() => {
                  const name = valueText(record.fields[column.field.id]);
                  const choice = name ? findSelectChoice(column.field, name) : null;
                  return choice ? [choice] : [];
                })();
              if (!choices.length) return null;
              const isSelected = selectedCell?.recordId === record.id && selectedCell?.fieldId === column.field.id;
              const showRemove = !activeView.locked && isSelected;
              return (
                <div
                  key={`${record.id}-${column.field.id}`}
                  className={`base-grid-select-cell${isSelected ? ' is-active' : ''}`}
                  style={{
                    left: resolveOverlayLeft(column.left),
                    top: HEADER_HEIGHT + rowIndex * ROW_HEIGHT,
                    width: column.width,
                    height: ROW_HEIGHT,
                  }}
                >
                  <div className="base-grid-select-cell__tags">
                    <GridSelectCellTags
                      choices={choices}
                      availableWidth={Math.max(0, column.width - SELECT_CELL_INSET_LEFT - SELECT_CELL_INSET_RIGHT)}
                      showRemove={showRemove}
                      isMulti={column.field.type === 'multi_select'}
                      onRemove={choiceId => {
                        clearSelectValue(record, column.field, choiceId);
                        if (selectEditor?.recordId === record.id && selectEditor.fieldId === column.field.id) {
                          setSelectEditor(null);
                        }
                      }}
                      onMoreClick={() => {
                        if (activeView.locked) return;
                        setSelectedCell({ recordId: record.id, fieldId: column.field.id, rowIndex });
                        openSelectEditor(record, column, rowIndex);
                      }}
                    />
                  </div>
                </div>
              );
            });
            })}
          </div>
          {editingCell && !overlayInFrozenZone(editingCell.left) && (
            <input
              ref={inputRef}
              className="base-grid-cell-editor"
              autoFocus
              style={{
                left: resolveOverlayLeft(editingCell.left),
                top: editingCell.top,
                width: editingCell.width,
                height: ROW_HEIGHT,
                paddingLeft: editingCell.paddingLeft,
                paddingRight: editingCell.paddingRight,
              }}
              value={editingCell.value}
              onMouseDown={event => event.stopPropagation()}
              onPointerDown={event => event.stopPropagation()}
              onChange={event => setEditingCell(current => current ? { ...current, value: event.target.value } : current)}
              onBlur={() => {
                requestAnimationFrame(() => {
                  if (suppressBlurCommitRef.current) return;
                  if (document.activeElement === inputRef.current) return;
                  if (shellRef.current?.contains(document.activeElement)) return;
                  commitEditingCell();
                });
              }}
              onKeyDown={event => {
                event.stopPropagation();
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
              <div className="base-grid-select-editor__search-wrap">
                <input
                  className="base-grid-select-editor__search"
                  type="text"
                  autoFocus
                  placeholder={activeView.locked || !addSelectChoice ? '查找选项' : '查找或创建选项'}
                  value={selectEditor.query}
                  onChange={event => setSelectEditor(current => current ? { ...current, query: event.target.value } : current)}
                  onKeyDown={event => {
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      setSelectEditor(null);
                      return;
                    }
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      if (showCreateSelectOption) {
                        handleCreateSelectOption();
                        return;
                      }
                      if (filteredSelectChoices.length === 1) {
                        applySelectChoice(filteredSelectChoices[0]);
                      }
                    }
                  }}
                />
              </div>
              {(filteredSelectChoices.length > 0 || showCreateSelectOption) && (
                <div className="base-grid-select-editor__list">
                  {showCreateSelectOption && (
                    <button
                      type="button"
                      className="base-grid-select-editor__create"
                      onClick={handleCreateSelectOption}
                    >
                      创建选项 <strong>{selectQuery}</strong>
                    </button>
                  )}
                  {filteredSelectChoices.map(choice => {
                    const selected = selectField?.type === 'multi_select' && selectRecord
                      ? getSelectValues(selectRecord, selectField).includes(choice.id)
                      : choice.name === selectEditor.value;
                    return (
                      <button
                        key={choice.id}
                        type="button"
                        className={`base-grid-select-editor__item${selected ? ' is-selected' : ''}`}
                        onClick={() => applySelectChoice(choice)}
                      >
                        <span className="base-grid-select-editor__tag" style={{ backgroundColor: choice.color, color: textColorForBackground(choice.color) }}>{choice.name}</span>
                        {selected && <span className="base-grid-select-editor__check" aria-hidden>✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
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
        </div>
      </div>
      {fieldMenu && menuField && createPortal(
        <GridFieldContextMenu
          menuRef={menuRef}
          field={menuField}
          isPrimaryField={menuField.id === table.primaryFieldId}
          canDelete={canRemoveMenuField}
          left={fieldMenu.left}
          top={fieldMenu.top}
          onAction={runFieldAction}
        />,
        fieldMenuPortalRoot,
      )}
      {cellContextMenu && createPortal(
        <GridCellContextMenu
          menuRef={cellMenuRef}
          left={cellContextMenu.left}
          top={cellContextMenu.top}
          deleteOnly={cellContextMenu.deleteOnly}
          onInsertAbove={count => {
            if (insertRecordAt) {
              const insertIndex = resolveRecordInsertIndex(
                records,
                cellContextMenu.recordId,
                'before',
              );
              insertRecordAt(insertIndex, count);
            }
            setCellContextMenu(null);
          }}
          onInsertBelow={count => {
            if (insertRecordAt) {
              const insertIndex = resolveRecordInsertIndex(
                records,
                cellContextMenu.recordId,
                'after-subtree',
              );
              insertRecordAt(insertIndex, count);
            }
            setCellContextMenu(null);
          }}
          onViewDetails={() => {
            openRecord?.(cellContextMenu.recordId);
            setCellContextMenu(null);
          }}
          onAddChildRecord={() => {
            if (insertChildRecord) {
              insertChildRecord(cellContextMenu.recordId);
              expandRecord(cellContextMenu.recordId);
            }
            setCellContextMenu(null);
          }}
          onAddComment={() => {
            onOpenComment?.(cellContextMenu.recordId);
            setCellContextMenu(null);
          }}
          onDeleteRecord={() => {
            if (removeRecords) {
              const ids = cellContextMenu.recordIds;
              removeRecords(ids, ids.length > 1);
            }
            setCellContextMenu(null);
          }}
        />
        ,
        document.body,
      )}
      <div className="base-grid-footer">
        <span className="base-grid-footer__count">
          {`${records.length} 条记录`}
          <span className="base-grid-footer__chevron" aria-hidden>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M7.707 9.293a1 1 0 0 1 1.414 0L12 13.172l2.879-2.879a1 1 0 1 1 1.414 1.414l-3.586 3.586a1 1 0 0 1-1.414 0L7.707 10.707a1 1 0 0 1 0-1.414Z" fill="currentColor" />
            </svg>
          </span>
        </span>
      </div>
    </div>
    <div className={`base-grid-hscroll${maxScrollLeft > 0 ? ' is-active' : ''}`}>
      <div
        ref={hTrackRef}
        className="base-grid-hscroll__track"
        style={hScrollMetrics.trackWidth > 0 ? { width: hScrollMetrics.trackWidth } : undefined}
        onPointerDown={handleHTrackPointerDown}
      >
        {maxScrollLeft > 0 && (
          <div
            className={`base-grid-hscroll__thumb${hThumbDragging ? ' is-dragging' : ''}`}
            style={{
              width: hScrollMetrics.thumbWidth,
              transform: `translate3d(${hScrollMetrics.thumbLeft}px, 0, 0)`,
            }}
            onPointerDown={handleHThumbPointerDown}
            onPointerMove={handleHThumbPointerMove}
            onPointerUp={finishHThumbDrag}
            onPointerCancel={finishHThumbDrag}
          />
        )}
      </div>
    </div>
    </div>
  );
}
