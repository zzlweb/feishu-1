import type { ImportQuality } from './types';

/** 面向用户的 fallback 固定提示（前端 / 后端共用语义） */
export const IMPORT_FALLBACK_MESSAGE = '无法完整识别飞书结构';

export interface ImportQualityFields {
  content: string;
  warnings: string[];
  importQuality: ImportQuality;
  unsupportedBlocks?: Array<{ type: string; reason: string }>;
}

function plainTextLength(html: string): number {
  return html.replace(/<[^>]+>/g, '').replace(/\u200b/g, '').trim().length;
}

/** 导入结果合同：禁止空白正文；fallback 必须带固定提示 */
export function assertImportQualityContract<T extends ImportQualityFields>(payload: T): T {
  if (plainTextLength(payload.content) === 0) {
    throw new Error('导入失败：结果正文为空，未创建文档');
  }

  if (payload.importQuality !== 'fallback') return payload;

  const warnings = [...(payload.warnings || [])];
  const hasFallbackHint = warnings.some(
    item => item.includes(IMPORT_FALLBACK_MESSAGE) || item.includes('无法完整识别'),
  );
  if (!hasFallbackHint) warnings.unshift(IMPORT_FALLBACK_MESSAGE);

  return {
    ...payload,
    warnings,
  };
}
