import type { ComponentType } from 'react';
import type { Editor } from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';
import { insertFeishuTable } from '../tables/tableInsert';
import { insertFeishuColumns } from '../blocks/columnsInsert';
import { insertStandaloneHorizontalRule } from '../blocks/blockOperations';
import { createBaseTable, serializeBaseTable } from '../../Bitable/model/bitableModel';
import { readApiPayload } from '../../../api/http';
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
  SlashGlyphBitableGrid,
  SlashGlyphGallery,
} from '../../../icons/slashMenuGlyphs';

export type DocIcon = ComponentType<{
  theme?: string;
  size?: number;
  strokeWidth?: number;
  fill?: string;
  className?: string;
}>;

export interface SlashMenuItem {
  Icon: DocIcon;
  iconColor?: string;
  label: string;
  matchText?: string;
  desc?: string;
  hasArrow?: boolean;
  submenu?: 'tableGrid' | 'columnsCount' | 'templateList' | 'buttonType';
  tooltip?: { shortcut?: string; markdown?: string };
  action: (editor: Editor) => void;
}

export type SectionLayout = 'grid' | 'list';

export interface SlashMenuSection {
  title: string;
  layout: SectionLayout;
  items: SlashMenuItem[];
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
  if (range.from < range.to) editor.chain().focus().deleteRange(range).run();
}

export const noopSlash = (editor: Editor) => {
  deleteSlashIfAny(editor);
};

function consumePlusInsertRange(editor: Editor): { from: number; to: number } | null {
  const range = (editor as any).__plusInsertRange as { from: number; to: number } | null | undefined;
  if (!range || range.from >= range.to) return null;
  (editor as any).__plusInsertRange = null;
  return range;
}

function replacePlusOrSlash(editor: Editor, content: any) {
  const plusRange = consumePlusInsertRange(editor);
  if (plusRange) {
    editor.chain().focus().deleteRange(plusRange).insertContentAt(plusRange.from, content).run();
    return;
  }
  editor.chain().focus().deleteRange(getSlashRange(editor)).insertContent(content).run();
}

const BUTTON_TYPE_LABELS: Record<ButtonActionType, string> = {
  link: '打开超链接',
  duplicate: '创建副本',
  follow: '关注文档更新',
};

export function insertButtonBlockFromSlash(editor: Editor, actionType: ButtonActionType = 'link') {
  replacePlusOrSlash(editor, {
    type: 'localButtonBlock',
    attrs: {
      actionType,
      text: BUTTON_TYPE_LABELS[actionType],
      color: 'blue',
    },
  });
}

export type ButtonActionType = 'link' | 'duplicate' | 'follow';

function createSyncBlockNode() {
  return {
    type: 'localSyncBlock',
    attrs: { syncId: `sync-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}` },
    content: [{ type: 'paragraph' }],
  };
}

function runTextCommand(editor: Editor, run: (editor: Editor) => void) {
  const plusRange = consumePlusInsertRange(editor);
  if (plusRange) {
    editor.chain().focus().deleteRange(plusRange).insertContentAt(plusRange.from, { type: 'paragraph' }).setTextSelection(plusRange.from + 1).run();
  } else {
    editor.chain().focus().deleteRange(getSlashRange(editor)).run();
  }
  run(editor);
}

function insertDividerFromSlash(editor: Editor) {
  const plusRange = consumePlusInsertRange(editor);
  if (plusRange) {
    insertStandaloneHorizontalRule(editor, { pos: plusRange.from, deleteRange: plusRange });
    return;
  }
  const slashRange = getSlashRange(editor);
  insertStandaloneHorizontalRule(editor, { pos: slashRange.from, deleteRange: slashRange });
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

function dispatchMediaInsert(files: File[], insertAt: number) {
  window.dispatchEvent(new CustomEvent('feishu-insert-media-files', {
    detail: { files, insertAt },
  }));
}

async function uploadFile(file: File) {
  const body = new FormData();
  body.append('file', file);
  const res = await fetch('/api/uploads', { method: 'POST', body });
  const json = await readApiPayload<{ name: string; size: number; type: string; url: string }>(res);
  if (!res.ok || json.code !== 0) throw new Error(json.message || '上传失败');
  return json.data as { name: string; size: number; type: string; url: string };
}

function insertImageFromPicker(editor: Editor) {
  const plusRange = consumePlusInsertRange(editor);
  if (plusRange) editor.chain().focus().deleteRange(plusRange).run();
  else editor.chain().focus().deleteRange(getSlashRange(editor)).run();

  pickFile('image/*', file => {
    void uploadFile(file).then(uploaded => {
      const imageNode = { type: 'image', attrs: { src: uploaded.url, alt: uploaded.name } };
      if (plusRange) editor.chain().focus().insertContentAt(plusRange.from, imageNode).run();
      else editor.chain().focus().insertContent(imageNode).run();
    }).catch(err => {
      const fallback = {
        type: 'localEmbedBlock',
        attrs: { title: '图片上传失败', desc: err instanceof Error ? err.message : '图片上传失败', kind: 'image' },
      };
      if (plusRange) editor.chain().focus().insertContentAt(plusRange.from, fallback).run();
      else editor.chain().focus().insertContent(fallback).run();
    });
  });
}

function insertFileFromPicker(editor: Editor) {
  const plusRange = consumePlusInsertRange(editor);
  const slashRange = getSlashRange(editor);
  const insertAt = plusRange?.from ?? slashRange.from;
  if (plusRange) editor.chain().focus().deleteRange(plusRange).run();
  else editor.chain().focus().deleteRange(slashRange).run();

  pickFile('video/*,application/*,*/*', file => {
    dispatchMediaInsert([file], insertAt);
  });
}

async function createChildDocument(editor: Editor) {
  const parentId = (editor as any).__documentId as string | undefined;
  const url = parentId ? `/api/documents/${parentId}/children` : '/api/documents';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: '未命名子文档', parent_id: parentId || null, content: '<p></p>' }),
  });
  const json = await res.json();
  const doc = json.data;
  if (!doc?.id) return;
  replacePlusOrSlash(editor, {
    type: 'localEmbedBlock',
    attrs: { title: doc.title || '未命名子文档', desc: `/doc/${doc.id}`, kind: 'subdoc', href: `/doc/${doc.id}` },
  });
}

export function resolveSlashInsertRange(editor: Editor): { from: number; to: number } {
  const plusRange = (editor as any).__plusInsertRange as { from: number; to: number } | null | undefined;
  if (plusRange && plusRange.from < plusRange.to) {
    return { from: plusRange.from, to: plusRange.to };
  }
  return getSlashRange(editor);
}

export function insertTemplateContent(
  editor: Editor,
  content: string,
  savedRange?: { from: number; to: number } | null,
) {
  const plusRange = consumePlusInsertRange(editor);
  const range = plusRange ?? savedRange ?? getSlashRange(editor);
  const insertPos = range.from;
  editor
    .chain()
    .focus()
    .deleteRange(range)
    .insertContentAt(insertPos, content || '<p></p>')
    .run();
}

function insertHighlightBlockFromSlash(editor: Editor) {
  const plusRange = consumePlusInsertRange(editor);
  if (plusRange) {
    editor.chain().focus().deleteRange(plusRange).insertContentAt(plusRange.from, {
      type: 'highlightBlock',
      attrs: { bgColor: '#fff0d9', borderColor: '#ffb057' },
      content: [{ type: 'paragraph' }],
    }).run();
    return;
  }
  editor.chain().focus().command(({ tr, state }) => {
    const range = getSlashRange(editor);
    const $from = state.doc.resolve(range.from);
    const parentStart = $from.before($from.depth);
    const parentEnd = $from.after($from.depth);
    const hlType = state.schema.nodes.highlightBlock;
    const pType = state.schema.nodes.paragraph;
    if (!hlType || !pType) return false;
    tr.replaceWith(parentStart, parentEnd, hlType.create(
      { bgColor: '#fff0d9', borderColor: '#ffb057' },
      pType.create(),
    ));
    tr.setSelection(TextSelection.near(tr.doc.resolve(parentStart + 2)));
    return true;
  }).run();
}

function insertBitableBlockFromSlash(editor: Editor, view: 'grid' | 'gallery' | 'gantt' | 'kanban') {
  const table = createBaseTable(view);
  replacePlusOrSlash(editor, {
    type: 'localBitableBlock',
    attrs: {
      title: table.name,
      view,
      model: serializeBaseTable(table),
    },
  });
}

export const SLASH_MENU_WIDTH = 252;
export const SLASH_MENU_MAX_HEIGHT = 646;

export const SLASH_SECTIONS: SlashMenuSection[] = [
  {
    title: '基础',
    layout: 'grid',
    gridMuted: true,
    items: [
      { Icon: SlashGlyphHeading1, iconColor: '#646a73', label: '一级标题', matchText: 'H1 标题一 heading', tooltip: { shortcut: 'Ctrl + Alt + 1', markdown: '# 空格' }, action: e => runTextCommand(e, ed => ed.chain().focus().setHeading({ level: 1 }).run()) },
      { Icon: SlashGlyphHeading2, iconColor: '#646a73', label: '二级标题', matchText: 'H2 标题二 heading', tooltip: { shortcut: 'Ctrl + Alt + 2', markdown: '## 空格' }, action: e => runTextCommand(e, ed => ed.chain().focus().setHeading({ level: 2 }).run()) },
      { Icon: SlashGlyphHeading3, iconColor: '#646a73', label: '三级标题', matchText: 'H3 标题三 heading', tooltip: { shortcut: 'Ctrl + Alt + 3', markdown: '### 空格' }, action: e => runTextCommand(e, ed => ed.chain().focus().setHeading({ level: 3 }).run()) },
      { Icon: SlashGlyphHeading4, iconColor: '#646a73', label: '四级标题', matchText: 'H4 标题四 heading', tooltip: { shortcut: 'Ctrl + Alt + 4', markdown: '#### 空格' }, action: e => runTextCommand(e, ed => ed.chain().focus().setHeading({ level: 4 }).run()) },
      { Icon: SlashGlyphHeading5, iconColor: '#646a73', label: '五级标题', matchText: 'H5 标题五 heading', tooltip: { shortcut: 'Ctrl + Alt + 5', markdown: '##### 空格' }, action: e => runTextCommand(e, ed => ed.chain().focus().setHeading({ level: 5 }).run()) },
      { Icon: SlashGlyphHeading6, iconColor: '#646a73', label: '六级标题', matchText: 'H6 标题六 heading', tooltip: { shortcut: 'Ctrl + Alt + 6', markdown: '###### 空格' }, action: e => runTextCommand(e, ed => ed.chain().focus().setHeading({ level: 6 }).run()) },
      { Icon: SlashGlyphOrderedList, iconColor: '#646a73', label: '有序列表', matchText: '编号 数字 ordered list', tooltip: { shortcut: 'Ctrl + Shift + 7', markdown: '1. 空格' }, action: e => runTextCommand(e, ed => ed.chain().focus().toggleOrderedList().run()) },
      { Icon: SlashGlyphBulletList, iconColor: '#646a73', label: '无序列表', matchText: 'bullet 项目符号 unordered list', tooltip: { shortcut: 'Ctrl + Shift + 8', markdown: '- 空格' }, action: e => runTextCommand(e, ed => ed.chain().focus().toggleBulletList().run()) },
      { Icon: SlashGlyphTaskList, iconColor: '#646a73', label: '任务列表', matchText: '任务 待办 勾选 todo task', tooltip: { shortcut: 'Ctrl + Shift + 9', markdown: '[] 空格' }, action: e => runTextCommand(e, ed => ed.chain().focus().toggleTaskList().run()) },
      { Icon: SlashGlyphCode, iconColor: '#646a73', label: '代码块', matchText: 'code 代码', tooltip: { markdown: '``` 空格' }, action: e => runTextCommand(e, ed => ed.chain().focus().setCodeBlock({ language: 'plaintext' }).run()) },
      { Icon: SlashGlyphQuote, iconColor: '#646a73', label: '引用', matchText: 'blockquote quote 引用', tooltip: { markdown: '> 空格' }, action: e => runTextCommand(e, ed => ed.chain().focus().toggleBlockquote().run()) },
      { Icon: SlashGlyphDivider, iconColor: '#646a73', label: '分割线', matchText: '分隔 横线 divider hr', tooltip: { markdown: '--- 回车' }, action: insertDividerFromSlash },
      { Icon: SlashGlyphSyncMuted, iconColor: '#646a73', label: '同步块', matchText: '同步 synced sync', tooltip: { markdown: '' }, action: e => replacePlusOrSlash(e, createSyncBlockNode()) },
      {
        Icon: SlashGlyphLink,
        iconColor: '#646a73',
        label: '链接',
        matchText: '链接 link url 超链接',
        tooltip: { shortcut: 'Ctrl + K' },
        action: e => {
          const plusRange = consumePlusInsertRange(e);
          if (plusRange) {
            e.chain().focus().deleteRange(plusRange).insertContentAt(plusRange.from, { type: 'paragraph' }).setTextSelection(plusRange.from + 1).run();
          } else {
            e.chain().focus().deleteRange(getSlashRange(e)).run();
          }
          window.dispatchEvent(new CustomEvent('feishu-open-page-link-dialog'));
        },
      },
    ],
  },
  {
    title: '常用',
    layout: 'list',
    items: [
      { Icon: SlashGlyphTaskList, iconColor: '#3370ff', label: '任务', matchText: '任务 待办 todo', tooltip: { shortcut: 'Ctrl + Shift + 9', markdown: '[] 空格' }, action: e => runTextCommand(e, ed => ed.chain().focus().toggleTaskList().run()) },
      { Icon: SlashGlyphImage, iconColor: '#faad14', label: '图片', matchText: 'image img 图片', action: insertImageFromPicker },
      { Icon: SlashGlyphFolder, iconColor: '#3370ff', label: '视频或文件', matchText: '视频 文件 wj video file upload', action: insertFileFromPicker },
      { Icon: SlashGlyphTable, iconColor: '#00b96b', label: '表格', matchText: 'table 表格', hasArrow: true, submenu: 'tableGrid', tooltip: { markdown: '| 空格' }, action: e => insertFeishuTable(e, 3, 3) },
      { Icon: SlashGlyphColumns, iconColor: '#3370ff', label: '分栏', matchText: 'columns 分栏 布局', hasArrow: true, submenu: 'columnsCount', action: e => insertFeishuColumns(e, 2) },
      { Icon: SlashGlyphHighlight, iconColor: '#fa8c16', label: '高亮块', matchText: 'highlight callout 高亮', action: insertHighlightBlockFromSlash },
      { Icon: SlashGlyphSync, iconColor: '#3370ff', label: '同步块', matchText: '同步 synced sync', action: e => replacePlusOrSlash(e, createSyncBlockNode()) },
      { Icon: SlashGlyphButton, iconColor: '#597ef7', label: '按钮', matchText: 'button 按钮', hasArrow: true, submenu: 'buttonType', action: e => insertButtonBlockFromSlash(e, 'link') },
      { Icon: SlashGlyphFormula, iconColor: '#8f959e', label: '公式', matchText: 'formula latex math 公式', action: e => replacePlusOrSlash(e, { type: 'localFormulaBlock' }) },
      { Icon: SlashGlyphTemplate, iconColor: '#f5222d', label: '模板', matchText: '模板 template', hasArrow: true, submenu: 'templateList', action: noopSlash },
      { Icon: SlashGlyphSubDoc, iconColor: '#3370ff', label: '子文档', matchText: '子文档 subdoc page', action: e => void createChildDocument(e) },
    ],
  },
  {
    title: '多维表格',
    layout: 'list',
    items: [
      { Icon: SlashGlyphBitableGrid, iconColor: '#34c759', label: '表格', matchText: '多维表格 bitable database grid', action: e => insertBitableBlockFromSlash(e, 'grid') },
      { Icon: SlashGlyphBitableGrid, iconColor: '#3370ff', label: '看板', matchText: '多维表格 kanban 看板', action: e => insertBitableBlockFromSlash(e, 'kanban') },
      { Icon: SlashGlyphGallery, iconColor: '#7b61ff', label: '画册', matchText: '多维表格 gallery album 画册', action: e => insertBitableBlockFromSlash(e, 'gallery') },
    ],
  },
];

export function itemMatchesQuery(item: SlashMenuItem, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  const pool = [item.label, item.matchText ?? '', item.desc ?? ''].join(' ').toLowerCase();
  return pool.includes(q) || pool.split(/\s+/).some(t => t.startsWith(q) || t.includes(q));
}
