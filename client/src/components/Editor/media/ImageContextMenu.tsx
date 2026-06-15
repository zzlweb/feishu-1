import { Fragment, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/react';
import { DOMSerializer } from '@tiptap/pm/model';
import { MessagePlugin } from 'tdesign-react';
import {
  FormatVerticalAlignLeftIcon,
  FormatVerticalAlignCenterIcon,
  FormatVerticalAlignRightIcon,
} from 'tdesign-icons-react';
import { wrapIcon } from '../../../icons/wrap';
import { IconChevronMenuEnd } from '../../../icons/feishuDoc';
import { syncEditorSelectionToAnchoredBlock } from '../blocks/blockAnchorSelection';
import { copyCurrentBlockLink } from '../blocks/blockLink';
import { makeFeishuBlockId } from '../blocks/feishuBlockId';
import {
  ADD_BELOW_FLYOUT_MAX_HEIGHT,
  clampFlyoutHeight,
  computeSubmenuFlyoutPosition,
} from '../menus/contextSubmenuFlyout';
import { getInsertBelowPosition, insertButtonBlockAt, insertSlashItemAt } from '../menus/insertBelowBlocks';
import { insertFeishuColumnsAt } from '../blocks/columnsInsert';
import { insertFeishuTableAt } from '../tables/tableInsert';
import AddBelowSlashSections from '../menus/AddBelowSlashSections';
import { isPointerWithinFloatingShell, useAnchoredContextMenuPosition, useHoverFloatingGroup } from '../shared/floatingPanel';
import {
  dispatchImageBlockAction,
  getImageAlignFromEditor,
  getImageBlockRange,
  setImageAlignOnEditor,
  type ImageAlign,
} from './imageBlockUtils';
import '../menus/ContextMenu.less';

const AlignTextLeft = wrapIcon(FormatVerticalAlignLeftIcon);
const AlignTextCenter = wrapIcon(FormatVerticalAlignCenterIcon);
const AlignTextRight = wrapIcon(FormatVerticalAlignRightIcon);

interface ImageContextMenuProps {
  editor: Editor;
  x: number;
  y: number;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
  blockAnchorRef?: React.RefObject<HTMLElement | null>;
  onHoverDismiss?: () => void;
  onMouseEnterCancel?: () => void;
}

const ALIGN_OPTIONS = [
  { label: '左对齐', value: 'left' as const, Icon: AlignTextLeft },
  { label: '居中对齐', value: 'center' as const, Icon: AlignTextCenter },
  { label: '右对齐', value: 'right' as const, Icon: AlignTextRight },
];

const ICON_MUTED = '#373c43';
const PRIMARY = '#3370ff';

function MenuIcon({ dataIcon, paths, iconClass = 'universe-icon menu_ud_icon', color }: {
  dataIcon: string;
  paths: string[];
  iconClass?: string;
  color?: string;
}) {
  return (
    <span className={iconClass} style={color ? { color } : undefined}>
      <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" data-icon={dataIcon} aria-hidden>
        {paths.map((d, index) => (
          <path key={index} d={d} fill="currentColor" />
        ))}
      </svg>
    </span>
  );
}

function PanelMenuItem({
  name,
  label,
  dataIcon,
  paths,
  iconClass,
  iconColor,
  itemClass = 'panel-menu-item',
  onClick,
}: {
  name: string;
  label: string;
  dataIcon: string;
  paths: string[];
  iconClass?: string;
  iconColor?: string;
  itemClass?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={itemClass}
      data-name={name}
      onMouseDown={event => event.preventDefault()}
      onClick={onClick}
    >
      <div className="menu-item-content">
        <div className="menu-icon">
          <MenuIcon dataIcon={dataIcon} paths={paths} iconClass={iconClass} color={iconColor} />
        </div>
        <div className="menu-item-main-box-wrapper">
          <div className="menu-item-main-box">
            <div className="menu-text">{label}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PanelSubmenuItem({
  name,
  label,
  dataIcon,
  paths,
  open,
  triggerRef,
  onOpen,
}: {
  name: string;
  label: string;
  dataIcon: string;
  paths: string[];
  open: boolean;
  triggerRef: React.Ref<HTMLDivElement>;
  onOpen: () => void;
}) {
  return (
    <div
      ref={triggerRef}
      className={`panel-submenu-item no-click-action panel-menu-item${open ? ' is-submenu-open' : ''}`}
      data-name={name}
      onMouseDown={event => event.preventDefault()}
      onPointerEnter={onOpen}
    >
      <div className="menu-item-content">
        <div className="menu-icon">
          <MenuIcon dataIcon={dataIcon} paths={paths} />
        </div>
        <div className="menu-item-main-box-wrapper">
          <div className="menu-item-main-box">
            <div className="menu-text">{label}</div>
            <div className="item-arrow">
              <span className="universe-icon">
                <IconChevronMenuEnd size={14} />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function serializeRangeToHtml(editor: Editor, from: number, to: number) {
  const slice = editor.state.doc.slice(from, to);
  const serializer = DOMSerializer.fromSchema(editor.state.schema);
  const fragment = serializer.serializeFragment(slice.content);
  const container = document.createElement('div');
  container.appendChild(fragment);
  return container.innerHTML || '<p></p>';
}

const SYNC_BLOCK = [
  'M14 5H3v8h3v2H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2v-2h2V5Z',
  'M10 9h2v2h-2v8h11v-8h-3V9h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z',
];
const TYPOGRAPHY = 'M2 4a1 1 0 0 1 1-1h18a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1Zm0 4a1 1 0 0 1 1-1h10a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1Zm1 3a1 1 0 1 0 0 2h18a1 1 0 1 0 0-2H3Zm-1 5a1 1 0 0 1 1-1h10a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1Zm1 3a1 1 0 1 0 0 2h18a1 1 0 1 0 0-2H3Z';
const COMMENT_PATHS = [
  'M7 11a1 1 0 0 1 1-1h8a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1Z',
  'M2 5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v11.5a2 2 0 0 1-2 2h-3.812a.5.5 0 0 0-.33.124l-2.541 2.224a2 2 0 0 1-2.634 0l-2.542-2.224a.5.5 0 0 0-.329-.124H4a2 2 0 0 1-2-2V5Zm2 0v11.5h3.812a2.5 2.5 0 0 1 1.646.619L12 19.343l2.542-2.224a2.5 2.5 0 0 1 1.646-.619H20V5H4Z',
];
const CUT = 'M4.801 4.906a2.289 2.289 0 0 1-.167-2.686c.202-.315.636-.274.875.013l6.571 7.925 6.571-7.925c.239-.287.673-.328.875-.013a2.29 2.29 0 0 1-.167 2.686l-5.817 7.015 2.486 2.997a3.87 3.87 0 0 1 2.212-.691c2.165 0 3.92 1.776 3.92 3.966 0 2.191-1.755 3.967-3.92 3.967s-3.92-1.776-3.92-3.966a4 4 0 0 1 .279-1.473l-2.519-3.037-2.519 3.037c.18.455.279.952.279 1.473 0 2.19-1.755 3.966-3.92 3.966S2 20.384 2 18.194c0-2.191 1.755-3.967 3.92-3.967.82 0 1.582.255 2.212.691l2.486-2.997L4.8 4.906ZM18.24 19.893a1.69 1.69 0 0 0 1.68-1.7c0-.938-.752-1.7-1.68-1.7a1.69 1.69 0 0 0-1.68 1.7c0 .94.752 1.7 1.68 1.7Zm-10.64-1.7c0-.938-.752-1.7-1.68-1.7a1.69 1.69 0 0 0-1.68 1.7c0 .94.752 1.7 1.68 1.7a1.69 1.69 0 0 0 1.68-1.7Z';
const COPY = [
  'M9 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v12a1 1 0 1 1-2 0V4h-9a1 1 0 0 1-1-1Z',
  'M5 6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H5Zm0 2h10v12H5V8Z',
];
const DELETE = 'M8 4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2h5a1 1 0 1 1 0 2h-1v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6H3a1 1 0 0 1 0-2h5ZM6 6v14h12V6H6Zm4 3a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1Zm4 0a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1Z';
const SHARE = 'M21.5 5c0-.552-.473-1-1.055-1H3.555C2.974 4 2.5 4.448 2.5 5s.473 1 1.056 1h16.889c.582 0 1.055-.448 1.055-1Zm-9.617 6c.647 0 1.172.448 1.172 1s-.525 1-1.172 1h-8.21c-.648 0-1.173-.448-1.173-1s.525-1 1.173-1h8.21Zm-3.167 7c.648 0 1.173.448 1.173 1s-.525 1-1.173 1H3.673c-.648 0-1.173-.448-1.173-1s.525-1 1.173-1h5.043Zm9.077-8.242a1 1 0 0 1 1.415 0l3.535 3.535a1 1 0 0 1 0 1.415l-3.535 3.535a1 1 0 0 1-1.415-1.414l1.822-1.822c-1.819.07-3.162.64-4.065 1.543-.965.965-1.55 2.435-1.55 4.45a1 1 0 1 1-2 0c0-2.403.706-4.434 2.136-5.864 1.356-1.356 3.251-2.06 5.491-2.13l-1.834-1.834a1 1 0 0 1 0-1.414Z';
const TEMPLATE = 'M19.482 14.763a1.99 1.99 0 0 0 .627-.998l2.07-7.727a2 2 0 0 0-1.414-2.45l-7.727-2.07a2 2 0 0 0-2.45 1.414L9.421 7.289a6.5 6.5 0 1 0-1.62 12.705C7.799 21.038 8.635 22 9.804 22h10.392c1.54 0 2.502-1.667 1.732-3l-2.446-4.237Zm.766-9.243-1.935 7.219L16.733 10c-.77-1.333-2.695-1.333-3.465 0l-.966 1.673-1.852-.496 2.07-7.728 7.728 2.071ZM8.75 17.824A4.505 4.505 0 0 1 3 13.5a4.5 4.5 0 0 1 5.903-4.277l-.385 1.436a2 2 0 0 0 1.414 2.45l1.335.357-2.516 4.358ZM15 11l5.196 9H9.804L15 11Z';
const BLOCK_LINK = 'M4.15 1.7h14.894a2 2 0 0 1 2 2v2.014h-2V3.7H4.15v14.895h2.543v2H4.15a2 2 0 0 1-2-2V3.7a2 2 0 0 1 2-2Zm17.57 5.954c1.9 1.594 2.296 4.415.703 6.313l-.443.528a1 1 0 1 1-1.532-1.286l.443-.528c.81-.965.687-2.536-.456-3.495-1.142-.959-2.71-.808-3.521.158l-2.487 2.963c-.638.761-.552 2.019.374 2.795l.675.567A1 1 0 1 1 14.19 17.2l-.675-.567c-1.683-1.412-2.04-3.919-.62-5.612l2.487-2.963c1.592-1.899 4.439-2 6.339-.405Zm-5.697 13.942c-1.593 1.898-4.44 1.999-6.34.404-1.9-1.594-2.294-4.415-.702-6.313l.443-.527a1 1 0 1 1 1.532 1.285l-.443.528c-.81.966-.687 2.537.456 3.495 1.143.96 2.711.808 3.521-.158l2.487-2.963c.639-.761.552-2.018-.373-2.795l-.676-.566a1 1 0 1 1 1.286-1.533l.675.567c1.683 1.412 2.04 3.92.62 5.613l-2.486 2.963Z';
const ADD_BELOW = [
  'M11 8a1 1 0 1 1 2 0v3h3a1 1 0 1 1 0 2h-3v3a1 1 0 1 1-2 0v-3H8a1 1 0 1 1 0-2h3V8Z',
  'M2 4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4Zm2 0v16h16V4H4Z',
];
const CROP_PATH = 'M6.667 2.533A.533.533 0 0 0 6.133 2H5.2a.533.533 0 0 0-.533.533v2.8h-2.8a.533.533 0 0 0-.534.534V6.8c0 .295.24.533.534.533h2.8V17.6c0 .59.477 1.067 1.067 1.067h11.601v2.8c0 .294.239.533.533.533h.934a.533.533 0 0 0 .533-.533v-2.8h2.799a.533.533 0 0 0 .533-.534V17.2a.533.533 0 0 0-.534-.533h-2.798v-8.8c0-.014 0-.028-.002-.04V6.4c0-.59-.477-1.067-1.066-1.067h-11.6v-2.8Zm10.666 14.134H6.668V7.333h10.667v9.334Z';

export default function ImageContextMenu({
  editor,
  x,
  y,
  onClose,
  anchorRef,
  blockAnchorRef,
  onHoverDismiss,
  onMouseEnterCancel,
}: ImageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const alignTriggerRef = useRef<HTMLDivElement>(null);
  const imageEditTriggerRef = useRef<HTMLDivElement>(null);
  const addBelowTriggerRef = useRef<HTMLDivElement>(null);
  const addBelowFlyoutRef = useRef<HTMLDivElement>(null);
  const { finalPos, posVisible } = useAnchoredContextMenuPosition(anchorRef, menuRef, { x, y });
  const [activeFlyout, setActiveFlyout] = useState<{ kind: 'align' | 'below' | 'imageEdit'; rect: DOMRect } | null>(null);

  useEffect(() => {
    const isWithinShell = (target: Node) => {
      if (menuRef.current?.contains(target)) return true;
      if (addBelowFlyoutRef.current?.contains(target)) return true;
      if (target instanceof Element && target.closest('.context-submenu-flyout, .context-add-below-flyout, .docx-menu-wrapper')) {
        return true;
      }
      return false;
    };

    const handleClick = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const t = e.target as Node;
      if (isWithinShell(t)) return;
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
    };
  }, [anchorRef, onClose]);

  const alignSelectionToBlockAnchor = () =>
    syncEditorSelectionToAnchoredBlock(editor, blockAnchorRef?.current ?? null);

  const dismissByHover = () => {
    (onHoverDismiss ?? onClose)();
  };

  const hoverGroup = useHoverFloatingGroup({
    refs: [menuRef, alignTriggerRef, imageEditTriggerRef, addBelowTriggerRef, addBelowFlyoutRef, anchorRef],
    selectors: [
      '.docx-menu-wrapper',
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
      '.docx-menu-wrapper',
      '.context-submenu-flyout',
      '.context-add-below-flyout',
    ]);

  const handleShellMouseLeave = (e: React.MouseEvent) => {
    if (pointerStillInShell(e.relatedTarget)) return;
    hoverGroup.scheduleClose(e.relatedTarget);
  };

  const keepHoverAlive = () => {
    hoverGroup.cancelClose();
    onMouseEnterCancel?.();
  };

  const openFlyout = (kind: 'align' | 'below' | 'imageEdit', triggerEl: HTMLElement) => {
    setActiveFlyout({ kind, rect: triggerEl.getBoundingClientRect() });
  };

  const handleFlyoutMouseLeave = (e: React.MouseEvent) => {
    if (pointerStillInShell(e.relatedTarget)) return;
    hoverGroup.scheduleClose(e.relatedTarget);
  };

  const handleSyncBlock = () => {
    alignSelectionToBlockAnchor();
    const block = getImageBlockRange(editor);
    if (!block) return;
    editor.chain().focus().insertContentAt(block.to, {
      type: 'localSyncBlock',
      attrs: { syncId: `sync-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}` },
      content: [{ type: 'paragraph' }],
    }).run();
    onClose();
  };

  const handleComment = () => {
    alignSelectionToBlockAnchor();
    const block = getImageBlockRange(editor);
    if (!block) return;
    const existingBlockId = String(block.node.attrs.blockId || block.node.attrs.id || '');
    const resolvedBlockId = existingBlockId || makeFeishuBlockId('image');
    if (!existingBlockId) {
      editor
        .chain()
        .focus()
        .setNodeSelection(block.from)
        .updateAttributes(block.node.type.name, { blockId: resolvedBlockId })
        .run();
    }
    window.dispatchEvent(new CustomEvent('feishu-open-comment-sidebar', {
      detail: {
        documentId: (editor as any).__documentId,
        blockId: resolvedBlockId,
        threadId: resolvedBlockId,
        anchorType: 'block',
      },
    }));
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

  const handleDelete = () => {
    alignSelectionToBlockAnchor();
    const block = getImageBlockRange(editor);
    if (!block) return;
    editor.chain().focus().deleteRange({ from: block.from, to: block.to }).run();
    onClose();
  };

  const handleShare = async () => {
    alignSelectionToBlockAnchor();
    const url = await copyCurrentBlockLink(editor);
    if (!url) {
      await navigator.clipboard?.writeText(window.location.href);
    }
    void MessagePlugin.success('分享链接已复制');
    onClose();
  };

  const handleSaveTemplate = async () => {
    alignSelectionToBlockAnchor();
    const block = getImageBlockRange(editor);
    if (!block) return;
    const html = serializeRangeToHtml(editor, block.from, block.to);
    const title = String(block.node.attrs.caption || block.node.attrs.name || block.node.attrs.alt || '图片模板').slice(0, 30);
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

  const handleCopyBlockLink = async () => {
    alignSelectionToBlockAnchor();
    await copyCurrentBlockLink(editor);
    void MessagePlugin.success('块链接已复制');
    onClose();
  };

  const handleCrop = () => {
    alignSelectionToBlockAnchor();
    dispatchImageBlockAction('crop');
    onClose();
  };

  const setAlign = (align: ImageAlign) => {
    alignSelectionToBlockAnchor();
    setImageAlignOnEditor(editor, align);
    onClose();
  };

  const currentAlign = getImageAlignFromEditor(editor);
  const submenuIconStroke = { strokeWidth: 2.75 };

  const flyoutPosition = activeFlyout && posVisible
    ? computeSubmenuFlyoutPosition({
      trigger: activeFlyout.rect,
      panelWidth: activeFlyout.kind === 'below' ? 252 : 200,
      panelHeight: activeFlyout.kind === 'below'
        ? clampFlyoutHeight(addBelowFlyoutRef.current?.scrollHeight ?? ADD_BELOW_FLYOUT_MAX_HEIGHT)
        : activeFlyout.kind === 'imageEdit' ? 48 : 132,
      gap: 0,
      pad: 8,
    })
    : null;

  const flyoutFixedStyle = flyoutPosition
    ? { position: 'fixed' as const, top: flyoutPosition.top, left: flyoutPosition.left, zIndex: 10060 }
    : undefined;

  const imageEditFlyoutPanel = (
    <div
      className="context-submenu-flyout context-image-edit-flyout"
      style={flyoutFixedStyle}
      onPointerEnter={keepHoverAlive}
      onMouseLeave={handleFlyoutMouseLeave}
      onMouseDown={e => e.preventDefault()}
    >
      <button type="button" className="context-align-row" onClick={handleCrop}>
        <span className="context-menu-icon">
          <MenuIcon dataIcon="CropOutlined" paths={[CROP_PATH]} />
        </span>
        <span className="context-align-label">裁剪</span>
      </button>
    </div>
  );

  const alignFlyoutPanel = (
    <div
      className="context-submenu-flyout context-align-flyout"
      style={flyoutFixedStyle}
      onPointerEnter={keepHoverAlive}
      onMouseLeave={handleFlyoutMouseLeave}
      onMouseDown={e => e.preventDefault()}
    >
      {ALIGN_OPTIONS.map(option => {
        const active = currentAlign === option.value;
        return (
          <button
            key={option.value}
            type="button"
            className={`context-align-row ${active ? 'context-align-row--active' : ''}`}
            onClick={() => setAlign(option.value)}
          >
            <span className="context-menu-icon">
              <option.Icon {...submenuIconStroke} size={16} fill={active ? PRIMARY : ICON_MUTED} />
            </span>
            <span className="context-align-label">{option.label}</span>
            {active && <span className="context-align-check" aria-hidden>✓</span>}
          </button>
        );
      })}
    </div>
  );

  const addBelowFlyoutPanel = (
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
      tabIndex={0}
      className="docx-menu-wrapper docx-menu-wrapper-animation ud-scrollbar toolbox menu-align-horizontal image-context-menu"
      data-floating-panel="true"
      data-no-marquee-selection="true"
      style={{
        position: 'fixed',
        left: finalPos.x,
        top: finalPos.y,
        zIndex: 10050,
        visibility: posVisible ? 'visible' : 'hidden',
        outline: 'transparent',
        maxHeight: 640,
      }}
      onPointerEnter={keepHoverAlive}
      onMouseLeave={handleShellMouseLeave}
    >
      <div className="docx-menu-container docx-menu-container--vertical">
        <PanelSubmenuItem
          name="imageEdit"
          label="图片编辑"
          dataIcon="CropOutlined"
          paths={[CROP_PATH]}
          open={activeFlyout?.kind === 'imageEdit'}
          triggerRef={imageEditTriggerRef}
          onOpen={() => {
            keepHoverAlive();
            if (imageEditTriggerRef.current) openFlyout('imageEdit', imageEditTriggerRef.current);
          }}
        />
        <div className="menu-divider-item" />
        <PanelMenuItem
          name="synced block"
          label="同步块"
          dataIcon="LinkRecordOutlined"
          paths={SYNC_BLOCK}
          iconColor="var(--icon-n1)"
          onClick={handleSyncBlock}
        />
        <div className="menu-divider-item" />
        <PanelSubmenuItem
          name="AlignList"
          label="缩进和对齐"
          dataIcon="TypographyOutlined"
          paths={[TYPOGRAPHY]}
          open={activeFlyout?.kind === 'align'}
          triggerRef={alignTriggerRef}
          onOpen={() => {
            keepHoverAlive();
            if (alignTriggerRef.current) openFlyout('align', alignTriggerRef.current);
          }}
        />
        <div className="menu-divider-item" />
        <PanelMenuItem
          name="comment"
          label="评论"
          dataIcon="AddCommentOutlined"
          paths={COMMENT_PATHS}
          itemClass="comment-item panel-menu-item"
          onClick={handleComment}
        />
        <PanelMenuItem
          name="cut"
          label="剪切"
          dataIcon="FeishuclipOutlined"
          paths={[CUT]}
          iconClass="universe-icon menu_ud_icon color-g-500"
          onClick={handleCut}
        />
        <PanelMenuItem
          name="copy"
          label="复制"
          dataIcon="CopyOutlined"
          paths={COPY}
          iconClass="universe-icon menu_ud_icon color-b-500"
          onClick={handleCopy}
        />
        <PanelMenuItem
          name="delete"
          label="删除"
          dataIcon="DeleteTrashOutlined"
          paths={[DELETE]}
          iconClass="universe-icon menu_ud_icon color-r-500"
          itemClass="delete-item panel-menu-item"
          onClick={handleDelete}
        />
        <div className="menu-divider-item" />
        <PanelMenuItem
          name="shareTextLink"
          label="分享"
          dataIcon="SharewordsOutlined"
          paths={[SHARE]}
          iconClass="universe-icon menu_ud_icon color-b-500"
          onClick={() => void handleShare()}
        />
        <PanelMenuItem
          name="saveBlockTemplate"
          label="保存为模板"
          dataIcon="TemplateOutlined"
          paths={[TEMPLATE]}
          onClick={() => void handleSaveTemplate()}
        />
        <PanelMenuItem
          name="copyAnchorLink"
          label="复制链接"
          dataIcon="BlocklinkOutlined"
          paths={[BLOCK_LINK]}
          iconClass="universe-icon menu_ud_icon color-b-500"
          onClick={() => void handleCopyBlockLink()}
        />
        <div className="menu-divider-item" />
        <PanelSubmenuItem
          name="addInNewLine"
          label="在下方添加"
          dataIcon="NewJoinMeetingOutlined"
          paths={ADD_BELOW}
          open={activeFlyout?.kind === 'below'}
          triggerRef={addBelowTriggerRef}
          onOpen={() => {
            keepHoverAlive();
            if (addBelowTriggerRef.current) openFlyout('below', addBelowTriggerRef.current);
          }}
        />
      </div>
    </div>
  );

  return createPortal(
    <Fragment>
      {menuPanel}
      {activeFlyout?.kind === 'imageEdit' && flyoutPosition && imageEditFlyoutPanel}
      {activeFlyout?.kind === 'align' && flyoutPosition && alignFlyoutPanel}
      {activeFlyout?.kind === 'below' && flyoutPosition && addBelowFlyoutPanel}
    </Fragment>,
    document.body,
  );
}
