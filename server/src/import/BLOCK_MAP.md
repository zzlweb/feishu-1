# 飞书 Block → 本地节点映射表

> 代码真源：`blockMap.ts`（`FEISHU_BLOCK_MAP`）。改映射时先改代码，再同步本文。

支持度：

| 等级 | 含义 |
| --- | --- |
| `full` | 结构化语义完整映射到本地可编辑节点 |
| `partial` | 主要内容可用，但有降级 / 缺字段 / 资源可能失败 |
| `unsupported` | 无法还原飞书原生能力，至少保留可见卡片或子文本 + warning |

## 高频正文块

| 飞书类型 / 字段 | 本地目标 | 支持度 | 备注 |
| --- | --- | --- | --- |
| `page` (1) | 文档根 / 标题抽取 | full | 不单独输出节点 |
| `text` (2) | TipTap `paragraph` | full | |
| `heading1`–`heading6` (3–8) | TipTap `heading` | full | |
| `bullet` (9) / `ordered` (10) | TipTap list | full | |
| `code` (11) | TipTap `codeBlock` | full | |
| `quote` (12) | TipTap `blockquote` | full | |
| `todo` (13) | TipTap `taskList` | full | |
| `image` | TipTap `image` / embed 占位 | partial | 经 `assetPipeline` 落盘；失败保留卡片 |
| `file` | `localEmbedBlock` (kind=file) | partial | 优先下载；失败 warning |
| `table` (31) / `table_cell` (32) | TipTap `table` | full | 含 rowspan/colspan/背景色 |
| `equation` | `localFormulaBlock` | full | KaTeX 公式块 |
| `grid` / `grid_column` | `localColumnsBlock` / `localImageGridBlock` | full | 纯图 grid → 图片排版；混排 → 分栏 |
| `quote_container` (34) | `blockquote` | full | 展开子块 |
| `callout` | `highlightBlock` | full | |
| `divider` (22) | `horizontalRule` | full | |
| `chat_card` (20) | `localEmbedBlock` (kind=group) | full | 本地群名片，保留入群链接 |
| Wiki 子页面列表 (42 / 51) | `localEmbedBlock` (kind=subdoc-list) | full | 保留目录与可用的子页面标题 |

## 多维表格 / 仪表盘

| 飞书类型 | 本地目标 | 支持度 | 备注 |
| --- | --- | --- | --- |
| `bitable` | `localBitableBlock` / `BaseTable` | partial | API 有 fields/records/views → full；否则占位 + warning |
| `reference_base` | 同上 | partial | 按 token 拉取 |
| 仪表盘（公开页近似） | `localDashboardChartBlock` | partial | 公开 HTML 推断 |

## 明确降级（unsupported / 可见卡片）

| 飞书类型 | 本地目标 | 支持度 | 备注 |
| --- | --- | --- | --- |
| `sheet` | embed | unsupported | 保留标题卡片 |
| `mindnote` | embed | unsupported | |
| `diagram` | embed | unsupported | |
| `jira_issue` / `add_ons` | embed | unsupported | |
| 未知 `block_type` | highlight 或 embed | unsupported | **不得丢弃子文本**；写入 `unsupported_blocks` |

## 资源

图片 / 附件导入时写入 `/api/feishu-media/:token`，打开文档时由后端带飞书 Authorization 代理直出，**不再**在导入阶段落盘到 `server/public/uploads`。跨租户无权限时代理会 403，前端显示破图或占位。
