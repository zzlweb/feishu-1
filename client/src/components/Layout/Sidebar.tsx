import type { HeadingItem } from '../../types';
import './Layout.less';

interface SidebarProps {
  headings: HeadingItem[];
  collapsed: boolean;
  onToggle: () => void;
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

  if (collapsed) return null;

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <button className="sidebar-toggle" onClick={onToggle} title="收起目录">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M8 3L4 7l4 4M11 3L7 7l4 4" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

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
    </aside>
  );
}
