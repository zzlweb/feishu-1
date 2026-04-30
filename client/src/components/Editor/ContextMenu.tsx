import { useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import type { Editor } from '@tiptap/react';
import {
  FontSize,
  H1,
  H2,
  H3,
  ListTwo,
  OrderedList,
  CheckCorrect,
  CodeBrackets,
  Quote,
  GridNine,
  AlignTextBoth,
  Paint,
  CuttingOne,
  Copy,
  Translate,
  Delete,
  ShareThree,
  NotebookAndPen,
  Bookmark,
  CopyLink,
  AddFour,
  AlignTextLeft,
  AlignTextCenter,
  AlignTextRight,
  AlignTextBothOne,
  IndentRight,
  IndentLeft,
} from '@icon-park/react';
import './ContextMenu.less';

interface ContextMenuProps {
  editor: Editor;
  x: number;
  y: number;
  onClose: () => void;
}

const ICON_CFG = { theme: 'outline' as const, strokeWidth: 3 };

type RowKind = 'heading' | 'block' | 'noop';

type DocIcon = ComponentType<any>;

interface GridRowDef {
  label: string;
  value: number | string;
  type: RowKind;
  Icon: DocIcon;
}

const ROW_1: GridRowDef[] = [
  { label: '正文', value: 0, type: 'heading', Icon: FontSize },
  { label: '一级标题', value: 1, type: 'heading', Icon: H1 },
  { label: '二级标题', value: 2, type: 'heading', Icon: H2 },
  { label: '三级标题', value: 3, type: 'heading', Icon: H3 },
  { label: '无序列表', value: 'bulletList', type: 'block', Icon: ListTwo },
  { label: '有序列表', value: 'orderedList', type: 'block', Icon: OrderedList },
];

const ROW_2: GridRowDef[] = [
  { label: '待办事项', value: 'taskList', type: 'block', Icon: CheckCorrect },
  { label: '代码块', value: 'codeBlock', type: 'block', Icon: CodeBrackets },
  { label: '引用', value: 'blockquote', type: 'block', Icon: Quote },
  { label: '表格', value: 'noopTable', type: 'noop', Icon: GridNine },
];

const ALIGN_OPTIONS = [
  { label: '左对齐', value: 'left', Icon: AlignTextLeft },
  { label: '居中对齐', value: 'center', Icon: AlignTextCenter },
  { label: '右对齐', value: 'right', Icon: AlignTextRight },
  { label: '两端对齐', value: 'justify', Icon: AlignTextBothOne },
];

const TEXT_COLORS = [
  { label: '默认', value: '' },
  { label: '红色', value: '#d83931' },
  { label: '橙色', value: '#de7802' },
  { label: '绿色', value: '#21a121' },
  { label: '蓝色', value: '#245bdb' },
  { label: '紫色', value: '#6425d0' },
];

function isGridActive(editor: Editor, item: GridRowDef): boolean {
  if (item.type === 'heading') {
    if (item.value === 0) return editor.isActive('paragraph');
    return editor.isActive('heading', { level: item.value as 1 | 2 | 3 });
  }
  if (item.type === 'block') return editor.isActive(item.value as string);
  return false;
}

export default function ContextMenu({ editor, x, y, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [subMenu, setSubMenu] = useState<string | null>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const adjustedX = Math.min(x, window.innerWidth - 260);
  const adjustedY = Math.min(y, window.innerHeight - 420);

  const setHeading = (level: number) => {
    if (level === 0) {
      editor.chain().focus().setParagraph().run();
    } else {
      editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 }).run();
    }
    onClose();
  };

  const toggleBlock = (type: string) => {
    switch (type) {
      case 'bulletList':
        editor.chain().focus().toggleBulletList().run();
        break;
      case 'orderedList':
        editor.chain().focus().toggleOrderedList().run();
        break;
      case 'taskList':
        editor.chain().focus().toggleTaskList().run();
        break;
      case 'codeBlock':
        editor.chain().focus().toggleCodeBlock().run();
        break;
      case 'blockquote':
        editor.chain().focus().toggleBlockquote().run();
        break;
      case 'horizontalRule':
        editor.chain().focus().setHorizontalRule().run();
        break;
    }
    onClose();
  };

  const setAlign = (align: string) => {
    editor.chain().focus().setTextAlign(align).run();
    onClose();
  };

  const handleCut = () => {
    document.execCommand('cut');
    onClose();
  };

  const handleCopy = () => {
    document.execCommand('copy');
    onClose();
  };

  const handleDelete = () => {
    editor.chain().focus().deleteSelection().run();
    onClose();
  };

  const handleIndent = () => {
    if (editor.isActive('listItem')) {
      editor.chain().focus().sinkListItem('listItem').run();
    }
    onClose();
  };

  const handleOutdent = () => {
    if (editor.isActive('listItem')) {
      editor.chain().focus().liftListItem('listItem').run();
    }
    onClose();
  };

  const gridIconFill = (active: boolean) => (active ? '#ffffff' : '#1f2329');

  const handleGridClick = (item: GridRowDef) => {
    if (item.type === 'heading') setHeading(item.value as number);
    else if (item.type === 'block') toggleBlock(item.value as string);
    else onClose();
  };

  return (
    <div ref={menuRef} className="context-menu context-menu-feishu" style={{ left: adjustedX, top: adjustedY }}>
      <div className="context-menu-section context-menu-section--grid">
        <div className="context-block-types">
          {ROW_1.map(item => {
            const active = isGridActive(editor, item);
            const Icon = item.Icon;
            return (
              <button
                key={`r1-${item.value}`}
                type="button"
                className={`context-block-btn ${active ? 'active' : ''}`}
                title={item.label}
                onClick={() => handleGridClick(item)}
              >
                <Icon {...ICON_CFG} size={15} fill={gridIconFill(active)} />
              </button>
            );
          })}
        </div>
        <div className="context-block-types">
          {ROW_2.map(item => {
            const active = isGridActive(editor, item);
            const Icon = item.Icon;
            return (
              <button
                key={`r2-${item.value}`}
                type="button"
                className={`context-block-btn ${active ? 'active' : ''}`}
                title={item.label}
                onClick={() => handleGridClick(item)}
              >
                <Icon {...ICON_CFG} size={15} fill={gridIconFill(active)} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="context-menu-divider" />

      <div
        className="context-menu-item has-submenu"
        onMouseEnter={() => setSubMenu('align')}
        onMouseLeave={() => setSubMenu(null)}
      >
        <span className="context-menu-icon">
          <AlignTextBoth {...ICON_CFG} size={16} fill="#646a73" />
        </span>
        <span>缩进和对齐</span>
        <span className="context-menu-arrow">›</span>
        {subMenu === 'align' && (
          <div className="context-submenu">
            <button type="button" className="context-menu-item" onClick={handleIndent}>
              <span className="context-menu-icon">
                <IndentRight {...ICON_CFG} size={16} fill="#646a73" />
              </span>
              <span>增加缩进</span>
            </button>
            <button type="button" className="context-menu-item" onClick={handleOutdent}>
              <span className="context-menu-icon">
                <IndentLeft {...ICON_CFG} size={16} fill="#646a73" />
              </span>
              <span>减少缩进</span>
            </button>
            <div className="context-menu-divider" />
            {ALIGN_OPTIONS.map(a => (
              <button key={a.value} type="button" className="context-menu-item" onClick={() => setAlign(a.value)}>
                <span className="context-menu-icon">
                  <a.Icon {...ICON_CFG} size={16} fill="#646a73" />
                </span>
                <span>{a.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        className="context-menu-item has-submenu"
        onMouseEnter={() => setSubMenu('color')}
        onMouseLeave={() => setSubMenu(null)}
      >
        <span className="context-menu-icon">
          <Paint {...ICON_CFG} size={16} fill="#646a73" />
        </span>
        <span>颜色</span>
        <span className="context-menu-arrow">›</span>
        {subMenu === 'color' && (
          <div className="context-submenu">
            {TEXT_COLORS.map(c => (
              <button
                key={c.value || 'default'}
                type="button"
                className="context-menu-item"
                onClick={() => {
                  if (c.value) {
                    editor.chain().focus().setColor(c.value).run();
                  } else {
                    editor.chain().focus().unsetColor().run();
                  }
                  onClose();
                }}
              >
                <span className="context-color-dot" style={{ backgroundColor: c.value || '#1f2329' }} />
                <span>{c.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="context-menu-divider" />

      <button type="button" className="context-menu-item" onClick={handleCut}>
        <span className="context-menu-icon">
          <CuttingOne {...ICON_CFG} size={16} fill="#646a73" />
        </span>
        <span style={{ flex: 1 }}>剪切</span>
        <span className="context-menu-shortcut">Ctrl+X</span>
      </button>
      <button type="button" className="context-menu-item" onClick={handleCopy}>
        <span className="context-menu-icon">
          <Copy {...ICON_CFG} size={16} fill="#646a73" />
        </span>
        <span style={{ flex: 1 }}>复制</span>
        <span className="context-menu-shortcut">Ctrl+C</span>
      </button>
      <div className="context-menu-item has-submenu">
        <span className="context-menu-icon">
          <Translate {...ICON_CFG} size={16} fill="#646a73" />
        </span>
        <span style={{ flex: 1 }}>翻译</span>
        <span className="context-menu-arrow">›</span>
      </div>
      <button type="button" className="context-menu-item" onClick={handleDelete}>
        <span className="context-menu-icon">
          <Delete {...ICON_CFG} size={16} fill="#d83931" />
        </span>
        <span style={{ flex: 1, color: '#d83931' }}>删除</span>
        <span className="context-menu-shortcut">Del</span>
      </button>

      <div className="context-menu-divider" />

      <button type="button" className="context-menu-item" onClick={onClose}>
        <span className="context-menu-icon">
          <ShareThree {...ICON_CFG} size={16} fill="#646a73" />
        </span>
        <span style={{ flex: 1 }}>分享</span>
      </button>
      <button type="button" className="context-menu-item" onClick={onClose}>
        <span className="context-menu-icon">
          <NotebookAndPen {...ICON_CFG} size={16} fill="#646a73" />
        </span>
        <span style={{ flex: 1 }}>转换为子文档</span>
      </button>
      <button type="button" className="context-menu-item" onClick={onClose}>
        <span className="context-menu-icon">
          <Bookmark {...ICON_CFG} size={16} fill="#646a73" />
        </span>
        <span style={{ flex: 1 }}>保存为模板</span>
      </button>
      <button type="button" className="context-menu-item" onClick={onClose}>
        <span className="context-menu-icon">
          <CopyLink {...ICON_CFG} size={16} fill="#646a73" />
        </span>
        <span style={{ flex: 1 }}>复制链接</span>
      </button>

      <div className="context-menu-divider" />

      <div
        className="context-menu-item has-submenu"
        onMouseEnter={() => setSubMenu('addBelow')}
        onMouseLeave={() => setSubMenu(null)}
      >
        <span className="context-menu-icon">
          <AddFour {...ICON_CFG} size={16} fill="#646a73" />
        </span>
        <span style={{ flex: 1 }}>在下方添加</span>
        <span className="context-menu-arrow">›</span>
        {subMenu === 'addBelow' && (
          <div className="context-submenu">
            <button
              type="button"
              className="context-menu-item"
              onClick={() => {
                editor.chain().focus().insertContentAt(editor.state.selection.to, '<p></p>').run();
                onClose();
              }}
            >
              <span>正文</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
