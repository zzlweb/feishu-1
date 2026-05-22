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
import { wrapIcon } from '../../icons/wrap';
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
} from '../../icons/contextMenuGlyphs';
import {
  SlashGlyphBulletList,
  SlashGlyphCode,
  SlashGlyphDivider,
  SlashGlyphHeading1,
  SlashGlyphHeading2,
  SlashGlyphHeading3,
  SlashGlyphHeading4,
  SlashGlyphHeading5,
  SlashGlyphLink,
  SlashGlyphOrderedList,
  SlashGlyphQuote,
  SlashGlyphSubDoc,
  SlashGlyphTaskList,
} from '../../icons/slashMenuGlyphs';
import { IconChevronMenuEnd } from '../../icons/feishuDoc';
import {
  ADD_BELOW_FLYOUT_MAX_HEIGHT,
  clampFlyoutHeight,
  computeSubmenuFlyoutPosition,
} from './contextSubmenuFlyout';
import { getInsertBelowPosition, insertBelowSlashItem } from './insertBelowBlocks';
import { insertFeishuColumnsAt } from './columnsInsert';
import { insertFeishuTableAt } from './tableInsert';
import AddBelowSlashSections from './AddBelowSlashSections';
import FeishuColorPickerPanel from './FeishuColorPickerPanel';
import { syncEditorSelectionToAnchoredBlock } from './blockAnchorSelection';
import { copyCurrentBlockLink } from './blockLink';
import {
  applyEditorIndentDecrease,
  applyEditorIndentIncrease,
  getEditorIndentUiState,
} from './blockIndent';
import { isPointerWithinFloatingShell, useFloatingPanelPosition } from './floatingPanel';
import { setHeadingLevel, setTextAlignment, toggleBlockStyle } from './panelActions';
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

type RowKind = 'heading' | 'block' | 'insertLink';

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
  { label: '四级标题', value: 4, type: 'heading', Icon: SlashGlyphHeading4, tint: TBOX.b500, tooltip: { shortcut: 'Ctrl + Alt + 4', markdown: '#### 空格' } },
  { label: '五级标题', value: 5, type: 'heading', Icon: SlashGlyphHeading5, tint: TBOX.b500, tooltip: { shortcut: 'Ctrl + Alt + 5', markdown: '##### 空格' } },
  { label: '有序列表', value: 'orderedList', type: 'block', Icon: SlashGlyphOrderedList, tint: TBOX.i500, tooltip: { shortcut: 'Ctrl + Shift + 7', markdown: '1. 空格' } },
  { label: '无序列表', value: 'bulletList', type: 'block', Icon: SlashGlyphBulletList, tint: TBOX.i500, tooltip: { shortcut: 'Ctrl + Shift + 8', markdown: '- 空格' } },
  { label: '待办事项', value: 'taskList', type: 'block', Icon: SlashGlyphTaskList, tint: TBOX.i500, tooltip: { shortcut: 'Ctrl + Shift + 9', markdown: '[] 空格' } },
  { label: '代码块', value: 'codeBlock', type: 'block', Icon: SlashGlyphCode, tint: TBOX.g500, tooltip: { markdown: '``` 空格' } },
  { label: '引用', value: 'blockquote', type: 'block', Icon: SlashGlyphQuote, tint: TBOX.b500, tooltip: { markdown: '> 空格' } },
  { label: '分割线', value: 'horizontalRule', type: 'block', Icon: SlashGlyphDivider, tint: TBOX.i500, tooltip: { markdown: '--- 回车' } },
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
  const { finalPos, posVisible } = useFloatingPanelPosition(x, y, menuRef);
  const [gridTooltip, setGridTooltip] = useState<{ item: GridRowDef; rect: DOMRect } | null>(null);
  const [activeFlyout, setActiveFlyout] = useState<{
    kind: 'align' | 'color' | 'below';
    rect: DOMRect;
  } | null>(null);
  const gridTooltipTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const t = e.target as Node;
      if (menuRef.current?.contains(t)) return;
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

  const pointerStillInShell = (next: EventTarget | null): boolean =>
    isPointerWithinFloatingShell(next, [menuRef, anchorRef], [
      '.block-inline-tools',
      '.context-menu',
      '.context-submenu-flyout',
      '.context-add-below-flyout',
      '.slash-table-grid-flyout',
      '.slash-columns-count-flyout',
    ]);

  const handleShellMouseLeave = (e: React.MouseEvent) => {
    if (pointerStillInShell(e.relatedTarget)) return;
    setActiveFlyout(null);
    dismissByHover();
  };

  const openFlyout = (kind: 'align' | 'color' | 'below', el: HTMLElement) => {
    setActiveFlyout({ kind, rect: el.getBoundingClientRect() });
  };

  const handleFlyoutMouseLeave = (e: React.MouseEvent) => {
    if (pointerStillInShell(e.relatedTarget)) return;
    setActiveFlyout(null);
    dismissByHover();
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
      case 'horizontalRule':
        editor.chain().focus().setHorizontalRule().run();
        break;
    }
    onClose();
  };

  const handleGridClick = (item: GridRowDef) => {
    alignSelectionToBlockAnchor();
    if (item.type === 'heading') setHeading(item.value as number);
    else if (item.type === 'block') toggleBlock(item.value as string);
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

  const handleComment = () => {
    const blockId = blockAnchorRef?.current?.id || blockAnchorRef?.current?.dataset.blockId || '';
    window.dispatchEvent(new CustomEvent('feishu-open-comment-sidebar', {
      detail: { documentId: (editor as any).__documentId, blockId },
    }));
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
    const documentId = (editor as any).__documentId as string | undefined;
    if (!documentId) {
      void MessagePlugin.error('无法识别当前文档');
      onClose();
      return;
    }
    const res = await fetch(`/api/documents/${documentId}/save-as-template`, { method: 'POST' });
    const json = await res.json();
    if (res.ok && json.code === 0) void MessagePlugin.success('已保存为模板');
    else void MessagePlugin.error(json.message || '保存模板失败');
    onClose();
  };

  const handleConvertToChild = async () => {
    alignSelectionToBlockAnchor();
    const parentId = (editor as any).__documentId as string | undefined;
    const { from, to } = getCurrentBlockRange(editor);
    const html = serializeRangeToHtml(editor, from, to);
    const title = editor.state.doc.textBetween(from, to, ' ').trim().slice(0, 30) || '未命名子文档';
    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, parent_id: parentId || null, content: html }),
    });
    const json = await res.json();
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

  const alignFlyoutPanel = (
    <div
      className="context-submenu-flyout context-align-flyout"
      onMouseEnter={() => onMouseEnterCancel?.()}
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
      className="context-submenu-flyout context-color-flyout"
      onMouseEnter={() => onMouseEnterCancel?.()}
      onMouseLeave={handleFlyoutMouseLeave}
      onMouseDown={e => e.preventDefault()}
    >
      <FeishuColorPickerPanel editor={editor} onBeforeApply={alignSelectionToBlockAnchor} onAfterPick={onClose} />
    </div>
  );

  const addBelowFlyoutPanel = (
    <div
      className="slash-menu slash-menu-feishu context-add-below-flyout"
      style={{ maxHeight: clampFlyoutHeight(ADD_BELOW_FLYOUT_MAX_HEIGHT), overflowY: 'auto' }}
      onMouseEnter={() => onMouseEnterCancel?.()}
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
    </div>
  );

  const getActiveFlyoutNode = () => {
    if (!activeFlyout) return null;
    if (activeFlyout.kind === 'align') return alignFlyoutPanel;
    if (activeFlyout.kind === 'color') return colorFlyoutPanel;
    return addBelowFlyoutPanel;
  };

  const getActiveFlyoutPosition = () => {
    if (!activeFlyout) return null;
    const size = {
      align: { width: 200, height: 196 },
      color: { width: 252, height: 420 },
      below: { width: 252, height: clampFlyoutHeight(ADD_BELOW_FLYOUT_MAX_HEIGHT) },
    }[activeFlyout.kind];
    return computeSubmenuFlyoutPosition({
      trigger: activeFlyout.rect,
      panelWidth: size.width,
      panelHeight: size.height,
      gap: 0,
      pad: 8,
    });
  };

  const flyoutNode = getActiveFlyoutNode();
  const flyoutPosition = getActiveFlyoutPosition();

  return (
    <Fragment>
      <div
        ref={menuRef}
        className="context-menu context-menu-feishu"
        style={{ left: finalPos.x, top: finalPos.y, visibility: posVisible ? 'visible' : 'hidden' }}
        onMouseEnter={() => { onMouseEnterCancel?.(); }}
        onMouseLeave={e => { hideGridTooltip(); handleShellMouseLeave(e); }}
        onScroll={hideGridTooltip}
      >
        <div className="context-menu-scroll">
          <div className="context-menu-section context-menu-section--grid">
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
            className={`context-menu-item has-submenu${activeFlyout?.kind === 'align' ? ' is-submenu-open' : ''}`}
            onMouseEnter={e => openFlyout('align', e.currentTarget)}
          >
            <span className="context-menu-icon"><ContextGlyphTypography size={18} fill={ICON_MUTED} /></span>
            <span style={{ flex: 1 }}>缩进和对齐</span>
            <span className="context-menu-arrow-feishu"><IconChevronMenuEnd size={14} /></span>
          </div>

          <div
            className={`context-menu-item has-submenu${activeFlyout?.kind === 'color' ? ' is-submenu-open' : ''}`}
            onMouseEnter={e => openFlyout('color', e.currentTarget)}
          >
            <span className="context-menu-icon"><ContextGlyphStyleColor size={18} fill={ICON_MUTED} /></span>
            <span style={{ flex: 1 }}>颜色</span>
            <span className="context-menu-arrow-feishu"><IconChevronMenuEnd size={14} /></span>
          </div>

          <div className="context-menu-divider" />

          <button type="button" className="context-menu-item" onClick={handleComment}>
            <span className="context-menu-icon"><ContextGlyphShare size={18} fill={ICON_MUTED} /></span>
            <span style={{ flex: 1 }}>评论</span>
          </button>
          <button type="button" className="context-menu-item" onClick={handleCut}>
            <span className="context-menu-icon"><ContextGlyphCut size={18} fill={ICON_MUTED} /></span>
            <span style={{ flex: 1 }}>剪切</span>
            <span className="context-menu-shortcut">Ctrl+X</span>
          </button>
          <button type="button" className="context-menu-item" onClick={handleCopy}>
            <span className="context-menu-icon"><ContextGlyphCopy size={18} fill={ICON_MUTED} /></span>
            <span style={{ flex: 1 }}>复制</span>
            <span className="context-menu-shortcut">Ctrl+C</span>
          </button>
          <button type="button" className="context-menu-item" onClick={() => void handleTranslate()}>
            <span className="context-menu-icon"><ContextGlyphTranslate size={18} fill={ICON_MUTED} /></span>
            <span style={{ flex: 1 }}>翻译</span>
          </button>
          <button type="button" className="context-menu-item context-menu-item--danger" onClick={handleDelete}>
            <span className="context-menu-icon"><ContextGlyphDelete size={18} fill={ICON_MUTED} /></span>
            <span style={{ flex: 1 }}>删除</span>
            <span className="context-menu-shortcut">Del</span>
          </button>

          <div className="context-menu-divider" />

          <button type="button" className="context-menu-item" onClick={() => void handleShare()}>
            <span className="context-menu-icon"><ContextGlyphShare size={18} fill={ICON_MUTED} /></span>
            <span style={{ flex: 1 }}>分享</span>
          </button>
          <button type="button" className="context-menu-item" onClick={() => void handleSaveTemplate()}>
            <span className="context-menu-icon"><ContextGlyphTemplate size={18} fill={ICON_MUTED} /></span>
            <span style={{ flex: 1 }}>保存为模板</span>
          </button>
          <button type="button" className="context-menu-item" onClick={() => void handleCopyBlockLink()}>
            <span className="context-menu-icon"><ContextGlyphBlockLink size={18} fill={ICON_MUTED} /></span>
            <span style={{ flex: 1 }}>复制链接</span>
          </button>
          <button type="button" className="context-menu-item" onClick={() => void handleConvertToChild()}>
            <span className="context-menu-icon context-menu-icon--subdoc"><SlashGlyphSubDoc size={18} fill={ICON_MUTED} /></span>
            <span style={{ flex: 1 }}>转换为子文档</span>
          </button>

          <div className="context-menu-divider" />

          <div
            className={`context-menu-item has-submenu${activeFlyout?.kind === 'below' ? ' is-submenu-open' : ''}`}
            onMouseEnter={e => openFlyout('below', e.currentTarget)}
          >
            <span className="context-menu-icon"><ContextGlyphAddBelow size={18} fill={ICON_MUTED} /></span>
            <span style={{ flex: 1 }}>在下方添加</span>
            <span className="context-menu-arrow-feishu"><IconChevronMenuEnd size={14} /></span>
          </div>
        </div>
      </div>

      {flyoutNode && flyoutPosition && createPortal(
        <div
          className="context-flyout-portal"
          style={{
            position: 'fixed',
            left: flyoutPosition.left,
            top: flyoutPosition.top,
            zIndex: 10060,
          }}
        >
          {flyoutNode}
        </div>,
        document.body,
      )}

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
