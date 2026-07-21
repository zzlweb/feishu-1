import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loading } from 'tdesign-react';
import { addComment, deleteComment, getComments, getDocument, updateComment } from '../../api/documents';
import type { Comment, Document, HeadingItem } from '../../types';
import { DOC_TITLE_CATALOGUE_ID } from '../../types';
import Editor from '../Editor/Editor';
import { FEISHU_LAYOUT_SCROLL_EVENT } from '../Editor/shared/floatingPanel';
import Sidebar from './Sidebar';
import DocumentHeader from './DocumentHeader';
import CommentSidebar from './CommentSidebar';
import { CommentSidebarTrackContext } from './CommentSidebarContext';
import {
  BITABLE_COMMENT_CLOSE,
  BITABLE_COMMENT_META,
  BITABLE_COMMENT_OPEN,
  BITABLE_COMMENT_TOGGLE_SIDEBAR,
} from './commentSidebarBridge';
import {
  dispatchRemoveCommentHighlights,
  findOrphanedComments,
  getCommentThreadKey,
  hasOpenCommentSidebarContent,
  isCommentAnchorPresentInHtml,
} from '../Editor/blocks/commentDocumentSync';
import { resolveBlockElement } from '../Editor/blocks/blockDom';
import { useDocumentSaveQueue, type DocumentPatch } from '../../features/documents/session/useDocumentSaveQueue';
import './Layout.less';

const EDITOR_PAGE_MIN_WIDTH = 860;
const CATALOGUE_RAIL_WIDTH = 232;
const DOC_MAIN_MIN_GUTTER = 24;
const COMMENT_SIDEBAR_WIDTH = 280;

/** 侧栏展开会触发布局重排；在若干帧后把滚动位置拉回，避免误跳到顶部 */
function preserveWorkspaceScroll(scrollRoot: HTMLElement | null, savedScrollTop: number) {
  if (!scrollRoot) return;
  const restore = () => {
    if (Math.abs(scrollRoot.scrollTop - savedScrollTop) > 1) {
      scrollRoot.scrollTop = savedScrollTop;
    }
  };
  restore();
  requestAnimationFrame(() => {
    restore();
    requestAnimationFrame(restore);
  });
  window.setTimeout(restore, 50);
}

function isCatalogueAreaSqueezed(pageMain: HTMLElement, commentSidebarOpen: boolean): boolean {
  const bitableBlocks = pageMain.querySelectorAll<HTMLElement>('.feishu-bitable-block');
  for (const block of bitableBlocks) {
    const shift = Number.parseFloat(
      getComputedStyle(block).getPropertyValue('--bitable-block-shift'),
    ) || 0;
    if (shift > 1) return true;
  }

  const squeezeMinWidth = CATALOGUE_RAIL_WIDTH
    + EDITOR_PAGE_MIN_WIDTH
    + DOC_MAIN_MIN_GUTTER * 2
    + (commentSidebarOpen ? COMMENT_SIDEBAR_WIDTH : 0);
  return pageMain.clientWidth < squeezeMinWidth;
}

export default function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [headings, setHeadings] = useState<HeadingItem[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [readOnly, setReadOnly] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentSidebarVisible, setCommentSidebarVisible] = useState(false);
  const [bitableCommentActive, setBitableCommentActive] = useState(false);
  const [bitableUnresolvedCount, setBitableUnresolvedCount] = useState(0);
  const [commentTrackHost, setCommentTrackHost] = useState<HTMLElement | null>(null);
  const [activeCommentBlockId, setActiveCommentBlockId] = useState('');
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [pendingCommentAnchor, setPendingCommentAnchor] = useState<{
    blockId: string;
    threadId: string;
    anchorType: Comment['anchor_type'];
    positionFrom: number;
    positionTo: number;
    quote: string;
    anchorJson: string;
  } | null>(null);
  const outlineWasVisibleRef = useRef(false);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const pageMainRef = useRef<HTMLElement>(null);
  const sidebarCollapsedRef = useRef(sidebarCollapsed);
  const sidebarAutoCollapsedRef = useRef(false);
  const sidebarUserCollapsedRef = useRef(false);
  sidebarCollapsedRef.current = sidebarCollapsed;
  const collapsedPersistReadyRef = useRef(false);
  const collapsedPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadRequestSequenceRef = useRef(0);
  const [titleInputSnapshot, setTitleInputSnapshot] = useState('');
  const [catalogueActiveId, setCatalogueActiveId] = useState<string | null>(null);
  const [collapsedHeadingIds, setCollapsedHeadingIds] = useState<Set<string>>(() => new Set());
  const collapsedHeadingIdList = useMemo(
    () => Array.from(collapsedHeadingIds).sort(),
    [collapsedHeadingIds],
  );

  const catalogueTitleDisplay = titleInputSnapshot.trim();
  const showOutlineSidebar = headings.length > 0 || catalogueTitleDisplay.length > 0;
  const commentInput = activeCommentBlockId ? (commentDrafts[activeCommentBlockId] || '') : '';

  const handleCommentInputChange = useCallback((value: string) => {
    if (!activeCommentBlockId) return;
    setCommentDrafts(current => ({ ...current, [activeCommentBlockId]: value }));
  }, [activeCommentBlockId]);

  const handleTitleInputChange = useCallback((t: string) => {
    setTitleInputSnapshot(t);
  }, []);

  useEffect(() => {
    if (!doc) return;
    setTitleInputSnapshot(doc.title === '未命名文档' ? '' : doc.title);
  }, [doc?.id, doc?.title]);

  useEffect(() => {
    outlineWasVisibleRef.current = false;
    setCatalogueActiveId(null);
    collapsedPersistReadyRef.current = false;
    setCollapsedHeadingIds(new Set(doc?.collapsed_heading_ids ?? []));
  }, [doc?.id, doc?.collapsed_heading_ids]);

  const handleToggleHeadingCollapse = useCallback((headingId: string) => {
    setCollapsedHeadingIds(prev => {
      const next = new Set(prev);
      if (next.has(headingId)) next.delete(headingId);
      else next.add(headingId);
      return next;
    });
  }, []);

  useEffect(() => {
    if (catalogueActiveId === null) return;
    if (catalogueActiveId === DOC_TITLE_CATALOGUE_ID) {
      if (catalogueTitleDisplay.length === 0) setCatalogueActiveId(null);
      return;
    }
    if (!headings.some(h => h.id === catalogueActiveId)) {
      setCatalogueActiveId(null);
    }
  }, [headings, catalogueTitleDisplay, catalogueActiveId]);

  useEffect(() => {
    if (showOutlineSidebar && !outlineWasVisibleRef.current) {
      setSidebarCollapsed(false);
      sidebarAutoCollapsedRef.current = false;
      sidebarUserCollapsedRef.current = false;
    }
    outlineWasVisibleRef.current = showOutlineSidebar;
  }, [showOutlineSidebar]);

  const loadDocument = useCallback(async () => {
    if (!id) return;
    const requestId = ++loadRequestSequenceRef.current;
    setLoading(true);
    try {
      const res = await getDocument(id);
      if (requestId !== loadRequestSequenceRef.current) return;
      if (res.code === 0 && res.data) {
        setDoc(res.data);
        setReadOnly(Boolean(res.data.read_only));
      } else {
        navigate('/');
      }
    } finally {
      if (requestId === loadRequestSequenceRef.current) setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  const loadComments = useCallback(async () => {
    if (!id) return;
    const res = await getComments(id);
    if (res.code === 0 && res.data) setComments(res.data);
  }, [id]);

  useEffect(() => {
    setComments([]);
    setActiveCommentBlockId('');
    setCommentDrafts({});
    setCommentSidebarVisible(false);
    setBitableCommentActive(false);
    setBitableUnresolvedCount(0);
    loadComments();
  }, [loadComments]);

  const closeCommentSidebar = useCallback(() => {
    setCommentSidebarVisible(false);
    setActiveCommentBlockId('');
    setPendingCommentAnchor(null);
  }, []);

  const commentSidebarOpen = commentSidebarVisible;
  const commentSidebarMounted = commentSidebarVisible || bitableCommentActive;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [commentSidebarOpen]);

  const syncCatalogueAutoCollapse = useCallback(() => {
    if (!showOutlineSidebar) return;
    const pageMain = pageMainRef.current;
    if (!pageMain) return;

    const squeezed = isCatalogueAreaSqueezed(pageMain, commentSidebarOpen);

    if (squeezed) {
      if (!sidebarCollapsedRef.current) {
        sidebarAutoCollapsedRef.current = true;
        setSidebarCollapsed(true);
      }
      return;
    }

    if (sidebarAutoCollapsedRef.current && !sidebarUserCollapsedRef.current) {
      sidebarAutoCollapsedRef.current = false;
      setSidebarCollapsed(false);
    }
  }, [commentSidebarOpen, showOutlineSidebar]);

  const handleSidebarToggle = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      sidebarAutoCollapsedRef.current = false;
      sidebarUserCollapsedRef.current = next;
      return next;
    });
  }, []);

  const handleWorkspaceScroll = useCallback(() => {
    window.dispatchEvent(new CustomEvent(FEISHU_LAYOUT_SCROLL_EVENT));
  }, []);

  useEffect(() => {
    if (!showOutlineSidebar) return;
    syncCatalogueAutoCollapse();

    const pageMain = pageMainRef.current;
    const workspace = mainScrollRef.current;
    if (!pageMain) return;

    const onBitableLayout = () => syncCatalogueAutoCollapse();
    workspace?.addEventListener('bitable-grid-scroll', onBitableLayout);
    window.addEventListener('resize', onBitableLayout);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(onBitableLayout);
      ro.observe(pageMain);
    }

    return () => {
      workspace?.removeEventListener('bitable-grid-scroll', onBitableLayout);
      window.removeEventListener('resize', onBitableLayout);
      ro?.disconnect();
    };
  }, [showOutlineSidebar, syncCatalogueAutoCollapse]);

  useEffect(() => {
    const handleBitableOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ blockId?: string; recordId?: string }>).detail;
      if (!detail?.blockId || !detail.recordId) return;
      const scrollRoot = mainScrollRef.current;
      const savedScrollTop = scrollRoot?.scrollTop ?? 0;
      setBitableCommentActive(true);
      setCommentSidebarVisible(true);
      preserveWorkspaceScroll(scrollRoot, savedScrollTop);
    };
    const handleBitableClose = (event: Event) => {
      const detail = (event as CustomEvent<{ blockId?: string }>).detail;
      if (!detail?.blockId) return;
      setBitableCommentActive(false);
      setBitableUnresolvedCount(0);
    };
    const handleBitableMeta = (event: Event) => {
      const detail = (event as CustomEvent<{ unresolvedCount?: number }>).detail;
      setBitableUnresolvedCount(Math.max(0, detail?.unresolvedCount ?? 0));
    };
    const handleBitableToggleSidebar = (event: Event) => {
      const detail = (event as CustomEvent<{ blockId?: string }>).detail;
      if (!detail?.blockId) return;
      setCommentSidebarVisible(current => !current);
    };
    window.addEventListener(BITABLE_COMMENT_OPEN, handleBitableOpen);
    window.addEventListener(BITABLE_COMMENT_CLOSE, handleBitableClose);
    window.addEventListener(BITABLE_COMMENT_META, handleBitableMeta);
    window.addEventListener(BITABLE_COMMENT_TOGGLE_SIDEBAR, handleBitableToggleSidebar);
    return () => {
      window.removeEventListener(BITABLE_COMMENT_OPEN, handleBitableOpen);
      window.removeEventListener(BITABLE_COMMENT_CLOSE, handleBitableClose);
      window.removeEventListener(BITABLE_COMMENT_META, handleBitableMeta);
      window.removeEventListener(BITABLE_COMMENT_TOGGLE_SIDEBAR, handleBitableToggleSidebar);
    };
  }, []);

  useEffect(() => {
    const handleOpenCommentSidebar = (event: Event) => {
      const detail = (event as CustomEvent<{
        documentId?: string;
        blockId?: string;
        threadId?: string;
        anchorType?: Comment['anchor_type'];
        position_from?: number;
        position_to?: number;
        quote?: string;
        anchor_json?: string;
      }>).detail;
      if (!detail?.blockId) return;
      /* 不传 documentId 的旧事件仍打开（单页会话）；传入则必须与当前路由文档一致 */
      if (detail.documentId != null && detail.documentId !== id) return;
      const blockId = detail.blockId;
      const scrollRoot = mainScrollRef.current;
      const savedScrollTop = scrollRoot?.scrollTop ?? 0;
      setActiveCommentBlockId(blockId);
      if (detail.threadId && !comments.some(c => (c.thread_id || c.block_id || c.id) === detail.threadId)) {
        setPendingCommentAnchor({
          blockId,
          threadId: detail.threadId,
          anchorType: detail.anchorType || 'block',
          positionFrom: detail.position_from || 0,
          positionTo: detail.position_to || 0,
          quote: detail.quote || '',
          anchorJson: detail.anchor_json || '',
        });
      } else {
        setPendingCommentAnchor(null);
      }
      setCommentSidebarVisible(true);
      // 只展开侧栏，不滚动正文；侧栏打开引起的布局变化也要保住当前阅读位置。
      preserveWorkspaceScroll(scrollRoot, savedScrollTop);
    };
    const handleCloseCommentSidebar = () => closeCommentSidebar();
    window.addEventListener('feishu-open-comment-sidebar', handleOpenCommentSidebar);
    window.addEventListener('feishu-close-comment-sidebar', handleCloseCommentSidebar);
    return () => {
      window.removeEventListener('feishu-open-comment-sidebar', handleOpenCommentSidebar);
      window.removeEventListener('feishu-close-comment-sidebar', handleCloseCommentSidebar);
    };
  }, [closeCommentSidebar, comments, id]);

  useEffect(() => {
    if (!commentSidebarVisible) return;
    if (bitableCommentActive) return;
    if (hasOpenCommentSidebarContent(comments, pendingCommentAnchor)) return;
    closeCommentSidebar();
  }, [bitableCommentActive, closeCommentSidebar, commentSidebarVisible, comments, pendingCommentAnchor]);

  const handleSavedPatch = useCallback(async (data: DocumentPatch, savedDocument: Document) => {
    setDoc(prev => (prev ? {
      ...prev,
      ...data,
      version: savedDocument.version,
      schema_version: savedDocument.schema_version,
      updated_at: savedDocument.updated_at,
    } : null));

    // 仅在正文持久化成功后更新锚点状态；评论内容绝不能随正文删除而静默丢失。
    if (id && data.content !== undefined) {
      const orphaned = findOrphanedComments(data.content, comments)
        .filter(comment => comment.status !== 'anchor_lost' && comment.status !== 'deleted');
      const recovered = comments.filter(comment => (
        comment.status === 'anchor_lost' && isCommentAnchorPresentInHtml(data.content!, comment)
      ));
      const changes = [
        ...orphaned.map(comment => ({ comment, status: 'anchor_lost' as const })),
        ...recovered.map(comment => ({ comment, status: (comment.resolved ? 'resolved' : 'open') as 'resolved' | 'open' })),
      ];
      if (changes.length > 0) {
        const results = await Promise.all(changes.map(({ comment, status }) => updateComment(id, comment.id, { status })));
        const updated = new Map(
          results.flatMap(result => result.code === 0 && result.data ? [[result.data.id, result.data] as const] : []),
        );
        if (updated.size > 0) setComments(current => current.map(comment => updated.get(comment.id) || comment));
      }
    }
  }, [comments, id]);

  const {
    status: saveStatus,
    enqueue: handleSave,
    retry: retrySave,
  } = useDocumentSaveQueue({
    documentId: id,
    version: doc?.version,
    onSaved: handleSavedPatch,
  });

  useEffect(() => {
    if (!id || !doc?.id) return;
    if (!collapsedPersistReadyRef.current) {
      collapsedPersistReadyRef.current = true;
      return;
    }

    if (collapsedPersistTimerRef.current) window.clearTimeout(collapsedPersistTimerRef.current);
    collapsedPersistTimerRef.current = window.setTimeout(() => {
      handleSave({ collapsed_heading_ids: collapsedHeadingIdList });
    }, 350);

    return () => {
      if (collapsedPersistTimerRef.current) window.clearTimeout(collapsedPersistTimerRef.current);
    };
  }, [collapsedHeadingIdList, doc?.id, handleSave, id]);

  const handleRemoveCover = useCallback(() => handleSave({ cover_url: '' }), [handleSave]);

  const handleSubmitComment = useCallback(async (threadKey?: string): Promise<boolean> => {
    if (!id || !commentInput.trim()) return false;
    const activeThreadKey = threadKey || activeCommentBlockId;
    const pending = pendingCommentAnchor?.threadId === activeThreadKey ? pendingCommentAnchor : null;
    const existingThread = comments.find(c => (c.thread_id || c.block_id || c.id) === activeThreadKey);
    const generatedReplyId = `reply-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const res = await addComment(id, {
      id: pending ? pending.threadId : generatedReplyId,
      thread_id: pending?.threadId || existingThread?.thread_id || existingThread?.block_id || activeThreadKey,
      parent_id: pending ? '' : (existingThread?.id || ''),
      block_id: pending?.blockId || existingThread?.block_id || activeThreadKey,
      content: commentInput.trim(),
      author: doc?.author || '张正亮',
      position_from: pending?.positionFrom || existingThread?.position_from || 0,
      position_to: pending?.positionTo || existingThread?.position_to || 0,
      quote: pending?.quote || existingThread?.quote || '',
      anchor_type: pending?.anchorType || existingThread?.anchor_type || 'block',
      anchor_json: pending?.anchorJson || existingThread?.anchor_json || '',
    });
    if (res.code === 0 && res.data) {
      setComments(prev => [...prev, res.data!]);
      setCommentDrafts(current => {
        const next = { ...current };
        delete next[activeThreadKey];
        return next;
      });
      setPendingCommentAnchor(null);
      return true;
    }
    return false;
  }, [activeCommentBlockId, commentInput, comments, doc?.author, id, pendingCommentAnchor]);

  const handleToggleResolveComment = useCallback(async (comment: Comment) => {
    if (!id) return;
    const res = await updateComment(id, comment.id, { resolved: comment.resolved ? 0 : 1 });
    if (res.code === 0 && res.data) {
      const threadKey = comment.thread_id || comment.block_id || comment.id;
      setComments(prev => prev.map(item => (
        (item.thread_id || item.block_id || item.id) === threadKey
          ? { ...item, resolved: res.data!.resolved, status: res.data!.resolved ? 'resolved' : 'open' }
          : item
      )));
    }
  }, [id]);

  const handleUpdateComment = useCallback(async (comment: Comment, content: string): Promise<boolean> => {
    const t = content.trim();
    if (!id || !t) return false;
    const res = await updateComment(id, comment.id, { content: t });
    if (res.code === 0 && res.data) {
      setComments(prev => prev.map(item => item.id === comment.id ? res.data! : item));
      return true;
    }
    return false;
  }, [id]);

  const handleDeleteComment = useCallback(async (comment: Comment): Promise<boolean> => {
    if (!id) return false;
    const threadKey = getCommentThreadKey(comment);
    const res = await deleteComment(id, comment.id);
    if (res.code === 0) {
      const remaining = comments.filter(item => item.id !== comment.id);
      setComments(remaining);
      const threadStillExists = remaining.some(item => getCommentThreadKey(item) === threadKey);
      if (!threadStillExists) {
        dispatchRemoveCommentHighlights([threadKey]);
      }
      return true;
    }
    return false;
  }, [comments, id]);

  const handleJumpToCommentBlock = useCallback((blockId: string) => {
    setActiveCommentBlockId(blockId);
    const root = mainScrollRef.current;
    if (!root) return;
    root.querySelectorAll('.feishu-comment-highlight--active').forEach(el => el.classList.remove('feishu-comment-highlight--active'));
    const target = resolveBlockElement(root, blockId);
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (target instanceof HTMLElement) target.classList.add('feishu-comment-highlight--active');
  }, []);

  useEffect(() => {
    const root = mainScrollRef.current;
    if (!root) return;
    root.querySelectorAll('.feishu-comment-highlight--active').forEach(el => el.classList.remove('feishu-comment-highlight--active'));
    if (!activeCommentBlockId) return;
    const target = resolveBlockElement(root, activeCommentBlockId);
    if (target instanceof HTMLElement) target.classList.add('feishu-comment-highlight--active');
  }, [activeCommentBlockId, comments]);

  if (loading) {
    return (
      <div className="doc-page-loading">
        <Loading loading size="medium" text="加载文档中..." />
      </div>
    );
  }

  if (!doc) return null;

  return (
    <div className={`doc-page${commentSidebarOpen ? ' doc-page--comment-open' : ''}`}>
      <DocumentHeader
        doc={doc}
        saveStatus={saveStatus}
        readOnly={readOnly}
        onReadOnlyChange={setReadOnly}
        onRetrySave={retrySave}
        onReloadConflict={() => window.location.reload()}
      />
      <div className={`doc-page-body${commentSidebarOpen ? ' doc-page-body--comment-open' : ''}`}>
        <div className="doc-page-workspace" ref={mainScrollRef} onScroll={handleWorkspaceScroll}>
          {doc.cover_url && (
            <div className="doc-cover-strip">
              <div className="doc-cover-wrapper">
                <img className="doc-cover-img" src={doc.cover_url} alt="" referrerPolicy="no-referrer" />
                <div className="doc-cover-actions">
                  <button type="button" className="cover-action-btn" onClick={handleRemoveCover}>
                    移除封面
                  </button>
                </div>
              </div>
            </div>
          )}
          <CommentSidebarTrackContext.Provider value={commentTrackHost}>
          <div className="doc-page-workspace-inner">
            <main
              className={`doc-page-main${showOutlineSidebar ? '' : ' doc-page-main--no-catalogue'}`}
              ref={pageMainRef}
            >
              {showOutlineSidebar && (
                <div
                  className={`doc-page-catalogue-rail${sidebarCollapsed ? ' doc-page-catalogue-rail--collapsed' : ''}`}
                  aria-hidden={!showOutlineSidebar}
                >
                  <Sidebar
                    documentTitle={catalogueTitleDisplay}
                    headings={headings}
                    activeId={catalogueActiveId}
                    onTocItemActivate={setCatalogueActiveId}
                    collapsed={sidebarCollapsed}
                    onToggle={handleSidebarToggle}
                    collapsedHeadingIds={collapsedHeadingIds}
                    onToggleHeadingCollapse={handleToggleHeadingCollapse}
                  />
                </div>
              )}

              <Editor
                documentId={doc.id}
                content={doc.content}
                title={doc.title}
                author={doc.author}
                updatedAt={doc.updated_at}
                icon={doc.icon}
                coverUrl={doc.cover_url}
                onSave={handleSave}
                onHeadingsChange={setHeadings}
                onTitleInputChange={handleTitleInputChange}
                onCatalogueActiveIdChange={setCatalogueActiveId}
                readOnly={readOnly}
                collapsedHeadingIds={collapsedHeadingIds}
                onToggleHeadingCollapse={handleToggleHeadingCollapse}
              />
            </main>
            {commentSidebarMounted && (
              <CommentSidebar
                visible={commentSidebarVisible}
                comments={comments}
                activeBlockId={activeCommentBlockId}
                pendingThread={pendingCommentAnchor}
                inputValue={commentInput}
                onInputChange={handleCommentInputChange}
                onSubmit={handleSubmitComment}
                onResolve={handleToggleResolveComment}
                onUpdateComment={handleUpdateComment}
                onDeleteComment={handleDeleteComment}
                currentUserName={doc.author}
                onClose={closeCommentSidebar}
                onJumpToBlock={handleJumpToCommentBlock}
                mainScrollRef={mainScrollRef}
                hasExternalPanels={bitableCommentActive}
                externalUnresolvedCount={bitableUnresolvedCount}
                onTrackElement={setCommentTrackHost}
              />
            )}
          </div>
          </CommentSidebarTrackContext.Provider>
        </div>
      </div>
    </div>
  );
}
