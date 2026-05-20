import Heading from '@tiptap/extension-heading';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export function makeHeadingId(): string {
  return `heading-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function readHeadingId(attrs: Record<string, unknown>): string | null {
  const id = attrs.headingId;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/** 标题块：持久 headingId，渲染到 DOM id，供目录/折叠/跳转使用 */
export const FeishuHeading = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      headingId: {
        default: null,
        parseHTML: element =>
          element.getAttribute('data-heading-id') || element.id || null,
        renderHTML: attributes => {
          const id = readHeadingId(attributes as Record<string, unknown>);
          if (!id) return {};
          return { id, 'data-heading-id': id };
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
            if (readHeadingId(node.attrs)) return;
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              headingId: makeHeadingId(),
            });
            modified = true;
          });
          return modified ? tr : null;
        },
      }),
    ];
  },
});
