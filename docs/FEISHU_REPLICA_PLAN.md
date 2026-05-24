# 飞书文档复刻实现复盘与后续执行计划

更新时间：2026-05-24

本文档用于接替 `README.md` 中偏旧的路线说明，作为后续逐项实现、逐项 review 的主清单。每完成一个任务，都按“实现 → 构建/测试 → 手动验收 → review 记录”的节奏推进。

## 当前实现基线

项目是 React + TipTap / ProseMirror + Express 的单用户文档应用。正文以 HTML 保存在 `server/data/db.json`，目前更像“高保真本地文档编辑器”，还不是飞书的多人协作云文档。

已较成熟的部分：

| 模块 | 当前结论 | 关键文件 |
|---|---|---|
| 文档 CRUD / 自动保存 / 标题图标 / 封面预设 | 可用，但产品化字段不足 | `server/src/routes/documents.ts`, `client/src/components/Layout/DocumentPage.tsx` |
| 基础富文本 | 可用 | `client/src/components/Editor/Editor.tsx` |
| Slash / 块菜单 / 选区气泡 | 可用，但右键菜单、键盘排序和像素校准仍缺 | `SlashMenu.tsx`, `ContextMenu.tsx`, `SelectionBubble.tsx` |
| 目录 / 标题折叠 | 会话内可用，折叠状态未持久化 | `feishuHeading.ts`, `headingCollapse.ts`, `Sidebar.tsx` |
| 表格 | 比 README 旧记录更完整：已支持 Excel/HTML 粘贴、行列拖拽重排、合并拆分、背景色、均分列宽等 | `feishuTable.ts`, `FeishuTableOverlay.tsx`, `tableInsert.ts` |
| 分栏 | 真实 ProseMirror 节点，可编辑、调宽、新增栏 | `columnsExtensions.ts`, `columnsNodeViews.tsx` |
| 评论 | 代码已有 text-range mark 和回复 UI 痕迹，但后端创建接口仍主要按块级评论落库，线程语义未闭环 | `CommentSidebar.tsx`, `commentBlockAnchor.ts`, `server/src/routes/documents.ts` |
| 高级块 | 按钮、公式、多维表格等已有可编辑本地块雏形，但和飞书真实能力仍差很远 | `Editor.tsx` 内 `LocalButtonBlock`, `LocalFormulaBlock`, `LocalBitableBlock` |

## README 中需要纠偏的点

以下是目前发现的“文档状态与代码不一致”或“实现名义上有了但未对齐飞书”的地方。

| 项 | README/旧判断 | 当前代码实际 | 纠偏结论 |
|---|---|---|---|
| Excel / HTML 表格粘贴 | 标为未实现 | `Editor.tsx` 调用 `insertTableFromClipboardData()`，`tableInsert.ts` 已解析 HTML table / TSV | 应改为“已实现基础版”，后续补样式、合并单元格、表头识别 |
| 表格行列拖拽重排 | 标为未实现 | `FeishuTableOverlay.tsx` 已接 `moveTableRow/Column()` 和拖拽插入线 | 应改为“已实现简单表格版”，合并单元格场景不支持 |
| 评论回复线程 | 标为未实现 | UI 有回复入口，但 `POST /comments` 未接 `thread_id/parent_id`，服务端 patch 也未处理这些字段 | 应保持“部分实现”，不能标完成 |
| 划词评论 | 标为未实现 | 前端已有 `CommentHighlightMark` 和 text-range 事件，但后端创建接口只取基础字段，range/anchor 未完整保存 | 应标为“前端雏形，数据闭环未完成” |
| 统一 blockId | 说主要覆盖 heading / paragraph | 代码确实只给 paragraph / heading 加了全局 `blockId`，highlight/media 等局部有自己的 id；列表、quote、code、table、columns 无统一块 ID | 仍是 P0 必做 |
| duplicate 复制封面 | README 曾指出问题 | 已修复 `cover_url` / `icon` / `parent_id` 基础元信息复制 | 后续仍需定义权限、评论、历史版本等继承策略 |
| API 响应格式 | 路线中说待统一 | 主要文档接口已经 `{ code, data, message }` | 可改为“基本统一，需补错误码和类型约束” |
| 高级块真实化 | 旧文档说多数占位 | 代码已有按钮、公式、多维表格的本地编辑能力 | 仍不能算对齐飞书，只能从“占位”升到“本地雏形” |

## 错误实现 / 未对齐飞书的实现

1. 块模型不完整  
   飞书的基础是稳定块树和块 ID。当前 `CommentAnchorAttributes` 只覆盖 `paragraph`、`heading`，导致列表项、引用、代码块、表格、分栏、嵌入块无法统一评论、拖拽、复制链接和多选。

2. 标题 ID 和块 ID 是两套概念  
   `feishuHeading.ts` 使用 `headingId`，`blockLink.ts` 读取 `blockId`。标题既用于目录又作为普通块时，应该统一锚点语义，否则评论、目录、块链接会各走各的 ID。

3. 折叠状态只存在 React 内存里  
   刷新后标题折叠丢失，和飞书“文档状态可恢复”的体验不一致。需要写入文档元数据或内容 JSON。

4. 表格能力是“简单矩阵优先”  
   行列拖拽依赖 `getSimpleTableDimensions()`，遇到 `rowspan/colspan` 会拒绝操作；粘贴也只保留纯文本和基础行列，未完整保留 Excel 样式、合并单元格、链接、背景色。

5. 评论模型前后端脱节  
   前端类型已有 `thread_id`、`parent_id`、`anchor_json`、`anchor_type`，后端创建接口仍只落 `content/block_id/position_from/to`。飞书式划词评论、回复线程、锚点丢失状态还没有闭环。

6. 子文档转换 API 名称和真实行为不符  
   `POST /:id/to-child` 只是更新一个文档的 `parent_id`，不是“把当前块内容迁移为子文档，并在父文档留下卡片”。块菜单里的“转换为子文档”不能直接当完成。

7. 高级块不是飞书真实能力  
   `LocalFormulaBlock` 只是文本输入和显示，没有 KaTeX 渲染；`LocalBitableBlock` 是本地表格，不是多维表格；同步块没有源块引用和同步机制。

8. 右键菜单缺失  
   飞书大量块操作来自右键/块柄统一菜单。当前仍以 hover 六点柄为主，浏览器右键未接管。

9. 首页产品化是静态壳  
   最近、共享、收藏、搜索、宫格视图等还没有后端字段支撑，不能作为飞书工作台体验验收。

10. 协作、权限、历史版本缺失  
    当前没有 Yjs/WebSocket、ACL、版本快照。复刻“飞书文档”时这是后期大项，但不能在完成度里被弱化。

## 后续执行计划

### P0：校准基线，先消除错误状态

| 编号 | 任务 | 范围 | 完成标准 | Review 重点 |
|---|---|---|---|---|
| P0.1 | 修正 README 状态表 | `README.md` | 表格粘贴、行列拖拽、评论线程等状态与代码一致 | 不夸大完成度 |
| P0.2 | 建立 `docs/feishu-spec/` 对照资料 | `docs/feishu-spec/` | 至少覆盖块菜单、Slash、评论、目录、表格 5 类截图/尺寸记录 | 每个截图有来源、日期、关键尺寸 |
| P0.3 | 修复 duplicate 丢 `cover_url` | `server/src/routes/documents.ts` | ✅ 复制文档保留封面、图标、父级等基础元信息 | API 测试已覆盖 |
| P0.4 | 统一块 ID 设计方案 | 新建设计文档或 `feishuBlockId.ts` | 明确哪些 node 有 `blockId`、如何生成、如何 parse/render | 不用 pos 当持久 ID |

### P1：块数据基础

| 编号 | 任务 | 范围 | 完成标准 | Review 重点 |
|---|---|---|---|---|
| P1.1 | `blockId` 覆盖所有可操作块 | TipTap extensions | ✅ paragraph / heading / listItem / blockquote / codeBlock / table / columns / media / embed 刷新后都有稳定 `data-block-id` | 粘贴旧内容自动补 ID |
| P1.2 | 合并 heading / table 锚点语义 | `feishuHeading.ts`, `feishuTable.ts`, `Sidebar.tsx` | ✅ 标题目录、块链接、评论、表格块使用一致 ID 策略 | 不破坏旧 hash |
| P1.3 | 持久化折叠状态 | `database.ts`, `documents.ts`, `DocumentPage.tsx` | ✅ 标题折叠刷新后恢复 | 自动保存节流，避免频繁写库 |
| P1.4 | 块定位统一 API | `blockDom.ts`, `blockLink.ts` | ✅ 一个函数能按 blockId 找到块 DOM | 列表/表格/分栏也能定位 |

### P2：核心块操作闭环

| 编号 | 任务 | 范围 | 完成标准 | Review 重点 |
|---|---|---|---|---|
| P2.1 | 六点柄真实拖拽排序 | `feishuBlockDrag.ts`, `Editor.tsx` | ✅ 段落、标题、列表项等同父级块可拖拽换序，undo 可用 | ProseMirror transaction 正确 |
| P2.2 | 块菜单补齐 | `ContextMenu.tsx`, `insertBelowBlocks.ts` | ✅ 在上方添加、转换类型、保存为模板、转子文档可用 | 不丢内容，不影响表格菜单 |
| P2.3 | 多块选择增强 | `FeishuBoxBlockSelection.tsx`, `boxSelectionModel.ts` | ✅ 支持 Shift 点击、批量复制、批量移动 | 选择状态清理可靠 |
| P2.4 | 右键统一菜单 | `Editor.tsx`, `ContextMenu.tsx` | ✅ 右键打开飞书风格块菜单 | 和浏览器文本选择不冲突 |
| P2.5 | 真正的转子文档 | 前后端 API + Editor | ✅ 把选中块迁入新文档，父文档留下子文档卡片 | 数据迁移可撤销或有明确失败回滚 |

### P3：表格与分栏对齐

| 编号 | 任务 | 范围 | 完成标准 | Review 重点 |
|---|---|---|---|---|
| P3.1 | 表格粘贴增强 | `tableInsert.ts` | ✅ HTML/Excel 粘贴保留基础链接、换行、表头、背景色；合并单元格有降级策略 | 不破坏普通文本粘贴 |
| P3.2 | 合并单元格下的行列拖拽策略 | `tableInsert.ts`, `FeishuTableOverlay.tsx` | 对复杂表格禁用时给出提示，或支持安全移动 | 不产生坏表格 |
| P3.3 | 冻结首行/首列 | `feishuTable.ts`, `FeishuTableOverlay.tsx` | 可切换并持久化，视觉滚动正确 | 横向/纵向滚动边界 |
| P3.4 | 分栏删除、重排、转普通块 | `columnsNodeViews.tsx`, `columnsHelpers.ts` | 分栏能删除栏、移动栏、还原为普通块 | 内容不丢 |

### P4：评论、@ 与通知前置

| 编号 | 任务 | 范围 | 完成标准 | Review 重点 |
|---|---|---|---|---|
| P4.1 | 评论线程后端闭环 | `database.ts`, `documents.ts`, `CommentSidebar.tsx` | 创建回复写入 `thread_id/parent_id`，解决线程而非单条混乱 | 旧评论兼容 |
| P4.2 | 划词评论持久化 | `SelectionBubble.tsx`, `commentBlockAnchor.ts`, server routes | 选中文本评论刷新后仍高亮并定位 | 文本编辑后的锚点降级 |
| P4.3 | @ 人员本地模型 | Mention extension + users API | 输入 `@` 可插入 mention，评论里能记录 mentioned ids | 后续通知可接 |
| P4.4 | 锚点丢失状态 | 评论模型 | 被评论文本删除后，评论进入 `anchor_lost` 或回退块级 | UI 提示清楚 |

### P5：高级块真实化

| 编号 | 任务 | 范围 | 完成标准 | Review 重点 |
|---|---|---|---|---|
| P5.1 | 公式块 KaTeX 化 | `LocalFormulaBlock` | 输入 LaTeX、预览渲染、错误提示、刷新恢复 | 不引入大体积无用依赖 |
| P5.2 | 同步块真实化 | 新 schema/API | 源块和引用块可同步 | 防循环、防丢失 |
| P5.3 | 多维表格阶段 1 | `LocalBitableBlock` | 本地字段类型、排序、筛选、视图切换 | 明确不是飞书 Bitable 全量 |
| P5.4 | 画板/流程图选型 | tldraw/Excalidraw 或 iframe | 能编辑、保存 JSON、刷新恢复 | 资产和数据结构清楚 |

### P6：产品化与协作

| 编号 | 任务 | 范围 | 完成标准 | Review 重点 |
|---|---|---|---|---|
| P6.1 | 首页真实 Tab / 收藏 / 最近 | `DocumentList.tsx`, server | 字段真实过滤和排序 | 不再只是 UI 壳 |
| P6.2 | 文档内搜索替换 | Editor | 搜索、跳转、替换可用 | 不破坏 ProseMirror selection |
| P6.3 | 历史版本 | server + UI | 自动快照、查看、恢复 | 存储增长策略 |
| P6.4 | 权限模型 | server middleware + UI | 只读、可评论、可编辑 | 前后端都校验 |
| P6.5 | Yjs 协同 | `y-prosemirror`, WebSocket | 双浏览器实时编辑 | 冲突、断线重连、保存策略 |

## 每项任务的 review 模板

每完成一个编号任务，必须追加一条 review 记录：

```md
### Review: P?.? 任务名

- 日期：
- 改动文件：
- 实现摘要：
- 构建/测试：
- 手动验收：
- 与飞书对齐情况：
- 未完成风险：
- 下一步：
```

## Review 记录

### Review: P0.1 修正 README 状态表

- 日期：2026-05-24
- 改动文件：`README.md`、`docs/FEISHU_REPLICA_PLAN.md`、`docs/FEISHU_LOCAL_ASSETS_ANALYSIS.md`
- 实现摘要：结合当前项目代码和本机飞书前端产物解析，修正 README 中已滞后的状态：表格 HTML/TSV 粘贴从“未实现”改为“基础已实现，待增强”；表格行列拖拽从“未实现”改为“简单矩阵表格已实现，复杂表格待策略”；评论从“未实现线程/range”改为“前端雏形存在，后端数据闭环未完成”；新增本机飞书 `webcontent` / `.asar` 解析入口。
- 构建/测试：文档类改动，未运行 `npm run build`。
- 手动验收：已用 `rg` 和文件抽查确认 `insertTableFromClipboardData()`、`moveTableRow()`、`moveTableColumn()`、`CommentHighlightMark`、评论回复 UI 与 README 状态一致。
- 与飞书对齐情况：README 现在把本机飞书产物中的权限动作、空间模块、模板中心、分享菜单等线索纳入后续计划，不再只按项目内部猜测推进。
- 未完成风险：尚未进行运行时截图和 DOM 尺寸采样；README 仍是总览，具体任务以本文件和 `FEISHU_LOCAL_ASSETS_ANALYSIS.md` 为准。
- 下一步：执行 P0.2，建立 `docs/feishu-spec/` 对照目录，优先采集块菜单、Slash、评论、目录、表格五类截图 / 尺寸。

### Review: P0.2 建立飞书 UI 对照资料目录

- 日期：2026-05-24
- 改动文件：`docs/feishu-spec/README.md`
- 实现摘要：新建飞书 UI / 交互对照目录说明，定义资料来源、采集清单、截图命名规范和验收记录模板。采集项覆盖块菜单、Slash、块柄、表格、评论、目录、文档头部、首页 / 空间、权限。
- 构建/测试：文档类改动，未运行 `npm run build`。
- 手动验收：确认清单已映射到本项目关键文件，并引用本机飞书产物分析文档作为来源之一。
- 与飞书对齐情况：对照目录已把本机飞书 `webcontent` 模块线索纳入资料来源，后续可继续补运行时截图和 DOM 尺寸。
- 未完成风险：尚未采集实际截图；需要运行时页面或 CDP 端口才能做像素级验证。
- 下一步：执行 P0.3，修复 duplicate 丢失 `cover_url`，并补 server API 测试。

### Review: P0.3 修复复制文档元信息完整性

- 日期：2026-05-24
- 改动文件：`server/src/routes/documents.ts`、`server/src/app.ts`、`server/src/index.ts`、`server/src/database.ts`、`server/tests/api.test.ts`、`server/package.json`
- 实现摘要：`POST /api/documents/:id/duplicate` 现在会复制 `cover_url`，并继续保留 `icon`、`parent_id` 等元信息；拆出 `server/src/app.ts` 让 Express app 与监听入口分离，便于测试；数据库路径改为惰性读取 `FEISHU_DOC_DB_PATH`，避免测试环境变量被模块加载时机固定；后端测试改为每个用例独立临时 DB / 临时端口。
- 构建/测试：`server` 下 `npm test` 通过；`npm run build` 通过。
- 手动验收：测试覆盖创建文档、更新封面 / 图标 / 父级、复制文档并断言副本保留 `cover_url`、`icon`、`parent_id`。
- 与飞书对齐情况：复制文档不再丢封面和元信息，接近飞书“副本保留文档外观 / 所属关系”的预期。
- 未完成风险：复制行为仍未处理历史版本、评论、权限、收藏等更完整元数据；后续权限模型落地后需要重新定义副本继承策略。
- 下一步：执行 P1.1，统一所有可操作块的 `blockId`。

### Review: P1.1 统一可操作块 blockId

- 日期：2026-05-24
- 改动文件：`client/src/components/Editor/feishuBlockId.ts`、`client/src/components/Editor/Editor.tsx`、`client/src/components/Editor/blockLink.ts`、`client/src/components/Editor/columnsNodeViews.tsx`、`client/src/components/Editor/HighlightBlock.ts`、`client/src/components/Layout/CommentSidebar.tsx`、`client/src/components/Layout/DocumentPage.tsx`
- 实现摘要：新增 `FeishuBlockId` TipTap 扩展，为 paragraph、heading、listItem、taskItem、blockquote、codeBlock、horizontalRule、image、table、columns、highlight、media、本地高级块等可操作节点统一补 `blockId`；旧 HTML 解析时从 `data-block-id` / `data-table-id` / `data-heading-id` / `id` 恢复；缺失 ID 的节点通过 appendTransaction 自动补齐。React NodeView 包装层同步渲染 `id` / `data-block-id`，评论定位和块链接定位也支持 `[data-block-id]`。
- 构建/测试：`client` 下 `npm run build` 通过。
- 手动验收：静态检查确认 `copyCurrentBlockLink()` 不再局限 paragraph / heading / highlight，能按 `FEISHU_BLOCK_ID_TYPES` 处理更多块类型。
- 与飞书对齐情况：块级评论、块链接、后续拖拽排序和多选移动有了统一锚点基础，接近飞书块模型的第一层要求。
- 未完成风险：标题仍同时存在 `headingId` 和 `blockId` 两套语义；表格仍保留 `tableId`，当前让 `blockId` 兼容读取 / 派生但未完全合并。需要 P1.2 继续收敛。
- 下一步：执行 P1.2，合并 heading / table 等历史锚点语义，保证目录、块链接、评论共用稳定策略。

### Review: P1.2 合并 heading / table 锚点语义

- 日期：2026-05-24
- 改动文件：`client/src/components/Editor/feishuHeading.ts`、`client/src/components/Editor/headingCollapse.ts`、`client/src/components/Layout/Sidebar.tsx`、`client/src/components/Editor/feishuTable.ts`、`client/src/components/Editor/feishuTableView.ts`、`README.md`、`docs/FEISHU_REPLICA_PLAN.md`
- 实现摘要：标题节点现在会把 `headingId` 与 `blockId` 收敛为同一个稳定 ID，并同步渲染 `id`、`data-heading-id`、`data-block-id`；目录滚动和标题折叠读取 `data-heading-id` / `id` / `data-block-id` 三种锚点，兼容旧 hash。表格节点现在会把 `tableId` 与 `blockId` 收敛为同一个稳定 ID，TipTap 表格扩展和 NodeView 均用同一 ID 渲染 `data-block-id` / `data-table-id`。
- 构建/测试：`client` 中 `npm run build` 通过；仅保留 Vite 大 chunk 既有警告。
- 手动验收：静态检查确认目录、折叠、表格 DOM 和块链接/评论定位共用同一锚点入口；旧内容缺失 ID 时仍通过 appendTransaction 自动补齐。
- 与飞书对齐情况：标题目录、块链接、评论锚点、表格块定位不再分裂为多套字段，接近飞书以块为基础的稳定锚点模型。
- 未完成风险：折叠状态仍只在会话内保存，刷新后丢失；还缺统一的 `resolveBlockElement(blockId)` API 把当前散落 selector 进一步收敛。
- 下一步：执行 P1.3，持久化标题折叠状态；随后执行 P1.4，抽出块定位统一 API。

### Review: P1.3 持久化标题折叠状态

- 日期：2026-05-24
- 改动文件：`server/src/database.ts`、`server/src/routes/documents.ts`、`server/tests/api.test.ts`、`client/src/types/index.ts`、`client/src/components/Layout/DocumentPage.tsx`、`README.md`、`docs/FEISHU_REPLICA_PLAN.md`
- 实现摘要：文档模型新增 `collapsed_heading_ids` 数组，创建文档默认空数组，更新时去重并过滤非法值，复制文档时保留折叠状态。前端加载文档时从 `collapsed_heading_ids` 恢复折叠集合，用户切换目录/标题折叠后以 350ms 节流写回文档元数据。
- 构建/测试：`server` 中 `npm test` 通过；`server` 中 `npm run build` 通过；`client` 中 `npm run build` 通过，保留 Vite 大 chunk 既有警告。
- 手动验收：静态检查确认折叠状态不再依赖会话内 React state；刷新或复制文档后可从 API 返回字段恢复。
- 与飞书对齐情况：标题折叠状态进入文档级可恢复状态，补齐飞书文档常见的“状态可恢复”体验。
- 未完成风险：保存失败仍缺用户可见错误提示；折叠状态目前作为文档整体元数据保存，尚未做多人协同冲突合并。
- 下一步：执行 P1.4，抽出块定位统一 API，让评论、块链接、目录 fallback 共享同一套 DOM 解析策略。

### Review: P1.4 块定位统一 API

- 日期：2026-05-24
- 改动文件：`client/src/components/Editor/blockDom.ts`、`client/src/components/Editor/blockLink.ts`、`client/src/components/Editor/commentDocumentSync.ts`、`client/src/components/Layout/DocumentPage.tsx`、`client/src/components/Layout/CommentSidebar.tsx`、`client/src/components/Layout/Sidebar.tsx`、`README.md`、`docs/FEISHU_REPLICA_PLAN.md`
- 实现摘要：新增 `resolveBlockElement(root, blockId)` 与 selector escape helper，统一按 `id`、`data-block-id`、`data-heading-id`、`data-table-id`、`data-comment-thread-id` 查找块 DOM。块链接 hash 跳转、目录滚动、评论跳转、评论侧栏定位、评论孤儿检测均切换到共享 API。
- 构建/测试：`client` 中 `npm run build` 通过；保留 Vite 大 chunk 既有警告。
- 手动验收：静态检查确认原本散落在不同组件里的 selector fallback 已收敛到一处；列表、表格、标题、评论 mark 的旧锚点都保留兼容入口。
- 与飞书对齐情况：块级能力开始共享同一锚点解析层，为后续拖拽排序、多块选择、评论定位提供统一基础。
- 未完成风险：还没有 Playwright 冒烟覆盖“复制块链接后刷新跳转”和“评论锚点删除后 orphan 检测”；后续可补。
- 下一步：进入 P2.1，做六点柄真实拖拽排序。

### Review: P2.1 六点柄真实拖拽排序

- 日期：2026-05-24
- 改动文件：`client/src/components/Editor/feishuBlockDrag.ts`、`client/src/components/Editor/Editor.tsx`、`client/src/components/Editor/Editor.less`、`docs/FEISHU_REPLICA_PLAN.md`、`README.md`
- 实现摘要：新增块拖拽 transaction helper，支持 paragraph、heading、listItem、taskItem、blockquote、codeBlock、horizontalRule、highlightBlock 等同父级块通过六点柄拖到目标块前/后；拖拽过程中显示蓝色插入线，释放后用 ProseMirror `delete + insert` transaction 移动节点并保留 undo。编辑器六点柄接入 pointer drag，跨父级或表格复杂结构暂不移动，避免破坏文档结构。
- 构建/测试：`client` 中 `npm run build` 通过；保留 Vite 大 chunk 既有警告。
- 手动验收：静态检查确认拖拽移动通过 ProseMirror transaction 完成，不直接改 DOM；插入线依据目标块上下半区切换 before / after。
- 与飞书对齐情况：六点柄不再只是打开块配置菜单，开始具备飞书式块级排序能力。
- 未完成风险：暂未支持跨父级拖拽、表格块拖拽、分栏内外互拖和自动滚动；还缺 Playwright 手动拖拽冒烟。
- 下一步：执行 P2.2，补齐块菜单中的上方添加、转换类型、保存为模板、转子文档等闭环。

### Review: P2.2 块菜单补齐

- 日期：2026-05-24
- 改动文件：`client/src/components/Editor/ContextMenu.tsx`、`client/src/components/Editor/insertBelowBlocks.ts`、`client/src/components/Editor/Editor.tsx`、`client/src/api/documents.ts`、`server/src/routes/documents.ts`、`server/tests/api.test.ts`、`README.md`、`docs/FEISHU_REPLICA_PLAN.md`
- 实现摘要：块菜单新增“在上方添加”，并复用 Slash 块选择面板；`insertBelowBlocks.ts` 抽出 `getInsertAbovePosition()` 和 `insertSlashItemAt()`，让上方/下方插入共享同一套块插入逻辑。块菜单“保存为模板”改为保存当前块/选区 HTML，而不是整篇文档；后端新增 `POST /api/documents/templates`。菜单中的转换类型、转子文档、复制块链接、下方添加继续保持可用。
- 构建/测试：`server` 中 `npm test` 通过；`server` 中 `npm run build` 通过；`client` 中 `npm run build` 通过，保留 Vite 大 chunk 既有警告。
- 手动验收：静态检查确认“上方添加”和“下方添加”都先同步块柄锚点选区，再按目标位置插入；块模板可被模板列表读取并通过“模板”块插入。
- 与飞书对齐情况：块菜单从基础编辑操作扩展到飞书常见的上下插入、块类型转换、保存为模板、转为子文档等闭环。
- 未完成风险：表格专用菜单里的“保存为模板”仍是占位；转子文档目前没有失败回滚和撤销式跨文档事务，只是创建新文档后替换当前块为子文档卡片。
- 下一步：执行 P2.3，多块选择增强，补 Shift 点击、批量复制、批量移动。

### Review: P2.3 多块选择增强

- 日期：2026-05-24
- 改动文件：`client/src/components/Editor/boxSelectionModel.ts`、`client/src/components/Editor/FeishuBoxBlockSelection.tsx`、`client/src/components/Editor/feishuBoxSelectionKeyboard.ts`、`README.md`、`docs/FEISHU_REPLICA_PLAN.md`
- 实现摘要：框选层新增 Shift 点击范围选择：已有选区时，Shift 点击目标块会以首个选中块为锚点选中两者之间的连续块。键盘层新增 `Alt+ArrowUp` / `Alt+ArrowDown`，对连续且同父级的多块选区做整体上移 / 下移；已有批量删除、复制、全选继续保留。
- 构建/测试：`client` 中 `npm run build` 通过；保留 Vite 大 chunk 既有警告。
- 手动验收：静态检查确认 Shift 点击只在已有块选区时接管；批量移动只处理连续同父级范围，避免跨层级破坏文档结构。
- 与飞书对齐情况：多块选择从单纯框选删除扩展到范围扩选、批量复制、批量移动，更接近飞书块级批处理体验。
- 未完成风险：批量移动当前是快捷键形式，尚未做选区浮动工具栏中的上移/下移按钮；非连续选区和跨父级移动会被安全拒绝。
- 下一步：执行 P2.4，接管浏览器右键为飞书风格块菜单。

### Review: P2.4 右键统一菜单

- 日期：2026-05-24
- 改动文件：`client/src/components/Editor/Editor.tsx`、`README.md`、`docs/FEISHU_REPLICA_PLAN.md`
- 实现摘要：编辑正文区接管 `contextmenu` 事件：右键命中普通块时阻止浏览器菜单并打开飞书风格块菜单；右键命中表格时打开表格块菜单。打开前会同步块柄锚点和 ProseMirror 选区，关闭 Slash / 加号菜单，避免多个浮层重叠。
- 构建/测试：`client` 中 `npm run build` 通过；保留 Vite 大 chunk 既有警告。
- 手动验收：静态检查确认 UI 浮层自身不被二次右键接管；表格右键会调用表格 NodeSelection，普通块右键会走 `syncEditorSelectionToAnchoredBlock()`。
- 与飞书对齐情况：块操作不再只依赖左侧六点柄，右键也能进入同一套块菜单，接近飞书文档的统一块操作入口。
- 未完成风险：若用户在正文文本上右键且期待浏览器拼写/复制菜单，目前会优先进入块菜单；后续可按选区类型细化。
- 下一步：执行 P2.5，补真正的转子文档迁移与父文档卡片落位策略。

### Review: P2.5 真正的转子文档

- 日期：2026-05-24
- 改动文件：`server/src/routes/documents.ts`、`server/tests/api.test.ts`、`client/src/api/documents.ts`、`client/src/components/Editor/ContextMenu.tsx`、`client/src/components/Editor/insertBelowBlocks.ts`、`README.md`、`docs/FEISHU_REPLICA_PLAN.md`
- 实现摘要：后端新增 `POST /api/documents/:id/children`，明确在父文档下创建子文档并写入 `parent_id`。块菜单“转换为子文档”改为调用该接口，把当前块/选区 HTML 作为子文档内容，创建成功后用子文档卡片替换父文档中的原内容；“在下方添加 > 子文档”也改用同一路由。
- 构建/测试：`server` 中 `npm test` 通过；`server` 中 `npm run build` 通过；`client` 中 `npm run build` 通过，保留 Vite 大 chunk 既有警告。
- 手动验收：API 测试覆盖父文档下创建子文档并断言 `parent_id`、标题和内容；前端静态检查确认创建失败时不会删除原块，创建成功后才执行替换。
- 与飞书对齐情况：转子文档从单纯改 `parent_id` 的伪 API，收敛为“父文档内容迁移到新子文档 + 父文档留下卡片”的真实工作流。
- 未完成风险：前后端仍不是一个原子事务，若创建成功但编辑器替换失败，需要人工保留/恢复；后续可加迁移日志或撤销提示。
- 下一步：进入 P3，继续表格与分栏对齐，优先 P3.1 表格粘贴增强。

### Review: P3.1 表格粘贴增强

- 日期：2026-05-24
- 改动文件：`client/src/components/Editor/tableInsert.ts`、`README.md`、`docs/FEISHU_REPLICA_PLAN.md`
- 实现摘要：HTML 表格粘贴从纯文本矩阵升级为富单元格矩阵：保留 `<a>` 链接 mark、`br/p/div` 换行、`th` 表头、单元格背景色；`rowspan/colspan` 先降级为占位单元格，保证生成的 TipTap 表格结构稳定。TSV / 纯文本表格仍走原有路径。
- 构建/测试：`client` 中 `npm run build` 通过；保留 Vite 大 chunk 既有警告。
- 手动验收：静态检查确认 HTML table 优先于 TSV 解析，普通文本不含表格结构时仍不会被误插入表格。
- 与飞书对齐情况：Excel / 网页表格粘贴开始保留更接近飞书的基础富文本信息，而不是只保留纯文本。
- 未完成风险：复杂合并单元格目前是安全降级，不是真正恢复合并结构；字体颜色、加粗、斜体等内联样式暂未保留。
- 下一步：执行 P3.2，补合并单元格下的行列拖拽禁用提示或安全移动策略。

## 关于“获取飞书文档源码”

如果你本地启动的是本项目的网页版，可以直接通过 `http://localhost:5173`、`http://localhost:5174` 等端口调试。

如果你说的是飞书官方网页版，能获取的是浏览器里加载到本地的 DOM、CSS、图片、网络响应和可见交互，不应也通常不能获取飞书的私有源码。后续可以用它做“截图和 DOM/CSS 对照”，但实现仍应写在本项目里。

当前本机已发现多个本地监听端口，其中项目相关端口大概率是：

| 端口 | 可能用途 |
|---|---|
| 3000 | 当前项目后端 |
| 5173 / 5174 / 5175 / 5176 | Vite 前端实例或历史 dev server |

如果要我直接对照你已经打开的飞书官方页面，需要提供页面 URL，或用带远程调试端口的浏览器启动，例如 `chrome.exe --remote-debugging-port=9222`。有了 URL 或 CDP 端口后，可以补 `docs/feishu-spec/` 的截图、尺寸和交互对照。
