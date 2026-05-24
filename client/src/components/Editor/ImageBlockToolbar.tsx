import type { Editor } from '@tiptap/react';
import { MessagePlugin } from 'tdesign-react';
import { copyCurrentBlockLink } from './blockLink';
import { makeFeishuBlockId } from './feishuBlockId';

interface ImageBlockToolbarProps {
  editor: Editor;
  align: 'left' | 'center' | 'right';
  onAlignChange: (align: 'left' | 'center' | 'right') => void;
  onCaptionClick?: () => void;
  onCropClick?: () => void;
  isCropping?: boolean;
  documentId?: string;
  blockId?: string;
  onEnsureBlockId?: (blockId: string) => void;
}

function MenuIcon({ dataIcon, paths, iconClass = 'universe-icon' }: {
  dataIcon: string;
  paths: string[];
  iconClass?: string;
}) {
  return (
    <span className={iconClass}>
      <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" data-icon={dataIcon} aria-hidden>
        {paths.map((d, index) => (
          <path key={index} d={d} fill="currentColor" />
        ))}
      </svg>
    </span>
  );
}

function MenuItem({
  name,
  dataIcon,
  paths,
  iconClass = 'universe-icon',
  active = false,
  onClick,
}: {
  name: string;
  dataIcon: string;
  paths: string[];
  iconClass?: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={`panel-menu-item${active ? ' menu-item-actived' : ''}${name === 'comment' ? ' comment-item' : ''}`}
      data-name={name}
      onMouseDown={event => event.preventDefault()}
      onClick={onClick}
    >
      <div className="menu-item-content">
        <div className="menu-icon">
          <MenuIcon dataIcon={dataIcon} paths={paths} iconClass={iconClass} />
        </div>
        <div className="menu-item-main-box-wrapper">
          <div className="menu-item-main-box" />
        </div>
      </div>
    </div>
  );
}

function MenuDivider({ fullHeight = false }: { fullHeight?: boolean }) {
  return <div className={`menu-divider-item${fullHeight ? ' override-full-height' : ''}`} />;
}

const CROP_PATH = 'M6.667 2.533A.533.533 0 0 0 6.133 2H5.2a.533.533 0 0 0-.533.533v2.8h-2.8a.533.533 0 0 0-.534.534V6.8c0 .295.24.533.534.533h2.8V17.6c0 .59.477 1.067 1.067 1.067h11.601v2.8c0 .294.239.533.533.533h.934a.533.533 0 0 0 .533-.533v-2.8h2.799a.533.533 0 0 0 .533-.534V17.2a.533.533 0 0 0-.534-.533h-2.798v-8.8c0-.014 0-.028-.002-.04V6.4c0-.59-.477-1.067-1.066-1.067h-11.6v-2.8Zm10.666 14.134H6.668V7.333h10.667v9.334Z';
const CAPTION_PATHS = [
  'M19 3H5v18h5v2H5a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8h-2V3Z',
  'M8 7a1 1 0 0 0 0 2h8a1 1 0 1 0 0-2H8Zm-1 5.5a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1Zm13.328.55a1.5 1.5 0 0 1 2.122 2.121l-1.06 1.061-2.122-2.121 1.06-1.06Zm-2.121 2.121 2.121 2.122-4.982 4.982a1.417 1.417 0 0 1-.769.396l-1.89.314a.17.17 0 0 1-.196-.197l.336-1.882c.05-.28.185-.54.386-.74l4.994-4.995Z',
];
const ALIGN_LEFT = 'M2 4a1 1 0 0 1 1-1h18a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1Zm0 16a1 1 0 0 1 1-1h18a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1Zm1-9a1 1 0 1 0 0 2h9a1 1 0 1 0 0-2H3Z';
const ALIGN_CENTER = 'M2 4a1 1 0 0 1 1-1h18a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1Zm0 16a1 1 0 0 1 1-1h18a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1Zm6-9a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2H8Z';
const ALIGN_RIGHT = 'M2 4a1 1 0 0 1 1-1h18a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1Zm0 16a1 1 0 0 1 1-1h18a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1Zm10-9a1 1 0 1 0 0 2h9a1 1 0 1 0 0-2h-9Z';
const BLOCK_LINK = 'M4.15 1.7h14.894a2 2 0 0 1 2 2v2.014h-2V3.7H4.15v14.895h2.543v2H4.15a2 2 0 0 1-2-2V3.7a2 2 0 0 1 2-2Zm17.57 5.954c1.9 1.594 2.296 4.415.703 6.313l-.443.528a1 1 0 1 1-1.532-1.286l.443-.528c.81-.965.687-2.536-.456-3.495-1.142-.959-2.71-.808-3.521.158l-2.487 2.963c-.638.761-.552 2.019.374 2.795l.675.567A1 1 0 1 1 14.19 17.2l-.675-.567c-1.683-1.412-2.04-3.919-.62-5.612l2.487-2.963c1.592-1.899 4.439-2 6.339-.405Zm-5.697 13.942c-1.593 1.898-4.44 1.999-6.34.404-1.9-1.594-2.294-4.415-.702-6.313l.443-.527a1 1 0 1 1 1.532 1.285l-.443.528c-.81.966-.687 2.537.456 3.495 1.143.96 2.711.808 3.521-.158l2.487-2.963c.639-.761.552-2.018-.373-2.795l-.676-.566a1 1 0 1 1 1.286-1.533l.675.567c1.683 1.412 2.04 3.92.62 5.613l-2.486 2.963Z';
const SHARE_TEXT = 'M21.5 5c0-.552-.473-1-1.055-1H3.555C2.974 4 2.5 4.448 2.5 5s.473 1 1.056 1h16.889c.582 0 1.055-.448 1.055-1Zm-9.617 6c.647 0 1.172.448 1.172 1s-.525 1-1.172 1h-8.21c-.648 0-1.173-.448-1.173-1s.525-1 1.173-1h8.21Zm-3.167 7c.648 0 1.173.448 1.173 1s-.525 1-1.173 1H3.673c-.648 0-1.173-.448-1.173-1s.525-1 1.173-1h5.043Zm9.077-8.242a1 1 0 0 1 1.415 0l3.535 3.535a1 1 0 0 1 0 1.415l-3.535 3.535a1 1 0 0 1-1.415-1.414l1.822-1.822c-1.819.07-3.162.64-4.065 1.543-.965.965-1.55 2.435-1.55 4.45a1 1 0 1 1-2 0c0-2.403.706-4.434 2.136-5.864 1.356-1.356 3.251-2.06 5.491-2.13l-1.834-1.834a1 1 0 0 1 0-1.414Z';
const COMMENT_PATHS = [
  'M7 11a1 1 0 0 1 1-1h8a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1Z',
  'M2 5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v11.5a2 2 0 0 1-2 2h-3.812a.5.5 0 0 0-.33.124l-2.541 2.224a2 2 0 0 1-2.634 0l-2.542-2.224a.5.5 0 0 0-.329-.124H4a2 2 0 0 1-2-2V5Zm2 0v11.5h3.812a2.5 2.5 0 0 1 1.646.619L12 19.343l2.542-2.224a2.5 2.5 0 0 1 1.646-.619H20V5H4Z',
];

export default function ImageBlockToolbar({
  editor,
  align,
  onAlignChange,
  onCaptionClick,
  onCropClick,
  isCropping = false,
  documentId,
  blockId,
  onEnsureBlockId,
}: ImageBlockToolbarProps) {
  const handleCopyLink = () => {
    if (blockId && onEnsureBlockId) onEnsureBlockId(blockId);
    void copyCurrentBlockLink(editor).then(url => {
      if (url) MessagePlugin.success('已复制块链接');
    });
  };

  const handleShareLink = async () => {
    if (blockId && onEnsureBlockId) onEnsureBlockId(blockId);
    const url = await copyCurrentBlockLink(editor);
    if (!url) return;
    if (navigator.share) {
      await navigator.share({ title: document.title, url });
      return;
    }
    MessagePlugin.success('已复制分享链接');
  };

  const openCommentSidebar = () => {
    const resolvedBlockId = blockId || makeFeishuBlockId('image');
    onEnsureBlockId?.(resolvedBlockId);
    window.dispatchEvent(new CustomEvent('feishu-open-comment-sidebar', {
      detail: {
        documentId: documentId || (editor as any).__documentId,
        blockId: resolvedBlockId,
        threadId: resolvedBlockId,
        anchorType: 'block',
      },
    }));
  };

  return (
    <div className="docx-menu-container overlay-container block-toolbar__overlay slide-top" contentEditable={false} data-no-marquee-selection="true">
      <MenuItem
        name="Crop"
        dataIcon="CropOutlined"
        paths={[CROP_PATH]}
        iconClass="universe-icon menu_ud_icon"
        active={isCropping}
        onClick={() => onCropClick?.()}
      />
      <MenuDivider />
      <MenuItem
        name="caption"
        dataIcon="FeedbackOutlined"
        paths={CAPTION_PATHS}
        iconClass="universe-icon menu_ud_icon"
        onClick={() => onCaptionClick?.()}
      />
      <MenuDivider />
      <MenuItem
        name="align left"
        dataIcon="LeftAlignmentOutlined"
        paths={[ALIGN_LEFT]}
        active={align === 'left'}
        onClick={() => onAlignChange('left')}
      />
      <MenuItem
        name="align center"
        dataIcon="CenterAlignmentOutlined"
        paths={[ALIGN_CENTER]}
        active={align === 'center'}
        onClick={() => onAlignChange('center')}
      />
      <MenuItem
        name="align right"
        dataIcon="RightAlignmentOutlined"
        paths={[ALIGN_RIGHT]}
        active={align === 'right'}
        onClick={() => onAlignChange('right')}
      />
      <MenuDivider fullHeight />
      <MenuItem
        name="copyAnchorLink"
        dataIcon="BlocklinkOutlined"
        paths={[BLOCK_LINK]}
        iconClass="universe-icon menu_ud_icon color-b-500"
        onClick={handleCopyLink}
      />
      <MenuItem
        name="shareTextLink"
        dataIcon="SharewordsOutlined"
        paths={[SHARE_TEXT]}
        iconClass="universe-icon menu_ud_icon color-b-500"
        onClick={() => void handleShareLink()}
      />
      <MenuDivider />
      <MenuItem
        name="comment"
        dataIcon="AddCommentOutlined"
        paths={COMMENT_PATHS}
        iconClass="universe-icon menu_ud_icon"
        onClick={openCommentSidebar}
      />
    </div>
  );
}
