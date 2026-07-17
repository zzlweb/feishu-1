import { describe, expect, test } from 'vitest';
import {
  GRID_ROW_HEIGHT_PRESETS,
  filterRecordsForView,
  insertRecordsIntoTable,
  parseDateCellValue,
  pinRecordsToVisibleBottom,
  reorderRecordsInTreeById,
  resolveGridRowHeight,
  type BaseField,
  type BaseRecord,
  type BaseTable,
  type BaseView,
} from './bitableModel';

const fields: BaseField[] = [
  { id: 'title', name: '标题', type: 'text' },
  {
    id: 'tags',
    name: '标签',
    type: 'multi_select',
    options: {
      choices: [
        { id: 'promotion', name: '推广', color: '#dee8ff' },
        { id: 'iteration', name: '产品迭代', color: '#f8e6c2' },
      ],
    },
  },
];

function record(id: string, title: string, tags: string[] = []): BaseRecord {
  return {
    id,
    tableId: 'table',
    fields: { title, tags },
    createdAt: '2026-07-14T00:00:00.000Z',
    updatedAt: '2026-07-14T00:00:00.000Z',
    createdBy: 'Unit',
  };
}

function table(records: BaseRecord[]): BaseTable {
  return {
    id: 'table',
    name: '测试表',
    fields,
    records,
    views: [],
    primaryFieldId: 'title',
    activeViewId: 'grid',
  };
}

describe('Bitable model contracts', () => {
  test('record operations resolve storage positions by record id', () => {
    const records = [record('a', 'A'), record('hidden', 'Hidden'), record('b', 'B')];
    expect(reorderRecordsInTreeById(records, 'b', 'a').map(item => item.id)).toEqual(['b', 'a', 'hidden']);

    const inserted = insertRecordsIntoTable(
      table(records),
      [record('new', 'New')],
      { recordId: 'b', mode: 'before' },
    );
    expect(inserted.map(item => item.id)).toEqual(['a', 'hidden', 'new', 'b']);
  });

  test('consecutive footer records stay pinned in creation order', () => {
    const sorted = [record('new-2', ''), record('new-1', ''), record('existing', '任务')];
    expect(pinRecordsToVisibleBottom(sorted, ['new-1', 'new-2']).map(item => item.id))
      .toEqual(['existing', 'new-1', 'new-2']);
  });

  test('date parser accepts supported separators and rejects invalid dates', () => {
    expect(parseDateCellValue('2026-05-25')).not.toBeNull();
    expect(parseDateCellValue('2026/05/25')).not.toBeNull();
    expect(parseDateCellValue('2026/02/30')).toBeNull();
  });

  test('multi-select filters match the displayed option name', () => {
    const view: BaseView = {
      id: 'grid',
      tableId: 'table',
      name: '表格',
      type: 'grid',
      config: {},
      filters: [{ id: 'filter', fieldId: 'tags', operator: 'contains', value: '推广' }],
    };
    const records = [record('a', 'A', ['promotion']), record('b', 'B', ['iteration'])];
    expect(filterRecordsForView(table(records), view).map(item => item.id)).toEqual(['a']);
  });

  test('grid row-height presets default to low', () => {
    expect(resolveGridRowHeight(undefined)).toBe(GRID_ROW_HEIGHT_PRESETS.low);
    expect(resolveGridRowHeight({})).toBe(GRID_ROW_HEIGHT_PRESETS.low);
    expect(resolveGridRowHeight({ rowHeight: 'low' })).toBe(32);
    expect(resolveGridRowHeight({ rowHeight: 'medium' })).toBe(56);
    expect(resolveGridRowHeight({ rowHeight: 'high' })).toBe(88);
  });

  test('the primary field remains the first text field', () => {
    const current = table([record('a', 'A')]);
    expect(current.primaryFieldId).toBe('title');
    expect(current.fields[0]?.id).toBe(current.primaryFieldId);
  });
});