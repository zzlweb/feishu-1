import { Fragment, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { ComponentType } from 'react';
import type { Editor } from '@tiptap/react';
import { DOMSerializer } from '@tiptap/pm/model';
import { MessagePlugin } from 'tdesign-react';
import {
  FormatVerticalAlignCenterIcon,
  FormatVerticalAlignLeftIcon,
  FormatVerticalAlignRightIcon,
  HelpCircleIcon,
  IndentLeftIcon,
  IndentRightIcon,
} from 'tdesign-icons-react';
import { wrapIcon } from '../../../icons/wrap';
import { readApiPayload } from '../../../api/http';
import {
  ContextGlyphAddBelow,
  ContextGlyphBlockLink,
  ContextGlyphCopy,
  ContextGlyphCut,
  ContextGlyphDelete,
  ContextGlyphShare,
  ContextGlyphStyleColor,
  ContextGlyphTemplate,
  ContextGlyphTranslate,
  ContextGlyphTypography,
  ContextGlyphText,
  FEISHU_TOOLBOX,
} from '../../../icons/contextMenuGlyphs';
import {
  SlashGlyphBulletList,
  SlashGlyphCode,
  SlashGlyphHeading1,
  SlashGlyphHeading2,
  SlashGlyphHeading3,
  SlashGlyphImage,
  SlashGlyphLink,
  SlashGlyphOrderedList,
  SlashGlyphQuote,
  SlashGlyphSubDoc,
  SlashGlyphTaskList,
} from '../../../icons/slashMenuGlyphs';
import { IconChevronMenuEnd } from '../../../icons/feishuDoc';
import {
  ADD_BELOW_FLYOUT_MAX_HEIGHT,
  clampFlyoutHeight,
  COLOR_FLYOUT_ESTIMATED_HEIGHT,
  COLOR_FLYOUT_WIDTH,
  computeSubmenuFlyoutPosition,
} from './contextSubmenuFlyout';
import { getInsertBelowPosition, insertButtonBlockAt, insertSlashItemAt } from './insertBelowBlocks';
import { insertFeishuColumnsAt } from '../blocks/columnsInsert';
import { insertFeishuTableAt } from '../tables/tableInsert';
import AddBelowSlashSections from './AddBelowSlashSections';
import FeishuColorPickerPanel from '../panels/FeishuColorPickerPanel';
import { prepareEditorForInlineColor, syncEditorSelectionToAnchoredBlock } from '../blocks/blockAnchorSelection';
import { copyCurrentBlockLink } from '../blocks/blockLink';
import {
  applyEditorIndentDecrease,
  applyEditorIndentIncrease,
  getEditorIndentUiState,
} from '../blocks/blockIndent';
import { isPointerWithinFloatingShell, useAnchoredContextMenuPosition, useHoverFloatingGroup } from '../shared/floatingPanel';
import { setHeadingLevel, setTextAlignment, toggleBlockStyle } from '../panels/panelActions';
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
  anchorRef?: RefObject<HTMLElement | null>;
  blockAnchorRef?: RefObject<HTMLElement | null>;
  onHoverDismiss?: () => void;
  onMouseEnterCancel?: () => void;
}

type RowKind = 'heading' | 'block' | 'insertLink' | 'insertImage';

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
  tint: string;
  tooltip?: { shortcut?: string; markdown?: string };
}

const TBOX = FEISHU_TOOLBOX;
const PRIMARY = TBOX.b500;
const ICON_MUTED = '#373c43';

const BLOCK_TYPE_ICON_GRID: GridRowDef[] = [
  { label: '正文', value: 0, type: 'heading', Icon: ContextGlyphText, tint: TBOX.b500 },
  { label: '一级标题', value: 1, type: 'heading', Icon: SlashGlyphHeading1, tint: TBOX.b500, tooltip: { shortcut: 'Ctrl + Alt + 1', markdown: '# 空格' } },
  { label: '二级标题', value: 2, type: 'heading', Icon: SlashGlyphHeading2, tint: TBOX.b500, tooltip: { shortcut: 'Ctrl + Alt + 2', markdown: '## 空格' } },
  { label: '三级标题', value: 3, type: 'heading', Icon: SlashGlyphHeading3, tint: TBOX.b500, tooltip: { shortcut: 'Ctrl + Alt + 3', markdown: '### 空格' } },
  { label: '有序列表', value: 'orderedList', type: 'block', Icon: SlashGlyphOrderedList, tint: TBOX.i500, tooltip: { shortcut: 'Ctrl + Shift + 7', markdown: '1. 空格' } },
  { label: '无序列表', value: 'bulletList', type: 'block', Icon: SlashGlyphBulletList, tint: TBOX.i500, tooltip: { shortcut: 'Ctrl + Shift + 8', markdown: '- 空格' } },
  { label: '待办事项', value: 'taskList', type: 'block', Icon: SlashGlyphTaskList, tint: TBOX.i500, tooltip: { shortcut: 'Ctrl + Shift + 9', markdown: '[] 空格' } },
  { label: '代码块', value: 'codeBlock', type: 'block', Icon: SlashGlyphCode, tint: TBOX.g500, tooltip: { markdown: '``` 空格' } },
  { label: '引用', value: 'blockquote', type: 'block', Icon: SlashGlyphQuote, tint: TBOX.b500, tooltip: { markdown: '> 空格' } },
  { label: '图片', value: 'insertImage', type: 'insertImage', Icon: SlashGlyphImage, tint: TBOX.o500 },
  { label: '链接', value: 'insertLink', type: 'insertLink', Icon: SlashGlyphLink, tint: TBOX.b500, tooltip: { shortcut: 'Ctrl + K' } },
];

const ALIGN_OPTIONS = [
  { label: '左对齐', value: 'left', Icon: AlignTextLeft },
  { label: '居中对齐', value: 'center', Icon: AlignTextCenter },
  { label: '右对齐', value: 'right', Icon: AlignTextRight },
] as const;

function isGridActive(editor: Editor, item: GridRowDef): boolean {
  if (item.type === 'heading') {
    if (item.value === 0) return editor.isActive('paragraph');
    return editor.isActive('heading', { level: item.value as 1 | 2 | 3 | 4 | 5 | 6 });
  }
  if (item.type === 'block') return editor.isActive(item.value as string);
  if (item.type === 'insertLink') return editor.isActive('link');
  if (item.type === 'insertImage') return editor.isActive('image');
  return false;
}

function getCurrentTextAlign(editor: Editor): string {
  const p = editor.getAttributes('paragraph').textAlign as string | undefined;
  const h = editor.getAttributes('heading').textAlign as string | undefined;
  return (p || h || 'left') as string;
}

function getCurrentBlockRange(editor: Editor) {
  const { selection } = editor.state;
  if (!selection.empty) return { from: selection.from, to: selection.to };
  const { $from } = selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name !== 'doc' && node.isBlock) {
      return { from: $from.before(d), to: $from.after(d) };
    }
  }
  return { from: selection.from, to: selection.to };
}

function serializeRangeToHtml(editor: Editor, from: number, to: number) {
  const slice = editor.state.doc.slice(from, to);
  const serializer = DOMSerializer.fromSchema(editor.state.schema);
  const fragment = serializer.serializeFragment(slice.content);
  const container = document.createElement('div');
  container.appendChild(fragment);
  return container.innerHTML || '<p></p>';
}

function pickImageFile(onPick: (file: File) => void) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) onPick(file);
  };
  input.click();
}

async function uploadImageFile(file: File) {
  const body = new FormData();
  body.append('file', file);
  const res = await fetch('/api/uploads', { method: 'POST', body });
  const json = await readApiPayload<{ name: string; url: string }>(res);
  if (!res.ok || json.code !== 0) throw new Error(json.message || '上传失败');
  return json.data as { name: string; url: string };
}

export default function ContextMenu({
  editor,
  x,
  y,
  onClose,
  anchorRef,
  blockAnchorRef,
  onHoverDismiss,
  onMouseEnterCancel,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const alignTriggerRef = useRef<HTMLDivElement>(null);
  const colorTriggerRef = useRef<HTMLDivElement>(null);
  const addBelowTriggerRef = useRef<HTMLDivElement>(null);
  const addBelowFlyoutRef = useRef<HTMLDivElement>(null);
  const colorFlyoutRef = useRef<HTMLDivElement>(null);
  const { finalPos, posVisible } = useAnchoredContextMenuPosition(anchorRef, menuRef, { x, y });
  const [gridTooltip, setGridTooltip] = useState<{ item: GridRowDef; rect: DOMRect } | null>(null);
  const [activeFlyout, setActiveFlyout] = useState<{
    kind: 'align' | 'color' | 'below';
    rect: DOMRect;
  } | null>(null);
  const [flyoutPanelHeight, setFlyoutPanelHeight] = useState<number | null>(null);
  const gridTooltipTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const isWithinContextMenuShell = (target: Node) => {
      if (menuRef.current?.contains(target)) return true;
      if (colorFlyoutRef.current?.contains(target)) return true;
      if (addBelowFlyoutRef.current?.contains(target)) return true;
      if (target instanceof Element && target.closest('.context-submenu-flyout, .context-add-below-flyout')) {
        return true;
      }
      return false;
    };

    const handleClick = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const t = e.target as Node;
      if (isWithinContextMenuShell(t)) return;
      if (anchorRef?.current?.contains(t)) return;
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
      clearTimeout(gridTooltipTimerRef.current);
    };
  }, [onClose]);

  const alignSelectionToBlockAnchor = () =>
    syncEditorSelectionToAnchoredBlock(editor, blockAnchorRef?.current ?? null);

  const hasGridTooltip = (item: GridRowDef) =>
    item.tooltip && (item.tooltip.shortcut || item.tooltip.markdown);

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

  const dismissByHover = () => {
    (onHoverDismiss ?? onClose)();
  };

  const hoverGroup = useHoverFloatingGroup({
    refs: [menuRef, alignTriggerRef, colorTriggerRef, colorFlyoutRef, addBelowTriggerRef, addBelowFlyoutRef, anchorRef],
    selectors: [
      '.context-menu',
      '.context-submenu-flyout',
      '.context-add-below-flyout',
      '.slash-table-grid-flyout',
      '.slash-columns-count-flyout',
    ],
    closeDelay: 160,
    onClose: () => {
      setActiveFlyout(null);
      dismissByHover();
    },
  });

  const pointerStillInShell = (next: EventTarget | null): boolean =>
    hoverGroup.containsTarget(next) || isPointerWithinFloatingShell(next, [menuRef, anchorRef], [
      '.context-menu',
      '.context-submenu-flyout',
      '.context-add-below-flyout',
      '.slash-table-grid-flyout',
      '.slash-columns-count-flyout',
    ]);

  const isFlyoutAnchorTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest('.context-menu-item.has-submenu, .context-submenu-flyout, .context-add-below-flyout'));
  };

  const closeActiveFlyout = () => {
    setActiveFlyout(null);
  };

  const handleShellMouseLeave = (e: React.MouseEvent) => {
    if (pointerStillInShell(e.relatedTarget)) return;
    hoverGroup.scheduleClose(e.relatedTarget);
  };

  const resolveFlyoutTriggerEl = (kind: 'align' | 'color' | 'below') =>
    kind === 'align'
      ? alignTriggerRef.current
      : kind === 'color'
        ? colorTriggerRef.current
        : addBelowTriggerRef.current;

  const resolveFlyoutPanelRef = (kind: 'align' | 'color' | 'below') =>
    kind === 'color' ? colorFlyoutRef : kind === 'below' ? addBelowFlyoutRef : null;

  const openFlyout = (kind: 'align' | 'color' | 'below', triggerEl: HTMLElement) => {
    setActiveFlyout({ kind, rect: triggerEl.getBoundingClientRect() });
  };

  useLayoutEffect(() => {
    if (!activeFlyout || !posVisible) {
      setFlyoutPanelHeight(null);
      return;
    }

    const panelEl = resolveFlyoutPanelRef(activeFlyout.kind)?.current;
    if (panelEl) {
      const nextHeight = panelEl.offsetHeight;
      setFlyoutPanelHeight(prev => (prev === nextHeight ? prev : nextHeight));
    } else {
      setFlyoutPanelHeight(null);
    }
  }, [
    activeFlyout?.kind,
    activeFlyout?.rect.top,
    activeFlyout?.rect.left,
    activeFlyout?.rect.right,
    activeFlyout?.rect.bottom,
    posVisible,
    finalPos.x,
    finalPos.y,
  ]);

  useLayoutEffect(() => {
    if (!activeFlyout || !posVisible) return;

    const syncTriggerRect = () => {
      setActiveFlyout(prev => {
        if (!prev) return prev;
        const triggerEl = resolveFlyoutTriggerEl(prev.kind);
        if (!triggerEl?.isConnected) return prev;
        const nextRect = triggerEl.getBoundingClientRect();
        const same =
          prev.rect.top === nextRect.top
          && prev.rect.left === nextRect.left
          && prev.rect.right === nextRect.right
          && prev.rect.bottom === nextRect.bottom;
        return same ? prev : { ...prev, rect: nextRect };
      });
    };

    syncTriggerRect();
    const raf = window.requestAnimationFrame(syncTriggerRect);
    window.addEventListener('resize', syncTriggerRect);
    document.addEventListener('scroll', syncTriggerRect, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', syncTriggerRect);
      document.removeEventListener('scroll', syncTriggerRect, true);
    };
  }, [activeFlyout?.kind, finalPos.x, finalPos.y, posVisible]);

  const handleFlyoutMouseLeave = (e: React.MouseEvent) => {
    if (pointerStillInShell(e.relatedTarget)) {
      if (!isFlyoutAnchorTarget(e.relatedTarget)) {
        closeActiveFlyout();
      }
      return;
    }
    hoverGroup.scheduleClose(e.relatedTarget);
  };

  const keepHoverAlive = () => {
    hoverGroup.cancelClose();
    onMouseEnterCancel?.();
  };

  const handlePlainMenuZoneEnter = () => {
    keepHoverAlive();
    closeActiveFlyout();
  };

  const setHeading = (level: number) => {
    setHeadingLevel(editor, level);
    onClose();
  };

  const toggleBlock = (type: string) => {
    switch (type) {
      case 'bulletList':
      case 'orderedList':
      case 'paragraph':
      case 'codeBlock':
      case 'blockquote':
      case 'taskList':
        toggleBlockStyle(editor, type as 'bulletList' | 'orderedList' | 'paragraph' | 'codeBlock' | 'blockquote' | 'taskList');
        break;
    }
    onClose();
  };

  const handleInsertImage = () => {
    alignSelectionToBlockAnchor();
    const { from, to } = getCurrentBlockRange(editor);
    pickImageFile(file => {
      void uploadImageFile(file).then(uploaded => {
        editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, {
          type: 'image',
          attrs: { src: uploaded.url, alt: uploaded.name },
        }).run();
        onClose();
      }).catch(err => {
        void MessagePlugin.error(err instanceof Error ? err.message : '图片上传失败');
        onClose();
      });
    });
  };

  const handleGridClick = (item: GridRowDef) => {
    alignSelectionToBlockAnchor();
    if (item.type === 'heading') setHeading(item.value as number);
    else if (item.type === 'block') toggleBlock(item.value as string);
    else if (item.type === 'insertImage') handleInsertImage();
    else if (item.type === 'insertLink') {
      window.dispatchEvent(new CustomEvent('feishu-open-page-link-dialog'));
      onClose();
    }
  };

  const setAlign = (align: string) => {
    alignSelectionToBlockAnchor();
    setTextAlignment(editor, align as 'left' | 'center' | 'right');
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

  const handleTranslate = async () => {
    alignSelectionToBlockAnchor();
    const { from, to } = getCurrentBlockRange(editor);
    const text = editor.state.doc.textBetween(from, to, '\n').trim();
    if (!text) {
      void MessagePlugin.info('当前块没有可翻译的文本');
      onClose();
      return;
    }
    await navigator.clipboard.writeText(text);
    void MessagePlugin.info('已复制当前块文本，可粘贴到翻译工具');
    onClose();
  };

  const handleDelete = () => {
    alignSelectionToBlockAnchor();
    const { from, to } = getCurrentBlockRange(editor);
    editor.chain().focus().deleteRange({ from, to }).run();
    onClose();
  };

  const handleShare = async () => {
    await navigator.clipboard.writeText(window.location.href);
    void MessagePlugin.success('分享链接已复制');
    onClose();
  };

  const handleSaveTemplate = async () => {
    alignSelectionToBlockAnchor();
    const { from, to } = getCurrentBlockRange(editor);
    const html = serializeRangeToHtml(editor, from, to);
    const title = editor.state.doc.textBetween(from, to, ' ').trim().slice(0, 30) || '块模板';
    const res = await fetch('/api/documents/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        content: html,
        author: (editor as any).__author || '张正亮',
      }),
    });
    const json = await res.json();
    if (res.ok && json.code === 0) void MessagePlugin.success('已保存为模板');
    else void MessagePlugin.error(json.message || '保存模板失败');
    onClose();
  };

  const handleConvertToChild = async () => {
    alignSelectionToBlockAnchor();
    const parentId = (editor as any).__documentId as string | undefined;
    if (!parentId) {
      void MessagePlugin.error('无法识别当前文档');
      onClose();
      return;
    }
    const { from, to } = getCurrentBlockRange(editor);
    const html = serializeRangeToHtml(editor, from, to);
    const title = editor.state.doc.textBetween(from, to, ' ').trim().slice(0, 30) || '未命名子文档';
    const res = await fetch(`/api/documents/${parentId}/children`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ title, content: html, author: (editor as any).__author || '张正亮' }),
    });
    const json = await readApiPayload<{ id: string; title?: string }>(res);
    const doc = json.data;
    if (!res.ok || json.code !== 0 || !doc?.id) {
      void MessagePlugin.error(json.message || '转换失败');
      onClose();
      return;
    }
    editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, {
      type: 'localEmbedBlock',
      attrs: { title: doc.title || title, desc: `/doc/${doc.id}`, kind: 'subdoc', href: `/doc/${doc.id}` },
    }).run();
    void MessagePlugin.success('已转换为子文档');
    onClose();
  };

  const handleCopyBlockLink = async () => {
    alignSelectionToBlockAnchor();
    await copyCurrentBlockLink(editor);
    void MessagePlugin.success('块链接已复制');
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

  const indentUi = getEditorIndentUiState(editor);
  const currentAlign = getCurrentTextAlign(editor);
  const submenuIconStroke = { strokeWidth: 2.75 };

  const getActiveFlyoutPosition = () => {
    if (!activeFlyout || !posVisible) return null;
    const size = {
      align: { width: 200, height: 196 },
      color: {
        width: COLOR_FLYOUT_WIDTH,
        height:
          flyoutPanelHeight != null && activeFlyout.kind === 'color'
            ? flyoutPanelHeight
            : colorFlyoutRef.current?.offsetHeight ?? COLOR_FLYOUT_ESTIMATED_HEIGHT,
      },
      below: {
        width: 252,
        height: clampFlyoutHeight(addBelowFlyoutRef.current?.scrollHeight ?? ADD_BELOW_FLYOUT_MAX_HEIGHT),
      },
    }[activeFlyout.kind];
    return computeSubmenuFlyoutPosition({
      trigger: activeFlyout.rect,
      panelWidth: size.width,
      panelHeight: size.height,
      gap: 0,
      pad: 8,
    });
  };

  const flyoutPosition = getActiveFlyoutPosition();
  const flyoutFixedStyle = flyoutPosition
    ? {
        position: 'fixed' as const,
        top: flyoutPosition.top,
        left: flyoutPosition.left,
        zIndex: 10060,
      }
    : undefined;

  const alignFlyoutPanel = (
    <div
      className="context-submenu-flyout context-align-flyout"
      style={flyoutFixedStyle}
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
    </div>
  );

  const colorFlyoutPanel = (
    <div
      ref={colorFlyoutRef}
      className="context-submenu-flyout context-color-flyout"
      style={flyoutFixedStyle}
      onPointerEnter={keepHoverAlive}
      onMouseLeave={handleFlyoutMouseLeave}
      onMouseDown={e => e.preventDefault()}
    >
      <FeishuColorPickerPanel
        editor={editor}
        onBeforeApply={() => prepareEditorForInlineColor(editor, blockAnchorRef?.current ?? null)}
        onAfterPick={onClose}
      />
    </div>
  );

  const renderAddBelowFlyoutPanel = () => (
    <div
      ref={addBelowFlyoutRef}
      className="slash-menu slash-menu-feishu context-add-below-flyout"
      style={{
        ...flyoutFixedStyle,
        maxHeight: clampFlyoutHeight(ADD_BELOW_FLYOUT_MAX_HEIGHT),
        overflowY: 'auto',
      }}
      onPointerEnter={keepHoverAlive}
      onMouseLeave={handleFlyoutMouseLeave}
      onMouseDown={e => e.preventDefault()}
    >
      <AddBelowSlashSections
        onPickItem={(sectionTitle, item) => {
          alignSelectionToBlockAnchor();
          insertSlashItemAt(editor, sectionTitle, item, getInsertBelowPosition(editor));
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
        onPickTemplate={template => {
          alignSelectionToBlockAnchor();
          editor.chain().focus().insertContentAt(getInsertBelowPosition(editor), template.content || '<p></p>').run();
          onClose();
        }}
        onPickButton={type => {
          alignSelectionToBlockAnchor();
          insertButtonBlockAt(editor, getInsertBelowPosition(editor), type);
          onClose();
        }}
      />
    </div>
  );

  const menuPanel = (
    <div
      ref={menuRef}
      className="context-menu context-menu-feishu"
      style={{
        position: 'fixed',
        left: finalPos.x,
        top: finalPos.y,
        zIndex: 10050,
        visibility: posVisible ? 'visible' : 'hidden',
      }}
      onPointerEnter={keepHoverAlive}
      onMouseLeave={e => { hideGridTooltip(); handleShellMouseLeave(e); }}
      onScroll={hideGridTooltip}
    >
        <div className="context-menu-scroll">
          <div
            className="context-menu-section context-menu-section--grid"
            onPointerEnter={handlePlainMenuZoneEnter}
          >
            <div className="context-block-types context-block-types--icon-grid">
              {BLOCK_TYPE_ICON_GRID.map(item => {
                const active = isGridActive(editor, item);
                const Icon = item.Icon;
                return (
                  <button
                    key={`grid-${item.type}-${item.value}`}
                    type="button"
                    className={`context-block-btn ${active ? 'active' : ''}`}
                    title={hasGridTooltip(item) ? undefined : item.label}
                    onMouseEnter={e => { if (hasGridTooltip(item)) showGridTooltip(item, e.currentTarget); }}
                    onMouseLeave={hideGridTooltip}
                    onClick={() => handleGridClick(item)}
                  >
                    <Icon size={17} strokeWidth={1.65} fill={active ? '#ffffff' : ICON_MUTED} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="context-menu-divider" />

          <div
            ref={alignTriggerRef}
            className={`context-menu-item has-submenu${activeFlyout?.kind === 'align' ? ' is-submenu-open' : ''}`}
            onPointerEnter={e => {
              keepHoverAlive();
              openFlyout('align', e.currentTarget);
            }}
            onPointerLeave={e => {
              if (!isFlyoutAnchorTarget(e.relatedTarget)) {
                closeActiveFlyout();
              }
            }}
          >
            <span className="context-menu-icon"><ContextGlyphTypography size={18} fill={ICON_MUTED} /></span>
            <span style={{ flex: 1 }}>缩进和对齐</span>
            <span className="context-menu-arrow-feishu"><IconChevronMenuEnd size={14} /></span>
          </div>

          <div
            ref={colorTriggerRef}
            className={`context-menu-item has-submenu${activeFlyout?.kind === 'color' ? ' is-submenu-open' : ''}`}
            onPointerEnter={e => {
              keepHoverAlive();
              openFlyout('color', e.currentTarget);
            }}
            onPointerLeave={e => {
              if (!isFlyoutAnchorTarget(e.relatedTarget)) {
                closeActiveFlyout();
              }
            }}
          >
            <span className="context-menu-icon"><ContextGlyphStyleColor size={18} fill={ICON_MUTED} /></span>
            <span style={{ flex: 1 }}>颜色</span>
            <span className="context-menu-arrow-feishu"><IconChevronMenuEnd size={14} /></span>
          </div>

          <div className="context-menu-divider" />

          <button type="button" className="context-menu-item" onPointerEnter={handlePlainMenuZoneEnter} onClick={handleCut}>
            <span className="context-menu-icon"><ContextGlyphCut size={18} fill={ICON_MUTED} /></span>
            <span style={{ flex: 1 }}>剪切</span>
            <span className="context-menu-shortcut">Ctrl+X</span>
          </button>
          <button type="button" className="context-menu-item" onPointerEnter={handlePlainMenuZoneEnter} onClick={handleCopy}>
            <span className="context-menu-icon"><ContextGlyphCopy size={18} fill={ICON_MUTED} /></span>
            <span style={{ flex: 1 }}>复制</span>
            <span className="context-menu-shortcut">Ctrl+C</span>
          </button>
          <button type="button" className="context-menu-item" onPointerEnter={handlePlainMenuZoneEnter} onClick={() => void handleTranslate()}>
            <span className="context-menu-icon"><ContextGlyphTranslate size={18} fill={ICON_MUTED} /></span>
            <span style={{ flex: 1 }}>翻译</span>
          </button>
          <button type="button" className="context-menu-item context-menu-item--danger" onPointerEnter={handlePlainMenuZoneEnter} onClick={handleDelete}>
            <span className="context-menu-icon"><ContextGlyphDelete size={18} fill={ICON_MUTED} /></span>
            <span style={{ flex: 1 }}>删除</span>
            <span className="context-menu-shortcut">Del</span>
          </button>

          <div className="context-menu-divider" />

          <button type="button" className="context-menu-item" onPointerEnter={handlePlainMenuZoneEnter} onClick={() => void handleShare()}>
            <span className="context-menu-icon"><ContextGlyphShare size={18} fill={ICON_MUTED} /></span>
            <span style={{ flex: 1 }}>分享</span>
          </button>
          <button type="button" className="context-menu-item" onPointerEnter={handlePlainMenuZoneEnter} onClick={() => void handleConvertToChild()}>
            <span className="context-menu-icon context-menu-icon--subdoc"><SlashGlyphSubDoc size={18} fill={ICON_MUTED} /></span>
            <span style={{ flex: 1 }}>转换为子文档</span>
          </button>
          <button type="button" className="context-menu-item" onPointerEnter={handlePlainMenuZoneEnter} onClick={() => void handleSaveTemplate()}>
            <span className="context-menu-icon"><ContextGlyphTemplate size={18} fill={ICON_MUTED} /></span>
            <span style={{ flex: 1 }}>保存为模板</span>
          </button>
          <button type="button" className="context-menu-item" onPointerEnter={handlePlainMenuZoneEnter} onClick={() => void handleCopyBlockLink()}>
            <span className="context-menu-icon"><ContextGlyphBlockLink size={18} fill={ICON_MUTED} /></span>
            <span style={{ flex: 1 }}>复制链接</span>
          </button>

          <div className="context-menu-divider" />

          <div
            ref={addBelowTriggerRef}
            className={`context-menu-item has-submenu${activeFlyout?.kind === 'below' ? ' is-submenu-open' : ''}`}
            onPointerEnter={e => {
              keepHoverAlive();
              openFlyout('below', e.currentTarget);
            }}
            onPointerLeave={e => {
              if (!isFlyoutAnchorTarget(e.relatedTarget)) {
                closeActiveFlyout();
              }
            }}
          >
            <span className="context-menu-icon"><ContextGlyphAddBelow size={18} fill={ICON_MUTED} /></span>
            <span style={{ flex: 1 }}>在下方添加</span>
            <span className="context-menu-arrow-feishu"><IconChevronMenuEnd size={14} /></span>
          </div>
        </div>
      </div>
  );

  return createPortal(
    <Fragment>
      {menuPanel}

      {activeFlyout?.kind === 'align' && flyoutPosition && alignFlyoutPanel}
      {activeFlyout?.kind === 'color' && flyoutPosition && colorFlyoutPanel}
      {activeFlyout?.kind === 'below' && flyoutPosition && renderAddBelowFlyoutPanel()}

      {gridTooltip && hasGridTooltip(gridTooltip.item) && (
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
        </div>
      )}
    </Fragment>,
    document.body,
  );
}
