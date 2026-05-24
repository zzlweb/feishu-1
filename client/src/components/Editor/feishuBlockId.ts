import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { Node as ProseNode } from '@tiptap/pm/model';

export const FEISHU_BLOCK_ID_TYPES = [
  'paragraph',
  'heading',
  'listItem',
  'taskItem',
  'blockquote',
  'codeBlock',
  'horizontalRule',
  'image',
  'table',
  'localColumnsBlock',
  'localColumnBlock',
  'highlightBlock',
  'localFileBlock',
  'localDivTableBlock',
  'localSyncBlock',
  'localButtonBlock',
  'localFormulaBlock',
  'localBitableBlock',
  'localEmbedBlock',
];

const BLOCK_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function makeFeishuBlockId(typeName = 'block'): string {
  const safeType = typeName.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase() || 'block';
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${safeType}-${crypto.randomUUID()}`;
  }
  return `${safeType}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function sanitizeFeishuBlockId(raw: unknown): string | null {
  const id = String(raw || '').trim();
  if (!id || !BLOCK_ID_PATTERN.test(id)) return null;
  return id;
}

export function readFeishuBlockId(attrs: Record<string, unknown> | null | undefined): string | null {
  return sanitizeFeishuBlockId(attrs?.blockId);
}

function parseBlockIdFromElement(element: HTMLElement): string | null {
  return sanitizeFeishuBlockId(
    element.getAttribute('data-block-id')
      || element.getAttribute('data-table-id')
      || element.getAttribute('data-heading-id')
      || element.getAttribute('id'),
  );
}

function deriveBlockId(node: ProseNode): string {
  if (node.type.name === 'table' && sanitizeFeishuBlockId(node.attrs.tableId)) {
    return String(node.attrs.tableId);
  }
  if (node.type.name === 'heading' && sanitizeFeishuBlockId(node.attrs.headingId)) {
    return String(node.attrs.headingId);
  }
  if (node.type.name === 'localFileBlock' && sanitizeFeishuBlockId(node.attrs.id)) {
    return String(node.attrs.id);
  }
  return makeFeishuBlockId(node.type.name);
}

function renderBlockIdAttrs(attributes: Record<string, unknown>) {
  const blockId = sanitizeFeishuBlockId(attributes.blockId);
  if (!blockId) return {};

  const attrs: Record<string, string> = { 'data-block-id': blockId };
  if (!sanitizeFeishuBlockId(attributes.headingId) && !sanitizeFeishuBlockId(attributes.tableId)) {
    attrs.id = blockId;
  }
  return attrs;
}

export const FeishuBlockId = Extension.create({
  name: 'feishuBlockId',
  priority: 950,

  addGlobalAttributes() {
    return [
      {
        types: FEISHU_BLOCK_ID_TYPES,
        attributes: {
          blockId: {
            default: null,
            parseHTML: element => parseBlockIdFromElement(element as HTMLElement),
            renderHTML: renderBlockIdAttrs,
          },
        },
      },
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('feishuBlockIdAssign'),
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some(tr => tr.docChanged)) return null;
          const tr = newState.tr;
          let modified = false;

          newState.doc.descendants((node, pos) => {
            if (!FEISHU_BLOCK_ID_TYPES.includes(node.type.name)) return;
            if (readFeishuBlockId(node.attrs)) return;
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              blockId: deriveBlockId(node),
            });
            modified = true;
          });

          return modified ? tr : null;
        },
      }),
    ];
  },
});
