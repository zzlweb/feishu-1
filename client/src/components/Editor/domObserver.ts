import type { EditorView } from '@tiptap/pm/view';

/** 暂停 DOMObserver，避免 ProseMirror 因外部 DOM 改动陷入 update 死循环 */
export function withPausedDomObserver(view: EditorView, fn: () => void): void {
  const observer = (view as EditorView & { domObserver?: { stop: () => void; start: () => void } }).domObserver;
  observer?.stop();
  try {
    fn();
  } finally {
    observer?.start();
  }
}
