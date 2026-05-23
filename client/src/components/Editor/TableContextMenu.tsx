import { Fragment, useLayoutEffect, useRef, useState, type RefObject } from 'react';
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
import { getInsertBelowPosition, insertBelowSlashItem } from './insertBelowBlocks';
import { getActiveTableContext, insertFeishuTableAt } from './tableInsert';
import { insertFeishuColumnsAt } from './columnsInsert';
import AddBelowSlashSections from './AddBelowSlashSections';
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
import { computeTableBlockMenuPosition, getActiveTableFlags } from './tableMenu';
import { useAnchoredContextMenuPosition, useHoverFloatingGroup } from './floatingPanel';
import {
  distributeSelectedTableColumns,
  removeActiveTable,
  setTextAlignment,
  toggleTableHeaderColumn,
  toggleTableHeaderRow,
} from './panelActions';
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
  const [subMenu, setSubMenu] = useState<string | null>(null);
  const [indentFlyoutPos, setIndentFlyoutPos] = useState<{ top: number; left: number } | null>(null);
  const [addBelowFlyoutPos, setAddBelowFlyoutPos] = useState<{ top: number; left: number } | null>(null);
  const { finalPos, posVisible } = useAnchoredContextMenuPosition(
    anchorRef,
    menuRef,
    { x, y },
    computeTableBlockMenuPosition,
  );

  const tableFlags = getActiveTableFlags(editor);
  const indentUi = getEditorIndentUiState(editor);
  const currentAlign = getCurrentTextAlign(editor);

  const alignSelectionToBlockAnchor = () =>
    syncEditorSelectionToAnchoredBlock(editor, blockAnchorRef?.current ?? null);

  const dismissByHover = () => {
    (onHoverDismiss ?? onClose)();
  };

  const hoverGroup = useHoverFloatingGroup({
    refs: [menuRef, indentTriggerRef, addBelowTriggerRef, indentFlyoutRef, addBelowFlyoutRef, anchorRef],
    selectors: [
      '.feishu-table-chrome',
      '.context-menu',
      '.context-submenu-flyout',
      '.context-add-below-flyout',
      '.slash-table-grid-flyout',
      '.slash-columns-count-flyout',
    ],
    closeDelay: 160,
    onClose: () => {
      setSubMenu(null);
      dismissByHover();
    },
  });

  const pointerStillInShell = (next: EventTarget | null): boolean => {
    return hoverGroup.containsTarget(next);
  };

  const handleShellMouseLeave = (e: React.MouseEvent) => {
    if (pointerStillInShell(e.relatedTarget)) return;
    hoverGroup.scheduleClose(e.relatedTarget);
  };

  const handleFlyoutMouseLeave = (e: React.MouseEvent) => {
    if (pointerStillInShell(e.relatedTarget)) return;
    hoverGroup.scheduleClose(e.relatedTarget);
  };

  const keepHoverAlive = () => {
    hoverGroup.cancelClose();
    onMouseEnterCancel?.();
  };

  useLayoutEffect(() => {
    if (!posVisible) {
      setIndentFlyoutPos(null);
      setAddBelowFlyoutPos(null);
      return;
    }

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
    const raf = window.requestAnimationFrame(updateFlyouts);
    window.addEventListener('resize', updateFlyouts);
    document.addEventListener('scroll', updateFlyouts, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', updateFlyouts);
      document.removeEventListener('scroll', updateFlyouts, true);
    };
  }, [subMenu, finalPos.x, finalPos.y, posVisible]);

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
    removeActiveTable(editor);
    onClose();
  };

  const handleCopyBlockLink = () => {
    alignSelectionToBlockAnchor();
    copyCurrentBlockLink(editor);
    onClose();
  };

  const setAlign = (value: string) => {
    alignSelectionToBlockAnchor();
    setTextAlignment(editor, value as 'left' | 'center' | 'right');
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
    distributeSelectedTableColumns(editor);
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
        data-floating-panel="true"
        data-no-marquee-selection="true"
        style={{ position: 'fixed', top: indentFlyoutPos.top, left: indentFlyoutPos.left, zIndex: 10060 }}
        onPointerEnter={keepHoverAlive}
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
        data-floating-panel="true"
        data-no-marquee-selection="true"
        style={{
          position: 'fixed',
          top: addBelowFlyoutPos.top,
          left: addBelowFlyoutPos.left,
          maxHeight: clampFlyoutHeight(ADD_BELOW_FLYOUT_MAX_HEIGHT),
          overflowY: 'auto',
          zIndex: 10060,
        }}
        onPointerEnter={keepHoverAlive}
        onMouseLeave={handleFlyoutMouseLeave}
        onMouseDown={e => e.preventDefault()}
      >
        <AddBelowSlashSections
          onPickItem={(sectionTitle, item) => {
            alignSelectionToBlockAnchor();
            insertBelowSlashItem(editor, sectionTitle, item);
            onClose();
          }}
          onPickTable={(rows, cols) => {
            alignSelectionToBlockAnchor();
            insertFeishuTableAt(editor, getInsertBelowPosition(editor), rows, cols);
            onClose();
          }}
          onPickColumns={columnCount => {
            alignSelectionToBlockAnchor();
            insertFeishuColumnsAt(editor, getInsertBelowPosition(editor), columnCount);
            onClose();
          }}
        />
      </div>,
      document.body,
    );

  const menuPanel = (
    <div
      ref={menuRef}
      className="context-menu context-menu-feishu context-menu-feishu--table"
      data-floating-panel="true"
      data-no-marquee-selection="true"
      style={{
        position: 'fixed',
        left: finalPos.x,
        top: finalPos.y,
        zIndex: 10050,
        visibility: posVisible ? 'visible' : 'hidden',
      }}
      onPointerEnter={keepHoverAlive}
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
        onPointerEnter={() => {
          keepHoverAlive();
          setSubMenu('indent');
        }}
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
            toggleTableHeaderRow(editor);
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
            toggleTableHeaderColumn(editor);
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
          onPointerEnter={() => {
            keepHoverAlive();
            setSubMenu('addBelow');
          }}
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
  );

  return createPortal(
    <Fragment>
      {menuPanel}
      {indentFlyout}
      {addBelowFlyout}
    </Fragment>,
    document.body,
  );
}
