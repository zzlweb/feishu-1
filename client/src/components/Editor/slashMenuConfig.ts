import type { ComponentType } from 'react';
import type { Editor } from '@tiptap/react';
import {
  SlashGlyphHeading1,
  SlashGlyphHeading2,
  SlashGlyphHeading3,
  SlashGlyphHeading4,
  SlashGlyphHeading5,
  SlashGlyphHeading6,
  SlashGlyphBulletList,
  SlashGlyphOrderedList,
  SlashGlyphTaskList,
  SlashGlyphCode,
  SlashGlyphQuote,
  SlashGlyphDivider,
  SlashGlyphSyncMuted,
  SlashGlyphGridBoard,
  SlashGlyphLink,
  SlashGlyphImage,
  SlashGlyphFolder,
  SlashGlyphTable,
  SlashGlyphColumns,
  SlashGlyphHighlight,
  SlashGlyphSync,
  SlashGlyphButton,
  SlashGlyphFormula,
  SlashGlyphTemplate,
  SlashGlyphSubDoc,
  SlashGlyphKanban,
  SlashGlyphGantt,
  SlashGlyphGallery,
  SlashGlyphBitableGrid,
} from '../../icons/slashMenuGlyphs';

export type DocIcon = ComponentType<{
  theme?: string;
  size?: number;
  strokeWidth?: number;
  fill?: string;
  className?: string;
}>;

export interface SlashMenuItem {
  Icon: DocIcon;
  /** 列表区彩色底用；基础区为灰阶 */
  iconColor?: string;
  label: string;
  matchText?: string;
  desc?: string;
  hasArrow?: boolean;
  action: (editor: Editor) => void;
}

export type SectionLayout = 'grid' | 'list';

export interface SlashMenuSection {
  title: string;
  layout: SectionLayout;
  items: SlashMenuItem[];
  /** 基础区：无色块底、灰线稿，贴近飞书「基础」栅格 */
  gridMuted?: boolean;
}

export function getSlashRange(editor: Editor) {
  const { from } = editor.state.selection;
  const text = editor.state.doc.textBetween(Math.max(0, from - 20), from, '\n', '\0');
  const slashIdx = text.lastIndexOf('/');
  if (slashIdx === -1) return { from, to: from };
  const start = from - (text.length - slashIdx);
  return { from: start, to: from };
}

export function deleteSlashIfAny(editor: Editor) {
  const range = getSlashRange(editor);
  if (range.from < range.to) {
    editor.chain().focus().deleteRange(range).run();
  }
}

export const noopSlash = (_editor: Editor) => {
  deleteSlashIfAny(_editor);
};

export const SLASH_SECTIONS: SlashMenuSection[] = [
  {
    title: '基础',
    layout: 'grid',
    gridMuted: true,
    items: [
      {
        Icon: SlashGlyphHeading1,
        iconColor: '#646a73',
        label: '一级标题',
        matchText: 'H1 标题一',
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).setHeading({ level: 1 }).run();
        },
      },
      {
        Icon: SlashGlyphHeading2,
        iconColor: '#646a73',
        label: '二级标题',
        matchText: 'H2 标题二',
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).setHeading({ level: 2 }).run();
        },
      },
      {
        Icon: SlashGlyphHeading3,
        iconColor: '#646a73',
        label: '三级标题',
        matchText: 'H3 标题三',
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).setHeading({ level: 3 }).run();
        },
      },
      {
        Icon: SlashGlyphHeading4,
        iconColor: '#646a73',
        label: '四级标题',
        matchText: 'H4 标题四',
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).setHeading({ level: 4 }).run();
        },
      },
      {
        Icon: SlashGlyphHeading5,
        iconColor: '#646a73',
        label: '五级标题',
        matchText: 'H5 标题五',
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).setHeading({ level: 5 }).run();
        },
      },
      {
        Icon: SlashGlyphHeading6,
        iconColor: '#646a73',
        label: '六级标题',
        matchText: 'H6 标题六',
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).setHeading({ level: 6 }).run();
        },
      },
      {
        Icon: SlashGlyphOrderedList,
        iconColor: '#646a73',
        label: '有序列表',
        matchText: '编号 数字',
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).toggleOrderedList().run();
        },
      },
      {
        Icon: SlashGlyphBulletList,
        iconColor: '#646a73',
        label: '无序列表',
        matchText: 'bullet 项目符号',
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).toggleBulletList().run();
        },
      },
      {
        Icon: SlashGlyphTaskList,
        iconColor: '#646a73',
        label: '任务列表',
        matchText: '任务 待办 勾选',
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).toggleTaskList().run();
        },
      },
      {
        Icon: SlashGlyphCode,
        iconColor: '#646a73',
        label: '代码块',
        matchText: 'code',
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).setCodeBlock({ language: 'plaintext' }).run();
        },
      },
      {
        Icon: SlashGlyphQuote,
        iconColor: '#646a73',
        label: '引用',
        matchText: 'blockquote',
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).toggleBlockquote().run();
        },
      },
      {
        Icon: SlashGlyphDivider,
        iconColor: '#646a73',
        label: '分割线',
        matchText: '分隔 横线',
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).setHorizontalRule().run();
        },
      },
      {
        Icon: SlashGlyphSyncMuted,
        iconColor: '#646a73',
        label: '同步块',
        matchText: '同步 synced',
        action: noopSlash,
      },
      {
        Icon: SlashGlyphGridBoard,
        iconColor: '#646a73',
        label: '表格',
        matchText: '九宫格 网格',
        action: noopSlash,
      },
      {
        Icon: SlashGlyphLink,
        iconColor: '#646a73',
        label: '页面链接',
        matchText: '链接 link url',
        action: noopSlash,
      },
    ],
  },
  {
    title: '常用',
    layout: 'list',
    items: [
      {
        Icon: SlashGlyphTaskList,
        iconColor: '#3370ff',
        label: '任务',
        matchText: '任务列表',
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).toggleTaskList().run();
        },
      },
      {
        Icon: SlashGlyphImage,
        iconColor: '#faad14',
        label: '图片',
        action: noopSlash,
      },
      {
        Icon: SlashGlyphFolder,
        iconColor: '#3370ff',
        label: '视频或文件',
        action: noopSlash,
      },
      {
        Icon: SlashGlyphTable,
        iconColor: '#52c41a',
        label: '表格',
        hasArrow: true,
        action: noopSlash,
      },
      {
        Icon: SlashGlyphColumns,
        iconColor: '#9254de',
        label: '分栏',
        hasArrow: true,
        action: noopSlash,
      },
      {
        Icon: SlashGlyphHighlight,
        iconColor: '#fa8c16',
        label: '高亮块',
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).toggleHighlight({ color: '#fff7e6' }).run();
        },
      },
      {
        Icon: SlashGlyphCode,
        iconColor: '#646a73',
        label: '代码块',
        matchText: 'code',
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).setCodeBlock({ language: 'plaintext' }).run();
        },
      },
      {
        Icon: SlashGlyphSync,
        iconColor: '#3370ff',
        label: '同步块',
        action: noopSlash,
      },
      {
        Icon: SlashGlyphButton,
        iconColor: '#597ef7',
        label: '按钮',
        hasArrow: true,
        action: noopSlash,
      },
      {
        Icon: SlashGlyphFormula,
        iconColor: '#8f959e',
        label: '公式',
        action: noopSlash,
      },
      {
        Icon: SlashGlyphTemplate,
        iconColor: '#f5222d',
        label: '模板',
        hasArrow: true,
        action: noopSlash,
      },
      {
        Icon: SlashGlyphSubDoc,
        iconColor: '#3370ff',
        label: '子文档',
        action: noopSlash,
      },
    ],
  },
  {
    title: '多维表格',
    layout: 'list',
    items: [
      {
        Icon: SlashGlyphBitableGrid,
        iconColor: '#3370ff',
        label: '表格',
        action: noopSlash,
      },
      {
        Icon: SlashGlyphKanban,
        iconColor: '#52c41a',
        label: '看板',
        action: noopSlash,
      },
      {
        Icon: SlashGlyphGantt,
        iconColor: '#eb2f96',
        label: '甘特图',
        action: noopSlash,
      },
      {
        Icon: SlashGlyphGallery,
        iconColor: '#9254de',
        label: '画册',
        action: noopSlash,
      },
    ],
  },
];

export function itemMatchesQuery(item: SlashMenuItem, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  const pool = [item.label, item.matchText ?? '', item.desc ?? '']
    .join(' ')
    .toLowerCase();
  return pool.includes(q) || pool.split(/\s+/).some(t => t.startsWith(q) || t.includes(q));
}
