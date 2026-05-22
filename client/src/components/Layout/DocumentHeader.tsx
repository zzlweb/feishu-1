import { useEffect, useRef, useState } from 'react';
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
  saveStatus: 'saved' | 'saving' | 'idle';
  readOnly: boolean;
  onReadOnlyChange: (readOnly: boolean) => void;
}

function displayTitle(doc: Document) {
  return doc.title?.trim() || '未命名文档';
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
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreMenuRef.current && e.target instanceof Node && !moreMenuRef.current.contains(e.target)) {
        setShowMoreMenu(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setSearchVisible(true);
      }
      if (e.key === 'Escape') {
        setShowMoreMenu(false);
        setSearchVisible(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', handleKey);
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

  const handleSearchInDocument = () => {
    const text = searchValue.trim();
    if (!text) return;
    const root = document.querySelector('.doc-page-workspace');
    const walker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT);
    let node: Node | null = walker.nextNode();
    while (node) {
      if (node.textContent?.toLowerCase().includes(text.toLowerCase())) {
        const parent = node.parentElement;
        parent?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        parent?.classList.add('doc-search-hit');
        window.setTimeout(() => parent?.classList.remove('doc-search-hit'), 1600);
        return;
      }
      node = walker.nextNode();
    }
    void MessagePlugin.info('未找到匹配内容');
  };

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
              <button type="button" className="bc-item" onClick={() => navigate('/')}>
                UIH
              </button>
              <span className="bc-sep">&gt;</span>
              <button type="button" className="bc-item" onClick={() => navigate('/')}>
                {doc.author || '我的空间'}
              </button>
              <span className="bc-sep">&gt;</span>
              <span className="bc-current">
                {displayTitle(doc)}
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
              <span className="header-meta-item header-meta-cloud">
                {saveStatus === 'saving' ? '保存中...' : '已保存到云端'}
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
                onEnter={handleSearchInDocument}
              />
            </div>
          )}

          <button type="button" className="btn-share" onClick={() => void handleShare()}>
            <Notes theme="outline" size={14} strokeWidth={3} fill="#ffffff" />
            分享
          </button>

          <button type="button" className="btn-edit-mode" onClick={() => onReadOnlyChange(!readOnly)}>
            <Edit theme="outline" size={14} strokeWidth={3} fill="#646a73" className="mode-icon" />
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

          <span className="header-right-divider" aria-hidden />

          <button type="button" className="header-icon-btn" title="搜索" onClick={() => setSearchVisible(v => !v)}>
            <Search theme="outline" size={18} strokeWidth={3} fill="#646a73" />
          </button>

          <button type="button" className="header-icon-btn header-add-circle-btn" title="新建子文档" onClick={handleCreateChild}>
            <Plus theme="outline" size={15} strokeWidth={2.5} fill="#646a73" />
          </button>

          <span className="header-right-divider" aria-hidden />

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
