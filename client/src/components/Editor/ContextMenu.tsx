import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
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
  SlashGlyphHeading4,
  SlashGlyphOrderedList,
  SlashGlyphBulletList,
  SlashGlyphTaskList,
  SlashGlyphCode,
  SlashGlyphQuote,
  SlashGlyphDivider,
  SlashGlyphSubDoc,
  SlashGlyphLink,
} from '../../icons/slashMenuGlyphs';
import { IconChevronMenuEnd } from '../../icons/feishuDoc';
import { SLASH_SECTIONS } from './slashMenuConfig';
import {
  ADD_BELOW_FLYOUT_MAX_HEIGHT,
  clampFlyoutHeight,
  computeSubmenuFlyoutPosition,
} from './contextSubmenuFlyout';
import { insertBelowSlashItem } from './insertBelowBlocks';
import FeishuColorPickerPanel from './FeishuColorPickerPanel';
import { syncEditorSelectionToAnchoredBlock } from './blockAnchorSelection';
import { copyCurrentBlockLink } from './blockLink';
import {
  getEditorIndentUiState,
  applyEditorIndentIncrease,
  applyEditorIndentDecrease,
} from './blockIndent';
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
  /** 块柄按钮：指针移回标签时保持面板打开；离开整套 UI 时收起 */
  anchorRef?: RefObject<HTMLElement | null>;
  /** 块柄所对准的块级 DOM（常与当前选区不在同一块）；操作时先对齐选区 */
  blockAnchorRef?: RefObject<HTMLElement | null>;
  /** 鼠标离开面板区域时的收起（可与 onClose 分流以顺便收起块柄） */
  onHoverDismiss?: () => void;
  /** 鼠标进入面板时取消父级延时关闭 */
  onMouseEnterCancel?: () => void;
}

type RowKind = 'heading' | 'block' | 'highlight' | 'noop' | 'insertLink';

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
  /** 悬停提示：第一行为"名称 (快捷键)"，第二行为 Markdown 语法 */
  tooltip?: { shortcut?: string; markdown?: string };
}

const TBOX = FEISHU_TOOLBOX;

/** 与飞书 flatten-item-list 顺序、语义色一致 */
const ROW_1: GridRowDef[] = [
  { label: '正文', value: 0, type: 'heading', Icon: ContextGlyphText, tint: TBOX.b500 },
  { label: '一级标题', value: 1, type: 'heading', Icon: SlashGlyphHeading1, tint: TBOX.b500, tooltip: { shortcut: 'Ctrl + Alt + 1', markdown: '# 空格' } },
  { label: '二级标题', value: 2, type: 'heading', Icon: SlashGlyphHeading2, tint: TBOX.b500, tooltip: { shortcut: 'Ctrl + Alt + 2', markdown: '## 空格' } },
  { label: '三级标题', value: 3, type: 'heading', Icon: SlashGlyphHeading3, tint: TBOX.b500, tooltip: { shortcut: 'Ctrl + Alt + 3', markdown: '### 空格' } },
  { label: '四级标题', value: 4, type: 'heading', Icon: SlashGlyphHeading4, tint: TBOX.b500, tooltip: { shortcut: 'Ctrl + Alt + 4', markdown: '#### 空格' } },
  { label: '有序列表', value: 'orderedList', type: 'block', Icon: SlashGlyphOrderedList, tint: TBOX.i500, tooltip: { shortcut: 'Ctrl + Shift + 7', markdown: '1. 空格' } },
];

const ROW_2: GridRowDef[] = [
  { label: '无序列表', value: 'bulletList', type: 'block', Icon: SlashGlyphBulletList, tint: TBOX.i500, tooltip: { shortcut: 'Ctrl + Shift + 8', markdown: '- 空格' } },
  { label: '待办事项', value: 'taskList', type: 'block', Icon: SlashGlyphTaskList, tint: TBOX.i500, tooltip: { shortcut: 'Ctrl + Shift + 9', markdown: '[] 空格' } },
  { label: '代码块', value: 'codeBlock', type: 'block', Icon: SlashGlyphCode, tint: TBOX.g500, tooltip: { markdown: '``` 空格' } },
  { label: '引用', value: 'blockquote', type: 'block', Icon: SlashGlyphQuote, tint: TBOX.b500, tooltip: { markdown: '> 空格' } },
  { label: '分割线', value: 'horizontalRule', type: 'block', Icon: SlashGlyphDivider, tint: TBOX.i500, tooltip: { markdown: '--- 回车' } },
  { label: '链接', value: 'insertLink', type: 'insertLink', Icon: SlashGlyphLink, tint: TBOX.b500, tooltip: { shortcut: 'Ctrl + K' } },
];

/** 与飞书 flatten-item-list 一致：单行 flex 自动换行 */
const BLOCK_TYPE_ICON_GRID: GridRowDef[] = [...ROW_1, ...ROW_2];

const ALIGN_OPTIONS = [
  { label: '左对齐', value: 'left', Icon: AlignTextLeft },
  { label: '居中对齐', value: 'center', Icon: AlignTextCenter },
  { label: '右对齐', value: 'right', Icon: AlignTextRight },
] as const;

const PRIMARY = TBOX.b500;
const ICON_MUTED = '#373c43';

function isGridActive(editor: Editor, item: GridRowDef): boolean {
  if (item.type === 'heading') {
    if (item.value === 0) return editor.isActive('paragraph');
    return editor.isActive('heading', { level: item.value as 1 | 2 | 3 | 4 | 5 | 6 });
  }
  if (item.type === 'block') return editor.isActive(item.value as string);
  if (item.type === 'highlight') {
    return editor.isActive('highlightBlock');
  }
  if (item.type === 'insertLink') {
    return editor.isActive('link');
  }
  return false;
}

function getCurrentTextAlign(editor: Editor): string {
  const p = editor.getAttributes('paragraph').textAlign as string | undefined;
  const h = editor.getAttributes('heading').textAlign as string | undefined;
  return (p || h || 'left') as string;
}

export default function ContextMenu({ editor, x, y, onClose, anchorRef, blockAnchorRef, onHoverDismiss, onMouseEnterCancel }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const alignTriggerRef = useRef<HTMLDivElement>(null);
  const colorTriggerRef = useRef<HTMLDivElement>(null);
  const addBelowTriggerRef = useRef<HTMLDivElement>(null);
  const alignFlyoutRef = useRef<HTMLDivElement>(null);
  const colorFlyoutRef = useRef<HTMLDivElement>(null);
  const addBelowFlyoutRef = useRef<HTMLDivElement>(null);
  const subMenuCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [subMenu, setSubMenu] = useState<string | null>(null);
  const [alignFlyoutPos, setAlignFlyoutPos] = useState<{ top: number; left: number } | null>(null);
  const [colorFlyoutPos, setColorFlyoutPos] = useState<{ top: number; left: number } | null>(null);
  const [addBelowFlyoutPos, setAddBelowFlyoutPos] = useState<{ top: number; left: number } | null>(null);
  const [finalPos, setFinalPos] = useState<{ x: number; y: number }>({ x, y });
  const [posVisible, setPosVisible] = useState(false);
  const [gridTooltip, setGridTooltip] = useState<{ item: GridRowDef; rect: DOMRect } | null>(null);
  const gridTooltipTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const showGridTooltip = (item: GridRowDef, el: HTMLElement) => {
    clearTimeout(gridTooltipTimerRef.current);
    gridTooltipTimerRef.current = setTimeout(() => {
      setGridTooltip({ item, rect: el.getBoundingClientRect() });
    }, 400);
  };

  const hideGridTooltip = () => {
    clearTimeout(gridTooltipTimerRef.current);
    setGridTooltip(null);
  };

  const alignSelectionToBlockAnchor = () =>
    syncEditorSelectionToAnchoredBlock(editor, blockAnchorRef?.current ?? null);

  const hasGridTooltip = (item: GridRowDef) =>
    item.tooltip && (item.tooltip.shortcut || item.tooltip.markdown);

  const clearSubMenuCloseTimer = () => {
    if (subMenuCloseTimerRef.current) {
      clearTimeout(subMenuCloseTimerRef.current);
      subMenuCloseTimerRef.current = null;
    }
  };

  const clearHoverDismissTimer = () => {
    if (hoverDismissTimerRef.current) {
      clearTimeout(hoverDismissTimerRef.current);
      hoverDismissTimerRef.current = null;
    }
  };

  const dismissByHover = () => {
    clearHoverDismissTimer();
    (onHoverDismiss ?? onClose)();
  };

  const scheduleHoverDismiss = () => {
    clearHoverDismissTimer();
    hoverDismissTimerRef.current = window.setTimeout(() => {
      hoverDismissTimerRef.current = null;
      dismissByHover();
    }, 250);
  };

  const pointerStillInShell = (next: EventTarget | null): boolean => {
    if (!next || !(next instanceof Element)) return false;
    if (menuRef.current?.contains(next)) return true;
    if (alignFlyoutRef.current?.contains(next)) return true;
    if (colorFlyoutRef.current?.contains(next)) return true;
    if (addBelowFlyoutRef.current?.contains(next)) return true;
    if (anchorRef?.current?.contains(next)) return true;
    if (next.closest('.block-inline-tools')) return true;
    if (next.closest('.context-menu')) return true;
    if (next.closest('.context-submenu-flyout')) return true;
    if (next.closest('.context-add-below-flyout')) return true;
    return false;
  };

  const scheduleSubmenuClose = () => {
    clearSubMenuCloseTimer();
    subMenuCloseTimerRef.current = setTimeout(() => setSubMenu(null), 220);
  };

  const handleShellMouseLeave = (e: React.MouseEvent) => {
    if (pointerStillInShell(e.relatedTarget)) return;
    scheduleHoverDismiss();
  };

  const handleFlyoutMouseLeave = (e: React.MouseEvent) => {
    scheduleSubmenuClose();
    handleShellMouseLeave(e);
  };

  // After first render, measure actual menu dimensions and reposition to stay within viewport
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const pad = 8;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const fx = Math.max(pad, Math.min(x, vw - rect.width - pad));
    const fy = Math.max(pad, Math.min(y, vh - rect.height - pad));
    setFinalPos({ x: fx, y: fy });
    setPosVisible(true);
  }, [x, y]);

  useLayoutEffect(() => {
    setAlignFlyoutPos(null);
    setColorFlyoutPos(null);
    setAddBelowFlyoutPos(null);

    const pad = 8;
    /** 与主菜单侧边紧贴，避免视觉缝隙 */
    const gap = 0;

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
      const positionAddBelow = () => {
        const el = addBelowTriggerRef.current;
        if (!el) return;
        const panelH = clampFlyoutHeight(
          addBelowFlyoutRef.current?.scrollHeight ?? ADD_BELOW_FLYOUT_MAX_HEIGHT,
        );
        setAddBelowFlyoutPos(
          computeSubmenuFlyoutPosition({
            trigger: el.getBoundingClientRect(),
            panelWidth: 248,
            panelHeight: panelH,
            gap,
            pad,
          }),
        );
      };
      positionAddBelow();
      requestAnimationFrame(positionAddBelow);
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
      clearHoverDismissTimer();
      clearTimeout(gridTooltipTimerRef.current);
    };
  }, [onClose]);



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
      case 'paragraph':
        if (editor.isActive('highlightBlock')) {
          editor.chain().focus().lift('highlightBlock').setParagraph().run();
        } else {
          editor.chain().focus().setParagraph().run();
        }
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

  const toggleCalloutHighlight = () => {
    editor.chain().focus().toggleWrap('highlightBlock', {
      bgColor: '#fff0d9',
      borderColor: '#ffb057',
    }).run();
    onClose();
  };

  const setAlign = (align: string) => {
    alignSelectionToBlockAnchor();
    editor.chain().focus().setTextAlign(align).run();
    onClose();
  };

  const handleCut = () => {
    alignSelectionToBlockAnchor();
    document.execCommand('cut');
    onClose();
  };

  const handleCopy = () => {
    alignSelectionToBlockAnchor();
    document.execCommand('copy');
    onClose();
  };

  const handleCopyBlockLink = async () => {
    alignSelectionToBlockAnchor();
    await copyCurrentBlockLink(editor);
    onClose();
  };

  const handleDelete = () => {
    alignSelectionToBlockAnchor();
    editor.chain().focus().deleteSelection().run();
    onClose();
  };

  const handleIndent = () => {
    alignSelectionToBlockAnchor();
    applyEditorIndentIncrease(editor);
    onClose();
  };

  const handleOutdent = () => {
    alignSelectionToBlockAnchor();
    applyEditorIndentDecrease(editor);
    onClose();
  };

  const gridIconFill = (active: boolean, _tint: string) => (active ? '#ffffff' : ICON_MUTED);

  const handleGridClick = (item: GridRowDef) => {
    if (item.type === 'noop') {
      onClose();
      return;
    }
    alignSelectionToBlockAnchor();
    if (item.type === 'heading') setHeading(item.value as number);
    else if (item.type === 'block') toggleBlock(item.value as string);
    else if (item.type === 'highlight') toggleCalloutHighlight();
    else if (item.type === 'insertLink') {
      window.dispatchEvent(new CustomEvent('feishu-open-page-link-dialog'));
      onClose();
    }
    else onClose();
  };

  const submenuIconStroke = { strokeWidth: 2.75 };
  const addBelowGridStroke = 1.65;
  const addBelowListStroke = 1.55;

  const indentUi = getEditorIndentUiState(editor);
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
        onMouseEnter={() => {
          clearSubMenuCloseTimer();
          clearHoverDismissTimer();
          onMouseEnterCancel?.();
        }}
        onMouseLeave={handleFlyoutMouseLeave}
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
          className={`context-align-row ${!indentUi.canIncrease ? 'context-align-row--disabled' : ''}`}
          disabled={!indentUi.canIncrease}
          title={!indentUi.canIncrease ? indentUi.increaseDisabledTitle : undefined}
          onClick={handleIndent}
        >
          <span className="context-menu-icon">
            <IndentRight {...submenuIconStroke} size={16} fill={!indentUi.canIncrease ? '#c5c9ce' : ICON_MUTED} />
          </span>
          <span className="context-align-label">增加缩进</span>
          {!indentUi.canIncrease && indentUi.increaseDisabledTitle && (
            <span className="context-align-help" title={indentUi.increaseDisabledTitle} aria-hidden>
              <HelpCircle size={14} strokeWidth={2} fill="#c5c9ce" />
            </span>
          )}
        </button>
        <button
          type="button"
          className={`context-align-row ${!indentUi.canDecrease ? 'context-align-row--disabled' : ''}`}
          disabled={!indentUi.canDecrease}
          title={!indentUi.canDecrease ? indentUi.decreaseDisabledTitle : undefined}
          onClick={handleOutdent}
        >
          <span className="context-menu-icon">
            <IndentLeft {...submenuIconStroke} size={16} fill={!indentUi.canDecrease ? '#c5c9ce' : ICON_MUTED} />
          </span>
          <span className="context-align-label">减少缩进</span>
          {!indentUi.canDecrease && indentUi.decreaseDisabledTitle && (
            <span className="context-align-help" title={indentUi.decreaseDisabledTitle} aria-hidden>
              <HelpCircle size={14} strokeWidth={2} fill="#c5c9ce" />
            </span>
          )}
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
        onMouseEnter={() => {
          clearSubMenuCloseTimer();
          clearHoverDismissTimer();
          onMouseEnterCancel?.();
        }}
        onMouseLeave={handleFlyoutMouseLeave}
        onMouseDown={e => e.preventDefault()}
      >
        <FeishuColorPickerPanel editor={editor} onBeforeApply={alignSelectionToBlockAnchor} onAfterPick={onClose} />
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
          maxHeight: clampFlyoutHeight(ADD_BELOW_FLYOUT_MAX_HEIGHT),
          overflowY: 'auto',
          zIndex: 10060,
        }}
        onMouseEnter={() => {
          clearSubMenuCloseTimer();
          clearHoverDismissTimer();
          onMouseEnterCancel?.();
        }}
        onMouseLeave={handleFlyoutMouseLeave}
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
                        alignSelectionToBlockAnchor();
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
                      alignSelectionToBlockAnchor();
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
    <div
      ref={menuRef}
      className="context-menu context-menu-feishu"
      style={{ left: finalPos.x, top: finalPos.y, visibility: posVisible ? 'visible' : 'hidden' }}
      onMouseEnter={() => { clearHoverDismissTimer(); onMouseEnterCancel?.(); }}
      onMouseLeave={(e) => { hideGridTooltip(); handleShellMouseLeave(e); }}
      onScroll={hideGridTooltip}
    >
      <div className="context-menu-section context-menu-section--grid">
        <div className="context-block-types context-block-types--icon-grid">
          {BLOCK_TYPE_ICON_GRID.map(item => {
            const active = isGridActive(editor, item);
            const Icon = item.Icon;
            const fill = gridIconFill(active, item.tint);
            return (
              <button
                key={`grid-${item.type}-${item.value}`}
                type="button"
                className={`context-block-btn ${active ? 'active' : ''}`}
                title={hasGridTooltip(item) ? undefined : item.label}
                onMouseEnter={e => {
                  if (hasGridTooltip(item)) showGridTooltip(item, e.currentTarget);
                }}
                onMouseLeave={hideGridTooltip}
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
          clearHoverDismissTimer();
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
          clearHoverDismissTimer();
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
          <ContextGlyphCut size={18} fill={ICON_MUTED} />
        </span>
        <span style={{ flex: 1 }}>剪切</span>
        <span className="context-menu-shortcut">Ctrl+X</span>
      </button>
      <button type="button" className="context-menu-item" onClick={handleCopy}>
        <span className="context-menu-icon">
          <ContextGlyphCopy size={18} fill={ICON_MUTED} />
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
          <ContextGlyphDelete size={18} fill={ICON_MUTED} />
        </span>
        <span style={{ flex: 1 }}>删除</span>
        <span className="context-menu-shortcut">Del</span>
      </button>

      <div className="context-menu-divider" />

      <button type="button" className="context-menu-item" onClick={onClose}>
        <span className="context-menu-icon">
          <ContextGlyphShare size={18} fill={ICON_MUTED} />
        </span>
        <span style={{ flex: 1 }}>分享</span>
      </button>
      <button type="button" className="context-menu-item" onClick={onClose}>
        <span className="context-menu-icon context-menu-icon--subdoc">
          <SlashGlyphSubDoc size={18} fill={ICON_MUTED} />
        </span>
        <span style={{ flex: 1 }}>转换为子文档</span>
      </button>
      <button type="button" className="context-menu-item" onClick={onClose}>
        <span className="context-menu-icon">
          <ContextGlyphTemplate size={18} fill={ICON_MUTED} />
        </span>
        <span style={{ flex: 1 }}>保存为模板</span>
      </button>
      <button type="button" className="context-menu-item" onClick={handleCopyBlockLink}>
        <span className="context-menu-icon">
          <ContextGlyphBlockLink size={18} fill={ICON_MUTED} />
        </span>
        <span style={{ flex: 1 }}>复制链接</span>
      </button>

      <div className="context-menu-divider" />

      <div
        ref={addBelowTriggerRef}
        className="context-menu-item has-submenu"
        onMouseEnter={() => {
          clearSubMenuCloseTimer();
          clearHoverDismissTimer();
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
    {gridTooltip && hasGridTooltip(gridTooltip.item) && createPortal(
      <div
        className="context-grid-tooltip"
        style={{
          position: 'fixed',
          top: gridTooltip.rect.top - 8,
          left: gridTooltip.rect.left + gridTooltip.rect.width / 2,
          transform: 'translate(-50%, -100%)',
          zIndex: 10070,
        }}
      >
        <div className="context-grid-tooltip__line1">
          {gridTooltip.item.label}
          {gridTooltip.item.tooltip!.shortcut && (
            <span className="context-grid-tooltip__shortcut"> ({gridTooltip.item.tooltip!.shortcut})</span>
          )}
        </div>
        {gridTooltip.item.tooltip!.markdown && (
          <div className="context-grid-tooltip__line2">
            Markdown: {gridTooltip.item.tooltip!.markdown}
          </div>
        )}
      </div>,
      document.body,
    )}
    </Fragment>
  );
}
