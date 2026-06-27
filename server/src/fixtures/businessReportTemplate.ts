import {
  createNewBusinessTable,
  createProductSalesTable,
  createStoreSalesTable,
  renderBitableBlockHtml,
  renderDashboardChartHtml,
} from '../bitableModelFactory';

const SOURCE_URL = 'https://qcntpn5n60jv.feishu.cn/wiki/H58uwRchYi7889k6dnJcVoMMnO5';

function renderHighlightBlock(content: string, bg = '#e1eaff', border = '#82a7fc') {
  return [
    `<div data-type="highlight-block" data-bg-color="${bg}" data-border-color="${border}"`,
    ` data-text-color="#1f2329" class="feishu-highlight-block">${content}</div>`,
  ].join('');
}

function renderColumns(columns: string[]) {
  const ratios = columns.length === 2 ? [58, 42] : columns.map(() => Math.floor(100 / Math.max(columns.length, 1)));
  const cols = columns.map((column, index) => [
    `<div class="feishu-columns-block__col-wrap" data-width-ratio="${ratios[index] ?? 50}" data-local-column="true">`,
    `<div class="feishu-columns-block__col">${column}</div></div>`,
  ].join('')).join('');
  return `<div class="feishu-columns-node" data-local-block="columns">${cols}</div>`;
}

function renderTaskList(items: Array<{ id: string; text: string; checked?: boolean }>) {
  const tasks = items.map(item => [
    `<li data-block-id="${item.id}" id="${item.id}" data-type="taskItem" data-checked="${item.checked ? 'true' : 'false'}">`,
    `<label><input type="checkbox"${item.checked ? ' checked="checked"' : ''}><span></span></label>`,
    `<div><p>${item.text}</p></div></li>`,
  ].join('')).join('');
  return `<ul data-type="taskList">${tasks}</ul>`;
}

export function buildBusinessReportDocumentContent(): string {
  const storeTable = createStoreSalesTable();
  const productTable = createProductSalesTable();
  const businessTable = createNewBusinessTable();
  const storeChart = renderDashboardChartHtml('门店销售占比', {
    sourceTableId: storeTable.id,
    labelFieldName: '门店',
    valueFieldName: '销售量',
    excludeLabels: ['全部门店合计'],
  }, [
    { label: '门店 A', value: 1820, color: '#3370ff' },
    { label: '门店 B', value: 1650, color: '#14c0ff' },
    { label: '门店 C', value: 1502, color: '#ffc60a' },
  ]);

  return [
    '<h1>业务经营周报</h1>',
    `<blockquote><p>来源：<a href="${SOURCE_URL}" target="_blank" rel="noopener noreferrer">${SOURCE_URL}</a></p></blockquote>`,
    '<h2>一、门店销售概况</h2>',
    '<p>用 1-3 句话概括整体情况</p>',
    renderColumns([
      renderHighlightBlock('<p>各门店本周销售量 <strong>4972</strong> 单，同比上周增长 <strong>44.6%</strong>，销售总额 <strong>￥75640</strong> ，同比上周增长 <strong>31.7%</strong></p><p>本周各门店经营状况对比上周仍呈现上涨趋势 ↑，各门店营业额均有明显上升 ↑，经营状况持续好转</p>', '#e1eaff', '#82a7fc'),
      storeChart,
    ]),
    '<p style="color:#8f959e;font-size:13px;">复制多维表格的仪表盘图表，粘贴在文档中即可展示图表。修改多维表格数据后，点击刷新即可更新图表数据</p>',
    renderBitableBlockHtml(storeTable, 'grid'),
    '<h2>二、商品销售概括</h2>',
    renderHighlightBlock('<p>甜品冰淇淋稳居高位，大范围领先</p>', '#d9f5d6', '#8ee085'),
    '<p style="color:#8f959e;font-size:13px;">可以通过切换多维表格的视图，展示画册或列表视图</p>',
    renderBitableBlockHtml(productTable, 'gallery'),
    '<h2>三、新业务开展进度</h2>',
    renderHighlightBlock('<p>蛇口百草堂店筹备进度 <strong>70%</strong>，暂无风险</p>', '#feead2', '#ffba6b'),
    '<p style="color:#8f959e;font-size:13px;">插入任务清单，切换至看板视图，可清晰展示指派的任务、项目成员的进度、项目里程碑等</p>',
    renderTaskList([
      { id: 'task-biz-1', text: '蛇口百草堂店筹备', checked: true },
      { id: 'task-biz-2', text: '门店装修验收', checked: false },
      { id: 'task-biz-3', text: '人员招聘与培训', checked: false },
    ]),
    '<p style="color:#8f959e;font-size:13px;">鼠标悬浮在空白行左侧，在"+"工具栏的 团队协作 模块点击 任务清单 插入文档</p>',
    renderBitableBlockHtml(businessTable, 'kanban'),
  ].join('');
}

export function getBusinessReportTemplateRecord() {
  return {
    id: 'tpl-business-report',
    title: '业务经营周报',
    author: '飞书公开文档',
    created_at: '2026-06-27T07:15:00.000Z',
    content: buildBusinessReportDocumentContent(),
  };
}

/** @deprecated use buildBusinessReportDocumentContent */
export function buildBusinessReportTemplateContent(): string {
  return buildBusinessReportDocumentContent();
}
