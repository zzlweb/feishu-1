# OVERLAY-001 / 统一浮层行为

## 用户目标

用户打开菜单、Popover 或 Dialog 后，可以用一致的方式关闭并回到原操作位置。

## 飞书参照

- Esc 只关闭最上层浮层。
- 点击最上层浮层之外关闭该浮层。
- 点击浮层内部或其锚点不关闭。
- 关闭后焦点回到打开浮层的控件。
- Dialog 内 Tab 循环，不进入背后页面。

## 当前问题

各业务组件分别监听 `document`，同一次 Esc 或外点可能触发多个关闭回调，焦点返回不稳定。

## 范围

- 应用级 `OverlayProvider`。
- 按注册顺序维护浮层栈。
- 统一 Esc、Outside pointer 和焦点返回。
- 现有块、图片、表格和 Bitable 右键菜单接入统一注册。

## 不在范围

- 本任务不重写每个业务浮层的定位算法。
- TDesign 内部浮层在迁移前继续使用其原生焦点实现。

## 交互合同

1. Escape 事件被业务代码 `preventDefault` 后不关闭。
2. 未被阻止的 Escape 只关闭栈顶且允许 Esc 的浮层。
3. Outside pointer 只检查栈顶浮层。
4. 关闭卸载后，在下一帧把焦点还给锚点，且不滚动页面。
5. 组件脱离应用 Provider 单独渲染时保留等价降级行为。

## 修改文件

- `client/src/shared/overlay/OverlayProvider.tsx`
- `client/src/components/Editor/shared/FloatingMenuShell.tsx`

## 测试

- Client TypeScript build。
- 现有菜单 E2E 回归。
- 后续新增栈顶 Esc、外点和焦点返回的浏览器测试。

## 回滚

移除应用 Provider，并恢复 `FloatingMenuShell` 的局部 `keydown` / `mousedown` 监听。

