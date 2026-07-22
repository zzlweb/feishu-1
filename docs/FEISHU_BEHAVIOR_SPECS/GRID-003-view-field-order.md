# GRID-003：视图独立字段顺序

## 数据契约

- `table.fields` 是字段定义集合，不再承担某个视图的展示顺序。
- `view.fieldOrder` 保存当前视图的字段 ID 顺序。
- 没有 `fieldOrder` 的旧视图继续使用 `table.fields` 顺序，首次重排时再生成视图配置。

## 规范化

1. 主字段始终位于第一列，不能拖动或成为其它字段的放置目标。
2. 重复、已删除或未知字段 ID 在读取时移除。
3. 新增且尚未写入 `fieldOrder` 的字段自动追加，不会消失。
4. 删除字段时同步清理所有视图的 `fieldOrder` 与 `hiddenFieldIds`。
5. 插入左列、插入右列和复制字段按当前视图的相对位置更新顺序。

## 渲染与交互

- Grid 画布和字段配置面板使用同一个 `resolveViewFields` 结果。
- 在视图 A 拖动字段只更新视图 A；切换视图 B 后保持 B 原来的顺序。
- Gallery/Kanban 的卡片可见字段仍由其独立 `visibleFieldIds` 管理。

## 自动化

- `bitableModel.test.ts` 验证跨视图隔离、主字段固定、未知 ID 清理和新字段追加。
