import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loading } from 'tdesign-react';
import { getDocument, updateDocument } from '../../api/documents';
import type { Document, HeadingItem } from '../../types';
import Editor from '../Editor/Editor';
import Sidebar from './Sidebar';
import DocumentHeader from './DocumentHeader';
import './Layout.less';

/** 与编辑器 normalize 逻辑一致：仅当有「真实标题」时才显示大纲侧栏 */
function titleAllowsOutlineSidebar(displayTitle: string): boolean {
  const t = displayTitle.trim();
  return t.length > 0 && t !== '未命名文档';
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
  /** 标题输入快照（来自编辑器回调 + 文档加载同步），用于控制大纲侧栏显隐 */
  const [titleInputSnapshot, setTitleInputSnapshot] = useState('');
  const outlineHadTitleRef = useRef(false);

  const showOutlineSidebar = titleAllowsOutlineSidebar(titleInputSnapshot);

  const handleTitleInputChange = useCallback((t: string) => {
    setTitleInputSnapshot(t);
  }, []);

  useEffect(() => {
    if (!doc) return;
    setTitleInputSnapshot(doc.title === '未命名文档' ? '' : doc.title);
  }, [doc?.id, doc?.title]);

  useEffect(() => {
    outlineHadTitleRef.current = false;
  }, [doc?.id]);

  useEffect(() => {
    if (showOutlineSidebar && !outlineHadTitleRef.current) {
      setSidebarCollapsed(false);
    }
    outlineHadTitleRef.current = showOutlineSidebar;
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

  const handleSave = async (data: { title?: string; content?: string }) => {
    if (!id) return;
    setSaveStatus('saving');
    const res = await updateDocument(id, data);
    if (res.code === 0 && res.data) {
      setDoc(prev => (prev ? { ...prev, ...data, updated_at: res.data!.updated_at } : null));
    }
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

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
            headings={headings}
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        )}
        <main className="doc-page-main">
          <Editor
            content={doc.content}
            title={doc.title}
            author={doc.author}
            updatedAt={doc.updated_at}
            onSave={handleSave}
            onHeadingsChange={setHeadings}
            onTitleInputChange={handleTitleInputChange}
            readOnly={readOnly}
          />
        </main>
      </div>
    </div>
  );
}
