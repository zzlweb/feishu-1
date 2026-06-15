import type { Editor } from '@tiptap/react';
import type { Comment } from '../../../types';
import { resolveBlockElement } from './blockDom';

export function getCommentThreadKey(comment: Pick<Comment, 'thread_id' | 'block_id' | 'id'>): string {
  return comment.thread_id || comment.block_id || comment.id;
}

/** 判断评论锚点是否仍存在于文档 HTML 中 */
export function isCommentAnchorPresentInHtml(html: string, comment: Comment): boolean {
  const key = getCommentThreadKey(comment);
  if (!key) return false;
  if (!html.trim()) return false;

  const doc = new DOMParser().parseFromString(html, 'text/html');
  return Boolean(resolveBlockElement(doc, key));
}

export function findOrphanedComments(html: string, comments: Comment[]): Comment[] {
  return comments.filter(comment => !isCommentAnchorPresentInHtml(html, comment));
}

/** 从编辑器正文中移除指定 thread 的评论高亮 mark */
export function removeCommentHighlightsFromEditor(editor: Editor, threadIds: Iterable<string>): boolean {
  const markType = editor.state.schema.marks.commentHighlight;
  if (!markType) return false;

  const idSet = new Set(threadIds);
  if (idSet.size === 0) return false;

  let tr = editor.state.tr;
  let changed = false;

  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    node.marks.forEach(mark => {
      if (mark.type !== markType) return;
      const threadId = mark.attrs.threadId as string | null;
      if (!threadId || !idSet.has(threadId)) return;
      tr = tr.removeMark(pos, pos + node.nodeSize, markType);
      changed = true;
    });
  });

  if (!changed) return false;

  tr.setMeta('addToHistory', true);
  editor.view.dispatch(tr);
  return true;
}

export function dispatchRemoveCommentHighlights(threadIds: string[]) {
  if (threadIds.length === 0) return;
  window.dispatchEvent(
    new CustomEvent('feishu-remove-comment-highlights', { detail: { threadIds } }),
  );
}

/** 侧栏是否还应展示：有待发布线程，或存在未解决且有内容的评论 */
export function hasOpenCommentSidebarContent(
  comments: Comment[],
  pendingThread: { threadId: string } | null | undefined,
): boolean {
  if (pendingThread) return true;
  return comments.some(
    comment => !Number(comment.resolved)
      && comment.status !== 'deleted'
      && comment.content.trim().length > 0,
  );
}
