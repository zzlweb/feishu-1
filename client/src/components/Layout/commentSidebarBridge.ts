/** 多维表格评论侧栏与文档评论侧栏的协调事件 */

export const BITABLE_COMMENT_OPEN = 'feishu-bitable-comment-open';
export const BITABLE_COMMENT_CLOSE = 'feishu-bitable-comment-close';
export const BITABLE_COMMENT_META = 'feishu-bitable-comment-meta';
export const BITABLE_COMMENT_TOGGLE_SIDEBAR = 'feishu-bitable-comment-toggle-sidebar';
export const CLOSE_BITABLE_COMMENT_SIDEBAR = 'feishu-close-bitable-comment-sidebar';

export interface BitableCommentOpenDetail {
  blockId: string;
  recordId: string;
}

export interface BitableCommentMetaDetail {
  blockId: string;
  recordId: string;
  unresolvedCount: number;
}

export function dispatchBitableCommentOpen(detail: BitableCommentOpenDetail) {
  window.dispatchEvent(new CustomEvent(BITABLE_COMMENT_OPEN, { detail }));
}

export function dispatchBitableCommentClose(blockId: string) {
  window.dispatchEvent(new CustomEvent(BITABLE_COMMENT_CLOSE, { detail: { blockId } }));
}

export function dispatchBitableCommentMeta(detail: BitableCommentMetaDetail) {
  window.dispatchEvent(new CustomEvent(BITABLE_COMMENT_META, { detail }));
}

export function dispatchBitableCommentToggleSidebar(blockId: string) {
  window.dispatchEvent(new CustomEvent(BITABLE_COMMENT_TOGGLE_SIDEBAR, { detail: { blockId } }));
}

export function dispatchCloseBitableCommentSidebar() {
  window.dispatchEvent(new CustomEvent(CLOSE_BITABLE_COMMENT_SIDEBAR));
}
