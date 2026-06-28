import test from 'node:test';
import assert from 'node:assert/strict';
import type { AttachmentValue } from '../src/bitableModelFactory';
import { mapFeishuBitableToBaseTable } from '../src/import/bitableMapper';

test('bitable attachment mapper reads Feishu type field as mimeType', () => {
  const table = mapFeishuBitableToBaseTable({
    tableId: 'tbl1',
    tableName: '测试',
    fields: [{ field_id: 'fld_img', field_name: '图片', type: 17 }],
    records: [{
      record_id: 'rec1',
      fields: {
        图片: [{
          file_token: 'box123',
          name: 'image.png',
          type: 'image/png',
          url: 'https://open.feishu.cn/open-apis/drive/v1/medias/box123/download',
        }],
      },
    }],
  });

  const attachmentField = table.fields.find(field => field.type === 'attachment');
  assert.ok(attachmentField);
  const attachments = table.records[0].fields[attachmentField!.id] as AttachmentValue[];
  assert.equal(attachments[0].mimeType, 'image/png');
  assert.equal(attachments[0].fileId, 'box123');
});
