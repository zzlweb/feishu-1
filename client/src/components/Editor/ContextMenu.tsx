import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { ComponentType } from 'react';
import type { Editor } from '@tiptap/react';
import {
  FormatVerticalAlignCenterIcon,
  FormatVerticalAlignLeftIcon,
  FormatVerticalAlignRightIcon,
  IndentRightIcon,
  IndentLeftIcon,
  HelpCircleIcon,
} from 'tdesign-icons-react';
import { wrapIcon } from '../../icons/wrap';
import {
  ContextGlyphText,
  ContextGlyphSynced,
  ContextGlyphTypography,
  ContextGlyphStyleColor,
  ContextGlyphCut,
  ContextGlyphCopy,
  ContextGlyphTranslate,
  ContextGlyphDelete,
  ContextGlyphShare,
  ContextGlyphTemplate,
  ContextGlyphBlockLink,
  ContextGlyphAddBelow,
  FEISHU_TOOLBOX,
} from '../../icons/contextMenuGlyphs';
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
  SlashGlyphSubDoc,
} from '../../icons/slashMenuGlyphs';
import { IconChevronMenuEnd } from '../../icons/feishuDoc';
import { SLASH_SECTIONS } from './slashMenuConfig';
import { insertBelowSlashItem } from './insertBelowBlocks';
import FeishuColorPickerPanel from './FeishuColorPickerPanel';
import './ContextMenu.less';
import './SlashMenu.less';

const AlignTextLeft = wrapIcon(FormatVerticalAlignLeftIcon);
const AlignTextCenter = wrapIcon(FormatVerticalAlignCenterIcon);
const AlignTextRight = wrapIcon(FormatVerticalAlignRightIcon);
const IndentRight = wrapIcon(IndentRightIcon);
const IndentLeft = wrapIcon(IndentLeftIcon);
const HelpCircle = wrapIcon(HelpCircleIcon);

interface ContextMenuProps {
  editor: Editor;
  x: number;
  y: number;
  onClose: () => void;
}

type RowKind = 'heading' | 'block' | 'highlight' | 'noop';

type DocIcon = ComponentType<{
  theme?: string;
  size?: number;
  strokeWidth?: number;
  fill?: string;
  className?: string;
}>;

interface GridRowDef {
  label: string;
  value: number | string;
  type: RowKind;
  Icon: DocIcon;
  /** 未选中 ≈ 飞书 `color-b-500` / `color-i-500` …；选中时为白底反白 */
  tint: string;
}

const CALLOUT_HIGHLIGHT = '#fff7e6';
const TBOX = FEISHU_TOOLBOX;

/** 与飞书 flatten-item-list 顺序、语义色一致 */
const ROW_1: GridRowDef[] = [
  { label: '正文', value: 0, type: 'heading', Icon: ContextGlyphText, tint: TBOX.b500 },
  { label: '一级标题', value: 1, type: 'heading', Icon: SlashGlyphHeading1, tint: TBOX.b500 },
  { label: '二级标题', value: 2, type: 'heading', Icon: SlashGlyphHeading2, tint: TBOX.b500 },
  { label: '三级标题', value: 3, type: 'heading', Icon: SlashGlyphHeading3, tint: TBOX.b500 },
  { label: '有序列表', value: 'orderedList', type: 'block', Icon: SlashGlyphOrderedList, tint: TBOX.i500 },
  { label: '无序列表', value: 'bulletList', type: 'block', Icon: SlashGlyphBulletList, tint: TBOX.i500 },
];

const ROW_2: GridRowDef[] = [
  { label: '待办事项', value: 'taskList', type: 'block', Icon: SlashGlyphTaskList, tint: TBOX.i500 },
  { label: '代码块', value: 'codeBlock', type: 'block', Icon: SlashGlyphCode, tint: TBOX.g500 },
  { label: '引用', value: 'blockquote', type: 'block', Icon: SlashGlyphQuote, tint: TBOX.b500 },
  { label: '高亮块', value: CALLOUT_HIGHLIGHT, type: 'highlight', Icon: SlashGlyphHighlight, tint: TBOX.o500 },
  { label: '同步块', value: 'noopSync', type: 'noop', Icon: ContextGlyphSynced, tint: TBOX.n1 },
];

const ALIGN_OPTIONS = [
  { label: '左对齐', value: 'left', Icon: AlignTextLeft },
  { label: '居中对齐', value: 'center', Icon: AlignTextCenter },
  { label: '右对齐', value: 'right', Icon: AlignTextRight },
] as const;

const PRIMARY = TBOX.b500;
const FEISHU_GREEN = TBOX.g500;
const FEISHU_DANGER = '#f54a45';
const ICON_MUTED = '#646a73';

function isGridActive(editor: Editor, item: GridRowDef): boolean {
  if (item.type === 'heading') {
    if (item.value === 0) return editor.isActive('paragraph');
    return editor.isActive('heading', { level: item.value as 1 | 2 | 3 });
  }
  if (item.type === 'block') return editor.isActive(item.value as string);
  if (item.type === 'highlight') {
    return editor.isActive('highlight');
  }
  return false;
}

function getCurrentTextAlign(editor: Editor): string {
  const p = editor.getAttributes('paragraph').textAlign as string | undefined;
  const h = editor.getAttributes('heading').textAlign as string | undefined;
  return (p || h || 'left') as string;
}

export default function ContextMenu({ editor, x, y, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const alignTriggerRef = useRef<HTMLDivElement>(null);
  const colorTriggerRef = useRef<HTMLDivElement>(null);
  const addBelowTriggerRef = useRef<HTMLDivElement>(null);
  const alignFlyoutRef = useRef<HTMLDivElement>(null);
  const colorFlyoutRef = useRef<HTMLDivElement>(null);
  const addBelowFlyoutRef = useRef<HTMLDivElement>(null);
  const subMenuCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [subMenu, setSubMenu] = useState<string | null>(null);
  const [alignFlyoutPos, setAlignFlyoutPos] = useState<{ top: number; left: number } | null>(null);
  const [colorFlyoutPos, setColorFlyoutPos] = useState<{ top: number; left: number } | null>(null);
  const [addBelowFlyoutPos, setAddBelowFlyoutPos] = useState<{ top: number; left: number } | null>(null);

  const clearSubMenuCloseTimer = () => {
    if (subMenuCloseTimerRef.current) {
      clearTimeout(subMenuCloseTimerRef.current);
      subMenuCloseTimerRef.current = null;
    }
  };

  const scheduleSubmenuClose = () => {
    clearSubMenuCloseTimer();
    subMenuCloseTimerRef.current = setTimeout(() => setSubMenu(null), 220);
  };

  useLayoutEffect(() => {
    setAlignFlyoutPos(null);
    setColorFlyoutPos(null);
    setAddBelowFlyoutPos(null);

    const pad = 8;
    const gap = 4;

    if (subMenu === 'align') {
      const el = alignTriggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const panelW = 216;
      const panelMaxH = 320;
      let left = r.right + gap;
      if (left + panelW > window.innerWidth - pad) {
        left = Math.max(pad, r.left - panelW - gap);
      }
      let top = r.top;
      if (top + panelMaxH > window.innerHeight - pad) {
        top = Math.max(pad, window.innerHeight - pad - panelMaxH);
      }
      setAlignFlyoutPos({ top, left });
      return;
    }

    if (subMenu === 'color') {
      const el = colorTriggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const panelW = 268;
      const panelMaxH = Math.min(420, window.innerHeight - 2 * pad);
      let left = r.right + gap;
      if (left + panelW > window.innerWidth - pad) {
        left = Math.max(pad, r.left - panelW - gap);
      }
      let top = r.top;
      if (top + panelMaxH > window.innerHeight - pad) {
        top = Math.max(pad, window.innerHeight - pad - panelMaxH);
      }
      setColorFlyoutPos({ top, left });
      return;
    }

    if (subMenu === 'addBelow') {
      const el = addBelowTriggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const panelW = 296;
      const panelMaxH = Math.min(560, window.innerHeight - 2 * pad);
      let left = r.right + gap;
      if (left + panelW > window.innerWidth - pad) {
        left = Math.max(pad, r.left - panelW - gap);
      }
      let top = r.top;
      if (top + panelMaxH > window.innerHeight - pad) {
        top = Math.max(pad, window.innerHeight - pad - panelMaxH);
      }
      setAddBelowFlyoutPos({ top, left });
    }
  }, [subMenu]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const t = e.target as Node;
      if (menuRef.current?.contains(t)) return;
      if (alignFlyoutRef.current?.contains(t)) return;
      if (colorFlyoutRef.current?.contains(t)) return;
      if (addBelowFlyoutRef.current?.contains(t)) return;
      onClose();
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
      clearSubMenuCloseTimer();
    };
  }, [onClose]);

  const menuW = 268;
  const adjustedX = Math.min(x, window.innerWidth - menuW - 12);
  const adjustedY = Math.min(y, window.innerHeight - 420);

  const setHeading = (level: number) => {
    if (level === 0) {
      editor.chain().focus().setParagraph().run();
    } else {
      editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 }).run();
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
    }
    onClose();
  };

  const toggleCalloutHighlight = () => {
    editor.chain().focus().toggleHighlight({ color: CALLOUT_HIGHLIGHT }).run();
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
      onClose();
    }
  };

  const handleOutdent = () => {
    if (editor.isActive('listItem')) {
      editor.chain().focus().liftListItem('listItem').run();
      onClose();
    }
  };

  const gridIconFill = (active: boolean, tint: string) => (active ? '#ffffff' : tint);

  const handleGridClick = (item: GridRowDef) => {
    if (item.type === 'heading') setHeading(item.value as number);
    else if (item.type === 'block') toggleBlock(item.value as string);
    else if (item.type === 'highlight') toggleCalloutHighlight();
    else onClose();
  };

  const submenuIconStroke = { strokeWidth: 2.75 };
  const addBelowGridStroke = 1.65;
  const addBelowListStroke = 1.55;

  const inList = editor.isActive('listItem');
  const currentAlign = getCurrentTextAlign(editor);

  const alignFlyout =
    subMenu === 'align' &&
    alignFlyoutPos &&
    createPortal(
      <div
        ref={alignFlyoutRef}
        className="context-submenu-flyout context-align-flyout"
        style={{
          position: 'fixed',
          top: alignFlyoutPos.top,
          left: alignFlyoutPos.left,
          zIndex: 10060,
        }}
        onMouseEnter={clearSubMenuCloseTimer}
        onMouseLeave={scheduleSubmenuClose}
        onMouseDown={e => e.preventDefault()}
      >
        {ALIGN_OPTIONS.map(a => {
          const active = currentAlign === a.value;
          return (
            <button
              key={a.value}
              type="button"
              className={`context-align-row ${active ? 'context-align-row--active' : ''}`}
              onClick={() => setAlign(a.value)}
            >
              <span className="context-menu-icon">
                <a.Icon {...submenuIconStroke} size={16} fill={active ? PRIMARY : ICON_MUTED} />
              </span>
              <span className="context-align-label">{a.label}</span>
              {active && (
                <span className="context-align-check" aria-hidden>
                  ✓
                </span>
              )}
            </button>
          );
        })}
        <div className="context-menu-divider context-menu-divider--inset context-menu-divider--flyout" />
        <button
          type="button"
          className={`context-align-row ${!inList ? 'context-align-row--disabled' : ''}`}
          disabled={!inList}
          title={!inList ? '列表项内可用' : undefined}
          onClick={handleIndent}
        >
          <span className="context-menu-icon">
            <IndentRight {...submenuIconStroke} size={16} fill={!inList ? '#c5c9ce' : ICON_MUTED} />
          </span>
          <span className="context-align-label">增加缩进</span>
          {!inList && (
            <span className="context-align-help" title="仅在列表项中可用" aria-hidden>
              <HelpCircle size={14} strokeWidth={2} fill="#c5c9ce" />
            </span>
          )}
        </button>
        <button
          type="button"
          className={`context-align-row ${!inList ? 'context-align-row--disabled' : ''}`}
          disabled={!inList}
          title={!inList ? '列表项内可用' : undefined}
          onClick={handleOutdent}
        >
          <span className="context-menu-icon">
            <IndentLeft {...submenuIconStroke} size={16} fill={!inList ? '#c5c9ce' : ICON_MUTED} />
          </span>
          <span className="context-align-label">减少缩进</span>
        </button>
      </div>,
      document.body,
    );

  const colorFlyout =
    subMenu === 'color' &&
    colorFlyoutPos &&
    createPortal(
      <div
        ref={colorFlyoutRef}
        className="context-submenu-flyout context-color-flyout"
        style={{
          position: 'fixed',
          top: colorFlyoutPos.top,
          left: colorFlyoutPos.left,
          zIndex: 10060,
        }}
        onMouseEnter={clearSubMenuCloseTimer}
        onMouseLeave={scheduleSubmenuClose}
        onMouseDown={e => e.preventDefault()}
      >
        <FeishuColorPickerPanel editor={editor} onAfterPick={onClose} />
      </div>,
      document.body,
    );

  const addBelowFlyout =
    subMenu === 'addBelow' &&
    addBelowFlyoutPos &&
    createPortal(
      <div
        ref={addBelowFlyoutRef}
        className="slash-menu slash-menu-feishu context-add-below-flyout"
        style={{
          position: 'fixed',
          top: addBelowFlyoutPos.top,
          left: addBelowFlyoutPos.left,
          zIndex: 10060,
        }}
        onMouseEnter={clearSubMenuCloseTimer}
        onMouseLeave={scheduleSubmenuClose}
        onMouseDown={e => e.preventDefault()}
      >
        {SLASH_SECTIONS.map(section => (
          <div
            key={section.title}
            className={`slash-section slash-section--${section.layout}${section.gridMuted ? ' slash-section--grid-muted' : ''}`}
          >
            <div className="slash-section-title">{section.title}</div>
            {section.layout === 'grid' ? (
              <div className="slash-basic-grid">
                {section.items.map(item => {
                  const Icon = item.Icon;
                  const tint = item.iconColor ?? '#1f2329';
                  return (
                    <button
                      key={`${section.title}-${item.label}`}
                      type="button"
                      className="slash-basic-cell"
                      title={item.label}
                      onMouseDown={e => {
                        e.preventDefault();
                        insertBelowSlashItem(editor, section.title, item);
                        onClose();
                      }}
                    >
                      <span className="slash-basic-cell-icon" style={{ '--slash-icon-tint': tint } as CSSProperties}>
                        <Icon size={18} strokeWidth={addBelowGridStroke} fill={tint} />
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              section.items.map(item => {
                const Icon = item.Icon;
                const tint = item.iconColor ?? '#1f2329';
                return (
                  <div
                    key={`${section.title}-${item.label}`}
                    className="slash-item"
                    role="button"
                    tabIndex={0}
                    title={item.label}
                    onMouseDown={e => {
                      e.preventDefault();
                      insertBelowSlashItem(editor, section.title, item);
                      onClose();
                    }}
                  >
                    <span className="slash-icon-wrap" style={{ '--slash-icon-tint': tint } as CSSProperties}>
                      <Icon size={18} strokeWidth={addBelowListStroke} fill={tint} />
                    </span>
                    <span className="slash-label">{item.label}</span>
                    {item.hasArrow && (
                      <span className="slash-arrow" aria-hidden>
                        <IconChevronMenuEnd size={14} color="#8f959e" />
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ))}
      </div>,
      document.body,
    );

  return (
    <Fragment>
    <div ref={menuRef} className="context-menu context-menu-feishu" style={{ left: adjustedX, top: adjustedY }}>
      <div className="context-menu-section context-menu-section--grid">
        <div className="context-block-types">
          {ROW_1.map(item => {
            const active = isGridActive(editor, item);
            const Icon = item.Icon;
            const fill = gridIconFill(active, item.tint);
            return (
              <button
                key={`r1-${item.value}`}
                type="button"
                className={`context-block-btn ${active ? 'active' : ''}`}
                title={item.label}
                onClick={() => handleGridClick(item)}
              >
                <Icon size={17} strokeWidth={1.65} fill={fill} />
              </button>
            );
          })}
        </div>
        <div className="context-block-types">
          {ROW_2.map(item => {
            const active = isGridActive(editor, item);
            const Icon = item.Icon;
            const fill = gridIconFill(active, item.tint);
            return (
              <button
                key={`r2-${item.value}`}
                type="button"
                className={`context-block-btn ${active ? 'active' : ''}`}
                title={item.label}
                onClick={() => handleGridClick(item)}
              >
                <Icon size={17} strokeWidth={1.65} fill={fill} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="context-menu-divider" />

      <div
        ref={alignTriggerRef}
        className="context-menu-item has-submenu"
        onMouseEnter={() => {
          clearSubMenuCloseTimer();
          setSubMenu('align');
        }}
        onMouseLeave={scheduleSubmenuClose}
      >
        <span className="context-menu-icon">
          <ContextGlyphTypography size={18} fill={ICON_MUTED} />
        </span>
        <span style={{ flex: 1 }}>缩进和对齐</span>
        <span className="context-menu-arrow-feishu">
          <IconChevronMenuEnd size={14} />
        </span>
      </div>

      <div
        ref={colorTriggerRef}
        className="context-menu-item has-submenu"
        onMouseEnter={() => {
          clearSubMenuCloseTimer();
          setSubMenu('color');
        }}
        onMouseLeave={scheduleSubmenuClose}
      >
        <span className="context-menu-icon">
          <ContextGlyphStyleColor size={18} fill={ICON_MUTED} />
        </span>
        <span style={{ flex: 1 }}>颜色</span>
        <span className="context-menu-arrow-feishu">
          <IconChevronMenuEnd size={14} />
        </span>
      </div>

      <div className="context-menu-divider" />

      <button type="button" className="context-menu-item" onClick={handleCut}>
        <span className="context-menu-icon">
          <ContextGlyphCut size={18} fill={FEISHU_GREEN} />
        </span>
        <span style={{ flex: 1 }}>剪切</span>
        <span className="context-menu-shortcut">Ctrl+X</span>
      </button>
      <button type="button" className="context-menu-item" onClick={handleCopy}>
        <span className="context-menu-icon">
          <ContextGlyphCopy size={18} fill={PRIMARY} />
        </span>
        <span style={{ flex: 1 }}>复制</span>
        <span className="context-menu-shortcut">Ctrl+C</span>
      </button>
      <div className="context-menu-item context-menu-item--disabled has-submenu">
        <span className="context-menu-icon">
          <ContextGlyphTranslate size={18} fill={ICON_MUTED} />
        </span>
        <span style={{ flex: 1 }}>翻译</span>
        <span className="context-menu-arrow-feishu">
          <IconChevronMenuEnd size={14} />
        </span>
      </div>
      <button type="button" className="context-menu-item context-menu-item--danger" onClick={handleDelete}>
        <span className="context-menu-icon">
          <ContextGlyphDelete size={18} fill={FEISHU_DANGER} />
        </span>
        <span style={{ flex: 1, color: FEISHU_DANGER }}>删除</span>
        <span className="context-menu-shortcut">Del</span>
      </button>

      <div className="context-menu-divider" />

      <button type="button" className="context-menu-item" onClick={onClose}>
        <span className="context-menu-icon">
          <ContextGlyphShare size={18} fill={PRIMARY} />
        </span>
        <span style={{ flex: 1 }}>分享</span>
      </button>
      <button type="button" className="context-menu-item" onClick={onClose}>
        <span className="context-menu-icon context-menu-icon--subdoc">
          <SlashGlyphSubDoc size={18} fill={PRIMARY} />
        </span>
        <span style={{ flex: 1 }}>转换为子文档</span>
      </button>
      <button type="button" className="context-menu-item" onClick={onClose}>
        <span className="context-menu-icon">
          <ContextGlyphTemplate size={18} fill={ICON_MUTED} />
        </span>
        <span style={{ flex: 1 }}>保存为模板</span>
      </button>
      <button type="button" className="context-menu-item" onClick={onClose}>
        <span className="context-menu-icon">
          <ContextGlyphBlockLink size={18} fill={PRIMARY} />
        </span>
        <span style={{ flex: 1 }}>复制链接</span>
      </button>

      <div className="context-menu-divider" />

      <div
        ref={addBelowTriggerRef}
        className="context-menu-item has-submenu"
        onMouseEnter={() => {
          clearSubMenuCloseTimer();
          setSubMenu('addBelow');
        }}
        onMouseLeave={scheduleSubmenuClose}
      >
        <span className="context-menu-icon">
          <ContextGlyphAddBelow size={18} fill={ICON_MUTED} />
        </span>
        <span style={{ flex: 1 }}>在下方添加</span>
        <span className="context-menu-arrow-feishu">
          <IconChevronMenuEnd size={14} />
        </span>
      </div>
    </div>
    {alignFlyout}
    {colorFlyout}
    {addBelowFlyout}
    </Fragment>
  );
}
