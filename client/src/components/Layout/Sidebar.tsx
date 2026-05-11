import { useCallback } from 'react';
import { DOC_TITLE_CATALOGUE_ID, type HeadingItem } from '../../types';
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
  /** 外部动态注入的样式（如 top 偏移） */
  style?: React.CSSProperties;
}

/** 目录收起/展开图标（用户提供 data URI） */
const CATALOGUE_TOGGLE_ICON_SRC =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTcuOTg3IDEzLjIyOEwzLjc2IDlsNC40NTctNC40NTguNjI3LS42M0EuNzUuNzUgMCAxMDcuNzggMi44NThsLS40OTguNUwyLjE3IDguNDdhLjc1Ljc1IDAgMDAwIDEuMDZsNC44NTQgNC44NTUuNzU5Ljc2YS43NS43NSAwIDAwMS4wNjItMS4wNTdsLS44NTctLjg2eiIgZmlsbD0iIzY0NkE3MyIvPjxwYXRoIGQ9Ik0xNC42NjggMTMuMjI4TDEwLjQ0IDlsNC40NTctNC40NTguNjI3LS42M2EuNzUuNzUgMCAxMC0xLjA2NC0xLjA1NmwtLjQ5OC41TDguODUgOC40N2EuNzUuNzUgMCAwMDAgMS4wNmw0Ljg1NCA0Ljg1NS43NTguNzZhLjc1Ljc1IDAgMDAxLjA2Mi0xLjA1N2wtLjg1Ni0uODZ6IiBmaWxsPSIjNjQ2QTczIi8+PC9zdmc+';

function CatalogueToggleIcon({ mirrored }: { mirrored?: boolean }) {
  return (
    <img
      src={CATALOGUE_TOGGLE_ICON_SRC}
      alt=""
      width={18}
      height={18}
      draggable={false}
      className={`catalogue-collapse-btn__icon${mirrored ? ' catalogue-collapse-btn__icon--mirrored' : ''}`}
    />
  );
}

function nonEmptyHeadingElements(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6')).filter(
    (el): el is HTMLElement => Boolean(el.textContent?.trim()),
  );
}

export default function Sidebar({
  documentTitle,
  headings,
  activeId,
  onTocItemActivate,
  collapsed,
  onToggle,
  style,
}: SidebarProps) {
  const scrollToDocumentTitle = useCallback(() => {
    document.querySelector('.editor-title-input')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    onTocItemActivate(DOC_TITLE_CATALOGUE_ID);
  }, [onTocItemActivate]);

  const scrollToHeading = useCallback(
    (id: string) => {
      const editorContent = document.querySelector('.editor-content-area .tiptap');
      if (!editorContent) return;
      const els = nonEmptyHeadingElements(editorContent);
      const idx = headings.findIndex(h => h.id === id);
      if (idx >= 0 && els[idx]) {
        els[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      onTocItemActivate(id);
    },
    [headings, onTocItemActivate],
  );

  return (
    <div className={`catalogue-aside${collapsed ? ' catalogue-aside--collapsed' : ''}`} style={style}>
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
              {headings.map(heading => (
                <li
                  key={heading.id}
                  className={`catalogue__list-item indent-level-${heading.level}${
                    activeId === heading.id ? ' active' : ''
                  }`}
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
                    <span className="catalogue__item-text" dir="auto">
                      {heading.text}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
