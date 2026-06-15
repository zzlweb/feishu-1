import Heading from '@tiptap/extension-heading';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { makeFeishuBlockId, sanitizeFeishuBlockId } from './feishuBlockId';

export function makeHeadingId(): string {
  return `heading-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function readHeadingId(attrs: Record<string, unknown>): string | null {
  return sanitizeFeishuBlockId(attrs.headingId);
}

function resolveHeadingAnchorId(attrs: Record<string, unknown>): string {
  return sanitizeFeishuBlockId(attrs.blockId)
    ?? readHeadingId(attrs)
    ?? makeFeishuBlockId('heading');
}

/** 标题块：持久 headingId，渲染到 DOM id，供目录/折叠/跳转使用 */
export const FeishuHeading = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      headingId: {
        default: null,
        parseHTML: element =>
          element.getAttribute('data-heading-id') || element.id || element.getAttribute('data-block-id') || null,
        renderHTML: attributes => {
          const id = resolveHeadingAnchorId(attributes as Record<string, unknown>);
          if (!id) return {};
          return { id, 'data-heading-id': id, 'data-block-id': id };
        },
      },
    };
  },

  addProseMirrorPlugins() {
    const parentPlugins = this.parent?.() ?? [];
    return [
      ...parentPlugins,
      new Plugin({
        key: new PluginKey('feishuHeadingIdAssign'),
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some(tr => tr.docChanged)) return null;
          const tr = newState.tr;
          let modified = false;
          newState.doc.descendants((node, pos) => {
            if (node.type.name !== 'heading') return;
            const id = resolveHeadingAnchorId(node.attrs);
            if (node.attrs.headingId === id && node.attrs.blockId === id) return;
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              headingId: id,
              blockId: id,
            });
            modified = true;
          });
          return modified ? tr : null;
        },
      }),
    ];
  },
});
