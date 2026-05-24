# 飞书文档编辑器复刻项目

> 基于 TipTap / ProseMirror 的飞书云文档风格编辑器。目标：在可运行的工程基础上，**逐步对齐飞书的块编辑体验、视觉规范与协作能力**。

本文档依据 **当前代码实际状态**（截至 2026-05-24）与本机飞书客户端前端产物解析结果编写，供后续人工或 AI 按阶段推进时对照，避免重复实现或误判完成度。

更多接力资料：

- `docs/FEISHU_REPLICA_PLAN.md`：当前实现复盘、错误实现与逐项 review 执行计划。
- `docs/FEISHU_LOCAL_ASSETS_ANALYSIS.md`：本机飞书 `webcontent` / `.asar` 前端产物解析记录。
- `docs/FEISHU_MENU_AUDIT.md`：插入菜单逐项功能验收，标记哪些不允许再作为占位实现。

---

## 项目定位

| 维度 | 现状 |
|------|------|
| 形态 | 前后端分离的单用户文档应用 |
| 编辑器 | TipTap 2.x + 自定义 NodeView / 扩展 |
| 数据 | JSON 文件数据库（`server/data/db.json`），HTML 存正文 |
| 协同 | 未实现 |
| 权限 | 未实现（仅有前端「阅读 / 编辑」切换） |

**原则**：先对齐核心编辑体验（块柄、Slash、块菜单、目录、评论），再补高级块与协作；占位块必须在 README 中标注为「部分实现」，不得当作已完成。

---

## 当前实现进度

> 统计口径：对照下方「功能对照表」按用户可感知能力点估算。✅ 计 100%，🟡 计 50%，❌ 计 0%。  
> 更新时间：2026-05-24

### 总体进度

| 指标 | 数值 |
|------|------|
| **综合完成度** | **约 82%**（核心编辑体验接近完整；表格能力比旧记录更完整；块模型、评论闭环、权限 / 协作仍是主要缺口） |
| ✅ 已实现 | 文档 CRUD、富文本、Slash、块菜单、目录、表格高保真交互、Excel/HTML 表格基础粘贴、表格行列基础拖拽重排、分栏基础、块级评论 |
| 🟡 部分实现 | 稳定 blockId、封面、模板、子文档、框选增强、评论 range / 线程、高级块真实化、表格复杂场景 |
| ❌ 未实现 | 实时协同、权限 ACL、历史版本、全文搜索替换、块级拖拽排序、右键统一菜单 |
| 后端 API 路由 | 文档 / 评论 / 模板 / 上传 **已可用** |
| 构建状态 | 最近一次人工记录：`client` `tsc` + `vite build` 可通过；本次仅更新文档，未重新构建 |

```
整体 [████████████████░░░░] ~82%

工程与文档管理  [████████████████░░░░] ~77%
编辑器基础      [███████████████████░] ~96%  ← 当前最成熟
飞书风格交互    [██████████████████░░] ~90%
目录与标题      [████████████████░░░░] ~79%
高级块          [███████████████░░░░░] ~76%  ← 表格 / 分栏已增强，占位块仍较多
评论与协作      [██████████░░░░░░░░░░] ~50%  ← 无实时协同
```

### 分模块进度

| 模块 | ✅ | 🟡 | ❌ | 完成度 | 说明 |
|------|----|----|-----|--------|------|
| 1. 工程与文档管理 | 7 | 3 | 2 | ~77% | CRUD、自动保存、阅读模式已可用；权限 / 搜索未做 |
| 2. 编辑器基础 | 10 | 1 | 0 | ~96% | 富文本、列表、退格降级齐全；Markdown 规则不全 |
| 3. 飞书风格交互 | 12 | 1 | 2 | ~90% | Slash、块菜单、行高亮、块链接、框选多块已完成；**缺真实拖拽排序 / 右键统一菜单** |
| 4. 目录与标题 | 5 | 1 | 1 | ~79% | 大纲、折叠、光标同步已有；**折叠不持久化** |
| 5. 高级块 | 9 | 7 | 1 | ~76% | 表格和分栏已明显增强；公式 / 同步 / 多维表格等已有本地雏形但未对齐飞书真实能力 |
| 6. 评论与协作 | 4 | 1 | 4 | ~50% | 块评论闭环可用；**无协同 / 划词 / 线程** |

### 路线图阶段进度

| 阶段 | 名称 | 进度 | 状态 |
|------|------|------|------|
| 0 | 基线与规范 | ~20% | 🟡 已有 `docs/specs/feishu-table.md`；仍缺完整 UI 截图目录 |
| 1 | 块数据基础 | ~90% | 🟡 已新增统一 `FeishuBlockId` 扩展覆盖主要可操作块；`headingId` / `tableId` 已与 `blockId` 收敛，标题折叠状态已持久化，块定位 API 已统一 |
| 2 | 块操作闭环 | ~92% | ✅ 剪切复制、删除、上下方添加、框选批量删除/复制/移动、六点柄同父级拖拽排序、保存块模板、转子文档、右键统一菜单已有 |
| 3 | 表格与分栏 | ~90% | 🟡 表格 Overlay、行列选择/插入/删除、合并拆分、单元格背景、均分列宽、Excel/HTML 富粘贴、简单行列拖拽重排、可编辑分栏已做；冻结行列和合并单元格下的重排策略未做 |
| 4 | 菜单与视觉对齐 | ~60% | 🟡 块菜单、表格块菜单、Slash、选区气泡较完整；最近颜色、完整截图对照未做 |
| 5 | 评论与 @ | ~40% | 🟡 块评论可用；划词、回复线程、@ 未做 |
| 6 | 高级块真实化 | ~30% | 🟡 分栏已真实化；公式 / 同步 / 画板 / 多维表格等仍为占位 |
| 7 | 协作与产品化 | ~5% | ❌ 仅 URL 复制；无 Yjs、权限、版本、首页筛选 |

### 近期已完成（2026-05）

- 标题 `headingId` + 左侧目录实时同步
- 标题折叠 / 展开（编辑器 + 目录，会话内）
- 空块退格降级（`feishuBlockBackspace`）
- 块柄 hover 行高亮（overlay 方案）
- Slash「+」菜单定位修复（252px 宽度对齐）
- Slash「+」hover 报错修复：`relatedTarget` 统一经 `getRelatedNode()` 校验；`EditorContent` 固定先渲染；`SelectionBubble`（含 tippy.js）移出 `.editor-content-area`，避免 React 在已被 tippy portal 到 body 的 DOM 上 `insertBefore`
- TipTap 表格 + 行列选择器 + 增行/列 + 删行/列 + 标题行/列 切换 + 删除表格
- 块级评论侧栏 + API
- 表格 Overlay：顶部 / 左侧轨道、边界灰点、插入行列加号、滚动渐隐
- 表格选区：整行 / 整列 `CellSelection`、浅蓝选中态、表格选区浮动工具栏
- 表格操作补齐：合并 / 拆分单元格、单元格背景色、删除行列、均分列宽
- 表格粘贴基础版：`insertTableFromClipboardData()` 已支持 HTML table / TSV 生成 TipTap 表格
- 表格行列拖拽基础版：`FeishuTableOverlay.tsx` 已接 `moveTableRow()` / `moveTableColumn()`，简单表格可重排
- 分栏块真实化：2–5 栏插入、栏内可编辑块、空栏「+」菜单、栏宽拖动、栏间新增
- 框选多块：拖拽矩形选择普通块 / 列表项 / 表格行，支持 `Delete` / `Backspace` / `Enter` 批量删除
- 本机飞书前端产物解析：已定位 `D:\ferishu\Feishu\app\webcontent`，确认 `space.asar`、`docs`、`ccm-offline`、`bitable` 等可作为模块和视觉对照依据
- 统一块 ID 基础：新增 `FeishuBlockId` 扩展，paragraph / heading / listItem / blockquote / codeBlock / table / columns / media / embed 等主要可操作块会自动补 `blockId`
- 历史锚点收敛：标题 `headingId`、表格 `tableId` 会与 `blockId` 保持同一稳定 ID，目录、折叠、块链接、评论定位共用锚点策略
- 标题折叠持久化：文档保存 `collapsed_heading_ids`，刷新或复制文档后可恢复折叠状态
- 块定位 API：新增 `resolveBlockElement()`，目录、块链接、评论侧栏和评论孤儿检测共用同一锚点解析策略
- 六点柄拖拽排序：段落、标题、列表项、引用、代码等同父级块可通过六点柄拖到目标块前后，undo 可用
- 块菜单补齐：支持在上方/下方添加、当前块/选区保存为模板、转换为子文档卡片
- 多块选择增强：Shift 点击扩展范围，选中连续同父级块后可复制、删除、Alt+↑/↓ 批量移动
- 右键统一菜单：正文普通块右键打开块菜单，表格右键打开表格菜单
- 转子文档闭环：后端新增父文档下创建子文档 API，块菜单可把选中块迁入子文档并在父文档留下卡片
- 表格粘贴增强：HTML 表格粘贴保留链接、换行、表头和背景色，合并单元格先安全降级为占位矩阵

### 当前验收状态（2026-05-22）

| 验收项 | 状态 | 验收方式 |
|--------|------|----------|
| 前端类型检查与生产构建 | ✅ 历史通过 | 既有记录：`client` 执行 `npm run build`；本次文档更新未重新构建 |
| 鼠标 hover 空段落左侧「+」 | ✅ 已修复 | 悬浮「+」打开 Slash 菜单，不再抛 `contains` / `insertBefore` 级联错误 |
| Slash「+」菜单定位 | ✅ 已实现 | 菜单按块柄左右可用空间定位，宽度使用 `SLASH_MENU_WIDTH` |
| 块配置菜单 hover | ✅ 已实现 | 非空块 hover 六点柄打开 `ContextMenu` |
| 表格：插入 / 增行 / 增列 | ✅ 已实现 | Slash「表格」选行列后插入；块菜单「向上/下插入行」「向左/右插入列」 |
| 表格：删除当前行 / 当前列 / 整表 | ✅ 已实现 | 进入单元格后块菜单「删除当前行 / 当前列 / 删除表格」 |
| 表格：标题行 / 标题列 切换 | ✅ 已实现 | 块菜单切换开关，状态即时反映在右侧开关样式 |
| 表格：单元格 Tab 导航 | ✅ 已实现 | TipTap Table 默认 keymap `goToNextCell` |
| 表格：合并 / 拆分单元格 | ✅ 已实现 | 选中多单元格后，块菜单自动激活「合并单元格 / 拆分单元格」选项 |
| 表格：轨道选择 / 边界插入 | ✅ 已实现 | `FeishuTableOverlay.tsx` 区分选择轨道与插入灰点，避免点击冲突 |
| 表格：单元格背景色 | ✅ 已实现 | 选区气泡写入 `backgroundColor` cell attr，刷新后随 HTML 恢复 |
| 表格：Excel / HTML 基础粘贴 | ✅ 已实现 | `tableInsert.ts` 解析 HTML table / TSV；暂不完整保留样式、链接、合并单元格 |
| 表格：行列拖拽重排 | 🟡 部分通过 | 简单矩阵表格可拖拽重排；含 rowspan / colspan 的复杂表格仍需策略 |
| 分栏：可编辑 / 调宽 / 新增栏 | ✅ 已实现 | `localColumnsBlock` + React NodeView，列内可继续插入块 |
| 框选多块批量删除 | ✅ 已实现 | 拖拽框选块 / 列表项 / 表格行，键盘删除 |
| 标题折叠 | 🟡 部分通过 | 会话内可折叠；刷新后持久化待实现 |
| 评论闭环 | 🟡 部分通过 | 块级评论可用；前端已有划词 / 回复 UI 雏形，但后端 `thread_id` / `parent_id` / `anchor_json` 未闭环 |

### 建议下一步（优先级）

1. **阶段 1**：统一所有可操作块的 `blockId` + 折叠状态写入文档 JSON  
2. **阶段 2**：六点柄真实拖拽排序（含插入线、撤销、分栏内外边界）  
3. **阶段 3**：表格粘贴增强、复杂表格重排策略、冻结行列  
4. **阶段 4**：结合本机飞书 `webcontent` 产物与运行时截图，建立完整 `docs/feishu-spec` 对照资料，校准块菜单 / 表格 / 评论像素  

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite |
| 编辑器 | TipTap 2.x（ProseMirror）+ lowlight |
| 样式 | Less（飞书风格自定义样式） |
| 路由 | react-router-dom |
| UI 组件 | tdesign-react（部分页面） |
| 后端 | Node.js + Express + TypeScript |
| 存储 | JSON 文件（`better-sqlite3` 未使用，见 `database.ts`） |
| 上传 | multer → `server/public/uploads` |

---

## 快速开始

```bash
# 后端（端口 3000）
cd server && npm install && npm run dev

# 前端（端口 5173）
cd client && npm install && npm run dev
```

浏览器访问：<http://localhost:5173>

```bash
# 构建 / 测试
cd client && npm run build
cd server && npm test
```

---

## 项目结构

```
word/
├── README.md
├── server/
│   ├── data/db.json              # 文档、评论、模板数据
│   ├── public/uploads/           # 上传文件
│   ├── tests/api.test.ts
│   └── src/
│       ├── index.ts              # Express 入口、静态资源
│       ├── database.ts           # JSON 读写
│       └── routes/
│           ├── documents.ts      # 文档 / 评论 / 模板 API
│           └── uploads.ts        # POST /api/uploads
└── client/src/
    ├── api/documents.ts          # 前端 API 封装
    ├── types/index.ts            # Document、Comment、HeadingItem 等
    ├── icons/                    # 飞书风格 SVG 图标
    └── components/
        ├── DocumentList/         # 首页文档列表
        ├── Layout/
        │   ├── DocumentPage.tsx  # 文档页容器
        │   ├── DocumentHeader.tsx
        │   ├── Sidebar.tsx       # 左侧目录
        │   └── CommentSidebar.tsx
        └── Editor/
            ├── Editor.tsx        # 编辑器主组件
            ├── ContextMenu.tsx   # 块配置菜单
            ├── TableContextMenu.tsx # 表格块专项菜单
            ├── SlashMenu.tsx     # Slash / 「+」插入菜单
            ├── SelectionBubble.tsx
            ├── FeishuBoxBlockSelection.tsx # 框选多块浮层
            ├── boxSelectionModel.ts        # 框选块收集 / 批量删除
            ├── feishuHeading.ts      # 标题 + headingId
            ├── feishuBlockBackspace.ts # 空块退格降级
            ├── headingCollapse.ts      # 标题折叠 DOM 同步
            ├── feishuTable.ts          # 表格扩展
            ├── feishuTableView.ts      # 表格 NodeView 包装
            ├── FeishuTableOverlay.tsx  # 表格轨道 / 边界插入 Overlay
            ├── tableDom.ts             # 表格 DOM / CellSelection 同步工具
            ├── tableInsert.ts          # 表格插入 / 行列操作
            ├── panelActions.ts         # 选区气泡与表格动作
            ├── TableGridPicker.tsx     # 表格行列选择器
            ├── columnsExtensions.ts    # 分栏 ProseMirror schema
            ├── columnsNodeViews.tsx    # 分栏 NodeView / 调宽 / 新增栏
            ├── columnsInsert.ts        # 分栏插入逻辑
            ├── blockLink.ts            # 块链接复制 / hash 定位
            ├── commentBlockAnchor.ts   # 评论块锚点
            ├── HighlightBlock.ts
            ├── insertBelowBlocks.ts    # 「在下方添加」
            └── slashMenuConfig.ts      # Slash 菜单项配置
```

---

## 功能对照表（飞书文档）

图例：**✅ 已实现** · **🟡 部分实现** · **❌ 未实现**

### 1. 工程与文档管理

| 功能 | 状态 | 说明 / 关键文件 |
|------|------|-----------------|
| 文档 CRUD | ✅ | `server/routes/documents.ts`，`DocumentList.tsx` |
| 自动保存正文 | ✅ | `Editor.tsx` debounce ~1s |
| 文档标题 / 图标 | ✅ | 标题输入 + `EmojiPicker.tsx`，字段 `icon` |
| 封面 | 🟡 | 可添加预设 `/static/01.gif` 并移除；无上传裁剪 `Editor.tsx` |
| 复制文档 | ✅ | `POST /:id/duplicate`，已复制 `cover_url` / `icon` / `parent_id` 等基础元信息 |
| 保存为模板 | 🟡 | API + Header 入口；Slash「模板」仅取列表第一项 |
| 子文档 `parent_id` | 🟡 | Slash / insertBelow 可创建；首页无树形展示 |
| 阅读 / 编辑模式 | ✅ | `DocumentPage` `readOnly` → `editor.setEditable` |
| 首页 Tab（最近 / 共享 / 收藏） | 🟡 | UI 有，数据未过滤 `DocumentList.tsx` |
| 搜索 / 筛选 / 宫格视图 | ❌ | 按钮无逻辑 |
| 用户 / 权限 / 分享 ACL | ❌ | 仅复制 URL |

### 2. 编辑器基础

| 功能 | 状态 | 说明 / 关键文件 |
|------|------|-----------------|
| 段落 | ✅ | StarterKit paragraph |
| 标题 H1–H6 | ✅ | `feishuHeading.ts`，占位符 `H1`…`H6` |
| 加粗 / 斜体 / 下划线 / 删除线 | ✅ | `SelectionBubble.tsx` |
| 字体色 / 背景色 | ✅ | `FeishuColorPickerPanel.tsx` |
| 行内代码 | ✅ | StarterKit |
| 链接 | ✅ | `FeishuLink` + 页面链接弹窗 `Editor.tsx` |
| 有序 / 无序 / 任务列表 | ✅ | TaskList + TaskItem |
| 引用块 | ✅ | blockquote |
| 分割线 | ✅ | `FeishuHorizontalRule` NodeView |
| 撤销 / 重做 | ✅ | StarterKit history |
| Markdown 输入规则 | 🟡 | 部分（如 `---` 分割线）；未系统覆盖 |
| 空块退格降级 | ✅ | `feishuBlockBackspace.ts`（标题→段落→合并上一行） |

### 3. 飞书风格交互

| 功能 | 状态 | 说明 / 关键文件 |
|------|------|-----------------|
| 块左侧「+」插入 | ✅ | 空段落 `block-add-btn`，打开 Slash `SlashMenu.tsx` |
| Slash 菜单 `/` | ✅ | 基础栅格 + 常用列表 `slashMenuConfig.ts` |
| 块配置菜单（T + 六点柄） | ✅ | `ContextMenu.tsx`，hover 打开 |
| 选区气泡工具栏 | ✅ | `SelectionBubble.tsx` |
| 块柄 hover 行高亮 | ✅ | overlay `block-row-gutter-highlight-band` `Editor.tsx` |
| 缩进与对齐子菜单 | ✅ | `ContextMenu.tsx` + `blockIndent.ts` |
| 颜色子菜单 | ✅ | `FeishuColorPickerPanel.tsx` |
| 在下方添加子菜单 | ✅ | `insertBelowBlocks.ts` |
| 块剪切 / 复制 / 删除 | ✅ | `ContextMenu.tsx` |
| 复制块链接 | ✅ | `blockLink.ts` |
| Hash 定位并高亮块 | ✅ | `scrollToBlockFromHash()` |
| 块拖拽排序 | ❌ | 六点图标仅打开块菜单，无 DnD |
| 多块选择 | 🟡 | 已支持拖拽框选普通块 / 列表项 / 表格行并批量删除；未支持 Shift 点击、复制、拖拽移动 |
| 右键菜单（浏览器） | ❌ | 未统一为飞书块菜单 |

### 4. 目录与标题

| 功能 | 状态 | 说明 / 关键文件 |
|------|------|-----------------|
| 左侧目录（标题大纲） | ✅ | `Sidebar.tsx` + `extractHeadings()` |
| 目录点击滚动定位 | ✅ | `getElementById(headingId)` |
| 光标所在章节高亮 | ✅ | `resolveCatalogueActiveId()` |
| 文档标题进目录 | ✅ | `DOC_TITLE_CATALOGUE_ID` |
| 标题折叠 / 展开 | ✅ | 块柄三角 + 目录箭头 `headingCollapse.ts` |
| 折叠状态持久化 | ❌ | 仅 React 内存状态 |
| 标题下仅有空段落时折叠 | 🟡 | 有任意后续兄弟块即显示折叠柄 |

### 5. 高级块

| 功能 | 状态 | 说明 / 关键文件 |
|------|------|-----------------|
| 高亮块（Callout） | ✅ | `HighlightBlock.ts` |
| 代码块 + 语法高亮 | ✅ | `FeishuCodeBlock` + lowlight |
| 图片上传 | ✅ | `POST /api/uploads` → image node |
| 视频 / 文件卡片 | ✅ | `localFileBlock` |
| 表格 | ✅ | TipTap Table + 自定义 NodeView / Overlay；插入、行列选择、边界加号、增删行列、标题行列、Tab 导航、滚动渐隐、表格块菜单均可用 `feishuTable.ts` `FeishuTableOverlay.tsx` `TableContextMenu.tsx` |
| 表格 Slash 选行列 | ✅ | `TableGridPicker.tsx` |
| 表格合并 / 拆分单元格 | ✅ | `SelectionBubble.tsx` 调用 `mergeCells / splitCell`，按当前能力自动启用 |
| 表格单元格背景色 | ✅ | `FeishuTableCell / Header` 持久化 `backgroundColor` attr |
| 表格均分列宽 | ✅ | `distributeActiveTableColumns()` 写入 `colwidth` |
| 表格从 Excel 粘贴 | ❌ | 未实现 paste handler |
| 分栏 | ✅ | `localColumnsBlock` / `localColumnBlock` 可编辑，支持 1–5 栏插入、空栏加号、栏间新增、拖动调宽 |
| 同步块 | 🟡 | `LocalSyncBlock` 无跨文档同步 |
| 按钮块 | 🟡 | 静态展示 |
| 公式块 | 🟡 | 静态 `E=mc²`，无 KaTeX |
| 子文档卡片 | 🟡 | `localEmbedBlock` 链到新文档 |
| 多维表格 / 看板 / 甘特 / 画册 | 🟡 | Slash 入口 → embed 占位卡片 |
| 画板 / 思维导图 / 流程图 / UML | 🟡 | 同上 |
| @ 人员 | 🟡 | 占位 embed |

### 6. 评论与协作

| 功能 | 状态 | 说明 / 关键文件 |
|------|------|-----------------|
| 块级评论 | ✅ | API + `CommentSidebar.tsx` |
| 评论增删改 / 解决 | ✅ | `documents.ts` comment routes |
| 从选区 / 块打开评论侧栏 | ✅ | `feishu-open-comment-sidebar` 事件 |
| 评论侧栏贴块定位 | ✅ | `CommentSidebar.tsx` scroll 同步 |
| 划词评论（range） | ❌ | `position_from/to` 恒为 0 |
| 评论回复线程 | ❌ | UI 有「回复」，无 `parent_id` |
| 翻译 / 举报 / 点赞 | 🟡 | Toast 占位 |
| 实时协同 | ❌ | 无 Yjs / WebSocket |
| 历史版本 | ❌ | |

### 7. 上下文菜单占位项

以下在 `ContextMenu.tsx` 有菜单项，**业务未实现**（点击关闭或 disabled）：

- 翻译
- 分享（块级，非 URL 复制）
- 转换为子文档（`POST /to-child` 存在但 UI 未调用）
- 保存为模板（Header 有独立入口）

以下在 `TableContextMenu.tsx` 有菜单项，**仅完成表格局部语义或仍为占位**：

- 分享（点击关闭）
- 保存为模板（点击关闭）
- 同步块（在表格下方插入本地同步块，占位，无跨文档同步）

---

## 与飞书的主要差距（汇总）

1. **块模型**：已有统一 `blockId` 基础扩展覆盖主要可操作块，并已收敛 heading / table 历史锚点语义和折叠持久化；同父级块拖拽排序已实现，仍缺父子树和跨父级拖拽。
2. **高级块**：多数 Slash 项为 embed 占位，非可编辑真实组件。
3. **表格**：核心富文本表格已可用；基础 Excel / HTML 粘贴、简单行列拖拽重排已实现；仍缺复杂粘贴保真、冻结行列、合并单元格下的重排策略、列宽自适应。
4. **协作与权限**：无多人实时、动作级权限、@人、通知。本机飞书产物显示权限动作至少包括 `VIEW`、`COMMENT`、`EDIT`、`COPY`、`DUPLICATE`、`MANAGE_HISTORY_RECORD`、`EXPORT` 等，后续不能只做 read/edit 两档。
5. **产品化**：首页 Tab、搜索、收藏、封面上传、模板选择器未完整。本机 `space.asar` 可见 `clone_modal`、`app_share_menu`、`apply_edit_permission_modal`、`bear-template-center-external`、`explorer_sidebar_tree` 等真实模块线索。
6. **视觉**：菜单尺寸 / 图标 / 动效距飞书像素级仍有差距（需对照截图迭代）。

---

## 本机飞书产物解析结论

本机已启动 / 安装飞书客户端，可读取到打包后的前端产物，但不是可维护源码仓库。

| 位置 | 结论 |
|------|------|
| `D:\ferishu\Feishu\app\webcontent` | 飞书主要 WebView 前端产物目录 |
| `webcontent/docs` | 文档选择、绑定文档、doc preview 等 chunk |
| `webcontent/ccm-offline` | 云文档通用能力、权限、domain / drive / space API 相关 chunk |
| `webcontent/bitable` | 多维表格 HTML 入口 |
| `webcontent/space.asar` | 云文档空间、模板、分享、权限、空间树等产品化模块 |
| `webcontent/resource.asar` | 字体、图片、主题样式与通用资源 |

可用方式：

- 用 `.asar` / chunk 名称反推真实模块边界，例如权限、分享、模板中心、空间树、拖拽移动进度。
- 用本地运行时 DOM / 截图补 `docs/feishu-spec/`，做像素和交互验收。
- 不直接复制飞书私有压缩代码；本项目按现有 TipTap 架构独立实现。

详见 `docs/FEISHU_LOCAL_ASSETS_ANALYSIS.md`。

---

## 逐步实现路线（供 AI / 开发者执行）

每个阶段包含：**目标 → 涉及文件 → 任务清单 → 验收标准**。请按顺序推进，完成一阶段再开下一阶段。

---

### 阶段 0：基线与规范（1–2 天）

**目标**：后续改动可对照、可回归。

| # | 任务 | 文件 |
|---|------|------|
| 0.1 | 在 `docs/feishu-spec/` 存放飞书截图与标注（块菜单宽 252px、行高、色值 `#3370ff` 等） | 新建目录 |
| 0.2 | 补充 `client` 单测或 Playwright 冒烟：打开文档、输入文字、自动保存 | 可选 |
| 0.3 | 统一 API 响应 `{ code, data, message }` 文档 | `README` 或 `docs/api.md` |

**验收**：新开发者能对照 spec 目录理解 UI 目标；`npm run build` 通过。

---

### 阶段 1：块数据基础（P0，3–5 天）

**目标**：所有块有稳定 ID，支持链接、评论、折叠持久化。

| # | 任务 | 文件 | 细节 |
|---|------|------|------|
| 1.1 | 扩展 `blockId` 到 paragraph / list / quote 等 | `feishuBlockId.ts`，各 Node 扩展 | ✅ 已覆盖主要可操作块，创建 / 粘贴旧内容时自动补 ID |
| 1.2 | 替换仅 pos 依赖的 ID | `feishuHeading.ts`、`feishuTable.ts` | ✅ headingId / tableId 与 blockId 保持一致 |
| 1.3 | 持久化 `collapsedHeadingIds` | `database.ts` Document 类型 + `DocumentPage.tsx` | ✅ JSON 字段 `collapsed_heading_ids: string[]` |
| 1.4 | 修复 duplicate 丢失 `cover_url` | `server/routes/documents.ts` | ✅ 已修复基础元信息；历史版本 / 权限 / 评论继承待后续权限模型确定 |
| 1.5 | 块定位 API | `blockDom.ts`、`blockLink.ts` | ✅ 统一 `resolveBlockElement(blockId)` |

**验收**：
- 复制块链接刷新后仍可跳转；
- 折叠标题刷新后保持折叠；
- 新段落自动带 `data-block-id`。

---

### 阶段 2：块操作闭环（P1，5–7 天）

**目标**：飞书核心块编辑：拖拽、多选、上下插入。

| # | 任务 | 文件 | 细节 |
|---|------|------|------|
| 2.1 | 块拖拽排序 | 新建 `feishuBlockDrag.ts` 或 `@tiptap/extension-drag-handle` | 六点柄按下拖拽，插入线指示 |
| 2.2 | 当前块上方插入 | `ContextMenu.tsx` / `insertBelowBlocks.ts` | 对称实现 `insertAbove` |
| 2.3 | 块类型转换保留内容 | `ContextMenu.tsx` `applyBlockType` | 列表 ↔ 段落 ↔ 标题 不丢文本 |
| 2.4 | 多块选择增强 | `FeishuBoxBlockSelection.tsx` / `boxSelectionModel.ts` | 已有拖拽框选 + 批量删除；补 Shift 点击、批量复制、批量移动 |
| 2.5 | 实现 ContextMenu「转换为子文档」 | 调用 `POST /:id/to-child` | 选中块 HTML 迁入子文档 |
| 2.6 | 实现「保存为模板」块级入口 | `ContextMenu.tsx` + 已有 API | 弹窗输入模板名 |
| 2.7 | 右键统一菜单 | `Editor.tsx` / `ContextMenu.tsx` | 拦截浏览器右键，定位到当前块并打开飞书块菜单 |

**验收**：
- 拖拽段落改变顺序且 undo 可用；
- 块菜单「在上方添加」可用；
- 子文档转换后父文档剩 embed 卡片；
- 框选后可复制 / 移动 / 删除多块。

---

### 阶段 3：表格与分栏（P2，5–7 天）

**目标**：在当前表格 / 分栏可用基础上补齐飞书高阶操作。

| # | 任务 | 文件 | 细节 |
|---|------|------|------|
| 3.1 | Excel / HTML 表格粘贴增强 | `tableInsert.ts` | 已有 HTML table / TSV → TipTap table；继续补链接、换行、表头、背景色、合并单元格降级策略 |
| 3.2 | 复杂表格行列拖拽策略 | `FeishuTableOverlay.tsx` / `tableInsert.ts` | 已有简单矩阵表格重排；继续补 rowspan / colspan 禁用提示或安全移动 |
| 3.3 | 冻结首行 / 首列 | `feishuTable.ts` / `FeishuTableOverlay.tsx` | 先做视觉冻结，后续再持久化配置 |
| 3.4 | 列宽内容自适应 | `panelActions.ts` | 选区列按内容或容器宽度自动调整 |
| 3.5 | 分栏操作补齐 | `columnsNodeViews.tsx` / `columnsHelpers.ts` | 删除栏、栏间拖拽重排、分栏转普通块 |

**验收**：从 Excel / 网页粘贴能更高保真生成 TipTap 表格；复杂表格重排有安全策略；分栏可删除 / 调整 / 还原。

---

### 阶段 4：Slash / 菜单与视觉对齐（P2，持续）

**目标**：交互与飞书截图一致。

| # | 任务 | 文件 | 细节 |
|---|------|------|------|
| 4.1 | Slash 菜单键盘导航与搜索排序 | `SlashMenu.tsx` | 模糊匹配 label + matchText |
| 4.2 | 「+」菜单 anchored 模式（可选） | `SlashMenu.less` `--anchored` | 避免遮挡块柄 |
| 4.3 | ContextMenu 像素校准 | `ContextMenu.less` | 宽 252、图标区 2 行、子菜单 flyout |
| 4.4 | 颜色面板「最近使用」 | `FeishuColorPickerPanel.tsx` | localStorage |
| 4.5 | 占位菜单项：翻译 disabled 原因 tooltip | `ContextMenu.tsx` | 或接翻译 API |
| 4.6 | 表格 spec 持续对齐 | `docs/specs/feishu-table.md` / `FeishuTableOverlay.less` | 对轨道、灰点、插入线、选区气泡做截图回归 |
| 4.7 | 删除未使用的 `Toolbar.tsx` 或接入顶栏 | `DocumentHeader` / `Editor` | 避免双工具栏 |

**验收**：与 `docs/feishu-spec` 截图对比，块菜单误差 ≤ 2px。

---

### 阶段 5：评论与 @（P3，5–7 天）

**目标**：评论接近飞书块评论。

| # | 任务 | 文件 | 细节 |
|---|------|------|------|
| 5.1 | 评论 `parent_id` 线程 | `database.ts` + `CommentSidebar.tsx` | 回复嵌套展示 |
| 5.2 | 划词评论 range | `commentBlockAnchor.ts` + schema mark | 存 `position_from/to` |
| 5.3 | 评论高亮锚点 | ProseMirror Decoration | 选中文本对应评论 |
| 5.4 | @ 人员 | 新建 `Mention` extension + 用户列表 API | 可先 mock 用户表 |

**验收**：同一块多条回复成线程；选中文本可评论且刷新后恢复。

---

### 阶段 6：高级块真实化（P3–P4，按块拆分）

**每块独立 PR，避免大爆炸。**

| 块 | 任务 | 建议方案 |
|----|------|----------|
| 公式 | KaTeX 渲染 + 编辑弹窗 | `@tiptap/extension-mathematics` 或自定义 NodeView |
| 同步块 | 源块 ID + 引用块 + 轮询 / WS 同步 | 文档表增加 `sync_sources` |
| 按钮 | 文案 + 链接 action | NodeView 表单 |
| 画板 | tldraw / Excalidraw embed | iframe 或 npm 包 + 存 JSON |
| 多维表格 | 独立 schema + 视图切换 | 长期项，可先 Bitable 只读 |

**验收**：每个块可编辑、保存 HTML/JSON、刷新后恢复。

---

### 阶段 7：协作与产品化（P4，长期）

| # | 任务 | 说明 |
|---|------|------|
| 7.1 | 文档内搜索 / 替换 | CM 或 ProseMirror search |
| 7.2 | 历史版本快照 | 每次保存写 version 表 |
| 7.3 | Yjs + WebSocket 协同 | `y-prosemirror` + server ws |
| 7.4 | 权限：只读 / 可评 / 可编 | middleware + token |
| 7.5 | 首页 Tab 真实数据 | `last_opened_at`、`starred`、`shared_with` 字段 |
| 7.6 | 封面上传 | `POST /api/uploads` + crop UI |
| 7.7 | 模板选择器 Modal | 替代 Slash 只取第一项 |
| 7.8 | 移动端 / 响应式 | 块柄 touch、侧栏抽屉 |

---

## 后续飞书文档完整实现计划（AI 接力版）

> 执行原则：每次只做一个小任务；先读相关文件，再改代码；完成后必须运行 `client` 的 `npm run build`，涉及 API 时再运行 `server` 测试。不要把占位块标记为完成。

### P0：稳定性与数据基线

| 顺序 | 目标 | 关键文件 | 完成标准 |
|------|------|----------|----------|
| P0.1 | 建立完整飞书 UI 对照资料 | `docs/feishu-spec/`、`docs/specs/feishu-table.md` | 表格规格已有；继续补块菜单、Slash、评论、目录截图与尺寸标注 |
| P0.2 | 统一块 ID | `Editor.tsx`、`feishuBlockId.ts`、`blockLink.ts` | ✅ paragraph / heading / list / quote / code / table / columns 等刷新后都有稳定 `data-block-id`；heading / table 历史锚点已收敛 |
| P0.3 | 折叠状态持久化 | `DocumentPage.tsx`、`server/src/database.ts`、`documents.ts` | ✅ 折叠标题刷新后仍保持折叠 |
| P0.4 | 自动保存健壮性 | `Editor.tsx`、`api/documents.ts` | 保存失败有提示；连续输入不丢内容 |
| P0.5 | 复制文档元信息完整性 | `server/src/routes/documents.ts` | ✅ duplicate 已同步复制 `cover_url`、`icon`、`parent_id` 等基础元字段 |

### P1：核心块编辑体验

| 顺序 | 目标 | 关键文件 | 完成标准 |
|------|------|----------|----------|
| P1.1 | 六点柄真实拖拽排序 | `Editor.tsx`、`feishuBlockDrag.ts` | ✅ 段落、标题、列表等同父级块可拖拽换序，撤销可用 |
| P1.2 | 多块选择增强 | `FeishuBoxBlockSelection.tsx`、`boxSelectionModel.ts` | ✅ 已有框选 + 批量删除/复制/移动；支持 Shift 点击扩展范围 |
| P1.3 | 块菜单补齐 | `ContextMenu.tsx`、`insertBelowBlocks.ts` | ✅ 在上方添加、转换类型、保存为模板、转子文档均可用 |
| P1.4 | 右键统一菜单 | `Editor.tsx`、`ContextMenu.tsx` | ✅ 浏览器右键被飞书风格块菜单替代 |

### P2：表格与高级编辑块

| 顺序 | 目标 | 关键文件 | 完成标准 |
|------|------|----------|----------|
| P2.1 | Excel / HTML 表格粘贴增强 | `tableInsert.ts` | 已有基础粘贴；继续补链接、换行、表头、背景色、合并单元格降级策略 |
| P2.2 | 表格复杂重排策略 | `FeishuTableOverlay.tsx`、`tableInsert.ts` | 已有简单表格行列拖拽；复杂表格禁用时有提示或支持安全移动 |
| P2.3 | 表格高级能力 | `panelActions.ts`、`feishuTable.ts` | 冻结首行 / 首列、列宽自适应、更多 tooltip |
| P2.4 | 分栏增强 | `columnsNodeViews.tsx`、`columnsHelpers.ts` | 删除栏、栏重排、分栏转普通块 |
| P2.5 | 公式块真实化 | 公式 NodeView | 支持输入、预览、保存，推荐 KaTeX |

### P3：评论、@ 与协同前置

| 顺序 | 目标 | 关键文件 | 完成标准 |
|------|------|----------|----------|
| P3.1 | 评论回复线程 | `CommentSidebar.tsx`、`database.ts`、`documents.ts` | 评论可回复、解决整条线程 |
| P3.2 | 划词评论 | `SelectionBubble.tsx`、`commentBlockAnchor.ts` | 选中文本可评论，刷新后高亮仍在 |
| P3.3 | @ 人员 | 新建 Mention extension、用户 API | 输入 `@` 可选择用户并渲染 mention |
| P3.4 | 通知占位 | `server` routes、前端提醒入口 | 评论 / @ 产生通知记录 |

### P4：产品化与协作

| 顺序 | 目标 | 关键文件 | 完成标准 |
|------|------|----------|----------|
| P4.1 | 首页真实 Tab | `DocumentList.tsx`、`documents.ts` | 最近、收藏、共享按真实字段过滤 |
| P4.2 | 文档内搜索替换 | `Editor.tsx` | 可搜索、跳转、替换正文内容 |
| P4.3 | 历史版本 | `database.ts`、`documents.ts` | 保存生成版本快照，可查看 / 恢复 |
| P4.4 | 权限模型 | `server` middleware、前端只读态 | 支持只读、可评论、可编辑 |
| P4.5 | Yjs 协同 | `server` WebSocket、`client` y-prosemirror | 双浏览器实时协同编辑 |

### AI 接力注意事项

- **DOM 安全**：所有 hover / leave 的 `relatedTarget` 必须先判断 `instanceof Node`，不能直接传给 `contains()`。
- **React / ProseMirror 边界**：`EditorContent` 必须在正文容器内稳定挂载；块工具、行高亮等 React 浮层只能作为其后的兄弟节点或 Portal，不要在 hover 时插到 `EditorContent` 前面。
- **tippy.js 与 React 共存**：`SelectionBubble` 内部用 `@tiptap/react` 的 `BubbleMenu`，默认会被 tippy portal 到 `document.body`。**禁止**把它放在还会有条件渲染兄弟节点的容器内（如 `.editor-content-area`），否则 React 会用已被搬走的 DOM 作为 `insertBefore` 参考节点而抛 `NotFoundError`。新增任何使用 tippy / popper / portal 的浮层组件时同样需要遵循此规则。
- **ProseMirror 安全**：不要在 `view.update` 中直接改正文 DOM class；需要 DOM 同步时参考 `headingCollapse.ts` / `domObserver.ts` 模式。
- **菜单定位**：Slash 菜单宽度统一使用 `SLASH_MENU_WIDTH`，不要硬编码第二份宽度。
- **表格交互层**：修改表格前先读 `docs/specs/feishu-table.md`；选择轨道、边界插入点、块菜单、选区气泡必须分层处理。
- **分栏节点**：分栏是真实 ProseMirror 节点，插入块时优先参考 `columnsExtensions.ts` / `columnsNodeViews.tsx` / `columnsHelpers.ts`，不要退回静态 HTML 占位。
- **框选多块**：框选状态通过 `boxSelectionStore` 与键盘扩展联动；新增批量操作需同步清理浮层状态。
- **数据持久化**：涉及 UI 状态跨刷新保留时，必须同步更新 `server` 类型、API、前端加载与保存逻辑。
- **验收输出**：每个任务结束需记录改动文件、构建结果、手动验收步骤和未完成风险。

## AI 实施提示（Prompt 模板）

后续让 AI 实现某一阶段时，建议提供：

```text
项目：e:/2026/五月/word（飞书文档复刻）
请阅读 README.md 阶段 N，仅实现任务 N.x。
约束：
- 遵循现有 TipTap 扩展模式（参考 feishuHeading.ts、feishuTableView.ts、FeishuTableOverlay.tsx、columnsNodeViews.tsx）
- 不修改无关文件；不提交 db.json
- ProseMirror DOM 改动需用 domObserver.ts 模式避免死循环
- 完成后列出改动文件与手动验收步骤
```

**常见坑**（已在本项目踩过）：

1. **不要**在 ProseMirror `view.update` 里直接改 DOM class → 用 overlay 或 Decoration。
2. **不要**用文档 pos 作持久 ID → 用 UUID（`headingId` / `blockId`）。
3. **Slash 菜单定位**宽度按 252px 计算（`SLASH_MENU_WIDTH`）。
4. **折叠状态**改 DOM 时用 `withPausedDomObserver`。

---

## 开发记录

| 日期 | 内容 |
|------|------|
| 2026-04-29 | 项目初始化、前后端工程、基础 README |
| 2026-05-14 | 基于实现重写 README，明确差距与路线 |
| 2026-05-20 | 对齐代码现状：表格 NodeView、评论侧栏、标题折叠、目录、块链接、行高亮、退格降级；重写 README 分阶段路线 |
| 2026-05-20 | 修复「+」hover 的 `relatedTarget` 非 Node 报错；补充当前验收状态与 AI 接力完整计划 |
| 2026-05-20 | 二次修复「+」hover 的 `insertBefore` 报错：`EditorContent` 固定先渲染，块工具浮层移到其后，避免 React 与 ProseMirror DOM 锚点冲突 |
| 2026-05-20 | 三次修复「+」hover 的 `insertBefore` 报错：`SelectionBubble`（含 tippy.js，默认 portal 到 body）移出 `.editor-content-area`，避免 React 用已被 tippy 搬走的 DOM 作为 `insertBefore` 参考节点；同时为表格补充「删除当前行 / 当前列」块菜单项 |
| 2026-05-20 | 对齐飞书表格视觉：浅蓝单元格底 / 可见网格 / 标题行加深；`insertFeishuTable` 默认不带表头行并补表尾段落，`TableGridPicker` 默认 3x3 避免误点 1x1 看不出表格 |
| 2026-05-22 | 对齐当前代码状态更新 README：补充表格 Overlay / 表格专项菜单 / 选区气泡表格动作、真实分栏 NodeView、框选多块能力，并调整后续实现计划优先级 |

---

## 许可证

内部学习 / 复刻项目，飞书相关 UI 版权归原产品所有。
