---
description: 高保真复刻飞书文档 UI/交互
---

# 高保真复刻飞书文档 UI/交互工作流

使用场景：当用户要求继续实现或修复飞书文档富文本编辑器 UI/交互时，必须使用本工作流。

## 1. 明确目标

在修改代码前，先确认本次任务属于哪一类：

- 表格交互
- 表格样式
- 表格菜单
- 块柄/拖拽柄
- 浮动工具栏
- Slash 菜单
- 其它飞书文档能力

必须明确：

- 用户截图中的目标状态是什么。
- 当前项目中的错误状态是什么。
- 本次只修哪一个或哪几个明确问题。

## 2. 行为拆解

对于复杂 UI，先拆解而不是直接改代码：

- **默认态**：元素是否显示、背景、边框、阴影、滚动条。
- **Hover 态**：hover 哪个区域会改变什么。
- **Click 态**：点击哪个区域触发什么命令。
- **选中态**：选中后哪些 DOM/CSS 状态变化。
- **菜单态**：菜单打开是否改变块柄、轨道、表格本体样式。
- **事件隔离**：是否需要 `preventDefault` / `stopPropagation`。

输出简短拆解后再实现。

## 3. 查找权威实现位置

修改前必须读取相关文件，禁止猜测：

- 表格 overlay：`client/src/components/Editor/FeishuTableOverlay.tsx`
- 表格 overlay 样式：`client/src/components/Editor/FeishuTableOverlay.less`
- 表格主体样式：`client/src/components/Editor/Editor.less`
- 表格插入工具：`client/src/components/Editor/tableInsert.ts`
- 表格扩展：`client/src/components/Editor/feishuTable.ts`
- 表格菜单：`client/src/components/Editor/TableContextMenu.tsx`

如涉及新区域，再搜索实际入口。

## 4. 实现约束

- 每次只实现用户明确要求的行为。
- 不新增截图外功能。
- 不把选择、插入、拖拽、菜单放在同一个点击区域。
- CSS 修改优先通过明确 class 和层级解决，不滥用全局覆盖。
- 表格行为优先使用 ProseMirror/Tiptap 的真实 selection 或 transaction，不使用纯视觉假选中代替真实选区。

## 5. 表格专项检查

如果任务涉及飞书表格，必须按以下清单检查：

- 顶部灰色轨道：是否只负责列选择。
- 左侧灰色轨道：是否只负责行选择。
- 边界灰点/蓝色加号：是否只负责插入行/列。
- 点击灰色轨道：是否不会触发插入。
- hover 灰点：是否才出现蓝色加号和插入线。
- 点击列选择区：是否整列浅蓝选中，顶部轨道对应段变深蓝。
- 点击行选择区：是否整行浅蓝选中，左侧轨道对应段变深蓝。
- 非选中态：表格是否保持白底。
- 滚动条：是否只属于表格内容滚动区，不属于操作点区域。

## 6. 验证

修改后优先执行：

```powershell
npm run build
```

执行目录：

```text
e:\2026\五月\word\client
```

如果用户取消构建，需要在最终汇报中说明“构建未验证”。

## 7. 汇报格式

最终回复必须包含：

- 修改文件
- 修复行为
- 未验证项或需要用户视觉确认的点

不要长篇解释，不要声称“完美”除非已通过截图/用户确认/构建验证。
