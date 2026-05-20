import { Fragment, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/react';
import {
  FormatVerticalAlignCenterIcon,
  FormatVerticalAlignLeftIcon,
  FormatVerticalAlignRightIcon,
  IndentRightIcon,
  IndentLeftIcon,
} from 'tdesign-icons-react';
import { wrapIcon } from '../../icons/wrap';
import {
  ContextGlyphCut,
  ContextGlyphCopy,
  ContextGlyphDelete,
  ContextGlyphShare,
  ContextGlyphTemplate,
  ContextGlyphBlockLink,
  ContextGlyphAddBelow,
  FEISHU_TOOLBOX,
} from '../../icons/contextMenuGlyphs';
import { SlashGlyphSync } from '../../icons/slashMenuGlyphs';
import { IconChevronMenuEnd } from '../../icons/feishuDoc';
import { SLASH_SECTIONS } from './slashMenuConfig';
import { insertBelowSlashItem } from './insertBelowBlocks';
import { syncEditorSelectionToAnchoredBlock } from './blockAnchorSelection';
import { copyCurrentBlockLink } from './blockLink';
import {
  getEditorIndentUiState,
  applyEditorIndentIncrease,
  applyEditorIndentDecrease,
} from './blockIndent';
import {
  ADD_BELOW_FLYOUT_MAX_HEIGHT,
  clampFlyoutHeight,
  computeSubmenuFlyoutPosition,
} from './contextSubmenuFlyout';
import { getActiveTableFlags } from './tableMenu';
import { getActiveTableContext } from './tableInsert';
import './ContextMenu.less';
import './SlashMenu.less';

const AlignTextLeft = wrapIcon(FormatVerticalAlignLeftIcon);
const AlignTextCenter = wrapIcon(FormatVerticalAlignCenterIcon);
const AlignTextRight = wrapIcon(FormatVerticalAlignRightIcon);
const IndentRight = wrapIcon(IndentRightIcon);
const IndentLeft = wrapIcon(IndentLeftIcon);

const PRIMARY = FEISHU_TOOLBOX.b500;
const ICON_MUTED = '#373c43';

const ALIGN_OPTIONS = [
  { label: '左对齐', value: 'left', Icon: AlignTextLeft },
  { label: '居中对齐', value: 'center', Icon: AlignTextCenter },
  { label: '右对齐', value: 'right', Icon: AlignTextRight },
] as const;

interface Props {
  editor: Editor;
  x: number;
  y: number;
  onClose: () => void;
  anchorRef?: RefObject<HTMLElement | null>;
  blockAnchorRef?: RefObject<HTMLElement | null>;
  onHoverDismiss?: () => void;
  onMouseEnterCancel?: () => void;
}

function getCurrentTextAlign(editor: Editor): string {
  const p = editor.getAttributes('paragraph').textAlign as string | undefined;
  return (p || 'left') as string;
}

export default function TableContextMenu({
  editor,
  x,
  y,
  onClose,
  anchorRef,
  blockAnchorRef,
  onHoverDismiss,
  onMouseEnterCancel,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const indentTriggerRef = useRef<HTMLDivElement>(null);
  const addBelowTriggerRef = useRef<HTMLDivElement>(null);
  const indentFlyoutRef = useRef<HTMLDivElement>(null);
  const addBelowFlyoutRef = useRef<HTMLDivElement>(null);
  const subMenuCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [subMenu, setSubMenu] = useState<string | null>(null);
  const [indentFlyoutPos, setIndentFlyoutPos] = useState<{ top: number; left: number } | null>(null);
  const [addBelowFlyoutPos, setAddBelowFlyoutPos] = useState<{ top: number; left: number } | null>(null);
  const [finalPos, setFinalPos] = useState({ x, y });
  const [posVisible, setPosVisible] = useState(false);

  const tableFlags = getActiveTableFlags(editor);
  const indentUi = getEditorIndentUiState(editor);
  const currentAlign = getCurrentTextAlign(editor);

  const alignSelectionToBlockAnchor = () =>
    syncEditorSelectionToAnchoredBlock(editor, blockAnchorRef?.current ?? null);

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
    if (indentFlyoutRef.current?.contains(next)) return true;
    if (addBelowFlyoutRef.current?.contains(next)) return true;
    if (anchorRef?.current?.contains(next)) return true;
    if (next.closest('.feishu-table-chrome')) return true;
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
    setIndentFlyoutPos(null);
    setAddBelowFlyoutPos(null);
    if (subMenu !== 'indent' && subMenu !== 'addBelow') return;

    const updateFlyouts = () => {
      if (subMenu === 'indent') {
        const el = indentTriggerRef.current;
        if (!el) return;
        const panelMaxH = 320;
        setIndentFlyoutPos(
          computeSubmenuFlyoutPosition({
            trigger: el.getBoundingClientRect(),
            panelWidth: 216,
            panelHeight: panelMaxH,
          }),
        );
        return;
      }

      if (subMenu === 'addBelow') {
        const el = addBelowTriggerRef.current;
        if (!el) return;
        const flyout = addBelowFlyoutRef.current;
        const panelH = clampFlyoutHeight(
          flyout?.scrollHeight ?? ADD_BELOW_FLYOUT_MAX_HEIGHT,
        );
        setAddBelowFlyoutPos(
          computeSubmenuFlyoutPosition({
            trigger: el.getBoundingClientRect(),
            panelWidth: 280,
            panelHeight: panelH,
          }),
        );
      }
    };

    updateFlyouts();
    if (subMenu === 'addBelow') {
      requestAnimationFrame(updateFlyouts);
    }
  }, [subMenu]);

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

  const handleDelete = () => {
    alignSelectionToBlockAnchor();
    const ctx = getActiveTableContext(editor);
    if (ctx) {
      editor.chain().focus().deleteTable().run();
    } else {
      editor.chain().focus().deleteSelection().run();
    }
    onClose();
  };

  const handleCopyBlockLink = () => {
    alignSelectionToBlockAnchor();
    copyCurrentBlockLink(editor);
    onClose();
  };

  const setAlign = (value: string) => {
    alignSelectionToBlockAnchor();
    editor.chain().focus().setTextAlign(value).run();
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

  const insertSyncBelow = () => {
    alignSelectionToBlockAnchor();
    const ctx = getActiveTableContext(editor);
    if (!ctx) return;
    const table = editor.state.doc.nodeAt(ctx.tablePos);
    if (!table) return;
    const pos = ctx.tablePos + table.nodeSize;
    editor
      .chain()
      .focus()
      .insertContentAt(pos, { type: 'localSyncBlock', content: [{ type: 'paragraph' }] })
      .run();
    onClose();
  };

  const handleDistributeColumns = () => {
    alignSelectionToBlockAnchor();
    editor.commands.fixTables();
    onClose();
  };

  const submenuIconStroke = { strokeWidth: 2.75 };

  const indentFlyout =
    subMenu === 'indent' &&
    indentFlyoutPos &&
    createPortal(
      <div
        ref={indentFlyoutRef}
        className="context-submenu-flyout context-align-flyout"
        style={{ position: 'fixed', top: indentFlyoutPos.top, left: indentFlyoutPos.left, zIndex: 10060 }}
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
              {active && <span className="context-align-check" aria-hidden>✓</span>}
            </button>
          );
        })}
        <div className="context-menu-divider context-menu-divider--inset context-menu-divider--flyout" />
        <button
          type="button"
          className={`context-align-row ${!indentUi.canIncrease ? 'context-align-row--disabled' : ''}`}
          disabled={!indentUi.canIncrease}
          onClick={handleIndent}
        >
          <span className="context-menu-icon">
            <IndentRight {...submenuIconStroke} size={16} fill={ICON_MUTED} />
          </span>
          <span className="context-align-label">增加缩进</span>
        </button>
        <button
          type="button"
          className={`context-align-row ${!indentUi.canDecrease ? 'context-align-row--disabled' : ''}`}
          disabled={!indentUi.canDecrease}
          onClick={handleOutdent}
        >
          <span className="context-menu-icon">
            <IndentLeft {...submenuIconStroke} size={16} fill={ICON_MUTED} />
          </span>
          <span className="context-align-label">减少缩进</span>
        </button>
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
                        <Icon size={18} strokeWidth={1.65} fill={tint} />
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
                    onMouseDown={e => {
                      e.preventDefault();
                      alignSelectionToBlockAnchor();
                      insertBelowSlashItem(editor, section.title, item);
                      onClose();
                    }}
                  >
                    <span className="slash-icon-wrap" style={{ '--slash-icon-tint': tint } as CSSProperties}>
                      <Icon size={18} strokeWidth={1.55} fill={tint} />
                    </span>
                    <span className="slash-label">{item.label}</span>
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
        className="context-menu context-menu-feishu context-menu-feishu--table"
        style={{ left: finalPos.x, top: finalPos.y, visibility: posVisible ? 'visible' : 'hidden' }}
        onMouseEnter={() => {
          clearHoverDismissTimer();
          onMouseEnterCancel?.();
        }}
        onMouseLeave={handleShellMouseLeave}
      >
        <button type="button" className="context-menu-item" onClick={insertSyncBelow}>
          <span className="context-menu-icon">
            <SlashGlyphSync size={18} />
          </span>
          <span style={{ flex: 1 }}>同步块</span>
        </button>

        <div
          ref={indentTriggerRef}
          className="context-menu-item has-submenu"
          onMouseEnter={() => {
            clearSubMenuCloseTimer();
            clearHoverDismissTimer();
            setSubMenu('indent');
          }}
          onMouseLeave={scheduleSubmenuClose}
        >
          <span className="context-menu-icon">
            <IndentRight size={18} strokeWidth={2} fill={ICON_MUTED} />
          </span>
          <span style={{ flex: 1 }}>缩进</span>
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

        <button
          type="button"
          className="context-menu-item context-menu-item--toggle"
          onClick={() => {
            alignSelectionToBlockAnchor();
            editor.chain().focus().toggleHeaderRow().run();
          }}
        >
          <span className="context-menu-icon">▦</span>
          <span style={{ flex: 1 }}>标题行</span>
          <span className={`context-menu-switch${tableFlags.hasHeaderRow ? ' is-on' : ''}`} aria-hidden />
        </button>
        <button
          type="button"
          className="context-menu-item context-menu-item--toggle"
          onClick={() => {
            alignSelectionToBlockAnchor();
            editor.chain().focus().toggleHeaderColumn().run();
          }}
        >
          <span className="context-menu-icon">▥</span>
          <span style={{ flex: 1 }}>标题列</span>
          <span className={`context-menu-switch${tableFlags.hasHeaderCol ? ' is-on' : ''}`} aria-hidden />
        </button>
        <button type="button" className="context-menu-item" onClick={handleDistributeColumns}>
          <span className="context-menu-icon">⇔</span>
          <span style={{ flex: 1 }}>均分列宽</span>
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
      {indentFlyout}
      {addBelowFlyout}
    </Fragment>
  );
}
