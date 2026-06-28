import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { ImportedAsset, ImportWarning } from './types';

const uploadDir = path.resolve(__dirname, '..', '..', 'public', 'uploads');

function ensureUploadDir() {
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
}

function safeAssetName(sourceUrl: string, contentType: string) {
  const url = new URL(sourceUrl);
  const original = path.basename(url.pathname) || 'asset';
  const extFromPath = path.extname(original);
  const ext = extFromPath || extensionFromContentType(contentType);
  const stem = original
    .replace(/\.[^.]+$/, '')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'asset';
  return `${uuidv4()}-${stem}${ext}`;
}

function extensionFromContentType(contentType: string) {
  if (/image\/png/i.test(contentType)) return '.png';
  if (/image\/jpe?g/i.test(contentType)) return '.jpg';
  if (/image\/gif/i.test(contentType)) return '.gif';
  if (/image\/webp/i.test(contentType)) return '.webp';
  if (/image\/svg/i.test(contentType)) return '.svg';
  if (/video\/mp4/i.test(contentType)) return '.mp4';
  if (/application\/pdf/i.test(contentType)) return '.pdf';
  return '';
}

export async function mirrorRemoteAsset(
  sourceUrl: string,
  headers: Record<string, string>,
  warnings: ImportWarning[],
): Promise<ImportedAsset> {
  try {
    const response = await fetch(sourceUrl, { headers });
    if (!response.ok) {
      const message = `资源下载失败 (${response.status})：${sourceUrl}`;
      warnings.push({ type: 'asset', message });
      return { id: uuidv4(), sourceUrl, status: 'failed', warning: message };
    }

    const contentType = response.headers.get('content-type') || '';
    const buffer = Buffer.from(await response.arrayBuffer());
    ensureUploadDir();
    const fileName = safeAssetName(sourceUrl, contentType);
    fs.writeFileSync(path.join(uploadDir, fileName), buffer);
    return {
      id: uuidv4(),
      sourceUrl,
      localUrl: `/static/uploads/${fileName}`,
      name: fileName,
      mimeType: contentType,
      status: 'downloaded',
    };
  } catch (error) {
    const message = `资源下载失败：${error instanceof Error ? error.message : sourceUrl}`;
    warnings.push({ type: 'asset', message });
    return { id: uuidv4(), sourceUrl, status: 'failed', warning: message };
  }
}
