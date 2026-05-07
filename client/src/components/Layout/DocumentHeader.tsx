import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessagePlugin } from 'tdesign-react';
import {
  FileIcon,
  EditIcon,
  NotificationIcon,
  EllipsisIcon,
  SearchIcon,
  AddIcon,
  SecuredIcon,
} from 'tdesign-icons-react';
import { wrapIcon } from '../../icons/wrap';
import { IconHomeOutlined, IconChatPinOutlined } from '../../icons/feishuDoc';
import { deleteDocument, duplicateDocument, saveAsTemplate } from '../../api/documents';
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

export default function DocumentHeader({
  doc,
  saveStatus,
  readOnly,
  onReadOnlyChange,
}: DocumentHeaderProps) {
  const navigate = useNavigate();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    void MessagePlugin.success('分享链接已复制到剪贴板！');
  };

  const handleDelete = async () => {
    if (confirm('确定删除此文档？删除后不可恢复。')) {
      await deleteDocument(doc.id);
      navigate('/');
    }
  };

  const handleSaveAsTemplate = async () => {
    await saveAsTemplate(doc.id);
    void MessagePlugin.success('已保存为模板！');
    setShowMoreMenu(false);
  };

  const handleDuplicate = async () => {
    const res = await duplicateDocument(doc.id);
    if (res.code === 0 && res.data) {
      navigate(`/doc/${res.data.id}`);
    }
    setShowMoreMenu(false);
  };

  return (
    <header className="doc-page-header">
      <div className="header-row-primary">
        <div className="header-left">
          <button className="header-icon-btn" type="button" onClick={() => navigate('/')} title="首页">
            <IconHomeOutlined size={20} color="currentColor" />
          </button>
          <span className="header-left-divider" />
          <div>
            <nav className="breadcrumb">
              <button type="button" className="bc-item" onClick={() => navigate('/')}>
                UIH
              </button>
              <span className="bc-sep">&gt;</span>
              <button type="button" className="bc-item" onClick={() => navigate('/')}>
                {doc.author}
              </button>
              <span className="bc-sep">&gt;</span>
              <span className="bc-current">
                {doc.title || '未命名文档'}
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
                {saveStatus === 'saving' ? '保存中…' : '已经保存到云端'}
              </span>
            </div>
          </div>
        </div>

        <div className="header-right">
          <button type="button" className="btn-share" onClick={handleShare}>
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
                <button type="button" className="more-menu-item" onClick={handleSaveAsTemplate}>
                  保存为模板
                </button>
                <div className="more-menu-divider" />
                <button type="button" className="more-menu-item danger" onClick={handleDelete}>
                  删除文档
                </button>
              </div>
            )}
          </div>

          <span className="header-right-divider" aria-hidden />

          <button type="button" className="header-icon-btn" title="搜索">
            <Search theme="outline" size={18} strokeWidth={3} fill="#646a73" />
          </button>

          <button type="button" className="header-icon-btn header-add-circle-btn" title="新建页面">
            <Plus theme="outline" size={15} strokeWidth={2.5} fill="#646a73" />
          </button>

          <span className="header-right-divider" aria-hidden />

          <div className="user-avatar">{doc.author.charAt(0)}</div>
        </div>
      </div>
    </header>
  );
}
