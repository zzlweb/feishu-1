import { Extension, type Editor } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { OPERABLE_BLOCK_TYPES } from './blockOperations';
import { boxSelectionStore, collectSelectableUnits, copySelectableUnits, deleteSelectableUnits, moveSelectableUnits } from './boxSelectionModel';

function deleteBoxSelection(editor: Editor): boolean {
  const store = boxSelectionStore;
  if (!store?.isActive()) return false;
  const units = store.getSelectedUnits();
  if (units.length === 0) return false;
  deleteSelectableUnits(editor, units);
  store.clearSelection();
  return true;
}

/** 单击选中的控件块（NodeSelection）也支持 Delete / Backspace 删除 */
function deleteSelectedControlBlock(editor: Editor): boolean {
  const { selection } = editor.state;
  if (!(selection instanceof NodeSelection)) return false;
  if (!OPERABLE_BLOCK_TYPES.has(selection.node.type.name)) return false;
  return editor.chain().focus().deleteSelection().run();
}

function deleteSelectedBlocks(editor: Editor): boolean {
  return deleteBoxSelection(editor) || deleteSelectedControlBlock(editor);
}

/** 框选多块后 Enter / Delete / Backspace 批量删除 */
export const FeishuBoxSelectionKeyboard = Extension.create({
  name: 'feishuBoxSelectionKeyboard',
  priority: 300,

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => deleteBoxSelection(editor),
      Delete: ({ editor }) => deleteSelectedBlocks(editor),
      Backspace: ({ editor }) => deleteSelectedBlocks(editor),
      Escape: ({ editor }) => {
        if (!boxSelectionStore?.isActive()) return false;
        boxSelectionStore.clearSelection();
        editor.commands.focus();
        return true;
      },
      'Mod-c': ({ editor }) => {
        if (!boxSelectionStore?.isActive()) return false;
        void copySelectableUnits(editor, boxSelectionStore.getSelectedUnits());
        return true;
      },
      'Mod-a': ({ editor }) => {
        if (!boxSelectionStore || editor.state.selection.from !== editor.state.selection.to) return false;
        const active = document.activeElement;
        if (active && active !== editor.view.dom) return false;
        const units = collectSelectableUnits(editor);
        if (units.length === 0) return false;
        boxSelectionStore.selectUnits?.(units);
        return true;
      },
      'Alt-ArrowUp': ({ editor }) => {
        if (!boxSelectionStore?.isActive()) return false;
        const moved = moveSelectableUnits(editor, boxSelectionStore.getSelectedUnits(), 'up');
        if (!moved) return false;
        boxSelectionStore.clearSelection();
        return true;
      },
      'Alt-ArrowDown': ({ editor }) => {
        if (!boxSelectionStore?.isActive()) return false;
        const moved = moveSelectableUnits(editor, boxSelectionStore.getSelectedUnits(), 'down');
        if (!moved) return false;
        boxSelectionStore.clearSelection();
        return true;
      },
    };
  },
});
