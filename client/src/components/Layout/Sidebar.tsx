import type { HeadingItem } from '../../types';
import './Layout.less';

interface SidebarProps {
  headings: HeadingItem[];
  collapsed: boolean;
  onToggle: () => void;
}

function ChevronLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Sidebar({ headings, collapsed, onToggle }: SidebarProps) {
  const scrollToHeading = (id: string) => {
    const editorContent = document.querySelector('.editor-content-area .tiptap');
    if (!editorContent) return;
    const allHeadings = editorContent.querySelectorAll('h1, h2, h3, h4, h5');
    const idx = headings.findIndex(h => h.id === id);
    if (idx >= 0 && allHeadings[idx]) {
      allHeadings[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <aside className={`sidebar${collapsed ? ' sidebar-collapsed' : ''}`}>
      {!collapsed && (
        <div className="sidebar-main">
          <div className="sidebar-content">
            {headings.length === 0 ? (
              <div className="sidebar-empty">暂无标题</div>
            ) : (
              <nav className="sidebar-nav">
                {headings.map((heading) => (
                  <button
                    key={heading.id}
                    className={`sidebar-item sidebar-level-${heading.level}`}
                    onClick={() => scrollToHeading(heading.id)}
                    title={heading.text}
                  >
                    {heading.text || '(空标题)'}
                  </button>
                ))}
              </nav>
            )}
          </div>
        </div>
      )}

      <div className="sidebar-rail">
        <button
          type="button"
          className="sidebar-toggle"
          onClick={onToggle}
          title={collapsed ? '展开目录' : '收起目录'}
        >
          {collapsed ? <ChevronRight /> : <ChevronLeft />}
        </button>
      </div>
    </aside>
  );
}
