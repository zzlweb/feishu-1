import type { Editor } from '@tiptap/react';

export interface TableMenuFlags {
  hasHeaderRow: boolean;
  hasHeaderCol: boolean;
}

export function getActiveTableFlags(editor: Editor): TableMenuFlags {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name !== 'table') continue;
    const firstRow = node.firstChild;
    let hasHeaderRow = false;
    if (firstRow) {
      hasHeaderRow = true;
      firstRow.forEach(cell => {
        if (cell.type.name !== 'tableHeader') hasHeaderRow = false;
      });
    }
    let hasHeaderCol = node.childCount > 0;
    for (let i = 0; i < node.childCount; i++) {
      if (node.child(i).firstChild?.type.name !== 'tableHeader') {
        hasHeaderCol = false;
        break;
      }
    }
    return { hasHeaderRow, hasHeaderCol };
  }
  return { hasHeaderRow: false, hasHeaderCol: false };
}

/** 表格块菜单：锚点在块柄下方展开 */
export function computeTableBlockMenuPosition(anchor: DOMRect, menuW = 220, pad = 8, gap = 6) {
  const vw = window.innerWidth;
  let x = anchor.left;
  if (x + menuW > vw - pad) x = vw - menuW - pad;
  if (x < pad) x = pad;
  return { x, y: anchor.bottom + gap };
}
