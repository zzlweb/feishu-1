# 飞书 UI / 交互对照资料

更新时间：2026-05-24

本目录用于沉淀飞书官方客户端 / 网页的截图、DOM/CSS 尺寸、交互说明和本项目验收标准。后续每做一个复刻任务，先查这里，再改代码。

## 资料来源

| 来源 | 用法 | 状态 |
|---|---|---|
| 本机飞书安装包 `D:\ferishu\Feishu\app\webcontent` | 解析模块名、入口、资源、CSS chunk | 已建立索引，见 `../FEISHU_LOCAL_ASSETS_ANALYSIS.md` |
| 运行中的飞书网页 / 客户端 DOM | 采集真实尺寸、class、层级、交互状态 | 待接入 CDP 或手动截图 |
| 本项目运行页 | 与飞书截图并排验收 | 待补 Playwright 截图 |

## 采集清单

| 编号 | 对照项 | 需要采集 | 本项目相关文件 |
|---|---|---|---|
| S0.1 | 块菜单 | 宽度、高度、图标区、分割线、hover、子菜单 flyout、disabled tooltip | `ContextMenu.tsx`, `ContextMenu.less` |
| S0.2 | Slash 菜单 | 触发位置、宽度、分类、搜索、键盘导航、滚动、空状态 | `SlashMenu.tsx`, `slashMenuConfig.ts`, `SlashMenu.less` |
| S0.3 | 左侧块柄 | `+` / 六点柄位置、hover 行高亮、拖拽插入线、折叠箭头 | `Editor.tsx`, `BlockGutterGlyph.tsx`, `headingCollapse.ts` |
| S0.4 | 表格 | 轨道、灰点、插入线、选区、行列拖拽、选区气泡、冻结行列 | `FeishuTableOverlay.tsx`, `feishuTable.ts`, `tableInsert.ts` |
| S0.5 | 评论 | 块级评论、划词评论、回复线程、解决态、锚点丢失态、侧栏定位 | `CommentSidebar.tsx`, `commentBlockAnchor.ts` |
| S0.6 | 目录 | 标题层级、当前章节高亮、折叠状态、滚动同步 | `Sidebar.tsx`, `feishuHeading.ts` |
| S0.7 | 文档头部 | 分享、权限、更多菜单、模板、收藏、历史入口 | `DocumentHeader.tsx` |
| S0.8 | 首页 / 空间 | 最近、收藏、共享、空间树、模板中心、搜索、文件移动 | `DocumentList.tsx` |
| S0.9 | 权限 | view/comment/edit/copy/duplicate/export/history 等动作级状态 | server routes, future ACL |

## 命名约定

截图建议按以下格式保存：

```text
<编号>-<模块>-<状态>-<日期>.png
```

示例：

```text
S0.1-block-menu-hover-2026-05-24.png
S0.4-table-selection-bubble-2026-05-24.png
```

## 验收记录模板

```md
### S?.? 模块名

- 来源：
- 日期：
- 飞书截图：
- 本项目截图：
- 关键尺寸：
- 关键颜色：
- 交互状态：
- 当前差距：
- 对应任务：
```
