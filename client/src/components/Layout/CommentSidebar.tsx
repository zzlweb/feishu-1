import { useCallback, useEffect, useRef, useState } from 'react';
import { Dropdown, DialogPlugin, MessagePlugin } from 'tdesign-react';
import type { DropdownOption } from 'tdesign-react';
import type { RefObject } from 'react';
import type { Comment } from '../../types';

interface CommentSidebarProps {
  comments: Comment[];
  activeBlockId: string;
  pendingThread?: {
    blockId: string;
    threadId: string;
    quote: string;
    anchorType?: Comment['anchor_type'];
  } | null;
  inputValue: string;
  onInputChange: (value: string) => void;
  onSubmit: (threadKey?: string) => boolean | Promise<boolean>;
  onResolve: (comment: Comment) => void;
  onUpdateComment: (comment: Comment, content: string) => boolean | Promise<boolean>;
  onDeleteComment: (comment: Comment) => boolean | Promise<boolean>;
  currentUserName: string;
  onClose: () => void;
  onJumpToBlock: (blockId: string) => void;
  mainScrollRef: RefObject<HTMLElement>;
}

function formatCommentTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '刚刚';
  const now = Date.now();
  const diff = Math.max(0, now - date.getTime());
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return '刚刚';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} 天前`;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function groupByBlock(comments: Comment[]): Map<string, Comment[]> {
  const map = new Map<string, Comment[]>();
  for (const c of comments) {
    const key = c.thread_id || c.block_id || c.id || '__doc__';
    const arr = map.get(key);
    if (arr) arr.push(c);
    else map.set(key, [c]);
  }
  return map;
}

function getBlockQuotePreview(blockId: string, scrollRoot: HTMLElement | null): string {
  if (!blockId || blockId === '__doc__') return '';
  if (!scrollRoot) return '';
  try {
    const el = scrollRoot.querySelector(`#${CSS.escape(blockId)}`);
    if (!(el instanceof HTMLElement)) return '';
    const raw = (el.innerText || '').replace(/\s+/g, ' ').trim();
    if (!raw) return '';
    return raw.length > 56 ? `${raw.slice(0, 56)}…` : raw;
  } catch {
    return '';
  }
}

function copyCommentAnchor(blockId: string) {
  const url = `${window.location.origin}${window.location.pathname}#${encodeURIComponent(blockId)}`;
  void navigator.clipboard.writeText(url).then(
    () => MessagePlugin.success('链接已复制'),
    () => MessagePlugin.error('复制失败'),
  );
}

function getBlockTop(blockId: string, searchRoot: HTMLElement, referenceEl: HTMLElement): number | null {
  const el = searchRoot.querySelector(`#${CSS.escape(blockId)}`);
  if (!el) return null;
  const refRect = referenceEl.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  return elRect.top - refRect.top;
}

function buildCommentMoreOptions(isOwn: boolean): DropdownOption[] {
  const items: DropdownOption[] = [];
  if (isOwn) items.push({ content: '编辑', value: 'edit' });
  items.push({ content: '翻译为简体中文 ›', value: 'translate' });
  if (isOwn) items.push({ content: '删除', value: 'delete', theme: 'error' });
  items.push({ content: '举报', value: 'report' });
  return items;
}

export default function CommentSidebar({
  comments,
  activeBlockId,
  pendingThread,
  inputValue,
  onInputChange,
  onSubmit,
  onResolve,
  onUpdateComment,
  onDeleteComment,
  currentUserName,
  onClose,
  onJumpToBlock,
  mainScrollRef,
}: CommentSidebarProps) {
  const panelsContainerRef = useRef<HTMLDivElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const [positions, setPositions] = useState<Map<string, number>>(new Map());
  const [replyingBlockId, setReplyingBlockId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [likedCommentIds, setLikedCommentIds] = useState<Record<string, true>>({});
  const [showHistory, setShowHistory] = useState(false);

  const unresolvedCount = comments.filter(c => !Number(c.resolved)).length;
  const visibleComments = comments.filter(c => showHistory ? Number(c.resolved) || c.status === 'deleted' || c.status === 'anchor_lost' : !Number(c.resolved) && c.status !== 'deleted');
  const displayComments = pendingThread && !visibleComments.some(c => (c.thread_id || c.block_id || c.id) === pendingThread.threadId)
    ? [
      ...visibleComments,
      {
        id: pendingThread.threadId,
        document_id: '',
        block_id: pendingThread.blockId,
        thread_id: pendingThread.threadId,
        content: '',
        author: currentUserName,
        position_from: 0,
        position_to: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        resolved: 0,
        quote: pendingThread.quote,
        anchor_type: pendingThread.anchorType || 'text-range',
      } as Comment,
    ]
    : visibleComments;

  useEffect(() => {
    if (pendingThread) {
      setReplyingBlockId(pendingThread.threadId);
    }
  }, [pendingThread?.threadId]);

  const submitReply = useCallback(async (threadKey?: string) => {
    const ok = await Promise.resolve(onSubmit(threadKey || replyingBlockId || activeBlockId));
    if (ok !== false) setReplyingBlockId(null);
  }, [activeBlockId, onSubmit, replyingBlockId]);

  const toggleLike = useCallback((commentId: string) => {
    setLikedCommentIds(prev => {
      const next = { ...prev };
      if (next[commentId]) delete next[commentId];
      else next[commentId] = true;
      return next;
    });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingCommentId(null);
    setEditDraft('');
  }, []);

  const saveEdit = useCallback(
    async (comment: Comment) => {
      const ok = await Promise.resolve(onUpdateComment(comment, editDraft));
      if (ok) cancelEdit();
    },
    [editDraft, onUpdateComment, cancelEdit],
  );

  const grouped = groupByBlock(displayComments);
  const blockIds = Array.from(grouped.keys());

  const updatePositions = useCallback(() => {
    const container = mainScrollRef.current;
    const panelsEl = panelsContainerRef.current;
    if (!container || !panelsEl) return;
    const newPos = new Map<string, number>();
    for (const bid of blockIds) {
      if (bid === '__doc__') continue;
      const anchorId = grouped.get(bid)?.[0]?.block_id || bid;
      const top = getBlockTop(anchorId, container, panelsEl);
      if (top !== null) newPos.set(bid, top);
      if (top !== null && anchorId !== bid) newPos.set(anchorId, top);
    }
    setPositions(newPos);
  }, [blockIds.join(','), mainScrollRef]);

  useEffect(() => {
    updatePositions();
    const container = mainScrollRef.current;
    if (!container) return;
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updatePositions) : null;
    ro?.observe(container);
    const mo = new MutationObserver(updatePositions);
    mo.observe(container, { childList: true, subtree: true });
    return () => {
      ro?.disconnect();
      mo.disconnect();
    };
  }, [updatePositions, mainScrollRef]);

  const sortedBlocks = blockIds
    .filter(id => id !== '__doc__')
    .map(threadKey => {
      const blockComments = grouped.get(threadKey)!;
      const anchorBlockId = blockComments[0]?.block_id || threadKey;
      return {
      blockId: threadKey,
      anchorBlockId,
      comments: blockComments,
      top: positions.get(anchorBlockId) ?? positions.get(threadKey) ?? 0,
      };
    })
    .sort((a, b) => a.top - b.top);

  const MIN_GAP = 8;
  const PANEL_HEADER_EST = 44;
  const PANEL_REPLY_EST = 112;
  const PANEL_FOOTER_EST = 56;

  const resolvedPanels: typeof sortedBlocks = [];
  for (const entry of sortedBlocks) {
    let { top } = entry;
    if (resolvedPanels.length > 0) {
      const prev = resolvedPanels[resolvedPanels.length - 1];
      const prevH = PANEL_HEADER_EST + prev.comments.length * PANEL_REPLY_EST + PANEL_FOOTER_EST;
      const minTop = prev.top + prevH + MIN_GAP;
      if (top < minTop) top = minTop;
    }
    resolvedPanels.push({ ...entry, top });
  }

  const TRACK_TAIL_PAD = 24;
  const panelsScrollExtent = resolvedPanels.reduce((maxBottom, { comments: blockComments, top }) => {
    const panelH = PANEL_HEADER_EST + blockComments.length * PANEL_REPLY_EST + PANEL_FOOTER_EST;
    return Math.max(maxBottom, top + panelH + TRACK_TAIL_PAD);
  }, 0);

  return (
    <div className="comment-sidebar-positioned" aria-label="评论">
      <div className="comment-sidebar-pos__header">
        <span className="comment-sidebar-pos__header-left">
          <span className="comment-sidebar-pos__title">评论（{unresolvedCount}）</span>
        </span>
        <button type="button" className="comment-sidebar-pos__close" onClick={onClose} title="关闭">
          <svg className="comment-sidebar-pos__close-icon" width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path d="m13.058 6.472 5.637 5.636-5.944 5.943-.835.84a1 1 0 1 0 1.419 1.409l.663-.667 6.818-6.818a1 1 0 0 0 0-1.414l-6.472-6.473-1.012-1.013a1 1 0 0 0-1.416 1.41l1.142 1.147Z" fill="currentColor" />
            <path d="m4.15 6.472 5.637 5.636-5.943 5.943-.836.84A1 1 0 1 0 4.427 20.3l.663-.667 6.818-6.818a1 1 0 0 0 0-1.414L5.436 4.928 4.424 3.915a1 1 0 0 0-1.415 1.41L4.15 6.472Z" fill="currentColor" />
          </svg>
        </button>
      </div>

      <div className="comment-sidebar-pos__panels" ref={panelsContainerRef}>
        {displayComments.length === 0 ? (
          <div className="comment-sidebar-pos__empty">
            <div className="comment-sidebar-pos__empty-icon">💬</div>
            <div>暂无评论</div>
          </div>
        ) : (
          <div className="comment-sidebar-pos__track" style={{ minHeight: `max(100%, ${Math.max(panelsScrollExtent, 1)}px)` }}>
            <input ref={attachInputRef} type="file" multiple accept="image/gif,image/jpg,image/jpeg,image/bmp,image/png" className="comment-panel__file-input" tabIndex={-1} aria-hidden />
            {resolvedPanels.map(({ blockId, anchorBlockId, comments: blockComments, top }, panelIdx) => {
              const isActive = blockId === activeBlockId;
              const firstUnresolved = blockComments.find(c => !Number(c.resolved));
              const prevPanelBlockId = panelIdx > 0 ? resolvedPanels[panelIdx - 1]!.blockId : null;
              const nextPanelBlockId = panelIdx >= 0 && panelIdx < resolvedPanels.length - 1 ? resolvedPanels[panelIdx + 1]!.blockId : null;

              const openComposer = () => {
                onJumpToBlock(anchorBlockId || blockId);
                setReplyingBlockId(blockId);
                onInputChange('');
              };

              const quotePreview = blockComments[0]?.quote || getBlockQuotePreview(blockComments[0]?.block_id || blockId, mainScrollRef.current);
              const quoteLabel = quotePreview || '高亮块';

              return (
                <div key={blockId} className={`comment-panel-wrapper${isActive ? ' comment-panel-wrapper--active' : ''}`} style={{ transform: `translate3d(0px, ${top}px, 0px)` }}>
                  <div className={`comment-panel js-panel-card${isActive ? ' comment-panel--active' : ''}`} data-id={blockId} data-comment-type="0">
                    <div className="comment-panel__header comment-panel__header-v2">
                      <div className="comment-panel__header-quote">
                        <span
                          className="comment-panel__quote-text"
                          title={quoteLabel}
                          onClick={() => onJumpToBlock(anchorBlockId || blockId)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onJumpToBlock(anchorBlockId || blockId);
                            }
                          }}
                          role="link"
                          tabIndex={0}
                        >
                          {quoteLabel}
                        </span>
                      </div>
                      <div className="comment-panel-controls">
                        <div className="comment-panel-controls__pill">
                          <button type="button" disabled={!nextPanelBlockId} className="comment-panel-controls__btn comment-panel-controls__go-next-btn" title="下一条" aria-label="下一条" onClick={() => nextPanelBlockId && onJumpToBlock(nextPanelBlockId)}>
                            <span className="universe-icon" style={{ fontSize: 12 }}>
                              <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                <path d="M2.293 7.707a1 1 0 0 1 1.414 0L12 16l8.293-8.293a1 1 0 1 1 1.414 1.414l-8.293 8.293a2 2 0 0 1-2.828 0L2.293 9.121a1 1 0 0 1 0-1.414Z" fill="currentColor" />
                              </svg>
                            </span>
                          </button>
                          <button type="button" disabled={!prevPanelBlockId} className="comment-panel-controls__btn comment-panel-controls__go-previous-btn" title="上一条" aria-label="上一条" onClick={() => prevPanelBlockId && onJumpToBlock(prevPanelBlockId)}>
                            <span className="universe-icon" style={{ fontSize: 12 }}>
                              <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                <path d="M21.707 16.293a1 1 0 0 1-1.414 0L12 8l-8.293 8.293a1 1 0 0 1-1.414-1.414l8.293-8.293a2 2 0 0 1 2.828 0l8.293 8.293a1 1 0 0 1 0 1.414Z" fill="currentColor" />
                              </svg>
                            </span>
                          </button>
                        </div>
                        <div className="comment-panel-controls__split comment-panel-controls__split-v2" aria-hidden />
                        <button type="button" className="comment-panel-controls__btn comment-panel-controls__copy-anchor-btn" title="复制链接" aria-label="复制链接" onClick={() => copyCommentAnchor(blockId)}>
                          <span className="universe-icon" style={{ fontSize: 14 }}>
                            <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                              <path d="M18.849 2.699a5.037 5.037 0 0 0-7.1.97L8.97 7.372a4.784 4.784 0 0 0 .957 6.699l.972.729a1 1 0 0 0 1.2-1.6l-.972-.73a2.784 2.784 0 0 1-.557-3.898l2.777-3.703a3.037 3.037 0 1 1 4.8 3.72l-1.429 1.786a1 1 0 1 0 1.562 1.25l1.43-1.788a5.037 5.037 0 0 0-.862-7.138Z" fill="currentColor" />
                              <path d="M5.152 21.301a5.037 5.037 0 0 0 7.1-.97l2.777-3.703a4.784 4.784 0 0 0-.957-6.699L13.1 9.2a1 1 0 0 0-1.2 1.6l.973.73a2.784 2.784 0 0 1 .556 3.898l-2.777 3.703a3.037 3.037 0 1 1-4.8-3.72l1.429-1.786a1 1 0 0 0-1.562-1.25l-1.43 1.787a5.037 5.037 0 0 0 .863 7.14Z" fill="currentColor" />
                            </svg>
                          </span>
                        </button>
                        <div>
                          <button type="button" disabled={!firstUnresolved} className="comment-panel-controls__btn comment-panel-controls__resolve-btn" title="标记已解决" aria-label="标记已解决" onClick={() => firstUnresolved && onResolve(firstUnresolved)}>
                            <span className="universe-icon" style={{ fontSize: 14 }}>
                              <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 2C5.925 23 1 18.075 1 12S5.925 1 12 1s11 4.925 11 11-4.925 11-11 11Zm-1.16-8.72 4.952-4.952a.996.996 0 0 1 1.409.005 1 1 0 0 1 .007 1.41c-1.888 1.905-3.752 3.842-5.685 5.7a.98.98 0 0 1-1.364-.001c-1.01-.98-1.993-1.992-2.983-2.993a1.003 1.003 0 0 1 .005-1.414.998.998 0 0 1 1.412-.002l2.247 2.247Z" fill="currentColor" />
                              </svg>
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="comment-panel__reply-list">
                      {blockComments.filter(comment => comment.content.trim().length > 0).map(comment => {
                        const isOwn = comment.author.trim() === currentUserName.trim();
                        const isEditing = editingCommentId === comment.id;
                        const isLiked = Boolean(likedCommentIds[comment.id]);
                        const moreOptions = buildCommentMoreOptions(isOwn);

                        const handleMoreMenuClick = (item: DropdownOption) => {
                          const key = item.value as string | undefined;
                          if (key === 'edit') {
                            setEditingCommentId(comment.id);
                            setEditDraft(comment.content);
                          }
                          if (key === 'delete') {
                            DialogPlugin.confirm({
                              header: '删除评论',
                              body: '确定删除这条评论吗？删除后无法恢复。',
                              theme: 'danger',
                              confirmBtn: '删除',
                              cancelBtn: '取消',
                              onConfirm: () => void onDeleteComment(comment),
                            });
                          }
                          if (key === 'translate') {
                            MessagePlugin.info('翻译功能敬请期待');
                          }
                          if (key === 'report') {
                            MessagePlugin.info('感谢您的反馈，我们将尽快核实');
                          }
                        };

                        return (
                          <div className={`comment-panel__reply${comment.resolved ? ' comment-panel__reply--resolved' : ''}`} key={comment.id}>
                            <div className="comment-panel__reply-main">
                              <div className="comment-panel__avatar" aria-hidden>{comment.author.charAt(0)}</div>
                              <div className="comment-panel__reply-main-right">
                                <div className="comment-panel__reply-info-row">
                                  <div className="comment-panel__reply-info-text">
                                    <span className="comment-panel__reply-info-name">{comment.author}</span>
                                    <span className="comment-panel__reply-info-time">{formatCommentTime(comment.updated_at || comment.created_at)}</span>
                                  </div>
                                  <div className="comment-panel__reply-actions">
                                    <button
                                      type="button"
                                      className={`comment-panel__icon-btn${isLiked ? ' comment-panel__icon-btn--active' : ''}`}
                                      title="赞"
                                      aria-label="赞"
                                      aria-pressed={isLiked}
                                      onClick={() => toggleLike(comment.id)}
                                    >
                                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                        <path d="M1.75 12.833h-.583a.29.29 0 01-.292-.291V4.958a.292.292 0 01.292-.291h.583a.292.292 0 01.292.291v7.584a.292.292 0 01-.292.291zm7-8.167h2.501c1.74 0 2.14 1.536 1.74 2.688l-1.74 4.582a1.237 1.237 0 01-1.196.902H3.204a.293.293 0 01-.292-.291v-7.59a.292.292 0 01.292-.291h.6a.583.583 0 00.477-.248L6.702.973c.164-.26.607-.46 1.078-.246.708.322 1.554 1.025 1.554 2.19 0 .44-.195 1.023-.585 1.749z" fill="currentColor" />
                                      </svg>
                                    </button>
                                    <button type="button" className="comment-panel__icon-btn" title="回复" aria-label="回复" onClick={openComposer}>
                                      <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                        <path d="M16.25 19.511 13.5 22.5c-.401.438-.957.68-1.5.68s-.967-.137-1.523-.68L7.75 19.511 3 19.5c-1.1-.011-2-.9-2-2v-13c0-1.1.9-2 2-2h18c1.1 0 2 .9 2 2v13c0 1.1-.9 1.989-2 2l-4.75.011ZM5.5 10.5v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1a1 1 0 0 0-1-1h-1a1 1 0 0 0-1 1Zm6-1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1a1 1 0 0 0-1-1h-1Zm5 0a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1a1 1 0 0 0-1-1h-1Z" fill="currentColor" />
                                      </svg>
                                    </button>
                                    <Dropdown
                                      trigger="click"
                                      placement="bottom-right"
                                      minColumnWidth={168}
                                      maxColumnWidth={240}
                                      hideAfterItemClick
                                      popupProps={{
                                        overlayClassName: 'comment-panel-more-dropdown',
                                      }}
                                      options={moreOptions}
                                      onClick={handleMoreMenuClick}
                                    >
                                      <button type="button" className="comment-panel__icon-btn" title="更多" aria-label="更多">
                                        <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                          <path d="M5.5 11.75a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 0 1 3.5 0Zm8.225 0a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 0 1 3.5 0Zm8.275 0a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 0 1 3.5 0Z" fill="currentColor" />
                                        </svg>
                                      </button>
                                    </Dropdown>
                                  </div>
                                </div>
                                {isEditing ? (
                                  <div className="comment-panel__reply-edit">
                                    <textarea
                                      className="comment-panel__reply-edit-input"
                                      value={editDraft}
                                      rows={3}
                                      autoFocus
                                      onChange={e => setEditDraft(e.target.value)}
                                      onKeyDown={e => {
                                        if (e.key === 'Escape') {
                                          e.preventDefault();
                                          cancelEdit();
                                        }
                                      }}
                                    />
                                    <div className="comment-panel__reply-edit-actions">
                                      <button type="button" className="comment-panel__reply-edit-btn-cancel" onClick={cancelEdit}>
                                        取消
                                      </button>
                                      <button type="button" className="comment-panel__reply-edit-btn-send" disabled={!editDraft.trim()} onClick={() => void saveEdit(comment)}>
                                        保存
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="comment-panel__reply-content">{comment.content}</div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="comment-panel__textarea card-panel-textarea">
                      {replyingBlockId === blockId ? (
                        <div className="comment-panel__textarea-inner">
                          <div className="comment-panel__textarea-main-wrapper">
                            <div className="comment-panel__textarea-main">
                              <textarea
                                className="comment-panel__textarea-editor"
                                value={inputValue}
                                placeholder="回复"
                                rows={1}
                                autoFocus
                                onChange={e => onInputChange(e.target.value)}
                                onInput={e => {
                                  const ta = e.currentTarget;
                                  ta.style.height = 'auto';
                                  ta.style.height = `${Math.min(Math.max(ta.scrollHeight, 32), 120)}px`;
                                }}
                                onKeyDown={e => {
                                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                    e.preventDefault();
                                    void submitReply(blockId);
                                  }
                                  if (e.key === 'Escape') setReplyingBlockId(null);
                                }}
                              />
                              <div className="comment-panel__textarea-operation">
                                <div className="comment-panel__textarea-operation-inner">
                                  <div className="comment-panel__textarea-image-select">
                                    <span className="comment-panel__textarea-image-icon" aria-hidden>
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="m10.141 17.988-4.275-.01a.3.3 0 0 1-.212-.512l4.133-4.133a.4.4 0 0 1 .566 0l1.907 1.907 5.057-5.057a.4.4 0 0 1 .683.283V17.7a.3.3 0 0 1-.3.3h-7.476a.301.301 0 0 1-.083-.012ZM4 22c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h16c1.1 0 2 .9 2 2v16c0 1.1-.9 2-2 2H4Zm0-2h16V4H4v16ZM6 6h3v3H6V6Z" fill="currentColor" />
                                      </svg>
                                    </span>
                                    <button type="button" tabIndex={-1} className="comment-panel__textarea-file-hitbox" aria-label="插入图片" onClick={() => attachInputRef.current?.click()} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          {inputValue.trim().length > 0 && (
                            <div className="comment-panel__textarea-actions">
                              <button type="button" className="comment-panel__textarea-btn-cancel" onClick={() => setReplyingBlockId(null)}>取消</button>
                              <button type="button" className="comment-panel__textarea-btn-submit" onClick={() => void submitReply(blockId)}>回复</button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="comment-panel__textarea-inner comment-panel__textarea-inner--idle" onClick={openComposer} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openComposer(); } }} tabIndex={0} aria-label="回复">
                          <div className="comment-panel__textarea-main-wrapper">
                            <div className="comment-panel__textarea-main comment-panel__textarea-main--idle">
                              <span className="comment-panel__textarea-placeholder">回复</span>
                              <div className="comment-panel__textarea-operation">
                                <div className="comment-panel__textarea-operation-inner">
                                  <div className="comment-panel__textarea-image-select">
                                    <span className="comment-panel__textarea-image-icon" aria-hidden>
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="m10.141 17.988-4.275-.01a.3.3 0 0 1-.212-.512l4.133-4.133a.4.4 0 0 1 .566 0l1.907 1.907 5.057-5.057a.4.4 0 0 1 .683.283V17.7a.3.3 0 0 1-.3.3h-7.476a.301.301 0 0 1-.083-.012ZM4 22c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h16c1.1 0 2 .9 2 2v16c0 1.1-.9 2-2 2H4Zm0-2h16V4H4v16ZM6 6h3v3H6V6Z" fill="currentColor" />
                                      </svg>
                                    </span>
                                    <button type="button" tabIndex={-1} className="comment-panel__textarea-file-hitbox" aria-label="插入图片" onClick={e => { e.stopPropagation(); openComposer(); }} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
