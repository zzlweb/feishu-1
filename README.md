# 飞书文档编辑器 (Feishu Doc Editor)

> 完整还原飞书多维表格中 Word 文档编辑的全部功能

## 📋 项目概述

本项目旨在完整复刻飞书（Lark）文档编辑器的核心功能，包括富文本编辑、文档管理、格式化工具栏、右键菜单等全部特性。

## 🏗️ 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React 18 + TypeScript |
| 富文本编辑器 | TipTap (基于 ProseMirror) |
| 前端构建 | Vite |
| UI 样式 | CSS Modules + 自定义主题 |
| 后端框架 | Node.js + Express + TypeScript |
| 数据库 | SQLite (better-sqlite3) |
| API 规范 | RESTful JSON API |

## ✅ 功能清单与实现计划

### 第一阶段：基础架构 ✅
- [x] 项目工程搭建（前后端分离）
- [x] README 文档与开发计划

### 第二阶段：后端服务
- [x] Express 服务器搭建
- [x] SQLite 数据库初始化
- [x] 文档 CRUD RESTful API
  - POST /api/documents — 创建文档
  - GET /api/documents — 获取文档列表
  - GET /api/documents/:id — 获取单个文档
  - PUT /api/documents/:id — 更新文档
  - DELETE /api/documents/:id — 删除文档

### 第三阶段：前端编辑器核心
- [x] TipTap 富文本编辑器集成
- [x] 标题输入（请输入标题）
- [x] 作者信息展示
- [x] 文档自动保存

### 第四阶段：格式化工具栏
- [x] 标题级别切换（T, H1, H2, H3, H4, H5）
- [x] 粗体 (Bold)
- [x] 删除线 (Strikethrough)
- [x] 斜体 (Italic)
- [x] 下划线 (Underline)
- [x] 链接 (Link)
- [x] 行内代码 (Code)
- [x] 字体颜色 (Font Color)
- [x] 有序列表 / 无序列表
- [x] 待办事项（Checkbox / TaskList）
- [x] 代码块 (Code Block)
- [x] 引用块 (Blockquote)
- [x] 分割线

### 第五阶段：右键上下文菜单
- [x] 缩进和对齐
- [x] 颜色设置
- [x] 评论
- [x] 剪切 / 复制 / 删除
- [x] 转换为子文档
- [x] 保存为模板
- [x] 复制链接
- [x] 在下方添加

### 第六阶段：文档管理
- [x] 文档列表页面
- [x] 左侧目录大纲导航
- [x] 面包屑导航
- [x] 分享功能（链接复制）
- [x] 编辑 / 阅读模式切换

### 第七阶段：完善与优化
- [x] 响应式布局
- [x] 飞书风格 UI 主题
- [x] 键盘快捷键支持

## 🚀 快速开始

### 安装依赖

```bash
# 安装后端依赖
cd server
npm install

# 安装前端依赖
cd ../client
npm install
```

### 启动开发环境

```bash
# 启动后端服务 (端口 3001)
cd server
npm run dev

# 启动前端开发服务器 (端口 5173)
cd ../client
npm run dev
```

### 访问

打开浏览器访问 http://localhost:5173

## 📁 项目结构

```
word/
├── README.md
├── server/                  # 后端服务
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts         # 服务器入口
│       ├── database.ts      # 数据库初始化
│       └── routes/
│           └── documents.ts # 文档 API 路由
├── client/                  # 前端应用
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/
│       │   └── documents.ts
│       ├── components/
│       │   ├── Editor/
│       │   │   ├── Editor.tsx
│       │   │   ├── Editor.css
│       │   │   ├── Toolbar.tsx
│       │   │   ├── Toolbar.css
│       │   │   ├── ContextMenu.tsx
│       │   │   └── ContextMenu.css
│       │   ├── DocumentList/
│       │   │   ├── DocumentList.tsx
│       │   │   └── DocumentList.css
│       │   └── Layout/
│       │       ├── Layout.tsx
│       │       ├── Layout.css
│       │       ├── Sidebar.tsx
│       │       └── Breadcrumb.tsx
│       ├── types/
│       │   └── index.ts
│       └── styles/
│           └── global.css
```

## 📝 开发日志

| 日期 | 完成内容 |
|------|----------|
| 2026-04-29 | 项目初始化、工程搭建、README 编写 |
