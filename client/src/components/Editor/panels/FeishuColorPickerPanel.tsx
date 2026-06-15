import type { Editor } from '@tiptap/react';
import { selectTextblockContentRange } from '../blocks/blockAnchorSelection';
import { FONT_COLORS, BG_COLORS_LIGHT, BG_COLORS_DEEP } from './colorPickerConstants';
import './FeishuColorPickerPanel.less';

const DEFAULT_FOREGROUND = '#1f2329';

export interface FeishuColorPickerPanelProps {
  editor: Editor;
  /** 选好颜色后的回调（如关闭宿主菜单）；右键菜单可把整菜单关掉 */
  onAfterPick?: () => void;
  /** 在应用颜色前（例如将选区对齐到块柄所指的块） */
  onBeforeApply?: () => void;
}

export default function FeishuColorPickerPanel({ editor, onAfterPick, onBeforeApply }: FeishuColorPickerPanelProps) {
  const currentTextColor = (editor.getAttributes('textStyle').color as string) || '';
  const currentBgColor = (editor.getAttributes('highlight').color as string) || '';

  const notify = () => {
    onAfterPick?.();
  };

  const prepareSelection = () => {
    onBeforeApply?.();
    if (editor.state.selection.empty) {
      selectTextblockContentRange(editor);
    }
  };

  const pickFontColor = (value: string) => {
    prepareSelection();
    if (value) {
      editor.chain().focus().setColor(value).run();
    } else {
      editor.chain().focus().unsetColor().run();
    }
    notify();
  };

  const pickBg = (value: string | undefined, clear: boolean) => {
    prepareSelection();
    if (clear || !value) {
      editor.chain().focus().unsetHighlight().run();
    } else {
      editor.chain().focus().setHighlight({ color: value }).run();
    }
    notify();
  };

  const restoreDefault = () => {
    prepareSelection();
    editor.chain().focus().unsetColor().unsetHighlight().run();
    notify();
  };

  return (
    <div className="feishu-color-panel">
      <div className="feishu-color-panel__section">
        <div className="feishu-color-panel__title">字体颜色</div>
        <div className="feishu-color-panel__font-row">
          {FONT_COLORS.map(c => {
            const selected = (c.value || '') === currentTextColor;
            return (
              <button
                key={c.value || 'default'}
                type="button"
                title={c.label}
                className={`feishu-color-panel__font-btn ${selected ? 'feishu-color-panel__font-btn--selected' : ''}`}
                onMouseDown={e => e.preventDefault()}
                onClick={() => pickFontColor(c.value)}
              >
                <span
                  className="feishu-color-panel__font-a"
                  style={{ color: c.value || DEFAULT_FOREGROUND }}
                >
                  A
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="feishu-color-panel__section">
        <div className="feishu-color-panel__title">背景颜色</div>
        <div className="feishu-color-panel__bg-grid">
          {BG_COLORS_LIGHT.map((c, i) => {
            const isClear = !c.value;
            const selected = isClear ? !currentBgColor : currentBgColor === c.value;
            return (
              <button
                key={`bg-l-${i}`}
                type="button"
                title={isClear ? '无背景' : c.value}
                className={`feishu-color-panel__bg-btn ${isClear ? 'feishu-color-panel__bg-btn--clear' : ''} ${selected ? 'feishu-color-panel__bg-btn--selected' : ''}`}
                style={!isClear ? { backgroundColor: c.value } : undefined}
                onMouseDown={e => e.preventDefault()}
                onClick={() => pickBg(c.value, isClear)}
              />
            );
          })}
          {BG_COLORS_DEEP.map((c, i) => (
            <button
              key={`bg-d-${i}`}
              type="button"
              title={c.value}
              className={`feishu-color-panel__bg-btn ${currentBgColor === c.value ? 'feishu-color-panel__bg-btn--selected' : ''}`}
              style={{ backgroundColor: c.value }}
              onMouseDown={e => e.preventDefault()}
              onClick={() => pickBg(c.value, false)}
            />
          ))}
        </div>
      </div>

      <button
        type="button"
        className="feishu-color-panel__restore"
        onMouseDown={e => e.preventDefault()}
        onClick={restoreDefault}
      >
        恢复默认
      </button>
    </div>
  );
}
