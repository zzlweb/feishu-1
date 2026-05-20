import type { ComponentType } from 'react';
import type { Editor } from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';
import { insertFeishuTable } from './tableInsert';
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
  /** 悬停展开子面板（如表格尺寸选择） */
  submenu?: 'tableGrid';
  /** 悬停提示：第一行为"名称 (快捷键)"，第二行为 Markdown 语法 */
  tooltip?: { shortcut?: string; markdown?: string };
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

const HIGHLIGHT_BLOCK_CONTENT = {
  type: 'highlightBlock',
  attrs: { bgColor: '#fff0d9', borderColor: '#ffb057' },
  content: [{ type: 'paragraph' }],
};

function insertSlashContent(editor: Editor, content: any) {
  editor.chain().focus().deleteRange(getSlashRange(editor)).insertContent(content).run();
}

function pickFile(accept: string, onPick: (file: File) => void) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) onPick(file);
  };
  input.click();
}

function readFileAsDataUrl(file: File, onLoad: (url: string) => void) {
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result === 'string') onLoad(reader.result);
  };
  reader.readAsDataURL(file);
}

async function uploadFile(file: File) {
  const body = new FormData();
  body.append('file', file);
  const res = await fetch('/api/uploads', { method: 'POST', body });
  const json = await res.json();
  if (!res.ok || json.code !== 0) throw new Error(json.message || '上传失败');
  return json.data as { name: string; size: number; type: string; url: string };
}

function insertImageFromPicker(editor: Editor) {
  const range = getSlashRange(editor);
  editor.chain().focus().deleteRange(range).run();
  pickFile('image/*', file => {
    void uploadFile(file).then(uploaded => {
      editor.chain().focus().setImage({ src: uploaded.url, alt: uploaded.name }).run();
    }).catch(err => {
      editor.chain().focus().insertContent({
        type: 'localEmbedBlock',
        attrs: { title: '图片上传失败', desc: err instanceof Error ? err.message : '图片上传失败', kind: 'image' },
      }).run();
    });
  });
}

function insertFileFromPicker(editor: Editor) {
  const range = getSlashRange(editor);
  editor.chain().focus().deleteRange(range).run();
  pickFile('video/*,application/*,*/*', file => {
    void uploadFile(file).then(uploaded => {
      editor.chain().focus().insertContent({
        type: 'localFileBlock',
        attrs: { name: uploaded.name, url: uploaded.url, size: uploaded.size, mime: uploaded.type },
      }).run();
    }).catch(err => {
      editor.chain().focus().insertContent({
        type: 'localEmbedBlock',
        attrs: { title: '上传失败', desc: err instanceof Error ? err.message : '文件上传失败', kind: 'file' },
      }).run();
    });
  });
}

async function createChildDocument(editor: Editor) {
  const parentId = (editor as any).__documentId as string | undefined;
  const res = await fetch('/api/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: '未命名子文档', parent_id: parentId || null, content: '<p></p>' }),
  });
  const json = await res.json();
  const doc = json.data;
  if (!doc?.id) return;
  insertSlashContent(editor, {
    type: 'localEmbedBlock',
    attrs: { title: doc.title || '未命名子文档', desc: `/doc/${doc.id}`, kind: 'subdoc', href: `/doc/${doc.id}` },
  });
}

async function insertFirstTemplate(editor: Editor) {
  const range = getSlashRange(editor);
  editor.chain().focus().deleteRange(range).run();
  const res = await fetch('/api/documents/templates/list');
  const json = await res.json();
  const template = json.data?.[0];
  if (template?.content) {
    editor.chain().focus().insertContent(template.content).run();
    return;
  }
  editor.chain().focus().insertContent({
    type: 'localEmbedBlock',
    attrs: { title: '模板库为空', desc: '请先在更多菜单中保存模板', kind: 'template' },
  }).run();
}

function insertHighlightBlockFromSlash(editor: Editor) {
  editor.chain().focus().command(({ tr, state }) => {
    const range = getSlashRange(editor);
    const $from = state.doc.resolve(range.from);
    // Replace the entire parent paragraph that contains the slash text
    const parentStart = $from.before($from.depth);
    const parentEnd = $from.after($from.depth);

    const hlType = state.schema.nodes.highlightBlock;
    const pType = state.schema.nodes.paragraph;
    if (!hlType || !pType) return false;

    const newBlock = hlType.create(
      { bgColor: '#fff0d9', borderColor: '#ffb057' },
      pType.create(),
    );
    tr.replaceWith(parentStart, parentEnd, newBlock);
    // Place cursor inside the inner paragraph
    tr.setSelection(TextSelection.near(tr.doc.resolve(parentStart + 2)));
    return true;
  }).run();
}

/** 与 SlashMenu.less 中 width / max-height 保持一致，供定位计算使用 */
export const SLASH_MENU_WIDTH = 252;
export const SLASH_MENU_MAX_HEIGHT = 646;

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
        tooltip: { shortcut: 'Ctrl + Alt + 1', markdown: '# 空格' },
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).setHeading({ level: 1 }).run();
        },
      },
      {
        Icon: SlashGlyphHeading2,
        iconColor: '#646a73',
        label: '二级标题',
        matchText: 'H2 标题二',
        tooltip: { shortcut: 'Ctrl + Alt + 2', markdown: '## 空格' },
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).setHeading({ level: 2 }).run();
        },
      },
      {
        Icon: SlashGlyphHeading3,
        iconColor: '#646a73',
        label: '三级标题',
        matchText: 'H3 标题三',
        tooltip: { shortcut: 'Ctrl + Alt + 3', markdown: '### 空格' },
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).setHeading({ level: 3 }).run();
        },
      },
      {
        Icon: SlashGlyphHeading4,
        iconColor: '#646a73',
        label: '四级标题',
        matchText: 'H4 标题四',
        tooltip: { shortcut: 'Ctrl + Alt + 4', markdown: '#### 空格' },
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).setHeading({ level: 4 }).run();
        },
      },
      {
        Icon: SlashGlyphHeading5,
        iconColor: '#646a73',
        label: '五级标题',
        matchText: 'H5 标题五',
        tooltip: { shortcut: 'Ctrl + Alt + 5', markdown: '##### 空格' },
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).setHeading({ level: 5 }).run();
        },
      },
      {
        Icon: SlashGlyphHeading6,
        iconColor: '#646a73',
        label: '六级标题',
        matchText: 'H6 标题六',
        tooltip: { shortcut: 'Ctrl + Alt + 6', markdown: '###### 空格' },
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).setHeading({ level: 6 }).run();
        },
      },
      {
        Icon: SlashGlyphOrderedList,
        iconColor: '#646a73',
        label: '有序列表',
        matchText: '编号 数字',
        tooltip: { shortcut: 'Ctrl + Shift + 7', markdown: '1. 空格' },
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).toggleOrderedList().run();
        },
      },
      {
        Icon: SlashGlyphBulletList,
        iconColor: '#646a73',
        label: '无序列表',
        matchText: 'bullet 项目符号',
        tooltip: { shortcut: 'Ctrl + Shift + 8', markdown: '- 空格' },
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).toggleBulletList().run();
        },
      },
      {
        Icon: SlashGlyphTaskList,
        iconColor: '#646a73',
        label: '任务列表',
        matchText: '任务 待办 勾选',
        tooltip: { shortcut: 'Ctrl + Shift + 9', markdown: '[] 空格' },
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).toggleTaskList().run();
        },
      },
      {
        Icon: SlashGlyphCode,
        iconColor: '#646a73',
        label: '代码块',
        matchText: 'code',
        tooltip: { markdown: '``` 空格' },
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).setCodeBlock({ language: 'plaintext' }).run();
        },
      },
      {
        Icon: SlashGlyphLink,
        iconColor: '#646a73',
        label: '链接',
        matchText: '链接 link url 超链接',
        tooltip: { shortcut: 'Ctrl + K' },
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).run();
          window.dispatchEvent(new CustomEvent('feishu-open-page-link-dialog'));
        },
      },
      {
        Icon: SlashGlyphQuote,
        iconColor: '#646a73',
        label: '引用',
        matchText: 'blockquote',
        tooltip: { markdown: '> 空格' },
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).toggleBlockquote().run();
        },
      },
      {
        Icon: SlashGlyphDivider,
        iconColor: '#646a73',
        label: '分割线',
        matchText: '分隔 横线',
        tooltip: { markdown: '--- 回车' },
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).setHorizontalRule().run();
        },
      },
      {
        Icon: SlashGlyphSyncMuted,
        iconColor: '#646a73',
        label: '同步块',
        matchText: '同步 synced',
        tooltip: {},
        action: e => {
          insertSlashContent(e, { type: 'localSyncBlock', content: [{ type: 'paragraph' }] });
        },
      },
      {
        Icon: SlashGlyphHighlight,
        iconColor: '#646a73',
        label: '高亮块',
        matchText: 'highlight callout',
        tooltip: {},
        action: e => {
          insertHighlightBlockFromSlash(e);
        },
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
        tooltip: { shortcut: 'Ctrl + Shift + 9', markdown: '[] 空格' },
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).toggleTaskList().run();
        },
      },
      {
        Icon: SlashGlyphImage,
        iconColor: '#faad14',
        label: '图片',
        tooltip: {},
        action: e => {
          insertImageFromPicker(e);
        },
      },
      {
        Icon: SlashGlyphFolder,
        iconColor: '#3370ff',
        label: '视频或文件',
        tooltip: {},
        action: e => {
          insertFileFromPicker(e);
        },
      },
      {
        Icon: SlashGlyphLink,
        iconColor: '#3370ff',
        label: '链接',
        hasArrow: true,
        matchText: '超链 url',
        tooltip: { shortcut: 'Ctrl + K' },
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).run();
          window.dispatchEvent(new CustomEvent('feishu-open-page-link-dialog'));
        },
      },
      {
        Icon: SlashGlyphTable,
        iconColor: '#52c41a',
        label: '表格',
        hasArrow: true,
        submenu: 'tableGrid',
        tooltip: { markdown: '| 空格' },
        action: e => {
          insertFeishuTable(e, 3, 3);
        },
      },
      {
        Icon: SlashGlyphColumns,
        iconColor: '#9254de',
        label: '分栏',
        hasArrow: true,
        tooltip: {},
        action: e => {
          insertSlashContent(e, { type: 'localColumnsBlock' });
        },
      },
      {
        Icon: SlashGlyphHighlight,
        iconColor: '#fa8c16',
        label: '高亮块',
        tooltip: {},
        action: e => {
          insertHighlightBlockFromSlash(e);
        },
      },
      {
        Icon: SlashGlyphCode,
        iconColor: '#646a73',
        label: '代码块',
        matchText: 'code',
        tooltip: { markdown: '``` 空格' },
        action: e => {
          e.chain().focus().deleteRange(getSlashRange(e)).setCodeBlock({ language: 'plaintext' }).run();
        },
      },
      {
        Icon: SlashGlyphSync,
        iconColor: '#3370ff',
        label: '同步块',
        tooltip: {},
        action: e => {
          insertSlashContent(e, { type: 'localSyncBlock', content: [{ type: 'paragraph' }] });
        },
      },
      {
        Icon: SlashGlyphButton,
        iconColor: '#597ef7',
        label: '按钮',
        hasArrow: true,
        tooltip: {},
        action: e => {
          insertSlashContent(e, { type: 'localButtonBlock' });
        },
      },
      {
        Icon: SlashGlyphFormula,
        iconColor: '#8f959e',
        label: '公式',
        tooltip: {},
        action: e => {
          insertSlashContent(e, { type: 'localFormulaBlock' });
        },
      },
      {
        Icon: SlashGlyphTemplate,
        iconColor: '#f5222d',
        label: '更多',
        hasArrow: true,
        matchText: '模板 更多 旧版',
        tooltip: {},
        action: e => {
          void insertFirstTemplate(e);
        },
      },
      {
        Icon: SlashGlyphSubDoc,
        iconColor: '#3370ff',
        label: '子文档',
        tooltip: {},
        action: e => {
          void createChildDocument(e);
        },
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
        tooltip: {},
        action: e => {
          insertSlashContent(e, { type: 'localEmbedBlock', attrs: { title: '多维表格', desc: '表格视图', kind: 'bitable' } });
        },
      },
      {
        Icon: SlashGlyphKanban,
        iconColor: '#52c41a',
        label: '看板',
        tooltip: {},
        action: e => {
          insertSlashContent(e, { type: 'localEmbedBlock', attrs: { title: '看板', desc: '多维表格看板视图占位块', kind: 'kanban' } });
        },
      },
      {
        Icon: SlashGlyphGantt,
        iconColor: '#eb2f96',
        label: '甘特图',
        tooltip: {},
        action: e => {
          insertSlashContent(e, { type: 'localEmbedBlock', attrs: { title: '甘特图', desc: '多维表格甘特视图占位块', kind: 'gantt' } });
        },
      },
      {
        Icon: SlashGlyphGallery,
        iconColor: '#9254de',
        label: '画册',
        tooltip: {},
        action: e => {
          insertSlashContent(e, { type: 'localEmbedBlock', attrs: { title: '画册', desc: '多维表格画册视图占位块', kind: 'gallery' } });
        },
      },
    ],
  },
  {
    title: '绘图',
    layout: 'list',
    items: [
      {
        Icon: SlashGlyphKanban,
        iconColor: '#34c724',
        label: '画板',
        matchText: '白板 board canvas',
        tooltip: {},
        action: e => {
          insertSlashContent(e, { type: 'localEmbedBlock', attrs: { title: '画板', desc: '飞书画板占位块', kind: 'board' } });
        },
      },
      {
        Icon: SlashGlyphGantt,
        iconColor: '#13c2c2',
        label: '思维导图',
        matchText: 'mindmap 脑图',
        tooltip: {},
        action: e => {
          insertSlashContent(e, { type: 'localEmbedBlock', attrs: { title: '思维导图', desc: '思维导图占位块', kind: 'mindmap' } });
        },
      },
      {
        Icon: SlashGlyphGallery,
        iconColor: '#fa8c16',
        label: '流程图',
        matchText: 'flowchart 流程',
        tooltip: {},
        action: e => {
          insertSlashContent(e, { type: 'localEmbedBlock', attrs: { title: '流程图', desc: '流程图占位块', kind: 'flowchart' } });
        },
      },
      {
        Icon: SlashGlyphFormula,
        iconColor: '#597ef7',
        label: 'UML 图',
        matchText: 'uml',
        tooltip: {},
        action: e => {
          insertSlashContent(e, { type: 'localEmbedBlock', attrs: { title: 'UML 图', desc: 'UML 图占位块', kind: 'uml' } });
        },
      },
    ],
  },
  {
    title: '团队协作',
    layout: 'list',
    items: [
      {
        Icon: SlashGlyphSubDoc,
        iconColor: '#3370ff',
        label: '人员',
        matchText: 'mention user at 成员',
        tooltip: {},
        action: e => {
          insertSlashContent(e, { type: 'localEmbedBlock', attrs: { title: '人员', desc: '@成员 占位块', kind: 'mention' } });
        },
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
