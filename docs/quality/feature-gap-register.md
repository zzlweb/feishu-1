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
| FG-001 | 文档加载 | 延迟文档 A 的 GET，快速切换 A→B，让 A 最后返回 | 响应无请求身份校验，会覆盖当前文档；应取消或拒绝陈旧响应 | [DocumentPage.tsx](../../client/src/components/Layout/DocumentPage.tsx)、[documents.ts](../../client/src/api/documents.ts) | 缺失：跨路由竞态 | REF-DOC-01 |
| FG-002 | 文档保存 | 两个标签页编辑同一文档并先后自动保存 | 无版本号，后写静默覆盖；应使用版本与可恢复的 409 冲突 | [DocumentPage.tsx](../../client/src/components/Layout/DocumentPage.tsx)、[documents.ts](../../server/src/routes/documents.ts)、[database.ts](../../server/src/database.ts) | 缺失：真实服务并发保存 | REF-DOC-02 |
| FG-003 | Grid 权限 | 以只读文档打开 Grid，编辑单元格或新增记录 | 已继承编辑器只读状态、将所有视图视为锁定并在统一 commit 层阻断写入；只读状态仍可本地切换视图 | [Editor.tsx](../../client/src/components/Editor/Editor.tsx)、[BitableBlockView.tsx](../../client/src/components/Bitable/BitableBlockView.tsx) | Client build 已覆盖，E2E 待补 | REF-GRID-01 |
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
| FG-013 | Slash | 打开表格、分栏、模板或按钮子菜单后用方向键与 Enter | 主菜单可用 Enter/右键打开子菜单；四类子菜单支持方向键、Enter 选择及 Esc/左键返回 | [SlashMenu.tsx](../../client/src/components/Editor/menus/SlashMenu.tsx) | Client build 已覆盖，浏览器焦点 E2E 待补 | REF-SLASH-02 |
| FG-014 | Slash | 选择图片/文件命令后取消原生文件选择器 | 命令范围延迟到用户实际选中文件后才删除，取消选择会保留原 Slash 文本 | [slashMenuConfig.ts](../../client/src/components/Editor/menus/slashMenuConfig.ts) | Client build 已覆盖，文件选择器 E2E 待补 | REF-SLASH-03 |
| FG-015 | Slash 上传 | 选择图片并令 `/api/uploads` 失败 | 插入无重试能力的失败 embed；应保留媒体块并提供重试/移除 | [slashMenuConfig.ts](../../client/src/components/Editor/menus/slashMenuConfig.ts) | 缺失 | REF-UPLOAD-02 |
| FG-016 | 块菜单 | 用键盘打开对齐、颜色或下方添加子菜单 | 触发器是 pointer hover 的非聚焦 `div`；应使用语义 menuitem 和完整键盘路径 | [ContextMenu.tsx](../../client/src/components/Editor/menus/ContextMenu.tsx) | 部分：[block-color.spec.ts](../../client/tests/block-color.spec.ts)、[block-hover-floating.spec.ts](../../client/tests/block-hover-floating.spec.ts) 仅鼠标 | REF-BLOCK-01 |
| FG-017 | 块菜单 | 在剪贴板权限被拒绝或 `execCommand` 失败时剪切/复制 | 已检查剪切/复制返回值并显示快捷键恢复提示；复制文档链接捕获权限异常并提示从地址栏复制 | [ContextMenu.tsx](../../client/src/components/Editor/menus/ContextMenu.tsx) | Client build 已覆盖，权限拒绝 E2E 待补 | REF-BLOCK-02 |
| FG-018 | 标题折叠 | 折叠标题后替换/导入内容，使 heading ID 改变，再刷新 | 保存的 ID 不清理，状态孤立；应稳定身份或迁移/裁剪 | [DocumentPage.tsx](../../client/src/components/Layout/DocumentPage.tsx)、[headingCollapse.ts](../../client/src/components/Editor/blocks/headingCollapse.ts) | 部分：[heading-id-uniqueness.spec.ts](../../client/tests/heading-id-uniqueness.spec.ts) 只测重复 ID | REF-HEADING-01 |
| FG-019 | 目录 | 长文档只滚动、不移动光标 | 当前项由焦点/选区驱动；应按视口提供 scrollspy 高亮 | [Editor.tsx](../../client/src/components/Editor/Editor.tsx)、[Sidebar.tsx](../../client/src/components/Layout/Sidebar.tsx) | 部分：[catalogue-sticky-layout.spec.ts](../../client/tests/catalogue-sticky-layout.spec.ts) 只测布局 | REF-HEADING-02 |
| FG-020 | 标题折叠 | 拒绝 `collapsed_heading_ids` 保存 | 通用错误短暂消失，无定向重试或回滚；应保留失败状态与重试 | [DocumentPage.tsx](../../client/src/components/Layout/DocumentPage.tsx) | 缺失 | REF-HEADING-01 |
| FG-021 | 评论锚点 | 对文本评论后删除锚点文本并保存 | 已将线程标记为 `anchor_lost` 并保留内容，侧栏明确提示且禁用无效定位/链接；重锚操作仍待实现 | [DocumentPage.tsx](../../client/src/components/Layout/DocumentPage.tsx)、[commentDocumentSync.ts](../../client/src/components/Editor/blocks/commentDocumentSync.ts) | 服务端状态测试与浏览器契约已补 | REF-COMMENT-01 |
| FG-022 | 评论附件 | 在评论输入区选择附件 | 无上传/持久化链路的附件入口已隐藏；应在资产归属模型完成后实现预览、重试、删除和刷新恢复再开放 | [CommentSidebar.tsx](../../client/src/components/Layout/CommentSidebar.tsx)、[documents.ts](../../server/src/routes/documents.ts) | 缺失 | REF-COMMENT-02 |
| FG-023 | 评论恢复 | 令创建、编辑或解决请求失败 | 已提供线程级发送中/失败状态，创建与回复保留草稿并可重试，编辑和解决也可原位重试 | [DocumentPage.tsx](../../client/src/components/Layout/DocumentPage.tsx)、[CommentSidebar.tsx](../../client/src/components/Layout/CommentSidebar.tsx) | 浏览器契约覆盖 POST 失败后重试成功 | REF-COMMENT-03 |
| FG-024 | 普通表格 | 合并、缩放、着色或增删行列后保存并刷新 | 测试只断言即时 DOM；应验证序列化结构和恢复后的视觉/交互 | [feishuTable.ts](../../client/src/components/Editor/tables/feishuTable.ts)、[tableInsert.ts](../../client/src/components/Editor/tables/tableInsert.ts) | 部分：[rich-table-docs.spec.ts](../../client/tests/rich-table-docs.spec.ts) | REF-TABLE-01 |
| FG-025 | 普通表格 | 对含 rowspan/colspan 的表执行行列移动 | 简单矩形表支持整行/整列拖动；含合并单元格时轨道明确标记不可重排，拖动会解释结构保护原因且不修改表格 | [tableInsert.ts](../../client/src/components/Editor/tables/tableInsert.ts)、[FeishuTableOverlay.tsx](../../client/src/components/Editor/tables/FeishuTableOverlay.tsx) | 已覆盖：简单行拖动、合并表格禁用与数据不变 | REF-TABLE-02 |
| FG-026 | 普通表格粘贴 | 粘贴含合并单元格与样式的 HTML 表格 | 缺少 spans、未触及单元格和背景色的回归契约；应做结构 diff 与刷新验证 | [tableInsert.ts](../../client/src/components/Editor/tables/tableInsert.ts)、[Editor.tsx](../../client/src/components/Editor/Editor.tsx) | 缺失 | REF-TABLE-03 |
| FG-027 | Grid 字段 | 添加公式、关联、查找、人员或系统字段 | 选择器将未完整实现类型当作可用能力；应隐藏/标注或实现严格语义 | [bitableFieldTypes.ts](../../client/src/components/Bitable/fields/bitableFieldTypes.ts)、[BitableRecordCardModal.tsx](../../client/src/components/Bitable/records/BitableRecordCardModal.tsx) | 缺失：字段类型矩阵 | REF-GRID-03 |
| FG-028 | Grid 字段顺序 | 在一个视图重排字段后切换另一视图 | 当前改动全局 `table.fields`；应默认使用 view-local `fieldOrder` | [BitableBlockView.tsx](../../client/src/components/Bitable/BitableBlockView.tsx)、[bitableModel.ts](../../client/src/components/Bitable/model/bitableModel.ts) | 缺失 | REF-GRID-04 |
| FG-029 | Grid 删除字段 | 删除含数据且被筛选/排序引用的字段 | 立即清理数据和引用，无影响确认；应展示影响并提供迁移/恢复 | [BitableBlockView.tsx](../../client/src/components/Bitable/BitableBlockView.tsx) | 缺失 | REF-GRID-05 |
| FG-030 | Gallery 键盘 | Tab 到卡片并尝试打开、选择或范围选择 | 卡片只有指针 click，无稳定 tab stop/角色；应支持焦点、Enter/Space 与选择语义 | [BitableGalleryView.tsx](../../client/src/components/Bitable/views/BitableGalleryView.tsx) | 部分：[bitable-gallery.spec.ts](../../client/tests/bitable-gallery.spec.ts) 仅指针 | REF-GALLERY-01 |
| FG-031 | Gallery 上传 | 向背景拖文件并令上传失败 | 先创建记录，失败后留下空/卡住记录；应事务回滚或提供重试/移除 | [BitableBlockView.tsx](../../client/src/components/Bitable/BitableBlockView.tsx)、[BitableGalleryView.tsx](../../client/src/components/Bitable/views/BitableGalleryView.tsx) | 部分：只测成功上传 | REF-GALLERY-02 |
| FG-032 | Kanban 移动 | 不使用拖放，通过键盘/触控辅助方式移动卡片 | 仅原生 drag/drop；应提供“移动到列”菜单和键盘替代路径 | [BitableKanbanView.tsx](../../client/src/components/Bitable/views/BitableKanbanView.tsx) | 缺失 | REF-KANBAN-01 |
| FG-033 | Kanban 卡片 | Tab 到卡片并用 Enter 打开详情 | 卡片不可聚焦；应提供 card 语义、tab stop 与 Enter/Space 行为 | [BitableKanbanView.tsx](../../client/src/components/Bitable/views/BitableKanbanView.tsx) | 部分：[bitable-kanban.spec.ts](../../client/tests/bitable-kanban.spec.ts) 仅鼠标 | REF-KANBAN-02 |
| FG-034 | Kanban 分组 | 删除有记录的分组 | 记录分组值被静默清空；应确认影响并选择迁移目标 | [BitableBlockView.tsx](../../client/src/components/Bitable/BitableBlockView.tsx) | 缺失 | REF-KANBAN-03 |
| FG-035 | Record Modal | 打开详情后反复 Tab，再关闭 | 缺少可靠 focus trap 与来源焦点恢复；应限制焦点并返回原卡片/单元格 | [BitableRecordCardModal.tsx](../../client/src/components/Bitable/records/BitableRecordCardModal.tsx) | 部分：[bitable-record-modal.spec.ts](../../client/tests/bitable-record-modal.spec.ts) 只测布局 | REF-MODAL-01 |
| FG-036 | Record Modal | 开启日期提醒，关闭并重开 | 提醒只在局部 state；应持久化，或移除伪功能 | [BitableRecordCardModal.tsx](../../client/src/components/Bitable/records/BitableRecordCardModal.tsx) | 缺失 | REF-MODAL-02 |
| FG-037 | Record Modal 附件 | 上传附件、令上传失败或尝试删除 | 只有添加和状态展示，无删除/取消/重试完整生命周期 | [BitableRecordCardModal.tsx](../../client/src/components/Bitable/records/BitableRecordCardModal.tsx)、[BitableBlockView.tsx](../../client/src/components/Bitable/BitableBlockView.tsx) | 部分：只测弹层几何 | REF-MODAL-03 |
| FG-038 | 导入取消 | 开始大文件/URL 导入后关闭对话框或切换页面 | 文件上传显示进度且可取消，URL 导入和页面卸载会 abort；待补浏览器 E2E 和服务端中断后的临时资源清理 | [documents.ts](../../client/src/api/documents.ts)、[DocumentList.tsx](../../client/src/components/DocumentList/DocumentList.tsx) | Client build 已覆盖，E2E 待补 | REF-IMPORT-04 |
| FG-039 | 上传生命周期 | 删除文档块/记录中的附件后检查服务端文件 | 文件留在全局 public 目录，无资产归属和 DELETE/清理 | [uploads.ts](../../server/src/routes/uploads.ts) | 缺失 | REF-UPLOAD-03 |
| FG-040 | 媒体失败恢复 | 上传失败、刷新页面，再点重试 | 重试依赖内存中的原始 `File`，刷新后失效；应提示重选或支持可恢复上传 | [Editor.tsx](../../client/src/components/Editor/Editor.tsx)、[mediaUploadRegistry.ts](../../client/src/components/Editor/media/mediaUploadRegistry.ts) | 部分：[media-file-blocks.spec.ts](../../client/tests/media-file-blocks.spec.ts) 未刷新 | REF-UPLOAD-02 |
| FG-041 | 图片/视频交互 | 图片加载失败，或缩放视频后保存刷新 | 图片现保留可重试失败面板；视频右下角等比缩放会持久化宽高，并在浏览器支持时提供画中画；待真实浏览器视觉基线和刷新 E2E | [Editor.tsx](../../client/src/components/Editor/Editor.tsx)、[VideoResizeHandle.tsx](../../client/src/components/Editor/media/VideoResizeHandle.tsx) | 单元测试已覆盖尺寸算法，浏览器契约已补 | MEDIA-001 |
| FG-042 | 图片拖拽排版 | 按住图片本体拖到其它正文块或分栏 | 已接入统一块拖拽状态机，超过阈值后显示缩略图和插入线，支持跨正文/分栏父容器移动；飞书不支持的浮动和文字环绕明确不实现 | [Editor.tsx](../../client/src/components/Editor/Editor.tsx)、[feishuBlockDrag.ts](../../client/src/components/Editor/blocks/feishuBlockDrag.ts) | 跨分栏浏览器契约已补 | MEDIA-001 |

## P2 候选

以下能力不应在界面中伪装成完整功能，应在对应阶段决定实现或移除：评论“翻译/举报”、评论本地点赞、打开筛选面板即持久化空规则、Record Modal 文本字段逐键提交且 Esc 不取消。块菜单伪“翻译”和公共链接 HTTP 已移除。

## 数量与覆盖

- 共 42 条：P0 8 条，P1 34 条。
- 全部 13 类计划流均有代码归属和测试状态：文档输入、Slash、块菜单、标题折叠、目录、评论、普通表格、Grid、Gallery、Kanban、Record Modal、导入、上传。
- 主要空白集中在真实持久化、权限、安全、键盘路径和失败恢复；现有强项是局部渲染、指针交互和 portal 几何。
