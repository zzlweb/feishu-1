import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  HamburgerButton,
  Home,
  Notes,
  Edit,
  BellRing,
  More,
  Search,
  Plus,
  Pushpin,
  Protect,
} from '@icon-park/react';
import { getDocument, updateDocument, deleteDocument, saveAsTemplate, duplicateDocument } from '../../api/documents';
import type { Document, HeadingItem } from '../../types';
import Editor from '../Editor/Editor';
import Sidebar from './Sidebar';
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
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');
  const moreMenuRef = useRef<HTMLDivElement>(null);
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

  // close more-menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
      setDoc(prev => prev ? { ...prev, ...data, updated_at: res.data!.updated_at } : null);
    }
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    alert('分享链接已复制到剪贴板！');
  };

  const handleDelete = async () => {
    if (!id) return;
    if (confirm('确定删除此文档？删除后不可恢复。')) {
      await deleteDocument(id);
      navigate('/');
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!id) return;
    await saveAsTemplate(id);
    alert('已保存为模板！');
    setShowMoreMenu(false);
  };

  const handleDuplicate = async () => {
    if (!id) return;
    const res = await duplicateDocument(id);
    if (res.code === 0 && res.data) {
      navigate(`/doc/${res.data.id}`);
    }
    setShowMoreMenu(false);
  };

  if (loading) {
    return (
      <div className="doc-page-loading">
        <div className="loading-spinner" />
        <span>加载文档中...</span>
      </div>
    );
  }

  if (!doc) return null;

  return (
    <div className="doc-page">
      {/* Top Header */}
      <header className="doc-page-header">
        <div className="header-row-primary">
          <div className="header-left">
            <button className="header-icon-btn" type="button" onClick={() => navigate('/')} title="导航">
              <HamburgerButton theme="outline" size={18} strokeWidth={3} fill="#646a73" />
            </button>
            <button className="header-icon-btn" type="button" onClick={() => navigate('/')} title="首页">
              <Home theme="outline" size={18} strokeWidth={3} fill="#646a73" />
            </button>

            <nav className="breadcrumb">
              <button type="button" className="bc-item" onClick={() => navigate('/')}>UIH</button>
              <span className="bc-sep">&gt;</span>
              <button type="button" className="bc-item" onClick={() => navigate('/')}>{doc.author}</button>
              <span className="bc-sep">&gt;</span>
              <span className="bc-current">{doc.title || '未命名文档'}</span>
            </nav>

            <button type="button" className="header-pin-btn" title="置顶">
              <Pushpin theme="outline" size={16} strokeWidth={3} fill="#8f959e" />
            </button>
          </div>

          <div className="header-right">
            <button type="button" className="btn-share" onClick={handleShare}>
              <Notes theme="outline" size={14} strokeWidth={3} fill="#ffffff" />
              分享
            </button>

            <button type="button" className="btn-edit-mode" onClick={() => setReadOnly(!readOnly)}>
              <Edit theme="outline" size={14} strokeWidth={3} fill="#646a73" className="mode-icon-park" />
              {readOnly ? '阅读' : '编辑'}
              <span className="mode-arrow">▾</span>
            </button>

            <button type="button" className="header-icon-btn" title="通知">
              <BellRing theme="outline" size={18} strokeWidth={3} fill="#646a73" />
            </button>

            <div className="more-menu-wrapper" ref={moreMenuRef}>
              <button
                type="button"
                className="header-icon-btn"
                onClick={() => setShowMoreMenu(v => !v)}
                title="更多"
              >
                <More theme="outline" size={18} strokeWidth={3} fill="#646a73" />
              </button>
              {showMoreMenu && (
                <div className="more-menu">
                  <button type="button" className="more-menu-item" onClick={handleDuplicate}>创建副本</button>
                  <button type="button" className="more-menu-item" onClick={handleSaveAsTemplate}>保存为模板</button>
                  <div className="more-menu-divider" />
                  <button type="button" className="more-menu-item danger" onClick={handleDelete}>删除文档</button>
                </div>
              )}
            </div>

            <span className="header-right-divider" aria-hidden />

            <button type="button" className="header-icon-btn" title="搜索">
              <Search theme="outline" size={18} strokeWidth={3} fill="#646a73" />
            </button>

            <button type="button" className="header-icon-btn" title="新建页面">
              <Plus theme="outline" size={18} strokeWidth={3} fill="#646a73" />
            </button>

            <div className="user-avatar">{doc.author.charAt(0)}</div>
          </div>
        </div>

        <div className="header-row-meta">
          <span className="header-meta-item">
            <Protect theme="outline" size={14} strokeWidth={3} fill="#8f959e" />
            内部信息
          </span>
          <span className="header-meta-vsep" aria-hidden />
          <span className="header-meta-item header-meta-cloud">
            {saveStatus === 'saving' ? '保存中…' : '已经保存到云端'}
          </span>
        </div>
      </header>

      {/* Body */}
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
