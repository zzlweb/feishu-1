export type FeishuSampleCapability =
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'highlight'
  | 'columns'
  | 'dashboard'
  | 'table'
  | 'image'
  | 'embed'
  | 'bitable'
  | 'gallery'
  | 'kanban'
  | 'field-types'
  | 'user-placeholder';

export interface FeishuSampleCapabilityRow {
  sampleId: string;
  title: string;
  capabilities: FeishuSampleCapability[];
  unsupportedBlocks: Array<{ type: string; reason: string }>;
}

export const FEISHU_SAMPLE_CAPABILITY_MATRIX: FeishuSampleCapabilityRow[] = [
  {
    sampleId: 'business-report',
    title: '业务经营周报',
    capabilities: ['heading', 'paragraph', 'highlight', 'columns', 'dashboard', 'bitable', 'gallery', 'kanban'],
    unsupportedBlocks: [
      { type: 'bitable-schema', reason: '公开页面不暴露多维表格字段、记录、视图配置，使用本地业务周报模型补齐。' },
    ],
  },
  {
    sampleId: 'bitable-quickstart',
    title: '多维表格快速入门指南',
    capabilities: ['heading', 'paragraph', 'highlight', 'columns', 'embed', 'field-types', 'bitable'],
    unsupportedBlocks: [],
  },
  {
    sampleId: 'bitable-template-list',
    title: '多维表格模板合集',
    capabilities: ['heading', 'paragraph', 'highlight', 'columns', 'embed'],
    unsupportedBlocks: [
      { type: 'template-gallery-source', reason: '公开页面不暴露模板库背后的卡片/画册数据源。' },
    ],
  },
  {
    sampleId: 'map-dashboard',
    title: '地图组件与仪表盘',
    capabilities: ['heading', 'paragraph', 'highlight', 'table', 'dashboard'],
    unsupportedBlocks: [
      { type: 'third-party-map-plugin', reason: '第三方地图插件无法在公开 HTML 中获得可运行配置，降级为表格/说明块。' },
    ],
  },
  {
    sampleId: 'map-statistics',
    title: '地图统计',
    capabilities: ['heading', 'paragraph', 'highlight', 'columns', 'dashboard'],
    unsupportedBlocks: [
      { type: 'ai-map-statistics-plugin', reason: 'AI 地图统计插件需要登录态和插件 SDK，公开导入只保留说明与图表比例。' },
    ],
  },
  {
    sampleId: 'yolo-review-plan',
    title: 'YOLO Master 内测计划',
    capabilities: ['heading', 'paragraph', 'highlight', 'dashboard', 'user-placeholder'],
    unsupportedBlocks: [
      { type: 'comments', reason: '公开页面可见评论/修订提示，但不暴露评论线程数据。' },
      { type: 'revision-mode', reason: '修订模式不是当前本地组件类型，降级为正文说明。' },
    ],
  },
];

export function getSampleCapabilityRow(sampleId: string) {
  return FEISHU_SAMPLE_CAPABILITY_MATRIX.find(row => row.sampleId === sampleId);
}
