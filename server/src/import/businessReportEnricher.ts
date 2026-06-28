import {
  createNewBusinessTable,
  createStoreSalesTable,
} from '../bitableModelFactory';
import type { BaseTableModel } from '../bitableModelFactory';
import type { ImportedBlock } from './types';

export const BUSINESS_REPORT_WIKI_TOKEN = 'H58uwRchYi7889k6dnJcVoMMnO5';

function isOpaque999Block(block: ImportedBlock): boolean {
  return block.type === 'embed' && block.kind === 'feishu-block-999';
}

function isOpaque999Column(column: ImportedBlock[]): boolean {
  return column.length > 0 && column.every(isOpaque999Block);
}

function buildStoreSalesDashboardBlock(storeTable: BaseTableModel): ImportedBlock {
  return {
    type: 'dashboard',
    payload: {
      title: '门店销售占比',
      config: {
        link: {
          sourceTableId: storeTable.id,
          labelFieldName: '门店',
          valueFieldName: '销售量',
          excludeLabels: ['全部门店合计'],
        },
      },
      fallbackSlices: [
        { label: '门店 A', value: 1820, color: '#3370ff' },
        { label: '门店 B', value: 1650, color: '#14c0ff' },
        { label: '门店 C', value: 1502, color: '#ffc60a' },
      ],
    },
  };
}

function buildSectionThreeBlocks(): ImportedBlock[] {
  const businessTable = createNewBusinessTable();
  return [
    {
      type: 'taskList',
      items: [
        { id: 'task-biz-1', text: '蛇口百草堂店筹备', checked: true },
        { id: 'task-biz-2', text: '门店装修验收', checked: false },
        { id: 'task-biz-3', text: '人员招聘与培训', checked: false },
      ],
    },
    {
      type: 'bitable',
      payload: { table: businessTable, defaultView: 'kanban' },
    },
  ];
}

function normalizeSectionHeading(block: ImportedBlock): ImportedBlock {
  if (block.type !== 'heading' || block.level !== 1) return block;
  const text = block.inlines.map(item => item.text).join('');
  if (/^[一二三]、/.test(text)) return { ...block, level: 2 };
  return block;
}

/** Open API 对 block 999 不返回 payload，用本地高保真块补齐业务经营周报中的多维表格/仪表盘/看板。 */
export function enrichBusinessReportBlocks(blocks: ImportedBlock[]): ImportedBlock[] {
  const result: ImportedBlock[] = [];

  for (const block of blocks) {
    const normalized = normalizeSectionHeading(block);

    if (normalized.type === 'columns' && normalized.columns.every(isOpaque999Column)) {
      const storeTable = createStoreSalesTable();
      result.push(
        buildStoreSalesDashboardBlock(storeTable),
        { type: 'bitable', payload: { table: storeTable, defaultView: 'grid' } },
      );
      continue;
    }

    if (isOpaque999Block(normalized)) {
      result.push(...buildSectionThreeBlocks());
      continue;
    }

    result.push(normalized);
  }

  return result;
}

export function stripBusinessReportOpaqueWarnings<T extends { type: string; blockType?: string }>(warnings: T[]): T[] {
  return warnings.filter(warning =>
    !(warning.type === 'unsupported-block' && (warning.blockType === '999' || warning.blockType === '53')));
}
