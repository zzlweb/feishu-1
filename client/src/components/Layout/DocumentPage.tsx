import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDocument, updateDocument, deleteDocument, saveAsTemplate, duplicateDocument } from '../../api/documents';
import type { Document, HeadingItem } from '../../types';
import Editor from '../Editor/Editor';
import Sidebar from './Sidebar';
import './Layout.less';

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
        <div className="header-top">
          {/* Left */}
          <div className="header-left">
            <button className="header-icon-btn" onClick={() => navigate('/')} title="导航">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M3 5h12M3 9h12M3 13h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </button>
            <button className="header-icon-btn" onClick={() => navigate('/')} title="首页">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 8l6-6 6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M4 7v6h3v-3h2v3h3V7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
            </button>

            {/* Breadcrumb */}
            <nav className="breadcrumb">
              <button className="bc-item" onClick={() => navigate('/')}>UIH</button>
              <span className="bc-sep">›</span>
              <button className="bc-item" onClick={() => navigate('/')}>{doc.author}</button>
              <span className="bc-sep">›</span>
              <span className="bc-current">{doc.title || '未命名文档'}</span>
            </nav>

            <button className="header-star-btn" title="收藏">&#9733;</button>

            <button
              className={`header-icon-btn header-toc-toggle ${sidebarCollapsed ? '' : 'is-open'}`}
              onClick={() => setSidebarCollapsed(v => !v)}
              title={sidebarCollapsed ? '展开目录' : '收起目录'}
            >
              {sidebarCollapsed ? (
                <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                  <path d="M2.5 3.5h9M2.5 7h6M2.5 10.5h9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                  <path d="M8 3L4 7l4 4M11 3L7 7l4 4" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          </div>

          {/* Right */}
          <div className="header-right">
            {/* save dot */}
            {saveStatus !== 'idle' && (
              <span className={`save-dot ${saveStatus}`} title={saveStatus === 'saving' ? '保存中' : '已保存'} />
            )}

            {/* Share */}
            <button className="btn-share" onClick={handleShare}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M6.5 1v7M4 4l2.5-3L9 4" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 8v3.5h9V8" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
              分享
            </button>

            {/* Edit/Read mode */}
            <button className="btn-edit-mode" onClick={() => setReadOnly(!readOnly)}>
              <svg className="mode-icon" width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M9 1.5l2.5 2.5L4 11.5H1.5V9L9 1.5z" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {readOnly ? '阅读' : '编辑'}
              <span className="mode-arrow">▾</span>
            </button>

            {/* Bell */}
            <button className="header-icon-btn" title="通知">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2a4 4 0 00-4 4v3l-1 2h10l-1-2V6a4 4 0 00-4-4zM6.5 12.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* More ··· */}
            <div className="more-menu-wrapper" ref={moreMenuRef}>
              <button
                className="header-icon-btn"
                onClick={() => setShowMoreMenu(v => !v)}
                title="更多"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <circle cx="3.5" cy="8" r="1.3"/>
                  <circle cx="8" cy="8" r="1.3"/>
                  <circle cx="12.5" cy="8" r="1.3"/>
                </svg>
              </button>
              {showMoreMenu && (
                <div className="more-menu">
                  <button className="more-menu-item" onClick={handleDuplicate}>创建副本</button>
                  <button className="more-menu-item" onClick={handleSaveAsTemplate}>保存为模板</button>
                  <div className="more-menu-divider" />
                  <button className="more-menu-item danger" onClick={handleDelete}>删除文档</button>
                </div>
              )}
            </div>

            {/* Search */}
            <button className="header-icon-btn" title="搜索">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="4" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M11 11l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </button>

            {/* New page + */}
            <button className="header-icon-btn" title="新建页面">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </button>

            {/* Avatar */}
            <div className="user-avatar">{doc.author.charAt(0)}</div>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="doc-page-body">
        <Sidebar
          headings={headings}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <main className="doc-page-main">
          <Editor
            content={doc.content}
            title={doc.title}
            author={doc.author}
            onSave={handleSave}
            onHeadingsChange={setHeadings}
            readOnly={readOnly}
          />
        </main>
      </div>
    </div>
  );
}
