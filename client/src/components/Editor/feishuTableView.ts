import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { sanitizeFeishuBlockId } from './feishuBlockId';

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
  let nextDOM = colgroup.firstChild;
  const row = node.firstChild;
  if (!row) return;

  for (let i = 0, col = 0; i < row.childCount; i += 1) {
    const { colspan, colwidth } = row.child(i).attrs;
    for (let j = 0; j < colspan; j += 1, col += 1) {
      const width = Math.max(cellMinWidth, Number(overrideCol === col ? overrideValue : colwidth && colwidth[j]) || cellMinWidth);
      const cssWidth = `${width}px`;
      totalWidth += width;
      if (!nextDOM) {
        const colEl = document.createElement('col');
        colEl.setAttribute('data-col-index', String(col));
        colEl.style.width = cssWidth;
        colgroup.appendChild(colEl);
      } else {
        (nextDOM as HTMLElement).setAttribute('data-col-index', String(col));
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
  table.style.width = `${totalWidth}px`;
  table.style.minWidth = '100%';
}

/** 飞书表格 NodeView：resizable:false 时 TipTap 默认不包 tableWrapper，此处始终包裹 */
export class FeishuTableView {
  node: ProseMirrorNode;
  cellMinWidth: number;
  dom: HTMLDivElement;
  chromeMount: HTMLDivElement;
  scroll: HTMLDivElement;
  table: HTMLTableElement;
  colgroup: HTMLElement;
  contentDOM: HTMLTableSectionElement;

  constructor(node: ProseMirrorNode, cellMinWidth: number, viewOrTableClass?: unknown) {
    const tableClass = typeof viewOrTableClass === 'string' ? viewOrTableClass : 'feishu-table';
    this.node = node;
    this.cellMinWidth = cellMinWidth;
    this.dom = document.createElement('div');
    this.dom.className = 'tableWrapper feishu-table-host';
    this.dom.setAttribute('data-block-type', 'table');
    this.dom.setAttribute('data-table-root', 'true');
    const blockId = sanitizeFeishuBlockId(node.attrs.blockId) ?? sanitizeFeishuBlockId(node.attrs.tableId);
    if (blockId) this.dom.setAttribute('data-block-id', blockId);

    this.scroll = document.createElement('div');
    this.scroll.className = 'feishu-table-scroll';
    this.scroll.setAttribute('data-table-wrapper', 'true');
    this.dom.appendChild(this.scroll);

    this.table = document.createElement('table');
    this.table.className = tableClass;
    this.table.setAttribute('data-rich-table', 'true');
    this.scroll.appendChild(this.table);

    /* 左右渐隐提示层：置于 scroll 外，避免 overflow 裁剪伪元素 */
    const edgeFades = document.createElement('div');
    edgeFades.className = 'feishu-table-edge-fades';
    edgeFades.setAttribute('aria-hidden', 'true');
    const edgeFadeLeft = document.createElement('div');
    edgeFadeLeft.className = 'feishu-table-edge-fade feishu-table-edge-fade--left';
    const edgeFadeRight = document.createElement('div');
    edgeFadeRight.className = 'feishu-table-edge-fade feishu-table-edge-fade--right';
    edgeFades.appendChild(edgeFadeLeft);
    edgeFades.appendChild(edgeFadeRight);
    this.dom.appendChild(edgeFades);

    /* 操作层置于 scroll 之后，避免表格滚动层盖住灰点/轨道 */
    this.chromeMount = document.createElement('div');
    this.chromeMount.className = 'feishu-table-chrome-mount';
    this.chromeMount.setAttribute('contenteditable', 'false');
    this.dom.appendChild(this.chromeMount);
    this.colgroup = this.table.appendChild(document.createElement('colgroup'));
    updateColumns(node, this.colgroup, this.table, cellMinWidth);
    this.contentDOM = this.table.appendChild(document.createElement('tbody'));
  }

  update(node: ProseMirrorNode) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    const blockId = sanitizeFeishuBlockId(node.attrs.blockId) ?? sanitizeFeishuBlockId(node.attrs.tableId);
    if (blockId) {
      this.dom.setAttribute('data-block-id', blockId);
      this.table.setAttribute('data-table-id', blockId);
    }
    updateColumns(node, this.colgroup, this.table, this.cellMinWidth);
    return true;
  }

  ignoreMutation(record: { type: string; target: Node }) {
    const target = record.target;
    if (
      target === this.dom
      || target === this.scroll
      || target instanceof Element && target.closest('.feishu-table-edge-fades')
      || target === this.chromeMount
      || this.chromeMount.contains(target)
    ) {
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
