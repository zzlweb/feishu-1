# 产品差距台账

> 任务 0.2 的可执行真相源。审计日期：2026-07-16。甘特图不在产品范围内，不进入本台账。

## 使用规则

- `P0`：数据安全、权限、安全边界或会造成跨文档错误；进入功能迭代前必须处理。
- `P1`：高频流程不完整、不可恢复、不可访问或刷新后不可靠；发布前必须处理。
- `P2`：低频一致性、占位能力或体验缺口；纳入对应阶段收敛。
- `已覆盖` 表示测试证明当前行为，不代表行为正确；`部分` 表示只有邻近 happy path；`缺失` 表示没有自动化契约。
- 参照编号定义在 [reference-capture/README.md](reference-capture/README.md)。

## P0

| ID | 用户流 | 差距与复现 | 当前行为 / 期望 | 代码归属 | 自动化 | 参照 |
| --- | --- | --- | --- | --- | --- | --- |
| FG-001 | 文档加载 | 延迟文档 A 的 GET，快速切换 A→B，让 A 最后返回 | 路由切换会 abort 旧文档和评论请求，并以递增请求身份拒绝仍返回的陈旧响应 | [DocumentPage.tsx](../../client/src/components/Layout/DocumentPage.tsx)、[documents.ts](../../client/src/api/documents.ts) | 已覆盖：A 延迟返回时 B 内容保持不变 | REF-DOC-01 |
| FG-002 | 文档保存 | 两个标签页编辑同一文档并先后自动保存 | PUT 携带 `base_version`；服务端拒绝陈旧写入并返回最新文档，客户端阻塞队列、保留本地草稿并在刷新后恢复 | [DocumentPage.tsx](../../client/src/components/Layout/DocumentPage.tsx)、[useDocumentSaveQueue.ts](../../client/src/features/documents/session/useDocumentSaveQueue.ts)、[documents.ts](../../server/src/routes/documents.ts)、[database.ts](../../server/src/database.ts) | 已覆盖：服务端并发测试与客户端 409→刷新→草稿恢复契约 | REF-DOC-02 |
| FG-003 | Grid 权限 | 以只读文档打开 Grid，编辑单元格或新增记录 | 服务端权限只读与用户阅读模式已分离；权限只读不可从页头解除，Editor 与 Bitable 统一锁定，只允许本地切换视图查看 | [DocumentPage.tsx](../../client/src/components/Layout/DocumentPage.tsx)、[Editor.tsx](../../client/src/components/Editor/Editor.tsx)、[BitableBlockView.tsx](../../client/src/components/Bitable/BitableBlockView.tsx) | 已覆盖：页头不可解除、正文不可编辑、Grid 新增字段禁用 | REF-GRID-01 |
| FG-004 | Bitable 持久化 | 编辑一个单元格并检查保存 HTML | 完整字段、记录、视图和历史写进 `data-model`；应只存 table ID，由服务端版本化 | [BitableBlockView.tsx](../../client/src/components/Bitable/BitableBlockView.tsx)、[Editor.tsx](../../client/src/components/Editor/Editor.tsx) | 部分：[bitable-model-regressions.spec.ts](../../client/tests/bitable-model-regressions.spec.ts) 仅测本地模型 | REF-GRID-02 |
| FG-005 | HTML 导入 | 导入含 `javascript:` URL、危险 CSS、iframe/object 或 active SVG 的 HTML | 已过滤主动元素、危险 URL/CSS/属性，ZIP 内 SVG 不落盘；待补独立 SVG fixture 与更细 MIME 嗅探 | [documentImporter.ts](../../server/src/documentImporter.ts) | 已覆盖：Markdown/HTML 主动内容集成测试 | REF-IMPORT-01 |
| FG-006 | ZIP 导入 | 上传高压缩比或超多 entry 的 ZIP | 已限制 entry 数、单项/总展开量和压缩比；待补处理总时限与 entry 数上限 fixture | [documentImporter.ts](../../server/src/documentImporter.ts)、[documents.ts](../../server/src/routes/documents.ts) | 已覆盖：普通 ZIP 与异常压缩比 | REF-IMPORT-02 |
| FG-007 | 公共链接导入 | 允许域名返回重定向到内网或循环地址 | 已限制 HTTPS/443/无凭据 URL，每跳重验允许域名，DNS 结果拒绝私网并绑定已验证地址，最多 5 次重定向 | [feishuPublicImporter.ts](../../server/src/feishuPublicImporter.ts) | 已覆盖：URL、私网地址和跨域重定向 | REF-IMPORT-03 |
| FG-008 | 上传安全 | 上传 HTML/SVG/脚本型文件并直接访问静态 URL | 已使用扩展名白名单和文件签名校验，拒绝主动内容/伪装文件，静态响应启用 nosniff、sandbox 和下载隔离 | [uploads.ts](../../server/src/routes/uploads.ts)、[app.ts](../../server/src/app.ts) | 已覆盖：合法 PNG、SVG、伪装 PNG、隔离响应头 | REF-UPLOAD-01 |

## P1

| ID | 用户流 | 差距与复现 | 当前行为 / 期望 | 代码归属 | 自动化 | 参照 |
| --- | --- | --- | --- | --- | --- | --- |
| FG-009 | 文档保存 | 输入后立即刷新或关闭标签页 | `pagehide` 请求仍可能被终止，但待保存 patch 已同步写入按文档隔离的本地草稿，重新打开可恢复或放弃 | [Editor.tsx](../../client/src/components/Editor/Editor.tsx)、[documentDraft.ts](../../client/src/features/documents/session/documentDraft.ts) | 草稿单测与恢复/放弃 E2E 契约 | REF-DOC-02 |
| FG-010 | 文档保存 | 拒绝一次内容 PUT | 保存队列保留失败 payload，顶部状态可重试，本地草稿继续合并后续输入且成功后才清理 | [DocumentPage.tsx](../../client/src/components/Layout/DocumentPage.tsx)、[useDocumentSaveQueue.ts](../../client/src/features/documents/session/useDocumentSaveQueue.ts) | 草稿单测与恢复 E2E 契约 | REF-DOC-02 |
| FG-011 | 文档保存 | 编辑普通文本，等待保存，再从真实服务刷新 | 浏览器测试普遍 mock API，未证明落盘；应覆盖编辑→PUT→DB→GET→刷新 | [Editor.tsx](../../client/src/components/Editor/Editor.tsx)、[database.ts](../../server/src/database.ts) | 缺失：真实服务 fixture | REF-DOC-02 |
| FG-012 | Slash | 在 URL 路径或普通文本中输入 `/query` | 已仅允许块首或空白后的 `/` 触发，URL、路径、单词内部和含空白查询不触发 | [Editor.tsx](../../client/src/components/Editor/Editor.tsx)、[slashTrigger.ts](../../client/src/components/Editor/menus/slashTrigger.ts) | 已覆盖：边界纯函数单测 | REF-SLASH-01 |
| FG-013 | Slash | 打开表格、分栏、模板或按钮子菜单后用方向键与 Enter | 主菜单和子菜单截断已处理按键，避免编辑器同时移动光标；四类子菜单支持方向键、Enter 选择及 Esc/左键返回 | [SlashMenu.tsx](../../client/src/components/Editor/menus/SlashMenu.tsx) | 已覆盖：表格子菜单进入、移动、返回与确认插入 | REF-SLASH-02 |
| FG-014 | Slash | 选择图片/文件命令后取消原生文件选择器 | 命令范围延迟到用户实际选中文件后才删除，取消选择会保留原 Slash 文本 | [slashMenuConfig.ts](../../client/src/components/Editor/menus/slashMenuConfig.ts) | 已覆盖：取消图片选择后 Slash 文本和正文保持不变 | REF-SLASH-03 |
| FG-015 | Slash 上传 | 选择图片并令 `/api/uploads` 失败 | 失败图片保留本地预览和错误面板，提供重试、取消与移除；普通文件沿用同一上传状态机 | [Editor.tsx](../../client/src/components/Editor/Editor.tsx)、[slashMenuConfig.ts](../../client/src/components/Editor/menus/slashMenuConfig.ts) | 已覆盖：图片失败后重试成功与移除入口 | REF-UPLOAD-02 |
| FG-016 | 块菜单 | 用键盘打开对齐、颜色或下方添加子菜单 | 主菜单和三个子菜单使用 menu/menuitem 语义；上下键移动，右键进入，Esc/左键关闭子菜单并恢复触发器焦点 | [ContextMenu.tsx](../../client/src/components/Editor/menus/ContextMenu.tsx) | 已覆盖：颜色和下方添加的进入、退出与焦点恢复 | REF-BLOCK-01 |
| FG-017 | 块菜单 | 在剪贴板权限被拒绝或 `execCommand` 失败时剪切/复制 | 剪切/复制会同时处理失败返回与异常并给出快捷键恢复提示；普通、图片、表格、多维表格、公式和文件块统一按真实复制结果反馈，双路径失败时不再静默或误报成功 | [ContextMenu.tsx](../../client/src/components/Editor/menus/ContextMenu.tsx)、[clipboard.ts](../../client/src/shared/clipboard.ts) | 已覆盖：权限拒绝、命令失败与三类可执行恢复提示 | REF-BLOCK-02 |
| FG-018 | 标题折叠 | 折叠标题后替换/导入内容，使 heading ID 改变，再刷新 | Editor 首次提交当前文档标题快照后裁剪不存在的折叠 ID；切换文档时先清空旧快照，避免跨文档误删 | [DocumentPage.tsx](../../client/src/components/Layout/DocumentPage.tsx)、[headingCollapse.ts](../../client/src/components/Editor/blocks/headingCollapse.ts) | 已覆盖：保留有效折叠并持久化移除孤立 ID | REF-HEADING-01 |
| FG-019 | 目录 | 长文档只滚动、不移动光标 | 工作区滚动以视口上方阅读锚点计算当前标题，跳过折叠/隐藏标题并用 RAF 合并高频滚动更新 | [DocumentPage.tsx](../../client/src/components/Layout/DocumentPage.tsx)、[Sidebar.tsx](../../client/src/components/Layout/Sidebar.tsx) | 已覆盖：中段与文末滚动会更新目录高亮 | REF-HEADING-02 |
| FG-020 | 标题折叠 | 拒绝 `collapsed_heading_ids` 保存 | 失败 patch 保留在版本化保存队列和本地草稿中，页头持续显示“保存失败”并可原位重试；折叠 UI 不回滚 | [DocumentPage.tsx](../../client/src/components/Layout/DocumentPage.tsx)、[useDocumentSaveQueue.ts](../../client/src/features/documents/session/useDocumentSaveQueue.ts) | 已覆盖：首次失败、点击重试、相同折叠 ID 成功保存 | REF-HEADING-01 |
| FG-021 | 评论锚点 | 对文本评论后删除锚点文本并保存 | 线程标记为 `anchor_lost` 并保留内容；用户选择新文本后可将整条线程重新关联，高亮、引用、位置和锚点快照同步持久化 | [DocumentPage.tsx](../../client/src/components/Layout/DocumentPage.tsx)、[commentBlockAnchor.ts](../../client/src/components/Editor/blocks/commentBlockAnchor.ts) | 已覆盖：锚点丢失、内容保留、重新选择并恢复关联 | REF-COMMENT-01 |
| FG-022 | 评论附件 | 在评论输入区选择附件 | 无上传/持久化链路的附件入口已隐藏；应在资产归属模型完成后实现预览、重试、删除和刷新恢复再开放 | [CommentSidebar.tsx](../../client/src/components/Layout/CommentSidebar.tsx)、[documents.ts](../../server/src/routes/documents.ts) | 缺失 | REF-COMMENT-02 |
| FG-023 | 评论恢复 | 令创建、编辑或解决请求失败 | 已提供线程级发送中/失败状态，创建与回复保留草稿并可重试，编辑和解决也可原位重试 | [DocumentPage.tsx](../../client/src/components/Layout/DocumentPage.tsx)、[CommentSidebar.tsx](../../client/src/components/Layout/CommentSidebar.tsx) | 浏览器契约覆盖 POST 失败后重试成功 | REF-COMMENT-03 |
| FG-024 | 普通表格 | 合并、缩放、着色或增删行列后保存并刷新 | 已增加真实 Express/DB 契约，验证合并内容、背景、列宽和行高经 PUT/GET 与页面刷新恢复；当前环境缺 Chromium，待 CI 执行确认 | [feishuTable.ts](../../client/src/components/Editor/tables/feishuTable.ts)、[tableInsert.ts](../../client/src/components/Editor/tables/tableInsert.ts) | 全栈契约：[document-persistence.spec.ts](../../client/tests/full-stack/document-persistence.spec.ts) | REF-TABLE-01 |
| FG-025 | 普通表格 | 对含 rowspan/colspan 的表执行行列移动 | 简单矩形表支持整行/整列拖动；成功、取消、无效落点与复杂表禁用路径都会清理临时蓝色选区；含合并单元格时解释保护原因且不修改表格 | [tableInsert.ts](../../client/src/components/Editor/tables/tableInsert.ts)、[FeishuTableOverlay.tsx](../../client/src/components/Editor/tables/FeishuTableOverlay.tsx) | 已覆盖：简单行拖动、无效落点收尾、合并表格禁用与数据不变 | REF-TABLE-02 |
| FG-026 | 普通表格粘贴 | 粘贴含合并单元格与样式的 HTML 表格 | 文档级粘贴会恢复 rowspan/colspan 与安全背景色；表内粘贴将跨度覆盖位视为未触及，不再清空目标邻格；保存刷新验证待 FG-024 收敛 | [tableInsert.ts](../../client/src/components/Editor/tables/tableInsert.ts)、[feishuTable.ts](../../client/src/components/Editor/tables/feishuTable.ts) | 已覆盖：外部复杂表创建与表内跨度保护 | REF-TABLE-03 |
| FG-027 | Grid 字段 | 添加公式、关联、查找、人员或系统字段 | 选择器保留类型认知但统一显示“待支持”且不可选择；表单与创建命令双层阻断，旧数据仍可展示 | [bitableFieldTypes.ts](../../client/src/components/Bitable/fields/bitableFieldTypes.ts)、[BitableFieldTypePicker.tsx](../../client/src/components/Bitable/fields/BitableFieldTypePicker.tsx)、[BitableBlockView.tsx](../../client/src/components/Bitable/BitableBlockView.tsx) | 已覆盖：字段可创建矩阵单测与 picker 浏览器契约 | REF-GRID-03 |
| FG-028 | Grid 字段顺序 | 在一个视图重排字段后切换另一视图 | 重排只写当前视图 `fieldOrder`，Grid 和字段面板统一按视图解析；主字段固定第一，新字段自动追加，删除字段清理所有视图引用 | [BitableBlockView.tsx](../../client/src/components/Bitable/BitableBlockView.tsx)、[BitableGridView.tsx](../../client/src/components/Bitable/views/BitableGridView.tsx)、[bitableModel.ts](../../client/src/components/Bitable/model/bitableModel.ts) | 已覆盖：跨视图隔离、旧数据与新增字段兼容单测 | REF-GRID-04 |
| FG-029 | Grid 删除字段 | 删除含数据且被筛选/排序引用的字段 | 删除前统计记录值、筛选、排序、分组和视图配置影响；可迁移到数据类型兼容字段，确认后由统一命令迁移或清理全部引用 | [BitableBlockView.tsx](../../client/src/components/Bitable/BitableBlockView.tsx)、[bitableModel.ts](../../client/src/components/Bitable/model/bitableModel.ts) | 已覆盖：影响分析、迁移/清理模型单测与浏览器确认契约 | REF-GRID-05 |
| FG-030 | Gallery 键盘 | Tab 到卡片并尝试打开、选择或范围选择 | 卡片具备稳定 tab stop、button/pressed 语义和清晰焦点态；Enter 打开详情，Space 切换选择，Shift+Space 扩展范围 | [BitableGalleryView.tsx](../../client/src/components/Bitable/views/BitableGalleryView.tsx) | 已覆盖：键盘聚焦、打开、切换和范围选择浏览器契约 | REF-GALLERY-01 |
| FG-031 | Gallery 上传 | 向背景拖文件并令上传失败 | 新建卡片批次全部上传失败时自动回滚记录；已有卡片保留失败附件状态，网络错误/取消/超时均会结束上传状态 | [BitableBlockView.tsx](../../client/src/components/Bitable/BitableBlockView.tsx)、[BitableGalleryView.tsx](../../client/src/components/Bitable/views/BitableGalleryView.tsx) | 已覆盖：成功创建与全失败回滚浏览器契约 | REF-GALLERY-02 |
| FG-032 | Kanban 移动 | 不使用拖放，通过键盘/触控辅助方式移动卡片 | 卡片菜单已提供“移动到列”，并支持 Shift+F10 / ContextMenu 键打开 | [BitableKanbanView.tsx](../../client/src/components/Bitable/views/BitableKanbanView.tsx)、[bitable-kanban.spec.ts](../../client/tests/bitable-kanban.spec.ts) | 已实现 | REF-KANBAN-01 |
| FG-033 | Kanban 卡片 | Tab 到卡片并用 Enter/Space 打开详情 | 卡片具备稳定 tab stop、button/pressed 语义和清晰焦点态；Enter 与 Space 均打开详情并沿用选择状态 | [BitableKanbanView.tsx](../../client/src/components/Bitable/views/BitableKanbanView.tsx) | 已覆盖：键盘聚焦、Enter/Space 打开及选择状态浏览器契约 | REF-KANBAN-02 |
| FG-034 | Kanban 分组 | 删除有记录的分组 | 删除前统计记录、筛选和视图配置影响；可迁移到其他分组，取消不修改数据，无迁移时明确清空值并移除引用 | [BitableBlockView.tsx](../../client/src/components/Bitable/BitableBlockView.tsx)、[bitableModel.ts](../../client/src/components/Bitable/model/bitableModel.ts) | 已覆盖：影响分析、迁移/清理模型单测与浏览器确认契约 | REF-KANBAN-03 |
| FG-035 | Record Modal | 打开详情后反复 Tab，再关闭 | 焦点限制在弹窗及其子浮层内，关闭后恢复到打开详情的卡片/单元格触发器 | [BitableRecordCardModal.tsx](../../client/src/components/Bitable/records/BitableRecordCardModal.tsx) | 已覆盖：循环 Tab 与关闭后焦点恢复浏览器契约 | REF-MODAL-01 |
| FG-036 | Record Modal | 开启日期提醒，关闭并重开 | 无服务端提醒模型前已移除仅存在于局部 state 的伪开关，日期选择仍正常持久化 | [BitableRecordCardModal.tsx](../../client/src/components/Bitable/records/BitableRecordCardModal.tsx) | 已覆盖：日期面板不再暴露伪提醒入口 | REF-MODAL-02 |
| FG-037 | Record Modal 附件 | 上传附件、令上传失败或尝试删除 | 附件列表支持删除；上传中可取消 XHR；失败项可重新选择并在原字段内继续上传 | [BitableRecordCardModal.tsx](../../client/src/components/Bitable/records/BitableRecordCardModal.tsx)、[BitableBlockView.tsx](../../client/src/components/Bitable/BitableBlockView.tsx) | 已覆盖：上传失败、重新选择成功、删除后恢复空状态 | REF-MODAL-03 |
| FG-038 | 导入取消 | 开始大文件/URL 导入后关闭对话框或切换页面 | 文件取消会立即恢复界面，URL 导入锁定重复提交；关闭对话框和页面卸载会 abort，取消后可再次导入。服务端断连后的临时资源清理仍归 FG-039 | [documents.ts](../../client/src/api/documents.ts)、[DocumentList.tsx](../../client/src/components/DocumentList/DocumentList.tsx) | 已覆盖：文件/URL 取消、重复提交阻断与再次导入成功 | REF-IMPORT-04 |
| FG-039 | 上传生命周期 | 删除文档块/记录中的附件后检查服务端文件 | 文件留在全局 public 目录，无资产归属和 DELETE/清理 | [uploads.ts](../../server/src/routes/uploads.ts) | 缺失 | REF-UPLOAD-03 |
| FG-040 | 媒体失败恢复 | 上传失败、刷新页面，再点重试 | 内存中仍有原文件时直接重试；刷新导致原文件丢失时明确要求重新选择，并在原块内继续上传 | [Editor.tsx](../../client/src/components/Editor/Editor.tsx)、[mediaUploadRegistry.ts](../../client/src/components/Editor/media/mediaUploadRegistry.ts) | 已覆盖：失败保存、刷新、重新选择并成功上传 | REF-UPLOAD-02 |
| FG-041 | 图片/视频交互 | 图片加载失败，或缩放视频后保存刷新 | 图片现保留可重试失败面板；视频右下角等比缩放会持久化宽高，并在浏览器支持时提供画中画；待真实浏览器视觉基线和刷新 E2E | [Editor.tsx](../../client/src/components/Editor/Editor.tsx)、[VideoResizeHandle.tsx](../../client/src/components/Editor/media/VideoResizeHandle.tsx) | 单元测试已覆盖尺寸算法，浏览器契约已补 | MEDIA-001 |
| FG-042 | 图片拖拽排版 | 按住图片本体拖到其它正文块或分栏 | 已接入统一块拖拽状态机，超过阈值后显示缩略图和插入线，支持跨正文/分栏父容器移动；飞书不支持的浮动和文字环绕明确不实现 | [Editor.tsx](../../client/src/components/Editor/Editor.tsx)、[feishuBlockDrag.ts](../../client/src/components/Editor/blocks/feishuBlockDrag.ts) | 跨分栏浏览器契约已补 | MEDIA-001 |
| FG-043 | Grid 筛选 | 只打开筛选面板查看后直接关闭 | 打开或关闭空面板不再写入默认空规则；只有点击“添加条件”才创建可编辑筛选条件 | [BitableBlockView.tsx](../../client/src/components/Bitable/BitableBlockView.tsx) | 已覆盖：空面板零写入、显式添加后出现条件行 | REF-GRID-06 |
| FG-044 | 表格单元格块柄 | 在首列待办/列表块上悬停并滚动文档 | 块柄按真实宽度右对齐到表格外侧，菜单持续锚定真实按钮；不再侵入单元格或在布局变化后漂移 | [tableCellHandle.ts](../../client/src/components/Editor/tables/tableCellHandle.ts)、[FeishuTableOverlay.tsx](../../client/src/components/Editor/tables/FeishuTableOverlay.tsx) | 已覆盖：块柄、表格边界和菜单三者几何契约 | REF-TABLE-02 |

## P2 候选

以下能力不应在界面中伪装成完整功能，应在对应阶段决定实现或移除：评论“翻译/举报”。Record Modal 文本字段已改为失焦/Enter 单次提交且 Esc 撤销，筛选面板不再自动持久化空规则；块菜单伪“翻译”、评论本地点赞、模板菜单“开发中”入口和公共链接 HTTP 已移除。

## 数量与覆盖

- 共 44 条：P0 8 条，P1 36 条。
- 全部 13 类计划流均有代码归属和测试状态：文档输入、Slash、块菜单、标题折叠、目录、评论、普通表格、Grid、Gallery、Kanban、Record Modal、导入、上传。
- 主要空白集中在真实持久化、权限、安全、键盘路径和失败恢复；现有强项是局部渲染、指针交互和 portal 几何。
