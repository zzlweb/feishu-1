import type { Editor } from '@tiptap/react';
import type { Node as ProseNode } from '@tiptap/pm/model';

/** 与高亮块 NodeView（HighlightBlock.makeBlockId）同格式，便于与工具栏评论共用同一条会话。 */
function makeHighlightBlockId() {
  return `highlight-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 段落/正文评论锚点 — 与高亮块的 `highlight-…` 区分即可 */
export function makeParagraphCommentBlockId() {
  return `block-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function readStoredBlockId(node: ProseNode): string | null {
  const id = node.attrs?.blockId as string | undefined;
  return typeof id === 'string' && id.length > 0 ? id : null;
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
    /* ignore */
  }
  return null;
}

function parseDomBlockAnchorId(wrapper: HTMLElement | null): string | null {
  if (!wrapper) return null;
  const raw = wrapper.id || wrapper.getAttribute('data-block-id') || '';
  if (!raw.trim()) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(raw)) return null;
  return raw;
}

/**
 * Prefers `highlightBlock`（从外往里），否则内层最近的 `paragraph` / `heading`。
 */
export function resolveCommentAnchorFromEditor(editor: Editor): {
  pos: number;
  node: ProseNode;
  selectionFrom: number;
} | null {
  const $from = editor.state.selection.$from;
  const selectionFrom = editor.state.selection.from;

  for (let d = 1; d <= $from.depth; d++) {
    const node = $from.node(d);
    if (node.type.name === 'highlightBlock') {
      return { pos: $from.start(d), node, selectionFrom };
    }
  }

  for (let d = $from.depth; d >= 1; d--) {
    const node = $from.node(d);
    if (node.type.name === 'paragraph' || node.type.name === 'heading') {
      return { pos: $from.start(d), node, selectionFrom };
    }
  }

  return null;
}

/** 与高亮菜单「评论」一致：沿用 attrs.blockId；否则用已在 DOM 上的 id（NodeView）；再否则分配 highlight-… 并写入。 */
export function openCommentSidebarForEditorSelection(editor: Editor, documentId: string): boolean {
  if (!documentId) return false;
  const anchor = resolveCommentAnchorFromEditor(editor);
  if (!anchor) return false;

  let blockId = readStoredBlockId(anchor.node);
  const isHighlight = anchor.node.type.name === 'highlightBlock';

  if (!blockId && isHighlight) {
    blockId = parseDomBlockAnchorId(resolveHighlightBlockDomWrapper(editor, anchor.selectionFrom))
      ?? makeHighlightBlockId();
  } else if (!blockId) {
    blockId = makeParagraphCommentBlockId();
  }

  if (!readStoredBlockId(anchor.node)) {
    const tr = editor.state.tr.setNodeMarkup(anchor.pos, undefined, {
      ...anchor.node.attrs,
      blockId,
    });
    editor.view.dispatch(tr);
  }

  window.dispatchEvent(
    new CustomEvent('feishu-open-comment-sidebar', {
      detail: { documentId, blockId },
    }),
  );
  return true;
}
