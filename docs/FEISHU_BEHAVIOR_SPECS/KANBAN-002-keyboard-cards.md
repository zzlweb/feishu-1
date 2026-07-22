# KANBAN-002：看板卡片键盘打开

## 目标

看板卡片不依赖指针点击。键盘用户能定位卡片、识别当前状态，并打开同一条记录详情。

## 行为契约

1. 每张可见卡片都是稳定的 Tab 停靠点，暴露 `button` 和 `aria-pressed` 语义。
2. 聚焦卡片时显示与卡片选择态可区分的外部焦点轮廓。
3. `Enter` 和 `Space` 都阻止页面滚动，并打开当前记录详情。
4. 详情打开期间卡片报告 pressed 状态；关闭详情后清除该状态。
5. 卡片内未来新增的独立控件不继承卡片快捷键。

## 验证

- [bitable-kanban.spec.ts](../../client/tests/bitable-kanban.spec.ts) 覆盖聚焦、语义、Enter/Space 打开和 pressed 状态。
