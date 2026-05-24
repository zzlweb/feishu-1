import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loading } from 'tdesign-react';
import { addComment, deleteComment, getComments, getDocument, updateComment, updateDocument } from '../../api/documents';
import type { Comment, Document, HeadingItem } from '../../types';
import { DOC_TITLE_CATALOGUE_ID } from '../../types';
import Editor from '../Editor/Editor';
import Sidebar from './Sidebar';
import DocumentHeader from './DocumentHeader';
import CommentSidebar from './CommentSidebar';
import './Layout.less';

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
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [titleInputSnapshot, setTitleInputSnapshot] = useState('');
  const [catalogueActiveId, setCatalogueActiveId] = useState<string | null>(null);
  const [collapsedHeadingIds, setCollapsedHeadingIds] = useState<Set<string>>(() => new Set());

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
    setCollapsedHeadingIds(new Set());
  }, [doc?.id]);

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
    loadComments();
  }, [loadComments]);

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
        mainScrollRef.current?.querySelector(`#${CSS.escape(blockId)}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 0);
    };
    window.addEventListener('feishu-open-comment-sidebar', handleOpenCommentSidebar);
    return () => window.removeEventListener('feishu-open-comment-sidebar', handleOpenCommentSidebar);
  }, [comments, id]);

  const handleSave = async (data: { title?: string; content?: string; icon?: string; cover_url?: string }) => {
    if (!id) return;
    setSaveStatus('saving');
    const res = await updateDocument(id, data);
    if (res.code === 0 && res.data) {
      setDoc(prev => (prev ? { ...prev, ...data, updated_at: res.data!.updated_at } : null));
    }
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

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
    const res = await deleteComment(id, comment.id);
    if (res.code === 0) {
      setComments(prev => prev.filter(item => item.id !== comment.id));
      return true;
    }
    return false;
  }, [id]);

  const handleJumpToCommentBlock = useCallback((blockId: string) => {
    setActiveCommentBlockId(blockId);
    const root = mainScrollRef.current;
    if (!root) return;
    root.querySelectorAll('.feishu-comment-highlight--active').forEach(el => el.classList.remove('feishu-comment-highlight--active'));
    const target = root.querySelector(`#${CSS.escape(blockId)}`) || root.querySelector(`[data-comment-thread-id="${CSS.escape(blockId)}"]`);
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (target instanceof HTMLElement) target.classList.add('feishu-comment-highlight--active');
  }, []);

  useEffect(() => {
    const root = mainScrollRef.current;
    if (!root) return;
    root.querySelectorAll('.feishu-comment-highlight--active').forEach(el => el.classList.remove('feishu-comment-highlight--active'));
    if (!activeCommentBlockId) return;
    const target = root.querySelector(`#${CSS.escape(activeCommentBlockId)}`) || root.querySelector(`[data-comment-thread-id="${CSS.escape(activeCommentBlockId)}"]`);
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
    <div className="doc-page">
      <DocumentHeader doc={doc} saveStatus={saveStatus} readOnly={readOnly} onReadOnlyChange={setReadOnly} />
      <div className={`doc-page-body${commentSidebarVisible ? ' doc-page-body--comment-open' : ''}`}>
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
          <div className="doc-page-workspace-inner">
            <main className="doc-page-main">
              <div className="doc-page-catalogue-rail" aria-hidden={!showOutlineSidebar}>
                {showOutlineSidebar && (
                  <Sidebar
                    ref={sidebarRef}
                    documentTitle={catalogueTitleDisplay}
                    headings={headings}
                    activeId={catalogueActiveId}
                    onTocItemActivate={setCatalogueActiveId}
                    collapsed={sidebarCollapsed}
                    onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
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
            {commentSidebarVisible && (
              <CommentSidebar
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
                onClose={() => setCommentSidebarVisible(false)}
                onJumpToBlock={handleJumpToCommentBlock}
                mainScrollRef={mainScrollRef}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
