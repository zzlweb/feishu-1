import React, { useCallback, forwardRef } from 'react';
import { DOC_TITLE_CATALOGUE_ID, type HeadingItem } from '../../types';
import { resolveBlockElement } from '../Editor/blocks/blockDom';
import './Layout.less';

interface SidebarProps {
  /** 已 trim 的文档标题；空则不渲染目录中的标题行 */
  documentTitle: string;
  headings: HeadingItem[];
  /** 当前与编辑焦点/光标所在章节对应的目录项 */
  activeId: string | null;
  /** 用户点击目录跳转时同步高亮 */
  onTocItemActivate: (id: string) => void;
  collapsed: boolean;
  onToggle: () => void;
  /** 折叠中的标题 id 集合 */
  collapsedHeadingIds?: Set<string>;
  /** 点击目录项折叠指示器时切换 */
  onToggleHeadingCollapse?: (headingId: string) => void;
}

function CatalogueToggleIcon({ mirrored }: { mirrored?: boolean }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={`catalogue-collapse-btn__icon${mirrored ? ' catalogue-collapse-btn__icon--mirrored' : ''}`}
    >
      <path
        d="M7.987 13.228 3.76 9l4.457-4.458.627-.63A.75.75 0 1 0 7.78 2.858l-.498.5L2.17 8.47a.75.75 0 0 0 0 1.06l4.854 4.855.759.76a.75.75 0 0 0 1.062-1.057l-.857-.86Z"
        fill="currentColor"
      />
      <path
        d="M14.668 13.228 10.44 9l4.457-4.458.627-.63a.75.75 0 1 0-1.064-1.056l-.498.5L8.85 8.47a.75.75 0 0 0 0 1.06l4.854 4.855.758.76a.75.75 0 0 0 1.062-1.057l-.856-.86Z"
        fill="currentColor"
      />
    </svg>
  );
}

const Sidebar = forwardRef<HTMLDivElement, SidebarProps>(function Sidebar(
  {
    documentTitle,
    headings,
    activeId,
    onTocItemActivate,
    collapsed,
    onToggle,
    collapsedHeadingIds,
    onToggleHeadingCollapse,
  }: SidebarProps,
  ref: React.ForwardedRef<HTMLDivElement>,
) {
  const scrollToDocumentTitle = useCallback(() => {
    document.querySelector('.editor-title-input')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    onTocItemActivate(DOC_TITLE_CATALOGUE_ID);
  }, [onTocItemActivate]);

  const scrollToHeading = useCallback(
    (id: string) => {
      const target = resolveBlockElement(document, id);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      onTocItemActivate(id);
    },
    [onTocItemActivate],
  );

  return (
    <div ref={ref} className={`catalogue-aside${collapsed ? ' catalogue-aside--collapsed' : ''}`}>
      <div className="catalogue-inner">
        <button
          type="button"
          className="catalogue-collapse-btn"
          onClick={onToggle}
          title={collapsed ? '展开目录' : '收起目录'}
        >
          {collapsed ? <CatalogueToggleIcon mirrored /> : <CatalogueToggleIcon />}
        </button>

        {!collapsed && (
          <div className="catalogue__scroller">
            <ul className="catalogue__list">
              {documentTitle.length > 0 && (
                <li
                  key={DOC_TITLE_CATALOGUE_ID}
                  className={`catalogue__list-item catalogue__list-item--doc-title${activeId === DOC_TITLE_CATALOGUE_ID ? ' active' : ''}`}
                  data-id={DOC_TITLE_CATALOGUE_ID}
                >
                  <a
                    href="#"
                    className="catalogue__item-title"
                    onClick={e => {
                      e.preventDefault();
                      scrollToDocumentTitle();
                    }}
                  >
                    <span className="catalogue__item-text" dir="auto">
                      {documentTitle}
                    </span>
                  </a>
                </li>
              )}
              {headings.map((heading, idx) => {
                // Determine if this heading has children (deeper-level headings after it)
                const hasChildren = idx < headings.length - 1 && headings[idx + 1].level > heading.level;
                const isCollapsed = collapsedHeadingIds?.has(heading.id) ?? false;

                // Check if this heading should be hidden because a parent heading is collapsed
                let hidden = false;
                for (let j = idx - 1; j >= 0; j--) {
                  if (headings[j].level < heading.level && collapsedHeadingIds?.has(headings[j].id)) {
                    hidden = true;
                    break;
                  }
                  if (headings[j].level <= heading.level) break;
                }
                // Also check any ancestor at any level above
                if (!hidden) {
                  const ancestors: number[] = [];
                  for (let j = idx - 1; j >= 0; j--) {
                    if (headings[j].level < heading.level) {
                      if (collapsedHeadingIds?.has(headings[j].id)) {
                        hidden = true;
                        break;
                      }
                      ancestors.push(headings[j].level);
                      if (headings[j].level === 1) break;
                    }
                  }
                }

                if (hidden) return null;

                return (
                  <li
                    key={`${heading.id}-${idx}`}
                    className={`catalogue__list-item indent-level-${heading.level}${
                      activeId === heading.id ? ' active' : ''
                    }${isCollapsed ? ' catalogue__list-item--collapsed' : ''}`}
                    data-id={heading.id}
                    data-source-level={heading.level}
                  >
                    <a
                      href="#"
                      className="catalogue__item-title"
                      onClick={e => {
                        e.preventDefault();
                        scrollToHeading(heading.id);
                      }}
                    >
                      {hasChildren && onToggleHeadingCollapse && (
                        <span
                          className={`catalogue__collapse-arrow${isCollapsed ? ' catalogue__collapse-arrow--collapsed' : ''}`}
                          role="button"
                          tabIndex={0}
                          title={isCollapsed ? '展开' : '收起'}
                          aria-label={isCollapsed ? '展开' : '收起'}
                          onClick={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            onToggleHeadingCollapse(heading.id);
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              onToggleHeadingCollapse(heading.id);
                            }
                          }}
                        >
                          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                            <path d="M6 3.5L11 8L6 12.5" fill="currentColor" />
                          </svg>
                        </span>
                      )}
                      <span className="catalogue__item-text" dir="auto">
                        {heading.text}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
});

export default Sidebar;
