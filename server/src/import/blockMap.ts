/** 飞书 block → 本地节点映射（与 BLOCK_MAP.md 保持同步） */

export type BlockSupportLevel = 'full' | 'partial' | 'unsupported';

export interface FeishuBlockMapping {
  /** 飞书 block_type 数字或语义字段名 */
  feishu: string;
  /** 人类可读名称 */
  name: string;
  /** 本地 TipTap / Bitable 目标 */
  local: string;
  support: BlockSupportLevel;
  notes?: string;
}

export const FEISHU_BLOCK_MAP: FeishuBlockMapping[] = [
  { feishu: '1', name: 'page', local: 'document-root', support: 'full', notes: '抽取标题，不输出独立节点' },
  { feishu: '2', name: 'text / paragraph', local: 'paragraph', support: 'full' },
  { feishu: '3', name: 'heading1', local: 'heading', support: 'full' },
  { feishu: '4', name: 'heading2', local: 'heading', support: 'full' },
  { feishu: '5', name: 'heading3', local: 'heading', support: 'full' },
  { feishu: '6', name: 'heading4', local: 'heading', support: 'full' },
  { feishu: '7', name: 'heading5', local: 'heading', support: 'full' },
  { feishu: '8', name: 'heading6', local: 'heading', support: 'full' },
  { feishu: '9', name: 'bullet', local: 'bulletList', support: 'full' },
  { feishu: '10', name: 'ordered', local: 'orderedList', support: 'full' },
  { feishu: '11', name: 'code', local: 'codeBlock', support: 'full' },
  { feishu: '12', name: 'quote', local: 'blockquote', support: 'full' },
  { feishu: '13', name: 'todo', local: 'taskList', support: 'full' },
  { feishu: '22', name: 'divider', local: 'horizontalRule', support: 'full' },
  { feishu: 'image', name: 'image', local: 'image / embed', support: 'partial', notes: 'assetPipeline 落盘；失败保留卡片' },
  { feishu: 'file', name: 'file', local: 'localEmbedBlock', support: 'partial' },
  { feishu: '31', name: 'table', local: 'table', support: 'full' },
  { feishu: '32', name: 'table_cell', local: 'tableCell', support: 'full' },
  { feishu: 'equation', name: 'equation', local: 'localFormulaBlock', support: 'full' },
  { feishu: 'grid', name: 'grid / columns', local: 'localColumnsBlock', support: 'full' },
  { feishu: '34', name: 'quote_container', local: 'blockquote', support: 'full' },
  { feishu: 'callout', name: 'callout', local: 'highlightBlock', support: 'full' },
  { feishu: 'bitable', name: 'bitable', local: 'localBitableBlock', support: 'partial' },
  { feishu: 'reference_base', name: 'reference_base', local: 'localBitableBlock', support: 'partial' },
  { feishu: 'sheet', name: 'sheet', local: 'localEmbedBlock', support: 'unsupported' },
  { feishu: 'mindnote', name: 'mindnote', local: 'localEmbedBlock', support: 'unsupported' },
  { feishu: 'diagram', name: 'diagram', local: 'localEmbedBlock', support: 'unsupported' },
  { feishu: 'chat_card', name: 'chat_card', local: 'localEmbedBlock', support: 'unsupported' },
  { feishu: 'jira_issue', name: 'jira_issue', local: 'localEmbedBlock', support: 'unsupported' },
  { feishu: 'add_ons', name: 'add_ons', local: 'localEmbedBlock', support: 'unsupported' },
];

/** 高频块：须声明为 full 或 partial（含 image/file） */
const REQUIRED_HIGH_FREQUENCY = [
  '2', '3', '9', '10', '11', '12', 'image', 'file', 'equation', 'grid', '31',
];

/** 高频块必须声明为 full 或 partial，防止映射表回退 */
export function assertHighFrequencyBlockCoverage(map: FeishuBlockMapping[] = FEISHU_BLOCK_MAP) {
  for (const key of REQUIRED_HIGH_FREQUENCY) {
    const entry = map.find(item => item.feishu === key);
    if (!entry) throw new Error(`BLOCK_MAP 缺少高频类型：${key}`);
    if (entry.support === 'unsupported') {
      throw new Error(`高频类型 ${key} 不应标记为 unsupported`);
    }
  }
}

export function lookupBlockSupport(feishuType: string | number): BlockSupportLevel {
  const key = String(feishuType);
  const byType = FEISHU_BLOCK_MAP.find(item => item.feishu === key);
  if (byType) return byType.support;
  const byName = FEISHU_BLOCK_MAP.find(item => item.name.split(' / ')[0] === key || item.name === key);
  return byName?.support || 'unsupported';
}
