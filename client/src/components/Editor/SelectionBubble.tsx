import { useReducer, useEffect, useRef, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { BubbleMenu } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import { isTextSelection } from '@tiptap/core';
import type { EditorView } from '@tiptap/pm/view';
import type { EditorState } from '@tiptap/pm/state';
import FeishuColorPickerPanel from './FeishuColorPickerPanel';
import { ContextGlyphText, ContextGlyphSynced, FEISHU_TOOLBOX } from '../../icons/contextMenuGlyphs';
import {
  SlashGlyphHeading1,
  SlashGlyphHeading2,
  SlashGlyphHeading3,
  SlashGlyphOrderedList,
  SlashGlyphBulletList,
  SlashGlyphTaskList,
  SlashGlyphCode,
  SlashGlyphQuote,
  SlashGlyphHighlight,
} from '../../icons/slashMenuGlyphs';
import {
  SelGlyphChevronDown,
  SelGlyphTypography,
  SelGlyphBold,
  SelGlyphStrike,
  SelGlyphItalic,
  SelGlyphUnderline,
  SelGlyphLink,
  SelGlyphCode,
  SelGlyphFontColor,
  SelGlyphToolbarMore,
  SelGlyphShare,
  SelGlyphComment,
} from '../../icons/selectionToolbarGlyphs';
import './SelectionBubble.less';

const GLYPH = 16;
const GLYPH_SM = 10;
const STYLE_ICON = 17;
const CALLOUT_HIGHLIGHT = '#fff7e6';
const ICON_MUTED = '#646a73';
const PRIMARY = FEISHU_TOOLBOX.b500;
const TINT_LIST = FEISHU_TOOLBOX.i500;
const TINT_CODE = FEISHU_TOOLBOX.g500;
const TINT_HI = FEISHU_TOOLBOX.o500;
const TINT_SYNC = FEISHU_TOOLBOX.n1;

function StyleMenuRow({
  icon,
  active,
  tag,
  label,
  trailing,
  onClick,
}: {
  icon: ReactNode;
  active: boolean;
  tag?: string;
  label: string;
  trailing?: ReactNode;
  onClick: () => void;
}) {
  const end = trailing !== undefined ? trailing : active ? <span className="selection-bubble-style-check" aria-hidden>✓</span> : null;
  return (
    <button
      type="button"
      className={`selection-bubble-style-row ${active ? 'selection-bubble-style-row--active' : ''}`}
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
    >
      <span className="selection-bubble-style-icon" aria-hidden>
        {icon}
      </span>
      <span className="selection-bubble-style-text">
        {tag ? <span className="selection-bubble-style-tag">{tag}</span> : null}
        <span className="selection-bubble-style-label">{label}</span>
      </span>
      {end}
    </button>
  );
}

const ALIGN_OPTIONS: { key: 'left' | 'center' | 'right'; label: string }[] = [
  { key: 'left', label: '左对齐' },
  { key: 'center', label: '居中' },
  { key: 'right', label: '右对齐' },
];

interface SelectionBubbleProps {
  editor: Editor;
}

function shouldShowBubble({
  editor,
  element,
  view,
  state,
  from,
  to,
}: {
  editor: Editor;
  element: HTMLElement;
  view: EditorView;
  state: EditorState;
  from: number;
  to: number;
}) {
  const { doc, selection } = state;
  const { empty } = selection;
  const isEmptyTextBlock = !doc.textBetween(from, to).length && isTextSelection(selection);
  const isChildOfMenu = element.contains(document.activeElement);
  const hasEditorFocus = view.hasFocus() || isChildOfMenu;

  if (!hasEditorFocus || empty || isEmptyTextBlock || !editor.isEditable) {
    return false;
  }
  if (document.querySelector('.context-menu')) return false;
  if (document.querySelector('.slash-menu')) return false;
  if (editor.isActive('codeBlock')) return false;
  return true;
}

function copySelectedPlainText(editor: Editor) {
  const { from, to } = editor.state.selection;
  const text = editor.state.doc.textBetween(from, to, '\n');
  void navigator.clipboard?.writeText(text);
}

export default function SelectionBubble({ editor }: SelectionBubbleProps) {
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const [showAlignMenu, setShowAlignMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showColorMenu, setShowColorMenu] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const headingRef = useRef<HTMLDivElement>(null);
  const alignRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const colorRef = useRef<HTMLDivElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const moreHeadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showHeadingMoreFlyout, setShowHeadingMoreFlyout] = useState(false);

  const cancelMoreHeadingClose = useCallback(() => {
    if (moreHeadingTimerRef.current) {
      clearTimeout(moreHeadingTimerRef.current);
      moreHeadingTimerRef.current = null;
    }
  }, []);

  const scheduleMoreHeadingClose = useCallback(() => {
    cancelMoreHeadingClose();
    moreHeadingTimerRef.current = window.setTimeout(() => setShowHeadingMoreFlyout(false), 220);
  }, [cancelMoreHeadingClose]);

  useEffect(() => {
    const onSel = () => refresh();
    editor.on('selectionUpdate', onSel);
    editor.on('transaction', onSel);
    return () => {
      editor.off('selectionUpdate', onSel);
      editor.off('transaction', onSel);
    };
  }, [editor]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (headingRef.current && !headingRef.current.contains(t)) {
        cancelMoreHeadingClose();
        setShowHeadingMoreFlyout(false);
        setShowHeadingMenu(false);
      }
      if (alignRef.current && !alignRef.current.contains(t)) setShowAlignMenu(false);
      if (moreRef.current && !moreRef.current.contains(t)) setShowMoreMenu(false);
      if (colorRef.current && !colorRef.current.contains(t)) setShowColorMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [cancelMoreHeadingClose]);

  useEffect(
    () => () => {
      cancelMoreHeadingClose();
    },
    [cancelMoreHeadingClose],
  );

  const getCurrentHeading = useCallback(() => {
    for (let i = 1; i <= 6; i++) {
      if (editor.isActive('heading', { level: i })) return `H${i}`;
    }
    return '正文';
  }, [editor]);

  const closeHeadingStylePanel = () => {
    cancelMoreHeadingClose();
    setShowHeadingMoreFlyout(false);
    setShowHeadingMenu(false);
  };

  const setHeading = (level: number) => {
    if (level === 0) {
      editor.chain().focus().setParagraph().run();
    } else {
      editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 }).run();
    }
    closeHeadingStylePanel();
  };

  const headingMoreActive =
    editor.isActive('heading', { level: 4 })
    || editor.isActive('heading', { level: 5 })
    || editor.isActive('heading', { level: 6 });

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
    const existingHref = editor.getAttributes('link').href as string | undefined;
    if (existingHref) setLinkUrl(existingHref);
    setShowLinkInput(!showLinkInput);
    setTimeout(() => linkInputRef.current?.focus(), 50);
  };

  const currentAlign =
    (editor.getAttributes('paragraph').textAlign as string | undefined)
    ?? (editor.getAttributes('heading').textAlign as string | undefined)
    ?? 'left';

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="selectionBubbleMenu"
      className="selection-bubble"
      updateDelay={100}
      shouldShow={props => shouldShowBubble(props)}
      tippyOptions={{
        placement: 'top',
        duration: [120, 80],
        zIndex: 10020,
        moveTransition: 'transform 0.15s ease-out',
        // tippy.js 默认为 maxWidth 350px，toolbar 会变窄导致图标挤压/不全
        maxWidth: 'none',
      }}
    >
      <div className="selection-bubble-inner" role="toolbar" aria-label="选区格式">
        <div className="selection-bubble-group selection-bubble-group--main">
          <div className="selection-bubble-dropdown" ref={headingRef}>
            <button
              type="button"
              className="selection-bubble-submenu selection-bubble-heading-trigger"
              onMouseDown={e => e.preventDefault()}
              onClick={() => setShowHeadingMenu(!showHeadingMenu)}
            >
              <span className="selection-bubble-heading-icon selection-bubble-color-b500" aria-hidden>
              {getCurrentHeading()}
              </span>
              <SelGlyphChevronDown size={GLYPH_SM} className="selection-bubble-chevron" />
            </button>
            {showHeadingMenu && (
              <div
                className="selection-bubble-menu selection-bubble-menu--block-style"
                onMouseDown={e => e.preventDefault()}
              >
                <StyleMenuRow
                  icon={<ContextGlyphText size={STYLE_ICON} fill={ICON_MUTED} />}
                  active={editor.isActive('paragraph')}
                  label="正文"
                  onClick={() => setHeading(0)}
                />
                <StyleMenuRow
                  icon={
                    <SlashGlyphHeading1
                      size={STYLE_ICON}
                      fill={editor.isActive('heading', { level: 1 }) ? PRIMARY : ICON_MUTED}
                    />
                  }
                  active={editor.isActive('heading', { level: 1 })}
                  tag="H1"
                  label="一级标题"
                  onClick={() => setHeading(1)}
                />
                <StyleMenuRow
                  icon={
                    <SlashGlyphHeading2
                      size={STYLE_ICON}
                      fill={editor.isActive('heading', { level: 2 }) ? PRIMARY : ICON_MUTED}
                    />
                  }
                  active={editor.isActive('heading', { level: 2 })}
                  tag="H2"
                  label="二级标题"
                  onClick={() => setHeading(2)}
                />
                <StyleMenuRow
                  icon={
                    <SlashGlyphHeading3
                      size={STYLE_ICON}
                      fill={editor.isActive('heading', { level: 3 }) ? PRIMARY : ICON_MUTED}
                    />
                  }
                  active={editor.isActive('heading', { level: 3 })}
                  tag="H3"
                  label="三级标题"
                  onClick={() => setHeading(3)}
                />

                <div
                  className="selection-bubble-style-more-wrap"
                  onMouseEnter={() => {
                    cancelMoreHeadingClose();
                    setShowHeadingMoreFlyout(true);
                  }}
                  onMouseLeave={scheduleMoreHeadingClose}
                >
                  <div
                    role="presentation"
                    className={`selection-bubble-style-row selection-bubble-style-row--trigger${headingMoreActive ? ' selection-bubble-style-row--sub-active' : ''}`}
                  >
                    <span className="selection-bubble-style-icon" aria-hidden>
                      <SlashGlyphHeading3 size={STYLE_ICON} fill={ICON_MUTED} />
                    </span>
                    <span className="selection-bubble-style-text">
                      <span className="selection-bubble-style-tag selection-bubble-style-tag--muted">Hn</span>
                      <span className="selection-bubble-style-label">其他标题</span>
                    </span>
                    <SelGlyphChevronDown size={GLYPH_SM} className="selection-bubble-chevron-right" />
                  </div>
                  {showHeadingMoreFlyout && (
                    <div
                      className="selection-bubble-style-more-flyout"
                      onMouseEnter={() => {
                        cancelMoreHeadingClose();
                        setShowHeadingMoreFlyout(true);
                      }}
                      onMouseLeave={scheduleMoreHeadingClose}
                    >
                      <StyleMenuRow
                        icon={
                          <SlashGlyphHeading3
                            size={STYLE_ICON}
                            fill={editor.isActive('heading', { level: 4 }) ? PRIMARY : ICON_MUTED}
                          />
                        }
                        active={editor.isActive('heading', { level: 4 })}
                        tag="H4"
                        label="四级标题"
                        onClick={() => setHeading(4)}
                      />
                      <StyleMenuRow
                        icon={
                          <SlashGlyphHeading3
                            size={STYLE_ICON}
                            fill={editor.isActive('heading', { level: 5 }) ? PRIMARY : ICON_MUTED}
                          />
                        }
                        active={editor.isActive('heading', { level: 5 })}
                        tag="H5"
                        label="五级标题"
                        onClick={() => setHeading(5)}
                      />
                      <StyleMenuRow
                        icon={
                          <SlashGlyphHeading3
                            size={STYLE_ICON}
                            fill={editor.isActive('heading', { level: 6 }) ? PRIMARY : ICON_MUTED}
                          />
                        }
                        active={editor.isActive('heading', { level: 6 })}
                        tag="H6"
                        label="六级标题"
                        onClick={() => setHeading(6)}
                      />
                    </div>
                  )}
                </div>

                <div className="selection-bubble-menu-divider" role="presentation" />

                <StyleMenuRow
                  icon={
                    <SlashGlyphOrderedList
                      size={STYLE_ICON}
                      fill={editor.isActive('orderedList') ? PRIMARY : TINT_LIST}
                    />
                  }
                  active={editor.isActive('orderedList')}
                  label="有序列表"
                  onClick={() => {
                    editor.chain().focus().toggleOrderedList().run();
                    closeHeadingStylePanel();
                  }}
                />
                <StyleMenuRow
                  icon={
                    <SlashGlyphBulletList
                      size={STYLE_ICON}
                      fill={editor.isActive('bulletList') ? PRIMARY : TINT_LIST}
                    />
                  }
                  active={editor.isActive('bulletList')}
                  label="无序列表"
                  onClick={() => {
                    editor.chain().focus().toggleBulletList().run();
                    closeHeadingStylePanel();
                  }}
                />
                <StyleMenuRow
                  icon={
                    <SlashGlyphTaskList
                      size={STYLE_ICON}
                      fill={editor.isActive('taskList') ? PRIMARY : TINT_LIST}
                    />
                  }
                  active={editor.isActive('taskList')}
                  label="任务"
                  onClick={() => {
                    editor.chain().focus().toggleTaskList().run();
                    closeHeadingStylePanel();
                  }}
                />
                <StyleMenuRow
                  icon={
                    <SlashGlyphCode
                      size={STYLE_ICON}
                      fill={editor.isActive('codeBlock') ? PRIMARY : TINT_CODE}
                    />
                  }
                  active={editor.isActive('codeBlock')}
                  label="代码块"
                  onClick={() => {
                    editor.chain().focus().toggleCodeBlock().run();
                    closeHeadingStylePanel();
                  }}
                />

                <div className="selection-bubble-menu-divider" role="presentation" />

                <StyleMenuRow
                  icon={
                    <SlashGlyphQuote size={STYLE_ICON} fill={editor.isActive('blockquote') ? PRIMARY : ICON_MUTED} />
                  }
                  active={editor.isActive('blockquote')}
                  label="引用"
                  onClick={() => {
                    editor.chain().focus().toggleBlockquote().run();
                    closeHeadingStylePanel();
                  }}
                />
                <StyleMenuRow
                  icon={<SlashGlyphHighlight size={STYLE_ICON} fill={editor.isActive('highlight') ? PRIMARY : TINT_HI} />}
                  active={editor.isActive('highlight')}
                  label="高亮块"
                  onClick={() => {
                    editor.chain().focus().toggleHighlight({ color: CALLOUT_HIGHLIGHT }).run();
                    closeHeadingStylePanel();
                  }}
                />
                <StyleMenuRow
                  icon={<ContextGlyphSynced size={STYLE_ICON} fill={TINT_SYNC} />}
                  active={false}
                  label="同步块"
                  trailing={null}
                  onClick={() => {
                    closeHeadingStylePanel();
                  }}
                />
              </div>
            )}
          </div>

          <span className="selection-bubble-divider selection-bubble-divider--thin" aria-hidden />

          <div className="selection-bubble-dropdown" ref={alignRef}>
            <button
              type="button"
              className="selection-bubble-submenu selection-bubble-align-trigger"
              onMouseDown={e => e.preventDefault()}
              onClick={() => setShowAlignMenu(!showAlignMenu)}
              title="对齐"
            >
              <SelGlyphTypography size={GLYPH} />
              <SelGlyphChevronDown size={GLYPH_SM} className="selection-bubble-chevron" />
            </button>
            {showAlignMenu && (
              <div className="selection-bubble-menu selection-bubble-menu--align">
                {ALIGN_OPTIONS.map(a => (
                  <button
                    key={a.key}
                    type="button"
                    className={`selection-bubble-menu-item ${currentAlign === a.key ? 'active' : ''}`}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => {
                      editor.chain().focus().setTextAlign(a.key).run();
                      setShowAlignMenu(false);
                    }}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className="selection-bubble-divider selection-bubble-divider--thin" aria-hidden />

          <button
            type="button"
            className={`selection-bubble-btn ${editor.isActive('bold') ? 'active' : ''}`}
            onMouseDown={e => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="粗体"
          >
            <SelGlyphBold size={GLYPH} />
          </button>
          <button
            type="button"
            className={`selection-bubble-btn ${editor.isActive('strike') ? 'active' : ''}`}
            onMouseDown={e => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            title="删除线"
          >
            <SelGlyphStrike size={GLYPH} />
          </button>
          <button
            type="button"
            className={`selection-bubble-btn ${editor.isActive('italic') ? 'active' : ''}`}
            onMouseDown={e => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="斜体"
          >
            <SelGlyphItalic size={GLYPH} />
          </button>
          <button
            type="button"
            className={`selection-bubble-btn ${editor.isActive('underline') ? 'active' : ''}`}
            onMouseDown={e => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            title="下划线"
          >
            <SelGlyphUnderline size={GLYPH} />
          </button>

          <div className="selection-bubble-dropdown selection-bubble-dropdown--link">
            <button
              type="button"
              className={`selection-bubble-btn ${editor.isActive('link') ? 'selection-bubble-btn--brand active' : ''}`}
              onMouseDown={e => e.preventDefault()}
              onClick={handleLinkClick}
              title="链接"
            >
              <SelGlyphLink size={GLYPH} className={editor.isActive('link') ? 'selection-bubble-link-glyph' : undefined} />
            </button>
            {showLinkInput && (
              <div className="selection-bubble-link-pop">
                <input
                  ref={linkInputRef}
                  type="url"
                  placeholder="链接地址"
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') setLink();
                    if (e.key === 'Escape') {
                      setShowLinkInput(false);
                      setLinkUrl('');
                    }
                  }}
                />
                <button type="button" className="selection-bubble-link-ok" onMouseDown={e => e.preventDefault()} onClick={setLink}>
                  确定
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className={`selection-bubble-btn ${editor.isActive('code') ? 'active' : ''}`}
            onMouseDown={e => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleCode().run()}
            title="行内代码"
          >
            <SelGlyphCode size={GLYPH} />
          </button>

          <div className="selection-bubble-dropdown" ref={colorRef}>
            <button
              type="button"
              className="selection-bubble-submenu selection-bubble-color-trigger"
              onMouseDown={e => e.preventDefault()}
              onClick={() => setShowColorMenu(!showColorMenu)}
              title="文字与背景色"
            >
              <span className="selection-bubble-fontcolor-chip" aria-hidden>
                <SelGlyphFontColor size={GLYPH} />
              </span>
              <SelGlyphChevronDown size={GLYPH_SM} className="selection-bubble-chevron" />
            </button>
            {showColorMenu && (
              <div className="selection-bubble-menu selection-bubble-menu--color">
                <FeishuColorPickerPanel editor={editor} onAfterPick={() => setShowColorMenu(false)} />
              </div>
            )}
          </div>
        </div>

        <span className="selection-bubble-divider selection-bubble-divider--section" aria-hidden />

        <div className="selection-bubble-group selection-bubble-group--extra">
          <div className="selection-bubble-dropdown" ref={moreRef}>
            <button
              type="button"
              className="selection-bubble-btn selection-bubble-btn--icon-quiet"
              onMouseDown={e => e.preventDefault()}
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              title="更多"
            >
              <SelGlyphToolbarMore size={GLYPH} />
            </button>
            {showMoreMenu && (
              <div className="selection-bubble-menu selection-bubble-menu--more">
                <button
                  type="button"
                  className="selection-bubble-menu-item"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => {
                    copySelectedPlainText(editor);
                    setShowMoreMenu(false);
                  }}
                >
                  复制选中文本
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className="selection-bubble-btn selection-bubble-btn--brand-outline"
            onMouseDown={e => e.preventDefault()}
            onClick={() => copySelectedPlainText(editor)}
            title="分享 / 复制文本"
          >
            <SelGlyphShare size={GLYPH} />
          </button>

          <button
            type="button"
            className="selection-bubble-btn selection-bubble-btn--icon-quiet"
            onMouseDown={e => e.preventDefault()}
            onClick={() => {}}
            title="评论（即将支持）"
            disabled
          >
            <SelGlyphComment size={GLYPH} />
          </button>
        </div>
      </div>
    </BubbleMenu>
  );
}
