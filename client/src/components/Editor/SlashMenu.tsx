import { useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import type { Editor } from '@tiptap/react';
import {
  H1,
  H2,
  H3,
  ListTwo,
  OrderedList,
  ListCheckbox,
  CodeBrackets,
  Quote,
  Picture,
  HighLight,
  DividingLine,
  LinkOne,
  CheckCorrect,
  PictureOne,
  FolderOpen,
  GridNine,
  SplitCells,
  Connection,
  Rectangle,
  Formula,
  Bookmark,
  NotebookOne,
  Dashboard,
  Timeline,
  PictureAlbum,
} from '@icon-park/react';
import './SlashMenu.less';

type DocIcon = ComponentType<any>;

interface SlashMenuItem {
  Icon: DocIcon;
  iconColor?: string;
  label: string;
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

const noop = (_editor: Editor) => {
  deleteSlashIfAny(_editor);
};

const SECTIONS: SlashMenuSection[] = [
  {
    title: '基础',
    layout: 'grid',
    items: [
      {
        Icon: H1,
        iconColor: '#1f2329',
        label: '一级标题',
        matchText: 'H1 标题一',
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).setHeading({ level: 1 }).run();
        },
      },
      {
        Icon: H2,
        iconColor: '#1f2329',
        label: '二级标题',
        matchText: 'H2 标题二',
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).setHeading({ level: 2 }).run();
        },
      },
      {
        Icon: H3,
        iconColor: '#1f2329',
        label: '三级标题',
        matchText: 'H3 标题三',
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).setHeading({ level: 3 }).run();
        },
      },
      {
        Icon: ListTwo,
        iconColor: '#3370ff',
        label: '无序列表',
        matchText: 'bullet 项目符号',
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).toggleBulletList().run();
        },
      },
      {
        Icon: OrderedList,
        iconColor: '#3370ff',
        label: '有序列表',
        matchText: '编号 数字',
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).toggleOrderedList().run();
        },
      },
      {
        Icon: ListCheckbox,
        iconColor: '#00b42a',
        label: '任务列表',
        matchText: '任务 待办 勾选',
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).toggleTaskList().run();
        },
      },
      {
        Icon: CodeBrackets,
        iconColor: '#ff7d00',
        label: '代码块',
        matchText: 'code',
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).toggleCodeBlock().run();
        },
      },
      {
        Icon: Quote,
        iconColor: '#722ed1',
        label: '引用',
        matchText: 'blockquote',
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).toggleBlockquote().run();
        },
      },
      {
        Icon: Picture,
        iconColor: '#52c41a',
        label: '图片',
        matchText: '图片 图像 image',
        action: noop,
      },
      {
        Icon: HighLight,
        iconColor: '#f5a623',
        label: '高亮块',
        matchText: '高亮 callout',
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).toggleHighlight({ color: '#fff7e6' }).run();
        },
      },
      {
        Icon: DividingLine,
        iconColor: '#646a73',
        label: '分割线',
        matchText: '分隔 横线',
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).setHorizontalRule().run();
        },
      },
      {
        Icon: LinkOne,
        iconColor: '#3370ff',
        label: '页面链接',
        matchText: '链接 link url',
        action: noop,
      },
    ],
  },
  {
    title: '常用',
    layout: 'list',
    items: [
      {
        Icon: CheckCorrect,
        iconColor: '#1753eb',
        label: '任务',
        matchText: '任务列表',
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).toggleTaskList().run();
        },
      },
      {
        Icon: PictureOne,
        iconColor: '#52c41a',
        label: '图片',
        action: noop,
      },
      {
        Icon: FolderOpen,
        iconColor: '#13c2c2',
        label: '视频或文件',
        action: noop,
      },
      {
        Icon: GridNine,
        iconColor: '#1753eb',
        label: '表格',
        hasArrow: true,
        action: noop,
      },
      {
        Icon: SplitCells,
        iconColor: '#9254de',
        label: '分栏',
        hasArrow: true,
        action: noop,
      },
      {
        Icon: HighLight,
        iconColor: '#f5a623',
        label: '高亮块',
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).toggleHighlight({ color: '#fff7e6' }).run();
        },
      },
      {
        Icon: Connection,
        iconColor: '#eb2f96',
        label: '同步块',
        action: noop,
      },
      {
        Icon: Rectangle,
        iconColor: '#597ef7',
        label: '按钮',
        hasArrow: true,
        action: noop,
      },
      {
        Icon: Formula,
        iconColor: '#722ed1',
        label: '公式',
        action: noop,
      },
      {
        Icon: Bookmark,
        iconColor: '#f5222d',
        label: '模板',
        hasArrow: true,
        action: noop,
      },
      {
        Icon: NotebookOne,
        iconColor: '#3370ff',
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
        Icon: GridNine,
        iconColor: '#1753eb',
        label: '表格',
        action: noop,
      },
      {
        Icon: Dashboard,
        iconColor: '#52c41a',
        label: '看板',
        action: noop,
      },
      {
        Icon: Timeline,
        iconColor: '#f5a623',
        label: '甘特图',
        action: noop,
      },
      {
        Icon: PictureAlbum,
        iconColor: '#9254de',
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
    if (allItems.length === 0) {
      onClose();
    }
  }, [allItems.length, onClose]);

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
    return null;
  }

  let globalIdx = 0;

  const gridStroke = 3;

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
                const Icon = item.Icon;
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
                    <span className="slash-basic-cell-icon">
                      <Icon theme="outline" size={18} strokeWidth={gridStroke} fill={item.iconColor ?? '#1f2329'} />
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            section.items.map(item => {
              const idx = globalIdx++;
              const Icon = item.Icon;
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
                  <span className="slash-icon-wrap">
                    <Icon theme="outline" size={18} strokeWidth={gridStroke} fill={item.iconColor ?? '#1f2329'} />
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
