import { Extension, type Editor } from '@tiptap/core';
import { boxSelectionStore, deleteSelectableUnits } from './boxSelectionModel';

function deleteBoxSelection(editor: Editor): boolean {
  const store = boxSelectionStore;
  if (!store?.isActive()) return false;
  const units = store.getSelectedUnits();
  if (units.length === 0) return false;
  deleteSelectableUnits(editor, units);
  store.clearSelection();
  return true;
}

/** 框选多块后 Enter / Delete / Backspace 批量删除 */
export const FeishuBoxSelectionKeyboard = Extension.create({
  name: 'feishuBoxSelectionKeyboard',
  priority: 300,

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => deleteBoxSelection(editor),
      Delete: ({ editor }) => deleteBoxSelection(editor),
      Backspace: ({ editor }) => deleteBoxSelection(editor),
      Escape: ({ editor }) => {
        if (!boxSelectionStore?.isActive()) return false;
        boxSelectionStore.clearSelection();
        editor.commands.focus();
        return true;
      },
    };
  },
});
