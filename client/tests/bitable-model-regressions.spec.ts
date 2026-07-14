import { expect, test } from '@playwright/test';
import {
  filterRecordsForView,
  insertRecordsIntoTable,
  parseDateCellValue,
  pinRecordsToVisibleBottom,
  reorderRecordsInTreeById,
  type BaseField,
  type BaseRecord,
  type BaseTable,
  type BaseView,
} from '../src/components/Bitable/model/bitableModel';

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
    createdBy: 'E2E',
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

test('consecutive footer records stay pinned at the visible bottom in creation order', () => {
  const sorted = [record('new-2', ''), record('new-1', ''), record('existing', '任务')];
  expect(pinRecordsToVisibleBottom(sorted, ['new-1', 'new-2']).map(item => item.id))
    .toEqual(['existing', 'new-1', 'new-2']);
});

test('date parser accepts current and legacy date separators and rejects invalid dates', () => {
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
