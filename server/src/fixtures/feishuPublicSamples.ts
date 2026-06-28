export interface FeishuPublicSampleFixture {
  id: string;
  title: string;
  url: string;
  rawHtml: string;
  expectedCapabilities: string[];
  unsupportedBlocks: string[];
}

function page(title: string, body: string) {
  return `<!doctype html><html><head><title>${title} - 飞书云文档</title></head><body>${body}</body></html>`;
}

export const FEISHU_PUBLIC_SAMPLE_FIXTURES: FeishuPublicSampleFixture[] = [
  {
    id: 'business-report',
    title: '业务经营周报',
    url: 'https://qcntpn5n60jv.feishu.cn/wiki/H58uwRchYi7889k6dnJcVoMMnO5',
    rawHtml: page('业务经营周报', `
      <h1>业务经营周报</h1>
      <h2>一、门店销售概况</h2>
      <p>用 1-3 句话概括整体情况</p>
      <p>📍</p>
      <p>各门店本周销售量 4972 单，同比上周增长 44.6%，销售总额 ￥75640 ，同比上周增长 31.7%</p>
      <p>40%</p><p>60%</p>
      <h2>二、商品销售概括</h2>
      <p>📍</p>
      <p>甜品冰淇淋稳居高位，大范围领先</p>
      <h2>三、新业务开展进度</h2>
      <p>📍</p>
      <p>蛇口百草堂店筹备进度 70%，暂无风险</p>
    `),
    expectedCapabilities: ['heading', 'highlight', 'dashboard', 'bitable', 'gallery', 'kanban'],
    unsupportedBlocks: ['bitable-schema'],
  },
  {
    id: 'bitable-quickstart',
    title: '多维表格 快速入门指南 & 学习测验地图',
    url: 'https://sudo.feishu.cn/wiki/wikcnwkGXCivuQI03mXMkpnzpmg?table=tbl1XclMyN18uaXF',
    rawHtml: page('多维表格 快速入门指南 & 学习测验地图', `
      <h1>多维表格 快速入门指南 & 学习测验地图</h1>
      <p>🔗</p>
      <p>💡</p>
      <p>👏 如果对本文档内容感兴趣，欢迎直接文档【评论交流】。</p>
      <p>50%</p><p>50%</p>
      <h2>官方课程资源推荐</h2>
      <p>📌</p>
      <p>推荐课程：一表人才|飞书多维表格实战课【大礼包】</p>
      <p>推荐资料：多维表格百宝箱 | 多维表格资源导航 | 课程&社区&模版&资料</p>
      <p>50%</p><p>50%</p>
      <h2>多维表格学习地图</h2>
      <h3>能力分级</h3>
      <p>💡</p>
      <p>初阶操作：多行文本|数字|单选多选|复选框|日期|超链接|公式|人员|附件|电话号码</p>
      <p>中阶操作：关联字段|公式字段|查找引用字段|仪表盘功能</p>
    `),
    expectedCapabilities: ['heading', 'columns', 'highlight', 'embed', 'field-types', 'bitable'],
    unsupportedBlocks: [],
  },
  {
    id: 'bitable-template-list',
    title: '📊 多维表格模板（持续更新）',
    url: 'https://sudo.feishu.cn/wiki/wikcnqftUBiowXThqMosGqeQxrf',
    rawHtml: page('多维表格模板（持续更新）', `
      <h1>📊 多维表格模板（持续更新）</h1>
      <p>🔗</p>
      <h2>🚀 学习地图 🚀</h2>
      <p>🚀</p>
      <p>多维表格 快速入门指南 & 学习测验地图</p>
      <h2>📚 完整模板 📚</h2>
      <h2>📄 功能示例 📄</h2>
      <h2>😁 关于本人 😁</h2>
      <p>47%</p><p>53%</p>
      <p>希望以上能帮助你在飞书获得高效且愉悦的工作学习体验，Enjoy</p>
      <h2>⏳ 我能帮你做什么 ⏳</h2>
    `),
    expectedCapabilities: ['heading', 'columns', 'embed', 'highlight'],
    unsupportedBlocks: ['template-gallery-source'],
  },
  {
    id: 'map-dashboard',
    title: '地图组件｜多维表格仪表盘 & 应用模式',
    url: 'https://maptable.feishu.cn/wiki/ETtOwMd9biUEMTkcWgPcfLe1nlc?fromScene=spaceOverview',
    rawHtml: page('地图组件｜多维表格仪表盘 & 应用模式', `
      <h1>地图组件｜多维表格仪表盘 & 应用模式</h1>
      <p>❗</p>
      <p>写在前面：受飞书SDK限制，目前地图组件（及其它第三方插件）在部分场景不可用。</p>
      <h2>🧭 应用简介</h2>
      <p>地图组件主要满足用户在多维表格仪表盘及应用模式中的可视化展示需求。</p>
      <p>50%</p><p>50%</p>
      <h2>在仪表盘中使用</h2>
      <table><tr><th>类型</th><th>介绍</th><th>截图</th></tr><tr><td>区域地图</td><td>适合按行政区查看数据进行下钻分析</td><td></td></tr><tr><td>热力图</td><td>通过颜色显示不同区域的活动密度和热点情况</td><td></td></tr></table>
    `),
    expectedCapabilities: ['heading', 'highlight', 'table', 'dashboard'],
    unsupportedBlocks: ['third-party-map-plugin'],
  },
  {
    id: 'map-statistics',
    title: '地图统计',
    url: 'https://maptable.feishu.cn/wiki/NIC8wKlWXikDN0kUfiYcXSmrngd',
    rawHtml: page('地图统计', `
      <h1>地图统计</h1>
      <p>地图统计为企业版功能</p>
      <p>🍞</p>
      <p>功能简介：用画圈选定范围、当前窗口等方式，以统计数字、图表的形式，呈现统计数据。</p>
      <h2>统计片区画像</h2>
      <h2>客户拜访进度及 AI 总结</h2>
      <h2>开启地图统计</h2>
      <p>50%</p><p>50%</p>
      <h2>配置地图统计</h2>
      <p>筛选统计范围：全部数据、当前视图范围</p>
    `),
    expectedCapabilities: ['heading', 'highlight', 'dashboard', 'columns'],
    unsupportedBlocks: ['ai-map-statistics-plugin'],
  },
  {
    id: 'yolo-review-plan',
    title: 'YOLO Master 内测计划',
    url: 'https://my.feishu.cn/docx/FwivdWGqMoYQPSxMotMcYVIrnOh',
    rawHtml: page('YOLO Master 内测计划', `
      <h1>YOLO Master 内测计划</h1>
      <p>user 8611</p><p>user 4207</p><p>Modified April 21, 2025</p>
      <p>🥇</p>
      <p>YOLO Master项目正在招募内测小伙伴，参与教程和 repo review。</p>
      <h2>Examples of Reviews</h2>
      <p>🐵</p>
      <p>如果大家整篇的review，可以采用这种方式。</p>
      <h2>Review方法举例</h2>
      <p>🍞</p>
      <p>请采用评论进行反馈</p>
      <p>51%</p><p>49%</p>
      <h2>修改举例</h2>
      <h3>无效举例1</h3>
      <p>🏖️</p>
      <p>以下为有效review修改</p>
    `),
    expectedCapabilities: ['heading', 'highlight', 'dashboard', 'user-placeholder'],
    unsupportedBlocks: ['comments', 'revision-mode'],
  },
];

export const FEISHU_PUBLIC_SAMPLE_BY_URL = new Map(
  FEISHU_PUBLIC_SAMPLE_FIXTURES.map(sample => [sample.url, sample]),
);

export function findFeishuPublicSample(urlString: string): FeishuPublicSampleFixture | undefined {
  const input = new URL(urlString);
  return FEISHU_PUBLIC_SAMPLE_FIXTURES.find(sample => {
    const url = new URL(sample.url);
    return url.hostname === input.hostname && url.pathname === input.pathname;
  });
}
