import type { AttachmentValue, BaseTableModel } from '../bitableModelFactory';
import type { ImportedAsset, ImportWarning } from './types';

export interface BitableAttachmentMirrorContext {
  apiBaseUrl: string;
  assetHeaders: Record<string, string>;
  warnings: ImportWarning[];
  assets: ImportedAsset[];
}

function localFeishuMediaProxyUrl(token: string): string {
  return `/api/feishu-media/${encodeURIComponent(token)}`;
}

function shouldProxyAttachment(attachment: AttachmentValue): boolean {
  const url = attachment.url || '';
  if (url.startsWith('/static/') || url.startsWith('/api/feishu-media/')) return false;
  if (url.includes('/open-apis/drive/v1/medias/')) return true;
  return attachment.fileId.startsWith('box');
}

function applyProxyUrl(attachment: AttachmentValue, proxyUrl: string): AttachmentValue {
  const isVideo = (attachment.mimeType || '').startsWith('video/');
  return {
    ...attachment,
    url: proxyUrl,
    // 视频不要把 thumbnail 也写成整段视频流，避免被当成图片缩略图误用
    thumbnailUrl: isVideo ? (attachment.thumbnailUrl || '') : proxyUrl,
    previewUrl: proxyUrl,
    uploadStatus: 'success',
  };
}

/**
 * 多维表格附件不再导入落盘，改为指向本地飞书素材代理，打开时再按需拉取。
 */
export async function mirrorBitableTableAttachments(
  table: BaseTableModel,
  _context: BitableAttachmentMirrorContext,
): Promise<BaseTableModel> {
  const attachmentFieldIds = new Set(
    table.fields.filter(field => field.type === 'attachment').map(field => field.id),
  );
  if (!attachmentFieldIds.size) return table;

  for (const record of table.records) {
    for (const fieldId of attachmentFieldIds) {
      const value = record.fields[fieldId];
      if (!Array.isArray(value) || !value.length) continue;

      record.fields[fieldId] = (value as AttachmentValue[]).map(attachment => {
        if (!shouldProxyAttachment(attachment) || !attachment.fileId) return attachment;
        return applyProxyUrl(attachment, localFeishuMediaProxyUrl(attachment.fileId));
      });
    }
  }

  return table;
}
