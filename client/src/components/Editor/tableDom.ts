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

/** 表格横向滚动容器（与操作层宿主分离，避免 hover 时滚动条撑开布局） */
export function getTableScrollFromHost(host: HTMLElement): HTMLElement {
  return (host.querySelector('.feishu-table-scroll') as HTMLElement | null) ?? host;
}

function getTableEdgeFadesFromHost(host: HTMLElement) {
  const root = host.querySelector('.feishu-table-edge-fades');
  if (!(root instanceof HTMLElement)) return null;
  const left = root.querySelector('.feishu-table-edge-fade--left');
  const right = root.querySelector('.feishu-table-edge-fade--right');
  if (!(left instanceof HTMLElement) || !(right instanceof HTMLElement)) return null;
  return { left, right };
}

/** 旧表格 DOM 无渐隐层时按需补全 */
function ensureTableEdgeFades(host: HTMLElement) {
  const existing = getTableEdgeFadesFromHost(host);
  if (existing) return existing;

  const surface = getTableScrollFromHost(host);
  if (surface === host) return null;

  const edgeFades = document.createElement('div');
  edgeFades.className = 'feishu-table-edge-fades';
  edgeFades.setAttribute('aria-hidden', 'true');

  const edgeFadeLeft = document.createElement('div');
  edgeFadeLeft.className = 'feishu-table-edge-fade feishu-table-edge-fade--left';
  const edgeFadeRight = document.createElement('div');
  edgeFadeRight.className = 'feishu-table-edge-fade feishu-table-edge-fade--right';
  edgeFades.appendChild(edgeFadeLeft);
  edgeFades.appendChild(edgeFadeRight);
  surface.insertAdjacentElement('afterend', edgeFades);

  return { left: edgeFadeLeft, right: edgeFadeRight };
}

/** hover 时同步右侧/左侧内阴影，提示尚有被遮挡的列 */
export function syncTableScrollEdgeFade(host: HTMLElement, show: boolean) {
  const surface = getTableScrollFromHost(host);
  const edgeFades = ensureTableEdgeFades(host);

  const clearFade = () => {
    surface.classList.remove('feishu-table-scroll--fade-right', 'feishu-table-scroll--fade-left');
    edgeFades?.left.classList.remove('is-visible');
    edgeFades?.right.classList.remove('is-visible');
  };

  if (!show) {
    clearFade();
    return;
  }

  const maxScroll = surface.scrollWidth - surface.clientWidth;
  const hasOverflow = maxScroll > 2;
  const atStart = surface.scrollLeft <= 1;
  const atEnd = surface.scrollLeft >= maxScroll - 1;
  const showRight = hasOverflow && !atEnd;
  const showLeft = hasOverflow && !atStart;

  if (edgeFades) {
    edgeFades.right.classList.toggle('is-visible', showRight);
    edgeFades.left.classList.toggle('is-visible', showLeft);
    surface.classList.remove('feishu-table-scroll--fade-right', 'feishu-table-scroll--fade-left');
    return;
  }

  surface.classList.toggle('feishu-table-scroll--fade-right', showRight);
  surface.classList.toggle('feishu-table-scroll--fade-left', showLeft);
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
