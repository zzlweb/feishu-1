import { v4 as uuidv4 } from 'uuid';

export type BaseFieldType =
  | 'text'
  | 'rich_text'
  | 'number'
  | 'single_select'
  | 'multi_select'
  | 'date'
  | 'checkbox'
  | 'user'
  | 'attachment'
  | 'url'
  | 'phone'
  | 'email'
  | 'formula'
  | 'lookup'
  | 'relation'
  | 'created_time'
  | 'updated_time'
  | 'created_by'
  | 'updated_by';

export type BaseViewType = 'grid' | 'kanban' | 'calendar' | 'gallery' | 'gantt' | 'form';

export type CellValue = string | number | boolean | string[] | AttachmentValue[] | null;

export interface SelectChoice {
  id: string;
  name: string;
  color: string;
}

export interface AttachmentValue {
  id: string;
  fileId: string;
  name: string;
  mimeType: string;
  extension: string;
  size: number;
  url?: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  uploadStatus?: 'uploading' | 'processing' | 'success' | 'failed';
}

export interface BaseField {
  id: string;
  name: string;
  type: BaseFieldType;
  options?: { choices?: SelectChoice[] };
  hidden?: boolean;
  required?: boolean;
  defaultValue?: CellValue;
}

export interface BaseRecord {
  id: string;
  tableId: string;
  fields: Record<string, CellValue>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
  parentId?: string;
}

export interface GalleryViewConfig {
  coverFieldId?: string;
  titleFieldId?: string;
  visibleFieldIds: string[];
  coverFit: 'cover' | 'contain';
  coverPosition?: 'center' | 'top' | 'bottom';
  cardSize: 'small' | 'medium' | 'large';
  cardLayoutMode?: 'regular' | 'compact';
  cardAspectRatio: '1:1' | '4:3' | '16:9' | 'auto';
  showFieldNames: boolean;
  showEmptyFields: boolean;
  showAttachmentCount: boolean;
  showRecordActions: boolean;
  groupOrderIds?: string[];
  hiddenGroupIds?: string[];
  showEmptyGroups?: boolean;
  showCreateGroup?: boolean;
  showNewRecordButton?: boolean;
  emptyCoverMode: 'placeholder' | 'hide-cover';
  search?: string;
}

export interface GridViewConfig {
  search?: string;
  fieldWidths?: Record<string, number>;
  rowHeight?: 'low' | 'medium' | 'high';
  parentFieldId?: string;
  groupByFieldIds?: string[];
  groupSortDirections?: ('asc' | 'desc')[];
}

export interface BaseView {
  id: string;
  tableId: string;
  name: string;
  type: BaseViewType;
  config: GalleryViewConfig | GridViewConfig | Record<string, unknown>;
  sorts: unknown[];
  filters: unknown[];
}

export interface BaseTableModel {
  id: string;
  name: string;
  fields: BaseField[];
  records: BaseRecord[];
  views: BaseView[];
  primaryFieldId: string;
  activeViewId: string;
}

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function now() {
  return new Date().toISOString();
}

function defaultStatusChoices(): SelectChoice[] {
  return [
    { id: 'todo', name: '未开始', color: '#dee8ff' },
    { id: 'doing', name: '进行中', color: '#f8e6c2' },
    { id: 'done', name: '已完成', color: '#c7effb' },
  ];
}

function createGalleryConfig(fields: BaseField[], primaryFieldId: string, attachmentFieldId?: string): GalleryViewConfig {
  return {
    coverFieldId: attachmentFieldId,
    titleFieldId: primaryFieldId,
    visibleFieldIds: fields
      .filter(field => field.id !== primaryFieldId && field.type !== 'attachment')
      .slice(0, 4)
      .map(field => field.id),
    coverFit: 'cover',
    coverPosition: 'center',
    cardSize: 'medium',
    cardLayoutMode: 'regular',
    cardAspectRatio: '4:3',
    showFieldNames: false,
    showEmptyFields: false,
    showAttachmentCount: true,
    showRecordActions: false,
    emptyCoverMode: 'placeholder',
  };
}

function createRecord(
  tableId: string,
  fields: BaseField[],
  primaryFieldId: string,
  values: Record<string, CellValue>,
): BaseRecord {
  const time = now();
  const fieldValues: Record<string, CellValue> = {};
  fields.forEach(field => {
    if (field.type === 'attachment') {
      const raw = values[field.id];
      fieldValues[field.id] = Array.isArray(raw) ? raw as AttachmentValue[] : [];
      return;
    }
    if (field.type === 'multi_select') {
      const raw = values[field.id];
      fieldValues[field.id] = Array.isArray(raw) ? raw as string[] : [];
      return;
    }
    fieldValues[field.id] = values[field.id] ?? field.defaultValue ?? '';
  });
  return {
    id: uid('rec'),
    tableId,
    fields: fieldValues as BaseRecord['fields'],
    createdAt: time,
    updatedAt: time,
    createdBy: 'local-user',
  };
}


function createSampleCover(label: string, assetName: string): AttachmentValue[] {
  const url = `/static/gallery/${assetName}`;
  return [{
    id: uid('att'),
    fileId: uid('file'),
    name: `${label}.svg`,
    mimeType: 'image/svg+xml',
    extension: 'svg',
    size: 4096,
    url,
    thumbnailUrl: url,
    previewUrl: url,
    uploadStatus: 'success' as const,
  }];
}

interface BuildTableOptions {
  attachmentFieldId?: string;
  galleryConfig?: Record<string, unknown>;
  kanbanConfig?: Record<string, unknown>;
}

function buildTable(
  name: string,
  fields: BaseField[],
  records: BaseRecord[],
  activeView: BaseViewType,
  options: BuildTableOptions = {},
): BaseTableModel {
  const attachmentFieldId = options.attachmentFieldId;
  const tableId = uid('tbl');
  const primaryFieldId = fields[0].id;
  records.forEach(record => {
    record.tableId = tableId;
  });

  const gridView: BaseView = {
    id: uid('view_grid'),
    tableId,
    name: '列表',
    type: 'grid',
    config: {},
    sorts: [],
    filters: [],
  };
  const galleryView: BaseView = {
    id: uid('view_gallery'),
    tableId,
    name: '画册视图',
    type: 'gallery',
    config: {
      ...createGalleryConfig(fields, primaryFieldId, attachmentFieldId),
      ...options.galleryConfig,
    },
    sorts: [],
    filters: [],
  };
  const kanbanView: BaseView = {
    id: uid('view_kanban'),
    tableId,
    name: '看板',
    type: 'kanban',
    config: {
      ...createGalleryConfig(fields, primaryFieldId, attachmentFieldId),
      ...options.kanbanConfig,
    },
    sorts: [],
    filters: [],
  };
  const activeViewNode = activeView === 'gallery'
    ? galleryView
    : activeView === 'kanban'
      ? kanbanView
      : gridView;

  return {
    id: tableId,
    name,
    fields,
    records,
    views: [gridView, galleryView, kanbanView],
    primaryFieldId,
    activeViewId: activeViewNode.id,
  };
}

export function createStoreSalesTable(): BaseTableModel {
  const storeField = { id: uid('fld_store'), name: '门店', type: 'text' as const, required: true };
  const volumeField = { id: uid('fld_volume'), name: '销售量', type: 'number' as const };
  const revenueField = { id: uid('fld_revenue'), name: '销售额', type: 'number' as const };
  const growthField = { id: uid('fld_growth'), name: '同比增长', type: 'text' as const };
  const noteField = { id: uid('fld_note'), name: '备注', type: 'text' as const };
  const fields = [storeField, volumeField, revenueField, growthField, noteField];

  const records = [
    createRecord('', fields, storeField.id, {
      [storeField.id]: '全部门店合计',
      [volumeField.id]: 4972,
      [revenueField.id]: 75640,
      [growthField.id]: '订单 +44.6% / 销售额 +31.7%',
      [noteField.id]: '本周各门店经营状况对比上周仍呈现上涨趋势',
    }),
    createRecord('', fields, storeField.id, {
      [storeField.id]: '门店 A',
      [volumeField.id]: 1820,
      [revenueField.id]: 28600,
      [growthField.id]: '+38.2%',
      [noteField.id]: '营业额明显上升',
    }),
    createRecord('', fields, storeField.id, {
      [storeField.id]: '门店 B',
      [volumeField.id]: 1650,
      [revenueField.id]: 24800,
      [growthField.id]: '+29.5%',
      [noteField.id]: '经营状况持续好转',
    }),
    createRecord('', fields, storeField.id, {
      [storeField.id]: '门店 C',
      [volumeField.id]: 1502,
      [revenueField.id]: 22240,
      [growthField.id]: '+35.1%',
      [noteField.id]: '销售稳定提升',
    }),
  ];

  return buildTable('门店销售概况', fields, records, 'grid');
}

export function createProductSalesTable(): BaseTableModel {
  const productField = { id: uid('fld_product'), name: '商品', type: 'text' as const, required: true };
  const attachmentField = { id: uid('fld_attachment'), name: '附件', type: 'attachment' as const };
  const mainField = { id: uid('fld_main'), name: '是否当前主推', type: 'checkbox' as const };
  const launchField = { id: uid('fld_launch'), name: '上线时间', type: 'date' as const };
  const flavorField = { id: uid('fld_flavor'), name: 'A= 口味', type: 'text' as const };
  const salesField = { id: uid('fld_sales'), name: '本周销量', type: 'number' as const };
  const ratioField = { id: uid('fld_ratio'), name: '销量环比', type: 'formula' as const };
  const fields = [productField, attachmentField, mainField, launchField, flavorField, salesField, ratioField];

  const records = [
    createRecord('', fields, productField.id, {
      [productField.id]: '冰淇淋',
      [attachmentField.id]: createSampleCover('冰淇淋', 'ice-cream.svg'),
      [mainField.id]: true,
      [launchField.id]: '2026-11-30',
      [flavorField.id]: '焦糖/咖啡/可可/抹茶',
      [salesField.id]: 2890,
      [ratioField.id]: '62%',
    }),
    createRecord('', fields, productField.id, {
      [productField.id]: '马卡龙',
      [attachmentField.id]: createSampleCover('马卡龙', 'macaron.svg'),
      [mainField.id]: true,
      [launchField.id]: '2026-11-30',
      [flavorField.id]: '草莓/芒果/荔枝/山竹',
      [salesField.id]: 678,
      [ratioField.id]: '85%',
    }),
    createRecord('', fields, productField.id, {
      [productField.id]: 'QQ糖',
      [attachmentField.id]: createSampleCover('QQ糖', 'candy.svg'),
      [mainField.id]: true,
      [launchField.id]: '2026-11-30',
      [flavorField.id]: '混合口味',
      [salesField.id]: 556,
      [ratioField.id]: '16%',
    }),
    createRecord('', fields, productField.id, {
      [productField.id]: '树莓慕斯',
      [attachmentField.id]: createSampleCover('树莓慕斯', 'mousse.svg'),
      [mainField.id]: false,
      [launchField.id]: '2026-11-30',
      [flavorField.id]: '树莓/奶油/香草',
      [salesField.id]: 439,
      [ratioField.id]: '23%',
    }),
    createRecord('', fields, productField.id, {
      [productField.id]: '瑞士卷',
      [attachmentField.id]: createSampleCover('瑞士卷', 'swiss-roll.svg'),
      [mainField.id]: false,
      [launchField.id]: '2026-11-30',
      [flavorField.id]: '奶油/可可/榛果',
      [salesField.id]: 382,
      [ratioField.id]: '18%',
    }),
    createRecord('', fields, productField.id, {
      [productField.id]: '主题曲奇',
      [attachmentField.id]: createSampleCover('主题曲奇', 'cookie.svg'),
      [mainField.id]: false,
      [launchField.id]: '2026-11-30',
      [flavorField.id]: '黄油/肉桂/坚果',
      [salesField.id]: 315,
      [ratioField.id]: '12%',
    }),
  ];

  return buildTable('经营商品分析', fields, records, 'gallery', {
    attachmentFieldId: attachmentField.id,
    galleryConfig: {
      showFieldNames: true,
      visibleFieldIds: [mainField.id, launchField.id, flavorField.id, salesField.id, ratioField.id],
      cardAspectRatio: '16:9',
    },
    kanbanConfig: {
      showFieldNames: true,
      visibleFieldIds: [mainField.id, launchField.id, salesField.id, ratioField.id],
    },
  });
}

export function createNewBusinessTable(): BaseTableModel {
  const taskField = { id: uid('fld_task'), name: '任务', type: 'text' as const, required: true };
  const timeField = { id: uid('fld_time'), name: '时间', type: 'text' as const };
  const contentField = {
    id: uid('fld_content'),
    name: '项目内容',
    type: 'single_select' as const,
    options: {
      choices: [
        { id: 'archive', name: '项目各类合同扫描归档', color: '#dbe8ff' },
        { id: 'design', name: '店铺装修设计', color: '#438a3b' },
        { id: 'construction', name: '工程施工装修', color: '#d7357f' },
        { id: 'furniture', name: '家具采购', color: '#6d7d28' },
        { id: 'equipment', name: '运营设备采购', color: '#c76d22' },
        { id: 'strategy', name: '各平台新店推广策略跟进', color: '#82e0d5' },
        { id: 'takeout', name: '外卖新店开通及配置', color: '#f3b1cf' },
        { id: 'supplies', name: '海报/菜单/邀请函等物料打印配送到店', color: '#0b6b80' },
        { id: 'miniapp', name: '小程序设置(手机点单/外送/活动设置等)', color: '#9ad6e8' },
      ],
    },
  };
  const phaseField = {
    id: uid('fld_phase'),
    name: '项目阶段',
    type: 'single_select' as const,
    options: {
      choices: [
        { id: 'early', name: '前期', color: '#ffd59e' },
        { id: 'middle', name: '中期', color: '#f1ddff' },
        { id: 'late', name: '后期', color: '#4e83fd' },
      ],
    },
  };
  const statusField = {
    id: uid('fld_status'),
    name: '项目状态',
    type: 'single_select' as const,
    options: {
      choices: [
        { id: 'done', name: '已完成', color: '#c9e86a' },
        { id: 'doing', name: '进行中', color: '#ffc27a' },
        { id: 'pending', name: '待启动', color: '#e5d4ff' },
      ],
    },
  };
  const shopField = {
    id: uid('fld_shop'),
    name: '店铺名',
    type: 'single_select' as const,
    options: {
      choices: [
        { id: 'luohu', name: '罗湖天河城', color: '#ffd0a3' },
      ],
    },
  };
  const durationField = { id: uid('fld_duration'), name: '预估周期(天)', type: 'number' as const };
  const startField = { id: uid('fld_start'), name: '启动时间', type: 'date' as const };
  const followField = { id: uid('fld_follow'), name: '跟进情况', type: 'text' as const };
  const fields = [taskField, timeField, contentField, phaseField, statusField, shopField, durationField, startField, followField];

  const records = [
    createRecord('', fields, taskField.id, {
      [taskField.id]: '项目各类合同扫描归档',
      [timeField.id]: '11月7日 — 11月10日',
      [contentField.id]: '项目各类合同扫描归档',
      [phaseField.id]: '前期',
      [statusField.id]: '已完成',
      [shopField.id]: '罗湖天河城',
      [durationField.id]: 4,
      [followField.id]: '-',
    }),
    createRecord('', fields, taskField.id, {
      [taskField.id]: '店铺装修设计',
      [timeField.id]: '11月8日 — 11月10日',
      [contentField.id]: '店铺装修设计',
      [phaseField.id]: '前期',
      [statusField.id]: '已完成',
      [shopField.id]: '罗湖天河城',
      [durationField.id]: 7,
      [followField.id]: '-',
    }),
    createRecord('', fields, taskField.id, {
      [taskField.id]: '工程施工装修',
      [timeField.id]: '11月11日 — 11月21日',
      [contentField.id]: '工程施工装修',
      [phaseField.id]: '前期',
      [statusField.id]: '进行中',
      [shopField.id]: '罗湖天河城',
      [durationField.id]: 10,
      [followField.id]: '-',
    }),
    createRecord('', fields, taskField.id, {
      [taskField.id]: '家具采购',
      [timeField.id]: '11月20日 — 12月4日',
      [contentField.id]: '家具采购',
      [phaseField.id]: '中期',
      [statusField.id]: '进行中',
      [shopField.id]: '罗湖天河城',
      [durationField.id]: 20,
      [followField.id]: '-',
    }),
    createRecord('', fields, taskField.id, {
      [taskField.id]: '运营设备采购',
      [timeField.id]: '11月20日 — 12月7日',
      [contentField.id]: '运营设备采购',
      [phaseField.id]: '中期',
      [statusField.id]: '进行中',
      [shopField.id]: '罗湖天河城',
      [durationField.id]: 20,
      [followField.id]: '-',
    }),
    createRecord('', fields, taskField.id, {
      [taskField.id]: '各平台新店推广策略跟进',
      [timeField.id]: '12月1日 — 12月1日',
      [contentField.id]: '各平台新店推广策略跟进',
      [phaseField.id]: '后期',
      [statusField.id]: '已完成',
      [shopField.id]: '罗湖天河城',
      [durationField.id]: 30,
      [followField.id]: '-',
    }),
    createRecord('', fields, taskField.id, {
      [taskField.id]: '外卖新店开通及配置',
      [timeField.id]: '12月1日 — 12月31日',
      [contentField.id]: '外卖新店开通及配置',
      [phaseField.id]: '后期',
      [statusField.id]: '待启动',
      [shopField.id]: '罗湖天河城',
      [durationField.id]: 30,
      [followField.id]: '-',
    }),
    createRecord('', fields, taskField.id, {
      [taskField.id]: '海报/菜单/邀请函等物料打印配送到店',
      [timeField.id]: '12月1日 — 12月31日',
      [contentField.id]: '海报/菜单/邀请函等物料打印配送到店',
      [phaseField.id]: '后期',
      [statusField.id]: '待启动',
      [shopField.id]: '罗湖天河城',
      [durationField.id]: 30,
      [followField.id]: '-',
    }),
    createRecord('', fields, taskField.id, {
      [taskField.id]: '小程序设置(手机点单/外送/活动设置等)',
      [timeField.id]: '12月1日 — 12月31日',
      [contentField.id]: '小程序设置(手机点单/外送/活动设置等)',
      [phaseField.id]: '后期',
      [statusField.id]: '待启动',
      [shopField.id]: '罗湖天河城',
      [durationField.id]: 30,
      [followField.id]: '-',
    }),
  ];

  return buildTable('开启管理', fields, records, 'kanban', {
    kanbanConfig: {
      groupByFieldId: phaseField.id,
      showFieldNames: true,
      visibleFieldIds: [timeField.id, contentField.id, phaseField.id, statusField.id, shopField.id, durationField.id, startField.id, followField.id],
      cardLayoutMode: 'compact',
      showEmptyGroups: false,
      showCreateGroup: false,
      showNewRecordButton: true,
    },
  });
}

export function serializeBaseTableModel(table: BaseTableModel): string {
  return JSON.stringify(table);
}

function escapeHtmlAttr(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function renderDashboardChartHtml(
  title: string,
  link: {
    sourceTableId: string;
    labelFieldName: string;
    valueFieldName: string;
    excludeLabels?: string[];
  },
  fallbackSlices: Array<{ label: string; value: number; color: string }> = [],
): string {
  const blockId = `localdashboard-${uuidv4()}`;
  const config = escapeHtmlAttr(JSON.stringify({
    link,
    slices: fallbackSlices,
  }));
  const escapedTitle = escapeHtmlAttr(title);
  const escapedTableId = escapeHtmlAttr(link.sourceTableId);
  return [
    `<div data-block-id="${blockId}" id="${blockId}"`,
    ` data-local-block="dashboard" data-chart-type="donut"`,
    ` data-title="${escapedTitle}" data-source-table-id="${escapedTableId}"`,
    ` data-config="${config}"`,
    ` class="feishu-dashboard-chart-block">`,
    `<div class="feishu-dashboard-chart-block__placeholder">${escapedTitle}</div></div>`,
  ].join('');
}

export function renderBitableBlockHtml(table: BaseTableModel, activeView: 'grid' | 'gallery' | 'kanban'): string {
  const blockId = `localbitableblock-${uuidv4()}`;
  const modelJson = escapeHtmlAttr(serializeBaseTableModel(table));
  const title = escapeHtmlAttr(table.name);
  return [
    `<div data-block-id="${blockId}" id="${blockId}"`,
    ` data-title="${title}" data-columns="" data-rows=""`,
    ` data-view="${activeView}" data-covers=""`,
    ` data-model="${modelJson}" data-local-block="bitable"`,
    ` class="feishu-bitable-block feishu-base-block">`,
    `<div class="base-viewbar">${table.name}</div></div>`,
  ].join('');
}
