import type { Editor } from '@tiptap/react';
import { parseBaseTable, valueText, type BaseField, type BaseTable } from '../model/bitableModel';

export interface DashboardChartSlice {
  label: string;
  value: number;
  color: string;
}

export interface DashboardLinkConfig {
  sourceTableId: string;
  labelFieldName: string;
  valueFieldName: string;
  excludeLabels?: string[];
}

export interface DashboardChartConfig {
  link?: DashboardLinkConfig;
  slices?: DashboardChartSlice[];
}

export const CHART_SLICE_COLORS = ['#3370ff', '#14c0ff', '#ffc60a', '#25b47e', '#8f959e', '#ad82f7'];

export function decodeHtmlEntities(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

export function parseDashboardConfig(raw: string): DashboardChartConfig {
  if (!raw.trim()) return {};
  try {
    return JSON.parse(decodeHtmlEntities(raw)) as DashboardChartConfig;
  } catch {
    return {};
  }
}

export function resolveFieldByName(table: BaseTable, name: string): BaseField | undefined {
  return table.fields.find(field => field.name === name);
}

export function buildChartSlicesFromTable(
  table: BaseTable,
  labelFieldName: string,
  valueFieldName: string,
  excludeLabels: string[] = [],
): DashboardChartSlice[] {
  const labelField = resolveFieldByName(table, labelFieldName);
  const valueField = resolveFieldByName(table, valueFieldName);
  if (!labelField || !valueField) return [];

  const slices: DashboardChartSlice[] = [];
  let colorIndex = 0;
  table.records.forEach(record => {
    const label = valueText(record.fields[labelField.id]).trim();
    if (!label || excludeLabels.includes(label)) return;
    const raw = record.fields[valueField.id];
    const numeric = typeof raw === 'number'
      ? raw
      : Number(valueText(raw).replace(/[^\d.-]/g, ''));
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    slices.push({
      label,
      value: numeric,
      color: CHART_SLICE_COLORS[colorIndex % CHART_SLICE_COLORS.length],
    });
    colorIndex += 1;
  });
  return slices;
}

export function findBitableTableInEditor(editor: Editor, tableId: string): BaseTable | null {
  let found: BaseTable | null = null;
  editor.state.doc.descendants(node => {
    if (node.type.name !== 'localBitableBlock') return;
    const table = parseBaseTable(node.attrs);
    if (table.id === tableId) {
      found = table;
      return false;
    }
  });
  return found;
}

export function resolveLinkedChartSlices(
  editor: Editor | null | undefined,
  config: DashboardChartConfig,
  sourceTableId: string,
): DashboardChartSlice[] {
  const link = config.link;
  const tableId = sourceTableId || link?.sourceTableId || '';
  if (editor && tableId && link?.labelFieldName && link?.valueFieldName) {
    const table = findBitableTableInEditor(editor, tableId);
    if (table) {
      const liveSlices = buildChartSlicesFromTable(
        table,
        link.labelFieldName,
        link.valueFieldName,
        link.excludeLabels || [],
      );
      if (liveSlices.length) return liveSlices;
    }
  }
  if (config.slices?.length) return config.slices;
  return [
    { label: 'A', value: 40, color: '#3370ff' },
    { label: 'B', value: 60, color: '#14c0ff' },
  ];
}

export const BITABLE_MODEL_UPDATED = 'feishu-bitable-model-updated';

export interface BitableModelUpdatedDetail {
  tableId: string;
  blockId?: string;
}

export function dispatchBitableModelUpdated(detail: BitableModelUpdatedDetail) {
  window.dispatchEvent(new CustomEvent(BITABLE_MODEL_UPDATED, { detail }));
}
