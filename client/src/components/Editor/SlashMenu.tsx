import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import './SlashMenu.less';

interface SlashMenuItem {
  icon: string;
  iconColor: string;
  label: string;
  /** 输入 / 时的额外匹配词（如拼音、简称） */
  matchText?: string;
  desc?: string;
  hasArrow?: boolean;
  action: (editor: Editor) => void;
}

type SectionLayout = 'grid' | 'list';

interface SlashMenuSection {
  title: string;
  layout: SectionLayout;
  items: SlashMenuItem[];
}

function getSlashRange(editor: Editor) {
  const { from } = editor.state.selection;
  const text = editor.state.doc.textBetween(Math.max(0, from - 20), from, '\n', '\0');
  const slashIdx = text.lastIndexOf('/');
  if (slashIdx === -1) return { from, to: from };
  const start = from - (text.length - slashIdx);
  return { from: start, to: from };
}

function deleteSlashIfAny(editor: Editor) {
  const range = getSlashRange(editor);
  if (range.from < range.to) {
    editor.chain().focus().deleteRange(range).run();
  }
}

const noop = (editor: Editor) => {
  deleteSlashIfAny(editor);
};

const SECTIONS: SlashMenuSection[] = [
  {
    title: '基础',
    layout: 'grid',
    items: [
      {
        icon: 'T',
        iconColor: '#1f2329',
        label: '正文',
        matchText: '正文 zhengwen zw paragraph',
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).setParagraph().run();
        },
      },
      {
        icon: 'H1',
        iconColor: '#1f2329',
        label: '一级标题',
        matchText: 'H1 标题一',
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).setHeading({ level: 1 }).run();
        },
      },
      {
        icon: 'H2',
        iconColor: '#1f2329',
        label: '二级标题',
        matchText: 'H2 标题二',
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).setHeading({ level: 2 }).run();
        },
      },
      {
        icon: 'H3',
        iconColor: '#1f2329',
        label: '三级标题',
        matchText: 'H3 标题三',
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).setHeading({ level: 3 }).run();
        },
      },
      {
        icon: '•',
        iconColor: '#3370ff',
        label: '无序列表',
        matchText: 'bullet 项目符号',
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).toggleBulletList().run();
        },
      },
      {
        icon: '1.',
        iconColor: '#3370ff',
        label: '有序列表',
        matchText: '编号 数字',
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).toggleOrderedList().run();
        },
      },
      {
        icon: '☑',
        iconColor: '#00b42a',
        label: '任务列表',
        matchText: '任务 待办 勾选',
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).toggleTaskList().run();
        },
      },
      {
        icon: '{}',
        iconColor: '#ff7d00',
        label: '代码块',
        matchText: 'code',
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).toggleCodeBlock().run();
        },
      },
      {
        icon: '❝',
        iconColor: '#722ed1',
        label: '引用',
        matchText: 'blockquote',
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).toggleBlockquote().run();
        },
      },
      {
        icon: '—',
        iconColor: '#646a73',
        label: '分割线',
        matchText: '分隔 横线',
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).setHorizontalRule().run();
        },
      },
      {
        icon: '⎘',
        iconColor: '#3370ff',
        label: '页面链接',
        matchText: '链接 页面',
        action: noop,
      },
      {
        icon: '🔗',
        iconColor: '#3370ff',
        label: '超链接',
        matchText: 'url link',
        action: noop,
      },
    ],
  },
  {
    title: '常用',
    layout: 'list',
    items: [
      {
        icon: '☑',
        iconColor: '#1753eb',
        label: '任务',
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).toggleTaskList().run();
        },
      },
      {
        icon: '🖼',
        iconColor: '#52c41a',
        label: '图片',
        action: noop,
      },
      {
        icon: '📎',
        iconColor: '#fa8c16',
        label: '视频或文件',
        action: noop,
      },
      {
        icon: '⊞',
        iconColor: '#1753eb',
        label: '表格',
        hasArrow: true,
        action: noop,
      },
      {
        icon: '⫾',
        iconColor: '#8c8c8c',
        label: '分栏',
        hasArrow: true,
        action: noop,
      },
      {
        icon: '▰',
        iconColor: '#f5a623',
        label: '高亮块',
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).toggleHighlight({ color: '#fff7e6' }).run();
        },
      },
      {
        icon: '⧄',
        iconColor: '#13c2c2',
        label: '同步块',
        action: noop,
      },
      {
        icon: '⬜',
        iconColor: '#597ef7',
        label: '按钮',
        hasArrow: true,
        action: noop,
      },
      {
        icon: 'TeX',
        iconColor: '#722ed1',
        label: '公式',
        action: noop,
      },
      {
        icon: '⊙',
        iconColor: '#f5222d',
        label: '模板',
        hasArrow: true,
        action: noop,
      },
      {
        icon: '▤',
        iconColor: '#4b4f58',
        label: '子文档',
        action: noop,
      },
    ],
  },
  {
    title: '多维表格',
    layout: 'list',
    items: [
      {
        icon: '⊞',
        iconColor: '#1753eb',
        label: '表格',
        action: noop,
      },
      {
        icon: '▤',
        iconColor: '#13c2c2',
        label: '看板',
        action: noop,
      },
      {
        icon: '▬',
        iconColor: '#f5a623',
        label: '甘特图',
        action: noop,
      },
      {
        icon: '▦',
        iconColor: '#52c41a',
        label: '画册',
        action: noop,
      },
    ],
  },
];

function itemMatchesQuery(item: SlashMenuItem, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  const pool = [item.label, item.matchText ?? '', item.desc ?? '']
    .join(' ')
    .toLowerCase();
  return pool.includes(q) || pool.split(/\s+/).some(t => t.startsWith(q) || t.includes(q));
}

interface Props {
  editor: Editor;
  position: { top: number; left: number };
  query: string;
  onClose: () => void;
}

export default function SlashMenu({ editor, position, query, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const filteredSections = SECTIONS.map(s => ({
    ...s,
    items: s.items.filter(item => itemMatchesQuery(item, query)),
  })).filter(s => s.items.length > 0);

  const allItems = filteredSections.flatMap(s => s.items);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  useEffect(() => {
    if (menuRef.current) {
      const active = menuRef.current.querySelector('.slash-item.active, .slash-basic-cell.active') as HTMLElement;
      active?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIdx]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx(i => Math.min(i + 1, Math.max(0, allItems.length - 1)));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        allItems[activeIdx]?.action(editor);
        onClose();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [allItems, activeIdx, editor, onClose]);

  if (allItems.length === 0) {
    onClose();
    return null;
  }

  let globalIdx = 0;

  return (
    <div
      className="slash-menu slash-menu-feishu"
      ref={menuRef}
      style={{ top: position.top, left: position.left }}
    >
      {filteredSections.map(section => (
        <div key={section.title} className={`slash-section slash-section--${section.layout}`}>
          <div className="slash-section-title">{section.title}</div>
          {section.layout === 'grid' ? (
            <div className="slash-basic-grid">
              {section.items.map(item => {
                const idx = globalIdx++;
                return (
                  <button
                    key={`${section.title}-${item.label}`}
                    type="button"
                    className={`slash-basic-cell ${idx === activeIdx ? 'active' : ''}`}
                    title={item.label}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onMouseDown={e => {
                      e.preventDefault();
                      item.action(editor);
                      onClose();
                    }}
                  >
                    <span className="slash-basic-cell-icon" style={{ color: item.iconColor }}>
                      {item.icon}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            section.items.map(item => {
              const idx = globalIdx++;
              return (
                <div
                  key={`${section.title}-${item.label}`}
                  className={`slash-item ${idx === activeIdx ? 'active' : ''}`}
                  role="button"
                  tabIndex={0}
                  title={item.label}
                  onMouseEnter={() => setActiveIdx(idx)}
                  onMouseDown={e => {
                    e.preventDefault();
                    item.action(editor);
                    onClose();
                  }}
                >
                  <span className="slash-icon" style={{ color: item.iconColor }}>
                    {item.icon}
                  </span>
                  <span className="slash-label">{item.label}</span>
                  {item.hasArrow && <span className="slash-arrow">›</span>}
                </div>
              );
            })
          )}
        </div>
      ))}
    </div>
  );
}
