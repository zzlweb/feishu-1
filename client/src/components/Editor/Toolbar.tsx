import { useState, useCallback, useRef, useEffect } from 'react';
import type { Editor } from '@tiptap/react';
import './Toolbar.less';

interface ToolbarProps {
  editor: Editor;
}

const HEADING_OPTIONS = [
  { label: '正文', value: 0 },
  { label: 'H1', value: 1 },
  { label: 'H2', value: 2 },
  { label: 'H3', value: 3 },
  { label: 'H4', value: 4 },
  { label: 'H5', value: 5 },
];

const FONT_COLORS = [
  { label: '默认', value: '' },
  { label: '灰色', value: '#8a8f8d' },
  { label: '红色', value: '#d83931' },
  { label: '橙色', value: '#de7802' },
  { label: '黄色', value: '#dc9b04' },
  { label: '绿色', value: '#21a121' },
  { label: '蓝色', value: '#245bdb' },
  { label: '紫色', value: '#6425d0' },
];

const BG_COLORS = [
  { label: '无', value: '' },
  { label: '浅灰', value: '#f1f1f0' },
  { label: '浅红', value: '#fdebec' },
  { label: '浅橙', value: '#fef0e1' },
  { label: '浅黄', value: '#fefce8' },
  { label: '浅绿', value: '#ebfaeb' },
  { label: '浅蓝', value: '#e8f0fe' },
  { label: '浅紫', value: '#f3e8fd' },
];

export default function Toolbar({ editor }: ToolbarProps) {
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const [showColorMenu, setShowColorMenu] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const headingRef = useRef<HTMLDivElement>(null);
  const colorRef = useRef<HTMLDivElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (headingRef.current && !headingRef.current.contains(e.target as Node)) {
        setShowHeadingMenu(false);
      }
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) {
        setShowColorMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const getCurrentHeading = useCallback(() => {
    for (let i = 1; i <= 5; i++) {
      if (editor.isActive('heading', { level: i })) return `H${i}`;
    }
    return '正文';
  }, [editor]);

  const setHeading = (level: number) => {
    if (level === 0) {
      editor.chain().focus().setParagraph().run();
    } else {
      editor.chain().focus().toggleHeading({ level: level as 1|2|3|4|5 }).run();
    }
    setShowHeadingMenu(false);
  };

  const setLink = () => {
    if (linkUrl) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
    } else {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    }
    setShowLinkInput(false);
    setLinkUrl('');
  };

  const handleLinkClick = () => {
    const existingHref = editor.getAttributes('link').href;
    if (existingHref) {
      setLinkUrl(existingHref);
    }
    setShowLinkInput(!showLinkInput);
    setTimeout(() => linkInputRef.current?.focus(), 50);
  };

  return (
    <div className="toolbar">
      <div className="toolbar-inner">
        {/* Heading Dropdown */}
        <div className="toolbar-dropdown" ref={headingRef}>
          <button
            className="toolbar-btn toolbar-heading-btn"
            onClick={() => setShowHeadingMenu(!showHeadingMenu)}
          >
            <span>{getCurrentHeading()}</span>
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
              <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {showHeadingMenu && (
            <div className="toolbar-dropdown-menu">
              {HEADING_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`toolbar-dropdown-item ${
                    (opt.value === 0 && editor.isActive('paragraph')) ||
                    editor.isActive('heading', { level: opt.value })
                      ? 'active' : ''
                  }`}
                  onClick={() => setHeading(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="toolbar-divider" />

        {/* Bold */}
        <button
          className={`toolbar-btn ${editor.isActive('bold') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="粗体 (Ctrl+B)"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 2.5h4.5a3 3 0 0 1 2.1 5.15A3.25 3.25 0 0 1 9 13.5H4V2.5zm1.5 1.5v3h3a1.5 1.5 0 1 0 0-3h-3zm0 4.5v3h3.5a1.75 1.75 0 1 0 0-3.5H5.5z"/>
          </svg>
        </button>

        {/* Strikethrough */}
        <button
          className={`toolbar-btn ${editor.isActive('strike') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="删除线 (Ctrl+Shift+S)"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 8.5h12v-1H2v1zM5.7 3.2A3.4 3.4 0 0 1 8 2.5c2.2 0 3.5 1.3 3.5 3h-1.5c0-1-.7-1.5-2-1.5s-2 .5-2 1.3c0 .4.1.7.4.9h-1.8c-.2-.3-.3-.6-.3-1h.1zm4.6 5.8c.2.3.3.6.3 1 0 1.4-1.3 2.5-3.5 2.5s-3.6-1-3.6-3h1.5c0 1 .8 1.5 2.1 1.5s2-.5 2-1.3c0-.3-.1-.5-.3-.7h1.5z"/>
          </svg>
        </button>

        {/* Italic */}
        <button
          className={`toolbar-btn ${editor.isActive('italic') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="斜体 (Ctrl+I)"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M6 2.5h6v1.5H9.7L7.3 12H10v1.5H4V12h2.3l2.4-8H6V2.5z"/>
          </svg>
        </button>

        {/* Underline */}
        <button
          className={`toolbar-btn ${editor.isActive('underline') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="下划线 (Ctrl+U)"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3.5 2v5.5C3.5 9.98 5.52 12 8 12s4.5-2.02 4.5-4.5V2H11v5.5c0 1.66-1.34 3-3 3s-3-1.34-3-3V2H3.5zM3 13.5h10V15H3v-1.5z"/>
          </svg>
        </button>

        {/* Link */}
        <div className="toolbar-dropdown" style={{ position: 'relative' }}>
          <button
            className={`toolbar-btn ${editor.isActive('link') ? 'active' : ''}`}
            onClick={handleLinkClick}
            title="链接 (Ctrl+K)"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M7.2 10.8l-1 1a2.1 2.1 0 0 1-3-3l2-2a2.1 2.1 0 0 1 3 0l.7-.7a3.1 3.1 0 0 0-4.4 0l-2 2a3.1 3.1 0 0 0 4.4 4.4l1-1-.7-.7zm1.6-5.6l1-1a2.1 2.1 0 0 1 3 3l-2 2a2.1 2.1 0 0 1-3 0l-.7.7a3.1 3.1 0 0 0 4.4 0l2-2a3.1 3.1 0 0 0-4.4-4.4l-1 1 .7.7z"/>
            </svg>
          </button>
          {showLinkInput && (
            <div className="toolbar-link-input">
              <input
                ref={linkInputRef}
                type="url"
                placeholder="输入链接地址..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') setLink(); }}
              />
              <button onClick={setLink}>确定</button>
            </div>
          )}
        </div>

        {/* Code */}
        <button
          className={`toolbar-btn ${editor.isActive('code') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleCode().run()}
          title="行内代码 (Ctrl+E)"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M5.2 11.8L1.4 8l3.8-3.8 1 1.1L3.6 8l2.7 2.7-1.1 1.1zm5.6 0l3.8-3.8-3.8-3.8-1 1.1L12.4 8l-2.7 2.7 1.1 1.1z"/>
          </svg>
        </button>

        {/* Font Color */}
        <div className="toolbar-dropdown" ref={colorRef}>
          <button
            className="toolbar-btn toolbar-color-btn"
            onClick={() => setShowColorMenu(!showColorMenu)}
            title="字体颜色"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M7.2 1.5L2.5 12h1.7l1.2-2.8h5.2L11.8 12h1.7L8.8 1.5H7.2zM6 8l2-4.8L10 8H6z"/>
            </svg>
            <div className="color-indicator" style={{
              backgroundColor: editor.getAttributes('textStyle').color || '#1f2329'
            }} />
            <svg width="8" height="5" viewBox="0 0 8 5" fill="none" style={{ marginLeft: 2 }}>
              <path d="M1 1L4 4L7 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {showColorMenu && (
            <div className="toolbar-color-menu">
              <div className="color-section">
                <div className="color-section-title">文字颜色</div>
                <div className="color-grid">
                  {FONT_COLORS.map(c => (
                    <button
                      key={c.value || 'default'}
                      className="color-swatch"
                      title={c.label}
                      onClick={() => {
                        if (c.value) {
                          editor.chain().focus().setColor(c.value).run();
                        } else {
                          editor.chain().focus().unsetColor().run();
                        }
                        setShowColorMenu(false);
                      }}
                    >
                      <span
                        className="color-dot"
                        style={{
                          backgroundColor: c.value || '#1f2329',
                          border: c.value === '' ? '1px solid #dee0e3' : 'none',
                        }}
                      />
                      <span className="color-label">{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="color-section">
                <div className="color-section-title">背景颜色</div>
                <div className="color-grid">
                  {BG_COLORS.map(c => (
                    <button
                      key={c.value || 'nobg'}
                      className="color-swatch"
                      title={c.label}
                      onClick={() => {
                        if (c.value) {
                          editor.chain().focus().setHighlight({ color: c.value }).run();
                        } else {
                          editor.chain().focus().unsetHighlight().run();
                        }
                        setShowColorMenu(false);
                      }}
                    >
                      <span
                        className="color-dot"
                        style={{
                          backgroundColor: c.value || '#ffffff',
                          border: '1px solid #dee0e3',
                        }}
                      />
                      <span className="color-label">{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="toolbar-divider" />

        {/* Bullet List */}
        <button
          className={`toolbar-btn ${editor.isActive('bulletList') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="无序列表"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="3" cy="4" r="1.2"/>
            <circle cx="3" cy="8" r="1.2"/>
            <circle cx="3" cy="12" r="1.2"/>
            <rect x="6" y="3.2" width="8" height="1.6" rx="0.4"/>
            <rect x="6" y="7.2" width="8" height="1.6" rx="0.4"/>
            <rect x="6" y="11.2" width="8" height="1.6" rx="0.4"/>
          </svg>
        </button>

        {/* Ordered List */}
        <button
          className={`toolbar-btn ${editor.isActive('orderedList') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="有序列表"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <text x="1" y="5" fontSize="5" fontWeight="600">1.</text>
            <text x="1" y="9" fontSize="5" fontWeight="600">2.</text>
            <text x="1" y="13" fontSize="5" fontWeight="600">3.</text>
            <rect x="6" y="3.2" width="8" height="1.6" rx="0.4"/>
            <rect x="6" y="7.2" width="8" height="1.6" rx="0.4"/>
            <rect x="6" y="11.2" width="8" height="1.6" rx="0.4"/>
          </svg>
        </button>

        {/* Task List */}
        <button
          className={`toolbar-btn ${editor.isActive('taskList') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          title="待办事项"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="1" y="2" width="5" height="5" rx="1" strokeWidth="1.2" stroke="currentColor" fill="none"/>
            <path d="M2.5 4.5L3.8 6L6 3.5" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            <rect x="1" y="9" width="5" height="5" rx="1" strokeWidth="1.2" stroke="currentColor" fill="none"/>
            <rect x="8" y="3.5" width="7" height="1.5" rx="0.4"/>
            <rect x="8" y="10.5" width="7" height="1.5" rx="0.4"/>
          </svg>
        </button>

        <div className="toolbar-divider" />

        {/* Blockquote */}
        <button
          className={`toolbar-btn ${editor.isActive('blockquote') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="引用"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3 3h4v4H5l-1 3H2l1-3V3zm7 0h4v4h-2l-1 3H9l1-3V3z"/>
          </svg>
        </button>

        {/* Code Block */}
        <button
          className={`toolbar-btn ${editor.isActive('codeBlock') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          title="代码块"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 3a1 1 0 011-1h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3zm1.5.5v9h9v-9h-9z"/>
            <path d="M5.5 7.5L4 9l1.5 1.5M10.5 7.5L12 9l-1.5 1.5M7.5 6.5l1 5"/>
          </svg>
        </button>

        {/* Horizontal Rule */}
        <button
          className="toolbar-btn"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="分割线"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="2" y="7.25" width="12" height="1.5" rx="0.5"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
