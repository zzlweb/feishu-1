# 飞书文档编辑器复刻项目

一个基于 React、TipTap / ProseMirror 和 Express 的飞书云文档风格编辑器。项目重点复刻飞书文档的块编辑体验、目录、评论、表格、多维表格和公开文档导入能力，适合作为本地学习、原型验证和 AI 接力开发工程。

> 当前项目是单机本地应用原型，不包含真实多用户权限、实时协同和生产级鉴权。

## 核心能力

- 文档管理：文档创建、编辑、删除、复制、子文档、模板、自动保存、阅读 / 编辑模式。
- 富文本编辑：段落、标题、列表、任务列表、引用、代码块、分割线、链接、图片、文件、公式、封面、Emoji 图标。
- 飞书式块交互：左侧块柄、`+` / Slash 插入菜单、块菜单、右键菜单、块链接、块拖拽、框选多块、标题折叠。
- 表格编辑：TipTap 表格、行列选择、插入 / 删除行列、合并 / 拆分单元格、单元格背景色、列宽操作、HTML / TSV 表格粘贴。
- 多维表格：本地 `Bitable` 模型，支持表格、画册、看板、甘特、字段配置、记录详情、附件、评论、仪表盘图表等本地交互。
- 目录与评论：左侧目录、当前章节高亮、块级评论、评论侧栏、评论定位和解决状态。
- 导入能力：支持飞书公开链接导入、飞书导出 HTML / Markdown / TXT / ZIP 文件导入，并对部分公开样例做本地结构化还原。

## 还原目标文档

本项目的核心目标是：在本地项目中显示飞书文档，并尽量还原飞书的文档内容、UI、布局和交互效果。后续 UI、导入和 Bitable 相关开发优先参考：

- `docs/feishu-rendering-spec.md`：飞书文档显示与 UI 还原规范。
- `docs/feishu-import-strategy.md`：飞书公开链接、Open API、导出文件的导入策略。
- `docs/feishu-parity-roadmap.md`：按阶段修复导入、普通文档显示、浮层系统和 Bitable 的路线图。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 前端 | React 18、TypeScript、Vite、React Router |
| 编辑器 | TipTap 2、ProseMirror、自定义 Extension / NodeView |
| UI / 样式 | Less、tdesign-react、tdesign-icons-react、KaTeX、lowlight |
| 后端 | Node.js、Express、TypeScript、tsx |
| 存储 | JSON 文件数据库，默认 `server/data/db.json` |
| 上传 / 导入 | multer、marked、node-html-parser、jszip |
| 测试 | Node test runner、Playwright |

## 快速开始

项目没有根目录 `package.json`，前后端依赖和脚本分别在 `client/`、`server/` 下维护。建议使用 Node.js 18+。

### 1. 安装依赖

```bash
cd server
npm install

cd ../client
npm install
```

### 2. 配置环境变量

后端可选配置飞书开放平台凭证：

```bash
cd server
cp .env.example .env
```

`server/.env` 支持：

```env
FEISHU_APP_ID=
FEISHU_APP_SECRET=
# FEISHU_OPEN_API_BASE_URL=https://open.feishu.cn
# FEISHU_DOC_DB_PATH=./data/db.json
# PORT=3000
```

没有飞书凭证时，基础文档编辑、上传、模板、本地导入仍可使用；需要调用飞书开放平台 API 的导入能力会受限。

### 3. 启动开发服务

分别启动后端和前端：

```bash
# 后端：http://localhost:3000
cd server
npm run dev

# 前端：http://localhost:5175
cd client
npm run dev
```

前端 Vite 已代理 `/api` 和 `/static` 到后端 `http://localhost:3000`。

## 常用命令

### 前端

```bash
cd client
npm run dev        # Vite 开发服务，端口 5175
npm run build      # TypeScript 构建 + Vite 生产构建
npm run preview    # 预览构建产物，端口 5174
npm run test:e2e   # Playwright 端到端测试
```

### 后端

```bash
cd server
npm run dev        # 释放 3000 端口并启动 tsx watch
npm run build      # TypeScript 编译
npm start          # 运行 dist/index.js
npm test           # API、编码、飞书导入相关测试
npm run free-port  # 释放 3000 端口
```

## 项目结构

```text
.
├── client/
│   ├── src/
│   │   ├── api/                    # 前端 API 封装
│   │   ├── components/
│   │   │   ├── DocumentEditor/      # 编辑器公共入口与分层说明
│   │   │   ├── Bitable/             # 多维表格模型、视图、字段、记录弹窗、仪表盘
│   │   │   ├── DocumentList/        # 首页文档列表
│   │   │   ├── Editor/              # TipTap 编辑器、块扩展、菜单、表格、媒体
│   │   │   └── Layout/              # 文档页、顶栏、目录、评论侧栏
│   │   ├── icons/                   # 飞书风格 SVG 图标
│   │   ├── types/                   # 前端共享类型
│   │   ├── App.tsx                  # 路由入口
│   │   └── main.tsx
│   ├── tests/                       # Playwright 用例
│   ├── vite.config.ts
│   └── package.json
├── server/
│   ├── src/
│   │   ├── app.ts                   # Express app 与路由挂载
│   │   ├── index.ts                 # 服务启动与 .env 加载
│   │   ├── database.ts              # JSON 文件数据库
│   │   ├── documentImporter.ts      # 导出文件导入
│   │   ├── feishuPublicImporter.ts  # 飞书公开链接导入
│   │   ├── import/                  # 飞书 API / HTML IR / 资源管线
│   │   ├── fixtures/                # 本地样例与业务周报模板
│   │   └── routes/                  # documents、uploads API
│   ├── tests/                       # 后端测试
│   ├── public/                      # 静态资源与上传文件
│   ├── data/db.json                 # 默认本地数据文件
│   └── package.json
└── docs/
    └── public-feishu-docs.json      # 公开飞书样例清单
```

## 主要模块说明

### 编辑器

编辑器主入口在 `client/src/components/Editor/Editor.tsx`。核心扩展和交互拆在：

- `blocks/feishuBlockId.ts`：为可操作块补稳定 `blockId`。
- `blocks/feishuBlockBackspace.ts`：飞书式空块退格降级。
- `blocks/feishuBlockDrag.ts`：块拖拽排序。
- `blocks/FeishuBoxBlockSelection.tsx`、`blocks/boxSelectionModel.ts`：框选多块。
- `menus/SlashMenu.tsx`、`menus/ContextMenu.tsx`：插入菜单和块菜单。
- `tables/`：表格扩展、Overlay、菜单、选择工具栏和表格粘贴。
- `media/`：图片、文件块、图片裁剪和媒体上下文菜单。

### 多维表格

多维表格入口在 `client/src/components/Bitable/BitableBlockView.tsx`。目录约定：

- `model/`：本地多维表格数据结构、字段、记录、视图配置。
- `views/`：Grid、Gallery、Kanban、Gantt 视图。
- `fields/`：字段类型选择、字段编辑、选项编辑。
- `records/`：记录详情弹窗、记录评论、记录菜单。
- `shared/`：通用展示组件和浮层工具。
- `dashboard/`：从多维表格数据生成本地仪表盘图表。

### 文档页与侧栏

`client/src/components/Layout/DocumentPage.tsx` 负责加载文档、保存、评论、目录、标题折叠状态和阅读模式。左侧目录在 `Sidebar.tsx`，评论侧栏在 `CommentSidebar.tsx`。

### 后端 API

后端入口为 `server/src/app.ts`，主要路由：

- `GET /api/health`
- `GET /api/documents`
- `POST /api/documents`
- `GET /api/documents/:id`
- `PUT /api/documents/:id`
- `DELETE /api/documents/:id`
- `POST /api/documents/:id/duplicate`
- `POST /api/documents/:id/children`
- `POST /api/documents/:id/to-child`
- `GET /api/documents/:id/comments`
- `POST /api/documents/:id/comments`
- `PATCH /api/documents/:id/comments/:commentId`
- `DELETE /api/documents/:id/comments/:commentId`
- `GET /api/documents/templates/list`
- `POST /api/documents/templates`
- `DELETE /api/documents/templates/:templateId`
- `POST /api/documents/:id/save-as-template`
- `POST /api/documents/import`
- `POST /api/documents/import-url`
- `POST /api/uploads`

API 响应基本使用：

```json
{ "code": 0, "data": {} }
```

错误响应：

```json
{ "code": -1, "message": "错误信息" }
```

## 数据与静态资源

- 默认数据文件：`server/data/db.json`
- 可用 `FEISHU_DOC_DB_PATH` 指定其他 JSON 数据文件。
- 上传文件与导入资源存放在 `server/public` 下，并通过 `/static` 暴露。
- 上传和导入接口限制单文件 200MB。
- `client/dist` 是前端构建产物，不建议提交为源码变更的一部分。

## 测试说明

后端测试：

```bash
cd server
npm test
```

前端端到端测试：

```bash
cd client
npm run build
npm run preview
npm run test:e2e
```

Playwright 默认访问 `http://127.0.0.1:5174`，可用 `PLAYWRIGHT_BASE_URL` 覆盖。
多数 E2E 用例会 mock API，但仍需要 `npm run preview` 或 `npm run dev` 提供前端页面。

## 部署说明

当前前后端未做一体化部署：后端只提供 API 和 `/static` 静态资源，不托管 `client/dist`，也没有 SPA fallback。生产部署时需要分别部署前端构建产物和后端服务，或自行在 Express 中补充静态资源托管。

## 当前限制

- 没有真实登录、组织、权限 ACL 和分享授权。
- 没有 Yjs / WebSocket 实时协同。
- 文档正文以 HTML 存储，块模型是本地复刻方案，不等同于飞书真实后端协议。
- 飞书公开文档导入依赖公开页面可见结构；无法保证还原所有飞书私有块数据。
- 多维表格是本地实现，重点覆盖展示和编辑体验，不是飞书 Bitable API 的完整实现。
- 部分高级块仍是本地模拟或阶段性实现，例如同步块、复杂权限、完整通知体系。

## 开发注意事项

- 任何 UI 还原或导入修复都应先对照 `docs/feishu-rendering-spec.md` 和 `docs/feishu-import-strategy.md`，避免只针对单张截图做临时 CSS。
- 修改 TipTap / ProseMirror 相关逻辑时，优先复用现有扩展和工具函数，不要直接在 `view.update` 中随意改正文 DOM。
- 新增浮层时注意 React、Tippy、Portal 与 ProseMirror DOM 的边界，避免把会 portal 的节点放在容易被条件渲染重排的容器内。
- 块操作应优先基于稳定 `blockId` 或可靠的 DOM → ProseMirror 节点解析，不要把文档位置 `pos` 当持久 ID。
- 多维表格、表格菜单和记录弹窗有大量 portaled UI，新增浮层样式时需要使用全局 `--portal` 类名，避免样式被块内作用域限制。
- 数据结构变更需要同时更新 `server/src/database.ts`、前端类型和保存 / 加载逻辑。
- 不要随意提交本地 `server/data/db.json` 或 `client/dist` 产物；测试数据建议用 `FEISHU_DOC_DB_PATH` 隔离。
- 提交前尽量运行受影响范围的 `npm run build`、`npm test` 或 Playwright 用例。

## 许可证

内部学习 / 复刻项目。飞书相关 UI 与产品设计版权归原产品所有，本项目仅用于技术研究和本地原型验证。
