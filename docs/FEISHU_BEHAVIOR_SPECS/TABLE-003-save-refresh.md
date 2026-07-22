# TABLE-003：普通表格保存与刷新恢复

## 范围

- 表格插入行、合并单元格、背景色、列宽和行高的序列化。
- 通过真实文档 PUT 写入服务端数据库，再用 GET 和页面刷新恢复。

## 数据契约

1. 合并根格保存 `rowspan`、`colspan` 以及合并范围内的富文本内容。
2. 单元格背景色保存为合法 CSS 颜色，刷新后视觉值等价。
3. 列宽通过单元格 `colwidth` 恢复到 `colgroup`，行高通过 `data-row-height`/style 恢复。
4. 自动保存响应成功后再读取服务端内容，不能只断言即时 DOM。
5. 页面刷新后同时验证结构属性、合并内容、背景色和实际计算尺寸。

## 自动化验收

- `client/tests/full-stack/document-persistence.spec.ts`
  - 使用真实 Express 应用和隔离 JSON 数据库创建文档。
  - 浏览器完成插入行、2×2 合并、浅黄背景、列宽和行高调整。
  - 等待真实 PUT 成功，GET 检查序列化 HTML，再刷新检查 DOM 与计算样式。

## 环境要求

- 使用 `npm run test:e2e:full-stack`。
- 当前工作环境未安装 Playwright Chromium；用例已通过 TypeScript 与 Playwright 收集，需在带浏览器的 CI 执行。
