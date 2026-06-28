# 飞书显示效果还原路线图

本文档把“本地项目中显示飞书文档并尽量和飞书一样”拆成可执行阶段。每个阶段都要有明确验收，避免只修单个截图导致全局布局继续漂移。

## 当前主要问题

### 1. 导入结果不稳定

问题：

- 公开页面 HTML 不一定包含飞书原始 block 数据。
- 未配置飞书 Open API 凭证时，只能做 HTML / fixture fallback。
- 不支持块有时只能近似还原，用户需要明确知道导入质量。

修复方向：

- 按 `feishu-import-strategy.md` 固化三层导入策略。
- 前端展示 `import_quality`、`warnings` 和 `unsupported_blocks`。
- 优先完善 Open API → 本地 block / Bitable 的映射。

### 2. UI 缺少统一规范

问题：

- 颜色、间距、阴影、z-index 分散在多个 Less 文件中。
- Bitable、编辑器、评论侧栏、浮层各自处理定位，容易互相影响。
- portaled 菜单经常丢失样式或被 overflow 裁切。

修复方向：

- 按 `feishu-rendering-spec.md` 收敛 token。
- 新增浮层统一使用 `--portal` 全局类和 clamp 定位。
- 每类布局都保留独立验收截图：普通文档、表格、Bitable、评论。

### 3. 普通文档和 Bitable 混在一起修

问题：

- 普通文档版心、目录、块柄与 Bitable 宽块布局耦合。
- Bitable 的 toolbar、record modal、kanban 菜单、gallery 卡片都是独立系统。

修复方向：

- 普通文档先稳定版心和基础块。
- Bitable 单独按 Grid / Gallery / Kanban / Gantt / Record Modal 逐个对齐。
- 宽块只通过明确的布局变量影响文档页，不直接覆盖全局样式。

## 阶段 0：规范与回归基线

目标：

- 建立文档规范和导入策略。
- 明确所有后续 UI 修复的验收标准。

已建立：

- `docs/feishu-rendering-spec.md`
- `docs/feishu-import-strategy.md`
- `docs/feishu-parity-roadmap.md`

下一步：

- 补充典型截图到 `docs/screenshots/`。
- 每次修 UI 时在 PR / 提交说明中写明对齐哪条规范。

验收：

- README 能指向以上文档。
- 新开发者能知道普通文档、导入、Bitable 各自按什么标准修。

## 阶段 1：普通文档显示还原

目标：

- 不含 Bitable 的飞书文档导入后，看起来像飞书普通文档。

重点文件：

- `client/src/components/Editor/Editor.tsx`
- `client/src/components/Editor/Editor.less`
- `client/src/components/Layout/Layout.less`
- `client/src/components/Layout/Sidebar.tsx`
- `client/src/components/Layout/CommentSidebar.tsx`
- `client/src/components/Editor/blocks/*`
- `client/src/components/Editor/tables/*`

任务：

- 稳定文档版心、标题区、meta 区和正文块间距。
- 统一段落、标题、引用、代码块、高亮块、图片、文件卡片样式。
- 修复目录吸顶、长目录滚动、当前章节高亮。
- 确保块柄、Slash 菜单、右键菜单、选区气泡定位稳定。
- 表格按飞书视觉和交互整理：轨道、选区、边界加号、菜单。

验收：

- 导入一篇普通飞书文档，标题、正文、图片、表格、链接都正常显示。
- 滚动时目录吸顶，评论侧栏不遮挡正文。
- 所有块都能删除、复制、拖拽或降级处理。

## 阶段 2：导入质量可见化

目标：

- 用户导入飞书文档后，知道导入是否完整、哪些块被降级。

重点文件：

- `server/src/feishuPublicImporter.ts`
- `server/src/import/*`
- `server/src/routes/documents.ts`
- `client/src/api/documents.ts`
- `client/src/components/DocumentList/DocumentList.tsx`
- `client/src/types/index.ts`

任务：

- 前端导入弹窗展示 `import_quality`。
- 前端展示 `warnings` 和 `unsupported_blocks`。
- 后端所有导入路径统一返回导入质量信息。
- Open API 失败时保留失败原因，并明确 fallback。

验收：

- 未配置飞书凭证时，公开链接导入不会假装完整。
- 支持的样例能正常生成本地文档。
- 不支持块在 UI 中可见，不静默丢失。

## 阶段 3：UI Token 与浮层系统化

目标：

- 减少“修一个浮层坏另一个浮层”的问题。

重点文件：

- `client/src/components/Layout/Layout.less`
- `client/src/components/Editor/Editor.less`
- `client/src/components/Editor/menus/ContextMenu.less`
- `client/src/components/Bitable/BitableBlock.less`
- `client/src/components/Editor/shared/floatingPanel.ts`

任务：

- 抽出共享 Less token，逐步替换重复变量。
- 建立全局 z-index 约定。
- 所有 portaled 浮层使用统一后缀类，例如 `--portal`。
- 所有浮层定位都必须 clamp 到视口、modal 或所属容器。

验收：

- Bitable kanban 菜单、record 附件面板、Slash 菜单、块菜单均不被裁切。
- 窗口缩放后浮层仍保持在可视范围内。

## 阶段 4：Bitable 分视图还原

目标：

- 本地 Bitable 在常见视图上尽量贴近飞书。

重点文件：

- `client/src/components/Bitable/BitableBlockView.tsx`
- `client/src/components/Bitable/BitableBlock.less`
- `client/src/components/Bitable/model/bitableModel.ts`
- `client/src/components/Bitable/views/BitableGalleryView.tsx`
- `client/src/components/Bitable/views/BitableKanbanView.tsx`
- `client/src/components/Bitable/views/BitableGanttView.tsx`
- `client/src/components/Bitable/records/BitableRecordCardModal.tsx`

任务：

- Grid：字段头、行高、单元格、字段菜单、展开面板。
- Gallery：toolbar、卡片宽度、封面、字段展示。
- Kanban：列头、卡片、列菜单、滚动区域。
- Gantt：时间轴、任务条、字段配置。
- Record Modal：字段行、附件、日期、评论、历史。

验收：

- 每个视图至少有一个 Playwright 或手动验收样例。
- 所有菜单在视图内可打开、可关闭、不被遮挡。
- 记录弹窗内浮层不漂到灰色遮罩区域。

## 阶段 5：Open API 结构化映射增强

目标：

- 有飞书应用凭证时，尽量使用结构化数据而不是 HTML 猜测。

重点文件：

- `server/src/import/feishuApiClient.ts`
- `server/src/import/feishuExtractor.ts`
- `server/src/import/bitableMapper.ts`
- `server/src/import/types.ts`
- `server/src/import/localHtmlEmitter.ts`

任务：

- 补充飞书 block 类型映射表。
- 图片 / 附件资源走 asset pipeline。
- Bitable 数据尽量映射到本地 `BaseTable`。
- 未支持 block 输出结构化 warning。

验收：

- 配置 `FEISHU_APP_ID` / `FEISHU_APP_SECRET` 后，导入质量优先高于 HTML fallback。
- Open API token 获取失败时有明确错误。

## 阶段 6：长期产品化

目标：

- 从本地原型走向可长期维护的飞书文档展示 / 编辑系统。

任务：

- 权限模型：只读、可评论、可编辑。
- 历史版本。
- 搜索 / 替换。
- Yjs / WebSocket 实时协同。
- 更完整的模板中心。
- 首页收藏、共享、最近真实数据。

## 每次修复的完成标准

每次代码修复完成后至少说明：

- 改了哪些文件。
- 对齐本文档哪一条规范。
- 是否运行了 `client npm run build`、`server npm test` 或相关 E2E。
- 手动验收步骤。
- 仍有哪些风险或未完成点。
