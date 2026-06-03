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

export interface FilterRule {
  id: string;
  fieldId: FieldId;
  operator: 'contains' | 'equals' | 'is_empty' | 'is_not_empty';
  value?: string;
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
  cardAspectRatio: '1:1' | '4:3' | '16:9' | 'auto';
  showFieldNames: boolean;
  showEmptyFields: boolean;
  showAttachmentCount: boolean;
  showRecordActions: boolean;
  groupByFieldId?: FieldId;
  emptyCoverMode: 'placeholder' | 'hide-cover';
  search?: string;
}

export interface GridViewConfig {
  search?: string;
  fieldWidths?: Record<FieldId, number>;
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
  return field.options?.choices?.find(choice => choice.name === value) ?? null;
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
    cardAspectRatio: '4:3',
    showFieldNames: false,
    showEmptyFields: false,
    showAttachmentCount: true,
    showRecordActions: false,
    emptyCoverMode: 'placeholder',
  };
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
      return { ...view, tableId, config: { ...(config || {}), fieldWidths }, filters: view.filters || [], sorts: view.sorts || [] };
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
        visibleFieldIds: (config.visibleFieldIds || []).filter(id => fields.some(field => field.id === id)),
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
  return {
    ...raw,
    id: tableId,
    name: raw.name || '多维表格',
    fields,
    records,
    views: normalizedViews,
    primaryFieldId,
    activeViewId: normalizedViews.some(view => view.id === raw.activeViewId) ? raw.activeViewId : normalizedViews[0].id,
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
  return table.views.find(view => view.id === table.activeViewId) || table.views[0];
}

export function getGalleryConfig(table: BaseTable, view: BaseView): GalleryViewConfig {
  const config = view.type === 'gallery'
    ? view.config as GalleryViewConfig
    : createGalleryConfig(table.fields, table.primaryFieldId);
  return { ...config, showRecordActions: false };
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

export function visibleRecords(table: BaseTable, view: BaseView): BaseRecord[] {
  const search = String((view.config as { search?: string }).search || '').trim().toLocaleLowerCase();
  let records = table.records.filter(record => {
    if (search && !table.fields.some(field => valueText(record.fields[field.id]).toLocaleLowerCase().includes(search))) return false;
    return (view.filters || []).every(rule => {
      const text = valueText(record.fields[rule.fieldId]).toLocaleLowerCase();
      const needle = String(rule.value || '').toLocaleLowerCase();
      if (rule.operator === 'is_empty') return !text;
      if (rule.operator === 'is_not_empty') return Boolean(text);
      if (rule.operator === 'equals') return text === needle;
      return text.includes(needle);
    });
  });
  const sorts = view.sorts || [];
  if (sorts.length) {
    records = records.map((record, index) => ({ record, index })).sort((a, b) => {
      for (const sort of sorts) {
        const result = valueText(a.record.fields[sort.fieldId]).localeCompare(valueText(b.record.fields[sort.fieldId]), 'zh-CN', { numeric: true });
        if (result) return sort.direction === 'asc' ? result : -result;
      }
      return a.index - b.index;
    }).map(item => item.record);
  }
  return records;
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
