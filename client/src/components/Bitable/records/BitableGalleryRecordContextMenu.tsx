import type { RefObject } from 'react';

export interface BitableGalleryRecordContextMenuProps {
  menuRef: RefObject<HTMLDivElement>;
  left: number;
  top: number;
  locked?: boolean;
  onInsertLeft: () => void;
  onInsertRight: () => void;
  onShare: () => void;
  onCopyLink: () => void;
  onDuplicate: () => void;
  onViewDetails: () => void;
  onAddComment: () => void;
  onDelete: () => void;
}

const MENU_WIDTH = 200;
const MENU_HEIGHT = 320;
const MARGIN = 8;

function clampPosition(left: number, top: number) {
  const viewportWidth = typeof window === 'undefined' ? left + MENU_WIDTH + MARGIN : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? top + MENU_HEIGHT + MARGIN : window.innerHeight;
  return {
    left: Math.max(MARGIN, Math.min(left, viewportWidth - MENU_WIDTH - MARGIN)),
    top: Math.max(MARGIN, Math.min(top, viewportHeight - MENU_HEIGHT - MARGIN)),
  };
}

function MenuIcon({ children }: { children: React.ReactNode }) {
  return <span className="universe-icon icon">{children}</span>;
}

export function BitableGalleryRecordContextMenu({
  menuRef,
  left,
  top,
  locked = false,
  onInsertLeft,
  onInsertRight,
  onShare,
  onCopyLink,
  onDuplicate,
  onViewDetails,
  onAddComment,
  onDelete,
}: BitableGalleryRecordContextMenuProps) {
  const pos = clampPosition(left, top);
  const run = (handler: () => void) => {
    if (locked) return;
    handler();
  };

  return (
    <div
      ref={menuRef}
      id="bitable-contextmenu"
      className="b-menu bitable-noselect white J-bitable-container bitable-hover-scrollbar-sm bitable-contextmenu base-grid-cell-menu--portal"
      style={{ left: pos.left, top: pos.top, width: MENU_WIDTH, maxHeight: `calc(100vh - ${MARGIN * 2}px)`, overflowY: 'auto' }}
      onMouseDown={event => event.stopPropagation()}
    >
      <ul className="ud__menu ud__menu-root ud__menu-vertical ud-scrollbar" dir="ltr" role="menu" tabIndex={0} data-menu-list="true">
        <li className="b-menu__item" role="menuitem" onClick={() => run(onInsertLeft)}>
          <MenuIcon>
            <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" data-icon="InsertLeftOutlined">
              <path d="M1.087 12.873a.8.8 0 0 1 0-1.28l5.866-4.4a.8.8 0 0 1 1.28.64v3.4h14a1 1 0 1 1 0 2h-14v3.4a.8.8 0 0 1-1.28.64l-5.866-4.4Z" fill="currentColor" />
            </svg>
          </MenuIcon>
          向左插入记录
        </li>
        <li className="b-menu__item" role="menuitem" onClick={() => run(onInsertRight)}>
          <MenuIcon>
            <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" data-icon="InsertRightOutlined">
              <path d="M23.147 12.64a.8.8 0 0 0 0-1.28l-5.867-4.4A.8.8 0 0 0 16 7.6V11H2a1 1 0 0 0 0 2h14v3.4a.8.8 0 0 0 1.28.64l5.867-4.4Z" fill="currentColor" />
            </svg>
          </MenuIcon>
          向右插入记录
        </li>
        <li className="ud__menu-item-divider b-menu__divider" role="separator" />
        <li className="b-menu__item" role="menuitem" onClick={() => run(onShare)}>
          <MenuIcon>
            <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" data-icon="ForwardOutlined">
              <path d="m12.016 7.51-.01-4.093c-.002-.891 1.07-1.343 1.702-.714 2.167 2.161 5.869 5.855 7.923 7.916a1.948 1.948 0 0 1-.003 2.762c-2.044 2.05-5.75 5.75-7.92 7.915-.63.63-1.704.178-1.702-.714l.01-4.067h-1.028c-3.989 0-7.01.802-8.845 3.158-.372.478-1.143.18-1.143-.425v-.402c0-6.16 4.932-11.335 11.016-11.335Zm0 2.006c-3.945 0-7.602 2.923-8.514 6.348 2.048-1.225 5.581-1.36 8.488-1.36H14V18l5.74-5.29a1 1 0 0 0 .03-1.443L14 5.501v4l-1.984.015Z" fill="currentColor" />
            </svg>
          </MenuIcon>
          分享此记录
        </li>
        <li className="b-menu__item" role="menuitem" onClick={() => run(onCopyLink)}>
          <MenuIcon>
            <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" data-icon="GlobalLinkOutlined">
              <path d="M18.849 2.699a5.037 5.037 0 0 0-7.1.97L8.97 7.372a4.784 4.784 0 0 0 .957 6.699l.972.729a1 1 0 0 0 1.2-1.6l-.972-.73a2.784 2.784 0 0 1-.557-3.898l2.777-3.703a3.037 3.037 0 1 1 4.8 3.72l-1.429 1.786a1 1 0 1 0 1.562 1.25l1.43-1.788a5.037 5.037 0 0 0-.862-7.138Z" fill="currentColor" />
              <path d="M5.152 21.301a5.037 5.037 0 0 0 7.1-.97l2.777-3.703a4.784 4.784 0 0 0-.957-6.699L13.1 9.2a1 1 0 0 0-1.2 1.6l.973.73a2.784 2.784 0 0 1 .556 3.898l-2.777 3.703a3.037 3.037 0 1 1-4.8-3.72l1.429-1.786a1 1 0 0 0-1.562-1.25l-1.43 1.787a5.037 5.037 0 0 0 .863 7.14Z" fill="currentColor" />
            </svg>
          </MenuIcon>
          复制记录链接
        </li>
        <li className="ud__menu-item-divider b-menu__divider" role="separator" />
        <li className="b-menu__item" role="menuitem" onClick={() => run(onDuplicate)}>
          <MenuIcon>
            <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" data-icon="CopyOutlined">
              <path d="M9 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v12a1 1 0 1 1-2 0V4h-9a1 1 0 0 1-1-1Z" fill="currentColor" />
              <path d="M5 6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H5Zm0 2h10v12H5V8Z" fill="currentColor" />
            </svg>
          </MenuIcon>
          复制记录
        </li>
        <li className="b-menu__item" role="menuitem" onClick={() => run(onViewDetails)}>
          <MenuIcon>
            <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" data-icon="MultipleWindowsCenterOutlined">
              <path d="M18 9a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9Z" fill="currentColor" />
              <path d="M1 19a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v14ZM21 5v14H3V5h18Z" fill="currentColor" />
            </svg>
          </MenuIcon>
          查看详情
        </li>
        <li className="b-menu__item" role="menuitem" onClick={() => run(onAddComment)}>
          <MenuIcon>
            <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" data-icon="AddCommentOutlined">
              <path d="M7 11a1 1 0 0 1 1-1h8a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1Z" fill="currentColor" />
              <path d="M2 5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v11.5a2 2 0 0 1-2 2h-3.812a.5.5 0 0 0-.33.124l-2.541 2.224a2 2 0 0 1-2.634 0l-2.542-2.224a.5.5 0 0 0-.329-.124H4a2 2 0 0 1-2-2V5Zm2 0v11.5h3.812a2.5 2.5 0 0 1 1.646.619L12 19.343l2.542-2.224a2.5 2.5 0 0 1 1.646-.619H20V5H4Z" fill="currentColor" />
            </svg>
          </MenuIcon>
          添加评论
        </li>
        <li className="ud__menu-item-divider b-menu__divider" role="separator" />
        <li className="b-menu__item" role="menuitem" onClick={() => run(onDelete)}>
          <MenuIcon>
            <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" data-icon="DeleteTrashOutlined">
              <path d="M8 4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2h5a1 1 0 1 1 0 2h-1v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6H3a1 1 0 0 1 0-2h5ZM6 6v14h12V6H6Zm4 3a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1Zm4 0a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1Z" fill="currentColor" />
            </svg>
          </MenuIcon>
          删除记录
        </li>
      </ul>
    </div>
  );
}
