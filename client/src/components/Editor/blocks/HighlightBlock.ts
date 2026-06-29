import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import React, { useEffect, useMemo, useRef, useState } from 'react';

export interface HighlightBlockOptions {
  HTMLAttributes: Record<string, any>;
}

type HighlightBlockAttrs = {
  bgColor?: string;
  borderColor?: string;
  textColor?: string;
  icon?: string;
  blockId?: string;
};

type CommandContext = {
  commands: any;
};

const DEFAULT_BG = '#fff0d9';
const DEFAULT_BORDER = '#ffb057';
const DEFAULT_TEXT = '#1f2329';

const CALLOUT_ICON_MAP: Record<string, string> = {
  bulb: '💡',
  link: '🔗',
  pushpin: '📌',
  pin: '📌',
  page_with_curl: '📄',
  speech_balloon: '💬',
  memo: '📝',
  warning: '⚠️',
  star: '⭐',
  star2: '🌟',
  gem: '💎',
  seedling: '🌱',
  gift: '🎁',
  fire: '🔥',
  book: '📚',
};

function normalizeCalloutIcon(icon: string | null | undefined) {
  if (!icon) return '📍';
  return CALLOUT_ICON_MAP[icon] || icon;
}

const TEXT_COLORS = ['#1f2329', '#8f959e', '#d83931', '#de7802', '#dc9b04', '#2ea121', '#245bdb', '#6425d0'];
const BORDER_COLORS = ['#ffffff', '#dee0e3', '#f98e8b', '#ffba6b', '#fff67a', '#8ee085', '#82a7fc', '#ad82f7'];
const BG_COLORS = ['#ffffff', 'rgba(239, 240, 241, 0.6)', '#fde2e2', '#feead2', '#ffffcc', '#d9f5d6', '#e1eaff', '#ece2fe', 'rgba(222, 224, 227, 0.7)', 'rgba(187, 191, 196, 0.5)', '#fbbfbc', '#fed4a4', '#fffca3', '#b7edb1', '#bacefd', '#cdb2fa'];

function makeBlockId() {
  return `highlight-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function HighlightBlockView({ editor, node, updateAttributes }: NodeViewProps) {
  const [showColors, setShowColors] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const blockId = useMemo(() => node.attrs.blockId || makeBlockId(), [node.attrs.blockId]);

  useEffect(() => {
    if (!showColors) return;
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as globalThis.Node | null;
      if (target && wrapperRef.current?.contains(target)) return;
      setShowColors(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowColors(false);
    };
    document.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [showColors]);

  const updateColor = (attrs: HighlightBlockAttrs) => {
    updateAttributes({ blockId, ...attrs });
  };

  const applyRandomColors = () => {
    updateColor({
      textColor: TEXT_COLORS[Math.floor(Math.random() * TEXT_COLORS.length)],
      borderColor: BORDER_COLORS[Math.floor(Math.random() * BORDER_COLORS.length)],
      bgColor: BG_COLORS[Math.floor(Math.random() * BG_COLORS.length)],
    });
  };

  const copyLink = async () => {
    updateAttributes({ blockId });
    const url = `${window.location.origin}${window.location.pathname}#${blockId}`;
    await navigator.clipboard?.writeText(url);
  };

  const shareBlock = async () => {
    updateAttributes({ blockId });
    const url = `${window.location.origin}${window.location.pathname}#${blockId}`;
    if (navigator.share) {
      await navigator.share({ title: document.title, url });
      return;
    }
    await navigator.clipboard?.writeText(url);
  };

  const openCommentSidebar = () => {
    updateAttributes({ blockId });
    window.dispatchEvent(new CustomEvent('feishu-open-comment-sidebar', {
      detail: { documentId: (editor as any).__documentId, blockId },
    }));
  };

  const h = React.createElement;
  const svg = (dataIcon: string, paths: string[], iconClass = 'universe-icon', viewBox = '0 0 24 24') => h('span', { className: iconClass },
    h('svg', { width: '1em', height: '1em', viewBox, fill: 'none', xmlns: 'http://www.w3.org/2000/svg', 'data-icon': dataIcon, focusable: false, 'aria-hidden': true },
      paths.map((d, index) => h('path', { key: index, d, fill: 'currentColor' })),
    ),
  );
  const menuItem = (name: string, dataIcon: string, paths: string[], onClick: () => void, containerClass = 'panel-menu-item', iconClass = 'universe-icon', extraClass = '') => h('div', {
    className: `${containerClass}${extraClass ? ` ${extraClass}` : ''}`.trim(),
    'data-name': name,
    onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => event.preventDefault(),
    onClick,
  },
    h('div', { className: 'menu-item-content' },
      h('div', { className: 'menu-icon' }, svg(dataIcon, paths, iconClass)),
      h('div', { className: 'menu-item-main-box-wrapper' },
        h('div', { className: 'menu-item-main-box' }),
      ),
    ),
  );
  const textColorButton = (color: string, active: boolean, onClick: () => void, isDefault = false) => h('button', {
    key: color,
    type: 'button',
    className: `callout-highlight-btn text${active ? ' selected' : ''}${isDefault ? ' default' : ''}`,
    onMouseDown: (event: React.MouseEvent<HTMLButtonElement>) => event.preventDefault(),
    onClick,
  },
    h('svg', { width: 22, height: 22, viewBox: '0 0 22 22', fill: 'none', style: { fill: color } },
      h('path', { d: 'M10.277 5.5L6 16.5h1.34l1.156-3.081h4.993l1.156 3.081H16l-4.277-11h-1.446zm-1.385 6.856l2.085-5.5h.061l2.055 5.5H8.892z' }),
    ),
  );
  const fillColorButton = (color: string, active: boolean, onClick: () => void, isDefault = false) => h('button', {
    key: color,
    type: 'button',
    className: `callout-highlight-btn${active ? ' selected' : ''}${isDefault ? ' default' : ''}`,
    onMouseDown: (event: React.MouseEvent<HTMLButtonElement>) => event.preventDefault(),
    onClick,
  }, h('div', { className: 'highlight-bg', style: { backgroundColor: color } }));

  return h(
    NodeViewWrapper,
    {
      as: 'div',
      id: blockId,
      ref: wrapperRef,
      'data-type': 'highlight-block',
      'data-block-id': blockId,
      'data-highlight-icon': normalizeCalloutIcon(node.attrs.icon),
      className: 'feishu-highlight-block-wrap',
      onMouseLeave: () => { if (showColors) setShowColors(false); },
      style: {
        '--highlight-block-bg': node.attrs.bgColor || DEFAULT_BG,
        '--highlight-block-border': node.attrs.borderColor || DEFAULT_BORDER,
        '--highlight-block-text': node.attrs.textColor || DEFAULT_TEXT,
      } as any,
    },
    h('div', { className: 'docx-menu-container overlay-container block-toolbar__overlay slide-top', contentEditable: false },
      menuItem('callout-highlight', 'StyleSetOutlined', [
        'M21.957 2.13a1 1 0 0 0-1.406.147l-9.11 11.25a6.632 6.632 0 0 0-1.367 2.969.221.221 0 0 0 .302.244 6.632 6.632 0 0 0 2.62-1.955l9.109-11.25a1 1 0 0 0-.148-1.406Z',
        'M17.008 3.665a13.454 13.454 0 0 0-5.06-.984l-.024.004-.538.011-.51.03c-1.191.091-2.37.343-3.51.75a12.305 12.305 0 0 0-3.754 2.142c-1.096.922-1.96 1.99-2.568 3.176a8.435 8.435 0 0 0-.96 3.885c0 1.335.324 2.63.962 3.848.608 1.157 1.474 2.195 2.573 3.083a12.303 12.303 0 0 0 3.755 2.049c1.444.494 2.981.745 4.563.745l.545-.01.525-.029a14.43 14.43 0 0 0 1.57-.203l.722-.148.196-.06c.514-.186.96-.566 1.253-1.083a2.87 2.87 0 0 0 .26-2.178l-.09-.349-.03-.218a2.301 2.301 0 0 1 .357-1.454c.357-.544.93-.868 1.538-.871h1.768l.204-.007c1.614-.113 2.91-1.56 3.007-3.365l.006-.22-.006-.24-.05-.432-.067-.404a8.844 8.844 0 0 0-1.236-3.08 10.13 10.13 0 0 0-.802-1.096l-1.199 1.48c.154.2.298.406.43.617.483.76.81 1.563.974 2.393l.06.358.032.276.003.086-.007.22-.021.169c-.12.724-.604 1.301-1.19 1.38l-.138.01h-1.77l-.247.008c-1.14.079-2.192.702-2.847 1.7a4.145 4.145 0 0 0-.574 3.156l.068.273.037.13.028.154a.993.993 0 0 1-.118.588.58.58 0 0 1-.248.247l-.07.021-.67.134-.549.085a12.6 12.6 0 0 1-1.657.11 12.18 12.18 0 0 1-3.961-.647 10.426 10.426 0 0 1-3.19-1.734c-.9-.729-1.606-1.57-2.096-2.5a6.38 6.38 0 0 1-.75-2.984c0-1.037.254-2.06.755-3.034.495-.963 1.206-1.839 2.11-2.6A10.494 10.494 0 0 1 7.99 5.235a11.42 11.42 0 0 1 3.41-.677l.538-.01.496.01c1.153.048 2.281.264 3.338.633l1.236-1.526Z',
        'M6.875 14.466a1.377 1.377 0 0 0-1.374-1.374 1.375 1.375 0 0 0 0 2.747c.758 0 1.374-.616 1.374-1.373ZM8.124 9.47a1.375 1.375 0 0 0-2.748 0 1.374 1.374 0 1 0 2.748 0Zm5.246-1.874a1.374 1.374 0 1 0-2.747-.001 1.374 1.374 0 0 0 2.747 0Z',
      ], () => setShowColors(v => !v), 'panel-submenu-item no-click-action panel-menu-item', 'universe-icon', showColors ? 'is-active' : ''),
      h('div', { className: 'menu-divider-item override-full-height' }),
      menuItem('copyAnchorLink', 'BlocklinkOutlined', ['M4.15 1.7h14.894a2 2 0 0 1 2 2v2.014h-2V3.7H4.15v14.895h2.543v2H4.15a2 2 0 0 1-2-2V3.7a2 2 0 0 1 2-2Zm17.57 5.954c1.9 1.594 2.296 4.415.703 6.313l-.443.528a1 1 0 1 1-1.532-1.286l.443-.528c.81-.965.687-2.536-.456-3.495-1.142-.959-2.71-.808-3.521.158l-2.487 2.963c-.638.761-.552 2.019.374 2.795l.675.567A1 1 0 1 1 14.19 17.2l-.675-.567c-1.683-1.412-2.04-3.919-.62-5.612l2.487-2.963c1.592-1.899 4.439-2 6.339-.405Zm-5.697 13.942c-1.593 1.898-4.44 1.999-6.34.404-1.9-1.594-2.294-4.415-.702-6.313l.443-.527a1 1 0 1 1 1.532 1.285l-.443.528c-.81.966-.687 2.537.456 3.495 1.143.96 2.711.808 3.521-.158l2.487-2.963c.639-.761.552-2.018-.373-2.795l-.676-.566a1 1 0 1 1 1.286-1.533l.675.567c1.683 1.412 2.04 3.92.62 5.613l-2.486 2.963Z'], () => void copyLink(), 'panel-menu-item', 'universe-icon menu_ud_icon'),
      menuItem('shareTextLink', 'SharewordsOutlined', ['M21.5 5c0-.552-.473-1-1.055-1H3.555C2.974 4 2.5 4.448 2.5 5s.473 1 1.056 1h16.889c.582 0 1.055-.448 1.055-1Zm-9.617 6c.647 0 1.172.448 1.172 1s-.525 1-1.172 1h-8.21c-.648 0-1.173-.448-1.173-1s.525-1 1.173-1h8.21Zm-3.167 7c.648 0 1.173.448 1.173 1s-.525 1-1.173 1H3.673c-.648 0-1.173-.448-1.173-1s.525-1 1.173-1h5.043Zm9.077-8.242a1 1 0 0 1 1.415 0l3.535 3.535a1 1 0 0 1 0 1.415l-3.535 3.535a1 1 0 0 1-1.415-1.414l1.822-1.822c-1.819.07-3.162.64-4.065 1.543-.965.965-1.55 2.435-1.55 4.45a1 1 0 1 1-2 0c0-2.403.706-4.434 2.136-5.864 1.356-1.356 3.251-2.06 5.491-2.13l-1.834-1.834a1 1 0 0 1 0-1.414Z'], () => void shareBlock(), 'panel-menu-item', 'universe-icon menu_ud_icon'),
      h('div', { className: 'menu-divider-item' }),
      menuItem('comment', 'AddCommentOutlined', ['M7 11a1 1 0 0 1 1-1h8a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1Z', 'M2 5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v11.5a2 2 0 0 1-2 2h-3.812a.5.5 0 0 0-.33.124l-2.541 2.224a2 2 0 0 1-2.634 0l-2.542-2.224a.5.5 0 0 0-.329-.124H4a2 2 0 0 1-2-2V5Zm2 0v11.5h3.812a2.5 2.5 0 0 1 1.646.619L12 19.343l2.542-2.224a2.5 2.5 0 0 1 1.646-.619H20V5H4Z'], openCommentSidebar, 'comment-item panel-menu-item', 'universe-icon menu_ud_icon'),
    ),
    showColors && h('div', { className: 'feishu-highlight-color-panel overlay-container', contentEditable: false },
      h('div', null,
        h('div', { className: 'callout-highlight-panel' },
          h('div', { className: 'callout-highlight-title-row' },
            h('p', { className: 'group-title' }, '字体颜色'),
            h('button', { type: 'button', className: 'random', onMouseDown: (event: React.MouseEvent<HTMLButtonElement>) => event.preventDefault(), onClick: applyRandomColors }, svg('ReplaceOutlined', ['M17.074 18.185A8 8 0 0 1 4.091 10.79l.941.557a.5.5 0 0 0 .743-.536l-.718-3.345a.5.5 0 0 0-.633-.374l-3.277.982a.5.5 0 0 0-.111.91l1.228.725A10.03 10.03 0 0 0 2 12c0 5.523 4.477 10 10 10a9.966 9.966 0 0 0 6.9-2.761l-1.826-1.054ZM7.233 5.575a8 8 0 0 1 12.724 7.264l-1.097-.624a.5.5 0 0 0-.735.547l.776 3.333a.5.5 0 0 0 .638.363l3.26-1.036a.5.5 0 0 0 .096-.911l-1.075-.612c.118-.615.18-1.25.18-1.899 0-5.523-4.477-10-10-10a9.962 9.962 0 0 0-6.62 2.505l1.853 1.07Z']), '随机'),
          ),
          h('div', { className: 'highlight-menu-group' }, TEXT_COLORS.map((color, index) => textColorButton(color, (node.attrs.textColor || DEFAULT_TEXT) === color, () => updateColor({ textColor: color }), index === 0))),
          h('p', { className: 'group-title' }, '边框颜色'),
          h('div', { className: 'highlight-menu-group' }, BORDER_COLORS.map((color, index) => fillColorButton(color, (node.attrs.borderColor || DEFAULT_BORDER) === color, () => updateColor({ borderColor: color }), index === 0))),
          h('p', { className: 'group-title' }, '填充颜色'),
          h('div', { className: 'highlight-menu-group highlight-menu-group--wrap' }, BG_COLORS.map((color, index) => fillColorButton(color, (node.attrs.bgColor || DEFAULT_BG) === color, () => updateColor({ bgColor: color }), index === 0))),
          h('button', { type: 'button', className: 'callout-clear-highlight', onMouseDown: (event: React.MouseEvent<HTMLButtonElement>) => event.preventDefault(), onClick: () => updateColor({ bgColor: DEFAULT_BG, borderColor: DEFAULT_BORDER, textColor: DEFAULT_TEXT }) }, '恢复默认'),
        ),
      ),
    ),
    h('div', { className: 'feishu-highlight-block' },
      h('span', { className: 'feishu-highlight-icon', contentEditable: false }, normalizeCalloutIcon(node.attrs.icon)),
      h(NodeViewContent, { className: 'feishu-highlight-content' }),
    ),
  );
}

export const HighlightBlock = Node.create<HighlightBlockOptions>({
  name: 'highlightBlock',

  group: 'block',

  content: 'block+',

  defining: true,

  isolating: false,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      bgColor: {
        default: '#fff0d9',
        parseHTML: element => element.getAttribute('data-bg-color') || '#fff0d9',
        renderHTML: attributes => ({
          'data-bg-color': attributes.bgColor,
          style: `--highlight-block-bg: ${attributes.bgColor};`,
        }),
      },
      borderColor: {
        default: '#ffb057',
        parseHTML: element => element.getAttribute('data-border-color') || '#ffb057',
        renderHTML: attributes => ({
          'data-border-color': attributes.borderColor,
          style: `--highlight-block-border: ${attributes.borderColor};`,
        }),
      },
      textColor: {
        default: '#1f2329',
        parseHTML: element => element.getAttribute('data-text-color') || '#1f2329',
        renderHTML: attributes => ({
          'data-text-color': attributes.textColor,
          style: `--highlight-block-text: ${attributes.textColor};`,
        }),
      },
      icon: {
        default: '📍',
        parseHTML: element => normalizeCalloutIcon(element.getAttribute('data-icon')),
        renderHTML: attributes => ({ 'data-icon': normalizeCalloutIcon(attributes.icon) }),
      },
      blockId: {
        default: null,
        parseHTML: element => element.getAttribute('id') || element.getAttribute('data-block-id'),
        renderHTML: attributes => ({ id: attributes.blockId, 'data-block-id': attributes.blockId }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="highlight-block"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const style = [
      HTMLAttributes.style,
      `--highlight-block-bg: ${HTMLAttributes['data-bg-color'] || '#fff0d9'}`,
      `--highlight-block-border: ${HTMLAttributes['data-border-color'] || '#ffb057'}`,
      `--highlight-block-text: ${HTMLAttributes['data-text-color'] || '#1f2329'}`,
    ]
      .filter(Boolean)
      .join('; ');

    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'highlight-block',
        class: 'feishu-highlight-block',
        style,
      }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(HighlightBlockView);
  },

  addCommands() {
    return {
      setHighlightBlock:
        (attributes?: HighlightBlockAttrs) =>
        ({ commands }: CommandContext) =>
          commands.wrapIn(this.name, attributes),
      toggleHighlightBlock:
        (attributes?: HighlightBlockAttrs) =>
        ({ commands }: CommandContext) =>
          commands.toggleWrap(this.name, attributes),
      unsetHighlightBlock:
        () =>
        ({ commands }: CommandContext) =>
          commands.lift(this.name),
    } as any;
  },
});
