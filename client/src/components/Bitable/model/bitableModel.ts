export type BaseFieldType =
  | 'text'
  | 'rich_text'
  | 'number'
  | 'single_select'
  | 'multi_select'
  | 'date'
  | 'checkbox'
  | 'user'
  | 'attachment'
  | 'url'
  | 'phone'
  | 'email'
  | 'formula'
  | 'lookup'
  | 'relation'
  | 'created_time'
  | 'updated_time'
  | 'created_by'
  | 'updated_by';

export type BaseViewType = 'grid' | 'kanban' | 'calendar' | 'gallery' | 'gantt' | 'form';

export const SUPPORTED_VISIBLE_VIEW_TYPES: ReadonlySet<BaseViewType> = new Set(['grid', 'kanban', 'gallery', 'gantt']);

export function isViewTypeVisible(type: BaseViewType): boolean {
  return SUPPORTED_VISIBLE_VIEW_TYPES.has(type);
}

export function getVisibleViews(table: BaseTable): BaseView[] {
  return table.views.filter(view => isViewTypeVisible(view.type));
}

export type FieldId = string;
export type UserId = string;

export interface AttachmentValue {
  id: string;
  fileId: string;
  name: string;
  mimeType: string;
  extension: string;
  size: number;
  url?: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  uploadStatus?: 'uploading' | 'processing' | 'success' | 'failed';
  uploadProgress?: number;
  error?: string;
}

export type CellValue = string | number | boolean | string[] | AttachmentValue[] | null;

export interface SelectChoice {
  id: string;
  name: string;
  color: string;
}

export interface BaseField {
  id: FieldId;
  name: string;
  type: BaseFieldType;
  options?: { choices?: SelectChoice[] };
  hidden?: boolean;
  required?: boolean;
  defaultValue?: CellValue;
}

export interface BaseRecord {
  id: string;
  tableId: string;
  fields: Record<FieldId, CellValue>;
  createdAt: string;
  updatedAt: string;
  createdBy: UserId;
  updatedBy?: UserId;
  parentId?: string;
  history?: RecordHistoryEntry[];
  comments?: RecordComment[];
}

export interface RecordHistoryEntry {
  id: string;
  time: string;
  operatorId: UserId;
  operatorName: string;
  fieldId: FieldId;
  fieldName: string;
  before: CellValue;
  after: CellValue;
}

export interface RecordComment {
  id: string;
  content: string;
  author: string;
  createdAt: string;
}

export type FilterOperator = 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'is_empty' | 'is_not_empty';

export interface FilterRule {
  id: string;
  fieldId: FieldId;
  operator: FilterOperator;
  value?: string;
}

export function isFilterRuleActive(rule: FilterRule): boolean {
  if (rule.operator === 'is_empty' || rule.operator === 'is_not_empty') return true;
  return String(rule.value || '').trim().length > 0;
}

export interface SortRule {
  fieldId: FieldId;
  direction: 'asc' | 'desc';
}

export interface GalleryViewConfig {
  coverFieldId?: FieldId;
  titleFieldId?: FieldId;
  visibleFieldIds: FieldId[];
  coverFit: 'cover' | 'contain';
  coverPosition?: 'center' | 'top' | 'bottom';
  cardSize: 'small' | 'medium' | 'large';
  cardLayoutMode?: 'regular' | 'compact';
  cardAspectRatio: '1:1' | '4:3' | '16:9' | 'auto';
  showFieldNames: boolean;
  showEmptyFields: boolean;
  showAttachmentCount: boolean;
  showRecordActions: boolean;
  groupByFieldId?: FieldId;
  groupOrderIds?: string[];
  hiddenGroupIds?: string[];
  showEmptyGroups?: boolean;
  showCreateGroup?: boolean;
  showNewRecordButton?: boolean;
  emptyCoverMode: 'placeholder' | 'hide-cover';
  search?: string;
}

export type GridRowHeightMode = 'low' | 'medium' | 'high';

export const GRID_ROW_HEIGHT_PRESETS: Record<GridRowHeightMode, number> = {
  low: 32,
  medium: 56,
  high: 88,
};

export function resolveGridRowHeight(config?: GridViewConfig): number {
  const mode = config?.rowHeight || 'low';
  return GRID_ROW_HEIGHT_PRESETS[mode] ?? GRID_ROW_HEIGHT_PRESETS.low;
}

export interface GridViewConfig {
  search?: string;
  fieldWidths?: Record<FieldId, number>;
  rowHeight?: GridRowHeightMode;
  parentFieldId?: FieldId;
  groupByFieldIds?: FieldId[];
  groupSortDirections?: ('asc' | 'desc')[];
}

export type GridDisplayRow =
  | {
      kind: 'group';
      key: string;
      level: number;
      fieldId: FieldId;
      fieldName: string;
      label: string;
      count: number;
    }
  | { kind: 'record'; record: BaseRecord };

export function getGridGroupFieldIds(view: BaseView): FieldId[] {
  if (view.type !== 'grid') return [];
  return resolveGridGroupRules(view).map(rule => rule.fieldId);
}

export function resolveGridGroupRules(view: BaseView): { fieldId: FieldId; direction: 'asc' | 'desc' }[] {
  if (view.type !== 'grid') return [];
  const config = view.config as GridViewConfig & { groupByFieldId?: FieldId };
  let fieldIds = Array.isArray(config.groupByFieldIds) ? config.groupByFieldIds : [];
  if (!fieldIds.length && config.groupByFieldId) {
    fieldIds = [config.groupByFieldId];
  }
  const directions = Array.isArray(config.groupSortDirections) ? config.groupSortDirections : [];
  return fieldIds.map((fieldId, index) => ({
    fieldId,
    direction: directions[index] === 'desc' ? 'desc' : 'asc',
  }));
}

export function normalizeGridGroupConfig(config: GridViewConfig, fields: BaseField[]): GridViewConfig {
  const nextConfig = { ...config } as GridViewConfig & { groupByFieldId?: FieldId };
  let fieldIds = Array.isArray(config.groupByFieldIds) ? [...config.groupByFieldIds] : [];
  if (!fieldIds.length && nextConfig.groupByFieldId) {
    fieldIds = [nextConfig.groupByFieldId];
  }
  delete nextConfig.groupByFieldId;
  fieldIds = fieldIds.filter(fieldId => fields.some(field => field.id === fieldId));
  const directions = Array.isArray(config.groupSortDirections) ? config.groupSortDirections : [];
  if (!fieldIds.length) {
    delete nextConfig.groupByFieldIds;
    delete nextConfig.groupSortDirections;
    return nextConfig;
  }
  nextConfig.groupByFieldIds = fieldIds;
  nextConfig.groupSortDirections = fieldIds.map((_, index) => (
    directions[index] === 'desc' ? 'desc' : 'asc'
  ));
  return nextConfig;
}

export function hasActiveGridGroups(view: BaseView): boolean {
  return getGridGroupFieldIds(view).length > 0;
}

export function hasActiveSorts(view: BaseView): boolean {
  return (view.sorts || []).length > 0;
}

export function getEffectiveSorts(view: BaseView): SortRule[] {
  if (view.autoSort === false) return [];
  return view.sorts || [];
}

function compareGroupLabels(
  left: string,
  right: string,
  field: BaseField | undefined,
  direction: 'asc' | 'desc',
): number {
  if (field && (field.type === 'single_select' || field.type === 'multi_select')) {
    const choices = field.options?.choices ?? [];
    const resolveOrder = (label: string) => {
      const index = choices.findIndex(choice => choice.name === label || choice.id === label);
      return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
    };
    const orderDiff = resolveOrder(left) - resolveOrder(right);
    if (orderDiff !== 0) {
      return direction === 'asc' ? orderDiff : -orderDiff;
    }
  }
  const result = left.localeCompare(right, 'zh-CN', { numeric: true });
  return direction === 'asc' ? result : -result;
}

export function buildGridDisplayRows(
  table: BaseTable,
  records: BaseRecord[],
  groupFieldIds: FieldId[],
  collapsedKeys: ReadonlySet<string>,
  groupSortDirections: ('asc' | 'desc')[] = [],
  view?: BaseView,
): GridDisplayRow[] {
  const resolvedRules = view?.type === 'grid'
    ? resolveGridGroupRules(view)
    : groupFieldIds.map((fieldId, index) => ({
      fieldId,
      direction: groupSortDirections[index] === 'desc' ? 'desc' as const : 'asc' as const,
    }));
  const normalizedFieldIds = resolvedRules.map(rule => rule.fieldId);
  const normalizedDirections = resolvedRules.map(rule => rule.direction);
  if (!normalizedFieldIds.length) {
    return records.map(record => ({ kind: 'record', record }));
  }

  const rows: GridDisplayRow[] = [];

  const appendGrouped = (groupRecords: BaseRecord[], level: number) => {
    if (level >= normalizedFieldIds.length) {
      groupRecords.forEach(record => rows.push({ kind: 'record', record }));
      return;
    }
    const fieldId = normalizedFieldIds[level];
    const field = table.fields.find(item => item.id === fieldId);
    const groups = new Map<string, BaseRecord[]>();
    groupRecords.forEach(record => {
      const label = valueText(record.fields[fieldId]) || '未分组';
      const bucket = groups.get(label) || [];
      bucket.push(record);
      groups.set(label, bucket);
    });
    [...groups.entries()]
      .sort(([left], [right]) => compareGroupLabels(left, right, field, normalizedDirections[level] ?? 'asc'))
      .forEach(([label, bucket]) => {
        const key = `${level}:${fieldId}:${label}`;
        rows.push({
          kind: 'group',
          key,
          level,
          fieldId,
          fieldName: field?.name || '字段',
          label,
          count: bucket.length,
        });
        if (!collapsedKeys.has(key)) appendGrouped(bucket, level + 1);
      });
  };

  appendGrouped(records, 0);
  return rows;
}

export interface GanttViewConfig {
  titleFieldId?: FieldId;
  startDateFieldId?: FieldId;
  endDateFieldId?: FieldId;
  dayWidth: number;
  search?: string;
}

export interface BaseView {
  id: string;
  tableId: string;
  name: string;
  type: BaseViewType;
  config: GalleryViewConfig | GridViewConfig | GanttViewConfig;
  filters?: FilterRule[];
  sorts?: SortRule[];
  autoSort?: boolean;
  hiddenFieldIds?: FieldId[];
  fieldOrder?: FieldId[];
  locked?: boolean;
}

export interface BaseTable {
  id: string;
  name: string;
  fields: BaseField[];
  records: BaseRecord[];
  views: BaseView[];
  primaryFieldId: FieldId;
  activeViewId: string;
}

type LegacyAttrs = Record<string, unknown>;

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function now() {
  return new Date().toISOString();
}

export const DEFAULT_RECORD_OPERATOR = '张正亮';

export function formatHistoryCellValue(value: CellValue): string {
  if (value == null || value === '') return '-';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (Array.isArray(value)) {
    if (value.length === 0) return '-';
    if (typeof value[0] === 'object') return `${value.length} 个附件`;
    return value.map(item => String(item)).join(', ');
  }
  return String(value);
}

export function formatHistoryTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--:--';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function formatCardDateValue(value: CellValue) {
  const text = valueText(value);
  if (!text) return '';
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

export function textColorForBackground(hex: string) {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return '#1f2329';
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 170 ? '#1f2329' : '#fff';
}

export function findSelectChoice(field: BaseField, value: string): SelectChoice | null {
  const choices = field.options?.choices ?? [];
  return choices.find(choice => choice.id === value)
    ?? choices.find(choice => choice.name === value)
    ?? null;
}

/** 多选单元格统一按选项 id 读写，兼容旧数据里存的 name。 */
export function normalizeMultiSelectIds(field: BaseField, value: CellValue): string[] {
  const choices = field.options?.choices ?? [];
  if (!choices.length) return [];

  let raw: string[] = [];
  if (Array.isArray(value) && value.length && typeof value[0] !== 'object') {
    raw = (value as string[]).map(item => String(item).trim()).filter(Boolean);
  } else if (value != null && value !== '') {
    raw = valueText(value).split(',').map(item => item.trim()).filter(Boolean);
  }
  if (!raw.length) return [];

  const byId = new Map(choices.map(choice => [choice.id, choice]));
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    let choice: SelectChoice | undefined;
    if (byId.has(item)) {
      choice = byId.get(item);
    } else {
      const nameMatches = choices.filter(entry => entry.name === item);
      if (nameMatches.length === 1) {
        choice = nameMatches[0];
      } else if (nameMatches.length > 1) {
        choice = nameMatches.find(entry => !seen.has(entry.id)) ?? nameMatches[0];
      }
    }
    if (choice && !seen.has(choice.id)) {
      seen.add(choice.id);
      ids.push(choice.id);
    }
  }
  return ids;
}

export function getMultiSelectChoices(field: BaseField, value: CellValue): SelectChoice[] {
  const choices = field.options?.choices ?? [];
  return normalizeMultiSelectIds(field, value)
    .map(id => choices.find(choice => choice.id === id))
    .filter((choice): choice is SelectChoice => Boolean(choice));
}

export function multiSelectDisplayText(field: BaseField, value: CellValue): string {
  return getMultiSelectChoices(field, value).map(choice => choice.name).join(', ');
}

export function createRecordComment(content: string, author = DEFAULT_RECORD_OPERATOR): RecordComment {
  return {
    id: uid('rcmt'),
    content: content.trim(),
    author,
    createdAt: now(),
  };
}

export function appendRecordHistory(
  record: BaseRecord,
  fieldId: FieldId,
  fieldName: string,
  before: CellValue,
  after: CellValue,
  operatorName = DEFAULT_RECORD_OPERATOR,
): BaseRecord {
  if (JSON.stringify(before) === JSON.stringify(after)) return record;
  const entry: RecordHistoryEntry = {
    id: uid('hist'),
    time: now(),
    operatorId: record.updatedBy || record.createdBy || 'local-user',
    operatorName,
    fieldId,
    fieldName,
    before,
    after,
  };
  return {
    ...record,
    updatedAt: entry.time,
    updatedBy: entry.operatorId,
    history: [entry, ...(record.history ?? [])],
  };
}

function parseArray<T>(value: unknown, fallback: T[]): T[] {
  if (typeof value !== 'string') return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as T[] : fallback;
  } catch {
    return fallback;
  }
}

export function createGalleryConfig(fields: BaseField[], primaryFieldId: string): GalleryViewConfig {
  const attachmentField = fields.find(field => field.type === 'attachment');
  return {
    coverFieldId: attachmentField?.id,
    titleFieldId: primaryFieldId,
    visibleFieldIds: fields.filter(field => field.id !== primaryFieldId && field.type !== 'attachment').slice(0, 3).map(field => field.id),
    coverFit: 'cover',
    coverPosition: 'center',
    cardSize: 'medium',
    cardLayoutMode: 'regular',
    cardAspectRatio: '4:3',
    showFieldNames: false,
    showEmptyFields: false,
    showAttachmentCount: true,
    showRecordActions: false,
    showEmptyGroups: true,
    showCreateGroup: true,
    showNewRecordButton: true,
    emptyCoverMode: 'placeholder',
  };
}

export function resolveGalleryVisibleFieldIds(
  fields: BaseField[],
  primaryFieldId: FieldId,
  config: GalleryViewConfig,
): FieldId[] {
  const defaults = createGalleryConfig(fields, primaryFieldId);
  const visible = (config.visibleFieldIds || []).filter(id => fields.some(field => field.id === id));
  const fieldIds = visible.length ? visible : defaults.visibleFieldIds;
  const reserved = new Set<FieldId>([
    config.titleFieldId || primaryFieldId,
    config.coverFieldId,
    config.groupByFieldId,
  ].filter((id): id is FieldId => Boolean(id)));
  return fieldIds.filter(fieldId => !reserved.has(fieldId));
}

export function createGanttConfig(fields: BaseField[], primaryFieldId: string): GanttViewConfig {
  const dateFields = fields.filter(field => field.type === 'date');
  return {
    titleFieldId: primaryFieldId,
    startDateFieldId: dateFields[0]?.id,
    endDateFieldId: dateFields[1]?.id || dateFields[0]?.id,
    dayWidth: 40,
  };
}

export function createBaseTable(initialView: 'grid' | 'gallery' | 'gantt' | 'kanban' = 'gallery'): BaseTable {
  const tableId = uid('tbl');
  const titleId = uid('fld_title');
  const attachmentId = uid('fld_attachment');
  const statusId = uid('fld_status');
  const noteId = uid('fld_note');
  const startDateId = uid('fld_start_date');
  const endDateId = uid('fld_end_date');
  const fields: BaseField[] = initialView === 'grid' ? [
    { id: titleId, name: '任务名', type: 'text', required: true },
    {
      id: statusId,
      name: '任务状态',
      type: 'single_select',
      options: { choices: [{ id: 'todo', name: '未开始', color: '#dee8ff' }, { id: 'doing', name: '进行中', color: '#f8e6c2' }, { id: 'done', name: '已完成', color: '#c7effb' }] },
    },
    { id: noteId, name: '备注', type: 'text' },
    { id: startDateId, name: '开始日期', type: 'date' },
    { id: endDateId, name: '截止日期', type: 'date' },
  ] : [
    { id: titleId, name: '名称', type: 'text', required: true },
    { id: attachmentId, name: '附件', type: 'attachment' },
    {
      id: statusId,
      name: '状态',
      type: 'single_select',
      options: { choices: [{ id: 'todo', name: '未开始', color: '#dee8ff' }, { id: 'doing', name: '进行中', color: '#f8e6c2' }, { id: 'done', name: '已完成', color: '#c7effb' }] },
    },
    { id: startDateId, name: '开始日期', type: 'date' },
    { id: endDateId, name: '结束日期', type: 'date' },
  ];
  const records = Array.from({ length: 3 }, (_, index) => createRecord(tableId, fields, titleId, initialView === 'grid' ? `任务 ${index + 1}` : `卡片 ${index + 1}`));
  if (initialView === 'grid') {
    const statuses = ['未开始', '进行中', '已完成'];
    const starts = ['2026/05/25', '2026/05/27', '2026/05/29'];
    const ends = ['2026/05/28', '2026/05/30', '2026/06/01'];
    records.forEach((record, index) => {
      record.fields[statusId] = statuses[index] || '';
      record.fields[noteId] = '';
      record.fields[startDateId] = starts[index] || '';
      record.fields[endDateId] = ends[index] || '';
    });
  }
  if (initialView === 'gantt') {
    const base = new Date();
    records.forEach((record, index) => {
      const start = new Date(base);
      start.setDate(base.getDate() + index * 2);
      const end = new Date(start);
      end.setDate(start.getDate() + 3);
      record.fields[startDateId] = start.toISOString().slice(0, 10);
      record.fields[endDateId] = end.toISOString().slice(0, 10);
      record.fields[titleId] = `任务 ${index + 1}`;
      record.fields[statusId] = '未开始';
    });
  }
  if (initialView === 'kanban') {
    records.forEach((record, index) => {
      record.fields[titleId] = `任务 ${index + 1}`;
      record.fields[statusId] = '未开始';
    });
  }
  if (initialView === 'gallery') {
    const statuses = ['未开始', '进行中', '已完成'];
    const starts = ['2026-06-01', '2026-06-03', '2026-06-05'];
    const ends = ['2026-06-09', '2026-06-11', '2026-06-13'];
    records.forEach((record, index) => {
      record.fields[statusId] = statuses[index] || '';
      record.fields[startDateId] = starts[index] || '';
      record.fields[endDateId] = ends[index] || '';
    });
  }
  const gridView: BaseView = { id: uid('view_grid'), tableId, name: '表格', type: 'grid', config: {}, sorts: [], filters: [] };
  const galleryView: BaseView = {
    id: uid('view_gallery'),
    tableId,
    name: '画册',
    type: 'gallery',
    config: createGalleryConfig(fields, titleId),
    sorts: [],
    filters: [],
  };
  const ganttView: BaseView = {
    id: uid('view_gantt'),
    tableId,
    name: '甘特图',
    type: 'gantt',
    config: createGanttConfig(fields, titleId),
    sorts: [],
    filters: [],
  };
  const kanbanView: BaseView = {
    id: uid('view_kanban'),
    tableId,
    name: '看板',
    type: 'kanban',
    config: createGalleryConfig(fields, titleId),
    sorts: [],
    filters: [],
  };
  const initial = initialView === 'gallery'
    ? galleryView
    : initialView === 'gantt'
    ? ganttView
    : initialView === 'kanban'
    ? kanbanView
    : gridView;
  return {
    id: tableId,
    name: '未命名多维表格',
    fields,
    records,
    views: [initial],
    primaryFieldId: titleId,
    activeViewId: initial.id,
  };
}

export function createRecord(tableId: string, fields: BaseField[], primaryFieldId: string, title = ''): BaseRecord {
  const time = now();
  const values: Record<string, CellValue> = {};
  fields.forEach(field => {
    values[field.id] = field.id === primaryFieldId ? title : field.defaultValue ?? (field.type === 'attachment' ? [] : '');
  });
  const primaryField = fields.find(field => field.id === primaryFieldId);
  const history: RecordHistoryEntry[] | undefined = title
    ? [{
        id: uid('hist'),
        time,
        operatorId: 'local-user',
        operatorName: DEFAULT_RECORD_OPERATOR,
        fieldId: primaryFieldId,
        fieldName: primaryField?.name ?? '文本',
        before: null,
        after: title,
      }]
    : undefined;
  return {
    id: uid('rec'),
    tableId,
    fields: values,
    createdAt: time,
    updatedAt: time,
    createdBy: 'local-user',
    history,
  };
}

function normalizeTable(raw: BaseTable): BaseTable {
  const tableId = raw.id || uid('tbl');
  const fields = Array.isArray(raw.fields) && raw.fields.length > 0 ? raw.fields : createBaseTable().fields;
  const primaryFieldId = fields.some(field => field.id === raw.primaryFieldId) ? raw.primaryFieldId : fields[0].id;
  const views: BaseView[] = Array.isArray(raw.views) && raw.views.length > 0 ? raw.views : [{
    id: uid('view_grid'),
    tableId,
    name: '表格',
    type: 'grid',
    config: {},
    filters: [],
    sorts: [],
  }];
  const normalizedViews = views.map(view => {
    if (view.type === 'gantt') {
      const config = view.config as Partial<GanttViewConfig>;
      const defaults = createGanttConfig(fields, primaryFieldId);
      return {
        ...view,
        tableId,
        filters: view.filters || [],
        sorts: view.sorts || [],
        config: {
          ...defaults,
          ...config,
          titleFieldId: fields.some(field => field.id === config.titleFieldId) ? config.titleFieldId : primaryFieldId,
          startDateFieldId: fields.some(field => field.id === config.startDateFieldId && field.type === 'date')
            ? config.startDateFieldId
            : defaults.startDateFieldId,
          endDateFieldId: fields.some(field => field.id === config.endDateFieldId && field.type === 'date')
            ? config.endDateFieldId
            : defaults.endDateFieldId,
          dayWidth: Math.max(24, Math.min(60, Number(config.dayWidth) || defaults.dayWidth)),
        },
      };
    }
    if (view.type === 'grid') {
      const config = view.config as Partial<GridViewConfig> | undefined;
      const fieldWidths = Object.fromEntries(
        Object.entries(config?.fieldWidths || {})
          .filter(([fieldId, width]) => fields.some(field => field.id === fieldId) && Number.isFinite(width))
          .map(([fieldId, width]) => [fieldId, Math.max(80, Math.min(420, Math.round(Number(width))))])
      );
      const normalizedConfig = normalizeGridGroupConfig(
        { ...(config || {}), fieldWidths },
        fields,
      );
      return { ...view, tableId, config: normalizedConfig, filters: view.filters || [], sorts: view.sorts || [] };
    }
    if (view.type !== 'gallery') return { ...view, tableId, config: view.config || {}, filters: view.filters || [], sorts: view.sorts || [] };
    const config = view.config as Partial<GalleryViewConfig>;
    const validCover = fields.some(field => field.id === config.coverFieldId && field.type === 'attachment');
    return {
      ...view,
      tableId,
      filters: view.filters || [],
      sorts: view.sorts || [],
      config: {
        ...createGalleryConfig(fields, primaryFieldId),
        ...config,
        coverFieldId: validCover ? config.coverFieldId : fields.find(field => field.type === 'attachment')?.id,
        titleFieldId: fields.some(field => field.id === config.titleFieldId) ? config.titleFieldId : primaryFieldId,
        visibleFieldIds: resolveGalleryVisibleFieldIds(fields, primaryFieldId, {
          ...createGalleryConfig(fields, primaryFieldId),
          ...config,
        } as GalleryViewConfig),
      },
    };
  });
  const records = (Array.isArray(raw.records) ? raw.records : []).map(record => ({
    ...record,
    tableId,
    parentId: typeof record.parentId === 'string' ? record.parentId : undefined,
    fields: fields.reduce<Record<string, CellValue>>((values, field) => {
      const value = record.fields?.[field.id];
      values[field.id] = value ?? (field.type === 'attachment' ? [] : '');
      return values;
    }, {}),
  }));
  const visibleViews = normalizedViews.filter(view => isViewTypeVisible(view.type));
  const activeCandidate = normalizedViews.find(view => view.id === raw.activeViewId);
  const activeViewId = activeCandidate && isViewTypeVisible(activeCandidate.type)
    ? activeCandidate.id
    : (visibleViews[0]?.id ?? normalizedViews[0]?.id);

  return {
    ...raw,
    id: tableId,
    name: raw.name || '多维表格',
    fields,
    records: normalizeRecordTreeOrder(records),
    views: normalizedViews,
    primaryFieldId,
    activeViewId,
  };
}

export function parseBaseTable(attrs: LegacyAttrs): BaseTable {
  if (typeof attrs.model === 'string' && attrs.model) {
    try {
      return normalizeTable(JSON.parse(attrs.model) as BaseTable);
    } catch {
      // Fall through to legacy migration.
    }
  }
  const legacyColumns = parseArray<string>(attrs.columns, ['字段 1', '字段 2', '字段 3']);
  const legacyRows = parseArray<string[]>(attrs.rows, [['', '', ''], ['', '', ''], ['', '', '']]);
  const covers = parseArray<string>(attrs.covers, []);
  const tableId = uid('tbl');
  const fields: BaseField[] = legacyColumns.map((name, index) => ({ id: uid(`fld_${index}`), name: name || `字段 ${index + 1}`, type: 'text' }));
  if (!fields.length) fields.push({ id: uid('fld_title'), name: '名称', type: 'text' });
  const attachmentField: BaseField = { id: uid('fld_attachment'), name: '附件', type: 'attachment' };
  fields.push(attachmentField);
  const records: BaseRecord[] = legacyRows.map((row, index) => {
    const record = createRecord(tableId, fields, fields[0].id, row[0] || `卡片 ${index + 1}`);
    legacyColumns.forEach((_, colIndex) => { record.fields[fields[colIndex].id] = row[colIndex] || ''; });
    if (covers[index]) {
      record.fields[attachmentField.id] = [{
        id: uid('att'),
        fileId: uid('file'),
        name: `封面 ${index + 1}`,
        mimeType: 'image/*',
        extension: '',
        size: 0,
        url: covers[index],
        thumbnailUrl: covers[index],
        uploadStatus: 'success',
      }];
    }
    return record;
  });
  const grid: BaseView = { id: uid('view_grid'), tableId, name: '表格', type: 'grid', config: {}, filters: [], sorts: [] };
  const gallery: BaseView = { id: uid('view_gallery'), tableId, name: '画册', type: 'gallery', config: createGalleryConfig(fields, fields[0].id), filters: [], sorts: [] };
  const legacyTitle = typeof attrs.title === 'string' ? attrs.title : '';
  const legacyGallery = attrs.view === 'gallery' || (!attrs.view && /画册|gallery/i.test(legacyTitle));
  return normalizeTable({
    id: tableId,
    name: legacyTitle && legacyTitle !== '画册' ? legacyTitle : '多维表格',
    fields,
    records: records.length ? records : [createRecord(tableId, fields, fields[0].id, '')],
    views: legacyGallery ? [gallery] : [grid],
    primaryFieldId: fields[0].id,
    activeViewId: legacyGallery ? gallery.id : grid.id,
  });
}

export function serializeBaseTable(table: BaseTable) {
  return JSON.stringify(normalizeTable(table));
}

export function getActiveView(table: BaseTable) {
  const active = table.views.find(view => view.id === table.activeViewId);
  if (active && isViewTypeVisible(active.type)) return active;
  return getVisibleViews(table)[0] || table.views[0];
}

export function getGalleryConfig(table: BaseTable, view: BaseView): GalleryViewConfig {
  const defaults = createGalleryConfig(table.fields, table.primaryFieldId);
  const raw = view.type === 'gallery' || view.type === 'kanban'
    ? (view.config as GalleryViewConfig)
    : defaults;
  const merged: GalleryViewConfig = { ...defaults, ...raw };
  const validCover = table.fields.some(field => field.id === merged.coverFieldId && field.type === 'attachment');
  return {
    ...merged,
    coverFieldId: validCover ? merged.coverFieldId : table.fields.find(field => field.type === 'attachment')?.id,
    titleFieldId: table.fields.some(field => field.id === merged.titleFieldId) ? merged.titleFieldId : table.primaryFieldId,
    visibleFieldIds: resolveGalleryVisibleFieldIds(table.fields, table.primaryFieldId, merged),
    showRecordActions: merged.showRecordActions ?? false,
  };
}

export function getGanttConfig(table: BaseTable, view: BaseView): GanttViewConfig {
  return view.type === 'gantt'
    ? view.config as GanttViewConfig
    : createGanttConfig(table.fields, table.primaryFieldId);
}

export const RECORD_TREE_INDENT = 18;

export function getRecordDepth(record: BaseRecord, records: BaseRecord[]): number {
  const byId = new Map(records.map(item => [item.id, item]));
  let depth = 0;
  let parentId = record.parentId;
  const seen = new Set<string>();
  while (parentId) {
    if (seen.has(parentId)) break;
    seen.add(parentId);
    depth += 1;
    parentId = byId.get(parentId)?.parentId;
  }
  return depth;
}

export function findInsertIndexAfterSubtree(records: BaseRecord[], parentIndex: number): number {
  if (parentIndex < 0 || parentIndex >= records.length) return records.length;
  const parentDepth = getRecordDepth(records[parentIndex], records);
  let index = parentIndex + 1;
  while (index < records.length && getRecordDepth(records[index], records) > parentDepth) {
    index += 1;
  }
  return index;
}

export function getRecordSubtreeRange(records: BaseRecord[], startIndex: number): { start: number; end: number } {
  if (startIndex < 0 || startIndex >= records.length) return { start: startIndex, end: startIndex };
  const rootDepth = getRecordDepth(records[startIndex], records);
  let end = startIndex + 1;
  while (end < records.length && getRecordDepth(records[end], records) > rootDepth) {
    end += 1;
  }
  return { start: startIndex, end };
}

export function getRecordSubtreeIds(records: BaseRecord[], startIndex: number): Set<string> {
  if (startIndex < 0 || startIndex >= records.length) return new Set();
  return collectRecordSubtreeIds(records, [records[startIndex].id]);
}

export function normalizeRecordTreeOrder(records: BaseRecord[]): BaseRecord[] {
  if (!records.length) return records;
  const recordById = new Map(records.map(record => [record.id, record]));
  const childrenByParent = new Map<string | null, BaseRecord[]>();

  records.forEach(record => {
    const parentKey = record.parentId && recordById.has(record.parentId) ? record.parentId : null;
    const siblings = childrenByParent.get(parentKey);
    if (siblings) siblings.push(record);
    else childrenByParent.set(parentKey, [record]);
  });

  const result: BaseRecord[] = [];
  const walk = (parentKey: string | null) => {
    const siblings = childrenByParent.get(parentKey);
    if (!siblings) return;
    siblings.forEach(record => {
      result.push(record);
      walk(record.id);
    });
  };
  walk(null);

  if (result.length !== records.length) {
    const used = new Set(result.map(record => record.id));
    records.forEach(record => {
      if (!used.has(record.id)) result.push(record);
    });
  }
  return result;
}

export function reorderRecordsInTree(records: BaseRecord[], fromIndex: number, toIndex: number): BaseRecord[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= records.length || toIndex >= records.length) {
    return records;
  }

  const root = records[fromIndex];
  const subtreeIds = getRecordSubtreeIds(records, fromIndex);
  const target = records[toIndex];

  if (subtreeIds.has(target.id) && target.id !== root.id) {
    return records;
  }

  const block = records.filter(record => subtreeIds.has(record.id));
  const remaining = records.filter(record => !subtreeIds.has(record.id));

  let insertAt = remaining.findIndex(record => record.id === target.id);
  if (insertAt < 0) return records;
  if (fromIndex < toIndex) insertAt += 1;

  const next = [
    ...remaining.slice(0, insertAt),
    ...block,
    ...remaining.slice(insertAt),
  ];
  return normalizeRecordTreeOrder(next);
}

export interface RecordTreeRowMeta {
  depth: number;
  guideContinues: boolean[];
  isLastChild: boolean;
  hasChildren: boolean;
  childCount: number;
}

export function recordHasChildren(recordId: string, records: BaseRecord[]): boolean {
  return records.some(record => record.parentId === recordId);
}

export function countDirectChildren(recordId: string, records: BaseRecord[]): number {
  return records.filter(record => record.parentId === recordId).length;
}

export function filterRecordsByCollapsedAncestors(records: BaseRecord[], collapsedIds: Set<string>): BaseRecord[] {
  if (!collapsedIds.size) return records;
  const byId = new Map(records.map(record => [record.id, record]));
  return records.filter(record => {
    let parentId = record.parentId;
    while (parentId) {
      if (collapsedIds.has(parentId)) return false;
      parentId = byId.get(parentId)?.parentId;
    }
    return true;
  });
}

export function getRootDisplayNumber(record: BaseRecord, displayRecords: BaseRecord[], allRecords: BaseRecord[]): number | null {
  if (getRecordDepth(record, allRecords) > 0) return null;
  let count = 0;
  for (const item of displayRecords) {
    if (getRecordDepth(item, allRecords) === 0) count += 1;
    if (item.id === record.id) return count;
  }
  return null;
}

export function buildRecordTreeMeta(displayRecords: BaseRecord[], allRecords: BaseRecord[]): RecordTreeRowMeta[] {
  const depths = displayRecords.map(record => getRecordDepth(record, allRecords));
  return displayRecords.map((record, index) => {
    const depth = depths[index];
    const guideContinues: boolean[] = [];
    for (let level = 0; level < depth; level += 1) {
      let continues = false;
      for (let j = index + 1; j < displayRecords.length; j += 1) {
        if (depths[j] <= level) break;
        if (depths[j] > level) {
          continues = true;
          break;
        }
      }
      guideContinues.push(continues);
    }
    let isLastChild = true;
    if (record.parentId) {
      for (let j = index + 1; j < displayRecords.length; j += 1) {
        if (depths[j] < depth) break;
        if (depths[j] === depth) {
          isLastChild = displayRecords[j].parentId !== record.parentId;
          break;
        }
      }
    }
    return {
      depth,
      guideContinues,
      isLastChild,
      hasChildren: recordHasChildren(record.id, allRecords),
      childCount: countDirectChildren(record.id, allRecords),
    };
  });
}

export function collectRecordSubtreeIds(records: BaseRecord[], rootIds: string[]): Set<string> {
  const ids = new Set(rootIds);
  let changed = true;
  while (changed) {
    changed = false;
    records.forEach(record => {
      if (record.parentId && ids.has(record.parentId) && !ids.has(record.id)) {
        ids.add(record.id);
        changed = true;
      }
    });
  }
  return ids;
}

export function getAttachments(record: BaseRecord, fieldId?: string): AttachmentValue[] {
  if (!fieldId) return [];
  const value = record.fields[fieldId];
  return Array.isArray(value) ? value.filter(item => typeof item === 'object' && item !== null) as AttachmentValue[] : [];
}

export function selectCoverAttachment(attachments: AttachmentValue[]) {
  const image = attachments.find(item => item.mimeType.startsWith('image/'));
  const video = attachments.find(item => item.mimeType.startsWith('video/'));
  const pdf = attachments.find(item => item.mimeType === 'application/pdf' || item.extension.toLowerCase() === 'pdf');
  return image || video || pdf || attachments[0];
}

export function valueText(value: CellValue): string {
  if (Array.isArray(value)) {
    if (value.length && typeof value[0] === 'object') return (value as AttachmentValue[]).map(item => item.name).join(', ');
    return (value as string[]).join(', ');
  }
  if (typeof value === 'boolean') return value ? '是' : '否';
  return value == null ? '' : String(value);
}

/** 单元格展示文案：单选/多选解析选项名，日期保留 ISO 格式供上层格式化。 */
export function fieldCellDisplayText(field: BaseField, value: CellValue): string {
  if (field.type === 'single_select') {
    const choice = findSelectChoice(field, valueText(value));
    return choice?.name || valueText(value);
  }
  if (field.type === 'multi_select') return multiSelectDisplayText(field, value);
  if (field.type === 'checkbox') return value ? '已完成' : '未完成';
  return valueText(value);
}

function compareRecordsBySorts(a: BaseRecord, b: BaseRecord, sorts: SortRule[]): number {
  for (const sort of sorts) {
    const result = valueText(a.fields[sort.fieldId]).localeCompare(
      valueText(b.fields[sort.fieldId]),
      'zh-CN',
      { numeric: true },
    );
    if (result) return sort.direction === 'asc' ? result : -result;
  }
  return 0;
}

export function filterRecordsForView(table: BaseTable, view: BaseView): BaseRecord[] {
  const search = String((view.config as { search?: string }).search || '').trim().toLocaleLowerCase();
  const activeFilters = (view.filters || []).filter(isFilterRuleActive);
  return table.records.filter(record => {
    if (search && !table.fields.some(field => {
      const text = field.type === 'multi_select'
        ? multiSelectDisplayText(field, record.fields[field.id])
        : valueText(record.fields[field.id]);
      return text.toLocaleLowerCase().includes(search);
    })) return false;
    return activeFilters.every(rule => {
      const text = valueText(record.fields[rule.fieldId]).toLocaleLowerCase();
      const needle = String(rule.value || '').trim().toLocaleLowerCase();
      if (rule.operator === 'is_empty') return !text;
      if (rule.operator === 'is_not_empty') return Boolean(text);
      if (rule.operator === 'equals') return text === needle;
      if (rule.operator === 'not_equals') return text !== needle;
      if (rule.operator === 'not_contains') return !text.includes(needle);
      return text.includes(needle);
    });
  });
}

/** 表格视图：先归一化树序，再仅在同级兄弟间排序，保证子记录紧跟父记录 */
export function orderRecordsForTreeView(records: BaseRecord[], sorts: SortRule[] = []): BaseRecord[] {
  const normalized = normalizeRecordTreeOrder(records);
  if (!sorts.length) return normalized;

  const recordById = new Map(normalized.map(record => [record.id, record]));
  const childrenByParent = new Map<string | null, BaseRecord[]>();
  normalized.forEach(record => {
    const parentKey = record.parentId && recordById.has(record.parentId) ? record.parentId : null;
    const siblings = childrenByParent.get(parentKey);
    if (siblings) siblings.push(record);
    else childrenByParent.set(parentKey, [record]);
  });

  const result: BaseRecord[] = [];
  const walk = (parentKey: string | null) => {
    const siblings = childrenByParent.get(parentKey) || [];
    siblings.sort((left, right) => compareRecordsBySorts(left, right, sorts));
    siblings.forEach(record => {
      result.push(record);
      walk(record.id);
    });
  };
  walk(null);
  return result;
}

export function gridVisibleRecords(table: BaseTable, view: BaseView): BaseRecord[] {
  return orderRecordsForTreeView(filterRecordsForView(table, view), getEffectiveSorts(view));
}

export function resolveRecordInsertIndex(
  records: BaseRecord[],
  targetRecordId: string,
  position: 'before' | 'after-subtree',
): number {
  const recordIndex = records.findIndex(record => record.id === targetRecordId);
  if (recordIndex < 0) return records.length;
  if (position === 'before') return recordIndex;
  return findInsertIndexAfterSubtree(records, recordIndex);
}

/** 将当前视图中的插入位置映射到归一化存储数组下标 */
export function resolveStorageInsertIndex(
  table: BaseTable,
  view: BaseView,
  position: {
    visibleIndex?: number;
    recordId?: string;
    mode?: 'before' | 'after-subtree' | 'append';
  },
): number {
  const normalized = normalizeRecordTreeOrder(table.records);
  const visible = visibleRecords({ ...table, records: normalized }, view);

  if (position.mode === 'append') {
    return normalized.length;
  }

  if (position.visibleIndex != null && position.visibleIndex >= visible.length) {
    if (!visible.length) return normalized.length;
    const lastStorageIndex = normalized.findIndex(record => record.id === visible[visible.length - 1].id);
    return findInsertIndexAfterSubtree(normalized, lastStorageIndex);
  }

  if (position.recordId) {
    const storageIndex = normalized.findIndex(record => record.id === position.recordId);
    if (storageIndex < 0) return normalized.length;
    if (position.mode === 'after-subtree') return findInsertIndexAfterSubtree(normalized, storageIndex);
    return storageIndex;
  }

  const visibleIndex = position.visibleIndex ?? 0;
  const targetId = visible[visibleIndex]?.id;
  if (!targetId) return normalized.length;
  return normalized.findIndex(record => record.id === targetId);
}

export function insertRecordsIntoTable(
  table: BaseTable,
  view: BaseView,
  recordsToInsert: BaseRecord[],
  position: {
    visibleIndex?: number;
    recordId?: string;
    mode?: 'before' | 'after-subtree' | 'append';
  },
): BaseRecord[] {
  const normalized = normalizeRecordTreeOrder(table.records);
  const insertIndex = resolveStorageInsertIndex({ ...table, records: normalized }, view, position);
  const next = [...normalized];
  next.splice(insertIndex, 0, ...recordsToInsert);
  return next;
}

export function visibleRecords(table: BaseTable, view: BaseView): BaseRecord[] {
  const filtered = filterRecordsForView(table, view);
  if (view.type === 'grid') {
    return orderRecordsForTreeView(filtered, getEffectiveSorts(view));
  }
  const sorts = getEffectiveSorts(view);
  if (!sorts.length) return filtered;
  return filtered.map((record, index) => ({ record, index })).sort((a, b) => {
    const result = compareRecordsBySorts(a.record, b.record, sorts);
    return result || a.index - b.index;
  }).map(item => item.record);
}

export function groupRecords(table: BaseTable, view: BaseView, records: BaseRecord[]) {
  const groupFieldId = view.type === 'gallery' ? (view.config as GalleryViewConfig).groupByFieldId : undefined;
  if (!groupFieldId) return [{ key: '', label: '', records }];
  const groups = new Map<string, BaseRecord[]>();
  records.forEach(record => {
    const label = valueText(record.fields[groupFieldId]) || '未分组';
    groups.set(label, [...(groups.get(label) || []), record]);
  });
  return Array.from(groups.entries()).map(([label, group]) => ({ key: label, label, records: group }));
}

export function uniqueViewName(views: BaseView[], baseName: string) {
  const names = new Set(views.map(view => view.name));
  if (!names.has(baseName)) return baseName;
  let index = 2;
  while (names.has(`${baseName} ${index}`)) index += 1;
  return `${baseName} ${index}`;
}

const AUTO_FIELD_NAME_RE = /^字段\s*(\d+)$/;

export function nextAutoFieldName(fields: BaseField[]): string {
  const numbers = fields
    .map(field => {
      const match = field.name.match(AUTO_FIELD_NAME_RE);
      return match ? Number(match[1]) : 0;
    })
    .filter(n => n > 0);
  const next = numbers.length ? Math.max(...numbers) + 1 : 1;
  return `字段 ${next}`;
}

export function duplicateFieldName(sourceName: string): string {
  return `${sourceName} 副本`;
}

function defaultViewName(type: BaseViewType) {
  if (type === 'gallery') return '画册';
  if (type === 'gantt') return '甘特图';
  if (type === 'kanban') return '看板';
  return '表格';
}

export function copyView(table: BaseTable, viewId: string): BaseTable {
  const source = table.views.find(view => view.id === viewId);
  if (!source) return table;
  const copy: BaseView = {
    ...source,
    id: uid(`view_${source.type}`),
    name: uniqueViewName(table.views, `${source.name} 副本`),
    config: JSON.parse(JSON.stringify(source.config)) as BaseView['config'],
    filters: source.filters?.map(filter => ({ ...filter, id: uid('filter') })),
    sorts: source.sorts ? [...source.sorts] : [],
    hiddenFieldIds: source.hiddenFieldIds ? [...source.hiddenFieldIds] : undefined,
    fieldOrder: source.fieldOrder ? [...source.fieldOrder] : undefined,
    locked: false,
  };
  const index = table.views.findIndex(view => view.id === viewId);
  const views = [...table.views];
  views.splice(index + 1, 0, copy);
  return { ...table, views, activeViewId: copy.id };
}

export function deleteView(table: BaseTable, viewId: string): BaseTable {
  if (table.views.length <= 1) return table;
  const index = table.views.findIndex(view => view.id === viewId);
  if (index < 0) return table;
  const views = table.views.filter(view => view.id !== viewId);
  const activeViewId = table.activeViewId === viewId
    ? views[Math.max(0, index - 1)]?.id || views[0].id
    : table.activeViewId;
  return { ...table, views, activeViewId };
}

export function reorderViews(table: BaseTable, fromIndex: number, toIndex: number): BaseTable {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= table.views.length || toIndex >= table.views.length) {
    return table;
  }
  const views = [...table.views];
  const [moved] = views.splice(fromIndex, 1);
  if (!moved) return table;
  views.splice(toIndex, 0, moved);
  return { ...table, views };
}

export function addView(table: BaseTable, type: 'grid' | 'gallery' | 'gantt' | 'kanban') {
  if (!isViewTypeVisible(type)) return table;
  if (type === 'gantt') {
    let fields = table.fields;
    const dateFields = fields.filter(field => field.type === 'date');
    if (dateFields.length < 2) {
      const additions = Array.from({ length: 2 - dateFields.length }, (_, index) => ({
        id: uid('fld_date'),
        name: dateFields.length + index === 0 ? '开始日期' : '结束日期',
        type: 'date' as const,
      }));
      fields = [...fields, ...additions];
    }
    const view: BaseView = {
      id: uid('view_gantt'),
      tableId: table.id,
      name: uniqueViewName(table.views, defaultViewName(type)),
      type,
      config: createGanttConfig(fields, table.primaryFieldId),
      filters: [],
      sorts: [],
    };
    return {
      ...table,
      fields,
      records: table.records.map(record => ({
        ...record,
        fields: fields.reduce<Record<FieldId, CellValue>>((values, field) => {
          values[field.id] = record.fields[field.id] ?? (field.type === 'attachment' ? [] : '');
          return values;
        }, {}),
      })),
      views: [...table.views, view],
      activeViewId: view.id,
    };
  }
  if (type === 'kanban') {
    let fields = table.fields;
    if (!fields.some(field => field.type === 'single_select')) {
      const statusField = {
        id: uid('fld_status'),
        name: '任务状态',
        type: 'single_select' as const,
        options: {
          choices: [
            { id: 'todo', name: '未开始', color: '#dee8ff' },
            { id: 'doing', name: '进行中', color: '#f8e6c2' },
            { id: 'done', name: '已完成', color: '#c7effb' },
          ],
        },
      };
      fields = [...fields, statusField];
    }
    const view: BaseView = {
      id: uid('view_kanban'),
      tableId: table.id,
      name: uniqueViewName(table.views, defaultViewName(type)),
      type,
      config: createGalleryConfig(fields, table.primaryFieldId),
      filters: [],
      sorts: [],
    };
    return {
      ...table,
      fields,
      records: table.records.map(record => ({
        ...record,
        fields: fields.reduce<Record<FieldId, CellValue>>((values, field) => {
          values[field.id] = record.fields[field.id] ?? (field.type === 'attachment' ? [] : '');
          return values;
        }, {}),
      })),
      views: [...table.views, view],
      activeViewId: view.id,
    };
  }
  const viewName = uniqueViewName(table.views, defaultViewName(type));
  const view: BaseView = type === 'gallery'
    ? { id: uid('view_gallery'), tableId: table.id, name: viewName, type, config: createGalleryConfig(table.fields, table.primaryFieldId), filters: [], sorts: [] }
    : { id: uid('view_grid'), tableId: table.id, name: viewName, type, config: {}, filters: [], sorts: [] };
  return { ...table, views: [...table.views, view], activeViewId: view.id };
}

export function attachmentFromUpload(file: File, url = '', progress = 0): AttachmentValue {
  const extension = file.name.includes('.') ? file.name.split('.').pop() || '' : '';
  return {
    id: uid('att'),
    fileId: uid('file'),
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    extension,
    size: file.size,
    url,
    thumbnailUrl: file.type.startsWith('image/') ? url : undefined,
    uploadStatus: url ? 'success' : 'uploading',
    uploadProgress: progress,
  };
}

/** 块级横移时内容左缘不得越过该 x（避免被 overflow:hidden 的祖先裁切） */
export function resolveBitableHorizontalClipLeft(
  block: HTMLElement,
  bleedLeft: number,
  options?: { assumeBleed?: boolean },
): number {
  let clipLeft = bleedLeft;
  const bleedActive = options?.assumeBleed
    || block.classList.contains('is-grid-bleed-active')
    || block.classList.contains('is-grid-hscroll-active');

  for (let node: HTMLElement | null = block.parentElement; node; node = node.parentElement) {
    if (bleedActive && (
      node.classList.contains('doc-page-workspace')
      || node.classList.contains('doc-page-workspace-inner')
      || node.classList.contains('doc-content-col')
    )) {
      continue;
    }
    const { overflowX } = getComputedStyle(node);
    if (overflowX === 'hidden' || overflowX === 'clip') {
      clipLeft = Math.max(clipLeft, node.getBoundingClientRect().left);
    }
    if (node.classList.contains('editor-wrap') || node.classList.contains('doc-page')) {
      break;
    }
  }
  return clipLeft;
}
