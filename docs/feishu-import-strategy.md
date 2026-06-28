# 飞书文档导入策略

本文档定义本项目从飞书文档进入本地编辑器的导入策略。目标是：优先保留结构化语义，其次保留视觉显示，最后才做纯文本 / HTML 兜底。

## 总体原则

导入飞书文档时必须同时回答三个问题：

1. 能否拿到飞书结构化 block 数据？
2. 能否还原本地 TipTap / Bitable 模型？
3. 如果不能完整还原，用户是否能看到明确 warning？

任何导入结果都不应静默丢失内容。

## 导入链路优先级

### P0：飞书 Open API 结构化导入

适用场景：

- 用户配置了 `FEISHU_APP_ID` 和 `FEISHU_APP_SECRET`。
- 文档链接可解析出 token。
- 应用具备读取文档内容所需权限。

目标：

- 获取文档标题、正文 block、图片 / 附件资源、多维表格结构。
- 将飞书 block 映射到本地 TipTap 节点或 Bitable 模型。
- 对无法映射的 block 输出 `unsupported_blocks`。

相关文件：

- `server/src/import/feishuApiClient.ts`
- `server/src/import/feishuExtractor.ts`
- `server/src/import/bitableMapper.ts`
- `server/src/import/localHtmlEmitter.ts`
- `server/src/feishuPublicImporter.ts`

质量等级：

- 可完整映射时返回 `full`。
- 部分块无法映射但主要内容可用时返回 `partial`。

### P1：公开页面 HTML 解析

适用场景：

- 链接是公开飞书 / Lark 页面。
- 没有 Open API 凭证，或 API 无法读取文档。
- 页面 HTML 中仍能解析标题、正文、图片、表格等可见内容。

目标：

- 优先保留可见内容和视觉结构。
- 从 HTML 中抽取标题、正文、链接、图片和普通表格。
- 对飞书私有结构化块输出 warning。

相关文件：

- `server/src/feishuPublicImporter.ts`
- `server/src/import/publicHtmlIr.ts`
- `server/src/import/localHtmlEmitter.ts`
- `server/src/import/assetPipeline.ts`

质量等级：

- 结构足够完整但缺少私有块数据时返回 `partial`。
- 只能提取普通 HTML 正文时返回 `fallback`。

### P2：飞书导出文件导入

适用场景：

- 用户上传飞书导出的 HTML、Markdown、TXT 或 ZIP。
- 资源文件在 ZIP 中随文档一起导出。

目标：

- 保留 HTML 主体内容。
- 将本地资源复制到 `server/public` 并重写引用。
- Markdown / TXT 转换为基础 HTML。

相关文件：

- `server/src/documentImporter.ts`
- `server/src/routes/documents.ts`

质量等级：

- HTML / ZIP 内容完整时可返回 `partial`。
- Markdown / TXT 仅保留文本结构时返回 `fallback`。

## 导入质量等级

| 等级 | 含义 | 用户提示 |
| --- | --- | --- |
| `full` | 结构化 block 基本完整映射 | 可作为高质量本地文档继续编辑 |
| `partial` | 主要内容可见，部分私有块降级 | 显示 warning 和不支持块列表 |
| `fallback` | 只能保留普通 HTML / 文本 | 明确提示“无法完整识别飞书结构” |

## 本地模型映射规则

### 普通文档块

| 飞书语义 | 本地目标 |
| --- | --- |
| 文档标题 | `Document.title` + 页面标题输入 |
| 段落 | TipTap paragraph |
| 标题 | TipTap heading + `blockId` |
| 有序 / 无序 / 任务列表 | TipTap list / taskList |
| 引用 | blockquote |
| 代码块 | codeBlock + lowlight |
| 图片 | image node / local file block |
| 附件 | localFileBlock |
| 表格 | TipTap table |
| 分栏 | localColumnsBlock |
| 公式 | localFormulaBlock / KaTeX |

### 多维表格

| 飞书语义 | 本地目标 |
| --- | --- |
| Bitable 表 | `BaseTable` |
| 字段 | `BaseField` |
| 记录 | `BaseRecord` |
| Grid 视图 | `BaseView.type = "grid"` |
| Gallery 视图 | `BaseView.type = "gallery"` |
| Kanban 视图 | `BaseView.type = "kanban"` |
| Gantt 视图 | `BaseView.type = "gantt"` |
| 仪表盘 | `localDashboardChartBlock` |

若公开页面无法暴露 Bitable 原始数据，只能根据页面可读内容生成本地近似模型，并必须加入 warning。

## Warning 规则

导入响应应包含：

- `warnings`: 面向用户的导入质量说明。
- `unsupported_blocks`: 无法还原的块类型和原因。
- `import_quality`: `full` / `partial` / `fallback`。
- `asset_count`: 成功导入的资源数量。
- `source_url` / `source_name`: 来源信息。

示例：

```json
{
  "import_quality": "partial",
  "warnings": [
    "公开页面未暴露飞书后端多维表格原始数据，已根据页面可读内容生成本地可编辑多维表格。"
  ],
  "unsupported_blocks": [
    {
      "type": "bitable",
      "reason": "公开页面没有原始 Bitable 数据。"
    }
  ]
}
```

## 验收标准

每次修改导入逻辑后，至少验证：

- 飞书公开链接可创建本地文档。
- 导入失败时返回明确错误，不产生空白文档。
- 资源路径可通过 `/static` 访问。
- HTML 表格导入后仍能在编辑器中编辑。
- warning 能在前端 UI 中被用户看到。
- `server/tests/feishuPublicImporter.test.ts` 通过。

## 不允许的行为

- 不允许导入成功但正文为空且无错误。
- 不允许直接吞掉不支持块。
- 不允许把 `fallback` 结果标记为完整导入。
- 不允许把飞书 token、应用密钥或原始私有数据写入 README 或提交记录。
