import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';

/** 使用 TipTap 默认表格 DOM，避免 React NodeView 与 ProseMirror 争抢 tbody 导致白屏 */
export const FeishuTable = Table.configure({
  resizable: false,
  HTMLAttributes: { class: 'feishu-table' },
});

export const FeishuTableRow = TableRow;

export const FeishuTableHeader = TableHeader.configure({
  HTMLAttributes: { class: 'feishu-table__header-cell' },
});

export const FeishuTableCell = TableCell.configure({
  HTMLAttributes: { class: 'feishu-table__cell' },
});

export const feishuTableExtensions = [
  FeishuTable,
  FeishuTableRow,
  FeishuTableHeader,
  FeishuTableCell,
];
