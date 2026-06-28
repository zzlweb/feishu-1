import type { AttachmentValue, BaseTableModel } from '../bitableModelFactory';
import { mirrorRemoteAsset } from './assetPipeline';
import type { ImportedAsset, ImportWarning } from './types';

export interface BitableAttachmentMirrorContext {
  apiBaseUrl: string;
  assetHeaders: Record<string, string>;
  warnings: ImportWarning[];
  assets: ImportedAsset[];
}

function mediaDownloadUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/$/, '')}/open-apis/drive/v1/medias/${encodeURIComponent(token)}/download`;
}

function shouldMirrorAttachment(attachment: AttachmentValue): boolean {
  const url = attachment.url || '';
  if (url.startsWith('/static/')) return false;
  if (url.includes('/open-apis/drive/v1/medias/')) return true;
  return attachment.fileId.startsWith('box');
}

function resolveAttachmentSourceUrl(attachment: AttachmentValue, apiBaseUrl: string): string {
  const url = attachment.url || '';
  if (attachment.fileId && url.includes('/open-apis/drive/v1/medias/')) {
    return mediaDownloadUrl(apiBaseUrl, attachment.fileId);
  }
  if (attachment.fileId) return mediaDownloadUrl(apiBaseUrl, attachment.fileId);
  return url;
}

function applyLocalUrl(attachment: AttachmentValue, localUrl: string, mimeType?: string): AttachmentValue {
  return {
    ...attachment,
    url: localUrl,
    thumbnailUrl: localUrl,
    previewUrl: localUrl,
    mimeType: mimeType?.startsWith('image/') ? mimeType : attachment.mimeType,
    uploadStatus: 'success',
  };
}

export async function mirrorBitableTableAttachments(
  table: BaseTableModel,
  context: BitableAttachmentMirrorContext,
): Promise<BaseTableModel> {
  const attachmentFieldIds = new Set(
    table.fields.filter(field => field.type === 'attachment').map(field => field.id),
  );
  if (!attachmentFieldIds.size) return table;

  const downloadCache = new Map<string, string>();

  for (const record of table.records) {
    for (const fieldId of attachmentFieldIds) {
      const value = record.fields[fieldId];
      if (!Array.isArray(value) || !value.length) continue;

      const mirrored: AttachmentValue[] = [];
      for (const attachment of value as AttachmentValue[]) {
        if (!shouldMirrorAttachment(attachment)) {
          mirrored.push(attachment);
          continue;
        }

        const cachedUrl = downloadCache.get(attachment.fileId);
        if (cachedUrl) {
          mirrored.push(applyLocalUrl(attachment, cachedUrl));
          continue;
        }

        const sourceUrl = resolveAttachmentSourceUrl(attachment, context.apiBaseUrl);
        if (!sourceUrl) {
          mirrored.push(attachment);
          continue;
        }

        const asset = await mirrorRemoteAsset(sourceUrl, context.assetHeaders, context.warnings);
        context.assets.push(asset);
        if (asset.localUrl) {
          downloadCache.set(attachment.fileId, asset.localUrl);
          mirrored.push(applyLocalUrl(attachment, asset.localUrl, asset.mimeType));
        } else {
          mirrored.push(attachment);
        }
      }
      record.fields[fieldId] = mirrored;
    }
  }

  return table;
}
