import { describe, expect, test } from 'vitest';
import {
  analyzeFieldDeletion,
  deleteFieldWithMigration,
  getCompatibleFieldMigrationTargets,
  GRID_ROW_HEIGHT_PRESETS,
  filterRecordsForView,
  insertRecordsIntoTable,
  parseDateCellValue,
  pinRecordsToVisibleBottom,
  reorderViewFields,
  resolveViewFields,
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

  test('field order is isolated per view and keeps the primary field first', () => {
    const current = table([record('a', 'A')]);
    current.fields = [
      ...fields,
      { id: 'owner', name: '负责人', type: 'text' },
    ];
    current.views = [
      { id: 'grid-a', tableId: current.id, name: '表格 A', type: 'grid', config: {} },
      {
        id: 'grid-b',
        tableId: current.id,
        name: '表格 B',
        type: 'grid',
        config: {},
        fieldOrder: ['title', 'tags', 'owner'],
      },
    ];

    const reordered = reorderViewFields(current, 'grid-a', 1, 2);
    expect(reordered.fields.map(field => field.id)).toEqual(['title', 'tags', 'owner']);
    expect(resolveViewFields(reordered, reordered.views[0]).map(field => field.id))
      .toEqual(['title', 'owner', 'tags']);
    expect(resolveViewFields(reordered, reordered.views[1]).map(field => field.id))
      .toEqual(['title', 'tags', 'owner']);
    expect(current.views[0].fieldOrder).toBeUndefined();
  });

  test('view field order drops unknown ids and appends newly added fields', () => {
    const current = table([record('a', 'A')]);
    current.fields = [
      ...fields,
      { id: 'new-field', name: '新增字段', type: 'text' },
    ];
    const view: BaseView = {
      id: 'grid',
      tableId: current.id,
      name: '表格',
      type: 'grid',
      config: {},
      fieldOrder: ['title', 'missing', 'tags'],
    };
    expect(resolveViewFields(current, view).map(field => field.id))
      .toEqual(['title', 'tags', 'new-field']);
  });

  test('field deletion impact counts record data and view references', () => {
    const current = table([record('a', 'A', ['promotion']), record('b', 'B')]);
    current.views = [{
      id: 'grid',
      tableId: current.id,
      name: '表格',
      type: 'grid',
      config: { groupByFieldIds: ['tags'], groupSortDirections: ['asc'] },
      filters: [{ id: 'filter', fieldId: 'tags', operator: 'contains', value: '推广' }],
      sorts: [{ fieldId: 'tags', direction: 'asc' }],
    }];
    expect(analyzeFieldDeletion(current, 'tags')).toEqual({
      recordsWithValue: 1,
      filterReferences: 1,
      sortReferences: 1,
      groupReferences: 1,
      configReferences: 0,
    });
  });

  test('field deletion can migrate values and compatible references', () => {
    const current = table([record('a', 'A', ['promotion'])]);
    const backup: BaseField = {
      id: 'backup-tags',
      name: '备用标签',
      type: 'multi_select',
      options: fields[1].options,
    };
    current.fields = [...fields, backup];
    current.records[0].fields['backup-tags'] = [];
    current.views = [{
      id: 'grid',
      tableId: current.id,
      name: '表格',
      type: 'grid',
      config: { groupByFieldIds: ['tags'], groupSortDirections: ['desc'] },
      filters: [{ id: 'filter', fieldId: 'tags', operator: 'contains', value: '推广' }],
      sorts: [{ fieldId: 'tags', direction: 'asc' }],
      fieldOrder: ['title', 'tags', 'backup-tags'],
    }];

    expect(getCompatibleFieldMigrationTargets(current, 'tags').map(field => field.id))
      .toEqual(['backup-tags']);
    const next = deleteFieldWithMigration(current, 'tags', 'backup-tags');
    expect(next.fields.map(field => field.id)).toEqual(['title', 'backup-tags']);
    expect(next.records[0].fields['backup-tags']).toEqual(['promotion']);
    expect(next.records[0].fields.tags).toBeUndefined();
    expect(next.views[0].filters?.[0].fieldId).toBe('backup-tags');
    expect(next.views[0].sorts?.[0].fieldId).toBe('backup-tags');
    expect((next.views[0].config as { groupByFieldIds?: string[] }).groupByFieldIds)
      .toEqual(['backup-tags']);
    expect(next.views[0].fieldOrder).toEqual(['title', 'backup-tags']);
  });

  test('field deletion without migration removes dangling references', () => {
    const current = table([record('a', 'A', ['promotion'])]);
    current.views = [{
      id: 'grid',
      tableId: current.id,
      name: '表格',
      type: 'grid',
      config: { groupByFieldIds: ['tags'], groupSortDirections: ['asc'] },
      filters: [{ id: 'filter', fieldId: 'tags', operator: 'contains', value: '推广' }],
      sorts: [{ fieldId: 'tags', direction: 'asc' }],
    }];
    const next = deleteFieldWithMigration(current, 'tags');
    expect(next.records[0].fields.tags).toBeUndefined();
    expect(next.views[0].filters).toEqual([]);
    expect(next.views[0].sorts).toEqual([]);
    expect((next.views[0].config as { groupByFieldIds?: string[] }).groupByFieldIds).toBeUndefined();
  });
});
