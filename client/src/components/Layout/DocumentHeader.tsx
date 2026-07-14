import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, Input, MessagePlugin } from 'tdesign-react';
import {
  AddIcon,
  EditIcon,
  EllipsisIcon,
  FileIcon,
  NotificationIcon,
  SearchIcon,
  SecuredIcon,
} from 'tdesign-icons-react';
import { wrapIcon } from '../../icons/wrap';
import { IconChatPinOutlined, IconHomeOutlined } from '../../icons/feishuDoc';
import { createDocument, deleteDocument, duplicateDocument, saveAsTemplate } from '../../api/documents';
import type { Document } from '../../types';

const Notes = wrapIcon(FileIcon);
const Edit = wrapIcon(EditIcon);
const BellRing = wrapIcon(NotificationIcon);
const More = wrapIcon(EllipsisIcon);
const Search = wrapIcon(SearchIcon);
const Plus = wrapIcon(AddIcon);
const Protect = wrapIcon(SecuredIcon);

export interface DocumentHeaderProps {
  doc: Document;
  saveStatus: 'saved' | 'saving' | 'error' | 'idle';
  readOnly: boolean;
  onReadOnlyChange: (readOnly: boolean) => void;
}

function displayTitle(doc: Document) {
  return doc.title?.trim() || '未命名文档';
}

interface DocumentSearchMatch {
  node: Text;
  parent: HTMLElement;
}

function clearDocumentSearchHighlight() {
  document.querySelectorAll('.doc-search-hit').forEach(element => {
    element.classList.remove('doc-search-hit');
  });
}

function collectDocumentSearchMatches(query: string): DocumentSearchMatch[] {
  const workspace = document.querySelector('.doc-page-workspace');
  const root = workspace?.querySelector('.ProseMirror') || workspace;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!root || !normalizedQuery) return [];

  const matches: DocumentSearchMatch[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const textNode = node as Text;
    const parent = textNode.parentElement;
    if (parent && !parent.closest('script, style, [hidden], [aria-hidden="true"]')) {
      const content = textNode.data.toLocaleLowerCase();
      let offset = content.indexOf(normalizedQuery);
      while (offset >= 0) {
        matches.push({ node: textNode, parent });
        offset = content.indexOf(normalizedQuery, offset + normalizedQuery.length);
      }
    }
    node = walker.nextNode();
  }
  return matches;
}

export default function DocumentHeader({
  doc,
  saveStatus,
  readOnly,
  onReadOnlyChange,
}: DocumentHeaderProps) {
  const navigate = useNavigate();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [searchResultCount, setSearchResultCount] = useState(0);
  const [searchResultIndex, setSearchResultIndex] = useState(-1);
  const searchResultIndexRef = useRef(-1);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreMenuRef.current && e.target instanceof Node && !moreMenuRef.current.contains(e.target)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
    };
  }, []);

  const handleShare = async () => {
    await navigator.clipboard.writeText(window.location.href);
    void MessagePlugin.success('分享链接已复制');
  };

  const handleDelete = async () => {
    const res = await deleteDocument(doc.id);
    setDeleteVisible(false);
    if (res.code === 0) {
      void MessagePlugin.success('文档已删除');
      navigate('/');
    } else {
      void MessagePlugin.error(res.message || '删除失败');
    }
  };

  const handleSaveAsTemplate = async () => {
    const res = await saveAsTemplate(doc.id);
    setShowMoreMenu(false);
    if (res.code === 0) {
      void MessagePlugin.success('已保存为模板');
    } else {
      void MessagePlugin.error(res.message || '保存模板失败');
    }
  };

  const handleDuplicate = async () => {
    const res = await duplicateDocument(doc.id);
    setShowMoreMenu(false);
    if (res.code === 0 && res.data) {
      navigate(`/doc/${res.data.id}`);
    } else {
      void MessagePlugin.error(res.message || '创建副本失败');
    }
  };

  const handleCreateChild = async () => {
    const res = await createDocument({
      title: '未命名子文档',
      author: doc.author,
      parent_id: doc.id,
    });
    if (res.code === 0 && res.data) {
      navigate(`/doc/${res.data.id}`);
    } else {
      void MessagePlugin.error(res.message || '创建子文档失败');
    }
  };

  const navigateSearchResult = useCallback((direction: 1 | -1) => {
    const matches = collectDocumentSearchMatches(searchValue);
    setSearchResultCount(matches.length);
    clearDocumentSearchHighlight();
    if (matches.length === 0) {
      searchResultIndexRef.current = -1;
      setSearchResultIndex(-1);
      if (searchValue.trim()) void MessagePlugin.info('未找到匹配内容');
      return;
    }

    const current = searchResultIndexRef.current;
    const next = current < 0
      ? (direction > 0 ? 0 : matches.length - 1)
      : (current + direction + matches.length) % matches.length;
    const match = matches[next];
    searchResultIndexRef.current = next;
    setSearchResultIndex(next);
    match.parent.classList.add('doc-search-hit');
    match.parent.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [searchValue]);

  useEffect(() => {
    clearDocumentSearchHighlight();
    searchResultIndexRef.current = -1;
    setSearchResultIndex(-1);
    setSearchResultCount(searchVisible ? collectDocumentSearchMatches(searchValue).length : 0);
    return clearDocumentSearchHighlight;
  }, [doc.id, searchValue, searchVisible]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setSearchVisible(true);
        return;
      }
      if (!searchVisible) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        setShowMoreMenu(false);
        setSearchVisible(false);
        return;
      }
      if (event.key === 'Enter' || event.key === 'F3' || event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const isPrevious = event.shiftKey || event.key === 'ArrowUp';
        navigateSearchResult(isPrevious ? -1 : 1);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [navigateSearchResult, searchVisible]);

  return (
    <header className="doc-page-header">
      <div className="header-row-primary">
        <div className="header-left">
          <button className="header-icon-btn" type="button" onClick={() => navigate('/')} title="主页">
            <IconHomeOutlined size={20} color="currentColor" />
          </button>
          <span className="header-left-divider" />
          <div className="header-title-stack">
            <nav className="breadcrumb">
              <button type="button" className="bc-item bc-home-item" onClick={() => navigate('/')}>
                UIH
              </button>
              <span className="bc-sep bc-sep-root">&gt;</span>
              <button type="button" className="bc-item bc-space-item" onClick={() => navigate('/')}>
                {doc.author || '我的空间'}
              </button>
              <span className="bc-sep bc-sep-current">&gt;</span>
              <span className="bc-current">
                <span className="bc-current-title">{displayTitle(doc)}</span>
                <button type="button" className="header-pin-btn" title="置顶">
                  <IconChatPinOutlined size={16} color="currentColor" />
                </button>
              </span>
            </nav>
            <div className="header-row-meta">
              <span className="header-meta-item">
                <Protect theme="outline" size={14} strokeWidth={3} fill="#8f959e" />
                内部信息
              </span>
              <span className="header-meta-vsep" aria-hidden />
              <span
                className={`header-meta-item header-meta-cloud${saveStatus === 'error' ? ' is-error' : ''}`}
                title={saveStatus === 'error' ? '保存失败，请检查网络后继续编辑以重试' : undefined}
              >
                {saveStatus === 'saving'
                  ? '保存中...'
                  : saveStatus === 'error'
                    ? '保存失败'
                    : '已保存到云端'}
              </span>
            </div>
          </div>
        </div>

        <div className="header-right">
          {searchVisible && (
            <div className="doc-header-search">
              <Input
                autofocus
                clearable
                size="small"
                value={searchValue}
                placeholder="搜索正文"
                onChange={value => setSearchValue(String(value))}
              />
              <span className="doc-header-search__count" aria-live="polite">
                {searchResultIndex >= 0 ? searchResultIndex + 1 : 0}/{searchResultCount}
              </span>
              <button
                type="button"
                className="doc-header-search__nav"
                aria-label="上一个搜索结果"
                disabled={searchResultCount === 0}
                onClick={() => navigateSearchResult(-1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="doc-header-search__nav"
                aria-label="下一个搜索结果"
                disabled={searchResultCount === 0}
                onClick={() => navigateSearchResult(1)}
              >
                ↓
              </button>
            </div>
          )}

          <button type="button" className="btn-share" onClick={() => void handleShare()}>
            <Notes theme="outline" size={14} strokeWidth={3} fill="#ffffff" />
            <span className="header-btn-label">分享</span>
          </button>

          <button type="button" className="btn-edit-mode" onClick={() => onReadOnlyChange(!readOnly)}>
            <Edit theme="outline" size={14} strokeWidth={3} fill="#646a73" className="mode-icon" />
            <span className="header-btn-label">{readOnly ? '阅读' : '编辑'}</span>
            <span className="mode-arrow">▾</span>
          </button>

          <button type="button" className="header-icon-btn header-notification-btn" title="通知">
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
                <button type="button" className="more-menu-item" onClick={handleDuplicate}>
                  创建副本
                </button>
                <button type="button" className="more-menu-item" onClick={() => void handleSaveAsTemplate()}>
                  保存为模板
                </button>
                <button type="button" className="more-menu-item" onClick={() => void handleShare()}>
                  复制分享链接
                </button>
                <div className="more-menu-divider" />
                <button
                  type="button"
                  className="more-menu-item danger"
                  onClick={() => {
                    setShowMoreMenu(false);
                    setDeleteVisible(true);
                  }}
                >
                  删除文档
                </button>
              </div>
            )}
          </div>

          <span className="header-right-divider header-search-divider" aria-hidden />

          <button type="button" className="header-icon-btn header-search-btn" title="搜索" onClick={() => setSearchVisible(v => !v)}>
            <Search theme="outline" size={18} strokeWidth={3} fill="#646a73" />
          </button>

          <button type="button" className="header-icon-btn header-add-circle-btn header-create-btn" title="新建子文档" onClick={handleCreateChild}>
            <Plus theme="outline" size={15} strokeWidth={2.5} fill="#646a73" />
          </button>

          <span className="header-right-divider header-avatar-divider" aria-hidden />

          <div className="user-avatar">{(doc.author || '我').charAt(0)}</div>
        </div>
      </div>

      <Dialog
        visible={deleteVisible}
        header={`删除“${displayTitle(doc)}”？`}
        cancelBtn="取消"
        confirmBtn={{ content: '删除', theme: 'danger' }}
        onClose={() => setDeleteVisible(false)}
        onCancel={() => setDeleteVisible(false)}
        onConfirm={() => void handleDelete()}
      >
        删除后会同时删除相关评论，且不能撤销。
      </Dialog>
    </header>
  );
}
