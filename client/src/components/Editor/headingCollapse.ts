import type { Editor } from '@tiptap/core';
import { readHeadingId } from './feishuHeading';
import { withPausedDomObserver } from './domObserver';

export function getHeadingIdFromBlockEl(editor: Editor, blockEl: HTMLElement): string | null {
  if (/^h[1-6]$/.test(blockEl.tagName.toLowerCase())) {
    const domId = blockEl.id || blockEl.getAttribute('data-heading-id');
    if (domId) return domId;
  }
  try {
    const pos = editor.view.posAtDOM(blockEl, 0);
    const $pos = editor.state.doc.resolve(pos);
    for (let d = $pos.depth; d > 0; d--) {
      if ($pos.node(d).type.name === 'heading') {
        return readHeadingId($pos.node(d).attrs);
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function headingBlockHasChildren(blockEl: HTMLElement | null): boolean {
  if (!blockEl) return false;
  const m = /^h([1-6])$/.exec(blockEl.tagName.toLowerCase());
  if (!m) return false;
  const level = Number(m[1]);
  const sibling = blockEl.nextElementSibling as HTMLElement | null;
  if (!sibling) return false;
  const sibMatch = /^h([1-6])$/.exec(sibling.tagName.toLowerCase());
  if (sibMatch && Number(sibMatch[1]) <= level) return false;
  return true;
}

function applyHeadingCollapseToDom(headingEl: HTMLElement, level: number, collapsed: boolean): void {
  const wantCollapsedClass = headingEl.classList.contains('heading-collapsed');
  if (wantCollapsedClass !== collapsed) {
    headingEl.classList.toggle('heading-collapsed', collapsed);
  }

  let sib = headingEl.nextElementSibling as HTMLElement | null;
  while (sib) {
    const sibTag = sib.tagName.toLowerCase();
    const sibMatch = /^h([1-6])$/.exec(sibTag);
    if (sibMatch && Number(sibMatch[1]) <= level) break;

    const hasHiddenClass = sib.classList.contains('heading-collapsed-child');
    if (collapsed && !hasHiddenClass) {
      sib.classList.add('heading-collapsed-child');
    } else if (!collapsed && hasHiddenClass) {
      sib.classList.remove('heading-collapsed-child');
    }
    sib = sib.nextElementSibling as HTMLElement | null;
  }
}

export function syncAllHeadingCollapseStates(
  editor: Editor,
  collapsedIds: Set<string> | undefined,
): void {
  if (!collapsedIds?.size) {
    withPausedDomObserver(editor.view, () => {
      editor.view.dom.querySelectorAll('.heading-collapsed-child').forEach(el => {
        el.classList.remove('heading-collapsed-child');
      });
      editor.view.dom.querySelectorAll('.heading-collapsed').forEach(el => {
        el.classList.remove('heading-collapsed');
      });
    });
    return;
  }

  withPausedDomObserver(editor.view, () => {
    editor.view.dom.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(el => {
      const headingEl = el as HTMLElement;
      const m = /^h([1-6])$/.exec(headingEl.tagName.toLowerCase());
      if (!m) return;
      const level = Number(m[1]);
      const id = headingEl.id || headingEl.getAttribute('data-heading-id') || '';
      const isCollapsed = Boolean(id && collapsedIds.has(id));
      applyHeadingCollapseToDom(headingEl, level, isCollapsed);
    });
  });
}
