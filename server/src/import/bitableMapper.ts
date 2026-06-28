import type { BaseFieldType, BaseTableModel, BaseViewType, CellValue } from '../bitableModelFactory';

interface FeishuBitableField {
  field_id?: string;
  id?: string;
  field_name?: string;
  name?: string;
  type?: number | string;
  property?: {
    options?: Array<{ id?: string; name?: string; color?: string }>;
    formatter?: string;
  };
  is_primary?: boolean;
}

interface FeishuBitableRecord {
  record_id?: string;
  id?: string;
  fields?: Record<string, unknown>;
}

interface FeishuBitableView {
  view_id?: string;
  id?: string;
  view_name?: string;
  name?: string;
  view_type?: string;
  type?: string;
  property?: Record<string, unknown>;
}

const FEISHU_FIELD_TYPE_MAP: Record<string, BaseFieldType> = {
  1: 'text',
  2: 'number',
  3: 'single_select',
  4: 'multi_select',
  5: 'date',
  7: 'checkbox',
  11: 'user',
  13: 'phone',
  15: 'url',
  17: 'attachment',
  18: 'created_time',
  20: 'formula',
  21: 'relation',
  22: 'lookup',
  text: 'text',
  number: 'number',
  single_select: 'single_select',
  multi_select: 'multi_select',
  date: 'date',
  checkbox: 'checkbox',
  user: 'user',
  attachment: 'attachment',
  url: 'url',
  phone: 'phone',
  email: 'email',
  formula: 'formula',
  lookup: 'lookup',
  relation: 'relation',
};

function now() {
  return new Date().toISOString();
}

function fieldId(field: FeishuBitableField, index: number) {
  return field.field_id || field.id || `fld_import_${index}`;
}

function fieldName(field: FeishuBitableField, index: number) {
  return field.field_name || field.name || `字段 ${index + 1}`;
}

function fieldType(field: FeishuBitableField): BaseFieldType {
  return FEISHU_FIELD_TYPE_MAP[String(field.type ?? '').toLowerCase()] || 'text';
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function normalizeDisplayText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(normalizeDisplayText).filter(Boolean).join(', ');
  const item = value as Record<string, unknown>;
  return firstText(
    item.text,
    item.name,
    item.en_name,
    item.cn_name,
    item.email,
    item.phone,
    item.link,
    item.url,
    item.id,
    item.record_id,
    item.user_id,
    item.open_id,
  );
}

function normalizeDateValue(value: unknown): string {
  if (value == null || value === '') return '';
  const raw = typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>).timestamp ?? (value as Record<string, unknown>).date ?? (value as Record<string, unknown>).value
    : value;
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const numeric = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(numeric)) return normalizeDisplayText(raw);
  const millis = numeric > 10_000_000_000 ? numeric : numeric * 1000;
  const date = new Date(millis);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function normalizeStringArray(value: unknown): string[] {
  if (value == null) return [];
  const values = Array.isArray(value) ? value : [value];
  return values.map(normalizeDisplayText).filter(Boolean);
}

function normalizeCellValue(value: unknown, type: BaseFieldType): CellValue {
  if (value == null) return type === 'multi_select' || type === 'attachment' ? [] : '';
  if (type === 'checkbox') return Boolean(value);
  if (type === 'date' || type === 'created_time' || type === 'updated_time') return normalizeDateValue(value);
  if (type === 'number') {
    const numberValue = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }
  if (type === 'single_select') return normalizeDisplayText(value);
  if (type === 'multi_select') {
    return normalizeStringArray(value);
  }
  if (type === 'attachment') {
    if (!Array.isArray(value)) return [];
    return value.map((item, index) => {
      const attachment = item as Record<string, unknown>;
      const name = String(attachment.name || attachment.file_name || attachment.fileName || `附件 ${index + 1}`);
      const url = String(attachment.url || attachment.tmp_url || attachment.preview_url || '');
      return {
        id: String(attachment.id || attachment.file_token || `att_${index}`),
        fileId: String(attachment.file_token || attachment.id || `file_${index}`),
        name,
        mimeType: String(attachment.mime_type || 'application/octet-stream'),
        extension: name.split('.').pop() || '',
        size: Number(attachment.size || 0),
        url,
        thumbnailUrl: String(attachment.thumbnail_url || url),
        previewUrl: String(attachment.preview_url || url),
        uploadStatus: 'success' as const,
      };
    });
  }
  if (type === 'user' || type === 'created_by' || type === 'updated_by' || type === 'relation' || type === 'lookup') {
    return normalizeStringArray(value);
  }
  if (type === 'formula') return normalizeDisplayText(value);
  if (Array.isArray(value)) {
    return normalizeStringArray(value).join(', ');
  }
  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return value;
  return normalizeDisplayText(value);
}

function normalizeViewType(type: unknown): BaseViewType {
  const text = String(type || '').toLowerCase();
  if (text.includes('gallery')) return 'gallery';
  if (text.includes('kanban')) return 'kanban';
  if (text.includes('gantt')) return 'gantt';
  if (text.includes('calendar')) return 'calendar';
  if (text.includes('form')) return 'form';
  return 'grid';
}

function collectFieldIds(value: unknown, fieldIdByName: Map<string, string>) {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => {
      if (typeof item === 'string') return fieldIdByName.get(item) || item;
      if (!item || typeof item !== 'object') return '';
      const raw = item as Record<string, unknown>;
      return firstText(raw.field_id, raw.id, fieldIdByName.get(String(raw.field_name || raw.name || '')));
    })
    .filter(Boolean);
}

function viewFieldId(value: unknown, fieldIdByName: Map<string, string>) {
  if (typeof value === 'string') return fieldIdByName.get(value) || value;
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  const resolved = firstText(raw.field_id, raw.id, fieldIdByName.get(String(raw.field_name || raw.name || '')));
  return resolved || undefined;
}

function createViewConfig(
  type: BaseViewType,
  property: Record<string, unknown> | undefined,
  fields: Array<{ id: string; name: string; type: BaseFieldType }>,
  primaryFieldId: string,
  fieldIdByName: Map<string, string>,
) {
  const hiddenFieldIds = new Set(collectFieldIds(property?.hidden_fields, fieldIdByName));
  const visibleFieldIds = collectFieldIds(property?.visible_fields, fieldIdByName);
  const attachmentFieldId = fields.find(field => field.type === 'attachment')?.id;
  const dateFields = fields.filter(field => field.type === 'date' || field.type === 'created_time' || field.type === 'updated_time');
  const groupFieldId = viewFieldId(property?.group_field || property?.group_field_id || property?.group_by_field_id, fieldIdByName);
  const titleFieldId = viewFieldId(property?.title_field || property?.title_field_id, fieldIdByName) || primaryFieldId;
  const coverFieldId = viewFieldId(property?.cover_field || property?.cover_field_id, fieldIdByName) || attachmentFieldId;
  const commonVisibleFieldIds = (visibleFieldIds.length ? visibleFieldIds : fields.map(field => field.id))
    .filter(fieldId => fieldId !== primaryFieldId && !hiddenFieldIds.has(fieldId));

  if (type === 'grid') {
    const fieldWidths = Array.isArray(property?.field_widths)
      ? Object.fromEntries((property?.field_widths as Array<Record<string, unknown>>).map(item => [
          viewFieldId(item.field_id || item.field_name, fieldIdByName) || '',
          Number(item.width || item.field_width || 160),
        ]).filter(([fieldId]) => fieldId))
      : undefined;
    return {
      fieldWidths,
      rowHeight: property?.row_height === 'high' || property?.row_height === 'medium' ? property.row_height : 'low',
      groupByFieldIds: groupFieldId ? [groupFieldId] : undefined,
    };
  }

  if (type === 'gantt') {
    return {
      titleFieldId,
      startDateFieldId: viewFieldId(property?.start_date_field_id || property?.start_date_field, fieldIdByName) || dateFields[0]?.id,
      endDateFieldId: viewFieldId(property?.end_date_field_id || property?.end_date_field, fieldIdByName) || dateFields[1]?.id || dateFields[0]?.id,
      dayWidth: Number(property?.day_width || 40),
    };
  }

  return {
    coverFieldId,
    titleFieldId,
    visibleFieldIds: commonVisibleFieldIds,
    coverFit: property?.cover_fit === 'contain' ? 'contain' as const : 'cover' as const,
    coverPosition: 'center' as const,
    cardSize: property?.card_size === 'large' || property?.card_size === 'small' ? property.card_size : 'medium',
    cardLayoutMode: property?.card_layout_mode === 'compact' ? 'compact' as const : 'regular' as const,
    cardAspectRatio: ['1:1', '16:9', 'auto'].includes(String(property?.card_aspect_ratio))
      ? property?.card_aspect_ratio as '1:1' | '16:9' | 'auto'
      : '4:3' as const,
    showFieldNames: property?.show_field_names !== false,
    showEmptyFields: Boolean(property?.show_empty_fields),
    showAttachmentCount: property?.show_attachment_count !== false,
    showRecordActions: false,
    groupByFieldId: groupFieldId,
    emptyCoverMode: property?.empty_cover_mode === 'hide-cover' ? 'hide-cover' as const : 'placeholder' as const,
  };
}

export function mapFeishuBitableToBaseTable(input: {
  tableId: string;
  tableName: string;
  fields: FeishuBitableField[];
  records: FeishuBitableRecord[];
  views?: FeishuBitableView[];
}): BaseTableModel {
  const fields = input.fields.map((field, index) => ({
    id: fieldId(field, index),
    name: fieldName(field, index),
    type: fieldType(field),
    options: field.property?.options?.length
      ? {
          choices: field.property.options.map((option, optionIndex) => ({
            id: option.id || option.name || `opt_${optionIndex}`,
            name: option.name || option.id || `选项 ${optionIndex + 1}`,
            color: option.color || '#dee8ff',
          })),
        }
      : undefined,
    hidden: Boolean((field as Record<string, unknown>).hidden),
    required: Boolean((field as Record<string, unknown>).required),
  }));
  const primaryFieldId = fields.find((field, index) => input.fields[index]?.is_primary)?.id || fields[0]?.id || 'fld_primary';
  const fieldTypeByName = new Map(fields.map(field => [field.name, field.type]));
  const fieldIdByName = new Map(fields.map(field => [field.name, field.id]));

  const records = input.records.map((record, index) => {
    const rawFields = record.fields || {};
    const normalizedFields: Record<string, CellValue> = {};
    Object.entries(rawFields).forEach(([name, value]) => {
      const id = fieldIdByName.get(name) || name;
      normalizedFields[id] = normalizeCellValue(value, fieldTypeByName.get(name) || 'text');
    });
    fields.forEach(field => {
      if (!(field.id in normalizedFields)) normalizedFields[field.id] = field.type === 'multi_select' || field.type === 'attachment' ? [] : '';
    });
    return {
      id: record.record_id || record.id || `rec_import_${index}`,
      tableId: input.tableId,
      fields: normalizedFields,
      createdAt: now(),
      updatedAt: now(),
      createdBy: 'feishu-api',
    };
  });

  const views = (input.views?.length ? input.views : [{ id: 'view_grid', name: '列表', type: 'grid' }]).map((view, index) => {
    const type = normalizeViewType(view.view_type || view.type);
    return {
      id: view.view_id || view.id || `view_import_${index}`,
      tableId: input.tableId,
      name: view.view_name || view.name || (type === 'gallery' ? '画册视图' : type === 'kanban' ? '看板' : '列表'),
      type,
      config: createViewConfig(type, view.property, fields, primaryFieldId, fieldIdByName),
      sorts: [],
      filters: [],
    };
  });

  return {
    id: input.tableId,
    name: input.tableName,
    fields,
    records,
    views,
    primaryFieldId,
    activeViewId: views[0]?.id || 'view_grid',
  };
}
