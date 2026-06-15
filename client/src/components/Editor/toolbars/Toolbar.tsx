import { useState, useCallback, useRef, useEffect } from 'react';
import type { Editor } from '@tiptap/react';
import {
  TextformatBoldIcon,
  TextformatItalicIcon,
  TextformatStrikethroughIcon,
  TextformatUnderlineIcon,
  LinkIcon,
  CodeIcon,
  TextformatColorIcon,
  ChevronDownIcon,
  RootListIcon,
  ListNumberedIcon,
  CheckRectangleIcon,
  QuoteIcon,
  FileCode1Icon,
  DivideIcon,
} from 'tdesign-icons-react';
import { wrapIcon } from '../../../icons/wrap';
import FeishuColorPickerPanel from '../panels/FeishuColorPickerPanel';
import './Toolbar.less';

const Bold = wrapIcon(TextformatBoldIcon);
const Italic = wrapIcon(TextformatItalicIcon);
const Strikethrough = wrapIcon(TextformatStrikethroughIcon);
const Underline = wrapIcon(TextformatUnderlineIcon);
const Link = wrapIcon(LinkIcon);
const CodeInline = wrapIcon(CodeIcon);
const FontColor = wrapIcon(TextformatColorIcon);
const ChevronDownSmall = wrapIcon(ChevronDownIcon);
const BulletList = wrapIcon(RootListIcon);
const OrderedList = wrapIcon(ListNumberedIcon);
const TaskList = wrapIcon(CheckRectangleIcon);
const Quote = wrapIcon(QuoteIcon);
const CodeBlock = wrapIcon(FileCode1Icon);
const HorizontalRule = wrapIcon(DivideIcon);

const ICON_SIZE = 16;
const ICON_STROKE = 2.5;

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
            <ChevronDownSmall size={10} strokeWidth={2} fill="currentColor" className="toolbar-chevron" />
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
          <Bold size={ICON_SIZE} strokeWidth={ICON_STROKE} fill="currentColor" />
        </button>

        {/* Strikethrough */}
        <button
          className={`toolbar-btn ${editor.isActive('strike') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="删除线 (Ctrl+Shift+S)"
        >
          <Strikethrough size={ICON_SIZE} strokeWidth={ICON_STROKE} fill="currentColor" />
        </button>

        {/* Italic */}
        <button
          className={`toolbar-btn ${editor.isActive('italic') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="斜体 (Ctrl+I)"
        >
          <Italic size={ICON_SIZE} strokeWidth={ICON_STROKE} fill="currentColor" />
        </button>

        {/* Underline */}
        <button
          className={`toolbar-btn ${editor.isActive('underline') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="下划线 (Ctrl+U)"
        >
          <Underline size={ICON_SIZE} strokeWidth={ICON_STROKE} fill="currentColor" />
        </button>

        {/* Link */}
        <div className="toolbar-dropdown" style={{ position: 'relative' }}>
          <button
            className={`toolbar-btn ${editor.isActive('link') ? 'active' : ''}`}
            onClick={handleLinkClick}
            title="链接 (Ctrl+K)"
          >
            <Link size={ICON_SIZE} strokeWidth={ICON_STROKE} fill="currentColor" />
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
          <CodeInline size={ICON_SIZE} strokeWidth={ICON_STROKE} fill="currentColor" />
        </button>

        {/* Font Color */}
        <div className="toolbar-dropdown" ref={colorRef}>
          <button
            className="toolbar-btn toolbar-color-btn"
            onClick={() => setShowColorMenu(!showColorMenu)}
            title="字体颜色"
          >
            <FontColor size={ICON_SIZE} strokeWidth={ICON_STROKE} fill="currentColor" />
            <div className="color-indicator" style={{
              backgroundColor: editor.getAttributes('textStyle').color || '#1f2329'
            }} />
            <ChevronDownSmall size={8} strokeWidth={1.8} fill="currentColor" className="toolbar-chevron-inline" />
          </button>
          {showColorMenu && (
            <div className="toolbar-color-menu">
              <FeishuColorPickerPanel editor={editor} onAfterPick={() => setShowColorMenu(false)} />
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
          <BulletList size={ICON_SIZE} strokeWidth={ICON_STROKE} fill="currentColor" />
        </button>

        {/* Ordered List */}
        <button
          className={`toolbar-btn ${editor.isActive('orderedList') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="有序列表"
        >
          <OrderedList size={ICON_SIZE} strokeWidth={ICON_STROKE} fill="currentColor" />
        </button>

        {/* Task List */}
        <button
          className={`toolbar-btn ${editor.isActive('taskList') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          title="待办事项"
        >
          <TaskList size={ICON_SIZE} strokeWidth={ICON_STROKE} fill="currentColor" />
        </button>

        <div className="toolbar-divider" />

        {/* Blockquote */}
        <button
          className={`toolbar-btn ${editor.isActive('blockquote') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="引用"
        >
          <Quote size={ICON_SIZE} strokeWidth={ICON_STROKE} fill="currentColor" />
        </button>

        {/* Code Block */}
        <button
          className={`toolbar-btn ${editor.isActive('codeBlock') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          title="代码块"
        >
          <CodeBlock size={ICON_SIZE} strokeWidth={ICON_STROKE} fill="currentColor" />
        </button>

        {/* Horizontal Rule */}
        <button
          className="toolbar-btn"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="分割线"
        >
          <HorizontalRule size={ICON_SIZE} strokeWidth={ICON_STROKE} fill="currentColor" />
        </button>
      </div>
    </div>
  );
}
