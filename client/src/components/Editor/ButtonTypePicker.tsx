import type { Editor } from '@tiptap/react';
import { insertButtonBlockFromSlash, type ButtonActionType } from './slashMenuConfig';

interface ButtonTypePickerProps {
  editor?: Editor;
  onPick: () => void;
  onPickType?: (type: ButtonActionType) => void;
}

const BUTTON_TYPES: Array<{
  type: ButtonActionType;
  name: string;
  label: string;
  icon: string;
}> = [
  {
    type: 'link',
    name: 'OpenLink',
    label: '打开超链接',
    icon: 'M3 7h18a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2v-2H3V7ZM12 9a5 5 0 0 0 0 10h1a1 1 0 1 0 0-2h-1a3 3 0 0 1 0-6h1a1 1 0 1 0 0-2h-1Zm6 10a5 5 0 0 0 0-10h-1a1 1 0 1 0 0 2h1a3 3 0 0 1 0 6h-1a1 1 0 1 0 0 2h1ZM12 14c0-.552.54-1 1-1h4c.46 0 1 .448 1 1s-.54 1-1 1h-4c-.46 0-1-.448-1-1Z',
  },
  {
    type: 'duplicate',
    name: 'DuplicatePage',
    label: '创建副本',
    icon: 'M12 11h6v9h-6v-9Zm-.5-2a1.5 1.5 0 0 0-1.5 1.5v10a1.5 1.5 0 0 0 1.5 1.5h7a1.5 1.5 0 0 0 1.5-1.5v-10A1.5 1.5 0 0 0 18.5 9h-7ZM13 8a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2V8h-8ZM4 4h18a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h4v-2H4V4Z',
  },
  {
    type: 'follow',
    name: 'FollowPage',
    label: '关注文档更新',
    icon: 'M16.025 16.957a1 1 0 0 1 .95 0L20 18.591V9h-7v9.59l3.025-1.633Zm.944 2.357a1 1 0 0 0-.938 0L13.3 20.766a1.5 1.5 0 0 1-2.3-1.27V9a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v10.497a1.5 1.5 0 0 1-2.3 1.269l-2.73-1.452ZM4 5h18a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h5v-2H4V5Z',
  },
];

export default function ButtonTypePicker({ editor, onPick, onPickType }: ButtonTypePickerProps) {
  const handlePick = (type: ButtonActionType) => {
    if (onPickType) onPickType(type);
    else if (editor) insertButtonBlockFromSlash(editor, type);
    onPick();
  };

  return (
    <div className="docx-menu-container slash-button-type-picker">
      <div className="menu-title-item panel-menu-item" data-name="选择按钮类型">选择按钮类型</div>
      {BUTTON_TYPES.map(item => (
        <div
          key={item.type}
          className="panel-menu-item"
          data-name={item.name}
          role="button"
          tabIndex={0}
          onMouseDown={event => event.preventDefault()}
          onClick={() => handlePick(item.type)}
        >
          <div className="menu-item-content">
            <div className="menu-icon show-icon-color">
              <span className="universe-icon menu_ud_icon color-i-500">
                <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d={item.icon} fill="currentColor" />
                </svg>
              </span>
            </div>
            <div className="menu-item-main-box-wrapper">
              <div className="menu-item-main-box">
                <div className="menu-text">{item.label}</div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
