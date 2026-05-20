import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

/** 与 @tiptap/extension-table 内置 TableView 一致，并强制包裹层 + feishu-table 类名 */
function updateColumns(
  node: ProseMirrorNode,
  colgroup: HTMLElement,
  table: HTMLTableElement,
  cellMinWidth: number,
  overrideCol?: number,
  overrideValue?: number,
) {
  let totalWidth = 0;
  let fixedWidth = true;
  let nextDOM = colgroup.firstChild;
  const row = node.firstChild;
  if (!row) return;

  for (let i = 0, col = 0; i < row.childCount; i += 1) {
    const { colspan, colwidth } = row.child(i).attrs;
    for (let j = 0; j < colspan; j += 1, col += 1) {
      const hasWidth = overrideCol === col ? overrideValue : colwidth && colwidth[j];
      const cssWidth = hasWidth ? `${hasWidth}px` : '';
      totalWidth += hasWidth || cellMinWidth;
      if (!hasWidth) fixedWidth = false;
      if (!nextDOM) {
        const colEl = document.createElement('col');
        colEl.style.width = cssWidth;
        colgroup.appendChild(colEl);
      } else {
        if ((nextDOM as HTMLElement).style.width !== cssWidth) {
          (nextDOM as HTMLElement).style.width = cssWidth;
        }
        nextDOM = nextDOM.nextSibling;
      }
    }
  }
  while (nextDOM) {
    const after = nextDOM.nextSibling;
    nextDOM.parentNode?.removeChild(nextDOM);
    nextDOM = after;
  }
  if (fixedWidth) {
    table.style.width = `${totalWidth}px`;
    table.style.minWidth = '';
  } else {
    table.style.width = '';
    table.style.minWidth = `${totalWidth}px`;
  }
}

/** 飞书表格 NodeView：resizable:false 时 TipTap 默认不包 tableWrapper，此处始终包裹 */
export class FeishuTableView {
  node: ProseMirrorNode;
  cellMinWidth: number;
  dom: HTMLDivElement;
  chromeMount: HTMLDivElement;
  table: HTMLTableElement;
  colgroup: HTMLElement;
  contentDOM: HTMLTableSectionElement;

  constructor(node: ProseMirrorNode, cellMinWidth: number, tableClass = 'feishu-table') {
    this.node = node;
    this.cellMinWidth = cellMinWidth;
    this.dom = document.createElement('div');
    this.dom.className = 'tableWrapper feishu-table-host';

    this.chromeMount = document.createElement('div');
    this.chromeMount.className = 'feishu-table-chrome-mount';
    this.chromeMount.setAttribute('contenteditable', 'false');
    this.dom.appendChild(this.chromeMount);

    this.table = document.createElement('table');
    this.table.className = tableClass;
    this.dom.appendChild(this.table);
    this.colgroup = this.table.appendChild(document.createElement('colgroup'));
    updateColumns(node, this.colgroup, this.table, cellMinWidth);
    this.contentDOM = this.table.appendChild(document.createElement('tbody'));
  }

  update(node: ProseMirrorNode) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    updateColumns(node, this.colgroup, this.table, this.cellMinWidth);
    return true;
  }

  ignoreMutation(record: { type: string; target: Node }) {
    const target = record.target;
    if (target === this.dom || target === this.chromeMount || this.chromeMount.contains(target)) {
      return true;
    }
    if (target instanceof Element && target.closest('.feishu-table-chrome')) {
      return true;
    }
    return (
      record.type === 'attributes'
      && (record.target === this.table || this.colgroup.contains(record.target))
    );
  }
}
