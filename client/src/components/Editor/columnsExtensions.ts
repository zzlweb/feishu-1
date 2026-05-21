import { Node as TiptapNode } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ColumnBlockNodeView, ColumnsNodeView } from './columnsNodeViews';

const LocalColumnBlock = TiptapNode.create({
  name: 'localColumnBlock',
  group: 'localColumn',
  content: 'block+',
  isolating: true,
  addAttributes() {
    return {
      widthRatio: {
        default: 1,
        parseHTML: element => {
          const raw = Number(element.getAttribute('data-width-ratio'));
          return Number.isFinite(raw) && raw > 0 ? raw : 1;
        },
        renderHTML: attributes => ({
          'data-width-ratio': String(attributes.widthRatio ?? 1),
        }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-local-column]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', { ...HTMLAttributes, 'data-local-column': 'true', class: 'feishu-columns-block__col-wrap' }, ['div', { class: 'feishu-columns-block__col' }, 0]];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ColumnBlockNodeView);
  },
});

const LocalColumnsBlock = TiptapNode.create({
  name: 'localColumnsBlock',
  group: 'block',
  content: 'localColumnBlock+',
  isolating: true,
  parseHTML() {
    return [{ tag: 'div[data-local-block="columns"]' }];
  },
  renderHTML() {
    return ['div', { 'data-local-block': 'columns', class: 'feishu-columns-node' }, 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ColumnsNodeView);
  },
});

export const localColumnsExtensions = [LocalColumnBlock, LocalColumnsBlock];
