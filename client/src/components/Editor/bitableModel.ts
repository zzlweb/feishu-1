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

export interface BaseField {
  id: FieldId;
  name: string;
  type: BaseFieldType;
  options?: { choices?: Array<{ id: string; name: string; color: string }> };
  hidden?: boolean;
  required?: boolean;
}

export interface BaseRecord {
  id: string;
  tableId: string;
  fields: Record<FieldId, CellValue>;
  createdAt: string;
  updatedAt: string;
  createdBy: UserId;
  updatedBy?: UserId;
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
    showRecordActions: true,
    emptyCoverMode: 'placeholder',
  };
}

export function createGanttConfig(fields: BaseField[], primaryFieldId: string): GanttViewConfig {
  const dateFields = fields.filter(field => field.type === 'date');
  return {
    titleFieldId: primaryFieldId,
    startDateFieldId: dateFields[0]?.id,
    endDateFieldId: dateFields[1]?.id || dateFields[0]?.id,
    dayWidth: 60,
  };
}

export function createBaseTable(initialView: 'grid' | 'gallery' | 'gantt' = 'gallery'): BaseTable {
  const tableId = uid('tbl');
  const titleId = uid('fld_title');
  const attachmentId = uid('fld_attachment');
  const statusId = uid('fld_status');
  const startDateId = uid('fld_start_date');
  const endDateId = uid('fld_end_date');
  const fields: BaseField[] = [
    { id: titleId, name: '名称', type: 'text', required: true },
    { id: attachmentId, name: '附件', type: 'attachment' },
    {
      id: statusId,
      name: '状态',
      type: 'single_select',
      options: { choices: [{ id: 'todo', name: '待处理', color: '#3370ff' }, { id: 'done', name: '已完成', color: '#34c759' }] },
    },
    { id: startDateId, name: '开始日期', type: 'date' },
    { id: endDateId, name: '结束日期', type: 'date' },
  ];
  const records = Array.from({ length: 3 }, (_, index) => createRecord(tableId, fields, titleId, `卡片 ${index + 1}`));
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
  const initial = initialView === 'gallery' ? galleryView : initialView === 'gantt' ? ganttView : gridView;
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
    values[field.id] = field.id === primaryFieldId ? title : field.type === 'attachment' ? [] : '';
  });
  return {
    id: uid('rec'),
    tableId,
    fields: values,
    createdAt: time,
    updatedAt: time,
    createdBy: 'local-user',
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
  return view.type === 'gallery'
    ? view.config as GalleryViewConfig
    : createGalleryConfig(table.fields, table.primaryFieldId);
}

export function getGanttConfig(table: BaseTable, view: BaseView): GanttViewConfig {
  return view.type === 'gantt'
    ? view.config as GanttViewConfig
    : createGanttConfig(table.fields, table.primaryFieldId);
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

export function addView(table: BaseTable, type: 'grid' | 'gallery' | 'gantt') {
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
      name: '甘特图',
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
  const view: BaseView = type === 'gallery'
    ? { id: uid('view_gallery'), tableId: table.id, name: '画册', type, config: createGalleryConfig(table.fields, table.primaryFieldId), filters: [], sorts: [] }
    : { id: uid('view_grid'), tableId: table.id, name: '表格', type, config: {}, filters: [], sorts: [] };
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
