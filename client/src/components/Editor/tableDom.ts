import type { Editor } from '@tiptap/react';

const HOST_SELECTOR = '.feishu-table-host, .tableWrapper';

/** 表格宿主：NodeView 外层 div（含 tableWrapper + feishu-table-host） */
export function resolveTableHostFromElement(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const host = target.closest(HOST_SELECTOR) as HTMLElement | null;
  if (host) return host;
  const table = target.closest('table.feishu-table') as HTMLTableElement | null;
  if (!table) return null;
  const parent = table.parentElement;
  if (parent?.matches(HOST_SELECTOR)) return parent as HTMLElement;
  return table;
}

export function getTableElementFromHost(host: HTMLElement): HTMLTableElement | null {
  if (host.tagName === 'TABLE') return host as HTMLTableElement;
  return host.querySelector('table.feishu-table, table');
}

/** NodeView 内预留的操作层挂载点（避免 Portal 挂在 host 根上被 ProseMirror 清掉） */
export function getTableChromeMountFromHost(host: HTMLElement): HTMLElement {
  return (
    (host.querySelector('.feishu-table-chrome-mount') as HTMLElement | null)
    ?? host
  );
}

export function resolveTableHostFromEditor(editor: Editor): HTMLElement | null {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name !== 'table') continue;
    const pos = $from.before(d);
    const dom = editor.view.nodeDOM(pos);
    if (dom instanceof HTMLElement) {
      if (dom.matches(HOST_SELECTOR)) return dom;
      if (dom.tagName === 'TABLE') {
        const parent = dom.parentElement;
        if (parent?.matches(HOST_SELECTOR)) return parent;
        return dom;
      }
      const nested = dom.querySelector(HOST_SELECTOR) ?? dom.querySelector('table.feishu-table');
      if (nested instanceof HTMLElement) {
        return nested.matches(HOST_SELECTOR) ? nested : (nested.parentElement as HTMLElement) ?? nested;
      }
    }
  }
  return null;
}
