import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import './ContextMenu.less';

interface ContextMenuProps {
  editor: Editor;
  x: number;
  y: number;
  onClose: () => void;
}

const HEADING_LEVELS = [
  { label: 'T 正文', value: 0, icon: 'T' },
  { label: 'H1', value: 1, icon: 'H1' },
  { label: 'H2', value: 2, icon: 'H2' },
  { label: 'H3', value: 3, icon: 'H3' },
  { label: 'H4', value: 4, icon: 'H4' },
  { label: 'H5', value: 5, icon: 'H5' },
];

const BLOCK_TYPES = [
  { label: '无序列表', value: 'bulletList', icon: '•' },
  { label: '有序列表', value: 'orderedList', icon: '1.' },
  { label: '待办事项', value: 'taskList', icon: '☑' },
  { label: '代码块', value: 'codeBlock', icon: '{ }' },
  { label: '引用', value: 'blockquote', icon: '❝' },
  { label: '分割线', value: 'horizontalRule', icon: '—' },
];

const ALIGN_OPTIONS = [
  { label: '左对齐', value: 'left' },
  { label: '居中对齐', value: 'center' },
  { label: '右对齐', value: 'right' },
  { label: '两端对齐', value: 'justify' },
];

const TEXT_COLORS = [
  { label: '默认', value: '' },
  { label: '红色', value: '#d83931' },
  { label: '橙色', value: '#de7802' },
  { label: '绿色', value: '#21a121' },
  { label: '蓝色', value: '#245bdb' },
  { label: '紫色', value: '#6425d0' },
];

export default function ContextMenu({ editor, x, y, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [subMenu, setSubMenu] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [showComment, setShowComment] = useState(false);

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

  // Adjust position to keep menu within viewport
  const adjustedX = Math.min(x, window.innerWidth - 240);
  const adjustedY = Math.min(y, window.innerHeight - 400);

  const setHeading = (level: number) => {
    if (level === 0) {
      editor.chain().focus().setParagraph().run();
    } else {
      editor.chain().focus().toggleHeading({ level: level as 1|2|3|4|5 }).run();
    }
    onClose();
  };

  const toggleBlock = (type: string) => {
    switch (type) {
      case 'bulletList': editor.chain().focus().toggleBulletList().run(); break;
      case 'orderedList': editor.chain().focus().toggleOrderedList().run(); break;
      case 'taskList': editor.chain().focus().toggleTaskList().run(); break;
      case 'codeBlock': editor.chain().focus().toggleCodeBlock().run(); break;
      case 'blockquote': editor.chain().focus().toggleBlockquote().run(); break;
      case 'horizontalRule': editor.chain().focus().setHorizontalRule().run(); break;
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

  const handleDuplicate = () => {
    // Insert the same content below
    const { from, to } = editor.state.selection;
    const slice = editor.state.doc.slice(from, to);
    if (slice.content.size > 0) {
      editor.chain().focus().insertContentAt(to, slice.content.toJSON()).run();
    }
    onClose();
  };

  const handleIndent = () => {
    // Try to sink list item, or wrap in bullet list
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

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: adjustedX, top: adjustedY }}
    >
      {/* Block Type Header */}
      <div className="context-menu-section">
        <div className="context-block-types">
          {HEADING_LEVELS.map(h => (
            <button
              key={h.value}
              className={`context-block-btn ${
                (h.value === 0 && editor.isActive('paragraph')) ||
                editor.isActive('heading', { level: h.value })
                  ? 'active' : ''
              }`}
              onClick={() => setHeading(h.value)}
              title={h.label}
            >
              {h.icon}
            </button>
          ))}
        </div>
        <div className="context-block-types">
          {BLOCK_TYPES.map(b => (
            <button
              key={b.value}
              className={`context-block-btn ${editor.isActive(b.value) ? 'active' : ''}`}
              onClick={() => toggleBlock(b.value)}
              title={b.label}
            >
              {b.icon}
            </button>
          ))}
        </div>
      </div>

      <div className="context-menu-divider" />

      {/* Indent & Align */}
      <div
        className="context-menu-item has-submenu"
        onMouseEnter={() => setSubMenu('align')}
        onMouseLeave={() => setSubMenu(null)}
      >
        <span className="context-menu-icon">☰</span>
        <span>缩进和对齐</span>
        <span className="context-menu-arrow">›</span>
        {subMenu === 'align' && (
          <div className="context-submenu">
            <button className="context-menu-item" onClick={handleIndent}>
              <span className="context-menu-icon">→</span>
              <span>增加缩进</span>
            </button>
            <button className="context-menu-item" onClick={handleOutdent}>
              <span className="context-menu-icon">←</span>
              <span>减少缩进</span>
            </button>
            <div className="context-menu-divider" />
            {ALIGN_OPTIONS.map(a => (
              <button
                key={a.value}
                className="context-menu-item"
                onClick={() => setAlign(a.value)}
              >
                <span className="context-menu-icon">
                  {a.value === 'left' ? '⫷' : a.value === 'center' ? '⫿' : a.value === 'right' ? '⫸' : '⟺'}
                </span>
                <span>{a.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Color */}
      <div
        className="context-menu-item has-submenu"
        onMouseEnter={() => setSubMenu('color')}
        onMouseLeave={() => setSubMenu(null)}
      >
        <span className="context-menu-icon">🎨</span>
        <span>颜色</span>
        <span className="context-menu-arrow">›</span>
        {subMenu === 'color' && (
          <div className="context-submenu">
            {TEXT_COLORS.map(c => (
              <button
                key={c.value || 'default'}
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

      {/* Comment */}
      <button className="context-menu-item" onClick={() => setShowComment(!showComment)}>
        <span className="context-menu-icon">💬</span>
        <span>评论</span>
      </button>
      {showComment && (
        <div className="context-comment-box">
          <textarea
            placeholder="添加评论..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            rows={3}
          />
          <button
            className="context-comment-submit"
            onClick={() => {
              // In a real app, this would save to the backend
              alert(`评论已添加: ${commentText}`);
              setCommentText('');
              setShowComment(false);
              onClose();
            }}
          >
            提交
          </button>
        </div>
      )}

      {/* Clipboard Actions */}
      <button className="context-menu-item" onClick={handleCut}>
        <span className="context-menu-icon">✂</span>
        <span>剪切</span>
        <span className="context-menu-shortcut">Ctrl+X</span>
      </button>
      <button className="context-menu-item" onClick={handleCopy}>
        <span className="context-menu-icon">📋</span>
        <span>复制</span>
        <span className="context-menu-shortcut">Ctrl+C</span>
      </button>
      <button className="context-menu-item" onClick={handleDelete}>
        <span className="context-menu-icon">🗑</span>
        <span>删除</span>
        <span className="context-menu-shortcut">Delete</span>
      </button>

      <div className="context-menu-divider" />

      {/* Share */}
      <button className="context-menu-item" onClick={() => {
        navigator.clipboard.writeText(window.location.href);
        alert('链接已复制到剪贴板');
        onClose();
      }}>
        <span className="context-menu-icon">🔗</span>
        <span>分享</span>
      </button>

      {/* Convert to sub-document */}
      <button className="context-menu-item" onClick={() => {
        alert('已转换为子文档');
        onClose();
      }}>
        <span className="context-menu-icon">📄</span>
        <span>转换为子文档</span>
      </button>

      {/* Save as template */}
      <button className="context-menu-item" onClick={() => {
        alert('已保存为模板');
        onClose();
      }}>
        <span className="context-menu-icon">📑</span>
        <span>保存为模板</span>
      </button>

      {/* Copy link */}
      <button className="context-menu-item" onClick={() => {
        navigator.clipboard.writeText(window.location.href);
        alert('链接已复制');
        onClose();
      }}>
        <span className="context-menu-icon">🔗</span>
        <span>复制链接</span>
      </button>

      <div className="context-menu-divider" />

      {/* Add below */}
      <div
        className="context-menu-item has-submenu"
        onMouseEnter={() => setSubMenu('addBelow')}
        onMouseLeave={() => setSubMenu(null)}
      >
        <span className="context-menu-icon">➕</span>
        <span>在下方添加</span>
        <span className="context-menu-arrow">›</span>
        {subMenu === 'addBelow' && (
          <div className="context-submenu">
            <button className="context-menu-item" onClick={() => {
              editor.chain().focus().insertContentAt(editor.state.selection.to, '<p></p>').run();
              onClose();
            }}>
              <span>段落</span>
            </button>
            {HEADING_LEVELS.filter(h => h.value > 0).map(h => (
              <button key={h.value} className="context-menu-item" onClick={() => {
                const tag = `h${h.value}`;
                editor.chain().focus().insertContentAt(
                  editor.state.selection.to,
                  `<${tag}></${tag}>`
                ).run();
                onClose();
              }}>
                <span>{h.label}</span>
              </button>
            ))}
            <div className="context-menu-divider" />
            <button className="context-menu-item" onClick={() => {
              editor.chain().focus().insertContentAt(editor.state.selection.to, '<hr>').run();
              onClose();
            }}>
              <span>分割线</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
