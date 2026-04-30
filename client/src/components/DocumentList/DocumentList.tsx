import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDocuments, createDocument, deleteDocument, duplicateDocument } from '../../api/documents';
import type { Document } from '../../types';
import './DocumentList.less';

const TABS = ['最近访问', '归我所有', '与我共享', '收藏'];

interface RowMenu {
  docId: string;
  x: number;
  y: number;
}

export default function DocumentList() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [rowMenu, setRowMenu] = useState<RowMenu | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const rowMenuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const loadDocuments = async () => {
    setLoading(true);
    const res = await getDocuments();
    if (res.code === 0 && res.data) {
      setDocuments(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  // Close row menu on outside click / Escape
  useEffect(() => {
    if (!rowMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (rowMenuRef.current && !rowMenuRef.current.contains(e.target as Node)) {
        setRowMenu(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRowMenu(null);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [rowMenu]);

  const handleCreate = async () => {
    const res = await createDocument();
    if (res.code === 0 && res.data) {
      navigate(`/doc/${res.data.id}`);
    }
  };

  const openRowMenu = useCallback((e: React.MouseEvent, docId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 340);
    setRowMenu({ docId, x, y });
  }, []);

  const showDeleteModal = (id: string) => {
    const doc = documents.find(d => d.id === id);
    setRowMenu(null);
    setDeleteTarget({ id, title: doc?.title || '未命名文档' });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteDocument(deleteTarget.id);
    setDeleteTarget(null);
    loadDocuments();
  };

  const handleRemoveRecord = () => {
    // In a real app this would remove the visit record only
    setDeleteTarget(null);
  };

  const handleDuplicate = async (id: string) => {
    setRowMenu(null);
    const res = await duplicateDocument(id);
    if (res.code === 0 && res.data) {
      loadDocuments();
    }
  };

  const handleCopyLink = (id: string) => {
    setRowMenu(null);
    const url = `${window.location.origin}/doc/${id}`;
    navigator.clipboard.writeText(url);
  };

  const handleShare = (id: string) => {
    setRowMenu(null);
    const url = `${window.location.origin}/doc/${id}`;
    navigator.clipboard.writeText(url);
    alert('分享链接已复制到剪贴板！');
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `今天 ${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;
    if (days === 1) return `昨天 ${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;
    if (days < 30) return `${date.getMonth()+1}月${date.getDate()}日 ${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;
    return date.toLocaleDateString('zh-CN');
  };

  // Filter docs by tab (simple logic –归我所有 means all, 最近访问/其他 same for demo)
  const visibleDocs = documents;

  return (
    <div className="home-page">
      {/* Top header */}
      <header className="home-header">
        <span className="home-header-title">主页</span>
        <div className="home-header-actions">
          <button className="header-icon-btn" title="搜索">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M11 11l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
          <button className="header-icon-btn" title="联系人">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M3 13c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
          <button className="header-icon-btn" title="通知">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2a4 4 0 00-4 4v3l-1 2h10l-1-2V6a4 4 0 00-4-4zM6.5 12a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button className="header-icon-btn" title="应用">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="2" y="2" width="5" height="5" rx="1"/>
              <rect x="9" y="2" width="5" height="5" rx="1"/>
              <rect x="2" y="9" width="5" height="5" rx="1"/>
              <rect x="9" y="9" width="5" height="5" rx="1"/>
            </svg>
          </button>
          <div className="user-avatar">张</div>
        </div>
      </header>

      <div className="home-content">
        {/* Action cards */}
        <div className="action-bar">
          <div className="action-card" onClick={handleCreate}>
            <div className="action-card-icon icon-create">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="2" y="2" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.4" fill="none"/>
                <path d="M9 6v6M6 9h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="action-card-text">
              <span className="action-card-name">新建</span>
              <span className="action-card-desc">新建文档开始协作</span>
            </div>
            <span className="action-card-arrow">▾</span>
          </div>

          <div className="action-card">
            <div className="action-card-icon icon-upload">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 12V5M6 8l3-3 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M4 13h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="action-card-text">
              <span className="action-card-name">上传</span>
              <span className="action-card-desc">上传本地文件</span>
            </div>
            <span className="action-card-arrow">▾</span>
          </div>

          <div className="action-card">
            <div className="action-card-icon icon-template">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="2" y="2" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.4" fill="none"/>
                <path d="M5 6h8M5 9h5M5 12h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="action-card-text">
              <span className="action-card-name">模板库</span>
              <span className="action-card-desc">选择模板快速新建</span>
            </div>
            <span className="action-card-arrow">▾</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs-bar">
          <div className="tabs-left">
            {TABS.map((tab, i) => (
              <button
                key={tab}
                className={`tab-item${activeTab === i ? ' active' : ''}`}
                onClick={() => setActiveTab(i)}
              >
                {tab}
              </button>
            ))}
            <button className="tab-add" title="添加标签">+</button>
          </div>
          <div className="tabs-right">
            <button className="tab-action-btn">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M2 4h9M3.5 7h6M5 10h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              筛选
            </button>
            <button className="tab-action-btn">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <rect x="1" y="1" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.2"/>
                <rect x="8" y="1" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.2"/>
                <rect x="1" y="8" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.2"/>
                <rect x="8" y="8" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.2"/>
              </svg>
              显示设置
            </button>
            <div className="view-toggle">
              <button className="active" title="列表">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 4h10M2 7h10M2 10h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
              </button>
              <button title="宫格">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="1" y="1" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.2"/>
                  <rect x="8" y="1" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.2"/>
                  <rect x="1" y="8" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.2"/>
                  <rect x="8" y="8" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.2"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="doc-loading">
            <div className="spinner" />
            <span>加载中...</span>
          </div>
        ) : visibleDocs.length === 0 ? (
          <div className="doc-empty">
            <div className="doc-empty-icon">
              <svg viewBox="0 0 80 80" fill="none">
                <rect x="12" y="8" width="48" height="60" rx="4" fill="#c9cdd4"/>
                <rect x="18" y="22" width="36" height="3" rx="1.5" fill="#fff" opacity="0.8"/>
                <rect x="18" y="30" width="28" height="3" rx="1.5" fill="#fff" opacity="0.6"/>
                <rect x="18" y="38" width="32" height="3" rx="1.5" fill="#fff" opacity="0.6"/>
                <rect x="18" y="46" width="24" height="3" rx="1.5" fill="#fff" opacity="0.6"/>
                <rect x="44" y="4" width="20" height="20" rx="3" fill="#f5f6f7"/>
                <path d="M44 4l20 20H44V4z" fill="#e0e3e8"/>
              </svg>
            </div>
            <p>暂无文档</p>
            <button className="btn-create-empty" onClick={handleCreate}>创建第一个文档</button>
          </div>
        ) : (
          <table className="doc-table">
            <thead>
              <tr>
                <th style={{ width: '40%' }}>标题</th>
                <th style={{ width: '18%' }}>位置</th>
                <th style={{ width: '16%' }}>所有者</th>
                <th style={{ width: '13%' }}>创建时间</th>
                <th style={{ width: '13%' }}>最近访问 ↓</th>
                <th style={{ width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {visibleDocs.map(doc => (
                <tr
                  key={doc.id}
                  onClick={() => navigate(`/doc/${doc.id}`)}
                  onContextMenu={(e) => openRowMenu(e, doc.id)}
                >
                  <td className="col-title">
                      <svg className="doc-type-icon" viewBox="0 0 20 20" fill="currentColor">
                        <rect x="3" y="2" width="12" height="16" rx="1.5" fill="currentColor" opacity="0.15"/>
                        <rect x="3" y="2" width="12" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
                        <path d="M6 7h8M6 10h6M6 13h7" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                      </svg>
                      <span className="doc-title-text">{doc.title || '未命名文档'}</span>
                  </td>
                  <td className="col-location">
                    <div className="location-inner">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <rect x="1" y="3" width="12" height="9" rx="1" stroke="currentColor" strokeWidth="1.1"/>
                        <path d="M1 6h12" stroke="currentColor" strokeWidth="1"/>
                        <path d="M4 3V1.5M10 3V1.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                      </svg>
                      我的文档库
                    </div>
                  </td>
                  <td className="col-owner">
                    <div className="owner-cell">
                      <div className="owner-avatar">{doc.author.charAt(0)}</div>
                      <span>{doc.author}</span>
                    </div>
                  </td>
                  <td className="col-time">{formatDate(doc.created_at)}</td>
                  <td className="col-time">{formatDate(doc.updated_at)}</td>
                  <td className="col-actions">
                    <button
                      className="doc-row-more"
                      onClick={(e) => openRowMenu(e, doc.id)}
                      title="更多"
                    >
                      ···
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Row context menu */}
      {rowMenu && (
        <div
          ref={rowMenuRef}
          className="row-context-menu"
          style={{ left: rowMenu.x, top: rowMenu.y }}
        >
          <button className="rcm-item" onClick={() => handleShare(rowMenu.docId)}>
            <span className="rcm-icon">↗</span>分享
          </button>
          <button className="rcm-item" onClick={() => handleCopyLink(rowMenu.docId)}>
            <span className="rcm-icon">🔗</span>复制链接
          </button>
          <button className="rcm-item" onClick={() => handleDuplicate(rowMenu.docId)}>
            <span className="rcm-icon">📄</span>创建副本
          </button>
          <button className="rcm-item" onClick={() => setRowMenu(null)}>
            <span className="rcm-icon">⊕</span>添加快捷方式到
          </button>
          <button className="rcm-item" onClick={() => setRowMenu(null)}>
            <span className="rcm-icon">📌</span>添加到"置顶"
          </button>
          <button className="rcm-item" onClick={() => setRowMenu(null)}>
            <span className="rcm-icon">⭐</span>收藏
          </button>
          <div className="rcm-divider" />
          <button className="rcm-item" onClick={() => setRowMenu(null)}>
            <span className="rcm-icon">🔔</span>关注文档更新
          </button>
          <button className="rcm-item" onClick={() => setRowMenu(null)}>
            <span className="rcm-icon">🔒</span>设置密级
          </button>
          <div className="rcm-divider" />
          <button className="rcm-item rcm-danger" onClick={() => showDeleteModal(rowMenu.docId)}>
            <span className="rcm-icon">🗑</span>删除
          </button>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">是否删除：{deleteTarget.title}？</span>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}>×</button>
            </div>
            <p className="modal-desc">
              删除的内容将进入回收站，30 天后自动彻底删除。你也可以保留内容，仅移除访问记录。
            </p>
            <div className="modal-actions">
              <button className="modal-btn modal-btn-outline" onClick={handleRemoveRecord}>
                仅移除访问记录
              </button>
              <button className="modal-btn modal-btn-danger" onClick={handleConfirmDelete}>
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
