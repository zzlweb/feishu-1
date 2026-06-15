import type { Editor } from '@tiptap/react';
import { computeBlockPanelPosition } from '../shared/floatingPanel';

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

/** 表格块菜单：与段落块柄一致，优先在块柄左侧展开，避免盖住绿色表格按钮 */
export function computeTableBlockMenuPosition(anchor: DOMRect, menuW = 236, menuH = 480, pad = 8, gap = 4) {
  return computeBlockPanelPosition(anchor, menuW, menuH, pad, gap);
}
