import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loading } from 'tdesign-react';
import { getDocument, updateDocument } from '../../api/documents';
import type { Document, HeadingItem } from '../../types';
import { DOC_TITLE_CATALOGUE_ID } from '../../types';
import Editor from '../Editor/Editor';
import Sidebar from './Sidebar';
import DocumentHeader from './DocumentHeader';
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
  const outlineWasVisibleRef = useRef(false);
  const mainScrollRef = useRef<HTMLElement>(null);
  const [sidebarTop, setSidebarTop] = useState(0);
  /** 标题输入快照（与编辑器同步），用于目录首行与侧栏显隐 */
  const [titleInputSnapshot, setTitleInputSnapshot] = useState('');
  /** 目录当前高亮项：随文档标题焦点 / 正文光标所在章节变化 */
  const [catalogueActiveId, setCatalogueActiveId] = useState<string | null>(null);

  const catalogueTitleDisplay = titleInputSnapshot.trim();
  /** 有正文标题块或已填写文档标题时显示目录 */
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
  }, [doc?.id]);

  /** 标题块增删后 pos 变化，剔除已不存在的目录高亮 */
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
    const res = await getDocument(id);
    if (res.code === 0 && res.data) {
      setDoc(res.data);
    } else {
      navigate('/');
    }
    setLoading(false);
  }, [id, navigate]);

  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

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

  /** 动态计算侧边栏 top：封面可见时在封面下方，滚过封面后吸顶 */
  useEffect(() => {
    const el = mainScrollRef.current;
    if (!el) return;
    const updateTop = () => {
      const cover = el.querySelector('.doc-cover-wrapper') as HTMLElement | null;
      const coverH = cover ? cover.offsetHeight : 0;
      setSidebarTop(Math.max(0, coverH - el.scrollTop));
    };
    updateTop();
    el.addEventListener('scroll', updateTop, { passive: true });
    const obs = new MutationObserver(updateTop);
    obs.observe(el, { childList: true });
    return () => {
      el.removeEventListener('scroll', updateTop);
      obs.disconnect();
    };
  }, [doc?.cover_url]);

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

      <div className="doc-page-body">
        {showOutlineSidebar && (
          <Sidebar
            documentTitle={catalogueTitleDisplay}
            headings={headings}
            activeId={catalogueActiveId}
            onTocItemActivate={setCatalogueActiveId}
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={{ top: sidebarTop }}
          />
        )}
        <main className="doc-page-main" ref={mainScrollRef}>
          {doc.cover_url && (
            <div className="doc-cover-wrapper">
              <img className="doc-cover-img" src={doc.cover_url} alt="" referrerPolicy="no-referrer" />
              <div className="doc-cover-actions">
                <button type="button" className="cover-action-btn" onClick={handleRemoveCover}>
                  移除封面
                </button>
              </div>
            </div>
          )}
          <Editor
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
          />
        </main>
      </div>
    </div>
  );
}
