import { Extension, type CommandProps } from '@tiptap/core';
import type { Editor } from '@tiptap/react';
import type { ResolvedPos } from '@tiptap/pm/model';
import { NodeSelection } from '@tiptap/pm/state';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    blockIndent: {
      increaseBlockIndent: () => ReturnType;
      decreaseBlockIndent: () => ReturnType;
    };
  }
}

export const MAX_BLOCK_INDENT = 8;
export const ATOM_INDENT_BLOCK_TYPES = ['localBitableBlock'] as const;
export type AtomIndentBlockType = (typeof ATOM_INDENT_BLOCK_TYPES)[number];

function readIndentLevel(raw: unknown): number {
  return typeof raw === 'number' && raw > 0 ? raw : 0;
}

function getActiveAtomIndentBlock(editor: Editor): AtomIndentBlockType | null {
  for (const type of ATOM_INDENT_BLOCK_TYPES) {
    if (editor.isActive(type)) return type;
  }
  return null;
}

function getAtomIndentLevel(editor: Editor, type: AtomIndentBlockType): number {
  return readIndentLevel(editor.getAttributes(type).indentLevel);
}

function resolveAtomIndentTarget(state: CommandProps['state']) {
  const { selection } = state;
  if (selection instanceof NodeSelection) {
    const typeName = selection.node.type.name;
    if (ATOM_INDENT_BLOCK_TYPES.includes(typeName as AtomIndentBlockType)) {
      return { pos: selection.from, node: selection.node };
    }
  }
  const { $from } = selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (ATOM_INDENT_BLOCK_TYPES.includes(node.type.name as AtomIndentBlockType)) {
      return { pos: $from.before(depth), node };
    }
  }
  return null;
}

function mutateAtomBlockIndent(
  state: CommandProps['state'],
  dispatch: CommandProps['dispatch'],
  delta: 1 | -1,
): boolean {
  const target = resolveAtomIndentTarget(state);
  if (!target) return false;

  const current = readIndentLevel(target.node.attrs.indentLevel);
  const next = current + delta;
  if (next < 0 || next > MAX_BLOCK_INDENT) return false;
  if (dispatch) {
    dispatch(
      state.tr.setNodeMarkup(target.pos, undefined, {
        ...target.node.attrs,
        indentLevel: next,
      }),
    );
  }
  return true;
}

function ancestorHasListOrTask($from: ResolvedPos): boolean {
  for (let depth = 0; depth < $from.depth; depth++) {
    const name = $from.node(depth).type.name;
    if (name === 'listItem' || name === 'taskItem') return true;
  }
  return false;
}

export function getBlockIndentLevel(editor: Editor): number {
  if (editor.isActive('heading')) {
    const v = editor.getAttributes('heading').indentLevel;
    return typeof v === 'number' && v > 0 ? v : 0;
  }
  const v = editor.getAttributes('paragraph').indentLevel;
  return typeof v === 'number' && v > 0 ? v : 0;
}

export interface EditorIndentUiState {
  canIncrease: boolean;
  canDecrease: boolean;
  increaseDisabledTitle?: string;
  decreaseDisabledTitle?: string;
}

/** 选区工具栏 / 右键对齐浮层共用：列表嵌套 + 正文/标题块缩进 */
export function getEditorIndentUiState(editor: Editor): EditorIndentUiState {
  const atomType = getActiveAtomIndentBlock(editor);
  if (atomType) {
    const level = getAtomIndentLevel(editor, atomType);
    const canIncrease = level < MAX_BLOCK_INDENT;
    const canDecrease = level > 0;
    return {
      canIncrease,
      canDecrease,
      ...(!canIncrease ? { increaseDisabledTitle: '当前内容块已达最大缩进层级' } : {}),
      ...(!canDecrease ? { decreaseDisabledTitle: '当前无法再减少缩进' } : {}),
    };
  }

  const inTask = editor.isActive('taskItem');
  const inList = editor.isActive('listItem');
  const canSinkList = inTask
    ? editor.can().sinkListItem('taskItem')
    : inList
      ? editor.can().sinkListItem('listItem')
      : false;
  const canLiftList = inTask
    ? editor.can().liftListItem('taskItem')
    : inList
      ? editor.can().liftListItem('listItem')
      : false;

  const blockOk = (editor.isActive('paragraph') || editor.isActive('heading')) && !inTask && !inList;
  const level = getBlockIndentLevel(editor);
  const canIncBlock = blockOk && level < MAX_BLOCK_INDENT;
  const canDecBlock = blockOk && level > 0;

  const canIncrease = canSinkList || canIncBlock;
  const canDecrease = canLiftList || canDecBlock;

  let increaseDisabledTitle: string | undefined;
  if (!canIncrease) {
    if (inTask || inList) increaseDisabledTitle = '当前内容块已达最大缩进层级';
    else if (!editor.isActive('paragraph') && !editor.isActive('heading'))
      increaseDisabledTitle = '正文或标题中可用';
    else increaseDisabledTitle = '当前内容块已达最大缩进层级';
  }

  let decreaseDisabledTitle: string | undefined;
  if (!canDecrease) {
    if (inTask || inList) decreaseDisabledTitle = '当前无法再减少缩进';
    else if (!editor.isActive('paragraph') && !editor.isActive('heading')) decreaseDisabledTitle = '正文或标题中可用';
    else decreaseDisabledTitle = '当前无法再减少缩进';
  }

  return {
    canIncrease,
    canDecrease,
    ...(increaseDisabledTitle ? { increaseDisabledTitle } : {}),
    ...(decreaseDisabledTitle ? { decreaseDisabledTitle } : {}),
  };
}

export function applyEditorIndentIncrease(editor: Editor): boolean {
  const inTask = editor.isActive('taskItem');
  const inList = editor.isActive('listItem');
  if (inTask && editor.can().sinkListItem('taskItem')) {
    return editor.chain().focus().sinkListItem('taskItem').run();
  }
  if (inList && editor.can().sinkListItem('listItem')) {
    return editor.chain().focus().sinkListItem('listItem').run();
  }
  return editor.chain().focus().increaseBlockIndent().run();
}

export function applyEditorIndentDecrease(editor: Editor): boolean {
  const inTask = editor.isActive('taskItem');
  const inList = editor.isActive('listItem');
  if (inTask && editor.can().liftListItem('taskItem')) {
    return editor.chain().focus().liftListItem('taskItem').run();
  }
  if (inList && editor.can().liftListItem('listItem')) {
    return editor.chain().focus().liftListItem('listItem').run();
  }
  return editor.chain().focus().decreaseBlockIndent().run();
}

export const BlockIndent = Extension.create({
  name: 'blockIndent',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading', ...ATOM_INDENT_BLOCK_TYPES],
        attributes: {
          indentLevel: {
            default: 0,
            parseHTML: element => {
              const raw = element.getAttribute('data-indent-level');
              if (raw == null || raw === '') return 0;
              const n = parseInt(raw, 10);
              return Number.isFinite(n) && n >= 0 ? n : 0;
            },
            renderHTML: attributes => {
              const level = attributes.indentLevel as number;
              if (!level) return {};
              return { 'data-indent-level': String(level) };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      increaseBlockIndent:
        () =>
        ({ state, dispatch }: CommandProps) => {
          if (mutateAtomBlockIndent(state, dispatch, 1)) return true;

          const { $from } = state.selection;
          if (ancestorHasListOrTask($from)) return false;

          let blockDepth: number | null = null;
          for (let d = $from.depth; d >= 0; d--) {
            const node = $from.node(d);
            if (node.type.name === 'paragraph' || node.type.name === 'heading') {
              blockDepth = d;
              break;
            }
          }
          if (blockDepth == null) return false;

          const node = $from.node(blockDepth);
          const pos = $from.before(blockDepth);
          const current = (node.attrs.indentLevel as number) ?? 0;
          if (current >= MAX_BLOCK_INDENT) return false;
          if (dispatch) {
            dispatch(
              state.tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                indentLevel: current + 1,
              }),
            );
          }
          return true;
        },

      decreaseBlockIndent:
        () =>
        ({ state, dispatch }: CommandProps) => {
          if (mutateAtomBlockIndent(state, dispatch, -1)) return true;

          const { $from } = state.selection;
          if (ancestorHasListOrTask($from)) return false;

          let blockDepth: number | null = null;
          for (let d = $from.depth; d >= 0; d--) {
            const node = $from.node(d);
            if (node.type.name === 'paragraph' || node.type.name === 'heading') {
              blockDepth = d;
              break;
            }
          }
          if (blockDepth == null) return false;

          const node = $from.node(blockDepth);
          const pos = $from.before(blockDepth);
          const current = (node.attrs.indentLevel as number) ?? 0;
          if (current <= 0) return false;
          if (dispatch) {
            const nextLevel = current - 1;
            dispatch(
              state.tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                indentLevel: nextLevel,
              }),
            );
          }
          return true;
        },
    };
  },
});
