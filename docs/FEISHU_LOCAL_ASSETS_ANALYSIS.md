# 本机飞书前端产物解析记录

更新时间：2026-05-24

本记录来自本机已安装飞书客户端的本地文件。用途是做复刻项目的功能边界、资源路径、模块命名和交互对照，不直接复制飞书私有实现代码。

## 本机位置

| 类型 | 路径 / 进程 |
|---|---|
| 飞书主程序 | `D:\ferishu\Feishu\app\Feishu.exe` |
| 飞书安装目录 | `D:\ferishu\Feishu\app` |
| 核心前端产物目录 | `D:\ferishu\Feishu\app\webcontent` |
| 本地用户数据 | `C:\Users\zzlwe\AppData\Roaming\LarkShell` |
| 运行中进程 | 多个 `Feishu.exe`，另有大量 `msedgewebview2.exe` |

## 产物形态

飞书本地不是源码仓库，而是 Chromium/WebView 外壳 + 打包产物：

- `.asar` 离线包，例如 `space.asar`、`resource.asar`、`main-window.asar`、`messenger.asar`。
- 已展开的 JS/CSS/HTML chunk，例如 `webcontent/docs`、`webcontent/ccm-offline`、`webcontent/bitable`。
- Chromium 缓存和用户数据，例如 `LarkShell\CodeCache`、`LarkShell\Default`。

因此能做的是：

- 分析模块命名、资源入口、页面 chunk、CSS 变量、类名和接口名称。
- 截图测量、DOM/CSS 对照、网络接口形态推断。
- 反推功能拆分和优先级。

不应做的是：

- 直接搬运压缩后的飞书业务代码。
- 把本地缓存当作可维护源码。

## 关键资源目录

| 路径 | 观察 | 对复刻项目价值 |
|---|---|---|
| `webcontent/docs` | 文档选择、绑定文档、doc preview 等前端 chunk | 可对照文档预览、嵌入文档、权限预览 |
| `webcontent/ccm-offline` | 云文档离线/通用能力 chunk，出现 `space_api`、`drive_api`、权限请求等 | 可推导飞书云文档通用 API 和权限模块 |
| `webcontent/bitable` | 多维表格 HTML 入口 | 后续多维表格复刻参考 |
| `webcontent/space.asar` | 云文档空间相关大包，含大量 CSS/JS chunk | 对首页、空间、权限、文件移动、模板、header 价值最大 |
| `webcontent/resource.asar` | 字体、图片、通用前置脚本、主题样式 | 对视觉 token、图标/字体和基础 theme 有价值 |
| `webcontent/main-window.asar` | 主窗口壳层 | 对 WebView、窗口和客户端桥接有价值 |

## 已确认的飞书模块线索

从 `space.asar` 列表和 `ccm-offline` chunk 中能看到这些真实模块名称：

| 模块线索 | 说明 | 映射到本项目 |
|---|---|---|
| `clone_modal` | 复制/克隆文档弹窗 | 复制文档元信息、复制行为补齐 |
| `dnd-move-progress-viewer` | 拖拽移动进度视图 | 块/文件拖拽移动可参考交互层级 |
| `create_wiki_menu_new` | Wiki/空间创建菜单 | 首页/空间树/新建菜单 |
| `apply_edit_permission_modal` | 申请编辑权限弹窗 | 权限模型 P6 |
| `app_share_menu` | 分享菜单 | 分享/权限/协作者 |
| `header_layout` | 文档/空间头部布局 | `DocumentHeader` 对齐 |
| `bear-template-center-external` | 模板中心 | 模板选择器 |
| `menus_create_file` | 创建文件菜单 | 首页新建/Slash 插入子文档 |
| `embedded_index` | 嵌入式入口 | 子文档/嵌入块 |
| `explorer_sidebar_tree` | 侧边树 | 首页/空间树 |
| `ccm-search-sdk-gateway_search-result-item` | 搜索结果项 | 首页搜索/文档内搜索 |
| `clipboard_security` | 剪贴板安全 | 粘贴、复制、块链接 |
| `doc-component-app` / `ccm-scene` headers | 文档组件场景识别 | 后续 API 设计与嵌入场景 |
| Permission actions: `VIEW`, `COMMENT`, `EDIT`, `COPY`, `DUPLICATE`, `MANAGE_HISTORY_RECORD`, `EXPORT` | 真实权限动作枚举 | 本项目权限模型不能只做 readOnly |

## 与当前复刻项目的直接修正

1. 权限模型应按动作拆分  
   飞书不是简单 read/edit，而是 view、comment、edit、copy、duplicate、manage history、export、manage collaborator 等动作。后续 P6 权限表应直接按 action 设计。

2. 首页不是普通文档列表  
   `space.asar` 显示有空间树、Wiki 节点、模板中心、移动进度、搜索结果、上传/导入中心等模块。当前 `DocumentList` 只能算文档列表雏形。

3. 分享与权限要绑定  
   `app_share_menu`、`apply_edit_permission_modal`、permission actions 同时存在，说明分享菜单和权限申请不是孤立 UI。

4. 拖拽移动有进度/状态反馈  
   `dnd-move-progress-viewer` 说明飞书对移动类操作有显式反馈。本项目块拖拽/文档移动后续也应有插入线、进度或 toast。

5. 模板应升级为模板中心  
   `bear-template-center-external` 表明飞书模板不是简单“取第一项”。本项目 Slash 模板和首页模板弹窗需要统一成模板选择器。

6. 剪贴板能力是单独安全模块  
   `clipboard_security` 提醒：复制块、粘贴表格、外部 HTML 粘贴都应有统一 sanitizer/安全策略，而不是散落在各处。

## 可继续深挖的方向

| 方向 | 方法 | 产出 |
|---|---|---|
| 视觉 token | 从 `resource.asar` 提取 `theme.css` 和图片/font 清单 | 色值、字体、图标尺寸 |
| 文档头部 | 分析 `space.asar` 的 `header_layout` CSS chunk | `DocumentHeader` 像素对齐清单 |
| 权限模型 | 从 `ccm-offline` 中提取 permission action 枚举 | server 权限 schema |
| 模板中心 | 检索 `bear-template-center-external` 相关 chunk | 模板弹窗信息架构 |
| 右键/菜单 | 检索 menu/context/popover/action 等 chunk 名称 | 块菜单和首页菜单设计 |
| 运行时 DOM | 通过浏览器/Feishu WebView 远程调试或截图 | `docs/feishu-spec` 实测尺寸 |

## 下一步建议

1. 先把本项目计划里的 P0.1/P0.2 做掉：README 状态纠偏 + 建 `docs/feishu-spec`。
2. 用 `space.asar` 的模块名扩展产品化路线，尤其是权限、分享、模板中心、空间树。
3. 如果要精确复刻像素，需要启动可调试浏览器访问飞书网页版，或提供 Chrome DevTools Protocol 端口；仅靠本地 bundle 很难稳定定位运行时 DOM。
