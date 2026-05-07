import type { Editor } from '@tiptap/react';
import type { SlashMenuItem } from './slashMenuConfig';

/** 在当前块之后插入新块的插入点（紧跟闭合标签之后） */
export function getInsertBelowPosition(editor: Editor): number {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name !== 'doc' && node.isBlock) {
      return $from.after(d);
    }
  }
  return editor.state.doc.content.size;
}

/** 右键「在下方添加」面板：按 slash 同款语义在当前块下方插入 */
export function insertBelowSlashItem(editor: Editor, sectionTitle: string, item: SlashMenuItem): void {
  const pos = getInsertBelowPosition(editor);
  const chain = editor.chain().focus();

  if (sectionTitle === '多维表格') {
    chain.insertContentAt(pos, '<p></p>').run();
    return;
  }

  switch (item.label) {
    case '一级标题':
      chain
        .insertContentAt(pos, { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: '' }] })
        .run();
      return;
    case '二级标题':
      chain
        .insertContentAt(pos, { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '' }] })
        .run();
      return;
    case '三级标题':
      chain
        .insertContentAt(pos, { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: '' }] })
        .run();
      return;
    case '有序列表':
      chain
        .insertContentAt(pos, {
          type: 'orderedList',
          content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }],
        })
        .run();
      return;
    case '无序列表':
      chain
        .insertContentAt(pos, {
          type: 'bulletList',
          content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }],
        })
        .run();
      return;
    case '任务列表':
    case '任务':
      chain
        .insertContentAt(pos, {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [{ type: 'paragraph' }],
            },
          ],
        })
        .run();
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
      chain
        .insertContentAt(
          pos,
          '<p><mark data-color="#fff7e6">\u200b</mark></p>',
        )
        .run();
      return;
    default:
      chain.insertContentAt(pos, '<p></p>').run();
  }
}
