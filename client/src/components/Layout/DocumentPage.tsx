import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loading } from 'tdesign-react';
import { addComment, deleteComment, getComments, getDocument, updateComment, updateDocument } from '../../api/documents';
import type { Comment, Document, HeadingItem } from '../../types';
import { DOC_TITLE_CATALOGUE_ID } from '../../types';
import Editor from '../Editor/Editor';
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
} from '../Editor/blocks/commentDocumentSync';
import { resolveBlockElement } from '../Editor/blocks/blockDom';
import './Layout.less';

const EDITOR_PAGE_MIN_WIDTH = 860;
const CATALOGUE_RAIL_WIDTH = 128;
const DOC_MAIN_MIN_GUTTER = 24;
const COMMENT_SIDEBAR_WIDTH = 280;

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
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentSidebarVisible, setCommentSidebarVisible] = useState(false);
  const [bitableCommentActive, setBitableCommentActive] = useState(false);
  const [bitableUnresolvedCount, setBitableUnresolvedCount] = useState(0);
  const [commentTrackHost, setCommentTrackHost] = useState<HTMLElement | null>(null);
  const [activeCommentBlockId, setActiveCommentBlockId] = useState('');
  const [commentInput, setCommentInput] = useState('');
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
  const sidebarRef = useRef<HTMLDivElement>(null);
  const sidebarCollapsedRef = useRef(sidebarCollapsed);
  const sidebarAutoCollapsedRef = useRef(false);
  const sidebarUserCollapsedRef = useRef(false);
  sidebarCollapsedRef.current = sidebarCollapsed;
  const collapsedPersistReadyRef = useRef(false);
  const collapsedPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [titleInputSnapshot, setTitleInputSnapshot] = useState('');
  const [catalogueActiveId, setCatalogueActiveId] = useState<string | null>(null);
  const [collapsedHeadingIds, setCollapsedHeadingIds] = useState<Set<string>>(() => new Set());
  const collapsedHeadingIdList = useMemo(
    () => Array.from(collapsedHeadingIds).sort(),
    [collapsedHeadingIds],
  );

  const catalogueTitleDisplay = titleInputSnapshot.trim();
  const showOutlineSidebar = headings.length > 0 || catalogueTitleDisplay.length > 0;

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
    setLoading(true);
    try {
      const res = await getDocument(id);
      if (res.code === 0 && res.data) {
        setDoc(res.data);
        setReadOnly(Boolean(res.data.read_only));
      } else {
        navigate('/');
      }
    } finally {
      setLoading(false);
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
    setCommentInput('');
    setCommentSidebarVisible(false);
    setBitableCommentActive(false);
    setBitableUnresolvedCount(0);
    loadComments();
  }, [loadComments]);

  const closeCommentSidebar = useCallback(() => {
    setCommentSidebarVisible(false);
    setActiveCommentBlockId('');
    setCommentInput('');
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
      setBitableCommentActive(true);
      setCommentSidebarVisible(true);
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
      window.setTimeout(() => {
        resolveBlockElement(mainScrollRef.current, blockId)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 0);
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

  const handleSave = useCallback(async (data: { title?: string; content?: string; icon?: string; cover_url?: string }) => {
    if (!id) return;

    let nextComments = comments;
    if (data.content !== undefined) {
      const orphaned = findOrphanedComments(data.content, comments);
      if (orphaned.length > 0) {
        const results = await Promise.all(orphaned.map(comment => deleteComment(id, comment.id)));
        const deletedIds = new Set(
          orphaned.filter((_, index) => results[index]?.code === 0).map(comment => comment.id),
        );
        if (deletedIds.size > 0) {
          nextComments = comments.filter(comment => !deletedIds.has(comment.id));
          setComments(nextComments);
        }
      }
    }

    setSaveStatus('saving');
    const res = await updateDocument(id, data);
    if (res.code === 0 && res.data) {
      setDoc(prev => (prev ? { ...prev, ...data, updated_at: res.data!.updated_at } : null));
    }
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  }, [comments, id]);

  useEffect(() => {
    if (!id || !doc?.id) return;
    if (!collapsedPersistReadyRef.current) {
      collapsedPersistReadyRef.current = true;
      return;
    }

    if (collapsedPersistTimerRef.current) window.clearTimeout(collapsedPersistTimerRef.current);
    setSaveStatus('saving');
    collapsedPersistTimerRef.current = window.setTimeout(async () => {
      const res = await updateDocument(id, { collapsed_heading_ids: collapsedHeadingIdList });
      if (res.code === 0 && res.data) {
        setDoc(prev => (prev ? {
          ...prev,
          collapsed_heading_ids: res.data!.collapsed_heading_ids ?? collapsedHeadingIdList,
          updated_at: res.data!.updated_at,
        } : null));
      }
      setSaveStatus('saved');
      window.setTimeout(() => setSaveStatus('idle'), 2000);
    }, 350);

    return () => {
      if (collapsedPersistTimerRef.current) window.clearTimeout(collapsedPersistTimerRef.current);
    };
  }, [collapsedHeadingIdList, doc?.id, id]);

  const handleRemoveCover = useCallback(async () => {
    if (!id) return;
    setSaveStatus('saving');
    const res = await updateDocument(id, { cover_url: '' });
    if (res.code === 0 && res.data) {
      setDoc(prev => (prev ? { ...prev, cover_url: '', updated_at: res.data!.updated_at } : null));
    }
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  }, [id]);

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
      setCommentInput('');
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

  useEffect(() => {
    const el = mainScrollRef.current;
    const sidebar = sidebarRef.current;
    if (!el || !sidebar) return;
    const cover = el.querySelector('.doc-cover-wrapper') as HTMLElement | null;
    const img = cover?.querySelector('.doc-cover-img') as HTMLImageElement | null;

    const updateTop = () => {
      const coverEl = el.querySelector('.doc-cover-wrapper') as HTMLElement | null;
      const coverH = coverEl ? coverEl.offsetHeight : 0;
      sidebar.style.top = `${Math.max(0, coverH - el.scrollTop)}px`;
    };
    updateTop();

    el.addEventListener('scroll', updateTop, { passive: true });
    const obs = new MutationObserver(updateTop);
    obs.observe(el, { childList: true });

    let ro: ResizeObserver | null = null;
    if (cover && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(updateTop);
      ro.observe(cover);
    }

    const onImgLoad = () => updateTop();
    if (img) {
      if (img.complete) updateTop();
      else img.addEventListener('load', onImgLoad);
    }

    return () => {
      el.removeEventListener('scroll', updateTop);
      obs.disconnect();
      ro?.disconnect();
      img?.removeEventListener('load', onImgLoad);
    };
  }, [doc?.cover_url, showOutlineSidebar]);

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
      <DocumentHeader doc={doc} saveStatus={saveStatus} readOnly={readOnly} onReadOnlyChange={setReadOnly} />
      <div className={`doc-page-body${commentSidebarOpen ? ' doc-page-body--comment-open' : ''}`}>
        <div className="doc-page-workspace" ref={mainScrollRef}>
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
            <main className="doc-page-main" ref={pageMainRef}>
              <div className="doc-page-catalogue-rail" aria-hidden={!showOutlineSidebar}>
                {showOutlineSidebar && (
                  <Sidebar
                    ref={sidebarRef}
                    documentTitle={catalogueTitleDisplay}
                    headings={headings}
                    activeId={catalogueActiveId}
                    onTocItemActivate={setCatalogueActiveId}
                    collapsed={sidebarCollapsed}
                    onToggle={handleSidebarToggle}
                    collapsedHeadingIds={collapsedHeadingIds}
                    onToggleHeadingCollapse={handleToggleHeadingCollapse}
                  />
                )}
              </div>

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
                onInputChange={setCommentInput}
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
