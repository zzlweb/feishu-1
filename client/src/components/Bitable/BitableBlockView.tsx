Warning: truncated output (original token count: 55010)
Total output lines: 5399

import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type MouseEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Dialog, Input, Radio, Select, Switch } from 'tdesign-react';
import type { SelectProps } from 'tdesign-react';
import { SelGlyphChevronDown } from '../../icons/selectionToolbarGlyphs';
import { SlashGlyphBitableGrid, SlashGlyphGallery, SlashGlyphGantt, SlashGlyphKanban } from '../../icons/slashMenuGlyphs';
import { BitableAddFieldPopover, BitableEditFieldPopover, buildNewFieldPayload, emptyDefaultValue, type CreateFieldInput, type UpdateFieldInput } from './fields/BitableAddFieldPopover';
import { FieldLockGlyph, fieldTypeGlyph } from './fields/bitableFieldTypeIcons';
import { isFieldTypeCreatable } from './fields/bitableFieldTypes';
import {
  BitableTooltip,
  useBitablePanelHoverHandlers,
  useBitableToolbarPortalStyle,
} from './shared/BitableViewShared';
import { bindFloatingLayoutListeners } from '../Editor/shared/floatingPanel';
import { BITABLE_TD_PORTAL_SELECTOR, BITABLE_TD_SELECT_POPUP_PROPS } from './shared/bitableTdesign';
import { parseJsonPayload } from '../../api/http';
import {
  addView,
  analyzeFieldDeletion,
  analyzeSelectChoiceDeletion,
  appendRecordHistory,
  attachmentFromUpload,
  collectRecordSubtreeIds,
  copyView,
  createGalleryConfig,
  createRecord,
  createRecordComment,
  deleteView,
  deleteFieldWithMigration,
  deleteSelectChoiceWithMigration,
  duplicateFieldName,
  findInsertIndexAfterSubtree,
  isFilterRuleActive,
  hasActiveGridGroups,
  insertRecordsIntoTable,
  normalizeRecordTreeOrder,
  parseDateCellValue,
  pinRecordsToVisibleBottom,
  reorderRecordsInTreeById,
  reorderViewFields,
  getActiveView,
  getAttachments,
  getGanttConfig,
  getGalleryConfig,
  getCompatibleFieldMigrationTargets,
  getVisibleViews,
  isViewTypeVisible,
  getGridGroupFieldIds,
  resolveGridGroupRules,
  resolveViewFields,
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
  type FieldDeletionImpact,
  type SelectChoiceDeletionImpact,
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
import { syncBitableDocAlign } from './shared/BitableViewShared';
import { BitableRecordCardModal } from './records/BitableRecordCardModal';
import { createSelectChoice } from './fields/BitableSelectFieldEditor';

function isToolbarPortaledDropdownTarget(target: Node): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(
    `.bitable-field-condition-picker__menu--portal, .bitable-group-field-picker__menu--portal, .base-filter-select__menu--portal, ${BITABLE_TD_PORTAL_SELECTOR}`,
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
  return parseDateCellValue(value);
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
  readOnly,
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
  readOnly: boolean;
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
            onDragOver={event => !readOnly && onDragOver(event, index)}
            onDrop={event => !readOnly && onDrop(event, index)}
          >
            <span
              className="base-view-sidebar__drag"
              draggable={!readOnly && !view.locked}
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
            {!readOnly && !view.locked && renamingViewId !== view.id && (
              <button
                type="button"
                className={`base-view-sidebar__more${contextMenuViewId === view.id ? ' is-open' : ''}`}
                aria-label="更多操作"
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
      {!readOnly && <div className="base-view-sidebar__create">
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
      </div>}
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
  return (
    <Dialog
      visible
      theme="warning"
      header="操作确认"
      width={420}
      placement="center"
      destroyOnClose
      closeOnOverlayClick
      confirmBtn={{ content: '删除', theme: 'danger' }}
      cancelBtn="取消"
      onClose={onCancel}
      onCancel={onCancel}
      onConfirm={onConfirm}
      className="bitable-td-dialog"
    >
      <p className="bitable-td-dialog__body">该操作将删除 {count} 行记录，请确认是否继续？</p>
    </Dialog>
  );
}

function DeleteFieldDialog({
  fieldName,
  impact,
  migrationTargets,
  migrationTargetId,
  onMigrationTargetChange,
  onCancel,
  onConfirm,
}: {
  fieldName: string;
  impact: FieldDeletionImpact;
  migrationTargets: BaseField[];
  migrationTargetId: string;
  onMigrationTargetChange: (fieldId: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const referenceCount = impact.filterReferences
    + impact.sortReferences
    + impact.groupReferences
    + impact.configReferences;
  return (
    <Dialog
      visible
      theme="danger"
      header={`删除字段「${fieldName}」`}
      width={480}
      placement="center"
      destroyOnClose
      closeOnOverlayClick
      confirmBtn={{ content: migrationTargetId ? '迁移并删除' : '删除并清空', theme: 'danger' }}
      cancelBtn="取消"
      onClose={onCancel}
      onCancel={onCancel}
      onConfirm={onConfirm}
      className="bitable-td-dialog"
    >
      <div className="bitable-field-delete-dialog" data-e2e="bitable-field-delete-dialog">
        <p className="bitable-td-dialog__body">删除后无法直接撤销，请先确认以下影响：</p>
        <ul className="bitable-field-delete-dialog__impact">
          <li>{impact.recordsWithValue} 条记录包含字段值</li>
          <li>{impact.filterReferences} 条筛选、{impact.sortReferences} 条排序引用</li>
          <li>{impact.groupReferences} 条分组、{impact.configReferences} 条视图配置引用</li>
        </ul>
        {migrationTargets.length > 0 ? (
          <label className="bitable-field-delete-dialog__migration">
            <span>删除前迁移到兼容字段</span>
            <select value={migrationTargetId} onChange={event => onMigrationTargetChange(event.target.value)}>
              <option value="">不迁移，清空数据并移除 {referenceCount} 个引用</option>
              {migrationTargets.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}
            </select>
            {migrationTargetId && <small>源字段的非空值会覆盖目标字段，并同步迁移兼容的筛选、排序、分组和视图引用。</small>}
          </label>
        ) : (
          <p className="bitable-field-delete-dialog__notice">没有类型兼容的目标字段；确认后将清空数据并移除相关引用。</p>
        )}
      </div>
    </Dialog>
  );
}

function DeleteKanbanGroupDialog({
  groupName,
  impact,
  migrationTargets,
  migrationTargetId,
  onMigrationTargetChange,
  onCancel,
  onConfirm,
}: {
  groupName: string;
  impact: SelectChoiceDeletionImpact;
  migrationTargets: Array<{ id: string; name: string }>;
  migrationTargetId: string;
  onMigrationTargetChange: (choiceId: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      visible
      theme="danger"
      header={`删除分组「${groupName}」`}
      width={480}
      placement="center"
      destroyOnClose
      closeOnOverlayClick
      confirmBtn={{ content: migrationTargetId ? '迁移并删除' : '删除并清空', theme: 'danger' }}
      cancelBtn="取消"
      onClose={onCancel}
      onCancel={onCancel}
      onConfirm={onConfirm}
      className="bitable-td-dialog"
    >
      <div className="bitable-field-delete-dialog" data-e2e="kanban-group-delete-dialog">
        <p className="bitable-td-dialog__body">删除后无法直接撤销，请先确认以下影响：</p>
        <ul className="bitable-field-delete-dialog__impact">
          <li>{impact.recordsWithChoice} 条记录位于该分组</li>
          <li>{impact.filterReferences} 条筛选引用该分组</li>
          <li>{impact.viewConfigReferences} 条看板视图配置引用</li>
        </ul>
        <label className="bitable-field-delete-dialog__migration">
          <span>删除前迁移记录到</span>
          <select value={migrationTargetId} onChange={event => onMigrationTargetChange(event.target.value)}>
            <option value="">不迁移，清空记录分组值并移除引用</option>
            {migrationTargets.map(choice => <option key={choice.id} value={choice.id}>{choice.name}</option>)}
          </select>
          {migrationTargetId && <small>相关记录、筛选和看板配置将迁移到所选分组。</small>}
        </label>
      </div>
    </Dialog>
  );
}

function DeleteViewDialog({
  viewName,
  isLastView,
  onCancel,
  onConfirm,
}: {
  viewName: string;
  isLastView?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      visible
      theme="danger"
      header={isLastView ? '删除多维表格' : '删除视图'}
      width={420}
      placement="center"
      destroyOnClose
      closeOnOverlayClick
      confirmBtn={{ content: '删除', theme: 'danger' }}
      cancelBtn="取消"
      onClose={onCancel}
      onCancel={onCancel}
      onConfirm={onConfirm}
      className="bitable-td-dialog"
    >
      <p className="bitable-td-dialog__body">
        {isLastView
          ? `「${viewName}」是唯一视图，删除后将移除整个多维表格，确认继续吗？`
          : `确认要删除视图「${viewName}」吗？`}
      </p>
    </Dialog>
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
    const cleanupLayout = bindFloatingLayoutListeners(updatePosition, anchor);
    return cleanupLayout;
  }, [anchor, updatePosition]);

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
  const [documentEditable, setDocumentEditable] = useState(editor.isEditable);
  const [readOnlyViewId, setReadOnlyViewId] = useState<string | null>(null);
  tableRef.current = parsedTable;
  const table = parsedTable;
  const storedActiveView = readOnlyViewId
    ? table.views.find(view => view.id === readOnlyViewId) || getActiveView(table)
    : getActiveView(table);
  const activeView = documentEditable
    ? storedActiveView
    : { ...storedActiveView, locked: true };
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
  const sortSignature = useMemo(
    () => JSON.stringify((activeView.sorts || []).map(sort => [sort.fieldId, sort.direction])),
    [activeView.sorts],
  );
  const ganttConfig = getGanttConfig(table, activeView);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeToolbarPanel, setActiveToolbarPanel] = useState<ToolbarPanel | null>(null);
  const [isRenamingView, setIsRenamingView] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [renamingViewId, setRenamingViewId] = useState<string | null>(null);
  const [viewContextMenuId, setViewContextMenuId] = useState<string | null>(null);
  const [deleteViewTarget, setDeleteViewTarget] = useState<{ id: string; name: string } | null>(null);
  const [pendingDeleteRecordIds, setPendingDeleteRecordIds] = useState<string[] | null>(null);
  const [pendingDeleteFieldId, setPendingDeleteFieldId] = useState<string | null>(null);
  const [fieldMigrationTargetId, setFieldMigrationTargetId] = useState('');
  const [pendingDeleteGroup, setPendingDeleteGroup] = useState<{ fieldId: string; choiceId: string } | null>(null);
  const [groupMigrationTargetId, setGroupMigrationTargetId] = useState('');
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
  const pinnedBottomRecordIdsRef = useRef<string[]>([]);
  const [pinnedBottomVersion, setPinnedBottomVersion] = useState(0);
  const pinReleaseEnabledRef = useRef(false);
  const records = useMemo(
    () => pinRecordsToVisibleBottom(visibleRecords(table, activeView), pinnedBottomRecordIdsRef.current),
    [table, activeView, pinnedBottomVersion],
  );
  const groups = useMemo(
    () => groupRecords(table, activeView, records),
    [table, activeView, records],
  );
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
  const filterToolAnchorRef = useRef<HTMLSpanElement>(null);
  const groupToolAnchorRef = useRef<HTMLSpanElement>(null);
  const sortToolAnchorRef = useRef<HTMLSpanElement>(null);
  const filterFloatAnchorRef = useRef<HTMLDivElement>(null);
  const sortFloatAnchorRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const viewContextMenuRef = useRef<HTMLDivElement>(null);
  const fieldPanelAnchorRef = useRef<HTMLSpanElement>(null);
  const [isViewToolsVisible, setIsViewToolsVisible] = useState(false);
  const viewHoverZoneRef = useRef<HTMLDivElement>(null);
  const viewToolsLeaveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const syncEditable = () => setDocumentEditable(editor.isEditable);
    syncEditable();
    editor.on('transaction', syncEditable);
    return () => {
      editor.off('transaction', syncEditable);
    };
  }, [editor]);

  useEffect(() => {
    if (documentEditable) setReadOnlyViewId(null);
  }, [documentEditable]);

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
    // 工具栏面板挂 body，移入面板时不要隐藏 viewbar，否则按钮区闪隐并连带假 leave。
    if (next instanceof Element && next.closest('.base-toolbar-panel--portal, .bitable-group-panel--portal, .bitable-sort-panel--portal, .bitable-toolbar__group-menu--portal')) {
      return;
    }
    if (blockRef.current?.classList.contains('is-block-gutter-active')) return;
    hideViewTools();
  }, [hideViewTools]);

  useEffect(() => () => {
    if (viewToolsLeaveTimerRef.current != null) window.clearTimeout(viewToolsLeaveTimerRef.current);
  }, []);

  useEffect(() => {
    pinnedBottomRecordIdsRef.current = [];
    pinReleaseEnabledRef.current = false;
    setPinnedBottomVersion(version => version + 1);
  }, [activeView.id, sortSignature]);

  useEffect(() => {
    const pinnedIds = pinnedBottomRecordIdsRef.current;
    if (!pinnedIds.length) return;
    const existing = new Set(table.records.map(record => record.id));
    const nextPinned = pinnedIds.filter(id => existing.has(id));
    if (nextPinned.length === pinnedIds.length) return;
    pinnedBottomRecordIdsRef.current = nextPinned;
    pinReleaseEnabledRef.current = nextPinned.length > 0 && pinReleaseEnabledRef.current;
    setPinnedBottomVersion(version => version + 1);
  }, [table.records]);

  useEffect(() => {
    const pinnedIds = pinnedBottomRecordIdsRef.current;
    if (!pinnedIds.length) return;
    if (gridFocusedRecordId && pinnedIds.includes(gridFocusedRecordId)) {
      pinReleaseEnabledRef.current = true;
      return;
    }
    if (pinReleaseEnabledRef.current && gridFocusedRecordId && !pinnedIds.includes(gridFocusedRecordId)) {
      pinnedBottomRecordIdsRef.current = [];
      pinReleaseEnabledRef.current = false;
      setPinnedBottomVersion(version => version + 1);
    }
  }, [gridFocusedRecordId, pinnedBottomVersion]);

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

  const commit = (next: BaseTable, allowReadOnlyMigration = false) => {
    if (!documentEditable && !allowReadOnlyMigration) return;
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
    if (!node.attrs.model) commit(parsedTable, true);
  }, []); // migrate legacy nodes once on mount

  useEffect(() => {
    const block = blockRef.current;
    const parent = block?.parentElement;
    if (!block || !parent) return;
    const measureLayout = () => {
      syncBitableDocAlign(block);
      block.style.setProperty('--bitable-anchor-width', `${Math.max(860, parent.clientWidth)}px`);
    };
    measureLayout();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measureLayout) : null;
    ro?.observe(parent);
    window.addEventListener('resize', measureLayout);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measureLayout);
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
      if (!(event.target instanceof Element) || !event.target.closest('.base-field-panel, .bitable-field, .base-settings, .base-viewbar__tool-anchor, .bitable-float-toolbar-btn-wrapper, .base-toolbar-panel, .bitable-group-panel, .bitable-sort-panel, .bitable-toolbar__group-menu, .base-viewbar__tool, .base-toolbar-panel--portal, .bitable-group-panel--portal, .bitable-sort-panel--portal')) {
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
    const closeOnLayoutChange = () => setEditingFieldPanel(null);
    document.addEventListener('mousedown', close);
    // 勿 runImmediately：挂载时立刻触发会把刚打开的弹层关掉
    const cleanupLayout = bindFloatingLayoutListeners(closeOnLayoutChange, undefined, { runImmediately: false });
    return () => {
      document.removeEventListener('mousedown', close);
      cleanupLayout();
    };
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
    const closeOnLayoutChange = () => setAddFieldPanel(null);
    document.addEventListener('mousedown', close);
    // 勿 runImmediately：挂载时立刻触发会把刚打开的「新增字段」弹层关掉
    const cleanupLayout = bindFloatingLayoutListeners(closeOnLayoutChange, undefined, { runImmediately: false });
    return () => {
      document.removeEventListener('mousedown', close);
      cleanupLayout();
    };
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
    if (documentEditable) mutate(current => ({ ...current, activeViewId: viewId }));
    else setReadOnlyViewId(viewId);
    setCollapsedGroups(new Set());
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
    const target = table.views.find(view => view.id === viewId);
    if (!target) return;
    setViewContextMenuId(null);
    setShowViewMenu(false);
    setDeleteViewTarget({ id: target.id, name: target.name });
  };

  const confirmDeleteView = () => {
    if (!deleteViewTarget) return;
    const targetId = deleteViewTarget.id;
    const isLastVisibleView = getVisibleViews(tableRef.current).length <= 1;
    setDeleteViewTarget(null);
    setRenamingViewId(null);
    setIsRenamingView(false);
    if (isLastVisibleView) {
      const pos = typeof getPos === 'function' ? getPos() : null;
      if (typeof pos !== 'number') return;
      editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
      return;
    }
    mutate(current => deleteView(current, targetId));
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
    // 先打开面板，再异步补默认筛选条件，避免 mutate 重渲染触发假 mouseleave 立刻关掉面板。
    setActiveToolbarPanel(current => current === panel ? null : panel);
    if (opening && panel === 'filter' && !activeView.locked && !(activeView.filters || []).length && table.fields[0]) {
      const firstFieldId = table.fields[0].id;
      window.setTimeout(() => {
        mutate(current => {
          const view = current.views.find(item => item.id === activeView.id);
          if (!view || (view.filters || []).length) return current;
          return updateView(current, activeView.id, item => ({
            ...item,
            filters: [{ id: `filter_${Date.now().toString(36)}`, fieldId: firstFieldId, operator: 'equals', value: '' }],
          }));
        });
      }, 0);
    }
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
    if (activeView.locked) return '';
    let insertedId = '';
    mutate(current => {
      const currentVisibleRecords = visibleRecords(current, activeView);
      const seedFromRecord = currentVisibleRecords[currentVisibleRecords.length - 1] ?? null;
      const record = buildNewRecord(current, initialTitle, seedFromRecord);
      insertedId = record.id;
      // 同步写入 ref，确保 TipTap 同步重渲染时也能读到最新固定列表
      pinnedBottomRecordIdsRef.current = [
        ...pinnedBottomRecordIdsRef.current.filter(id => id !== record.id),
        record.id,
      ];
      return {
        ...current,
        records: insertRecordsIntoTable(current, [record], { mode: 'append' }),
      };
    });
    // 连续底部新增都固定在末尾；焦点离开这批新行后再按排序归位
    pinReleaseEnabledRef.current = false;
    setPinnedBottomVersion(version => version + 1);
    return insertedId;
  };

  const insertRecordRelative = (
    recordId: string,
    position: 'before' | 'after-subtree',
    count = 1,
    initialTitle = '',
  ) => {
    if (activeView.locked) return [];
    const insertedIds: string[] = [];
    mutate(current => {
      const recordsToInsert = Array.from({ length: count }, () => {
        const record = buildNewRecord(current, initialTitle);
        insertedIds.push(record.id);
        return record;
      });
      const nextRecords = insertRecordsIntoTable(
        current,
        recordsToInsert,
        { recordId, mode: position },
      );…25010 tokens truncated…eld-setting-item_wrapper`}>
                  <div className={`${settingPrefix}_setting_item field-setting-item`}>
                    <span className={`${settingPrefix}__field-setting-name ellipsis table-view-config-item__label`}>显示空分组</span>
                    <div className={`${settingPrefix}__field-setting-children`}>
                      <button
                        type="button"
                        className="bitable-common-hover-press-background icon-background bitable-layout-row bitable-layout-main-cross-center"
                        aria-label={config.showEmptyGroups === false ? '显示空分组' : '隐藏空分组'}
                        disabled={view.locked}
                        onClick={() => onConfig({ showEmptyGroups: config.showEmptyGroups === false })}
                      >
                        <span className="universe-icon setting_visible_icon">
                          {config.showEmptyGroups === false ? <GlyphInvisible size={16} /> : <GlyphVisible size={16} />}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
                {hiddenGroupChoices.length > 0 && (
                  <div className={`${settingPrefix}_setting_item_wrapper field-setting-item_wrapper`}>
                    <div className={`${settingPrefix}_setting_item field-setting-item bitable-card-config-hidden-groups`}>
                      <span className={`${settingPrefix}__field-setting-name ellipsis table-view-config-item__label`}>已隐藏分组</span>
                      <div className={`${settingPrefix}__field-setting-children bitable-card-config-hidden-groups__list`}>
                        {hiddenGroupChoices.map(choice => (
                          <button
                            type="button"
                            key={choice.id}
                            className="bitable-card-config-hidden-groups__item"
                            disabled={view.locked}
                            onClick={() => onConfig({ hiddenGroupIds: (config.hiddenGroupIds || []).filter(id => id !== choice.id) })}
                          >
                            {choice.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div className={`${settingPrefix}_setting_item_wrapper field-setting-item_wrapper`}>
                  <div className={`${settingPrefix}_setting_item field-setting-item`}>
                    <span className={`${settingPrefix}__field-setting-name ellipsis table-view-config-item__label`}>新建记录按钮</span>
                    <div className={`${settingPrefix}__field-setting-children`}>
                      <button
                        type="button"
                        className="bitable-common-hover-press-background icon-background bitable-layout-row bitable-layout-main-cross-center"
                        aria-label={config.showNewRecordButton === false ? '显示新建记录按钮' : '隐藏新建记录按钮'}
                        disabled={view.locked}
                        onClick={() => onConfig({ showNewRecordButton: config.showNewRecordButton === false })}
                      >
                        <span className="universe-icon setting_visible_icon">
                          {config.showNewRecordButton === false ? <GlyphInvisible size={16} /> : <GlyphVisible size={16} />}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
                <div className={`${settingPrefix}_setting_item_wrapper field-setting-item_wrapper`}>
                  <div className={`${settingPrefix}_setting_item field-setting-item`}>
                    <span className={`${settingPrefix}__field-setting-name ellipsis table-view-config-item__label`}>新建分组</span>
                    <div className={`${settingPrefix}__field-setting-children`}>
                      <button
                        type="button"
                        className="bitable-common-hover-press-background icon-background bitable-layout-row bitable-layout-main-cross-center"
                        aria-label={config.showCreateGroup === false ? '显示新建分组' : '隐藏新建分组'}
                        disabled={view.locked}
                        onClick={() => onConfig({ showCreateGroup: config.showCreateGroup === false })}
                      >
                        <span className="universe-icon setting_visible_icon">
                          {config.showCreateGroup === false ? <GlyphInvisible size={16} /> : <GlyphVisible size={16} />}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
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
            {cardFields.map((field, index) => {
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
  return (
    <div
      className={`base-filter-tdesign-select-wrap${className ? ` ${className}` : ''}`}
      onMouseDown={event => event.stopPropagation()}
    >
      <Select
        className="base-filter-tdesign-select"
        size="small"
        disabled={disabled}
        value={value}
        options={options.map(option => ({ label: option.label, value: option.value }))}
        popupProps={BITABLE_TD_SELECT_POPUP_PROPS}
        onChange={next => onChange(String(next ?? '') as T)}
      />
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
  return (
    <div
      className="bitable-group-field-tdesign-select-wrap"
      onMouseDown={event => event.stopPropagation()}
    >
      <Select
        className="bitable-group-field-tdesign-select"
        size="small"
        disabled={disabled}
        value={value}
        options={options.map(option => ({ label: option.label, value: option.value }))}
        popupProps={BITABLE_TD_SELECT_POPUP_PROPS}
        onChange={next => onChange(String(next ?? '') as T)}
      />
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
          <Switch size="small" value={checked} disabled={disabled} onChange={onChange} />
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

function FieldConditionPicker({
  fields,
  disabled,
  onSelect,
}: {
  fields: BaseField[];
  disabled?: boolean;
  onSelect: (fieldId: string) => void;
}) {
  const [nonce, setNonce] = useState(0);
  const options = useMemo(
    () => fields.map(field => ({
      label: field.name,
      value: field.id,
      content: (
        <span className="bitable-td-field-option">
          <span className="bitable-td-field-option__icon" aria-hidden>{fieldTypeGlyph(field.type, 14)}</span>
          <span className="bitable-td-field-option__text">{field.name}</span>
        </span>
      ),
    })),
    [fields],
  );

  return (
    <div
      className="bitable-field-condition-tdesign-wrap"
      onMouseDown={event => event.stopPropagation()}
    >
      <Select
        key={nonce}
        className="bitable-field-condition-tdesign-select"
        size="small"
        filterable
        disabled={disabled || !fields.length}
        placeholder="选择条件"
        options={options}
        popupProps={BITABLE_TD_SELECT_POPUP_PROPS}
        onChange={value => {
          if (value == null || value === '') return;
          onSelect(String(value));
          setNonce(current => current + 1);
        }}
      />
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
  portalAnchorRef,
  panelHoverProps,
  table,
  view,
  onTable,
}: {
  panelRef: RefObject<HTMLDivElement>;
  portalAnchorRef?: RefObject<HTMLElement | null>;
  panelHoverProps?: { onMouseEnter?: () => void; onMouseLeave?: (event: MouseEvent<HTMLElement>) => void };
  table: BaseTable;
  view: BaseView;
  onTable: (update: (table: BaseTable) => BaseTable) => void;
}) {
  const portal = Boolean(portalAnchorRef);
  const groupRuleCount = resolveGridGroupRules(view).length;
  const portalWidth = groupRuleCount > 0 ? 480 : 320;
  const portalStyle = useBitableToolbarPortalStyle(portal, portalAnchorRef, panelRef, portalWidth, groupRuleCount > 0 ? 320 : 160);
  const panel = (
    <div
      ref={panelRef}
      className={`bitable-group b-ud-scrollbar bitable-group-panel${portal ? ' bitable-group-panel--portal' : ''}${groupRuleCount === 0 ? ' bitable-group-panel--empty' : ''}`}
      data-e2e="bitable-group-config-panel"
      data-no-marquee-selection="true"
      data-floating-panel="true"
      style={portalStyle}
      onMouseDown={event => event.stopPropagation()}
      onMouseEnter={panelHoverProps?.onMouseEnter}
      onMouseLeave={panelHoverProps?.onMouseLeave}
    >
      <GridGroupPanelContent table={table} view={view} onTable={onTable} />
    </div>
  );
  return portal ? createPortal(panel, document.body) : panel;
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
  portalAnchorRef,
  panelHoverProps,
  table,
  view,
  onTable,
}: {
  panelRef: RefObject<HTMLDivElement>;
  portalAnchorRef?: RefObject<HTMLElement | null>;
  panelHoverProps?: { onMouseEnter?: () => void; onMouseLeave?: (event: MouseEvent<HTMLElement>) => void };
  table: BaseTable;
  view: BaseView;
  onTable: (update: (table: BaseTable) => BaseTable) => void;
}) {
  const portal = Boolean(portalAnchorRef);
  const sortCount = (view.sorts || []).length;
  const portalWidth = sortCount > 0 ? 480 : 360;
  const portalStyle = useBitableToolbarPortalStyle(portal, portalAnchorRef, panelRef, portalWidth, sortCount > 0 ? 320 : 180);
  const panel = (
    <div
      ref={panelRef}
      className={`bitable-group b-ud-scrollbar bitable-sort-panel${portal ? ' bitable-sort-panel--portal' : ''}${sortCount === 0 ? ' bitable-sort-panel--empty' : ''}`}
      data-e2e="bitable-sort-config-panel"
      data-no-marquee-selection="true"
      data-floating-panel="true"
      style={portalStyle}
      onMouseDown={event => event.stopPropagation()}
      onMouseEnter={panelHoverProps?.onMouseEnter}
      onMouseLeave={panelHoverProps?.onMouseLeave}
    >
      <SortPanelContent table={table} view={view} onTable={onTable} />
    </div>
  );
  return portal ? createPortal(panel, document.body) : panel;
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
  portalAnchorRef,
  panelHoverProps,
  onClose,
  onTable,
}: {
  panel: ToolbarPanel;
  table: BaseTable;
  view: BaseView;
  records: BaseRecord[];
  panelRef: RefObject<HTMLDivElement>;
  portalAnchorRef?: RefObject<HTMLElement | null>;
  panelHoverProps?: { onMouseEnter?: () => void; onMouseLeave?: (event: MouseEvent<HTMLElement>) => void };
  onClose: () => void;
  onTable: (update: (table: BaseTable) => BaseTable) => void;
}) {
  const filters = view.filters || [];
  const portal = Boolean(portalAnchorRef);
  const portalWidth = panel === 'filter' || panel === 'group' || panel === 'sort' ? 480 : panel === 'share' || panel === 'comment' ? 240 : 280;
  const portalStyle = useBitableToolbarPortalStyle(
    portal,
    portalAnchorRef,
    panelRef,
    portalWidth,
    panel === 'filter' ? 160 : 280,
  );

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
    portal ? 'base-toolbar-panel--portal' : '',
  ].filter(Boolean).join(' ');

  const panelNode = (
    <div
      ref={panelRef}
      className={panelClassName}
      data-no-marquee-selection="true"
      data-floating-panel="true"
      style={portalStyle}
      onMouseDown={event => event.stopPropagation()}
      onMouseEnter={panelHoverProps?.onMouseEnter}
      onMouseLeave={panelHoverProps?.onMouseLeave}
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
                style={{
                  display: 'grid',
                  gridTemplateColumns: needsValue ? '140px 112px minmax(0, 1fr) 24px' : '140px 112px 24px',
                  alignItems: 'center',
                  gap: 8,
                }}
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
                  <div className="base-toolbar-panel__filter-value-wrap" onMouseDown={event => event.stopPropagation()}>
                    <input
                      className="base-toolbar-panel__filter-value"
                      disabled={view.locked}
                      value={rule.value || ''}
                      placeholder="请输入"
                      onChange={event => updateFilter(rule.id, { value: event.target.value })}
                    />
                    <button
                      type="button"
                      className="base-toolbar-panel__filter-value-clear"
                      aria-label="清空"
                      disabled={view.locked || !rule.value}
                      onClick={() => updateFilter(rule.id, { value: '' })}
                    >
                      ×
                    </button>
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

  return portal ? createPortal(panelNode, document.body) : panelNode;
}

function GallerySettings({
  panelRef,
  table,
  view,
  config,
  onClose,
  onConfig,
  onTable,
  onEnsureAttachmentField,
}: {
  panelRef: RefObject<HTMLDivElement>;
  table: BaseTable;
  view: BaseView;
  config: GalleryViewConfig;
  onClose: () => void;
  onConfig: (patch: Partial<GalleryViewConfig>) => void;
  onTable: (update: (table: BaseTable) => BaseTable) => void;
  onEnsureAttachmentField: () => string;
}) {
  const attachmentFields = table.fields.filter(field => field.type === 'attachment');
  const groupFields = table.fields.filter(field => (
    field.type === 'text' || field.type === 'single_select' || field.type === 'number'
  ));
  const filterFieldId = view.filters?.[0]?.fieldId || '';
  const filterValue = view.filters?.[0]?.value || '';

  const updateFilters = (fieldId: string, value: string) => {
    if (view.locked) return;
    onTable(current => updateView(current, view.id, item => ({
      ...item,
      filters: fieldId
        ? [{ id: item.filters?.[0]?.id || `filter_${Date.now().toString(36)}`, fieldId, operator: 'contains', value }]
        : [],
    })));
  };

  return (
    <aside
      ref={panelRef}
      className="base-settings base-settings--gallery"
      data-no-marquee-selection="true"
      data-floating-panel="true"
      onMouseDown={event => event.stopPropagation()}
    >
      <header>
        <strong>画册设置</strong>
        <button type="button" onClick={onClose}>×</button>
      </header>

      <label>
        封面字段
        <select
          disabled={view.locked || attachmentFields.length === 0}
          value={config.coverFieldId || ''}
          onChange={event => onConfig({ coverFieldId: event.target.value || undefined })}
        >
          <option value="">未选择</option>
          {attachmentFields.map(field => (
            <option key={field.id} value={field.id}>{field.name}</option>
          ))}
        </select>
      </label>

      {attachmentFields.length === 0 && (
        <div className="base-settings__hint">
          当前没有附件字段
          <button
            type="button"
            disabled={view.locked}
            onClick={() => {
              const fieldId = onEnsureAttachmentField();
              onConfig({ coverFieldId: fieldId });
            }}
          >
            创建附件字段
          </button>
        </div>
      )}

      <label>
        卡片尺寸
        <select
          disabled={view.locked}
          value={config.cardSize || 'medium'}
          onChange={event => onConfig({ cardSize: event.target.value as GalleryViewConfig['cardSize'] })}
        >
          <option value="small">小</option>
          <option value="medium">中</option>
          <option value="large">大</option>
        </select>
      </label>

      <label>
        封面比例
        <select
          disabled={view.locked}
          value={config.cardAspectRatio || '4:3'}
          onChange={event => onConfig({
            cardAspectRatio: event.target.value as GalleryViewConfig['cardAspectRatio'],
          })}
        >
          <option value="1:1">1:1</option>
          <option value="4:3">4:3</option>
          <option value="16:9">16:9</option>
          <option value="auto">自动</option>
        </select>
      </label>

      <label>
        分组字段
        <select
          disabled={view.locked}
          value={config.groupByFieldId || ''}
          onChange={event => onConfig({ groupByFieldId: event.target.value || undefined })}
        >
          <option value="">不分组</option>
          {groupFields.map(field => (
            <option key={field.id} value={field.id}>{field.name}</option>
          ))}
        </select>
      </label>

      <label>
        筛选字段
        <select
          disabled={view.locked}
          value={filterFieldId}
          onChange={event => updateFilters(event.target.value, filterValue)}
        >
          <option value="">不筛选</option>
          {table.fields.map(field => (
            <option key={field.id} value={field.id}>{field.name}</option>
          ))}
        </select>
      </label>

      <label>
        筛选内容
        <input
          disabled={view.locked || !filterFieldId}
          placeholder="包含内容"
          value={filterValue}
          onChange={event => updateFilters(filterFieldId, event.target.value)}
        />
      </label>

      <label>
        搜索记录
        <input
          disabled={view.locked}
          placeholder="搜索记录"
          value={config.search || ''}
          onChange={event => onConfig({ search: event.target.value })}
        />
      </label>

      <footer>
        <button
          type="button"
          onClick={() => onTable(current => updateView(current, view.id, item => ({
            ...item,
            locked: !item.locked,
          })))}
        >
          {view.locked ? '解锁视图' : '锁定视图'}
        </button>
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
  onEnsureDateFields,
}: {
  table: BaseTable;
  view: BaseView;
  config: GanttViewConfig;
  panelRef: RefObject<HTMLDivElement>;
  onClose: () => void;
  onConfig: (patch: Partial<GanttViewConfig>) => void;
  onTable: (update: (table: BaseTable) => BaseTable) => void;
  onEnsureDateFields: () => { startDateFieldId: string; endDateFieldId: string };
}) {
  const dateFields = table.fields.filter(field => field.type === 'date');
  const titleOptions = table.fields
    .filter(field => field.type !== 'attachment')
    .map(field => ({ label: field.name, value: field.id }));
  const dateOptions = dateFields.map(field => ({ label: field.name, value: field.id }));
  const sortOptions = [
    { label: '不排序', value: '' },
    ...table.fields.map(field => ({ label: field.name, value: field.id })),
  ];
  const scaleOptions = [
    { label: '周', value: 60 },
    { label: '月', value: 40 },
    { label: '季', value: 24 },
    { label: '年', value: 12 },
  ];

  return (
    <aside
      ref={panelRef}
      className="base-settings base-settings--tdesign base-settings--gantt"
      data-no-marquee-selection="true"
      data-floating-panel="true"
      onMouseDown={event => event.stopPropagation()}
    >
      <header><strong>甘特设置</strong><button type="button" onClick={onClose}>×</button></header>
      <label>
        视图名称
        <Input
          size="small"
          disabled={view.locked}
          value={view.name}
          onChange={value => onTable(current => updateView(current, view.id, item => ({ ...item, name: String(value ?? '') })))}
        />
      </label>
      <label>
        搜索记录
        <Input
          size="small"
          disabled={view.locked}
          placeholder="搜索记录"
          value={String(config.search || '')}
          onChange={value => onConfig({ search: String(value ?? '') })}
        />
      </label>
      <label>
        任务名称字段
        <Select
          size="small"
          disabled={view.locked}
          value={config.titleFieldId || table.primaryFieldId}
          options={titleOptions}
          popupProps={BITABLE_TD_SELECT_POPUP_PROPS}
          onChange={value => onConfig({ titleFieldId: String(value ?? '') })}
        />
      </label>
      {dateFields.length === 0 && (
        <div className="base-settings__hint">
          当前没有日期字段
          <button
            type="button"
            disabled={view.locked}
            onClick={() => {
              const ids = onEnsureDateFields();
              onConfig({ startDateFieldId: ids.startDateFieldId, endDateFieldId: ids.endDateFieldId });
            }}
          >
            创建日期字段
          </button>
        </div>
      )}
      <div className="base-settings__row">
        <label>
          开始日期
          <Select
            size="small"
            disabled={view.locked || dateOptions.length === 0}
            value={config.startDateFieldId || dateOptions[0]?.value || ''}
            options={dateOptions}
            popupProps={BITABLE_TD_SELECT_POPUP_PROPS}
            onChange={value => onConfig({ startDateFieldId: String(value ?? '') })}
          />
        </label>
        <label>
          结束日期
          <Select
            size="small"
            disabled={view.locked || dateOptions.length === 0}
            value={config.endDateFieldId || dateOptions[0]?.value || ''}
            options={dateOptions}
            popupProps={BITABLE_TD_SELECT_POPUP_PROPS}
            onChange={value => onConfig({ endDateFieldId: String(value ?? '') })}
          />
        </label>
      </div>
      <label>
        时间刻度
        <Select
          size="small"
          disabled={view.locked}
          value={config.dayWidth}
          options={scaleOptions}
          popupProps={BITABLE_TD_SELECT_POPUP_PROPS}
          onChange={value => onConfig({ dayWidth: Number(value) })}
        />
      </label>
      <label>
        排序字段
        <Select
          size="small"
          disabled={view.locked}
          value={view.sorts?.[0]?.fieldId || ''}
          options={sortOptions}
          popupProps={BITABLE_TD_SELECT_POPUP_PROPS}
          onChange={value => {
            if (view.locked) return;
            const fieldId = String(value ?? '');
            onTable(current => updateView(current, view.id, item => ({
              ...item,
              sorts: fieldId ? [{ fieldId, direction: item.sorts?.[0]?.direction || 'asc' }] : [],
            })));
          }}
        />
      </label>
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
  };

  const selectField = (fieldId: string) => {
    if (view.locked || !fieldId) return;
    onTable(current => updateView(current, view.id, item => ({
      ...item,
      config: { ...item.config, parentFieldId: fieldId },
    })));
  };

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
          <Select
            className="hierarchy-field-tdesign-select"
            size="small"
            disabled={view.locked}
            value={selectedField?.id || ''}
            options={relationFields.map(field => ({ label: field.name, value: field.id }))}
            placeholder="父记录"
            popupProps={BITABLE_TD_SELECT_POPUP_PROPS}
            panelBottomContent={(
              <button
                type="button"
                className="hierarchy-field-tdesign-create"
                disabled={view.locked}
                onMouseDown={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  createParentField();
                }}
              >
                + 新建父记录
              </button>
            )}
            onChange={value => selectField(String(value ?? ''))}
          />
        </div>
      </div>
    </div>
  );
}
