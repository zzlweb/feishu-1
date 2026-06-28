import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichBusinessReportBlocks } from '../src/import/businessReportEnricher';
import type { ImportedBlock } from '../src/import/types';

test('business report opaque blocks render dashboard above matching bitable', () => {
  const source: ImportedBlock[] = [
    {
      type: 'columns',
      ratios: [40, 59],
      columns: [
        [
          { type: 'embed', kind: 'feishu-block-999', title: '飞书未支持块' },
          { type: 'embed', kind: 'feishu-block-999', title: '飞书未支持块' },
        ],
        [
          { type: 'embed', kind: 'feishu-block-999', title: '飞书未支持块' },
          { type: 'embed', kind: 'feishu-block-999', title: '飞书未支持块' },
        ],
      ],
    },
  ];

  const [dashboard, bitable] = enrichBusinessReportBlocks(source);

  assert.equal(dashboard.type, 'dashboard');
  assert.equal(bitable.type, 'bitable');
  assert.equal(
    (dashboard.payload.config.link as { sourceTableId: string }).sourceTableId,
    (bitable.payload.table as { id: string }).id,
  );
});
