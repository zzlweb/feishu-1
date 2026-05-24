import type { Editor } from '@tiptap/react';
import type { Node as ProseNode } from '@tiptap/pm/model';
import { NodeSelection } from '@tiptap/pm/state';
import { FEISHU_BLOCK_ID_TYPES, makeFeishuBlockId, sanitizeFeishuBlockId } from './feishuBlockId';
import { resolveBlockElement } from './blockDom';

function readStoredBlockId(node: ProseNode): string | null {
  return sanitizeFeishuBlockId(node.attrs?.blockId);
}

function resolveHighlightBlockDomWrapper(editor: Editor, from: number): HTMLElement | null {
  const editorRoot = editor.view.dom as HTMLElement;
  const maxPos = editor.state.doc.content.size;
  const clamped = Math.min(Math.max(1, from), maxPos);
  try {
    const domAt = editor.view.domAtPos(clamped);
    let el: HTMLElement | null =
      domAt.node.nodeType === Node.TEXT_NODE
        ? (domAt.node.parentElement as HTMLElement | null)
        : (domAt.node as HTMLElement);

    while (el && el !== editorRoot) {
      if (
        el.classList.contains('feishu-highlight-block-wrap')
        || el.getAttribute('data-type') === 'highlight-block'
      ) {
        return el;
      }
      el = el.parentElement;
    }
  } catch {
    return null;
  }
  return null;
}

function parseDomBlockAnchorId(wrapper: HTMLElement | null): string | null {
  if (!wrapper) return null;
  return sanitizeFeishuBlockId(wrapper.id || wrapper.getAttribute('data-block-id'));
}

function isBlockAnchorNode(node: ProseNode): boolean {
  return FEISHU_BLOCK_ID_TYPES.includes(node.type.name);
}

export function resolveCurrentBlockAnchor(editor: Editor): {
  pos: number;
  node: ProseNode;
  selectionFrom: number;
} | null {
  const $from = editor.state.selection.$from;
  const selectionFrom = editor.state.selection.from;
  const selection = editor.state.selection;

  if (selection instanceof NodeSelection && isBlockAnchorNode(selection.node)) {
    return { pos: selection.from, node: selection.node, selectionFrom };
  }

  for (let d = 1; d <= $from.depth; d++) {
    const node = $from.node(d);
    if (node.type.name === 'highlightBlock') {
      return { pos: $from.start(d), node, selectionFrom };
    }
  }

  for (let d = $from.depth; d >= 1; d--) {
    const node = $from.node(d);
    if (isBlockAnchorNode(node)) {
      return { pos: $from.start(d), node, selectionFrom };
    }
  }

  return null;
}

export function ensureCurrentBlockId(editor: Editor): string | null {
  const anchor = resolveCurrentBlockAnchor(editor);
  if (!anchor) return null;

  let blockId = readStoredBlockId(anchor.node);
  const isHighlight = anchor.node.type.name === 'highlightBlock';

  if (!blockId && isHighlight) {
    blockId = parseDomBlockAnchorId(resolveHighlightBlockDomWrapper(editor, anchor.selectionFrom)) ?? makeFeishuBlockId(anchor.node.type.name);
  } else if (!blockId) {
    blockId = makeFeishuBlockId(anchor.node.type.name);
  }

  if (!readStoredBlockId(anchor.node)) {
    const tr = editor.state.tr.setNodeMarkup(anchor.pos, undefined, {
      ...anchor.node.attrs,
      blockId,
    });
    editor.view.dispatch(tr);
  }

  return blockId;
}

export function buildBlockLink(blockId: string): string {
  return `${window.location.origin}${window.location.pathname}#${encodeURIComponent(blockId)}`;
}

export async function copyCurrentBlockLink(editor: Editor): Promise<string | null> {
  const blockId = ensureCurrentBlockId(editor);
  if (!blockId) return null;
  const url = buildBlockLink(blockId);
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
  } else {
    const textarea = document.createElement('textarea');
    textarea.value = url;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
  return url;
}

export function scrollToBlockFromHash(): boolean {
  const raw = decodeURIComponent(window.location.hash.replace(/^#/, '')).trim();
  const blockId = sanitizeFeishuBlockId(raw);
  if (!blockId) return false;

  const target = resolveBlockElement(document, blockId);
  if (!(target instanceof HTMLElement)) return false;

  target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  target.classList.add('feishu-block-link-highlight');
  window.setTimeout(() => {
    target.classList.remove('feishu-block-link-highlight');
  }, 1800);
  return true;
}
