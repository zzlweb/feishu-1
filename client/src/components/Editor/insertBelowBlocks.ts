import type { Editor } from '@tiptap/react';
import type { SlashMenuItem } from './slashMenuConfig';
import { insertFeishuTableAt } from './tableInsert';
import { insertFeishuColumnsAt } from './columnsInsert';

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

async function uploadFile(file: File) {
  const body = new FormData();
  body.append('file', file);
  const res = await fetch('/api/uploads', { method: 'POST', body });
  const json = await res.json();
  if (!res.ok || json.code !== 0) throw new Error(json.message || '上传失败');
  return json.data as { name: string; size: number; type: string; url: string };
}

async function createChildDocumentBelow(editor: Editor, pos: number) {
  const parentId = (editor as any).__documentId as string | undefined;
  const res = await fetch('/api/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: '未命名子文档', parent_id: parentId || null, content: '<p></p>' }),
  });
  const json = await res.json();
  const doc = json.data;
  if (!doc?.id) return;
  editor.chain().focus().insertContentAt(pos, {
    type: 'localEmbedBlock',
    attrs: { title: doc.title || '未命名子文档', desc: `/doc/${doc.id}`, kind: 'subdoc', href: `/doc/${doc.id}` },
  }).run();
}

async function insertFirstTemplateBelow(editor: Editor, pos: number) {
  const res = await fetch('/api/documents/templates/list');
  const json = await res.json();
  const template = json.data?.[0];
  if (template?.content) {
    editor.chain().focus().insertContentAt(pos, template.content).run();
    return;
  }
  editor.chain().focus().insertContentAt(pos, {
    type: 'localEmbedBlock',
    attrs: { title: '模板库为空', desc: '请先在更多菜单中保存模板', kind: 'template' },
  }).run();
}

export function getInsertBelowPosition(editor: Editor): number {
  const { $from, to } = editor.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name !== 'doc' && node.isBlock) return $from.after(d);
  }
  if (to > $from.pos) return to;
  return editor.state.doc.content.size;
}

export function insertBelowSlashItem(editor: Editor, sectionTitle: string, item: SlashMenuItem): void {
  const pos = getInsertBelowPosition(editor);
  const chain = editor.chain().focus();

  switch (item.label) {
    case '一级标题':
      chain.insertContentAt(pos, { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: '' }] }).run();
      return;
    case '二级标题':
      chain.insertContentAt(pos, { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '' }] }).run();
      return;
    case '三级标题':
      chain.insertContentAt(pos, { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: '' }] }).run();
      return;
    case '四级标题':
      chain.insertContentAt(pos, { type: 'heading', attrs: { level: 4 }, content: [{ type: 'text', text: '' }] }).run();
      return;
    case '五级标题':
      chain.insertContentAt(pos, { type: 'heading', attrs: { level: 5 }, content: [{ type: 'text', text: '' }] }).run();
      return;
    case '六级标题':
      chain.insertContentAt(pos, { type: 'heading', attrs: { level: 6 }, content: [{ type: 'text', text: '' }] }).run();
      return;
    case '有序列表':
      chain.insertContentAt(pos, {
        type: 'orderedList',
        content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }],
      }).run();
      return;
    case '无序列表':
      chain.insertContentAt(pos, {
        type: 'bulletList',
        content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }],
      }).run();
      return;
    case '任务列表':
    case '任务':
      chain.insertContentAt(pos, {
        type: 'taskList',
        content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }],
      }).run();
      return;
    case '代码块':
      chain.insertContentAt(pos, { type: 'codeBlock', attrs: { language: null } }).run();
      return;
    case '引用':
      chain.insertContentAt(pos, { type: 'blockquote', content: [{ type: 'paragraph' }] }).run();
      return;
    case '分割线':
      chain.insertContentAt(pos, { type: 'horizontalRule' }).run();
      return;
    case '高亮块':
      chain.insertContentAt(pos, {
        type: 'highlightBlock',
        attrs: { bgColor: '#fff0d9', borderColor: '#ffb057' },
        content: [{ type: 'paragraph' }],
      }).run();
      return;
    case '同步块':
      chain.insertContentAt(pos, { type: 'localSyncBlock', content: [{ type: 'paragraph' }] }).run();
      return;
    case '链接':
      window.dispatchEvent(new CustomEvent('feishu-open-page-link-dialog', { detail: { insertAt: pos } }));
      return;
    case '图片':
      pickFile('image/*', file => {
        void uploadFile(file).then(uploaded => {
          editor.chain().focus().insertContentAt(pos, { type: 'image', attrs: { src: uploaded.url, alt: uploaded.name } }).run();
        }).catch(err => {
          editor.chain().focus().insertContentAt(pos, {
            type: 'localEmbedBlock',
            attrs: { title: '图片上传失败', desc: err instanceof Error ? err.message : '图片上传失败', kind: 'image' },
          }).run();
        });
      });
      return;
    case '视频或文件':
      pickFile('video/*,application/*,*/*', file => {
        void uploadFile(file).then(uploaded => {
          editor.chain().focus().insertContentAt(pos, {
            type: 'localFileBlock',
            attrs: { name: uploaded.name, url: uploaded.url, size: uploaded.size, mime: uploaded.type },
          }).run();
        }).catch(err => {
          editor.chain().focus().insertContentAt(pos, {
            type: 'localEmbedBlock',
            attrs: { title: '上传失败', desc: err instanceof Error ? err.message : '文件上传失败', kind: 'file' },
          }).run();
        });
      });
      return;
    case '表格':
      if (sectionTitle === '多维表格') {
        chain.insertContentAt(pos, { type: 'localBitableBlock' }).run();
      } else {
        insertFeishuTableAt(editor, pos, 3, 3);
      }
      return;
    case '分栏':
      insertFeishuColumnsAt(editor, pos, 2);
      return;
    case '按钮':
      chain.insertContentAt(pos, { type: 'localButtonBlock' }).run();
      return;
    case '公式':
      chain.insertContentAt(pos, { type: 'localFormulaBlock' }).run();
      return;
    case '模板':
      void insertFirstTemplateBelow(editor, pos);
      return;
    case '子文档':
      void createChildDocumentBelow(editor, pos);
      return;
    case '看板':
      chain.insertContentAt(pos, { type: 'localEmbedBlock', attrs: { title: '看板', desc: '多维表格看板视图占位块', kind: 'kanban' } }).run();
      return;
    case '甘特图':
      chain.insertContentAt(pos, { type: 'localEmbedBlock', attrs: { title: '甘特图', desc: '多维表格甘特视图占位块', kind: 'gantt' } }).run();
      return;
    case '画册':
      chain.insertContentAt(pos, { type: 'localEmbedBlock', attrs: { title: '画册', desc: '多维表格画册视图占位块', kind: 'gallery' } }).run();
      return;
    case '画板':
      chain.insertContentAt(pos, { type: 'localEmbedBlock', attrs: { title: '画板', desc: '飞书画板占位块', kind: 'board' } }).run();
      return;
    case '思维导图':
      chain.insertContentAt(pos, { type: 'localEmbedBlock', attrs: { title: '思维导图', desc: '思维导图占位块', kind: 'mindmap' } }).run();
      return;
    case '流程图':
      chain.insertContentAt(pos, { type: 'localEmbedBlock', attrs: { title: '流程图', desc: '流程图占位块', kind: 'flowchart' } }).run();
      return;
    case 'UML 图':
      chain.insertContentAt(pos, { type: 'localEmbedBlock', attrs: { title: 'UML 图', desc: 'UML 图占位块', kind: 'uml' } }).run();
      return;
    case '人员':
      chain.insertContentAt(pos, { type: 'localEmbedBlock', attrs: { title: '人员', desc: '@成员占位块', kind: 'mention' } }).run();
      return;
    default:
      chain.insertContentAt(pos, '<p></p>').run();
  }
}
