import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { FeishuTableView } from './feishuTableView';

const TABLE_CLASS = 'feishu-table';

/**
 * 飞书富文本表格扩展。
 * resizable:false 时 TipTap 不会挂载 TableView，DOM 无 tableWrapper，行列 UI 无法定位。
 * 此处始终使用 FeishuTableView 包裹 table + tbody。
 */
export const FeishuTable = Table.extend({
  addNodeView() {
    return ({ node }) =>
      new FeishuTableView(node, this.options.cellMinWidth, TABLE_CLASS);
  },
}).configure({
  resizable: true,
  HTMLAttributes: { class: TABLE_CLASS },
  allowTableNodeSelection: true,
});

export const FeishuTableRow = TableRow;
export const FeishuTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: element => element.style.backgroundColor || null,
        renderHTML: attributes => {
          if (!attributes.backgroundColor) return {};
          return { style: `background-color: ${attributes.backgroundColor}` };
        },
      },
    };
  },
}).configure({
  HTMLAttributes: { class: 'feishu-table__header-cell' },
});

export const FeishuTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: element => element.style.backgroundColor || null,
        renderHTML: attributes => {
          if (!attributes.backgroundColor) return {};
          return { style: `background-color: ${attributes.backgroundColor}` };
        },
      },
    };
  },
}).configure({
  HTMLAttributes: { class: 'feishu-table__cell' },
});

export const feishuTableExtensions = [
  FeishuTable,
  FeishuTableRow,
  FeishuTableHeader,
  FeishuTableCell,
];
