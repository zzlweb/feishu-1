import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Dialog, Input, Loading, MessagePlugin } from 'tdesign-react';
import {
  AppIcon,
  ComponentGridIcon,
  EllipsisIcon,
  FileAddIcon,
  FilterIcon,
  NotificationIcon,
  SearchIcon,
  TemplateIcon,
  UploadIcon,
  UserIcon,
  ViewListIcon,
} from 'tdesign-icons-react';
import {
  createDocument,
  deleteDocument,
  duplicateDocument,
  getDocuments,
  getTemplates,
} from '../../api/documents';
import type { Document, Template } from '../../types';
import './DocumentList.less';

const TABS = ['最近访问', '归我所有', '与我共享', '收藏'];
const CURRENT_USER = '张正人';

type ViewMode = 'list' | 'grid';
type SortKey = 'updated_at' | 'created_at' | 'title';

interface RowMenu {
  docId: string;
  x: number;
  y: number;
}

function getDocTitle(doc: Pick<Document, 'title'>) {
  return doc.title?.trim() || '未命名文档';
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '-';

  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24 && now.getDate() === date.getDate()) return `今天 ${time}`;
  if (days < 2) return `昨天 ${time}`;
  if (date.getFullYear() === now.getFullYear()) return `${date.getMonth() + 1}月${date.getDate()}日 ${time}`;
  return date.toLocaleDateString('zh-CN');
}

function buildPlainTextDocument(text: string) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .split(/\n{2,}/)
    .map(part => `<p>${part.replace(/\n/g, '<br>') || '<br>'}</p>`)
    .join('');
}

export default function DocumentList() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('updated_at');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());
  const [rowMenu, setRowMenu] = useState<RowMenu | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [templateDialogVisible, setTemplateDialogVisible] = useState(false);
  const rowMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const [docRes, templateRes] = await Promise.all([getDocuments(), getTemplates()]);
      if (docRes.code === 0 && docRes.data) {
        setDocuments(docRes.data);
      } else {
        void MessagePlugin.error(docRes.message || '加载文档列表失败');
      }
      if (templateRes.code === 0 && templateRes.data) {
        setTemplates(templateRes.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    if (!rowMenu) return undefined;
    const handleClick = (e: MouseEvent) => {
      if (rowMenuRef.current && e.target instanceof Node && !rowMenuRef.current.contains(e.target)) {
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

  const visibleDocs = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = documents.filter(doc => {
      if (activeTab === 2) return false;
      if (activeTab === 3 && !favorites.has(doc.id)) return false;
      if (q && !`${doc.title} ${doc.author}`.toLowerCase().includes(q)) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortKey === 'title') return getDocTitle(a).localeCompare(getDocTitle(b), 'zh-CN');
      return new Date(b[sortKey]).getTime() - new Date(a[sortKey]).getTime();
    });
  }, [activeTab, documents, favorites, query, sortKey]);

  const handleCreate = async (template?: Template) => {
    const res = await createDocument(
      template
        ? {
            title: template.title,
            content: template.content,
            author: CURRENT_USER,
          }
        : { author: CURRENT_USER },
    );
    if (res.code === 0 && res.data) {
      navigate(`/doc/${res.data.id}`);
    } else {
      void MessagePlugin.error(res.message || '创建文档失败');
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const text = await file.text();
    const res = await createDocument({
      title: file.name.replace(/\.[^.]+$/, ''),
      content: buildPlainTextDocument(text),
      author: CURRENT_USER,
    });
    if (res.code === 0 && res.data) {
      void MessagePlugin.success('已导入为新文档');
      navigate(`/doc/${res.data.id}`);
    } else {
      void MessagePlugin.error(res.message || '导入失败');
    }
  };

  const openRowMenu = useCallback((e: React.MouseEvent, docId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setRowMenu({
      docId,
      x: Math.min(e.clientX, window.innerWidth - 220),
      y: Math.min(e.clientY, window.innerHeight - 320),
    });
  }, []);

  const handleDuplicate = async (id: string) => {
    setRowMenu(null);
    const res = await duplicateDocument(id);
    if (res.code === 0) {
      void MessagePlugin.success('副本已创建');
      void loadDocuments();
    } else {
      void MessagePlugin.error(res.message || '创建副本失败');
    }
  };

  const handleCopyLink = async (id: string) => {
    setRowMenu(null);
    await navigator.clipboard.writeText(`${window.location.origin}/doc/${id}`);
    void MessagePlugin.success('链接已复制');
  };

  const handleFavorite = (id: string) => {
    setRowMenu(null);
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const showDeleteModal = (id: string) => {
    const doc = documents.find(item => item.id === id);
    setRowMenu(null);
    setDeleteTarget({ id, title: doc ? getDocTitle(doc) : '未命名文档' });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const res = await deleteDocument(deleteTarget.id);
    setDeleteTarget(null);
    if (res.code === 0) {
      void MessagePlugin.success('文档已删除');
      void loadDocuments();
    } else {
      void MessagePlugin.error(res.message || '删除失败');
    }
  };

  const activeRowDoc = rowMenu ? documents.find(doc => doc.id === rowMenu.docId) : null;

  return (
    <div className="home-page">
      <header className="home-header">
        <div className="home-header-title-group">
          <span className="home-header-title">主页</span>
          <span className="home-header-subtitle">文档工作台</span>
        </div>
        <div className="home-header-actions">
          <div className="home-search">
            <SearchIcon size="16px" />
            <Input
              borderless
              clearable
              value={query}
              placeholder="搜索标题、所有者"
              onChange={value => setQuery(String(value))}
            />
          </div>
          <button type="button" className="header-icon-btn" title="联系人">
            <UserIcon size="16px" />
          </button>
          <button type="button" className="header-icon-btn" title="通知">
            <NotificationIcon size="16px" />
          </button>
          <button type="button" className="header-icon-btn" title="应用">
            <AppIcon size="16px" />
          </button>
          <div className="user-avatar">{CURRENT_USER.charAt(0)}</div>
        </div>
      </header>

      <div className="home-content">
        <section className="action-bar" aria-label="快捷操作">
          <button type="button" className="action-card" onClick={() => void handleCreate()}>
            <span className="action-card-icon icon-create">
              <FileAddIcon size="18px" />
            </span>
            <span className="action-card-text">
              <span className="action-card-name">新建文档</span>
              <span className="action-card-desc">空白页、标题和正文自动保存</span>
            </span>
          </button>

          <button type="button" className="action-card" onClick={handleUploadClick}>
            <span className="action-card-icon icon-upload">
              <UploadIcon size="18px" />
            </span>
            <span className="action-card-text">
              <span className="action-card-name">上传导入</span>
              <span className="action-card-desc">本地文本快速转为文档</span>
            </span>
          </button>

          <button type="button" className="action-card" onClick={() => setTemplateDialogVisible(true)}>
            <span className="action-card-icon icon-template">
              <TemplateIcon size="18px" />
            </span>
            <span className="action-card-text">
              <span className="action-card-name">模板库</span>
              <span className="action-card-desc">从保存的模板创建文档</span>
            </span>
          </button>
          <input ref={fileInputRef} type="file" accept=".txt,.md,.csv,.log" hidden onChange={handleImportFile} />
        </section>

        <div className="tabs-bar">
          <div className="tabs-left">
            {TABS.map((tab, i) => (
              <button
                key={tab}
                type="button"
                className={`tab-item${activeTab === i ? ' active' : ''}`}
                onClick={() => setActiveTab(i)}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="tabs-right">
            <button
              type="button"
              className="tab-action-btn"
              onClick={() => setSortKey(sortKey === 'updated_at' ? 'created_at' : 'updated_at')}
            >
              <FilterIcon size="13px" />
              {sortKey === 'updated_at' ? '按最近访问' : '按创建时间'}
            </button>
            <button
              type="button"
              className="tab-action-btn"
              onClick={() => setSortKey(sortKey === 'title' ? 'updated_at' : 'title')}
            >
              <ComponentGridIcon size="13px" />
              {sortKey === 'title' ? '默认排序' : '按标题排序'}
            </button>
            <div className="view-toggle" role="group" aria-label="视图切换">
              <button
                type="button"
                className={viewMode === 'list' ? 'active' : ''}
                title="列表"
                onClick={() => setViewMode('list')}
              >
                <ViewListIcon size="14px" />
              </button>
              <button
                type="button"
                className={viewMode === 'grid' ? 'active' : ''}
                title="宫格"
                onClick={() => setViewMode('grid')}
              >
                <ComponentGridIcon size="14px" />
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="doc-loading">
            <Loading loading size="medium" text="加载中..." />
          </div>
        ) : visibleDocs.length === 0 ? (
          <div className="doc-empty">
            <div className="doc-empty-icon">
              <FileAddIcon size="48px" />
            </div>
            <p>{query || activeTab === 3 ? '没有匹配的文档' : '暂无文档'}</p>
            <Button theme="primary" onClick={() => void handleCreate()}>
              创建第一个文档
            </Button>
          </div>
        ) : viewMode === 'list' ? (
          <table className="doc-table">
            <thead>
              <tr>
                <th style={{ width: '42%' }}>标题</th>
                <th style={{ width: '18%' }}>位置</th>
                <th style={{ width: '14%' }}>所有者</th>
                <th style={{ width: '13%' }}>创建时间</th>
                <th style={{ width: '13%' }}>最近访问</th>
                <th style={{ width: 48 }} />
              </tr>
            </thead>
            <tbody>
              {visibleDocs.map(doc => (
                <tr
                  key={doc.id}
                  onClick={() => navigate(`/doc/${doc.id}`)}
                  onContextMenu={event => openRowMenu(event, doc.id)}
                >
                  <td className="col-title">
                    <span className="doc-type-icon">{doc.icon || '📄'}</span>
                    <span className="doc-title-text">{getDocTitle(doc)}</span>
                    {favorites.has(doc.id) && <span className="doc-favorite-mark">收藏</span>}
                  </td>
                  <td className="col-location">我的文档库</td>
                  <td className="col-owner">
                    <span className="owner-avatar">{doc.author?.charAt(0) || CURRENT_USER.charAt(0)}</span>
                    <span>{doc.author || CURRENT_USER}</span>
                  </td>
                  <td className="col-time">{formatDate(doc.created_at)}</td>
                  <td className="col-time">{formatDate(doc.updated_at)}</td>
                  <td className="col-actions">
                    <button
                      type="button"
                      className="doc-row-more"
                      onClick={event => openRowMenu(event, doc.id)}
                      title="更多"
                    >
                      <EllipsisIcon size="16px" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="doc-grid">
            {visibleDocs.map(doc => (
              <article
                key={doc.id}
                className="doc-grid-card"
                onClick={() => navigate(`/doc/${doc.id}`)}
                onContextMenu={event => openRowMenu(event, doc.id)}
              >
                <div className="doc-grid-card__preview">
                  <span>{doc.icon || '📄'}</span>
                </div>
                <div className="doc-grid-card__body">
                  <div className="doc-grid-card__title">{getDocTitle(doc)}</div>
                  <div className="doc-grid-card__meta">{formatDate(doc.updated_at)} 更新</div>
                </div>
                <button
                  type="button"
                  className="doc-grid-card__more"
                  onClick={event => openRowMenu(event, doc.id)}
                  title="更多"
                >
                  <EllipsisIcon size="16px" />
                </button>
              </article>
            ))}
          </div>
        )}
      </div>

      {rowMenu && activeRowDoc && (
        <div ref={rowMenuRef} className="row-context-menu" style={{ left: rowMenu.x, top: rowMenu.y }}>
          <button className="rcm-item" type="button" onClick={() => void handleCopyLink(rowMenu.docId)}>
            <span className="rcm-icon">🔗</span>复制链接
          </button>
          <button className="rcm-item" type="button" onClick={() => void handleDuplicate(rowMenu.docId)}>
            <span className="rcm-icon">⧉</span>创建副本
          </button>
          <button className="rcm-item" type="button" onClick={() => handleFavorite(rowMenu.docId)}>
            <span className="rcm-icon">{favorites.has(rowMenu.docId) ? '★' : '☆'}</span>
            {favorites.has(rowMenu.docId) ? '取消收藏' : '收藏'}
          </button>
          <button
            className="rcm-item"
            type="button"
            onClick={() => {
              setRowMenu(null);
              navigate(`/doc/${rowMenu.docId}`);
            }}
          >
            <span className="rcm-icon">↗</span>打开
          </button>
          <div className="rcm-divider" />
          <button className="rcm-item rcm-danger" type="button" onClick={() => showDeleteModal(rowMenu.docId)}>
            <span className="rcm-icon">⌫</span>删除
          </button>
        </div>
      )}

      <Dialog
        visible={templateDialogVisible}
        destroyOnClose
        header="模板库"
        width={520}
        confirmBtn={null}
        cancelBtn="关闭"
        onClose={() => setTemplateDialogVisible(false)}
        onCancel={() => setTemplateDialogVisible(false)}
      >
        {templates.length === 0 ? (
          <div className="template-empty">
            还没有保存的模板。可以在文档右上角更多菜单中选择“保存为模板”。
          </div>
        ) : (
          <div className="template-list">
            {templates.map(template => (
              <button
                key={template.id}
                type="button"
                className="template-list-item"
                onClick={() => {
                  setTemplateDialogVisible(false);
                  void handleCreate(template);
                }}
              >
                <span className="template-list-item__icon">📄</span>
                <span>
                  <strong>{template.title || '未命名模板'}</strong>
                  <em>{formatDate(template.created_at)}</em>
                </span>
              </button>
            ))}
          </div>
        )}
      </Dialog>

      <Dialog
        visible={!!deleteTarget}
        destroyOnClose
        header={deleteTarget ? `删除“${deleteTarget.title}”？` : ''}
        cancelBtn="取消"
        confirmBtn={{ content: '删除', theme: 'danger' }}
        onClose={() => setDeleteTarget(null)}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleConfirmDelete()}
      >
        <p className="modal-desc" style={{ margin: 0 }}>
          删除后将从当前文档列表中移除，同时删除它的评论数据。此操作不能撤销。
        </p>
      </Dialog>
    </div>
  );
}
