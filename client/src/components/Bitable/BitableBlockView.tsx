import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type MouseEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { SelGlyphChevronDown } from '../../icons/selectionToolbarGlyphs';
import { SlashGlyphBitableGrid, SlashGlyphGallery, SlashGlyphGantt, SlashGlyphKanban } from '../../icons/slashMenuGlyphs';
import { BitableAddFieldPopover, BitableEditFieldPopover, buildNewFieldPayload, emptyDefaultValue, type CreateFieldInput, type UpdateFieldInput } from './fields/BitableAddFieldPopover';
import { FieldLockGlyph, fieldTypeGlyph } from './fields/bitableFieldTypeIcons';
import { BitableTooltip, useBitablePanelHoverHandlers } from './shared/BitableViewShared';
import { parseJsonPayload } from '../../api/http';
import {
  addView,
  appendRecordHistory,
  attachmentFromUpload,
  collectRecordSubtreeIds,
  copyView,
  createGalleryConfig,
  createRecord,
  createRecordComment,
  deleteView,
  duplicateFieldName,
  findInsertIndexAfterSubtree,
  isFilterRuleActive,
  hasActiveGridGroups,
  insertRecordsIntoTable,
  normalizeRecordTreeOrder,
  reorderRecordsInTree,
  resolveRecordInsertIndex,
  getActiveView,
  getAttachments,
  getGanttConfig,
  getGalleryConfig,
  getVisibleViews,
  isViewTypeVisible,
  getGridGroupFieldIds,
  resolveGridGroupRules,
  groupRecords,
  nextAutoFieldName,
  parseBaseTable,
  reorderViews,
  selectCoverAttachment,
  serializeBaseTable,
  valueText,
  normalizeMultiSelectIds,
  normalizeGridGroupConfig,
  visibleRecords,
  type AttachmentValue,
  type BaseField,
  type BaseRecord,
  type BaseTable,
  type BaseView,
  type CellValue,
  type FilterRule,
  type GalleryViewConfig,
  type GanttViewConfig,
  type GridRowHeightMode,
  type GridViewConfig,
  type SortRule,
} from './model/bitableModel';
import { BitableGalleryView } from './views/BitableGalleryView';
import { BitableGanttView } from './views/BitableGanttView';
import { BitableKanbanView } from './views/BitableKanbanView';
import { BitableGridView, type GridFieldMenuAction, type GridFieldMenuPosition } from './views/BitableGridView';
import { BitableRecordCommentPanel } from './records/BitableRecordCommentPanel';
import { BitableRecordCardModal } from './records/BitableRecordCardModal';
import { useAnchoredFloatingPosition } from '../Editor/shared/floatingPanel';
import { createSelectChoice } from './fields/BitableSelectFieldEditor';

function isToolbarPortaledDropdownTarget(target: Node): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(
    '.bitable-field-condition-picker__menu--portal, .bitable-group-field-picker__menu--portal, .base-filter-select__menu--portal',
  ));
}
import { useCommentSidebarTrack } from '../Layout/CommentSidebarContext';
import {
  BITABLE_COMMENT_OPEN,
  BITABLE_COMMENT_TOGGLE_SIDEBAR,
  CLOSE_BITABLE_COMMENT_SIDEBAR,
  dispatchBitableCommentClose,
  dispatchBitableCommentMeta,
  dispatchBitableCommentOpen,
  dispatchBitableCommentToggleSidebar,
} from '../Layout/commentSidebarBridge';
import { BITABLE_BLOCK_EXPAND_ALL, BITABLE_BLOCK_OPEN_COMMENT } from './BitableContextMenu';
import { dispatchBitableModelUpdated } from './dashboard/chartFromTable';
import './BitableBlock.less';

const DAY_MS = 24 * 60 * 60 * 1000;

function readDate(value: CellValue): Date | null {
  const raw = valueText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function offsetDate(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
}

function daysBetween(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

function formatMonth(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function ViewIcon({ type, size = 16, fill = '#646a73' }: { type: BaseView['type']; size?: number; fill?: string }) {
  if (type === 'gallery') return <SlashGlyphGallery size={size} fill={fill} />;
  if (type === 'gantt') return <SlashGlyphGantt size={size} fill={fill} />;
  if (type === 'kanban') return <SlashGlyphKanban size={size} fill={fill} />;
  return <SlashGlyphBitableGrid size={size} fill={fill} />;
}

function viewSettingsLabel(type: BaseView['type']) {
  if (type === 'gallery') return '画册设置';
  if (type === 'gantt') return '甘特图设置';
  if (type === 'kanban') return '卡片配置';
  return '视图设置';
}

function viewHierarchySettingsLabel(type: BaseView['type']) {
  if (type === 'grid') return '层级设置';
  if (type === 'gantt') return '甘特设置';
  return viewSettingsLabel(type);
}

function toolbarPanelTitle(panel: ToolbarPanel) {
  if (panel === 'filter') return '筛选';
  if (panel === 'group') return '分组';
  if (panel === 'sort') return '排序';
  if (panel === 'rowHeight') return '行高';
  if (panel === 'comment') return '评论';
  if (panel === 'share') return '打开方式';
  return '字段配置';
}

type GlyphProps = { size?: number };
type ToolbarPanel = 'fields' | 'filter' | 'group' | 'sort' | 'rowHeight' | 'comment' | 'share';

function svgProps(size: number) {
  return { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', xmlns: 'http://www.w3.org/2000/svg' } as const;
}

const ToolGlyphSettings = ({ size = 18 }: GlyphProps) => (
  <svg {...svgProps(size)}><path d="m4.328 19.734-.31-.34a10.91 10.91 0 0 1-2.386-4.146l-.135-.436L3.545 12 1.497 9.188l.135-.436a10.91 10.91 0 0 1 2.385-4.147l.311-.339 3.442.377 1.398-3.187.448-.101A10.843 10.843 0 0 1 12 1.09c.809 0 1.607.089 2.384.264l.448.1 1.398 3.188 3.442-.377.31.34a10.91 10.91 0 0 1 2.386 4.146l.135.436L20.455 12l2.048 2.812-.135.436a10.91 10.91 0 0 1-2.385 4.147l-.311.339-3.442-.377-1.398 3.187-.448.101a10.848 10.848 0 0 1-4.768 0l-.448-.1-1.398-3.188-3.442.377Zm3.485-2.21a1.488 1.488 0 0 1 1.525.881l1.12 2.554a9.05 9.05 0 0 0 3.084 0l1.12-2.554a1.488 1.488 0 0 1 1.524-.881l2.755.3c.665-.8 1.19-1.71 1.547-2.69l-1.644-2.258a1.488 1.488 0 0 1 0-1.752l1.644-2.258a9.091 9.091 0 0 0-1.547-2.69l-2.755.3a1.488 1.488 0 0 1-1.524-.881l-1.12-2.554a9.053 9.053 0 0 0-3.084 0l-1.12 2.554a1.488 1.488 0 0 1-1.525.881l-2.754-.3a9.09 9.09 0 0 0-1.548 2.69l1.645 2.258c.38.522.38 1.23 0 1.752l-1.644 2.258c.358.98.882 1.89 1.547 2.69l2.754-.3ZM12 16.545c-2.502 0-4.528-2.036-4.528-4.545 0-2.51 2.026-4.545 4.528-4.545S16.528 9.49 16.528 12 14.502 16.545 12 16.545Zm0-1.818c1.496 0 2.71-1.22 2.71-2.727A2.719 2.719 0 0 0 12 9.273 2.719 2.719 0 0 0 9.29 12 2.719 2.719 0 0 0 12 14.727Z" fill="currentColor"/></svg>
);
const ToolGlyphGantt = ({ size = 18 }: GlyphProps) => (
  <svg {...svgProps(size)}><path d="M4 4h16v7h2V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8v-2H4V4Z" fill="currentColor"/><path d="M15.5 21.425a.552.552 0 0 1-.507-.211 4.672 4.672 0 0 1-.675-1.296.553.553 0 0 1 .084-.5l.408-.56a.963.963 0 0 0 0-1.134l-.345-.474a.553.553 0 0 1-.077-.523c.193-.5.47-.963.82-1.369a.553.553 0 0 1 .482-.18l.539.058a.962.962 0 0 0 .986-.57l.22-.503a.552.552 0 0 1 .398-.328 4.59 4.59 0 0 1 1.588-.024c.186.03.339.158.414.33l.23.524a.963.963 0 0 0 .987.571l.64-.07c.18-.02.361.043.48.18.329.378.594.807.787 1.27a.553.553 0 0 1-.073.535l-.417.573a.962.962 0 0 0 0 1.133l.483.664a.55.55 0 0 1 .08.514 4.673 4.673 0 0 1-.643 1.191.552.552 0 0 1-.507.21l-.83-.09a.963.963 0 0 0-.988.57l-.35.8a.552.552 0 0 1-.43.334 4.6 4.6 0 0 1-1.312-.02.552.552 0 0 1-.414-.33l-.343-.784a.963.963 0 0 0-.987-.57l-.727.08Zm3.196-1.449c.85 0 1.54-.696 1.54-1.555 0-.86-.69-1.556-1.54-1.556-.851 0-1.54.696-1.54 1.556 0 .859.689 1.555 1.54 1.555ZM6.5 11a1 1 0 1 0 0 2H14a1 1 0 1 0 0-2H6.5ZM9 8a1 1 0 0 1 1-1h7a1 1 0 1 1 0 2h-7a1 1 0 0 1-1-1Zm-1 7a1 1 0 1 0 0 2h3a1 1 0 1 0 0-2H8Z" fill="currentColor"/></svg>
);
const ToolGlyphFilter = ({ size = 18 }: GlyphProps) => (
  <svg {...svgProps(size)}><path d="m13 11.5 4.573-3.201a1 1 0 0 0 .427-.82V4a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v3.48a1 1 0 0 0 .427.819L6 11.5v7.181a2 2 0 0 0 1.212 1.838l4.394 1.884a1 1 0 0 0 1.394-.92V11.5Zm-5-1.041-5-3.5V4h13v2.959l-5 3.5v9.508L8 18.68v-8.22Z" fill="currentColor"/><path d="M15 14a1 1 0 0 1 1-1h5a1 1 0 1 1 0 2h-5a1 1 0 0 1-1-1Zm1 3a1 1 0 1 0 0 2h3a1 1 0 1 0 0-2h-3Z" fill="currentColor"/></svg>
);
const ToolGlyphGroup = ({ size = 18 }: GlyphProps) => (
  <svg {...svgProps(size)}><path d="M10 9a1 1 0 0 1 1-1h6.5a1 1 0 1 1 0 2H11a1 1 0 0 1-1-1Zm1 5a1 1 0 1 0 0 2h6.5a1 1 0 1 0 0-2H11ZM8.25 9a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm-1.5 7.25a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z" fill="currentColor"/><path d="M3.5 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h17a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2h-17Zm17 2v16h-17V4h17Z" fill="currentColor"/></svg>
);
const ToolGlyphSort = ({ size = 18 }: GlyphProps) => (
  <svg {...svgProps(size)}><path d="M17 1.333h-1.803s-.419.137-.498.343l-3.664 9.598a.533.533 0 0 0 .498.724h.978a.533.533 0 0 0 .5-.347l.664-1.785h4.841l.663 1.786c.078.21.277.348.5.348h.987a.533.533 0 0 0 .498-.724l-3.666-9.6A.533.533 0 0 0 17 1.333Zm.725 6.4h-3.264l1.605-4.316h.05l1.61 4.316Zm-6.175 6.4c0-.294.238-.533.533-.533h8.522c.295 0 .534.239.534.534v.703c0 .154-.067.3-.183.402l-6.068 5.298h5.717c.295 0 .534.24.534.534v1.063a.533.533 0 0 1-.534.533h-8.522a.533.533 0 0 1-.534-.534v-.973c0-.154.067-.3.183-.402l5.763-5.027h-5.412a.533.533 0 0 1-.534-.534v-1.063Zm-8.923 2.534h2.705V3.2c0-.294.238-.533.533-.533h.933c.295 0 .534.239.534.533v19.16a.533.533 0 0 1-.965.314l-4-5.499a.32.32 0 0 1 .26-.508Z" fill="currentColor"/></svg>
);
const ToolGlyphRowHeight = ({ size = 18 }: GlyphProps) => (
  <svg {...svgProps(size)}><path d="M19 2.5a1 1 0 0 1 .76.35l3 3.5a1 1 0 0 1-1.52 1.3L20 6.204v11.594l1.24-1.448a1 1 0 1 1 1.52 1.302l-3 3.5a1 1 0 0 1-1.52 0l-3-3.5a1 1 0 1 1 1.52-1.302L18 17.797V6.203l-1.24 1.448a1 1 0 0 1-1.52-1.302l3-3.5A1 1 0 0 1 19 2.5ZM2 4a1 1 0 0 0 0 2h9a1 1 0 1 0 0-2H2Zm0 7a1 1 0 1 0 0 2h9a1 1 0 1 0 0-2H2Zm-1 8a1 1 0 0 1 1-1h9a1 1 0 1 1 0 2H2a1 1 0 0 1-1-1Z" fill="currentColor"/></svg>
);
const ToolGlyphComment = ({ size = 18 }: GlyphProps) => (
  <svg {...svgProps(size)}><path d="M7 11a1 1 0 0 1 1-1h8a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1Z" fill="currentColor"/><path d="M2 5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v11.5a2 2 0 0 1-2 2h-3.812a.5.5 0 0 0-.33.124l-2.541 2.224a2 2 0 0 1-2.634 0l-2.542-2.224a.5.5 0 0 0-.329-.124H4a2 2 0 0 1-2-2V5Zm2 0v11.5h3.812a2.5 2.5 0 0 1 1.646.619L12 19.343l2.542-2.224a2.5 2.5 0 0 1 1.646-.619H20V5H4Z" fill="currentColor"/></svg>
);
const ToolGlyphShare = ({ size = 18 }: GlyphProps) => (
  <svg {...svgProps(size)}><path d="M22 3a1 1 0 0 0-1-1h-7a1 1 0 0 0 0 2h4.586l-6.293 6.293a1 1 0 0 0 1.414 1.414L20 5.414V10a1 1 0 1 0 2 0V3Z" fill="currentColor"/><path d="M4 5h6v2H4v13h16v-5.5h2V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" fill="currentColor"/></svg>
);
const ToolGlyphKanbanGroup = ({ size = 18 }: GlyphProps) => (
  <svg {...svgProps(size)} data-icon="DownRoundOutlined"><path d="M7.755 11.658a1 1 0 0 1 1.416-1.415L12 13.07l2.828-2.829a1 1 0 0 1 1.416 1.416c-1.181 1.189-2.356 2.386-3.553 3.56a.987.987 0 0 1-1.383 0c-1.196-1.175-2.371-2.371-3.553-3.56Z" fill="currentColor"/><path d="M12 23C5.925 23 1 18.075 1 12S5.925 1 12 1s11 4.925 11 11-4.925 11-11 11Zm0-2a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" fill="currentColor"/></svg>
);
const ToolGlyphRename = ({ size = 16 }: GlyphProps) => (
  <svg {...svgProps(size)} data-icon="RenameOutlined">
    <path d="M19.253 2.646a1.5 1.5 0 1 1 2.121 2.122l-1.06 1.06-2.122-2.121 1.061-1.06ZM17.14 4.76l2.12 2.122-7.817 7.818a1.417 1.417 0 0 1-.77.395l-1.89.315a.17.17 0 0 1-.196-.197l.336-1.882c.05-.281.185-.54.387-.741l7.83-7.83Z" fill="currentColor" />
    <path d="M13.5 3H4a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h15a2 2 0 0 0 2-2V10l-2 2v8H4V5h7.5l2-2Z" fill="currentColor" />
  </svg>
);
const GlyphDrag = ({ size = 14 }: GlyphProps) => (
  <svg {...svgProps(size)} data-icon="DragOutlined">
    <path d="M8.25 6.5a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5Zm0 7.25a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5Zm1.75 5.5a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 0 1 3.5 0ZM14.753 6.5a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5ZM16.5 12a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 0 1 3.5 0Zm-1.747 9a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5Z" fill="currentColor" />
  </svg>
);
const GlyphMore = ({ size = 14 }: GlyphProps) => (
  <svg {...svgProps(size)} data-icon="MoreOutlined">
    <path d="M5.5 11.75a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 0 1 3.5 0Zm8.225 0a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 0 1 3.5 0Zm8.275 0a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 0 1 3.5 0Z" fill="currentColor" />
  </svg>
);
const GlyphCopy = ({ size = 16 }: GlyphProps) => (
  <svg {...svgProps(size)} data-icon="CopyOutlined">
    <path d="M9 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v12a1 1 0 1 1-2 0V4h-9a1 1 0 0 1-1-1Z" fill="currentColor" />
    <path d="M5 6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H5Zm0 2h10v12H5V8Z" fill="currentColor" />
  </svg>
);
const GlyphDelete = ({ size = 16 }: GlyphProps) => (
  <svg {...svgProps(size)} data-icon="DeleteTrashOutlined">
    <path d="M8 4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2h5a1 1 0 1 1 0 2h-1v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6H3a1 1 0 0 1 0-2h5ZM6 6v14h12V6H6Zm4 3a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1Zm4 0a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1Z" fill="currentColor" />
  </svg>
);
const GlyphAdd = ({ size = 14 }: GlyphProps) => (
  <svg {...svgProps(size)} data-icon="AddOutlined">
    <path d="M12 2a1 1 0 0 0-1 1v8H3a1 1 0 1 0 0 2h8v8a1 1 0 1 0 2 0v-8h8a1 1 0 1 0 0-2h-8V3a1 1 0 0 0-1-1Z" fill="currentColor" />
  </svg>
);
const GlyphExpandDown = ({ size = 12 }: GlyphProps) => (
  <svg {...svgProps(size)} data-icon="ExpandDownFilled">
    <path d="M11.22 18.46a1 1 0 0 0 1.56 0l8.305-10.334a1 1 0 0 0-.78-1.626H3.696a1 1 0 0 0-.78 1.626L11.22 18.46Z" fill="currentColor" />
  </svg>
);
const GlyphVisible = ({ size = 14 }: GlyphProps) => (
  <svg {...svgProps(size)} data-icon="VisibleOutlined">
    <path d="M11.985 18.5c3.238 0 6.236-2.06 9.015-6.513C18.292 7.55 15.3 5.5 11.985 5.5 8.67 5.5 5.689 7.549 3 11.987c2.76 4.454 5.748 6.513 8.985 6.513ZM1.502 12.89a1.782 1.782 0 0 1 .023-1.838C4.428 6.017 7.915 3.5 11.984 3.5c4.086 0 7.594 2.538 10.523 7.614l.028.048c.296.519.294 1.16-.01 1.675-3.006 5.108-6.52 7.663-10.541 7.663-4.007 0-7.501-2.537-10.482-7.61ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-2a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" fill="currentColor" />
  </svg>
);
const GlyphInvisible = ({ size = 16 }: GlyphProps) => (
  <svg {...svgProps(size)} data-icon="InvisibleOutlined">
    <path d="M2.032 8.172a1 1 0 0 1 1.388.267C5.263 11.159 8.637 13 12 13c3.364 0 6.737-1.841 8.58-4.561a1 1 0 0 1 1.656 1.122 11.928 11.928 0 0 1-2.002 2.259l2.009 2.008a1 1 0 1 1-1.415 1.415l-2.12-2.122a1.003 1.003 0 0 1-.085-.096c-.745.472-1.54.87-2.368 1.181l.712 2.658a1 1 0 1 1-1.932.517l-.702-2.62A11.64 11.64 0 0 1 12 15c-.71 0-1.42-.068-2.118-.197l-.691 2.578a1 1 0 1 1-1.932-.517l.692-2.582a13.01 13.01 0 0 1-2.607-1.278c-.03.04-.064.08-.101.117L3.12 15.243a1 1 0 1 1-1.414-1.415l2.032-2.032a11.919 11.919 0 0 1-1.974-2.235 1 1 0 0 1 .267-1.389Z" fill="currentColor" />
  </svg>
);
const GlyphDownBold = ({ size = 12 }: GlyphProps) => (
  <svg {...svgProps(size)} data-icon="DownBoldOutlined">
    <path d="m3.414 7.086-.707.707a1 1 0 0 0 0 1.414l7.778 7.778a2 2 0 0 0 2.829 0l7.778-7.778a1 1 0 0 0 0-1.414l-.707-.707a1 1 0 0 0-1.415 0l-7.07 7.07-7.072-7.07a1 1 0 0 0-1.414 0Z" fill="currentColor" />
  </svg>
);
const GlyphBan = ({ size = 16 }: GlyphProps) => (
  <svg {...svgProps(size)} data-icon="BanOutlined">
    <path d="M1 12c0 6.075 4.925 11 11 11s11-4.925 11-11S18.075 1 12 1 1 5.925 1 12Zm16.617 7.032a9 9 0 0 1-12.65-12.65l12.65 12.65Zm1.415-1.414L6.382 4.968a9 9 0 0 1 12.65 12.65Z" fill="currentColor" />
  </svg>
);
const GlyphAttachment = ({ size = 16 }: GlyphProps) => (
  <svg {...svgProps(size)} data-icon="AttachmentOutlined">
    <path d="M12.304 7.315a1 1 0 0 1 1.414 1.414L8.13 14.317a1.485 1.485 0 0 0 0 2.1l.01.011a1.5 1.5 0 0 0 2.117-.005l7.43-7.43a3.5 3.5 0 0 0 0-4.95l-.036-.037a3.5 3.5 0 0 0-4.95 0l-7.778 7.777a5.521 5.521 0 0 0 7.808 7.809l7.07-7.07a1 1 0 0 1 1.415 1.414l-7.07 7.07A7.521 7.521 0 0 1 3.509 10.37l7.778-7.778a5.5 5.5 0 0 1 7.778 0l.037.037a5.5 5.5 0 0 1 0 7.778l-7.43 7.43a3.5 3.5 0 0 1-4.939.012l-.006-.006-.012-.012a3.485 3.485 0 0 1 0-4.928l5.589-5.588Z" fill="currentColor" />
  </svg>
);
const GlyphHelp = ({ size = 14 }: GlyphProps) => (
  <svg {...svgProps(size)} data-icon="MaybeOutlined">
    <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 2C5.925 23 1 18.075 1 12S5.925 1 12 1s11 4.925 11 11-4.925 11-11 11Zm-1-6a1 1 0 1 1 2 0 1 1 0 0 1-2 0ZM8.05 9.282a5.17 5.17 0 0 1 .039-.28c.195-1.085.689-1.883 1.481-2.394.62-.405 1.383-.608 2.288-.608 1.189 0 2.176.288 2.962.864.787.575 1.18 1.428 1.18 2.558 0 .693-.17 1.277-.513 1.752-.2.287-.584.655-1.152 1.103l-.56.44c-.305.24-.507.52-.607.84a2.742 2.742 0 0 0-.072.486.5.5 0 0 1-.498.457h-1.12a.5.5 0 0 1-.498-.546c.065-.696.134-1.136.207-1.321.137-.344.49-.74 1.058-1.188l.575-.455c.19-.144 1.166-.831 1.166-1.44 0-.608-.106-.832-.412-1.166-.305-.333-.993-.44-1.613-.44-.61 0-1.132.161-1.387.572-.118.19-.215.393-.284.6a2.097 2.097 0 0 0-.073.307.5.5 0 0 1-.493.415H8.547a.5.5 0 0 1-.497-.556Z" fill="currentColor" />
  </svg>
);

function blockAttrs(attrs: Record<string, unknown>) {
  const id = typeof attrs.blockId === 'string' ? attrs.blockId : '';
  const indentLevel = typeof attrs.indentLevel === 'number' ? attrs.indentLevel : 0;
  return {
    ...(id ? { id, 'data-block-id': id } : {}),
    ...(indentLevel > 0 ? { 'data-indent-level': String(indentLevel) } : {}),
    style: {
      '--bitable-doc-indent': `${Math.max(0, indentLevel) * 24}px`,
    } as CSSProperties,
  };
}

function updateRecord(table: BaseTable, recordId: string, update: (record: BaseRecord) => BaseRecord): BaseTable {
  return { ...table, records: table.records.map(record => record.id === recordId ? update(record) : record) };
}

function updateView(table: BaseTable, viewId: string, update: (view: BaseView) => BaseView): BaseTable {
  return { ...table, views: table.views.map(view => view.id === viewId ? update(view) : view) };
}

const CREATE_VIEW_OPTIONS: Array<{ type: 'grid' | 'gallery' | 'kanban'; label: string }> = [
  { type: 'grid', label: '表格视图' },
  { type: 'kanban', label: '看板视图' },
  { type: 'gallery', label: '画册视图' },
];

function ViewSidebarMenu({
  views,
  activeViewId,
  renamingViewId,
  renameDraft,
  renameInputRef,
  dragOverIndex,
  draggingViewIndex,
  contextMenuViewId,
  contextMenuRef,
  canDeleteView,
  onSelectView,
  onCreateView,
  onOpenContextMenu,
  onRenameView,
  onRemoveView,
  onRenameDraftChange,
  onCommitRename,
  onCancelRename,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  views: BaseView[];
  activeViewId: string;
  renamingViewId: string | null;
  renameDraft: string;
  renameInputRef: RefObject<HTMLInputElement>;
  dragOverIndex: number | null;
  draggingViewIndex: number | null;
  contextMenuViewId: string | null;
  contextMenuRef: RefObject<HTMLDivElement>;
  canDeleteView: boolean;
  onSelectView: (viewId: string) => void;
  onCreateView: (type: 'grid' | 'gallery' | 'kanban') => void;
  onOpenContextMenu: (btn: HTMLElement, viewId: string) => void;
  onRenameView: (viewId: string) => void;
  onRemoveView: (viewId: string) => void;
  onRenameDraftChange: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onDragStart: (event: DragEvent, index: number) => void;
  onDragOver: (event: DragEvent, index: number) => void;
  onDrop: (event: DragEvent, index: number) => void;
  onDragEnd: () => void;
}) {
  const visibleViews = views.filter(view => isViewTypeVisible(view.type));

  return (
    <div className="base-view-sidebar">
      <ul className={`base-view-sidebar__list${draggingViewIndex != null ? ' is-sorting' : ''}`}>
        {visibleViews.map((view, index) => (
          <li
            key={view.id}
            className={[
              'base-view-sidebar__item',
              view.id === activeViewId ? 'is-active' : '',
              draggingViewIndex === index ? 'is-dragging' : '',
              dragOverIndex === index && draggingViewIndex !== index ? 'is-drag-over' : '',
            ].filter(Boolean).join(' ')}
            onDragOver={event => onDragOver(event, index)}
            onDrop={event => onDrop(event, index)}
          >
            <span
              className="base-view-sidebar__drag"
              draggable
              aria-hidden
              onDragStart={event => onDragStart(event, index)}
              onDragEnd={onDragEnd}
            >
              <GlyphDrag />
            </span>
            <span className="base-view-sidebar__icon" aria-hidden data-view-icon={view.type}>
              <ViewIcon type={view.type} size={15} />
            </span>
            {renamingViewId === view.id ? (
              <input
                ref={renameInputRef}
                className="base-view-sidebar__rename-input"
                value={renameDraft}
                aria-label="视图名称"
                onChange={event => onRenameDraftChange(event.target.value)}
                onBlur={onCommitRename}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    onCommitRename();
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    onCancelRename();
                  }
                }}
                onClick={event => event.stopPropagation()}
                onMouseDown={event => event.stopPropagation()}
              />
            ) : (
              <button
                type="button"
                className="base-view-sidebar__name"
                onClick={() => onSelectView(view.id)}
              >
                {view.name}
              </button>
            )}
            {!view.locked && renamingViewId !== view.id && (
              <button
                type="button"
                className={`base-view-sidebar__more${contextMenuViewId === view.id ? ' is-open' : ''}`}
                aria-label="鏇村鎿嶄綔"
                onMouseDown={event => {
                  event.stopPropagation();
                  event.preventDefault();
                  onOpenContextMenu(event.currentTarget, view.id);
                }}
              >
                <GlyphMore />
              </button>
            )}
            {contextMenuViewId === view.id && (
              <ItemRowMenu
                menuRef={contextMenuRef}
                canDelete={canDeleteView}
                onEdit={() => onRenameView(view.id)}
                onDelete={() => onRemoveView(view.id)}
              />
            )}
          </li>
        ))}
      </ul>
      <div className="base-view-sidebar__create">
        <button type="button" className="base-view-sidebar__new">
          <span className="base-view-sidebar__new-icon" aria-hidden><GlyphAdd /></span>
          <span className="base-view-sidebar__new-text">新建</span>
          <span className="base-view-sidebar__new-arrow" aria-hidden><GlyphExpandDown /></span>
        </button>
        <ul className="base-view-sidebar__create-list">
          {CREATE_VIEW_OPTIONS.map(option => (
            <li key={option.type}>
              <button type="button" onClick={() => onCreateView(option.type)}>
                <span className="base-view-sidebar__create-icon" aria-hidden data-view-icon={option.type}>
                  <ViewIcon type={option.type} size={15} />
                </span>
                <span>{option.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function DeleteRecordsDialog({
  count,
  onCancel,
  onConfirm,
}: {
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return createPortal(
    <div className="base-delete-view-overlay" data-no-marquee-selection="true" onMouseDown={onCancel}>
      <div
        className="base-delete-records-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="base-delete-records-title"
        onMouseDown={event => event.stopPropagation()}
      >
        <header className="base-delete-records-dialog__header">
          <div className="base-delete-records-dialog__title-row">
            <span className="base-delete-records-dialog__icon" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 5.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5ZM11 11.25a1 1 0 1 1 2 0v6.5a1 1 0 1 1-2 0v-6.5Z" fill="currentColor" />
              </svg>
            </span>
            <h2 id="base-delete-records-title" className="base-delete-records-dialog__title">操作确认</h2>
          </div>
          <button type="button" className="base-delete-view-dialog__close" aria-label="关闭" onClick={onCancel}>
            ×
          </button>
        </header>
        <p className="base-delete-records-dialog__body">
          该操作将删除 {count} 行记录，请确认是否继续？
        </p>
        <footer className="base-delete-view-dialog__footer">
          <button type="button" className="base-delete-view-dialog__btn base-delete-view-dialog__btn--cancel" onClick={onCancel}>
            取消
          </button>
          <button type="button" className="base-delete-view-dialog__btn base-delete-view-dialog__btn--danger" onClick={onConfirm}>
            删除
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

function DeleteViewDialog({
  viewName,
  onCancel,
  onConfirm,
}: {
  viewName: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return createPortal(
    <div className="base-delete-view-overlay" data-no-marquee-selection="true" onMouseDown={onCancel}>
      <div
        className="base-delete-view-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="base-delete-view-title"
        onMouseDown={event => event.stopPropagation()}
      >
        <header className="base-delete-view-dialog__header">
          <h2 id="base-delete-view-title" className="base-delete-view-dialog__title">删除视图</h2>
          <button type="button" className="base-delete-view-dialog__close" aria-label="关闭" onClick={onCancel}>
            ×
          </button>
        </header>
        <p className="base-delete-view-dialog__body">
          确认要删除视图「{viewName}」吗？
        </p>
        <footer className="base-delete-view-dialog__footer">
          <button type="button" className="base-delete-view-dialog__btn base-delete-view-dialog__btn--cancel" onClick={onCancel}>
            取消
          </button>
          <button type="button" className="base-delete-view-dialog__btn base-delete-view-dialog__btn--danger" onClick={onConfirm}>
            删除
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

function ItemRowMenu({
  menuRef,
  canDelete,
  onEdit,
  onDelete,
  style,
  isPortal = false,
}: {
  menuRef: RefObject<HTMLDivElement>;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  style?: CSSProperties;
  isPortal?: boolean;
}) {
  return (
    <div
      ref={menuRef}
      className={`base-view-contextmenu${isPortal ? ' base-view-contextmenu--portal' : ''}`}
      style={style}
      data-no-marquee-selection="true"
      role="menu"
      onMouseDown={event => event.stopPropagation()}
    >
      <button type="button" role="menuitem" onClick={onEdit}>
        <ToolGlyphRename size={16} />
        编辑
      </button>
      <button type="button" role="menuitem" className="is-danger" disabled={!canDelete} onClick={onDelete}>
        <GlyphDelete />
        删除
      </button>
    </div>
  );
}

function FloatingItemRowMenu({
  anchor,
  menuRef,
  canDelete,
  onEdit,
  onDelete,
}: {
  anchor: HTMLElement;
  menuRef: RefObject<HTMLDivElement>;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({ visibility: 'hidden' });

  const updatePosition = useCallback(() => {
    const btnRect = anchor.getBoundingClientRect();
    const row = anchor.closest<HTMLElement>('.base-view-sidebar__item');
    const panel = anchor.closest<HTMLElement>('.base-field-panel, .bitable-field');
    const rowRect = row?.getBoundingClientRect() ?? btnRect;
    const panelRect = panel?.getBoundingClientRect();
    const left = (panelRect?.right ?? btnRect.right) + 4;
    setMenuStyle({
      position: 'fixed',
      top: rowRect.top,
      left,
      zIndex: 10053,
      visibility: 'visible',
    });
  }, [anchor]);

  useLayoutEffect(() => {
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [updatePosition]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <ItemRowMenu
      menuRef={menuRef}
      canDelete={canDelete}
      onEdit={onEdit}
      onDelete={onDelete}
      style={menuStyle}
      isPortal
    />,
    document.body,
  );
}

function withUpdatedValue(record: BaseRecord, fieldId: string, value: CellValue, fieldName?: string): BaseRecord {
  const before = record.fields[fieldId];
  if (JSON.stringify(before) === JSON.stringify(value)) return record;
  const next: BaseRecord = {
    ...record,
    updatedAt: new Date().toISOString(),
    fields: { ...record.fields, [fieldId]: value },
  };
  return fieldName ? appendRecordHistory(next, fieldId, fieldName, before, value) : next;
}

function isPreviewImage(attachment: AttachmentValue | undefined) {
  return Boolean(attachment?.mimeType.startsWith('image/') && (attachment.thumbnailUrl || attachment.previewUrl || attachment.url));
}

function FileBadge({ attachment }: { attachment: AttachmentValue }) {
  const kind = attachment.mimeType.startsWith('video/') ? 'VIDEO' : attachment.extension.toUpperCase() || 'FILE';
  return (
    <div className="base-gallery-file-fallback">
      <strong>{kind}</strong>
      <span>{attachment.name}</span>
    </div>
  );
}

function FieldDisplay({ field, value }: { field: BaseField; value: CellValue }) {
  const text = valueText(value);
  if (!text) return null;
  if (field.type === 'single_select') return <span className="base-cell-tag">{text}</span>;
  if (field.type === 'checkbox') return <span>{value ? '已完成' : '未完成'}</span>;
  if (field.type === 'attachment') return <span>{(value as AttachmentValue[]).length} 个附件</span>;
  return <span>{text}</span>;
}

const GRID_INDEX_WIDTH = 52;
const GRID_FIELD_WIDTH = 180;
const GRID_PRIMARY_WIDTH = 220;
const GRID_TAIL_WIDTH = 28;
const GRID_HEADER_HEIGHT = 36;
const GRID_ROW_HEIGHT = 34;
const GRID_ADD_ROW_HEIGHT = 36;

export default function BitableBlockView({ node, updateAttributes, selected, editor, getPos }: NodeViewProps) {
  const parsedTable = useMemo(() => parseBaseTable(node.attrs), [node.attrs.model, node.attrs.columns, node.attrs.rows, node.attrs.covers, node.attrs.view]);
  const tableRef = useRef(parsedTable);
  const blockRef = useRef<HTMLDivElement>(null);
  tableRef.current = parsedTable;
  const table = parsedTable;
  const activeView = getActiveView(table);
  const records = visibleRecords(table, activeView);
  const galleryConfig = getGalleryConfig(table, activeView);
  const hasActiveFilters = useMemo(
    () => (activeView.filters || []).some(isFilterRuleActive),
    [activeView.filters],
  );
  const hasActiveGroups = useMemo(
    () => (activeView.type === 'kanban' && Boolean(galleryConfig.groupByFieldId))
      || hasActiveGridGroups(activeView),
    [activeView, galleryConfig.groupByFieldId],
  );
  const activeGroupCount = useMemo(() => {
    if (activeView.type === 'grid') return resolveGridGroupRules(activeView).length;
    if (activeView.type === 'kanban' && galleryConfig.groupByFieldId) return 1;
    return 0;
  }, [activeView, galleryConfig.groupByFieldId]);
  const activeSortCount = useMemo(
    () => (activeView.sorts || []).length,
    [activeView.sorts],
  );
  const hasSortRules = activeSortCount > 0;
  const ganttConfig = getGanttConfig(table, activeView);
  const groups = groupRecords(table, activeView, records);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeToolbarPanel, setActiveToolbarPanel] = useState<ToolbarPanel | null>(null);
  const [isRenamingView, setIsRenamingView] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [renamingViewId, setRenamingViewId] = useState<string | null>(null);
  const [viewContextMenuId, setViewContextMenuId] = useState<string | null>(null);
  const [deleteViewTarget, setDeleteViewTarget] = useState<{ id: string; name: string } | null>(null);
  const [pendingDeleteRecordIds, setPendingDeleteRecordIds] = useState<string[] | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggingViewIndex, setDraggingViewIndex] = useState<number | null>(null);
  const dragFromIndexRef = useRef<number | null>(null);
  const dragGhostRef = useRef<HTMLDivElement | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [cardRecordId, setCardRecordId] = useState<string | null>(null);
  const [commentPanelOpen, setCommentPanelOpen] = useState(false);
  const [commentTargetRecordId, setCommentTargetRecordId] = useState<string | null>(null);
  const [commentCardTop, setCommentCardTop] = useState(0);
  const commentTrackHost = useCommentSidebarTrack();
  const [gridFocusedRecordId, setGridFocusedRecordId] = useState<string | null>(null);
  const [editingFieldPanel, setEditingFieldPanel] = useState<{ fieldId: string; left: number; top: number } | null>(null);
  const [addFieldPanel, setAddFieldPanel] = useState<{ left: number; top: number } | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const [dropActive, setDropActive] = useState(false);
  const [ganttDraft, setGanttDraft] = useState<{ recordId: string; start: string; end: string } | null>(null);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const ganttDraftRef = useRef<{ recordId: string; start: string; end: string } | null>(null);
  const ganttDragRef = useRef<{
    recordId: string;
    mode: 'move' | 'start' | 'end';
    pointerId: number;
    originX: number;
    start: Date;
    end: Date;
  } | null>(null);
  const selectionAnchorRef = useRef<string | null>(null);
  const viewMenuRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const toolbarPanelRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const viewContextMenuRef = useRef<HTMLDivElement>(null);
  const fieldPanelAnchorRef = useRef<HTMLSpanElement>(null);
  const [isViewToolsVisible, setIsViewToolsVisible] = useState(false);
  const viewHoverZoneRef = useRef<HTMLDivElement>(null);
  const viewToolsLeaveTimerRef = useRef<number | null>(null);

  const showViewTools = useCallback(() => {
    if (viewToolsLeaveTimerRef.current != null) {
      window.clearTimeout(viewToolsLeaveTimerRef.current);
      viewToolsLeaveTimerRef.current = null;
    }
    setIsViewToolsVisible(true);
  }, []);

  const hideViewTools = useCallback(() => {
    if (viewToolsLeaveTimerRef.current != null) window.clearTimeout(viewToolsLeaveTimerRef.current);
    viewToolsLeaveTimerRef.current = window.setTimeout(() => {
      viewToolsLeaveTimerRef.current = null;
      setIsViewToolsVisible(false);
    }, 160);
  }, []);

  const handleViewHoverLeave = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const next = event.relatedTarget;
    if (next instanceof Node && viewHoverZoneRef.current?.contains(next)) return;
    if (next instanceof Element && next.closest('.block-inline-tools, .block-drag-row')) return;
    if (blockRef.current?.classList.contains('is-block-gutter-active')) return;
    hideViewTools();
  }, [hideViewTools]);

  useEffect(() => () => {
    if (viewToolsLeaveTimerRef.current != null) window.clearTimeout(viewToolsLeaveTimerRef.current);
  }, []);

  /* 左侧块柄（多维表格按钮）在 Editor 中渲染，hover 时同步显示右侧工具栏 */
  useEffect(() => {
    const block = blockRef.current;
    if (!block) return;
    const syncToolsFromGutter = () => {
      if (block.classList.contains('is-block-gutter-active')) {
        showViewTools();
      } else if (!viewHoverZoneRef.current?.matches(':hover')) {
        hideViewTools();
      }
    };
    syncToolsFromGutter();
    const observer = new MutationObserver(syncToolsFromGutter);
    observer.observe(block, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [hideViewTools, showViewTools]);

  const commit = (next: BaseTable) => {
    tableRef.current = next;
    const view = getActiveView(next);
    updateAttributes({
      model: serializeBaseTable(next),
      title: next.name,
      view: view.type === 'gallery' || view.type === 'gantt' || view.type === 'kanban' ? view.type : 'grid',
    });
    dispatchBitableModelUpdated({
      tableId: next.id,
      blockId: typeof node.attrs.blockId === 'string' ? node.attrs.blockId : undefined,
    });
  };

  const mutate = (operation: (current: BaseTable) => BaseTable) => commit(operation(tableRef.current));

  useEffect(() => {
    if (!node.attrs.model) commit(parsedTable);
  }, []); // migrate legacy nodes once on mount

  useEffect(() => {
    const block = blockRef.current;
    const parent = block?.parentElement;
    if (!block || !parent) return;
    const measureAnchorWidth = () => {
      block.style.setProperty('--bitable-anchor-width', `${Math.max(860, parent.clientWidth)}px`);
    };
    measureAnchorWidth();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measureAnchorWidth) : null;
    ro?.observe(parent);
    window.addEventListener('resize', measureAnchorWidth);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measureAnchorWidth);
    };
  }, []);

  useEffect(() => {
    if (!showViewMenu && !showSettings && !activeToolbarPanel && !viewContextMenuId) return;
    const outside = (event: globalThis.MouseEvent) => {
      if (!(event.target instanceof Node)) return;
      if (
        viewMenuRef.current?.contains(event.target)
        || settingsRef.current?.contains(event.target)
        || toolbarPanelRef.current?.contains(event.target)
      ) return;
      if (viewContextMenuRef.current?.contains(event.target)) return;
      if (event.target instanceof Element && event.target.closest('.base-viewbar__rename')) return;
      if (isToolbarPortaledDropdownTarget(event.target)) return;
      setShowViewMenu(false);
      setShowSettings(false);
      setViewContextMenuId(null);
      if (!(event.target instanceof Element) || !event.target.closest('.base-field-panel, .bitable-field, .base-viewbar__tool-anchor, .base-toolbar-panel, .bitable-group-panel, .bitable-sort-panel, .bitable-toolbar__group-menu, .base-viewbar__tool')) {
        setActiveToolbarPanel(null);
      }
    };
    // Capture phase: base-view-content stops mousedown propagation on bubble, which would skip this handler.
    document.addEventListener('mousedown', outside, true);
    return () => document.removeEventListener('mousedown', outside, true);
  }, [showViewMenu, showSettings, activeToolbarPanel, viewContextMenuId]);

  useEffect(() => {
    setIsRenamingView(false);
    setRenamingViewId(null);
  }, [activeView.id]);

  useEffect(() => {
    if (!isRenamingView && !renamingViewId) return;
    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [isRenamingView, renamingViewId]);

  useEffect(() => {
    if (editingFieldPanel && !table.fields.some(field => field.id === editingFieldPanel.fieldId)) setEditingFieldPanel(null);
  }, [editingFieldPanel, table.fields]);

  useEffect(() => {
    if (!editingFieldPanel) return;
    const close = (event: globalThis.MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest('.base-field-edit-popover-portal')) return;
      if (event.target.closest('.base-b-field-type-picker-portal')) return;
      if (event.target.closest('.base-b-select-color-panel')) return;
      if (event.target.closest('.base-b-select-default-panel')) return;
      if (event.target.closest('.base-b-field-type-picker')) return;
      if (event.target.closest('.base-grid-field-menu')) return;
      setEditingFieldPanel(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [editingFieldPanel]);

  useEffect(() => {
    if (!addFieldPanel) return;
    const close = (event: globalThis.MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest('.base-field-edit-popover-portal')) return;
      if (event.target.closest('.base-b-field-type-picker-portal')) return;
      if (event.target.closest('.base-b-select-color-panel')) return;
      if (event.target.closest('.base-b-select-default-panel')) return;
      if (event.target.closest('.base-b-field-type-picker')) return;
      if (event.target.closest('.base-grid-add-field-column')) return;
      setAddFieldPanel(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [addFieldPanel]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setAddFieldPanel(null);
      setEditingFieldPanel(null);
      setSelectedIds(new Set());
      selectionAnchorRef.current = null;
      setActiveToolbarPanel(null);
      setShowSettings(false);
      setShowViewMenu(false);
      setViewContextMenuId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const setView = (viewId: string) => {
    mutate(current => ({ ...current, activeViewId: viewId }));
    setShowViewMenu(false);
    setShowSettings(false);
    setActiveToolbarPanel(null);
    setIsRenamingView(false);
    setRenamingViewId(null);
    setViewContextMenuId(null);
  };

  const beginRenameView = (viewId: string, fromMenu = false) => {
    const target = table.views.find(view => view.id === viewId);
    if (!target || target.locked) return;
    setRenameDraft(target.name);
    setViewContextMenuId(null);
    if (fromMenu || viewId !== activeView.id) {
      setRenamingViewId(viewId);
      setIsRenamingView(false);
      return;
    }
    setIsRenamingView(true);
    setRenamingViewId(null);
    setShowViewMenu(false);
  };

  const startRenameView = () => beginRenameView(activeView.id);

  const commitRenameView = () => {
    const targetId = renamingViewId || activeView.id;
    const target = table.views.find(view => view.id === targetId);
    const trimmed = renameDraft.trim();
    if (target && trimmed && trimmed !== target.name) {
      mutate(current => updateView(current, targetId, view => ({ ...view, name: trimmed })));
    }
    setIsRenamingView(false);
    setRenamingViewId(null);
  };

  const cancelRenameView = () => {
    setIsRenamingView(false);
    setRenamingViewId(null);
    setRenameDraft('');
  };

  const openViewContextMenu = (_btn: HTMLElement, viewId: string) => {
    setViewContextMenuId(current => (current === viewId ? null : viewId));
  };

  const duplicateView = (viewId: string) => {
    mutate(current => copyView(current, viewId));
    setViewContextMenuId(null);
  };

  const removeView = (viewId: string) => {
    if (table.views.length <= 1) return;
    const target = table.views.find(view => view.id === viewId);
    if (!target) return;
    setViewContextMenuId(null);
    setDeleteViewTarget({ id: target.id, name: target.name });
  };

  const confirmDeleteView = () => {
    if (!deleteViewTarget) return;
    mutate(current => deleteView(current, deleteViewTarget.id));
    setDeleteViewTarget(null);
    setRenamingViewId(null);
    setIsRenamingView(false);
  };

  const handleViewDragStart = (event: DragEvent, visibleIndex: number) => {
    const viewId = getVisibleViews(table)[visibleIndex]?.id;
    const fromIndex = viewId ? table.views.findIndex(view => view.id === viewId) : visibleIndex;
    dragFromIndexRef.current = fromIndex >= 0 ? fromIndex : null;
    setDraggingViewIndex(visibleIndex);
    setDragOverIndex(null);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(visibleIndex));
    if (!dragGhostRef.current) {
      const ghost = document.createElement('div');
      ghost.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
      document.body.appendChild(ghost);
      dragGhostRef.current = ghost;
    }
    event.dataTransfer.setDragImage(dragGhostRef.current, 0, 0);
  };

  const handleViewDragOver = (event: DragEvent, visibleIndex: number) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    if (draggingViewIndex === visibleIndex) {
      setDragOverIndex(null);
      return;
    }
    setDragOverIndex(visibleIndex);
  };

  const handleViewDrop = (event: DragEvent, visibleIndex: number) => {
    event.preventDefault();
    event.stopPropagation();
    const fromIndex = dragFromIndexRef.current;
    const toViewId = getVisibleViews(table)[visibleIndex]?.id;
    const toIndex = toViewId ? table.views.findIndex(view => view.id === toViewId) : visibleIndex;
    if (fromIndex != null && fromIndex !== toIndex && toIndex >= 0) {
      mutate(current => reorderViews(current, fromIndex, toIndex));
    }
    dragFromIndexRef.current = null;
    setDragOverIndex(null);
    setDraggingViewIndex(null);
  };

  const handleViewDragEnd = () => {
    dragFromIndexRef.current = null;
    setDragOverIndex(null);
    setDraggingViewIndex(null);
  };

  const createView = (type: 'grid' | 'gallery' | 'kanban') => {
    if (!isViewTypeVisible(type)) return;
    mutate(current => addView(current, type));
    setShowViewMenu(false);
    setActiveToolbarPanel(null);
    setShowSettings(type === 'gallery');
  };

  const openToolbarPanel = (panel: ToolbarPanel) => {
    setShowViewMenu(false);
    setShowSettings(false);
    setCommentPanelOpen(false);
    const opening = activeToolbarPanel !== panel;
    if (opening && panel === 'filter' && !activeView.locked && !(activeView.filters || []).length && table.fields[0]) {
      const firstFieldId = table.fields[0].id;
      mutate(current => updateView(current, activeView.id, view => ({
        ...view,
        filters: [{ id: `filter_${Date.now().toString(36)}`, fieldId: firstFieldId, operator: 'equals', value: '' }],
      })));
    }
    setActiveToolbarPanel(current => current === panel ? null : panel);
  };

  const resolveCommentRecordId = useCallback(() => {
    if (gridFocusedRecordId) return gridFocusedRecordId;
    if (selectedIds.size === 1) return [...selectedIds][0];
    if (selectedIds.size > 1) return [...selectedIds][0];
    return records[0]?.id ?? null;
  }, [gridFocusedRecordId, records, selectedIds]);

  const blockId = typeof node.attrs.blockId === 'string' ? node.attrs.blockId : '';

  const openCommentPanel = useCallback((recordId?: string | null) => {
    setShowViewMenu(false);
    setShowSettings(false);
    setActiveToolbarPanel(null);
    const targetId = recordId || resolveCommentRecordId();
    if (!targetId || !blockId) return;
    setCommentTargetRecordId(targetId);
    setCommentPanelOpen(true);
    dispatchBitableCommentOpen({ blockId, recordId: targetId });
    if (recordId) {
      selectionAnchorRef.current = recordId;
      setSelectedIds(new Set([recordId]));
    }
  }, [blockId, resolveCommentRecordId]);

  const closeCommentPanel = useCallback(() => {
    setCommentPanelOpen(false);
    setCommentTargetRecordId(null);
    if (blockId) dispatchBitableCommentClose(blockId);
  }, [blockId]);

  const toggleCommentPanel = useCallback(() => {
    if (commentPanelOpen) {
      if (blockId) dispatchBitableCommentToggleSidebar(blockId);
      return;
    }
    openCommentPanel();
  }, [blockId, commentPanelOpen, openCommentPanel]);

  const addRecordComment = useCallback((recordId: string, content: string) => {
    const comment = createRecordComment(content);
    if (!comment.content) return;
    mutate(current => updateRecord(current, recordId, record => ({
      ...record,
      comments: [comment, ...(record.comments ?? [])],
    })));
  }, [mutate]);

  const setGalleryConfig = (patch: Partial<GalleryViewConfig>) => {
    if (activeView.type !== 'gallery' || activeView.locked) return;
    mutate(current => updateView(current, activeView.id, view => ({
      ...view,
      config: { ...getGalleryConfig(current, view), ...patch },
    })));
  };

  const setKanbanConfig = (patch: Partial<GalleryViewConfig>) => {
    if (activeView.type !== 'kanban' || activeView.locked) return;
    mutate(current => updateView(current, activeView.id, view => ({
      ...view,
      config: { ...getGalleryConfig(current, view), ...patch },
    })));
  };

  const setGanttConfig = (patch: Partial<GanttViewConfig>) => {
    if (activeView.type !== 'gantt' || activeView.locked) return;
    mutate(current => updateView(current, activeView.id, view => ({
      ...view,
      config: { ...getGanttConfig(current, view), ...patch },
    })));
  };

  function cloneCellValue(value: CellValue): CellValue {
    if (Array.isArray(value)) return JSON.parse(JSON.stringify(value)) as CellValue;
    return value;
  }

  const buildNewRecord = (current: BaseTable, initialTitle = '', seedFromRecord?: BaseRecord | null) => {
    const record = createRecord(current.id, current.fields, current.primaryFieldId, initialTitle);
    if (seedFromRecord && activeView.type === 'grid') {
      activeView.sorts?.forEach(sort => {
        if (sort.fieldId !== current.primaryFieldId && sort.fieldId in record.fields) {
          record.fields[sort.fieldId] = cloneCellValue(seedFromRecord.fields[sort.fieldId]);
        }
      });
    }
    if (activeView.type === 'gallery' && galleryConfig.groupByFieldId) {
      record.fields[galleryConfig.groupByFieldId] = '';
    }
    if (activeView.type === 'gantt' && ganttConfig.startDateFieldId && ganttConfig.endDateFieldId) {
      const start = new Date();
      record.fields[ganttConfig.startDateFieldId] = dateValue(start);
      record.fields[ganttConfig.endDateFieldId] = dateValue(offsetDate(start, 3));
    }
    return record;
  };

  const addRecord = (initialTitle = '') => {
    let insertedId = '';
    mutate(current => {
      const currentVisibleRecords = visibleRecords(current, activeView);
      const seedFromRecord = currentVisibleRecords[currentVisibleRecords.length - 1] ?? null;
      const record = buildNewRecord(current, initialTitle, seedFromRecord);
      insertedId = record.id;
      return {
        ...current,
        records: insertRecordsIntoTable(current, activeView, [record], { mode: 'append' }),
      };
    });
    return insertedId;
  };

  const insertRecordAt = (visibleIndex: number, count = 1, initialTitle = '') => {
    const insertedIds: string[] = [];
    mutate(current => {
      const recordsToInsert = Array.from({ length: count }, () => {
        const record = buildNewRecord(current, initialTitle);
        insertedIds.push(record.id);
        return record;
      });
      let nextRecords = current.records;
      recordsToInsert.forEach((record, offset) => {
        nextRecords = insertRecordsIntoTable(
          { ...current, records: nextRecords },
          activeView,
          [record],
          { visibleIndex: visibleIndex + offset },
        );
      });
      return { ...current, records: nextRecords };
    });
    return insertedIds;
  };

  const duplicateRecord = (recordId: string) => {
    if (activeView.locked) return;
    mutate(current => {
      const index = current.records.findIndex(record => record.id === recordId);
      if (index < 0) return current;
      const source = current.records[index];
      const title = valueText(source.fields[current.primaryFieldId]);
      const record = createRecord(current.id, current.fields, current.primaryFieldId, title ? `${title} 副本` : '');
      current.fields.forEach(field => {
        if (field.id !== current.primaryFieldId) {
          record.fields[field.id] = cloneCellValue(source.fields[field.id]);
        }
      });
      if (activeView.type === 'gallery' && galleryConfig.groupByFieldId) {
        record.fields[galleryConfig.groupByFieldId] = cloneCellValue(source.fields[galleryConfig.groupByFieldId]);
      }
      const newRecords = [...current.records];
      newRecords.splice(index + 1, 0, record);
      return { ...current, records: newRecords };
    });
  };

  const copyRecordLink = async (recordId: string) => {
    const url = new URL(window.location.href);
    url.hash = `record-${recordId}`;
    try {
      await navigator.clipboard.writeText(url.toString());
    } catch {
      window.prompt('复制记录链接', url.toString());
    }
  };

  const insertRecordRelative = (recordId: string, offset: 0 | 1) => {
    const index = table.records.findIndex(record => record.id === recordId);
    if (index < 0) return;
    insertRecordAt(index + offset, 1);
  };

  const insertChildRecord = (parentRecordId: string, initialTitle = '') => {
    let insertedId = '';
    mutate(current => {
      const parentIndex = current.records.findIndex(record => record.id === parentRecordId);
      if (parentIndex < 0) return current;
      const record = createRecord(current.id, current.fields, current.primaryFieldId, initialTitle);
      record.parentId = parentRecordId;
      insertedId = record.id;
      if (activeView.type === 'gallery' && galleryConfig.groupByFieldId) {
        record.fields[galleryConfig.groupByFieldId] = '';
      }
      if (activeView.type === 'gantt' && ganttConfig.startDateFieldId && ganttConfig.endDateFieldId) {
        const start = new Date();
        record.fields[ganttConfig.startDateFieldId] = dateValue(start);
        record.fields[ganttConfig.endDateFieldId] = dateValue(offsetDate(start, 3));
      }
      const insertIndex = findInsertIndexAfterSubtree(current.records, parentIndex);
      const newRecords = [...current.records];
      newRecords.splice(insertIndex, 0, record);
      return { ...current, records: newRecords };
    });
    return insertedId;
  };

  const changeCell = (recordId: string, fieldId: string, value: CellValue) => {
    mutate(current => updateRecord(current, recordId, record => {
      const field = current.fields.find(item => item.id === fieldId);
      const nextValue = field?.type === 'multi_select'
        ? normalizeMultiSelectIds(field, value)
        : value;
      return withUpdatedValue(record, fieldId, nextValue, field?.name);
    }));
  };

  const performRemoveRecords = useCallback((recordIds: string[]) => {
    mutate(current => {
      const removeIds = collectRecordSubtreeIds(current.records, recordIds);
      return { ...current, records: current.records.filter(record => !removeIds.has(record.id)) };
    });
    setSelectedIds(new Set());
  }, [mutate]);

  const removeRecords = (recordIds: string[], requireConfirm = false) => {
    if (activeView.locked || recordIds.length === 0) return false;
    if (requireConfirm) {
      setPendingDeleteRecordIds(recordIds);
      return false;
    }
    performRemoveRecords(recordIds);
    return true;
  };

  const confirmDeleteRecords = () => {
    if (!pendingDeleteRecordIds) return;
    performRemoveRecords(pendingDeleteRecordIds);
    setPendingDeleteRecordIds(null);
  };

  const openAddFieldPanel = (anchor?: { left: number; top: number }) => {
    if (activeView.locked) return;
    setEditingFieldPanel(null);
    setAddFieldPanel({
      left: anchor?.left ?? Math.max(8, (window.innerWidth - 320) / 2),
      top: anchor?.top ?? 120,
    });
  };

  const createField = (input: CreateFieldInput) => {
    if (activeView.locked) return;
    const name = input.name.trim();
    if (!name) return;
    const { id, field, defaultValue } = buildNewFieldPayload({ ...input, name });
    mutate(current => ({
      ...current,
      fields: [...current.fields, field],
      records: current.records.map(record => ({
        ...record,
        fields: { ...record.fields, [id]: defaultValue },
      })),
    }));
  };

  const editField = (fieldId: string) => {
    handleGridFieldMenuAction(fieldId, 'rename');
  };

  const removeField = (fieldId: string) => {
    if (activeView.locked) return;
    if (fieldId === table.primaryFieldId || table.fields.length <= 1) return;
    const target = table.fields.find(field => field.id === fieldId);
    if (!target) return;
    mutate(current => ({
      ...current,
      fields: current.fields.filter(field => field.id !== fieldId),
      records: current.records.map(record => {
        const nextFields = { ...record.fields };
        delete nextFields[fieldId];
        return { ...record, fields: nextFields };
      }),
      views: current.views.map(view => ({
        ...view,
        hiddenFieldIds: view.hiddenFieldIds?.filter(id => id !== fieldId),
        filters: view.filters?.filter(filter => filter.fieldId !== fieldId),
        sorts: view.sorts?.filter(sort => sort.fieldId !== fieldId),
        config: view.type === 'gallery'
          ? (() => {
              const config = { ...getGalleryConfig(current, view) };
              if (config.coverFieldId === fieldId) delete config.coverFieldId;
              if (config.groupByFieldId === fieldId) delete config.groupByFieldId;
              return config;
            })()
          : view.type === 'gantt'
            ? (() => {
                const config = { ...getGanttConfig(current, view) };
                if (config.titleFieldId === fieldId) config.titleFieldId = current.primaryFieldId;
                if (config.startDateFieldId === fieldId) delete config.startDateFieldId;
                if (config.endDateFieldId === fieldId) delete config.endDateFieldId;
                return config;
              })()
            : view.type === 'grid'
              ? (() => {
                  const config = { ...(view.config as GridViewConfig) };
                  if (config.groupByFieldIds?.includes(fieldId)) {
                    const removeIndex = config.groupByFieldIds.indexOf(fieldId);
                    config.groupByFieldIds = config.groupByFieldIds.filter(id => id !== fieldId);
                    if (removeIndex >= 0 && config.groupSortDirections?.length) {
                      config.groupSortDirections = config.groupSortDirections.filter((_, index) => index !== removeIndex);
                    }
                    if (!config.groupByFieldIds.length) {
                      delete config.groupByFieldIds;
                      delete config.groupSortDirections;
                    }
                  }
                  if (config.parentFieldId === fieldId) delete config.parentFieldId;
                  return config;
                })()
              : view.config,
      })),
    }));
  };

  const reorderFields = (fromIndex: number, toIndex: number) => {
    if (activeView.locked || fromIndex === toIndex) return;
    mutate(current => {
      const fields = [...current.fields];
      const [moved] = fields.splice(fromIndex, 1);
      fields.splice(toIndex, 0, moved);
      return { ...current, fields };
    });
  };

  const insertFieldAfter = (fieldId: string, source?: BaseField) => {
    if (activeView.locked) return;
    const id = `fld_text_${Date.now().toString(36)}`;
    mutate(current => {
      const index = current.fields.findIndex(field => field.id === fieldId);
      const insertIndex = index >= 0 ? index + 1 : current.fields.length;
      const field: BaseField = source
        ? { ...source, id, name: duplicateFieldName(source.name) }
        : { id, name: nextAutoFieldName(current.fields), type: 'text' };
      const fields = [...current.fields];
      fields.splice(insertIndex, 0, field);
      return {
        ...current,
        fields,
        records: current.records.map(record => ({
          ...record,
          fields: {
            ...record.fields,
            [id]: source ? cloneCellValue(record.fields[source.id]) : '',
          },
        })),
      };
    });
  };

  const insertFieldBefore = (fieldId: string) => {
    if (activeView.locked) return;
    const id = `fld_text_${Date.now().toString(36)}`;
    mutate(current => {
      const index = current.fields.findIndex(field => field.id === fieldId);
      const insertIndex = index >= 0 ? index : 0;
      const field: BaseField = { id, name: nextAutoFieldName(current.fields), type: 'text' };
      const fields = [...current.fields];
      fields.splice(insertIndex, 0, field);
      return {
        ...current,
        fields,
        records: current.records.map(record => ({
          ...record,
          fields: {
            ...record.fields,
            [id]: '',
          },
        })),
      };
    });
  };

  const coerceFieldValue = (value: CellValue, field: BaseField): CellValue => {
    if (field.type === 'attachment') return Array.isArray(value) && typeof value[0] === 'object' ? value : [];
    if (field.type === 'checkbox') return typeof value === 'boolean' ? value : Boolean(valueText(value));
    if (field.type === 'number') return Number(valueText(value)) || 0;
    if (field.type === 'multi_select') return normalizeMultiSelectIds(field, value);
    return valueText(value);
  };

  const updateFieldConfig = (fieldId: string, input: UpdateFieldInput) => {
    if (activeView.locked) return;
    mutate(current => {
      const oldField = current.fields.find(field => field.id === fieldId);
      if (!oldField) return current;
      const typeChanged = oldField.type !== input.type;
      return {
        ...current,
        fields: current.fields.map(field => {
          if (field.id !== fieldId) return field;
          const nextField: BaseField = {
            ...field,
            name: input.name,
            type: input.type,
            defaultValue: input.defaultValue,
          };
          if (input.type === 'single_select' || input.type === 'multi_select') {
            nextField.options = { choices: input.options?.choices ?? [] };
          } else {
            delete nextField.options;
          }
          if (input.defaultValue === undefined) {
            delete nextField.defaultValue;
          }
          return nextField;
        }),
        records: typeChanged
          ? current.records.map(record => {
              const coercedField: BaseField = {
                ...oldField,
                type: input.type,
                options: (input.type === 'single_select' || input.type === 'multi_select')
                  ? { choices: input.options?.choices ?? oldField.options?.choices ?? [] }
                  : oldField.options,
              };
              return {
                ...record,
                fields: {
                  ...record.fields,
                  [fieldId]: coerceFieldValue(record.fields[fieldId], coercedField),
                },
              };
            })
          : current.records,
      };
    });
    setEditingFieldPanel(null);
  };

  const handleGridFieldMenuAction = (fieldId: string, action: GridFieldMenuAction, position?: GridFieldMenuPosition) => {
    const field = tableRef.current.fields.find(item => item.id === fieldId);
    if (!field) return;
    if (action === 'rename') {
      if (activeView.locked) return;
      setEditingFieldPanel({
        fieldId,
        left: Math.max(8, position?.anchorLeft ?? position?.left ?? 320),
        top: Math.max(8, (position?.anchorTop ?? 88) + 32),
      });
      setAddFieldPanel(null);
      return;
    }
    if (action === 'description') {
            
      return;
    }
    if (action === 'duplicate') {
      insertFieldAfter(fieldId, field);
      return;
    }
    if (action === 'hide') {
      if (activeView.locked || fieldId === tableRef.current.primaryFieldId) return;
      mutate(current => updateView(current, activeView.id, view => ({
        ...view,
        hiddenFieldIds: Array.from(new Set([...(view.hiddenFieldIds || []), fieldId])),
      })));
      return;
    }
    if (action === 'insertLeft') {
      insertFieldBefore(fieldId);
      return;
    }
    if (action === 'insertRight') {
      insertFieldAfter(fieldId);
      return;
    }
    if (action === 'sortAsc' || action === 'sortDesc') {
      if (activeView.locked) return;
      mutate(current => updateView(current, activeView.id, view => ({
        ...view,
        autoSort: view.autoSort !== false,
        sorts: [{ fieldId, direction: action === 'sortAsc' ? 'asc' : 'desc' }],
      })));
      setActiveToolbarPanel('sort');
      return;
    }
    if (action === 'filter') {
      if (activeView.locked) return;
      mutate(current => updateView(current, activeView.id, view => ({
        ...view,
        filters: [{
          id: view.filters?.[0]?.id || `filter_${Date.now().toString(36)}`,
          fieldId,
          operator: view.filters?.[0]?.operator || 'contains',
          value: view.filters?.[0]?.value || '',
        }],
      })));
      setActiveToolbarPanel('filter');
      return;
    }
    if (action === 'group') {
      if (activeView.locked) return;
      if (activeView.type === 'grid') {
        mutate(current => updateView(current, activeView.id, view => {
          const config = view.config as GridViewConfig;
          const existing = config.groupByFieldIds || [];
          const existingDirections = config.groupSortDirections || existing.map(() => 'asc' as const);
          if (existing.includes(fieldId)) return view;
          return {
            ...view,
            config: {
              ...config,
              groupByFieldIds: [...existing, fieldId],
              groupSortDirections: [...existingDirections, 'asc'],
            },
          };
        }));
      }
      setActiveToolbarPanel('group');
      return;
    }
    if (action === 'delete') {
      removeField(fieldId);
    }
  };

  const ensureAttachmentField = () => {
    const existing = tableRef.current.fields.find(field => field.type === 'attachment');
    if (existing) return existing.id;
    const field: BaseField = { id: `fld_attachment_${Date.now().toString(36)}`, name: '附件', type: 'attachment' };
    mutate(current => {
      const fields = [...current.fields, field];
      return {
        ...current,
        fields,
        records: current.records.map(record => ({ ...record, fields: { ...record.fields, [field.id]: [] } })),
        views: current.views.map(view => view.type === 'gallery'
          ? { ...view, config: { ...createGalleryConfig(fields, current.primaryFieldId), ...view.config, coverFieldId: field.id } }
          : view),
      };
    });
    return field.id;
  };

  const uploadAttachment = (recordId: string, file: File, requestedFieldId?: string) => {
    const fieldId = requestedFieldId || galleryConfig.coverFieldId || ensureAttachmentField();
    const localUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
    const pending = attachmentFromUpload(file, localUrl, 1);
    changeCell(recordId, fieldId, [...getAttachments(tableRef.current.records.find(record => record.id === recordId)!, fieldId), pending]);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/uploads');
    xhr.upload.onprogress = event => {
      if (!event.lengthComputable) return;
      const progress = Math.max(1, Math.min(98, Math.round(event.loaded / event.total * 100)));
      mutate(current => updateRecord(current, recordId, record => withUpdatedValue(record, fieldId,
        getAttachments(record, fieldId).map(item => item.id === pending.id ? { ...item, uploadProgress: progress } : item))));
    };
    xhr.onload = () => {
      try {
        const response = parseJsonPayload<{ name: string; size: number; type: string; url: string }>(xhr.responseText || '');
        if (xhr.status < 200 || xhr.status >= 300 || response.code !== 0) throw new Error(response.message || '上传失败');
        const uploaded = response.data as { name: string; size: number; type: string; url: string };
        mutate(current => updateRecord(current, recordId, record => withUpdatedValue(record, fieldId,
          getAttachments(record, fieldId).map((item): AttachmentValue => item.id === pending.id
            ? {
                ...item,
                name: uploaded.name,
                size: uploaded.size,
                mimeType: uploaded.type,
                url: uploaded.url,
                thumbnailUrl: uploaded.type.startsWith('image/') ? uploaded.url : undefined,
                uploadStatus: 'success',
                uploadProgress: 100,
              }
            : item))));
      } catch (error) {
        mutate(current => updateRecord(current, recordId, record => withUpdatedValue(record, fieldId,
          getAttachments(record, fieldId).map((item): AttachmentValue => item.id === pending.id
            ? { ...item, uploadStatus: 'failed', error: error instanceof Error ? error.message : '上传失败' }
            : item))));
      } finally {
        if (localUrl) URL.revokeObjectURL(localUrl);
      }
    };
    const form = new FormData();
    form.append('file', file);
    xhr.send(form);
  };

  const onDropFiles = (event: DragEvent, recordId?: string) => {
    const files = Array.from(event.dataTransfer.files);
    if (!files.length) return;
    event.preventDefault();
    event.stopPropagation();
    setDropActive(false);
    const targetRecordId = recordId || addRecord(files[0].name.replace(/\.[^.]+$/, ''));
    files.forEach(file => uploadAttachment(targetRecordId, file));
  };

  const pickFiles = (recordId: string, fieldId?: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*,video/*,application/pdf,*/*';
    input.onchange = () => Array.from(input.files || []).forEach(file => uploadAttachment(recordId, file, fieldId));
    input.click();
  };

  const selectBlock = () => {
    const pos = typeof getPos === 'function' ? getPos() : null;
    if (typeof pos !== 'number') return;
    editor.chain().focus().setNodeSelection(pos).run();
    window.getSelection()?.removeAllRanges();
  };

  useEffect(() => {
    if (!selected) return;
    window.getSelection()?.removeAllRanges();
  }, [selected]);

  const renderCover = (record: BaseRecord) => {
    const attachments = getAttachments(record, galleryConfig.coverFieldId);
    const cover = selectCoverAttachment(attachments);
    if (isPreviewImage(cover)) {
      return <img loading="lazy" src={cover!.thumbnailUrl || cover!.previewUrl || cover!.url} alt="" style={{ objectFit: galleryConfig.coverFit, objectPosition: galleryConfig.coverPosition || 'center' }} />;
    }
    if (cover) return <FileBadge attachment={cover} />;
    return (
      <div className="base-gallery-empty-cover">
        <span aria-hidden>▧</span>
        {!galleryConfig.coverFieldId ? <small>选择附件字段作为封面</small> : null}
      </div>
    );
  };

  const openGalleryRecord = (recordId: string) => {
    setCardRecordId(recordId);
    selectionAnchorRef.current = recordId;
    setSelectedIds(new Set([recordId]));
  };

  const renderGallery = () => (
    <BitableGalleryView
      table={table}
      config={galleryConfig}
      groups={groups}
      records={records}
      selectedIds={selectedIds}
      collapsedGroups={collapsedGroups}
      dropActive={dropActive}
      setCollapsedGroups={setCollapsedGroups}
      onDropFiles={onDropFiles}
      setDropActive={setDropActive}
      removeRecords={removeRecords}
      addRecord={() => addRecord()}
      locked={activeView.locked}
      onInsertRecordLeft={recordId => insertRecordRelative(recordId, 0)}
      onInsertRecordRight={recordId => insertRecordRelative(recordId, 1)}
      onShareRecord={() => openToolbarPanel('share')}
      onCopyRecordLink={copyRecordLink}
      onDuplicateRecord={duplicateRecord}
      onOpenRecord={openGalleryRecord}
      onOpenComment={recordId => openCommentPanel(recordId)}
    />
  );

  const addSelectChoice = useCallback((fieldId: string, name: string): string | null => {
    if (activeView.locked) return null;
    const trimmed = name.trim();
    if (!trimmed) return null;
    let result: string | null = null;
    mutate(current => {
      const field = current.fields.find(item => item.id === fieldId);
      if (!field || (field.type !== 'single_select' && field.type !== 'multi_select')) return current;
      const choices = field.options?.choices ?? [];
      const existing = choices.find(choice => choice.name.toLowerCase() === trimmed.toLowerCase());
      if (existing) {
        result = existing.id;
        return current;
      }
      const nextChoice = { ...createSelectChoice(choices.length), name: trimmed };
      result = nextChoice.id;
      return {
        ...current,
        fields: current.fields.map(item => item.id === fieldId
          ? { ...item, options: { ...item.options, choices: [...choices, nextChoice] } }
          : item),
      };
    });
    return result;
  }, [activeView.locked, mutate]);

  const renderGrid = () => (
    <BitableGridView
      table={table}
      activeView={activeView}
      records={records}
      selectedIds={selectedIds}
      addField={openAddFieldPanel}
      addRecord={() => addRecord()}
      insertRecordAt={insertRecordAt}
      insertChildRecord={insertChildRecord}
      removeRecords={removeRecords}
      changeCell={changeCell}
      pickFiles={pickFiles}
      toggleRecordSelection={toggleRecordSelection}
      toggleAllRecordSelection={toggleAllRecordSelection}
      reorderRecords={reorderRecords}
      openRecord={recordId => {
        setCardRecordId(recordId);
        selectionAnchorRef.current = recordId;
        setSelectedIds(new Set([recordId]));
      }}
      onFocusedRecordChange={setGridFocusedRecordId}
      onOpenComment={recordId => openCommentPanel(recordId)}
      selectBlock={selectBlock}
      onFieldMenuAction={handleGridFieldMenuAction}
      onColumnWidthChange={(fieldId, width) => {
        if (activeView.locked) return;
        mutate(current => updateView(current, activeView.id, view => ({
          ...view,
          config: {
            ...view.config,
            fieldWidths: {
              ...((view.config as { fieldWidths?: Record<string, number> }).fieldWidths || {}),
              [fieldId]: width,
            },
          },
        })));
      }}
      addSelectChoice={addSelectChoice}
    />
  );

  const ganttScrollRef = useRef<HTMLDivElement>(null);

  const ganttDates = records.flatMap(record => {
    const start = readDate(record.fields[ganttConfig.startDateFieldId || '']);
    const end = readDate(record.fields[ganttConfig.endDateFieldId || '']);
    return start && end && daysBetween(start, end) >= 0 ? [start, end] : [];
  });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ganttExtent = [...ganttDates, today];
  const ganttOrigin = offsetDate(new Date(Math.min(...ganttExtent.map(date => date.getTime()))), -10);
  const ganttLimit = offsetDate(new Date(Math.max(...ganttExtent.map(date => date.getTime()))), 60);
  const ganttDays = Array.from({ length: Math.max(120, daysBetween(ganttOrigin, ganttLimit) + 30) }, (_, index) => offsetDate(ganttOrigin, index));
  const ganttMonthSpans = ganttDays.reduce<Array<{ key: string; label: string; days: number }>>((items, day) => {
    const key = `${day.getFullYear()}-${day.getMonth()}`;
    const last = items[items.length - 1];
    if (last?.key === key) last.days += 1;
    else items.push({ key, label: formatMonth(day), days: 1 });
    return items;
  }, []);

  const scrollToToday = () => {
    const container = ganttScrollRef.current;
    if (!container) return;
    const todayCellIndex = daysBetween(ganttOrigin, today);
    const todayLeft = todayCellIndex * ganttConfig.dayWidth;
    container.scrollLeft = todayLeft - container.clientWidth / 2 + (ganttConfig.dayWidth / 2);
  };

  const scrollTimeline = (direction: 'left' | 'right') => {
    const container = ganttScrollRef.current;
    if (!container) return;
    const scrollAmount = container.clientWidth * 0.6;
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  useEffect(() => {
    if (activeView.type === 'gantt') {
      const timer = setTimeout(scrollToToday, 120);
      return () => clearTimeout(timer);
    }
  }, [activeView.type, ganttConfig.dayWidth]);

  const toggleRecordSelection = (recordId: string) => {
    setSelectedIds(current => {
      const next = new Set(current);
      if (next.has(recordId)) next.delete(recordId); else next.add(recordId);
      return next;
    });
  };

  const toggleAllRecordSelection = () => {
    if (selectedIds.size === records.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(records.map(r => r.id)));
    }
  };

  const reorderRecords = (fromIndex: number, toIndex: number) => {
    if (activeView.locked || fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    if (fromIndex >= records.length || toIndex >= records.length) return;
    mutate(current => ({
      ...current,
      records: reorderRecordsInTree(current.records, fromIndex, toIndex),
    }));
  };

  const draftGanttAt = (drag: NonNullable<typeof ganttDragRef.current>, clientX: number) => {
    const delta = Math.round((clientX - drag.originX) / ganttConfig.dayWidth);
    let start = drag.start;
    let end = drag.end;
    if (drag.mode === 'move') {
      start = offsetDate(start, delta);
      end = offsetDate(end, delta);
    } else if (drag.mode === 'start') {
      start = offsetDate(start, Math.min(delta, daysBetween(start, end)));
    } else {
      end = offsetDate(end, Math.max(delta, -daysBetween(start, end)));
    }
    return { recordId: drag.recordId, start: dateValue(start), end: dateValue(end) };
  };

  const commitGanttDraft = (draft: { recordId: string; start: string; end: string } | null) => {
    if (!draft || !ganttConfig.startDateFieldId || !ganttConfig.endDateFieldId) return;
    mutate(current => updateRecord(current, draft.recordId, record => {
      const next = withUpdatedValue(record, ganttConfig.startDateFieldId!, draft.start);
      return withUpdatedValue(next, ganttConfig.endDateFieldId!, draft.end);
    }));
  };

  const finishGanttDragAt = (clientX: number) => {
    const drag = ganttDragRef.current;
    if (!drag) return;
    const draft = ganttDraftRef.current || draftGanttAt(drag, clientX);
    ganttDragRef.current = null;
    ganttDraftRef.current = null;
    setGanttDraft(null);
    commitGanttDraft(draft);
  };

  const startGanttDrag = (event: ReactPointerEvent<HTMLElement>, record: BaseRecord, mode: 'move' | 'start' | 'end') => {
    if (activeView.locked || !ganttConfig.startDateFieldId || !ganttConfig.endDateFieldId) return;
    const start = readDate(record.fields[ganttConfig.startDateFieldId]);
    const end = readDate(record.fields[ganttConfig.endDateFieldId]);
    if (!start || !end) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    ganttDragRef.current = { recordId: record.id, mode, pointerId: event.pointerId, originX: event.clientX, start, end };
    const draft = { recordId: record.id, start: dateValue(start), end: dateValue(end) };
    ganttDraftRef.current = draft;
    setGanttDraft(draft);
    const pointerId = event.pointerId;
    const handleMove = (moveEvent: PointerEvent) => {
      const drag = ganttDragRef.current;
      if (!drag || drag.pointerId !== pointerId) return;
      const nextDraft = draftGanttAt(drag, moveEvent.clientX);
      ganttDraftRef.current = nextDraft;
      setGanttDraft(nextDraft);
    };
    const handleUp = (upEvent: PointerEvent) => {
      const drag = ganttDragRef.current;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
      if (!drag || drag.pointerId !== pointerId) return;
      finishGanttDragAt(upEvent.clientX);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  };

  const startGanttMouseDrag = (event: MouseEvent<HTMLElement>, record: BaseRecord, mode: 'move' | 'start' | 'end') => {
    if (activeView.locked || !ganttConfig.startDateFieldId || !ganttConfig.endDateFieldId) return;
    const start = readDate(record.fields[ganttConfig.startDateFieldId]);
    const end = readDate(record.fields[ganttConfig.endDateFieldId]);
    if (!start || !end) return;
    event.preventDefault();
    event.stopPropagation();
    ganttDragRef.current = { recordId: record.id, mode, pointerId: -1, originX: event.clientX, start, end };
    const handleMove = (moveEvent: globalThis.MouseEvent) => {
      const drag = ganttDragRef.current;
      if (!drag) return;
      const nextDraft = draftGanttAt(drag, moveEvent.clientX);
      ganttDraftRef.current = nextDraft;
      setGanttDraft(nextDraft);
    };
    const handleUp = (upEvent: globalThis.MouseEvent) => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      finishGanttDragAt(upEvent.clientX);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  const moveGanttDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = ganttDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const draft = draftGanttAt(drag, event.clientX);
    ganttDraftRef.current = draft;
    setGanttDraft(draft);
  };

  const endGanttDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = ganttDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    finishGanttDragAt(event.clientX);
  };

  const scheduleRecordAt = (recordId: string, start: Date) => {
    if (!ganttConfig.startDateFieldId || !ganttConfig.endDateFieldId || activeView.locked) return;
    mutate(current => updateRecord(current, recordId, record => {
      const next = withUpdatedValue(record, ganttConfig.startDateFieldId!, dateValue(start));
      return withUpdatedValue(next, ganttConfig.endDateFieldId!, dateValue(offsetDate(start, 3)));
    }));
  };

  const renderGantt = () => (
    <BitableGanttView
      table={table}
      config={ganttConfig}
      records={records}
      selectedIds={selectedIds}
      leftPanelCollapsed={leftPanelCollapsed}
      today={today}
      ganttOrigin={ganttOrigin}
      ganttDays={ganttDays}
      ganttMonthSpans={ganttMonthSpans}
      ganttDraft={ganttDraft}
      setLeftPanelCollapsed={setLeftPanelCollapsed}
      setGanttConfig={setGanttConfig}
      toggleAllRecordSelection={toggleAllRecordSelection}
      toggleRecordSelection={toggleRecordSelection}
      scheduleRecordAt={scheduleRecordAt}
      startGanttDrag={startGanttDrag}
      moveGanttDrag={moveGanttDrag}
      endGanttDrag={endGanttDrag}
      startGanttMouseDrag={startGanttMouseDrag}
      finishGanttDragAt={finishGanttDragAt}
      scrollToToday={scrollToToday}
      scrollTimeline={scrollTimeline}
      addRecord={() => addRecord()}
      scrollRef={ganttScrollRef}
    />
  );

  const renderKanban = () => {
    const statusField = galleryConfig.groupByFieldId
      ? table.fields.find(field => field.id === galleryConfig.groupByFieldId && field.type === 'single_select') ?? table.fields.find(field => field.type === 'single_select')
      : table.fields.find(field => field.type === 'single_select');
    const addRecordToColumn = (statusValue: string) => {
      const recordId = addRecord();
      if (statusValue && statusField) {
        changeCell(recordId, statusField.id, statusValue);
      }
      if (recordId) {
        setCardRecordId(recordId);
        selectionAnchorRef.current = recordId;
        setSelectedIds(new Set([recordId]));
      }
    };
    const changeRecordStatus = (recordId: string, statusValue: string) => {
      if (!statusField || activeView.locked) return;
      changeCell(recordId, statusField.id, statusValue);
    };
    const addGroup = () => {
      if (!statusField || activeView.locked) return;
      mutate(current => {
        const field = current.fields.find(item => item.id === statusField.id);
        if (!field) return current;
        const choices = field.options?.choices ?? [];
        let index = choices.length + 1;
        let name = `新分组 ${index}`;
        while (choices.some(choice => choice.name === name)) {
          index += 1;
          name = `新分组 ${index}`;
        }
        const colors = ['#dee8ff', '#f8e6c2', '#c7effb', '#e8f2d8', '#f0e7ff', '#ffe1e1'];
        const nextChoice = {
          id: `opt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
          name,
          color: colors[choices.length % colors.length],
        };
        return {
          ...current,
          fields: current.fields.map(item => item.id === field.id
            ? { ...item, options: { ...item.options, choices: [...choices, nextChoice] } }
            : item),
        };
      });
    };
    const renameGroup = (choiceId: string, name: string) => {
      if (!statusField || activeView.locked) return;
      mutate(current => {
        const field = current.fields.find(item => item.id === statusField.id);
        const choices = field?.options?.choices ?? [];
        const choice = choices.find(item => item.id === choiceId);
        const nextName = name.trim();
        if (!field || !choice || !nextName || choices.some(item => item.id !== choiceId && item.name === nextName)) return current;
        return {
          ...current,
          fields: current.fields.map(item => item.id === field.id
            ? { ...item, options: { ...item.options, choices: choices.map(option => option.id === choiceId ? { ...option, name: nextName } : option) } }
            : item),
          records: current.records.map(record => valueText(record.fields[field.id]) === choice.name
            ? withUpdatedValue(record, field.id, nextName, field.name)
            : record),
        };
      });
    };
    const deleteGroup = (choiceId: string) => {
      if (!statusField || activeView.locked) return;
      mutate(current => {
        const field = current.fields.find(item => item.id === statusField.id);
        const choices = field?.options?.choices ?? [];
        const choice = choices.find(item => item.id === choiceId);
        if (!field || !choice || choices.length <= 1) return current;
        return {
          ...current,
          fields: current.fields.map(item => item.id === field.id
            ? { ...item, options: { ...item.options, choices: choices.filter(option => option.id !== choiceId) } }
            : item),
          records: current.records.map(record => valueText(record.fields[field.id]) === choice.name
            ? withUpdatedValue(record, field.id, '', field.name)
            : record),
        };
      });
    };

    return (
      <BitableKanbanView
        table={table}
        config={galleryConfig}
        records={records}
        selectedRecordId={cardRecordId}
        locked={activeView.locked}
        addRecordToColumn={addRecordToColumn}
        changeRecordStatus={changeRecordStatus}
        openRecord={recordId => {
          setCardRecordId(recordId);
          selectionAnchorRef.current = recordId;
          setSelectedIds(new Set([recordId]));
        }}
        removeRecords={removeRecords}
        addGroup={addGroup}
        renameGroup={renameGroup}
        deleteGroup={deleteGroup}
      />
    );
  };

  const editingField = editingFieldPanel ? table.fields.find(field => field.id === editingFieldPanel.fieldId) : null;
  const cardRecord = cardRecordId ? table.records.find(record => record.id === cardRecordId) : null;
  const commentTargetRecord = commentTargetRecordId
    ? table.records.find(record => record.id === commentTargetRecordId) ?? null
    : null;
  const commentTargetRecordIndex = commentTargetRecord
    ? Math.max(0, records.findIndex(record => record.id === commentTargetRecord.id))
    : 0;
  const settingsLabel = viewSettingsLabel(activeView.type);
  const hierarchySettingsLabel = viewHierarchySettingsLabel(activeView.type);
  const useHierarchySettingsIcon = activeView.type === 'grid' || activeView.type === 'gantt';
  const gridRowHeight = (activeView.config as GridViewConfig).rowHeight || 'low';
  const useDocFloatToolbar = activeView.type === 'gallery' || activeView.type === 'kanban';
  const showDocFloatToolbar = isViewToolsVisible || showSettings || Boolean(activeToolbarPanel);
  const closeSettingsPanel = useCallback(() => setShowSettings(false), []);
  const closeActiveToolbarPanel = useCallback(() => setActiveToolbarPanel(null), []);
  const floatSettingsHover = useBitablePanelHoverHandlers(closeSettingsPanel, showSettings && useDocFloatToolbar);
  const docSettingsHover = useBitablePanelHoverHandlers(closeSettingsPanel, showSettings && !useDocFloatToolbar);
  const fieldsPanelHover = useBitablePanelHoverHandlers(closeActiveToolbarPanel, activeToolbarPanel === 'fields');
  const groupPanelHover = useBitablePanelHoverHandlers(closeActiveToolbarPanel, activeToolbarPanel === 'group');
  const filterPanelHover = useBitablePanelHoverHandlers(closeActiveToolbarPanel, activeToolbarPanel === 'filter');
  const sortPanelHover = useBitablePanelHoverHandlers(closeActiveToolbarPanel, activeToolbarPanel === 'sort');
  const sharePanelHover = useBitablePanelHoverHandlers(closeActiveToolbarPanel, activeToolbarPanel === 'share');
  const rowHeightPanelHover = useBitablePanelHoverHandlers(closeActiveToolbarPanel, activeToolbarPanel === 'rowHeight');

  useEffect(() => {
    if (cardRecordId && !table.records.some(record => record.id === cardRecordId)) setCardRecordId(null);
  }, [cardRecordId, table.records]);

  useEffect(() => {
    if (!commentPanelOpen || !gridFocusedRecordId) return;
    setCommentTargetRecordId(gridFocusedRecordId);
  }, [commentPanelOpen, gridFocusedRecordId]);

  useEffect(() => {
    if (commentTargetRecordId && !table.records.some(record => record.id === commentTargetRecordId)) {
      closeCommentPanel();
      setCommentTargetRecordId(null);
    }
  }, [closeCommentPanel, commentTargetRecordId, table.records]);

  useEffect(() => {
    if (!blockId) return;
    const handleOtherBitableOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ blockId?: string }>).detail;
      if (!detail?.blockId || detail.blockId === blockId) return;
      setCommentPanelOpen(false);
      setCommentTargetRecordId(null);
    };
    window.addEventListener(BITABLE_COMMENT_OPEN, handleOtherBitableOpen);
    return () => window.removeEventListener(BITABLE_COMMENT_OPEN, handleOtherBitableOpen);
  }, [blockId]);

  useEffect(() => {
    const handleCloseSidebar = () => {
      setCommentPanelOpen(false);
      setCommentTargetRecordId(null);
    };
    window.addEventListener(CLOSE_BITABLE_COMMENT_SIDEBAR, handleCloseSidebar);
    return () => window.removeEventListener(CLOSE_BITABLE_COMMENT_SIDEBAR, handleCloseSidebar);
  }, [blockId]);

  useEffect(() => {
    if (!commentPanelOpen || !commentTargetRecord || !blockId) return;
    dispatchBitableCommentMeta({
      blockId,
      recordId: commentTargetRecord.id,
      unresolvedCount: commentTargetRecord.comments?.length ?? 0,
    });
  }, [blockId, commentPanelOpen, commentTargetRecord]);

  const updateCommentCardTop = useCallback(() => {
    if (!commentPanelOpen || !commentTrackHost || !commentTargetRecord) return;
    const blockRect = blockRef.current?.getBoundingClientRect();
    const hostRect = commentTrackHost.getBoundingClientRect();
    if (!blockRect) return;
    const rowTop = activeView.type === 'grid'
      ? 52 + GRID_HEADER_HEIGHT + commentTargetRecordIndex * GRID_ROW_HEIGHT
      : 52;
    setCommentCardTop(blockRect.top - hostRect.top + rowTop);
  }, [activeView.type, commentPanelOpen, commentTargetRecord, commentTargetRecordIndex, commentTrackHost]);

  useLayoutEffect(() => {
    updateCommentCardTop();
  }, [updateCommentCardTop]);

  useEffect(() => {
    if (!blockId) return;
    const handleToggleSidebar = (event: Event) => {
      const detail = (event as CustomEvent<{ blockId?: string }>).detail;
      if (!detail?.blockId || detail.blockId !== blockId) return;
      requestAnimationFrame(() => updateCommentCardTop());
    };
    window.addEventListener(BITABLE_COMMENT_TOGGLE_SIDEBAR, handleToggleSidebar);
    return () => window.removeEventListener(BITABLE_COMMENT_TOGGLE_SIDEBAR, handleToggleSidebar);
  }, [blockId, updateCommentCardTop]);

  useEffect(() => {
    const el = blockRef.current;
    if (!el) return;
    const onExpandAll = () => setCollapsedGroups(new Set());
    const onOpenComment = () => openCommentPanel();
    el.addEventListener(BITABLE_BLOCK_EXPAND_ALL, onExpandAll);
    el.addEventListener(BITABLE_BLOCK_OPEN_COMMENT, onOpenComment);
    return () => {
      el.removeEventListener(BITABLE_BLOCK_EXPAND_ALL, onExpandAll);
      el.removeEventListener(BITABLE_BLOCK_OPEN_COMMENT, onOpenComment);
    };
  }, [openCommentPanel]);

  useEffect(() => {
    if (!commentPanelOpen) return;
    const workspace = document.querySelector<HTMLElement>('.doc-page-workspace');
    workspace?.addEventListener('scroll', updateCommentCardTop);
    window.addEventListener('resize', updateCommentCardTop);
    return () => {
      workspace?.removeEventListener('scroll', updateCommentCardTop);
      window.removeEventListener('resize', updateCommentCardTop);
    };
  }, [commentPanelOpen, updateCommentCardTop]);

  const bitableCommentPanel = commentPanelOpen && commentTargetRecord && commentTrackHost ? (
    <BitableRecordCommentPanel
      record={commentTargetRecord}
      recordIndex={commentTargetRecordIndex}
      cardTop={commentCardTop}
      locked={activeView.locked}
      onSubmit={content => addRecordComment(commentTargetRecord.id, content)}
    />
  ) : null;

  return (
    <NodeViewWrapper
      className={`feishu-bitable-block feishu-base-block${selected ? ' is-selected' : ''}${isViewToolsVisible ? ' is-view-tools-visible' : ''}${showSettings || showViewMenu || activeToolbarPanel || commentPanelOpen || cardRecordId ? ' is-panel-open' : ''}${commentPanelOpen ? ' is-comment-open' : ''}${cardRecordId ? ' is-card-open' : ''}`}
      {...blockAttrs(node.attrs)}
      data-base-view-type={activeView.type}
      ref={blockRef}
      contentEditable={false}
      onContextMenu={(event: React.MouseEvent) => event.stopPropagation()}
    >
      <div
        ref={viewHoverZoneRef}
        className="base-view-hover-zone"
        data-no-marquee-selection="true"
        onPointerEnter={showViewTools}
        onPointerLeave={handleViewHoverLeave}
      >
      <header className="base-viewbar bitable-toolbar-doc" data-no-marquee-selection="true">
        <div className="base-viewbar__page">
        <span className="base-viewbar__source" aria-hidden>✦</span>
        <span className="base-viewbar__app">{table.name}</span>
        <span className="base-viewbar__divider" />
        <div className={`base-view-title-group${isRenamingView ? ' is-renaming' : ''}`}>
          <div className="base-view-switcher" ref={viewMenuRef}>
            <button
              type="button"
              className={`base-viewbar__current${showViewMenu ? ' is-open' : ''}${isRenamingView ? ' is-renaming' : ''}`}
              onClick={() => {
                if (isRenamingView) return;
                setShowViewMenu(open => !open);
              }}
            >
              <span className="base-viewbar__view-icon" aria-hidden data-view-icon={activeView.type}>
                <ViewIcon type={activeView.type} />
              </span>
              {isRenamingView ? (
                <input
                  ref={renameInputRef}
                  className="base-viewbar__title-input"
                  value={renameDraft}
                  aria-label="视图名称"
                  onChange={event => setRenameDraft(event.target.value)}
                  onBlur={commitRenameView}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      commitRenameView();
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      cancelRenameView();
                    }
                  }}
                  onClick={event => event.stopPropagation()}
                  onMouseDown={event => event.stopPropagation()}
                />
              ) : (
                <span className="base-viewbar__title">
                  {activeView.name}
                  {activeView.locked ? ' 🔒' : ''}
                </span>
              )}
              {!isRenamingView && (
                <span className="base-viewbar__chevron" aria-hidden>
                  <SelGlyphChevronDown size={12} fill="currentColor" />
                </span>
              )}
            </button>
            {showViewMenu && (
              <ViewSidebarMenu
                views={table.views}
                activeViewId={activeView.id}
                renamingViewId={renamingViewId}
                renameDraft={renameDraft}
                renameInputRef={renameInputRef}
                dragOverIndex={dragOverIndex}
                draggingViewIndex={draggingViewIndex}
                contextMenuViewId={viewContextMenuId}
                contextMenuRef={viewContextMenuRef}
                canDeleteView={getVisibleViews(table).length > 1}
                onSelectView={setView}
                onCreateView={createView}
                onOpenContextMenu={openViewContextMenu}
                onRenameView={viewId => beginRenameView(viewId, true)}
                onRemoveView={removeView}
                onRenameDraftChange={setRenameDraft}
                onCommitRename={commitRenameView}
                onCancelRename={cancelRenameView}
                onDragStart={handleViewDragStart}
                onDragOver={handleViewDragOver}
                onDrop={handleViewDrop}
                onDragEnd={handleViewDragEnd}
              />
            )}
          </div>
          {!isRenamingView && !activeView.locked && (
            <BitableTooltip tip="重命名" placement="bottom">
              <button
                type="button"
                className="base-viewbar__rename"
                aria-label="重命名视图"
                onClick={startRenameView}
              >
                <ToolGlyphRename />
              </button>
            </BitableTooltip>
          )}
        </div>
        </div>

        {useDocFloatToolbar ? (
        <div className={`bitable-float-toolbar-wrapper${showDocFloatToolbar ? ' show' : ''}`}>
          <div className="bitable-float-toolbar-list">
            <div className="bitable-float-toolbar-btn-field">
              <div
                className={`bitable-float-toolbar-btn-wrapper${showSettings ? ' is-panel-open' : ''}`}
                {...floatSettingsHover}
              >
                <BitableTooltip tip={settingsLabel} placement="bottom">
                  <button
                    type="button"
                    className={`bitable-float-toolbar-btn editable${showSettings ? ' selected' : ''}`}
                    aria-label={settingsLabel}
                    onClick={() => {
                      setActiveToolbarPanel(null);
                      setShowSettings(open => !open);
                    }}
                  >
                    <div className="bitable-float-toolbar-btn-background" />
                    <span className="universe-icon bitable-float-toolbar-btn-icon bitable-float-toolbar-btn-icon-field">
                      <ToolGlyphSettings />
                    </span>
                  </button>
                </BitableTooltip>
                {showSettings && (activeView.type === 'gallery' || activeView.type === 'kanban') && (
                  <GalleryFieldCustomizePanel
                    variant={activeView.type === 'kanban' ? 'kanban' : 'gallery'}
                    panelRef={settingsRef}
                    table={table}
                    view={activeView}
                    config={galleryConfig}
                    onConfig={activeView.type === 'kanban' ? setKanbanConfig : setGalleryConfig}
                    onEditField={editField}
                    onDeleteField={removeField}
                    onReorderFields={reorderFields}
                    onAddField={openAddFieldPanel}
                  />
                )}
              </div>
            </div>
            {activeView.type === 'kanban' && (
            <div className="bitable-float-toolbar-kanban-group-btn">
              <div
                className={`bitable-float-toolbar-btn-wrapper${activeToolbarPanel === 'group' ? ' is-panel-open' : ''}`}
                {...groupPanelHover}
              >
                <BitableTooltip tip="分组" placement="bottom">
                  <button
                    type="button"
                    className="bitable-float-toolbar-btn editable"
                    aria-label="分组"
                    onClick={() => openToolbarPanel('group')}
                  >
                    <div className="bitable-float-toolbar-btn-background" />
                    <span className="universe-icon bitable-float-toolbar-btn-icon bitable-float-toolbar-btn-icon-kanban-group">
                      <ToolGlyphKanbanGroup />
                    </span>
                  </button>
                </BitableTooltip>
                {activeToolbarPanel === 'group' && (
                  <KanbanGroupMenuPanel
                    panelRef={toolbarPanelRef}
                    table={table}
                    view={activeView}
                    config={galleryConfig}
                    onTable={mutate}
                  />
                )}
              </div>
            </div>
            )}
            {activeView.type === 'gallery' && (
            <div className="bitable-float-toolbar-kanban-group-btn">
              <div
                className={`bitable-float-toolbar-btn-wrapper${activeToolbarPanel === 'group' ? ' is-panel-open' : ''}`}
                {...groupPanelHover}
              >
                <BitableTooltip tip="分组" placement="bottom">
                  <button
                    type="button"
                    className={`bitable-float-toolbar-btn editable${galleryConfig.groupByFieldId ? ' selected' : ''}`}
                    aria-label="分组"
                    onClick={() => openToolbarPanel('group')}
                  >
                    <div className="bitable-float-toolbar-btn-background" />
                    <span className="universe-icon bitable-float-toolbar-btn-icon bitable-float-toolbar-btn-icon-kanban-group">
                      <ToolGlyphKanbanGroup />
                    </span>
                  </button>
                </BitableTooltip>
                {activeToolbarPanel === 'group' && (
                  <ViewGroupMenuPanel
                    panelRef={toolbarPanelRef}
                    table={table}
                    view={activeView}
                    config={galleryConfig}
                    onTable={mutate}
                  />
                )}
              </div>
            </div>
            )}
            <div className="bitable-float-toolbar-btn-filter">
              <div
                className={`bitable-float-toolbar-btn-wrapper${activeToolbarPanel === 'filter' ? ' is-panel-open' : ''}`}
                {...filterPanelHover}
              >
                <BitableTooltip tip="筛选" placement="bottom">
                  <button
                    type="button"
                    className={`bitable-float-toolbar-btn editable${activeToolbarPanel === 'filter' || hasActiveFilters ? ' selected' : ''}`}
                    aria-label="筛选"
                    onClick={() => openToolbarPanel('filter')}
                  >
                    <div className="bitable-float-toolbar-btn-background" />
                    <span className={`universe-icon bitable-float-toolbar-btn-icon${activeToolbarPanel === 'filter' || hasActiveFilters ? ' bitable-float-toolbar-btn-active' : ''}`}>
                      <ToolGlyphFilter />
                    </span>
                  </button>
                </BitableTooltip>
                {activeToolbarPanel === 'filter' && (
                  <ToolbarQuickPanel
                    panel="filter"
                    table={table}
                    view={activeView}
                    records={records}
                    panelRef={toolbarPanelRef}
                    onClose={() => setActiveToolbarPanel(null)}
                    onTable={mutate}
                  />
                )}
              </div>
            </div>
            <div className="bitable-float-toolbar-btn-sort">
              <div
                className={`bitable-float-toolbar-btn-wrapper${activeToolbarPanel === 'sort' ? ' is-panel-open' : ''}`}
                {...sortPanelHover}
              >
                <BitableTooltip tip="排序" placement="bottom">
                  <button
                    type="button"
                    className={`bitable-float-toolbar-btn editable${activeToolbarPanel === 'sort' || hasSortRules ? ' selected' : ''}`}
                    aria-label="排序"
                    onClick={() => openToolbarPanel('sort')}
                  >
                    <div className="bitable-float-toolbar-btn-background" />
                    <span className={`universe-icon bitable-float-toolbar-btn-icon${activeToolbarPanel === 'sort' || hasSortRules ? ' bitable-float-toolbar-btn-active' : ''}`}>
                      <ToolGlyphSort />
                    </span>
                  </button>
                </BitableTooltip>
                {activeToolbarPanel === 'sort' && (
                  <SortConfigPanel
                    panelRef={toolbarPanelRef}
                    table={table}
                    view={activeView}
                    onTable={mutate}
                  />
                )}
              </div>
            </div>
            <div className="bitable-doc-float-toolbar-separator" aria-hidden />
            <div
              className={`bitable-float-toolbar-btn-wrapper${activeToolbarPanel === 'share' ? ' is-panel-open' : ''}`}
              {...sharePanelHover}
            >
              <BitableTooltip tip="在新窗口打开" placement="bottom">
                <button
                  type="button"
                  className={`bitable-float-toolbar-btn editable${activeToolbarPanel === 'share' ? ' selected' : ''}`}
                  aria-label="在新窗口打开"
                  onClick={() => openToolbarPanel('share')}
                >
                  <div className="bitable-float-toolbar-btn-background" />
                  <span className="universe-icon bitable-float-toolbar-btn-icon">
                    <ToolGlyphShare />
                  </span>
                </button>
              </BitableTooltip>
              {activeToolbarPanel === 'share' && (
                <ToolbarQuickPanel
                  panel="share"
                  table={table}
                  view={activeView}
                  records={records}
                  panelRef={toolbarPanelRef}
                  onClose={() => setActiveToolbarPanel(null)}
                  onTable={mutate}
                />
              )}
            </div>
          </div>
        </div>
        ) : (
        <div className="base-viewbar__tools">
          <span
            className={`base-viewbar__tool-anchor${activeToolbarPanel === 'fields' ? ' is-panel-open' : ''}`}
            ref={fieldPanelAnchorRef}
            {...fieldsPanelHover}
          >
            <BitableTooltip tip="字段配置" placement="bottom">
              <button
                type="button"
                className={`base-viewbar__tool${activeToolbarPanel === 'fields' ? ' is-active' : ''}`}
                aria-label="字段配置"
                onClick={() => openToolbarPanel('fields')}
              >
                <ToolGlyphSettings />
              </button>
            </BitableTooltip>
            {activeToolbarPanel === 'fields' && (
              <FieldConfigPanel
                table={table}
                view={activeView}
                panelRef={settingsRef}
                onTable={mutate}
                onCreateField={createField}
                onEditField={editField}
                onDeleteField={removeField}
                onReorderFields={reorderFields}
              />
            )}
          </span>
          <span
            className={`base-viewbar__tool-anchor${showSettings && (activeView.type === 'grid' || activeView.type === 'gantt') ? ' is-panel-open' : ''}`}
            {...docSettingsHover}
          >
            <BitableTooltip tip={useHierarchySettingsIcon ? hierarchySettingsLabel : settingsLabel} placement="bottom">
              <button
                type="button"
                className={`base-viewbar__tool${showSettings ? ' is-active' : ''}`}
                aria-label={useHierarchySettingsIcon ? hierarchySettingsLabel : settingsLabel}
                onClick={() => {
                  setActiveToolbarPanel(null);
                  setShowSettings(open => !open);
                }}
              >
                {useHierarchySettingsIcon ? <ToolGlyphGantt /> : <SlashGlyphBitableGrid size={16} fill="currentColor" />}
              </button>
            </BitableTooltip>
            {showSettings && activeView.type === 'grid' && (
              <HierarchySettingsPanel
                table={table}
                view={activeView}
                panelRef={settingsRef}
                onTable={mutate}
              />
            )}
            {showSettings && activeView.type === 'gantt' && (
              <GanttSettings
                table={table}
                view={activeView}
                config={ganttConfig}
                panelRef={settingsRef}
                onClose={() => setShowSettings(false)}
                onConfig={setGanttConfig}
                onTable={mutate}
              />
            )}
          </span>
          <span
            className={`base-viewbar__tool-anchor${activeToolbarPanel === 'filter' ? ' is-panel-open' : ''}`}
            {...filterPanelHover}
          >
            <BitableTooltip tip="筛选" placement="bottom">
              <button type="button" className={`base-viewbar__tool${activeToolbarPanel === 'filter' || hasActiveFilters ? ' is-active' : ''}`} aria-label="筛选" onClick={() => openToolbarPanel('filter')}><ToolGlyphFilter /></button>
            </BitableTooltip>
            {activeToolbarPanel === 'filter' && (
              <ToolbarQuickPanel
                panel="filter"
                table={table}
                view={activeView}
                records={records}
                panelRef={toolbarPanelRef}
                onClose={() => setActiveToolbarPanel(null)}
                onTable={mutate}
              />
            )}
          </span>
          <span
            className={`base-viewbar__tool-anchor${activeToolbarPanel === 'group' ? ' is-panel-open' : ''}`}
            {...groupPanelHover}
          >
            <BitableTooltip tip="分组" placement="bottom">
              <button type="button" className={`base-viewbar__tool${activeToolbarPanel === 'group' || hasActiveGroups ? ' is-active' : ''}`} aria-label="分组" onClick={() => openToolbarPanel('group')}>
                <ToolGlyphGroup />
                {activeGroupCount > 0 && <span className="base-viewbar__tool-badge">{activeGroupCount}</span>}
              </button>
            </BitableTooltip>
            {activeToolbarPanel === 'group' && activeView.type === 'grid' && (
              <GridGroupConfigPanel
                panelRef={toolbarPanelRef}
                table={table}
                view={activeView}
                onTable={mutate}
              />
            )}
            {activeToolbarPanel === 'group' && activeView.type !== 'grid' && (
              <ToolbarQuickPanel
                panel="group"
                table={table}
                view={activeView}
                records={records}
                panelRef={toolbarPanelRef}
                onClose={() => setActiveToolbarPanel(null)}
                onTable={mutate}
              />
            )}
          </span>
          <span
            className={`base-viewbar__tool-anchor${activeToolbarPanel === 'sort' ? ' is-panel-open' : ''}`}
            {...sortPanelHover}
          >
            <BitableTooltip tip="排序" placement="bottom">
              <button type="button" className={`base-viewbar__tool${activeToolbarPanel === 'sort' || hasSortRules ? ' is-active' : ''}`} aria-label="排序" onClick={() => openToolbarPanel('sort')}>
                <ToolGlyphSort />
                {activeSortCount > 0 && <span className="base-viewbar__tool-badge">{activeSortCount}</span>}
              </button>
            </BitableTooltip>
            {activeToolbarPanel === 'sort' && (
              <SortConfigPanel
                panelRef={toolbarPanelRef}
                table={table}
                view={activeView}
                onTable={mutate}
              />
            )}
          </span>
          {activeView.type === 'grid' && (
            <span
              className={`base-viewbar__tool-anchor${activeToolbarPanel === 'rowHeight' ? ' is-panel-open' : ''}`}
              {...rowHeightPanelHover}
            >
              <BitableTooltip tip="行高" placement="bottom">
                <button
                  type="button"
                  className={`base-viewbar__tool${activeToolbarPanel === 'rowHeight' || gridRowHeight !== 'low' ? ' is-active' : ''}`}
                  aria-label="行高"
                  onClick={() => openToolbarPanel('rowHeight')}
                >
                  <ToolGlyphRowHeight />
                </button>
              </BitableTooltip>
              {activeToolbarPanel === 'rowHeight' && (
                <ToolbarQuickPanel
                  panel="rowHeight"
                  table={table}
                  view={activeView}
                  records={records}
                  panelRef={toolbarPanelRef}
                  onClose={() => setActiveToolbarPanel(null)}
                  onTable={mutate}
                />
              )}
            </span>
          )}
          <span className="base-viewbar__tool-sep" aria-hidden />
          <BitableTooltip tip="评论" placement="bottom">
            <button type="button" className={`base-viewbar__tool${commentPanelOpen ? ' is-active' : ''}`} aria-label="评论" onClick={toggleCommentPanel}><ToolGlyphComment /></button>
          </BitableTooltip>
          <span className="base-viewbar__tool-sep" aria-hidden />
          <span
            className={`base-viewbar__tool-anchor${activeToolbarPanel === 'share' ? ' is-panel-open' : ''}`}
            {...sharePanelHover}
          >
            <BitableTooltip tip="在新窗口打开" placement="bottom">
              <button type="button" className={`base-viewbar__tool${activeToolbarPanel === 'share' ? ' is-active' : ''}`} aria-label="分享" onClick={() => openToolbarPanel('share')}><ToolGlyphShare /></button>
            </BitableTooltip>
            {activeToolbarPanel === 'share' && (
              <ToolbarQuickPanel
                panel="share"
                table={table}
                view={activeView}
                records={records}
                panelRef={toolbarPanelRef}
                onClose={() => setActiveToolbarPanel(null)}
                onTable={mutate}
              />
            )}
          </span>
        </div>
        )}
      </header>
      <div className="base-view-content" data-no-marquee-selection="true" onMouseDown={event => event.stopPropagation()}>
        {activeView.type === 'gallery' ? renderGallery() : activeView.type === 'gantt' ? renderGantt() : activeView.type === 'kanban' ? renderKanban() : renderGrid()}
      </div>
      </div>
      {bitableCommentPanel && commentTrackHost && createPortal(bitableCommentPanel, commentTrackHost)}
      {deleteViewTarget && (
        <DeleteViewDialog
          viewName={deleteViewTarget.name}
          onCancel={() => setDeleteViewTarget(null)}
          onConfirm={confirmDeleteView}
        />
      )}
      {pendingDeleteRecordIds && (
        <DeleteRecordsDialog
          count={pendingDeleteRecordIds.length}
          onCancel={() => setPendingDeleteRecordIds(null)}
          onConfirm={confirmDeleteRecords}
        />
      )}
      {addFieldPanel && createPortal(
        <div
          className="base-field-edit-popover-portal"
          style={{
            left: Math.min(addFieldPanel.left, Math.max(8, window.innerWidth - 336)),
            top: Math.min(addFieldPanel.top, Math.max(8, window.innerHeight - 520)),
          }}
          data-no-marquee-selection="true"
          data-floating-panel="true"
        >
          <BitableAddFieldPopover
            defaultName={nextAutoFieldName(table.fields)}
            onCancel={() => setAddFieldPanel(null)}
            onConfirm={input => {
              createField(input);
              setAddFieldPanel(null);
            }}
          />
        </div>,
        document.body,
      )}
      {editingFieldPanel && editingField && createPortal(
        <div
          className="base-field-edit-popover-portal"
          style={{
            left: Math.min(editingFieldPanel.left, Math.max(8, window.innerWidth - 336)),
            top: Math.min(editingFieldPanel.top, Math.max(8, window.innerHeight - 420)),
          }}
          data-no-marquee-selection="true"
          data-floating-panel="true"
        >
          <BitableEditFieldPopover
            field={editingField}
            onCancel={() => setEditingFieldPanel(null)}
            onConfirm={input => updateFieldConfig(editingField.id, input)}
          />
        </div>,
        document.body,
      )}
      {cardRecord && createPortal(
        <BitableRecordCardModal
          table={table}
          activeView={activeView}
          record={cardRecord}
          records={records}
          locked={activeView.locked}
          onClose={() => setCardRecordId(null)}
          onChange={changeCell}
          onNavigate={setCardRecordId}
          onDelete={recordId => {
            if (removeRecords([recordId], true)) {
              setCardRecordId(null);
            }
          }}
          onAddField={() => openAddFieldPanel()}
          onUploadAttachment={(recordId, fieldId, files) => {
            files.forEach(file => uploadAttachment(recordId, file, fieldId));
          }}
        />,
        document.body,
      )}
    </NodeViewWrapper>
  );
}

function FieldConfigPanel({
  table,
  view,
  panelRef,
  onTable,
  onCreateField,
  onEditField,
  onDeleteField,
  onReorderFields,
}: {
  table: BaseTable;
  view: BaseView;
  panelRef: RefObject<HTMLDivElement>;
  onTable: (update: (table: BaseTable) => BaseTable) => void;
  onCreateField: (input: CreateFieldInput) => void;
  onEditField: (fieldId: string) => void;
  onDeleteField: (fieldId: string) => void;
  onReorderFields: (fromIndex: number, toIndex: number) => void;
}) {
  const [fieldMoreId, setFieldMoreId] = useState<string | null>(null);
  const [fieldMoreAnchor, setFieldMoreAnchor] = useState<HTMLElement | null>(null);
  const [showAddField, setShowAddField] = useState(false);
  const [draggingFieldIndex, setDraggingFieldIndex] = useState<number | null>(null);
  const [dragOverFieldIndex, setDragOverFieldIndex] = useState<number | null>(null);
  const fieldListRef = useRef<HTMLUListElement>(null);
  const fieldDragFromRef = useRef<number | null>(null);
  const fieldDragGhostRef = useRef<HTMLDivElement | null>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const hiddenFieldIds = new Set(view.hiddenFieldIds || []);
  const canDeleteField = table.fields.length > 1;

  const updateCurrentView = (update: (current: BaseView) => BaseView) => {
    if (view.locked) return;
    onTable(current => updateView(current, view.id, update));
  };

  const toggleFieldVisible = (fieldId: string) => {
    if (view.locked || fieldId === table.primaryFieldId) return;
    updateCurrentView(item => {
      const hidden = new Set(item.hiddenFieldIds || []);
      if (hidden.has(fieldId)) hidden.delete(fieldId);
      else hidden.add(fieldId);
      return { ...item, hiddenFieldIds: Array.from(hidden) };
    });
  };

  const openFieldMoreMenu = (btn: HTMLElement, fieldId: string) => {
    if (fieldMoreId === fieldId) {
      setFieldMoreId(null);
      setFieldMoreAnchor(null);
      return;
    }
    setFieldMoreId(fieldId);
    setFieldMoreAnchor(btn);
    btn.focus();
  };

  const closeFieldMoreMenu = () => {
    setFieldMoreId(null);
    setFieldMoreAnchor(null);
  };

  useEffect(() => {
    if (!fieldMoreId) return;
    const close = (event: globalThis.MouseEvent) => {
      if (!(event.target instanceof Node)) return;
      if (moreMenuRef.current?.contains(event.target)) return;
      if (fieldMoreAnchor?.contains(event.target)) return;
      closeFieldMoreMenu();
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [fieldMoreId, fieldMoreAnchor]);

  const resolveFieldDropIndex = (clientY: number) => {
    const list = fieldListRef.current;
    if (!list) return null;
    const rows = list.querySelectorAll<HTMLElement>('.base-view-sidebar__item');
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) return i;
    }
    return rows.length > 0 ? rows.length - 1 : null;
  };

  const handleFieldDragStart = (event: DragEvent, index: number) => {
    if (view.locked || table.fields[index]?.id === table.primaryFieldId) return;
    fieldDragFromRef.current = index;
    setDraggingFieldIndex(index);
    setDragOverFieldIndex(null);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
    if (!fieldDragGhostRef.current) {
      const ghost = document.createElement('div');
      ghost.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
      document.body.appendChild(ghost);
      fieldDragGhostRef.current = ghost;
    }
    event.dataTransfer.setDragImage(fieldDragGhostRef.current, 0, 0);
  };

  const handleFieldListDragOver = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (view.locked || fieldDragFromRef.current == null) return;
    event.dataTransfer.dropEffect = 'move';
    const index = resolveFieldDropIndex(event.clientY);
    if (index == null || table.fields[index]?.id === table.primaryFieldId) {
      setDragOverFieldIndex(null);
      return;
    }
    if (fieldDragFromRef.current === index) {
      setDragOverFieldIndex(null);
      return;
    }
    setDragOverFieldIndex(index);
  };

  const handleFieldListDrop = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const fromIndex = fieldDragFromRef.current ?? draggingFieldIndex ?? Number(event.dataTransfer.getData('text/plain'));
    const toIndex = resolveFieldDropIndex(event.clientY);
    fieldDragFromRef.current = null;
    setDraggingFieldIndex(null);
    setDragOverFieldIndex(null);
    if (toIndex == null || Number.isNaN(fromIndex) || fromIndex === toIndex) return;
    if (table.fields[toIndex]?.id === table.primaryFieldId) return;
    onReorderFields(fromIndex, toIndex);
  };

  const handleFieldDragEnd = () => {
    fieldDragFromRef.current = null;
    setDraggingFieldIndex(null);
    setDragOverFieldIndex(null);
  };

  const listMaxHeight = Math.min(280, Math.max(36, table.fields.length * 36 + 8));
  const defaultNewFieldName = useMemo(() => nextAutoFieldName(table.fields), [table.fields]);

  const openAddField = () => {
    if (view.locked) return;
    closeFieldMoreMenu();
    setShowAddField(true);
  };

  const fieldMoreTarget = fieldMoreId ? table.fields.find(field => field.id === fieldMoreId) : null;

  return (
    <div
      ref={panelRef}
      className={`base-field-panel-stack${fieldMoreId || showAddField ? ' is-menu-open' : ''}`}
      data-no-marquee-selection="true"
      data-floating-panel="true"
      onMouseDown={event => event.stopPropagation()}
    >
      <div
        className="base-field-panel"
        data-e2e="bitable-field-customize-panel"
        role="dialog"
        aria-label="字段配置"
      >
      <span className="base-field-panel__arrow" aria-hidden />
      <div className="base-field-panel__title-wrap">
        <div className="base-field-panel__title">
          <span>字段配置</span>
          <span className="base-field-panel__help" title="配置当前视图显示的字段" aria-hidden><GlyphHelp size={14} /></span>
        </div>
      </div>
      <div className="base-field-panel__divider" />
      <div className="base-field-panel__list" style={{ maxHeight: listMaxHeight }}>
        <ul
          ref={fieldListRef}
          className={`base-view-sidebar__list${draggingFieldIndex != null ? ' is-sorting' : ''}`}
          onDragOver={handleFieldListDragOver}
          onDrop={handleFieldListDrop}
        >
          {table.fields.map((field, index) => {
            const isPrimary = field.id === table.primaryFieldId;
            const isVisible = !hiddenFieldIds.has(field.id);
            const fieldCanDelete = canDeleteField && !isPrimary;
            return (
              <li
                key={field.id}
                className={[
                  'base-view-sidebar__item',
                  draggingFieldIndex === index ? 'is-dragging' : '',
                  dragOverFieldIndex === index && draggingFieldIndex !== index ? 'is-drag-over' : '',
                ].filter(Boolean).join(' ')}
              >
                {isPrimary ? (
                  <span className="base-view-sidebar__drag is-locked" aria-hidden>
                    <FieldLockGlyph size={14} />
                  </span>
                ) : (
                  <span
                    className="base-view-sidebar__drag"
                    draggable={!view.locked}
                    aria-hidden
                    onDragStart={event => handleFieldDragStart(event, index)}
                    onDragEnd={handleFieldDragEnd}
                  >
                    <GlyphDrag />
                  </span>
                )}
                <span className="base-view-sidebar__icon" aria-hidden>
                  {fieldTypeGlyph(field.type, 14)}
                </span>
                <span className="base-view-sidebar__name base-field-panel__label">{field.name}</span>
                {!isPrimary && (
                  <button
                    type="button"
                    className={`base-view-sidebar__more base-field-panel__visible${isVisible ? '' : ' is-hidden'}`}
                    aria-label={isVisible ? '隐藏字段' : '显示字段'}
                    disabled={view.locked}
                    onMouseDown={event => event.stopPropagation()}
                    onClick={() => toggleFieldVisible(field.id)}
                  >
                    <GlyphVisible size={14} />
                  </button>
                )}
                {!view.locked && (
                  <button
                    type="button"
                    className={`base-view-sidebar__more${fieldMoreId === field.id ? ' is-open' : ''}`}
                    aria-label="鏇村鎿嶄綔"
                    onMouseDown={event => {
                      event.stopPropagation();
                      event.preventDefault();
                      openFieldMoreMenu(event.currentTarget, field.id);
                    }}
                  >
                    <GlyphMore />
                  </button>
                )}
                {isPrimary && index === 0 && table.fields.length > 1 && <div className="base-field-panel__frozen-divider" />}
              </li>
            );
          })}
        </ul>
      </div>
      <button
        type="button"
        className={`base-field-panel__add${showAddField ? ' is-active' : ''}`}
        disabled={view.locked}
        onClick={openAddField}
      >
        <GlyphAdd size={14} />
        <span>新增字段</span>
      </button>
      </div>
      {showAddField && (
        <BitableAddFieldPopover
          defaultName={defaultNewFieldName}
          onCancel={() => setShowAddField(false)}
          onConfirm={input => {
            onCreateField(input);
            setShowAddField(false);
          }}
        />
      )}
      {fieldMoreId && fieldMoreAnchor && fieldMoreTarget && (
        <FloatingItemRowMenu
          anchor={fieldMoreAnchor}
          menuRef={moreMenuRef}
          canDelete={canDeleteField && fieldMoreTarget.id !== table.primaryFieldId}
          onEdit={() => {
            closeFieldMoreMenu();
            onEditField(fieldMoreTarget.id);
          }}
          onDelete={() => {
            if (!canDeleteField || fieldMoreTarget.id === table.primaryFieldId) return;
            if (!window.confirm(`确认删除字段「${fieldMoreTarget.name}」？`)) return;
            closeFieldMoreMenu();
            onDeleteField(fieldMoreTarget.id);
          }}
        />
      )}
    </div>
  );
}

function GalleryFieldCustomizePanel({
  variant = 'gallery',
  panelRef,
  table,
  view,
  config,
  onConfig,
  onEditField,
  onDeleteField,
  onReorderFields,
  onAddField,
}: {
  variant?: 'gallery' | 'kanban';
  panelRef: RefObject<HTMLDivElement>;
  table: BaseTable;
  view: BaseView;
  config: GalleryViewConfig;
  onConfig: (patch: Partial<GalleryViewConfig>) => void;
  onEditField: (fieldId: string) => void;
  onDeleteField: (fieldId: string) => void;
  onReorderFields: (fromIndex: number, toIndex: number) => void;
  onAddField: (anchor?: { left: number; top: number }) => void;
}) {
  const isKanban = variant === 'kanban';
  const settingPrefix = isKanban ? 'kanban-setting-item' : 'gallery-setting-item';
  const [fieldMoreId, setFieldMoreId] = useState<string | null>(null);
  const [fieldMoreAnchor, setFieldMoreAnchor] = useState<HTMLElement | null>(null);
  const [coverOpen, setCoverOpen] = useState(false);
  const [draggingFieldIndex, setDraggingFieldIndex] = useState<number | null>(null);
  const [dragOverFieldIndex, setDragOverFieldIndex] = useState<number | null>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  const fieldListRef = useRef<HTMLDivElement>(null);
  const fieldDragFromRef = useRef<number | null>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const titleFieldId = config.titleFieldId || table.primaryFieldId;
  const attachmentFields = table.fields.filter(field => field.type === 'attachment');
  const cardLayoutMode = config.cardLayoutMode || 'regular';
  const hasCover = Boolean(config.coverFieldId);
  const coverField = table.fields.find(field => field.id === config.coverFieldId) ?? null;
  const coverLabel = hasCover ? (coverField?.name || '附件') : '无封面';
  const canDeleteField = table.fields.length > 1;
  const listHeight = Math.min(240, Math.max(36, table.fields.length * 36));
  const innerHeight = table.fields.length * 36;

  const isFieldVisibleOnCard = (fieldId: string) => (
    fieldId === titleFieldId || config.visibleFieldIds.includes(fieldId)
  );

  const toggleFieldVisible = (fieldId: string) => {
    if (view.locked || fieldId === titleFieldId) return;
    const visible = new Set(config.visibleFieldIds);
    if (visible.has(fieldId)) visible.delete(fieldId);
    else visible.add(fieldId);
    onConfig({ visibleFieldIds: Array.from(visible) });
  };

  const openFieldMoreMenu = (btn: HTMLElement, fieldId: string) => {
    if (fieldMoreId === fieldId) {
      setFieldMoreId(null);
      setFieldMoreAnchor(null);
      return;
    }
    setFieldMoreId(fieldId);
    setFieldMoreAnchor(btn);
    btn.focus();
  };

  const closeFieldMoreMenu = () => {
    setFieldMoreId(null);
    setFieldMoreAnchor(null);
  };

  useEffect(() => {
    if (!fieldMoreId) return;
    const close = (event: globalThis.MouseEvent) => {
      if (!(event.target instanceof Node)) return;
      if (moreMenuRef.current?.contains(event.target)) return;
      if (fieldMoreAnchor?.contains(event.target)) return;
      closeFieldMoreMenu();
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [fieldMoreId, fieldMoreAnchor]);

  useEffect(() => {
    if (!coverOpen) return;
    const close = (event: globalThis.PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (coverRef.current?.contains(event.target)) return;
      setCoverOpen(false);
    };
    document.addEventListener('pointerdown', close, true);
    return () => document.removeEventListener('pointerdown', close, true);
  }, [coverOpen]);

  const resolveFieldDropIndex = (clientY: number) => {
    const list = fieldListRef.current;
    if (!list) return null;
    const rows = list.querySelectorAll<HTMLElement>('.bitable-field__fields__field-wrap');
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) return i;
    }
    return rows.length > 0 ? rows.length - 1 : null;
  };

  const handleFieldDragStart = (event: DragEvent, index: number) => {
    if (view.locked || table.fields[index]?.id === titleFieldId) return;
    fieldDragFromRef.current = index;
    setDraggingFieldIndex(index);
    setDragOverFieldIndex(null);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
  };

  const handleFieldListDragOver = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (view.locked || fieldDragFromRef.current == null) return;
    event.dataTransfer.dropEffect = 'move';
    const index = resolveFieldDropIndex(event.clientY);
    if (index == null || table.fields[index]?.id === titleFieldId) {
      setDragOverFieldIndex(null);
      return;
    }
    if (fieldDragFromRef.current === index) {
      setDragOverFieldIndex(null);
      return;
    }
    setDragOverFieldIndex(index);
  };

  const handleFieldListDrop = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const fromIndex = fieldDragFromRef.current ?? draggingFieldIndex ?? Number(event.dataTransfer.getData('text/plain'));
    const toIndex = resolveFieldDropIndex(event.clientY);
    fieldDragFromRef.current = null;
    setDraggingFieldIndex(null);
    setDragOverFieldIndex(null);
    if (toIndex == null || Number.isNaN(fromIndex) || fromIndex === toIndex) return;
    if (table.fields[toIndex]?.id === titleFieldId) return;
    onReorderFields(fromIndex, toIndex);
  };

  const handleFieldDragEnd = () => {
    fieldDragFromRef.current = null;
    setDraggingFieldIndex(null);
    setDragOverFieldIndex(null);
  };

  const fieldMoreTarget = fieldMoreId ? table.fields.find(field => field.id === fieldMoreId) : null;

  return (
    <>
      <div
        ref={panelRef}
        className="bitable-field"
        data-e2e="bitable-field-customize-panel"
        data-no-marquee-selection="true"
        data-floating-panel="true"
        onMouseDown={event => event.stopPropagation()}
      >
        <div className="bitable-float-toolbar-btn-arrow" aria-hidden />
        {isKanban && (
          <div className="bitable-field__title-wrap">
            <div className="bitable-noselect bitable-field__title bitable-field__item">
              <span>
                卡片配置
                <span className="bitable-guide-video-container" title="配置看板卡片展示内容">
                  <i className="bitable-guide-video-icon active">
                    <span className="universe-icon"><GlyphHelp size={14} /></span>
                  </i>
                </span>
              </span>
            </div>
          </div>
        )}
        <div className="bitable-common-card-config">
          <div className={`${isKanban ? 'bitable-kanban-card-config' : 'bitable-gallery-card-config'}${view.locked ? ' select-disabled' : ''}`}>
            <div className={`${settingPrefix}_setting_item_wrapper field-setting-item_wrapper`}>
              <div className={`${settingPrefix}_setting_item field-setting-item${isKanban ? ' has-divider' : ''}`}>
                <span className={`${settingPrefix}__field-setting-name ellipsis table-view-config-item__label`}>封面内容</span>
                <div className={`${settingPrefix}__field-setting-children`}>
                  <div className={`bitable-dropdown-select__wrapper${coverOpen ? ' is-open' : ''}`} ref={coverRef}>
                    <div className={`bitable-select-trigger__wrapper ${isKanban ? 'bitable-dropdown-kanban' : 'bitable-dropdown-gallery'}`}>
                      <button
                        type="button"
                        className="bitable-select-trigger__trigger"
                        disabled={view.locked || (!isKanban && !attachmentFields.length)}
                        aria-expanded={coverOpen}
                        onClick={() => setCoverOpen(open => !open)}
                      >
                        <span className="bitable-select-trigger__icon">
                          <span className="universe-icon">{hasCover ? <GlyphAttachment /> : <GlyphBan />}</span>
                        </span>
                        <span className="bitable-select-trigger__content">{isKanban ? coverLabel : (coverField?.name || '附件')}</span>
                        <span className="bitable-select-trigger__arrow">
                          <span className="universe-icon"><GlyphDownBold /></span>
                        </span>
                      </button>
                    </div>
                    {coverOpen && (
                      <div className="bitable-dropdown-select__menu">
                        {isKanban && (
                          <button
                            type="button"
                            className={`bitable-dropdown-select__item${!hasCover ? ' is-selected' : ''}`}
                            onMouseDown={event => {
                              event.preventDefault();
                              onConfig({ coverFieldId: undefined });
                              setCoverOpen(false);
                            }}
                          >
                            <span className="bitable-select-trigger__icon">
                              <span className="universe-icon"><GlyphBan /></span>
                            </span>
                            <span>无封面</span>
                          </button>
                        )}
                        {attachmentFields.map(field => (
                          <button
                            key={field.id}
                            type="button"
                            className={`bitable-dropdown-select__item${config.coverFieldId === field.id || (!isKanban && !config.coverFieldId && field.id === attachmentFields[0]?.id) ? ' is-selected' : ''}`}
                            onMouseDown={event => {
                              event.preventDefault();
                              onConfig({ coverFieldId: field.id });
                              setCoverOpen(false);
                            }}
                          >
                            <span className="bitable-select-trigger__icon">
                              <span className="universe-icon"><GlyphAttachment /></span>
                            </span>
                            <span>{field.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {isKanban && <div className="field-setting-item_divider" />}
            </div>
            {!isKanban && (
            <div className={`${settingPrefix}_setting_item_wrapper field-setting-item_wrapper`}>
              <div className={`${settingPrefix}_setting_item field-setting-item`}>
                <span className={`${settingPrefix}__field-setting-name ellipsis table-view-config-item__label`}>封面效果</span>
                <div className={`${settingPrefix}__field-setting-children`}>
                  <div className="b-radio gallery_card_cover_type b-radio-upgrade">
                    <div className="radio-group" role="group" aria-label="封面效果">
                      {([
                        ['contain', '适应'],
                        ['cover', '裁剪'],
                      ] as const).map(([fit, label]) => (
                        <button
                          key={fit}
                          type="button"
                          className={`radio-item ellipsis${config.coverFit === fit ? ' selected' : ''}`}
                          disabled={view.locked}
                          onClick={() => onConfig({ coverFit: fit })}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            )}
            {!isKanban && <div className="bitable-gallery-divider" />}
            <div className={`${settingPrefix}_setting_item_wrapper field-setting-item_wrapper`}>
              <div className={`${settingPrefix}_setting_item field-setting-item`}>
                <span className={`${settingPrefix}__field-setting-name ellipsis table-view-config-item__label`}>展示模式</span>
                <div className={`${settingPrefix}__field-setting-children`}>
                  <div className="b-radio b-radio-upgrade">
                    <div className="radio-group" role="group" aria-label="展示模式">
                      {([
                        ['regular', '常规'],
                        ['compact', '紧凑'],
                      ] as const).map(([mode, label]) => (
                        <button
                          key={mode}
                          type="button"
                          className={`radio-item ellipsis${cardLayoutMode === mode ? ' selected' : ''}`}
                          disabled={view.locked}
                          onClick={() => onConfig({ cardLayoutMode: mode })}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className={`${settingPrefix}_setting_item_wrapper field-setting-item_wrapper`}>
              <div className={`${settingPrefix}_setting_item field-setting-item`}>
                <span className={`${settingPrefix}__field-setting-name ellipsis table-view-config-item__label`}>展示字段名</span>
                <div className={`${settingPrefix}__field-setting-children`}>
                  <button
                    type="button"
                    className="bitable-common-hover-press-background icon-background bitable-layout-row bitable-layout-main-cross-center"
                    aria-label={config.showFieldNames ? '隐藏字段名' : '显示字段名'}
                    disabled={view.locked}
                    onClick={() => onConfig({ showFieldNames: !config.showFieldNames })}
                  >
                    <span className="universe-icon setting_visible_icon">
                      {config.showFieldNames ? <GlyphVisible size={16} /> : <GlyphInvisible size={16} />}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="bitable-field-divider" />
        <div
          className="bitable-field__fields-wrap b-ud-scrollbar bitable-field__fields-wrap-border"
          data-select-id="field-items"
          style={{ position: 'relative', height: listHeight, width: '100%', overflow: 'auto' }}
          onDragOver={handleFieldListDragOver}
          onDrop={handleFieldListDrop}
        >
          <div ref={fieldListRef} style={{ height: innerHeight, width: '100%', position: 'relative' }}>
            {table.fields.map((field, index) => {
              const isPrimary = field.id === titleFieldId;
              const isVisible = isFieldVisibleOnCard(field.id);
              return (
                <div
                  key={field.id}
                  className={[
                    'bitable-field__fields__field-wrap',
                    draggingFieldIndex === index ? 'is-dragging' : '',
                    dragOverFieldIndex === index && draggingFieldIndex !== index ? 'is-drag-over' : '',
                  ].filter(Boolean).join(' ')}
                  style={{ position: 'absolute', left: 0, top: index * 36, height: 36, width: '100%' }}
                >
                  <div className="bitable-field__item_wrapper">
                    <div className={`bitable-field__item bitable-field__field${!isVisible && !isPrimary ? ' bitable-field__field_invisible' : ''}`}>
                      {isPrimary ? (
                        <span className="universe-icon bitable-field__field-lock" aria-hidden>
                          <FieldLockGlyph size={16} />
                        </span>
                      ) : (
                        <span
                          className="universe-icon bitable-field__field-dragbar"
                          draggable={!view.locked}
                          aria-hidden
                          onDragStart={event => handleFieldDragStart(event, index)}
                          onDragEnd={handleFieldDragEnd}
                        >
                          <GlyphDrag />
                        </span>
                      )}
                      <div className="bitable-field__field-type icon bitable-field-icon" style={{ lineHeight: '16px' }}>
                        <span className="universe-icon">{fieldTypeGlyph(field.type, 16)}</span>
                      </div>
                      <div className="bitable-field__field-name-container">
                        <span data-e2e="" className="bitable-field__field-name bitable-noselect bitable-field-name" style={{ marginLeft: 0 }}>
                          {field.name}
                        </span>
                      </div>
                      <span className="base-space-gap" />
                      {!isPrimary && (
                        <button
                          type="button"
                          className="bitable-common-hover-press-background icon-background bitable-layout-row bitable-layout-cross-center"
                          style={{ marginLeft: 4, cursor: 'pointer' }}
                          aria-label={isVisible ? '隐藏字段' : '显示字段'}
                          disabled={view.locked}
                          onMouseDown={event => event.stopPropagation()}
                          onClick={() => toggleFieldVisible(field.id)}
                        >
                          <span className="universe-icon bitable-field__field-visible" data-e2e="bitable-field-customize-item-visible">
                            {isVisible ? <GlyphVisible size={16} /> : <GlyphInvisible size={16} />}
                          </span>
                        </button>
                      )}
                      {!view.locked && (
                        <button
                          type="button"
                          className="bitable-common-hover-press-background icon-background bitable-layout-row bitable-layout-cross-center"
                          style={{ marginLeft: 4, cursor: 'pointer' }}
                          aria-label="更多操作"
                          onMouseDown={event => {
                            event.stopPropagation();
                            event.preventDefault();
                            openFieldMoreMenu(event.currentTarget, field.id);
                          }}
                        >
                          <span className="universe-icon bitable-field__field-more" data-e2e="bitable-field-more-btn">
                            <GlyphMore />
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <button
          type="button"
          className="bitable-field__add bitable-field__item"
          data-e2e="bitable-add-new-filed-btn"
          disabled={view.locked}
          onClick={event => {
            if (view.locked) return;
            const rect = event.currentTarget.getBoundingClientRect();
            onAddField({ left: rect.left, top: rect.bottom + 4 });
          }}
        >
          <span className="universe-icon bitable-field__add-icon"><GlyphAdd size={14} /></span>
          <span className="bitable-field__add-text bitable-noselect">新增字段</span>
        </button>
      </div>
      {fieldMoreId && fieldMoreAnchor && fieldMoreTarget && (
        <FloatingItemRowMenu
          anchor={fieldMoreAnchor}
          menuRef={moreMenuRef}
          canDelete={canDeleteField && fieldMoreTarget.id !== titleFieldId}
          onEdit={() => {
            closeFieldMoreMenu();
            onEditField(fieldMoreTarget.id);
          }}
          onDelete={() => {
            if (!canDeleteField || fieldMoreTarget.id === titleFieldId) return;
            if (!window.confirm(`确认删除字段「${fieldMoreTarget.name}」？`)) return;
            closeFieldMoreMenu();
            onDeleteField(fieldMoreTarget.id);
          }}
        />
      )}
    </>
  );
}

const FILTER_OPERATOR_OPTIONS: { value: FilterRule['operator']; label: string }[] = [
  { value: 'equals', label: '等于' },
  { value: 'not_equals', label: '不等于' },
  { value: 'contains', label: '包含' },
  { value: 'not_contains', label: '不包含' },
  { value: 'is_empty', label: '为空' },
  { value: 'is_not_empty', label: '不为空' },
];

function FilterPanelSelect<T extends string>({
  value,
  options,
  disabled,
  className,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  disabled?: boolean;
  className?: string;
  onChange: (value: T) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.value === value);
  const position = useAnchoredFloatingPosition(triggerRef, menuRef, open, {
    placement: 'bottom-start',
    fallbackWidth: 160,
    fallbackHeight: 240,
    matchAnchorWidth: true,
    gap: 6,
    pad: 8,
  });

  useEffect(() => {
    if (!open) return;
    const close = (event: globalThis.MouseEvent) => {
      if (!(event.target instanceof Node)) return;
      if (rootRef.current?.contains(event.target)) return;
      if (menuRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', close, true);
    return () => document.removeEventListener('mousedown', close, true);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`base-filter-select${open ? ' is-open' : ''}${className ? ` ${className}` : ''}`}
    >
      <button
        ref={triggerRef}
        type="button"
        className="base-filter-select__trigger"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        onMouseDown={event => event.stopPropagation()}
        onClick={() => {
          if (disabled) return;
          setOpen(current => !current);
        }}
      >
        <span className="base-filter-select__label">{selected?.label || ''}</span>
        <span className="base-filter-select__arrow" aria-hidden>
          <SelGlyphChevronDown size={12} fill="currentColor" />
        </span>
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          className="base-filter-select__menu base-filter-select__menu--portal"
          role="listbox"
          style={{
            position: 'fixed',
            top: position.top,
            left: position.left,
            width: position.width,
            maxHeight: position.maxHeight,
            visibility: position.visibility,
            zIndex: 10060,
          }}
          data-floating-panel="true"
          data-no-marquee-selection="true"
          onMouseDown={event => event.stopPropagation()}
        >
          {options.map(option => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={`base-filter-select__option${option.value === value ? ' is-active' : ''}`}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <span>{option.label}</span>
              {option.value === value && <span className="base-filter-select__check" aria-hidden>✓</span>}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

const GlyphInsertRight = ({ size = 14 }: GlyphProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" data-icon="InsertRightOutlined" aria-hidden>
    <path d="M23.147 12.64a.8.8 0 0 0 0-1.28l-5.867-4.4A.8.8 0 0 0 16 7.6V11H2a1 1 0 0 0 0 2h14v3.4a.8.8 0 0 0 1.28.64l5.867-4.4Z" fill="currentColor" />
  </svg>
);

const GlyphCloseSmall = ({ size = 14 }: GlyphProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" data-icon="CloseSmallOutlined" aria-hidden>
    <path d="M5.636 5.636a1 1 0 0 0 0 1.414l4.95 4.95-4.95 4.95a1 1 0 1 0 1.414 1.414l4.95-4.95 4.95 4.95a1 1 0 0 0 1.414-1.414L13.414 12l4.95-4.95a1 1 0 0 0-1.415-1.414L12 10.586l-4.95-4.95a1 1 0 0 0-1.413 0Z" fill="currentColor" />
  </svg>
);

function GroupPanelFieldSelect<T extends string>({
  value,
  options,
  disabled,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.value === value);
  const position = useAnchoredFloatingPosition(triggerRef, menuRef, open, {
    placement: 'bottom-start',
    fallbackWidth: 160,
    fallbackHeight: 240,
    matchAnchorWidth: true,
    gap: 6,
    pad: 8,
  });

  useEffect(() => {
    if (!open) return;
    const close = (event: globalThis.MouseEvent) => {
      if (!(event.target instanceof Node)) return;
      if (rootRef.current?.contains(event.target)) return;
      if (menuRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', close, true);
    return () => document.removeEventListener('mousedown', close, true);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`bitable-dropdown-select__wrapper${open ? ' is-open' : ''}`}
      style={{ marginLeft: 8, width: 'fit-content', maxWidth: '100%' }}
    >
      <div className="bitable-select-trigger__wrapper bitable-select-trigger__wrapper--fit-content">
        <div
          ref={triggerRef}
          className="bitable-select-trigger__trigger"
          onMouseDown={event => event.stopPropagation()}
          onClick={() => {
            if (disabled) return;
            setOpen(current => !current);
          }}
        >
          <span className="bitable-select-trigger__content">{selected?.label || ''}</span>
          <span className="bitable-select-trigger__arrow">
            <span className="universe-icon"><GlyphDownBold size={14} /></span>
          </span>
        </div>
        {open && createPortal(
          <div
            ref={menuRef}
            className="bitable-group-field-picker__menu bitable-group-field-picker__menu--portal"
            role="listbox"
            style={{
              position: 'fixed',
              top: position.top,
              left: position.left,
              width: position.width,
              maxHeight: position.maxHeight,
              visibility: position.visibility,
              zIndex: 10060,
            }}
            data-floating-panel="true"
            data-no-marquee-selection="true"
            onMouseDown={event => event.stopPropagation()}
          >
            {options.map(option => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                className={`bitable-group-field-picker__option${option.value === value ? ' is-active' : ''}`}
                onMouseDown={event => {
                  event.preventDefault();
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
      </div>
    </div>
  );
}

function isChoiceOrderField(field: BaseField | undefined) {
  return field?.type === 'single_select' || field?.type === 'multi_select';
}

function ConfigConditionDelete({
  disabled,
  onClick,
}: {
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className="bitable-group--del-option bitable-common-hover-press-background icon-background"
      style={{ height: 24 }}
      onClick={() => !disabled && onClick()}
    >
      <span className="universe-icon"><GlyphCloseSmall /></span>
    </div>
  );
}

function SortAutoSwitch({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="bitable-noselect">
      <div className="b-switch-trigger bitable-group--switch disable-animation">
        <span className="b-trigger-text bitable-layout-row">自动排序</span>
        <div className="b-switch-trigger-switch-container">
          <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            className={[
              'ud__switch',
              'ud__switch-md',
              'b-switch-trigger-udswitch',
              checked ? 'ud__switch-checked b-switch-trigger-udswitch-checked' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => !disabled && onChange(!checked)}
          >
            <div className="ud__switch__handler" />
          </button>
        </div>
      </div>
    </div>
  );
}

function GroupOrderToggle({
  value,
  disabled,
  field,
  onChange,
}: {
  value: 'asc' | 'desc';
  disabled?: boolean;
  field?: BaseField;
  onChange: (direction: 'asc' | 'desc') => void;
}) {
  const isChoiceOrder = isChoiceOrderField(field);
  return (
    <div className={`bitable-group--condition-order${isChoiceOrder ? ' is-choice-order' : ''}`}>
      <div className={`bitable-group--condition-order${value === 'desc' ? ' is-desc' : ''}`}>
        <div className="slider" aria-hidden />
        <div
          className={`item${value !== 'desc' ? ' selected' : ''}`}
          onClick={() => !disabled && onChange('asc')}
        >
          <div className="order">
            {isChoiceOrder ? (
              <span>选项顺序</span>
            ) : (
              <>
                <span className="from">A</span>
                <span className="universe-icon arrow"><GlyphInsertRight size={12} /></span>
                <span className="to">Z</span>
              </>
            )}
          </div>
        </div>
        <div
          className={`item${value === 'desc' ? ' selected' : ''}`}
          onClick={() => !disabled && onChange('desc')}
        >
          <div className="order">
            {isChoiceOrder ? (
              <span>选项倒序</span>
            ) : (
              <>
                <span className="from">Z</span>
                <span className="universe-icon arrow"><GlyphInsertRight size={12} /></span>
                <span className="to">A</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function GlyphSearch({ size = 14 }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M16.473 17.887A9.46 9.46 0 0 1 10.5 20a9.5 9.5 0 1 1 9.5-9.5 9.46 9.46 0 0 1-2.113 5.973l3.773 3.773a.996.996 0 0 1-.007 1.407.996.996 0 0 1-1.407.007l-3.773-3.773ZM18 10.5a7.5 7.5 0 1 0-15 0 7.5 7.5 0 0 0 15 0Z" fill="currentColor" />
    </svg>
  );
}

function FieldConditionPicker({
  fields,
  disabled,
  onSelect,
}: {
  fields: BaseField[];
  disabled?: boolean;
  onSelect: (fieldId: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filteredFields = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return fields;
    return fields.filter(field => field.name.toLocaleLowerCase().includes(needle));
  }, [fields, query]);
  const position = useAnchoredFloatingPosition(triggerRef, menuRef, open, {
    placement: 'bottom-start',
    fallbackWidth: 200,
    fallbackHeight: 280,
    gap: 6,
    pad: 8,
  });

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    searchRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (event: globalThis.MouseEvent) => {
      if (!(event.target instanceof Node)) return;
      if (rootRef.current?.contains(event.target)) return;
      if (menuRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', close, true);
    return () => document.removeEventListener('mousedown', close, true);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`bitable-dropdown-select__wrapper bitable-group-field-picker${open ? ' is-open' : ''}`}
      style={{ marginLeft: 8, width: 'fit-content', maxWidth: '100%' }}
    >
      <div className="bitable-select-trigger__wrapper bitable-select-trigger__wrapper--fit-content">
        <div
          ref={triggerRef}
          className="bitable-select-trigger__trigger"
          onMouseDown={event => event.stopPropagation()}
          onClick={() => {
            if (disabled || !fields.length) return;
            setOpen(current => !current);
          }}
        >
          <span className="bitable-select-trigger__content">
            <span className="bitable-select-trigger__placeholder">选择条件</span>
          </span>
          <span className="bitable-select-trigger__arrow">
            <span className="universe-icon"><GlyphDownBold size={14} /></span>
          </span>
        </div>
        {open && createPortal(
          <div
            ref={menuRef}
            className="bitable-field-condition-picker__menu bitable-field-condition-picker__menu--portal"
            role="listbox"
            style={{
              position: 'fixed',
              top: position.top,
              left: position.left,
              width: 200,
              maxHeight: position.maxHeight,
              visibility: position.visibility,
              zIndex: 10060,
            }}
            data-floating-panel="true"
            data-no-marquee-selection="true"
            onMouseDown={event => event.stopPropagation()}
          >
            <div className="bitable-field-condition-picker__search">
              <span className="bitable-field-condition-picker__search-icon" aria-hidden><GlyphSearch /></span>
              <input
                ref={searchRef}
                className="bitable-field-condition-picker__search-input"
                type="text"
                placeholder="搜索字段"
                value={query}
                onChange={event => setQuery(event.target.value)}
                onMouseDown={event => event.stopPropagation()}
              />
            </div>
            <div className="bitable-field-condition-picker__list">
              {filteredFields.length ? filteredFields.map(field => (
                <button
                  key={field.id}
                  type="button"
                  role="option"
                  className="bitable-dropdown-select__item"
                  onMouseDown={event => {
                    event.preventDefault();
                    onSelect(field.id);
                    setOpen(false);
                  }}
                >
                  <span className="bitable-dropdown-select__item-content">
                    <span className="bitable-dropdown-select__option-icon">{fieldTypeGlyph(field.type, 14)}</span>
                    <span className="bitable-dropdown-select__option-text">{field.name}</span>
                  </span>
                </button>
              )) : (
                <div className="bitable-field-condition-picker__empty">无匹配字段</div>
              )}
            </div>
          </div>,
          document.body,
        )}
      </div>
    </div>
  );
}

function ConfigPanelHelpIcon() {
  return (
    <span className="bitable-guide-video-container">
      <i className="bitable-guide-video-icon active">
        <span className="universe-icon" aria-hidden>
          <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 2C5.925 23 1 18.075 1 12S5.925 1 12 1s11 4.925 11 11-4.925 11-11 11Zm-1-6a1 1 0 1 1 2 0 1 1 0 0 1-2 0ZM8.05 9.282a5.17 5.17 0 0 1 .039-.28c.195-1.085.689-1.883 1.481-2.394.62-.405 1.383-.608 2.288-.608 1.189 0 2.176.288 2.962.864.787.575 1.18 1.428 1.18 2.558 0 .693-.17 1.277-.513 1.752-.2.287-.584.655-1.152 1.103l-.56.44c-.305.24-.507.52-.607.84a2.742 2.742 0 0 0-.072.486.5.5 0 0 1-.498.457h-1.12a.5.5 0 0 1-.498-.546c.065-.696.134-1.136.207-1.321.137-.344.49-.74 1.058-1.188l.575-.455c.19-.144 1.166-.831 1.166-1.44 0-.608-.106-.832-.412-1.166-.305-.333-.993-.44-1.613-.44-.61 0-1.132.161-1.387.572-.118.19-.215.393-.284.6a2.097 2.097 0 0 0-.073.307.5.5 0 0 1-.493.415H8.547a.5.5 0 0 1-.497-.556Z" fill="currentColor" />
          </svg>
        </span>
      </i>
    </span>
  );
}

function GridGroupPanelContent({
  table,
  view,
  onTable,
}: {
  table: BaseTable;
  view: BaseView;
  onTable: (update: (table: BaseTable) => BaseTable) => void;
}) {
  const gridConfig = view.config as GridViewConfig;
  const groupRules = useMemo(
    () => resolveGridGroupRules(view),
    [view, gridConfig.groupByFieldIds, gridConfig.groupSortDirections],
  );
  const usedFieldIds = new Set(groupRules.map(rule => rule.fieldId));
  const availableFields = table.fields.filter(field => !usedFieldIds.has(field.id));
  const [draggingGroupIndex, setDraggingGroupIndex] = useState<number | null>(null);
  const [dragOverGroupIndex, setDragOverGroupIndex] = useState<number | null>(null);
  const groupDragFromRef = useRef<number | null>(null);
  const groupListRef = useRef<HTMLUListElement>(null);

  const updateCurrentView = (update: (current: BaseView) => BaseView) => {
    if (view.locked) return;
    onTable(current => updateView(current, view.id, update));
  };

  const writeGroupRules = (nextRules: { fieldId: string; direction: 'asc' | 'desc' }[]) => {
    updateCurrentView(item => {
      const nextConfig = normalizeGridGroupConfig(
        {
          ...(item.config as GridViewConfig),
          groupByFieldIds: nextRules.map(rule => rule.fieldId),
          groupSortDirections: nextRules.map(rule => rule.direction),
        },
        table.fields,
      );
      return { ...item, config: nextConfig };
    });
  };

  const addGroupField = (fieldId: string) => {
    if (!fieldId || usedFieldIds.has(fieldId)) return;
    writeGroupRules([...groupRules, { fieldId, direction: 'asc' }]);
  };

  const removeGroupField = (index: number) => {
    writeGroupRules(groupRules.filter((_, itemIndex) => itemIndex !== index));
  };

  const updateGroupField = (index: number, nextFieldId: string) => {
    if (!nextFieldId || nextFieldId === groupRules[index]?.fieldId) return;
    writeGroupRules(groupRules.map((rule, itemIndex) => (
      itemIndex === index ? { ...rule, fieldId: nextFieldId } : rule
    )));
  };

  const updateGroupDirection = (index: number, direction: 'asc' | 'desc') => {
    writeGroupRules(groupRules.map((rule, itemIndex) => (
      itemIndex === index ? { ...rule, direction } : rule
    )));
  };

  const reorderGroupFields = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= groupRules.length || toIndex >= groupRules.length) return;
    const next = [...groupRules];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    writeGroupRules(next);
  };

  const resolveGroupDropIndex = (clientY: number) => {
    const list = groupListRef.current;
    if (!list) return null;
    const items = Array.from(list.querySelectorAll<HTMLElement>('.bitable-group--condition-item'));
    for (let index = 0; index < items.length; index += 1) {
      const rect = items[index].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return index;
    }
    return items.length ? items.length - 1 : null;
  };

  const handleGroupDragStart = (event: DragEvent, index: number) => {
    if (view.locked) return;
    groupDragFromRef.current = index;
    setDraggingGroupIndex(index);
    setDragOverGroupIndex(null);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
  };

  const handleGroupListDragOver = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (view.locked || groupDragFromRef.current == null) return;
    event.dataTransfer.dropEffect = 'move';
    const index = resolveGroupDropIndex(event.clientY);
    if (index == null || groupDragFromRef.current === index) {
      setDragOverGroupIndex(null);
      return;
    }
    setDragOverGroupIndex(index);
  };

  const handleGroupListDrop = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const fromIndex = groupDragFromRef.current ?? draggingGroupIndex ?? Number(event.dataTransfer.getData('text/plain'));
    const toIndex = resolveGroupDropIndex(event.clientY);
    groupDragFromRef.current = null;
    setDraggingGroupIndex(null);
    setDragOverGroupIndex(null);
    if (toIndex == null || Number.isNaN(fromIndex) || fromIndex === toIndex) return;
    reorderGroupFields(fromIndex, toIndex);
  };

  const handleGroupDragEnd = () => {
    groupDragFromRef.current = null;
    setDraggingGroupIndex(null);
    setDragOverGroupIndex(null);
  };

  const fieldOptionsForGroup = (currentFieldId: string) => table.fields.filter(
    field => field.id === currentFieldId || !usedFieldIds.has(field.id),
  );

  return (
    <>
      <div className="bitable-float-toolbar-btn-arrow" aria-hidden />
      <div className="bitable-group--tip-wrap">
        <div className="bitable-noselect bitable-group--tip">
          设置分组条件
          <ConfigPanelHelpIcon />
        </div>
      </div>
      <ul
        ref={groupListRef}
        className={`bitable-group--condition-list${draggingGroupIndex != null ? ' is-sorting' : ''}`}
        onDragOver={handleGroupListDragOver}
        onDrop={handleGroupListDrop}
      >
        {groupRules.map((rule, index) => {
          const field = table.fields.find(item => item.id === rule.fieldId);
          const fieldLabel = field?.name || '已删除字段';
          const fieldOptions = field
            ? fieldOptionsForGroup(rule.fieldId).map(item => ({ value: item.id, label: item.name }))
            : [{ value: rule.fieldId, label: fieldLabel }];
          return (
            <li
              className={[
                'bitable-group--condition-item',
                draggingGroupIndex === index ? 'is-dragging' : '',
                dragOverGroupIndex === index && draggingGroupIndex !== index ? 'is-drag-over' : '',
              ].filter(Boolean).join(' ')}
              key={`${rule.fieldId}-${index}`}
            >
              <span
                className="drag-point"
                draggable={!view.locked}
                aria-hidden
                onDragStart={event => handleGroupDragStart(event, index)}
                onDragEnd={handleGroupDragEnd}
              >
                <span className="universe-icon icon"><GlyphDrag /></span>
              </span>
              <div className="bitable-group--condition">
                <div className="bitable-group--condition-field">
                  <GroupPanelFieldSelect
                    disabled={view.locked}
                    value={rule.fieldId}
                    options={fieldOptions}
                    onChange={nextFieldId => updateGroupField(index, nextFieldId)}
                  />
                </div>
                <GroupOrderToggle
                  value={rule.direction}
                  disabled={view.locked}
                  field={field}
                  onChange={direction => updateGroupDirection(index, direction)}
                />
                <ConfigConditionDelete
                  disabled={view.locked}
                  onClick={() => removeGroupField(index)}
                />
              </div>
            </li>
          );
        })}
      </ul>
      {availableFields.length > 0 && (
        <div className="bitable-group--add bitable-group--condition">
          <div className="bitable-group--condition-field">
            <FieldConditionPicker
              disabled={view.locked}
              fields={availableFields}
              onSelect={addGroupField}
            />
          </div>
        </div>
      )}
    </>
  );
}

function GridGroupConfigPanel({
  panelRef,
  table,
  view,
  onTable,
}: {
  panelRef: RefObject<HTMLDivElement>;
  table: BaseTable;
  view: BaseView;
  onTable: (update: (table: BaseTable) => BaseTable) => void;
}) {
  return (
    <div
      ref={panelRef}
      className="bitable-group b-ud-scrollbar bitable-group-panel"
      data-e2e="bitable-group-config-panel"
      data-no-marquee-selection="true"
      data-floating-panel="true"
      onMouseDown={event => event.stopPropagation()}
    >
      <GridGroupPanelContent table={table} view={view} onTable={onTable} />
    </div>
  );
}

function ViewGroupMenuPanel({
  panelRef,
  table,
  view,
  config,
  onTable,
}: {
  panelRef: RefObject<HTMLDivElement>;
  table: BaseTable;
  view: BaseView;
  config: GalleryViewConfig;
  onTable: (update: (table: BaseTable) => BaseTable) => void;
}) {
  const groupFields = table.fields.filter(field => {
    if (field.id === table.primaryFieldId) return false;
    if (view.type === 'kanban') return field.type === 'single_select';
    return field.type === 'text' || field.type === 'single_select' || field.type === 'number';
  });
  const defaultFieldId = groupFields[0]?.id || '';
  const activeFieldId = config.groupByFieldId || defaultFieldId;

  const selectField = (fieldId: string) => {
    if (view.locked || !fieldId) return;
    onTable(current => updateView(current, view.id, item => ({
      ...item,
      config: { ...item.config, groupByFieldId: fieldId },
    })));
  };

  return (
    <div
      ref={panelRef}
      className="bitable-toolbar__group-menu bitable-noselect"
      data-no-marquee-selection="true"
      data-floating-panel="true"
      onMouseDown={event => event.stopPropagation()}
    >
      <div className="bitable-float-toolbar-btn-arrow" aria-hidden />
      <div className="bitable-toolbar__group-menu-prepend">选择分组依据</div>
      <ul className="bitable-toolbar__group-menu-list b-ud-scrollbar">
        {groupFields.map(field => (
          <li
            key={field.id}
            className={[
              'bitable-toolbar__group-menu-item',
              'bitable-toolbar__group-menu-list-item',
              activeFieldId === field.id ? 'selected' : '',
            ].filter(Boolean).join(' ')}
            role="button"
            tabIndex={view.locked ? -1 : 0}
            onClick={() => selectField(field.id)}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                selectField(field.id);
              }
            }}
          >
            <div className="icon bitable-toolbar__group-menu-item-icon" aria-hidden>
              <span className="universe-icon">
                <ToolGlyphKanbanGroup size={16} />
              </span>
            </div>
            <span className="bitable-toolbar__group-menu-item-text">{field.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function KanbanGroupMenuPanel(props: {
  panelRef: RefObject<HTMLDivElement>;
  table: BaseTable;
  view: BaseView;
  config: GalleryViewConfig;
  onTable: (update: (table: BaseTable) => BaseTable) => void;
}) {
  return <ViewGroupMenuPanel {...props} />;
}

function SortConfigPanel({
  panelRef,
  table,
  view,
  onTable,
}: {
  panelRef: RefObject<HTMLDivElement>;
  table: BaseTable;
  view: BaseView;
  onTable: (update: (table: BaseTable) => BaseTable) => void;
}) {
  return (
    <div
      ref={panelRef}
      className="bitable-group b-ud-scrollbar bitable-sort-panel"
      data-e2e="bitable-sort-config-panel"
      data-no-marquee-selection="true"
      data-floating-panel="true"
      onMouseDown={event => event.stopPropagation()}
    >
      <SortPanelContent table={table} view={view} onTable={onTable} />
    </div>
  );
}

function SortPanelContent({
  table,
  view,
  onTable,
}: {
  table: BaseTable;
  view: BaseView;
  onTable: (update: (table: BaseTable) => BaseTable) => void;
}) {
  const sorts = view.sorts || [];
  const autoSort = view.autoSort !== false;
  const usedFieldIds = new Set(sorts.map(sort => sort.fieldId));
  const availableFields = table.fields.filter(field => !usedFieldIds.has(field.id));
  const [draggingSortIndex, setDraggingSortIndex] = useState<number | null>(null);
  const [dragOverSortIndex, setDragOverSortIndex] = useState<number | null>(null);
  const sortDragFromRef = useRef<number | null>(null);
  const sortListRef = useRef<HTMLUListElement>(null);

  const updateCurrentView = (update: (current: BaseView) => BaseView) => {
    if (view.locked) return;
    onTable(current => updateView(current, view.id, update));
  };

  const updateSorts = (nextSorts: SortRule[]) => {
    updateCurrentView(item => ({
      ...item,
      sorts: nextSorts,
      autoSort: item.autoSort !== false,
    }));
  };

  const addSortField = (fieldId: string) => {
    if (!fieldId || usedFieldIds.has(fieldId)) return;
    updateSorts([...sorts, { fieldId, direction: 'asc' }]);
  };

  const removeSort = (index: number) => {
    updateSorts(sorts.filter((_, itemIndex) => itemIndex !== index));
  };

  const updateSort = (index: number, patch: Partial<SortRule>) => {
    updateSorts(sorts.map((sort, itemIndex) => (itemIndex === index ? { ...sort, ...patch } : sort)));
  };

  const reorderSorts = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= sorts.length || toIndex >= sorts.length) return;
    const next = [...sorts];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    updateSorts(next);
  };

  const resolveSortDropIndex = (clientY: number) => {
    const list = sortListRef.current;
    if (!list) return null;
    const items = Array.from(list.querySelectorAll<HTMLElement>('.bitable-group--condition-item'));
    for (let index = 0; index < items.length; index += 1) {
      const rect = items[index].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return index;
    }
    return items.length ? items.length - 1 : null;
  };

  const handleSortDragStart = (event: DragEvent, index: number) => {
    if (view.locked) return;
    sortDragFromRef.current = index;
    setDraggingSortIndex(index);
    setDragOverSortIndex(null);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
  };

  const handleSortListDragOver = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (view.locked || sortDragFromRef.current == null) return;
    event.dataTransfer.dropEffect = 'move';
    const index = resolveSortDropIndex(event.clientY);
    if (index == null || sortDragFromRef.current === index) {
      setDragOverSortIndex(null);
      return;
    }
    setDragOverSortIndex(index);
  };

  const handleSortListDrop = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const fromIndex = sortDragFromRef.current ?? draggingSortIndex ?? Number(event.dataTransfer.getData('text/plain'));
    const toIndex = resolveSortDropIndex(event.clientY);
    sortDragFromRef.current = null;
    setDraggingSortIndex(null);
    setDragOverSortIndex(null);
    if (toIndex == null || Number.isNaN(fromIndex) || fromIndex === toIndex) return;
    reorderSorts(fromIndex, toIndex);
  };

  const handleSortDragEnd = () => {
    sortDragFromRef.current = null;
    setDraggingSortIndex(null);
    setDragOverSortIndex(null);
  };

  const fieldOptionsForSort = (currentFieldId: string) => table.fields.filter(field => field.id === currentFieldId || !usedFieldIds.has(field.id));

  return (
    <>
      <div className="bitable-float-toolbar-btn-arrow" aria-hidden />
      <div className="bitable-group--tip-wrap">
        <div className="bitable-noselect bitable-group--tip">
          设置排序条件
          <ConfigPanelHelpIcon />
        </div>
        <SortAutoSwitch
          checked={autoSort}
          disabled={view.locked}
          onChange={checked => updateCurrentView(item => ({ ...item, autoSort: checked }))}
        />
      </div>
      <ul
        ref={sortListRef}
        className={`bitable-group--condition-list${draggingSortIndex != null ? ' is-sorting' : ''}`}
        onDragOver={handleSortListDragOver}
        onDrop={handleSortListDrop}
      >
        {sorts.map((sort, index) => {
          const field = table.fields.find(item => item.id === sort.fieldId);
          const fieldLabel = field?.name || '已删除字段';
          const fieldOptions = field
            ? fieldOptionsForSort(sort.fieldId).map(item => ({ value: item.id, label: item.name }))
            : [{ value: sort.fieldId, label: fieldLabel }];
          return (
            <li
              className={[
                'bitable-group--condition-item',
                draggingSortIndex === index ? 'is-dragging' : '',
                dragOverSortIndex === index && draggingSortIndex !== index ? 'is-drag-over' : '',
              ].filter(Boolean).join(' ')}
              key={`${sort.fieldId}-${index}`}
            >
              <span
                className="drag-point"
                draggable={!view.locked}
                aria-hidden
                onDragStart={event => handleSortDragStart(event, index)}
                onDragEnd={handleSortDragEnd}
              >
                <span className="universe-icon icon"><GlyphDrag /></span>
              </span>
              <div className="bitable-group--condition">
                <div className="bitable-group--condition-field">
                  <GroupPanelFieldSelect
                    disabled={view.locked}
                    value={sort.fieldId}
                    options={fieldOptions}
                    onChange={fieldId => {
                      if (!fieldId || fieldId === sort.fieldId) return;
                      updateSort(index, { fieldId });
                    }}
                  />
                </div>
                <GroupOrderToggle
                  value={sort.direction}
                  disabled={view.locked}
                  field={field}
                  onChange={direction => updateSort(index, { direction })}
                />
                <ConfigConditionDelete
                  disabled={view.locked}
                  onClick={() => removeSort(index)}
                />
              </div>
            </li>
          );
        })}
      </ul>
      {availableFields.length > 0 && (
        <div className="bitable-group--add bitable-group--condition">
          <div className="bitable-group--condition-field">
            <FieldConditionPicker
              disabled={view.locked}
              fields={availableFields}
              onSelect={addSortField}
            />
          </div>
        </div>
      )}
    </>
  );
}

function ToolbarQuickPanel({
  panel,
  table,
  view,
  records,
  panelRef,
  onClose,
  onTable,
}: {
  panel: ToolbarPanel;
  table: BaseTable;
  view: BaseView;
  records: BaseRecord[];
  panelRef: RefObject<HTMLDivElement>;
  onClose: () => void;
  onTable: (update: (table: BaseTable) => BaseTable) => void;
}) {
  const filters = view.filters || [];

  const updateCurrentView = (update: (current: BaseView) => BaseView) => {
    if (view.locked) return;
    onTable(current => updateView(current, view.id, update));
  };
  const firstFieldId = table.fields[0]?.id || '';
  const addFilter = () => {
    if (!firstFieldId) return;
    updateCurrentView(item => ({
      ...item,
      filters: [
        ...(item.filters || []),
        { id: `filter_${Date.now().toString(36)}`, fieldId: firstFieldId, operator: 'equals', value: '' },
      ],
    }));
  };
  const updateFilter = (filterId: string, patch: Partial<FilterRule>) => {
    updateCurrentView(item => ({
      ...item,
      filters: (item.filters || []).map(rule => (rule.id === filterId ? { ...rule, ...patch } : rule)),
    }));
  };
  const removeFilter = (filterId: string) => {
    updateCurrentView(item => ({
      ...item,
      filters: (item.filters || []).filter(rule => rule.id !== filterId),
    }));
  };

  const dismissPanel = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onClose();
  };

  const panelClassName = [
    'base-toolbar-panel',
    `base-toolbar-panel--${panel}`,
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={panelRef}
      className={panelClassName}
      data-no-marquee-selection="true"
      data-floating-panel="true"
      onMouseDown={event => event.stopPropagation()}
    >
      {panel !== 'filter' && !(panel === 'group' && view.type === 'grid') && panel !== 'sort' && (
        <header>
          <strong>{toolbarPanelTitle(panel)}</strong>
          <button type="button" onMouseDown={dismissPanel} aria-label="关闭">×</button>
        </header>
      )}

      {panel === 'filter' && (
        <div className="base-toolbar-panel__filter-content">
          <div className="base-toolbar-panel__filter-title">
            <span className="base-toolbar-panel__filter-title-main">
              <span>设置筛选条件</span>
              <span className="base-toolbar-panel__hint" aria-hidden>?</span>
            </span>
            <button type="button" className="base-toolbar-panel__filter-close" onMouseDown={dismissPanel} aria-label="关闭">×</button>
          </div>
          <div className="base-toolbar-panel__filter-conditions">
            {(filters.length ? filters : []).map(rule => {
              const needsValue = !['is_empty', 'is_not_empty'].includes(rule.operator);
              const fieldOptions = table.fields.map(field => ({ value: field.id, label: field.name }));
              return (
              <div
                className={`base-toolbar-panel__filter-row${needsValue ? '' : ' base-toolbar-panel__filter-row--no-value'}`}
                key={rule.id}
              >
                <FilterPanelSelect
                  className="base-toolbar-panel__filter-field-select"
                  disabled={view.locked}
                  value={rule.fieldId}
                  options={fieldOptions}
                  onChange={fieldId => updateFilter(rule.id, { fieldId })}
                />
                <FilterPanelSelect
                  className="base-toolbar-panel__filter-operator-select"
                  disabled={view.locked}
                  value={rule.operator}
                  options={FILTER_OPERATOR_OPTIONS}
                  onChange={operator => updateFilter(rule.id, { operator })}
                />
                {needsValue && (
                  <div className="base-toolbar-panel__filter-value-wrap">
                    <input
                      className="base-toolbar-panel__filter-value"
                      disabled={view.locked}
                      value={rule.value || ''}
                      placeholder="请输入"
                      onChange={event => updateFilter(rule.id, { value: event.target.value })}
                      onMouseDown={event => event.stopPropagation()}
                    />
                    {Boolean(rule.value?.trim()) && (
                      <button
                        type="button"
                        className="base-toolbar-panel__filter-value-clear"
                        aria-label="清除"
                        disabled={view.locked}
                        onMouseDown={event => {
                          event.preventDefault();
                          event.stopPropagation();
                          updateFilter(rule.id, { value: '' });
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  className="base-toolbar-panel__filter-remove"
                  aria-label="删除筛选条件"
                  disabled={view.locked}
                  onClick={() => removeFilter(rule.id)}
                >
                  ×
                </button>
              </div>
              );
            })}
          </div>
          <button
            type="button"
            className="base-toolbar-panel__add-condition"
            disabled={view.locked || !firstFieldId}
            onClick={addFilter}
          >
            <span aria-hidden>+</span>
            添加条件
          </button>
        </div>
      )}

      {panel === 'rowHeight' && view.type === 'grid' && (
        <div className="base-toolbar-panel__segmented" aria-label="行高">
          {([
            ['low', '低'],
            ['medium', '中'],
            ['high', '高'],
          ] as const).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              disabled={view.locked}
              className={((view.config as GridViewConfig).rowHeight || 'low') === mode ? 'is-active' : ''}
              onClick={() => updateCurrentView(item => ({
                ...item,
                config: { ...(item.config as GridViewConfig), rowHeight: mode as GridRowHeightMode },
              }))}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {panel === 'group' && view.type !== 'grid' && view.type !== 'gallery' && view.type !== 'kanban' && (
        <p className="base-toolbar-panel__empty">当前视图未开启分组呈现。</p>
      )}

      {panel === 'share' && (
        <div className="base-toolbar-panel__actions">
          <button type="button" onClick={() => window.open(window.location.href, '_blank', 'noopener,noreferrer')}>在新窗口打开</button>
          <button type="button" onClick={() => navigator.clipboard?.writeText(window.location.href)}>复制链接</button>
        </div>
      )}
    </div>
  );
}

function GallerySettings({
  table,
  view,
  config,
  panelRef,
  onClose,
  onConfig,
  onTable,
}: {
  table: BaseTable;
  view: BaseView;
  config: GalleryViewConfig;
  panelRef: RefObject<HTMLDivElement>;
  onClose: () => void;
  onConfig: (patch: Partial<GalleryViewConfig>) => void;
  onTable: (update: (table: BaseTable) => BaseTable) => void;
}) {
  const attachmentFields = table.fields.filter(field => field.type === 'attachment');
  return (
    <aside ref={panelRef} className="base-settings" data-no-marquee-selection="true" data-floating-panel="true">
      <header><strong>自定义卡片</strong><button type="button" onClick={onClose}>×</button></header>
      <label>视图名称<input value={view.name} disabled={view.locked} onChange={event => onTable(current => updateView(current, view.id, item => ({ ...item, name: event.target.value })))} /></label>
      <label>搜索记录<input disabled={view.locked} placeholder="搜索记录" value={String(config.search || '')} onChange={event => onConfig({ search: event.target.value })} /></label>
      <label>封面字段
        <select value={config.coverFieldId || ''} disabled={view.locked} onChange={event => onConfig({ coverFieldId: event.target.value || undefined })}>
          <option value="">不设置封面</option>
          {attachmentFields.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}
        </select>
      </label>
      {!attachmentFields.length && (
        <div className="base-settings__hint">
          当前没有附件字段，卡片将使用默认封面。
          <button type="button" disabled={view.locked} onClick={() => onTable(current => {
            const id = `fld_attachment_${Date.now().toString(36)}`;
            const field: BaseField = { id, name: '附件', type: 'attachment' };
            return {
              ...current,
              fields: [...current.fields, field],
              records: current.records.map(record => ({ ...record, fields: { ...record.fields, [id]: [] } })),
              views: current.views.map(item => item.id === view.id ? { ...item, config: { ...config, coverFieldId: id } } : item),
            };
          })}>创建附件字段</button>
        </div>
      )}
      <div className="base-settings__row">
        <label>封面展示<select disabled={view.locked} value={config.coverFit} onChange={event => onConfig({ coverFit: event.target.value as 'cover' | 'contain' })}><option value="cover">填充</option><option value="contain">完整显示</option></select></label>
        <label>卡片尺寸<select disabled={view.locked} value={config.cardSize} onChange={event => onConfig({ cardSize: event.target.value as GalleryViewConfig['cardSize'] })}><option value="small">小</option><option value="medium">中</option><option value="large">大</option></select></label>
      </div>
      <label>卡片比例<select disabled={view.locked} value={config.cardAspectRatio} onChange={event => onConfig({ cardAspectRatio: event.target.value as GalleryViewConfig['cardAspectRatio'] })}><option value="1:1">1:1</option><option value="4:3">4:3</option><option value="16:9">16:9</option><option value="auto">自动</option></select></label>
      <label>标题字段<select disabled={view.locked} value={config.titleFieldId || table.primaryFieldId} onChange={event => onConfig({ titleFieldId: event.target.value })}>{table.fields.filter(field => field.type !== 'attachment').map(field => <option key={field.id} value={field.id}>{field.name}</option>)}</select></label>
      <fieldset>
        <legend>卡片显示字段</legend>
        {table.fields.filter(field => field.id !== config.titleFieldId && field.id !== config.coverFieldId).map(field => (
          <label className="base-check" key={field.id}>
            <input type="checkbox" disabled={view.locked} checked={config.visibleFieldIds.includes(field.id)} onChange={event => onConfig({ visibleFieldIds: event.target.checked ? [...config.visibleFieldIds, field.id] : config.visibleFieldIds.filter(id => id !== field.id) })} />
            {field.name}
          </label>
        ))}
      </fieldset>
      <div className="base-settings__row">
        <label className="base-check"><input type="checkbox" disabled={view.locked} checked={config.showFieldNames} onChange={event => onConfig({ showFieldNames: event.target.checked })} />显示字段名</label>
        <label className="base-check"><input type="checkbox" disabled={view.locked} checked={config.showEmptyFields} onChange={event => onConfig({ showEmptyFields: event.target.checked })} />显示空字段</label>
      </div>
      <label>字段<select disabled={view.locked} value={view.sorts?.[0]?.fieldId || ''} onChange={event => {
        if (view.locked) return;
        onTable(current => updateView(current, view.id, item => ({ ...item, sorts: event.target.value ? [{ fieldId: event.target.value, direction: item.sorts?.[0]?.direction || 'asc' }] : [] })));
      }}>
        <option value="">不排序</option>{table.fields.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}
      </select></label>
      {view.sorts?.length ? <button type="button" disabled={view.locked} className="base-settings__direction" onClick={() => {
        if (view.locked) return;
        onTable(current => updateView(current, view.id, item => ({ ...item, sorts: [{ ...item.sorts![0], direction: item.sorts![0].direction === 'asc' ? 'desc' : 'asc' }] })));
      }}>{view.sorts[0].direction === 'asc' ? '升序' : '降序'}</button> : null}
      <label>筛选字段
        <select disabled={view.locked} value={view.filters?.[0]?.fieldId || ''} onChange={event => {
        if (view.locked) return;
        onTable(current => updateView(current, view.id, item => ({ ...item, filters: event.target.value ? [{ id: 'primary-filter', fieldId: event.target.value, operator: 'contains', value: item.filters?.[0]?.value || '' }] : [] })));
      }}>
        <option value="">不筛选</option>{table.fields.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}
      </select></label>
      {view.filters?.length ? <input disabled={view.locked} placeholder="包含内容" value={view.filters[0].value || ''} onChange={event => {
        if (view.locked) return;
        onTable(current => updateView(current, view.id, item => ({ ...item, filters: [{ ...item.filters![0], value: event.target.value }] })));
      }} /> : null}
      <footer>
        <button type="button" onClick={() => onTable(current => updateView(current, view.id, item => ({ ...item, locked: !item.locked })))}>{view.locked ? '解锁视图' : '锁定视图'}</button>
      </footer>
    </aside>
  );
}

function GanttSettings({
  table,
  view,
  config,
  panelRef,
  onClose,
  onConfig,
  onTable,
}: {
  table: BaseTable;
  view: BaseView;
  config: GanttViewConfig;
  panelRef: RefObject<HTMLDivElement>;
  onClose: () => void;
  onConfig: (patch: Partial<GanttViewConfig>) => void;
  onTable: (update: (table: BaseTable) => BaseTable) => void;
}) {
  const dateFields = table.fields.filter(field => field.type === 'date');
  return (
    <aside ref={panelRef} className="base-settings" data-no-marquee-selection="true" data-floating-panel="true">
      <header><strong>甘特设置</strong><button type="button" onClick={onClose}>×</button></header>
      <label>视图名称<input value={view.name} disabled={view.locked} onChange={event => onTable(current => updateView(current, view.id, item => ({ ...item, name: event.target.value })))} /></label>
      <label>搜索记录<input disabled={view.locked} placeholder="搜索记录" value={String(config.search || '')} onChange={event => onConfig({ search: event.target.value })} /></label>
      <label>任务名称字段
        <select disabled={view.locked} value={config.titleFieldId || table.primaryFieldId} onChange={event => onConfig({ titleFieldId: event.target.value })}>
          {table.fields.filter(field => field.type !== 'attachment').map(field => <option key={field.id} value={field.id}>{field.name}</option>)}
        </select>
      </label>
      <div className="base-settings__row">
        <label>开始日期
          <select disabled={view.locked} value={config.startDateFieldId || ''} onChange={event => onConfig({ startDateFieldId: event.target.value })}>
            {dateFields.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}
          </select>
        </label>
        <label>结束日期
          <select disabled={view.locked} value={config.endDateFieldId || ''} onChange={event => onConfig({ endDateFieldId: event.target.value })}>
            {dateFields.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}
          </select>
        </label>
      </div>
      <label>时间刻度
        <select disabled={view.locked} value={config.dayWidth} onChange={event => onConfig({ dayWidth: Number(event.target.value) })}>
          <option value={60}>周</option>
          <option value={40}>月</option>
          <option value={24}>季</option>
        </select>
      </label>
      <label>字段<select disabled={view.locked} value={view.sorts?.[0]?.fieldId || ''} onChange={event => {
        if (view.locked) return;
        onTable(current => updateView(current, view.id, item => ({ ...item, sorts: event.target.value ? [{ fieldId: event.target.value, direction: item.sorts?.[0]?.direction || 'asc' }] : [] })));
      }}>
        <option value="">不排序</option>{table.fields.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}
      </select></label>
      <footer>
        <button type="button" onClick={() => onTable(current => updateView(current, view.id, item => ({ ...item, locked: !item.locked })))}>{view.locked ? '解锁视图' : '锁定视图'}</button>
      </footer>
    </aside>
  );
}

function HierarchySettingsPanel({
  table,
  view,
  panelRef,
  onTable,
}: {
  table: BaseTable;
  view: BaseView;
  panelRef: RefObject<HTMLDivElement>;
  onTable: (update: (table: BaseTable) => BaseTable) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);
  const config = view.config as GridViewConfig;
  const relationFields = table.fields.filter(field => field.id !== table.primaryFieldId && field.type === 'relation');
  const selectedField = table.fields.find(field => field.id === config.parentFieldId)
    ?? relationFields.find(field => field.name === '父记录')
    ?? relationFields[0]
    ?? null;
  const createParentField = () => {
    if (view.locked) return;
    const id = `fld_relation_${Date.now().toString(36)}`;
    onTable(current => {
      const baseName = '父记录';
      const existingNames = new Set(current.fields.map(field => field.name));
      let name = baseName;
      let index = 2;
      while (existingNames.has(name)) {
        name = `${baseName} ${index}`;
        index += 1;
      }
      const field: BaseField = { id, name, type: 'relation' };
      return {
        ...current,
        fields: [...current.fields, field],
        records: current.records.map(record => ({
          ...record,
          fields: { ...record.fields, [id]: [] },
        })),
        views: current.views.map(item => item.id === view.id
          ? {
              ...item,
              hiddenFieldIds: item.hiddenFieldIds?.filter(fieldId => fieldId !== id),
              config: { ...item.config, parentFieldId: id },
            }
          : item),
      };
    });
    setOpen(false);
  };
  const selectField = (fieldId: string) => {
    if (view.locked) return;
    onTable(current => updateView(current, view.id, item => ({
      ...item,
      config: { ...item.config, parentFieldId: fieldId },
    })));
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: globalThis.PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (selectRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [open]);

  return (
    <div
      ref={panelRef}
      className="bitable-hierarchy-bar-settings"
      data-no-marquee-selection="true"
      data-floating-panel="true"
    >
      <div className="bitable-float-toolbar-btn-arrow" aria-hidden />
      <div className="hierarchy-config-panel hierarchy-config-panel-new">
        <div className="bitable-field__title-wrap">
          <div className="bitable-noselect bitable-field__title bitable-field__item">
            <span>视图配置 <span className="bitable-guide-video-container">?</span></span>
          </div>
        </div>
        <div className="bitable-layout-row bitable-flex hierarchy-content-config hierarchy-content-config--clearable">
          <span className="hierarchy-field-title">选择父记录字段</span>
          <div
            ref={selectRef}
            className={`ud__select hierarchy-field-select${open ? ' is-open' : ''}`}
          >
            <button
              type="button"
              className="ud__select__selector"
              aria-label="选择父记录字段"
              aria-expanded={open}
              onClick={() => setOpen(current => !current)}
              disabled={view.locked}
            >
              <span className="bitable-field-item">
                <span className="bitable-field-icon" aria-hidden>
                  <SlashGlyphBitableGrid size={14} fill="currentColor" />
                </span>
                <span className="bitable-field-name">{selectedField?.name || '父记录'}</span>
              </span>
              <span className="ud__select__selector__arrow" aria-hidden>
                <SelGlyphChevronDown size={12} fill="currentColor" />
              </span>
            </button>
            {open && (
              <div className="hierarchy-field-select__menu">
                {relationFields.map(field => (
                  <button
                    key={field.id}
                    type="button"
                    className={`hierarchy-field-select__option${selectedField?.id === field.id ? ' is-active' : ''}`}
                    onMouseDown={event => {
                      event.preventDefault();
                      selectField(field.id);
                    }}
                  >
                    <span className="bitable-field-icon" aria-hidden>
                      <SlashGlyphBitableGrid size={14} fill="currentColor" />
                    </span>
                    <span>{field.name}</span>
                    {selectedField?.id === field.id && <span className="hierarchy-field-select__check" aria-hidden>✓</span>}
                  </button>
                ))}
                <button
                  type="button"
                  className="hierarchy-field-select__option"
                  onMouseDown={event => {
                    event.preventDefault();
                    createParentField();
                  }}
                >
                  <span aria-hidden>+</span>
                  <span>新建父记录</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function GridSettings({
  table,
  view,
  panelRef,
  onClose,
  onTable,
}: {
  table: BaseTable;
  view: BaseView;
  panelRef: RefObject<HTMLDivElement>;
  onClose: () => void;
  onTable: (update: (table: BaseTable) => BaseTable) => void;
}) {
  const search = String((view.config as { search?: string }).search || '');
  const hidden = new Set(view.hiddenFieldIds || []);
  return (
    <aside ref={panelRef} className="base-settings" data-no-marquee-selection="true" data-floating-panel="true">
      <header><strong>视图设置</strong><button type="button" onClick={onClose}>×</button></header>
      <label>视图名称<input value={view.name} disabled={view.locked} onChange={event => onTable(current => updateView(current, view.id, item => ({ ...item, name: event.target.value })))} /></label>
      <label>搜索记录<input disabled={view.locked} placeholder="搜索记录" value={search} onChange={event => onTable(current => updateView(current, view.id, item => ({ ...item, config: { ...item.config, search: event.target.value } })))} /></label>
      <fieldset>
        <legend>显示字段</legend>
        {table.fields.map(field => (
          <label className="base-check" key={field.id}>
            <input
              type="checkbox"
              disabled={view.locked || field.id === table.primaryFieldId}
              checked={!hidden.has(field.id)}
              onChange={event => onTable(current => updateView(current, view.id, item => {
                const next = new Set(item.hiddenFieldIds || []);
                if (event.target.checked) next.delete(field.id); else next.add(field.id);
                return { ...item, hiddenFieldIds: Array.from(next) };
              }))}
            />
            {field.name}
          </label>
        ))}
      </fieldset>
      <label>字段<select disabled={view.locked} value={view.sorts?.[0]?.fieldId || ''} onChange={event => {
        if (view.locked) return;
        onTable(current => updateView(current, view.id, item => ({ ...item, sorts: event.target.value ? [{ fieldId: event.target.value, direction: item.sorts?.[0]?.direction || 'asc' }] : [] })));
      }}>
        <option value="">不排序</option>{table.fields.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}
      </select></label>
      {view.sorts?.length ? <button type="button" disabled={view.locked} className="base-settings__direction" onClick={() => {
        if (view.locked) return;
        onTable(current => updateView(current, view.id, item => ({ ...item, sorts: [{ ...item.sorts![0], direction: item.sorts![0].direction === 'asc' ? 'desc' : 'asc' }] })));
      }}>{view.sorts[0].direction === 'asc' ? '升序' : '降序'}</button> : null}
      <label>筛选字段
        <select disabled={view.locked} value={view.filters?.[0]?.fieldId || ''} onChange={event => {
        if (view.locked) return;
        onTable(current => updateView(current, view.id, item => ({ ...item, filters: event.target.value ? [{ id: 'primary-filter', fieldId: event.target.value, operator: 'contains', value: item.filters?.[0]?.value || '' }] : [] })));
      }}>
        <option value="">不筛选</option>{table.fields.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}
      </select></label>
      {view.filters?.length ? <input disabled={view.locked} placeholder="包含内容" value={view.filters[0].value || ''} onChange={event => {
        if (view.locked) return;
        onTable(current => updateView(current, view.id, item => ({ ...item, filters: [{ ...item.filters![0], value: event.target.value }] })));
      }} /> : null}
      <footer>
        <button type="button" onClick={() => onTable(current => updateView(current, view.id, item => ({ ...item, locked: !item.locked })))}>{view.locked ? '解锁视图' : '锁定视图'}</button>
      </footer>
    </aside>
  );
}
