import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { useCallback, useEffect, useRef, useState } from 'react';
import ContextMenu from './ContextMenu';
import SlashMenu from './SlashMenu';
import type { HeadingItem } from '../../types';
import { Help, Notebook, Plus } from '@icon-park/react';
import './Editor.less';

const lowlight = createLowlight(common);

const normalizeTitle = (value: string) => value === '未命名文档' ? '' : value;

/** 从当前选区解析光标所在的块级 DOM（仅悬停「+」时用于行背景） */
function getBlockDomFromEditor(editorInstance: {
  view: { dom: HTMLElement; domAtPos: (pos: number) => { node: Node; offset: number } };
  state: { selection: { from: number } };
}): HTMLElement | null {
  const root = editorInstance.view.dom as HTMLElement;
  const from = editorInstance.state.selection.from;
  const domAt = editorInstance.view.domAtPos(from);
  let n: Node | null = domAt.node;
  if (n.nodeType === Node.TEXT_NODE) n = (n as Text).parentElement;
  let el = n as HTMLElement | null;
  while (el && el !== root) {
    const tag = el.tagName?.toLowerCase() ?? '';
    if (/^(p|h[1-6]|blockquote|pre|hr)$/.test(tag)) return el;
    if (tag === 'li') return el;
    el = el.parentElement;
  }
  return null;
}

interface EditorProps {
  content: string;
  title: string;
  author: string;
  /** ISO 时间，用于展示「今天修改」等 */
  updatedAt?: string;
  /** 标题输入框当前内容（用于父级控制目录侧栏是否显示） */
  onTitleInputChange?: (displayTitle: string) => void;
  onSave: (data: { title?: string; content?: string }) => void;
  onHeadingsChange?: (headings: HeadingItem[]) => void;
  readOnly?: boolean;
}

function formatModifiedTime(iso?: string): string {
  if (!iso) return '今天修改';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '今天修改';
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dayStr = (x: Date) => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
  if (dayStr(d) === dayStr(now)) return '今天修改';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dayStr(d) === dayStr(yesterday)) return '昨天修改';
  return `${d.getMonth() + 1}月${d.getDate()}日修改`;
}

export default function Editor({
  content,
  title,
  author,
  updatedAt,
  onTitleInputChange,
  onSave,
  onHeadingsChange,
  readOnly = false,
}: EditorProps) {
  const [docTitle, setDocTitle] = useState(normalizeTitle(title));
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [slashMenuVisible, setSlashMenuVisible] = useState(false);
  const [slashMenuPos, setSlashMenuPos] = useState({ top: 0, left: 0 });
  const [slashQuery, setSlashQuery] = useState('');
  const [blockTools, setBlockTools] = useState({ visible: false, top: 0, left: 0, type: 'paragraph', isEmpty: true });
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorAreaRef = useRef<HTMLDivElement>(null);
  const menuClosedAtRef = useRef<number>(0);
  /** 当前块工具对应的块 DOM */
  const activeBlockElRef = useRef<HTMLElement | null>(null);
  const [plusHovered, setPlusHovered] = useState(false);

  const getElementBlockInfo = useCallback((target: EventTarget | null) => {
    if (!editorAreaRef.current || !(target instanceof Element)) return null;
    const block = target.closest('h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,hr') as HTMLElement | null;
    if (!block || !editorAreaRef.current.contains(block)) return null;

    let type = 'paragraph';
    const tag = block.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) type = tag;
    else if (tag === 'li') {
      if (block.closest('ul[data-type="taskList"]')) type = 'task';
      else if (block.closest('ol')) type = 'orderedList';
      else type = 'bulletList';
    } else if (tag === 'blockquote') type = 'blockquote';
    else if (tag === 'pre') type = 'codeBlock';
    else if (tag === 'hr') type = 'hr';

    const isEmpty = block.textContent?.trim() === '' && tag === 'p';
    return { element: block, type, isEmpty };
  }, []);

  const getCurrentBlockType = useCallback((editorInstance: any) => {
    for (let i = 1; i <= 6; i++) {
      if (editorInstance.isActive('heading', { level: i })) return `h${i}`;
    }
    if (editorInstance.isActive('taskList')) return 'task';
    if (editorInstance.isActive('orderedList')) return 'orderedList';
    if (editorInstance.isActive('bulletList')) return 'bulletList';
    if (editorInstance.isActive('blockquote')) return 'blockquote';
    if (editorInstance.isActive('codeBlock')) return 'codeBlock';
    return 'paragraph';
  }, []);

  const updateBlockTools = useCallback((editorInstance: any) => {
    if (readOnly || !editorAreaRef.current || !editorInstance?.view?.hasFocus?.()) {
      activeBlockElRef.current = null;
      setBlockTools(prev => ({ ...prev, visible: false }));
      return;
    }

    const { from, to } = editorInstance.state.selection;
    const isEmpty = (from === to && editorInstance.state.doc.textBetween(Math.max(0, from - 1), Math.min(editorInstance.state.doc.content.size, from + 1), ' ', '\0').trim() === '') && editorInstance.isActive('paragraph');

    const coords = editorInstance.view.coordsAtPos(from);
    const areaRect = editorAreaRef.current.getBoundingClientRect();
    const left = Math.max(areaRect.left - 40, 12);
    const top = Math.max(coords.top - 2, areaRect.top + 8);

    activeBlockElRef.current = getBlockDomFromEditor(editorInstance);

    setBlockTools({
      visible: true,
      top,
      left,
      type: getCurrentBlockType(editorInstance),
      isEmpty,
    });
  }, [getCurrentBlockType, readOnly]);

  const handleEditorMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly || !editorAreaRef.current) return;
    const info = getElementBlockInfo(e.target);
    if (!info) return;

    const rect = info.element.getBoundingClientRect();
    const areaRect = editorAreaRef.current.getBoundingClientRect();
    activeBlockElRef.current = info.element;
    setBlockTools({
      visible: true,
      top: Math.max(rect.top - 1, areaRect.top + 8),
      left: Math.max(areaRect.left - 40, 12),
      type: info.type,
      isEmpty: info.isEmpty,
    });
  }, [getElementBlockInfo, readOnly]);

  const handleEditorMouseLeave = useCallback(() => {
    setTimeout(() => {
      if (!document.querySelector('.context-menu') && !document.querySelector('.slash-menu')) {
        setPlusHovered(false);
        setBlockTools(prev => ({ ...prev, visible: false }));
      }
    }, 100);
  }, []);

  /** 指针离开整个编辑器外壳（含 Slash、右键菜单、块工具浮层）时收起面板 */
  const handleEditorWrapMouseLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return;
    setSlashMenuVisible(false);
    setContextMenu(null);
    setPlusHovered(false);
    setBlockTools(prev => ({ ...prev, visible: false }));
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5] },
        codeBlock: false,
      }),
      CodeBlockLowlight.configure({ lowlight }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'editor-link' },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'heading') return '标题';
          return '输入“/”快速插入内容';
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
    ],
    content: content || '<p></p>',
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        onSave({ content: editor.getHTML() });
      }, 1000);
      extractHeadings(editor);

      // Slash menu detection
      const { from } = editor.state.selection;
      const textBefore = editor.state.doc.textBetween(Math.max(0, from - 30), from, '\n', '\0');
      const slashIdx = textBefore.lastIndexOf('/');
      if (slashIdx !== -1) {
        const query = textBefore.slice(slashIdx + 1);
        // Only show if no space in query
        if (!query.includes(' ') && !query.includes('\n')) {
          const coords = editor.view.coordsAtPos(from);
          setSlashMenuPos({ top: coords.bottom + 4, left: coords.left });
          setSlashQuery(query);
          setSlashMenuVisible(true);
        } else {
          setSlashMenuVisible(false);
        }
      } else {
        setSlashMenuVisible(false);
      }

      updateBlockTools(editor);
    },
    onSelectionUpdate: ({ editor }) => {
      updateBlockTools(editor);
    },
    onFocus: ({ editor }) => {
      updateBlockTools(editor);
    },
    onBlur: () => {
      setTimeout(() => {
        if (!document.querySelector('.context-menu') && !document.querySelector('.slash-menu')) {
          setPlusHovered(false);
          setBlockTools(prev => ({ ...prev, visible: false }));
        }
      }, 80);
    },
  });

  const extractHeadings = useCallback((editorInstance: any) => {
    if (!onHeadingsChange || !editorInstance) return;
    const headings: HeadingItem[] = [];
    editorInstance.state.doc.descendants((node: any, pos: number) => {
      if (node.type.name === 'heading') {
        headings.push({
          level: node.attrs.level,
          text: node.textContent,
          id: `heading-${pos}`,
        });
      }
    });
    onHeadingsChange(headings);
  }, [onHeadingsChange]);

  useEffect(() => {
    if (editor && content !== undefined) {
      const currentContent = editor.getHTML();
      if (currentContent !== content && content) {
        editor.commands.setContent(content);
        extractHeadings(editor);
      }
    }
  }, [content, editor, extractHeadings]);

  useEffect(() => {
    const n = normalizeTitle(title);
    setDocTitle(n);
    onTitleInputChange?.(n);
  }, [title, onTitleInputChange]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(!readOnly);
      if (readOnly) {
        setPlusHovered(false);
        setBlockTools(prev => ({ ...prev, visible: false }));
      }
    }
  }, [readOnly, editor]);

  /** 浅蓝行背景仅在悬停「+」时出现 */
  useEffect(() => {
    const root = editorAreaRef.current?.querySelector('.tiptap');
    root?.querySelectorAll('.block-row-plus-highlight').forEach(el => {
      el.classList.remove('block-row-plus-highlight');
    });
    const row =
      plusHovered &&
      blockTools.visible &&
      blockTools.isEmpty &&
      blockTools.type === 'paragraph'
        ? activeBlockElRef.current
        : null;
    if (row?.isConnected) row.classList.add('block-row-plus-highlight');
  }, [
    plusHovered,
    blockTools.visible,
    blockTools.isEmpty,
    blockTools.type,
    blockTools.top,
    blockTools.left,
  ]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setDocTitle(newTitle);
    onTitleInputChange?.(newTitle);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      onSave({ title: newTitle });
    }, 500);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      editor?.commands.focus('start');
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (readOnly) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
    menuClosedAtRef.current = Date.now();
  };

  const openBlockConfigMenu = () => {
    // Prevent re-opening if just closed by a click (300ms cooldown)
    if (Date.now() - menuClosedAtRef.current < 300) return;
    editor?.commands.focus();
    setSlashMenuVisible(false);
    setContextMenu({ x: blockTools.left, y: blockTools.top + 30 });
  };

  const getBlockIcon = (type: string) => {
    switch (type) {
      case 'task': return '☑';
      case 'bulletList': return '•';
      case 'orderedList': return '1.';
      case 'blockquote': return '❝';
      case 'codeBlock': return '{}';
      case 'h1': return 'H1';
      case 'h2': return 'H2';
      case 'h3': return 'H3';
      case 'h4': return 'H4';
      case 'h5': return 'H5';
      case 'hr': return '—';
      default: return '⋮⋮';
    }
  };

  if (!editor) return null;

  return (
    <div className="editor-wrap" onMouseLeave={handleEditorWrapMouseLeave}>
      <div className="editor-scroll">
        <div className="editor-container">
          {/* Title */}
          <input
            className="editor-title-input"
            aria-label="文档标题"
            placeholder="请输入标题"
            value={docTitle}
            onChange={handleTitleChange}
            onKeyDown={handleTitleKeyDown}
            readOnly={readOnly}
          />

          {/* Meta */}
          <div className="editor-meta">
            <div className="meta-author">
              <div className="meta-avatar">{author.charAt(0)}</div>
              <span className="meta-name">{author}</span>
            </div>
            <span className="meta-divider">|</span>
            <span className="meta-time">{formatModifiedTime(updatedAt)}</span>
          </div>

          {/* Content */}
          <div
            ref={editorAreaRef}
            className="editor-content-area"
            aria-label="文档正文编辑区"
            onContextMenu={handleContextMenu}
            onMouseMove={handleEditorMouseMove}
            onMouseLeave={handleEditorMouseLeave}
          >
            <EditorContent editor={editor} />
          </div>
        </div>

      </div>

      <div className="editor-floating-actions" aria-label="快捷帮助">
        <button type="button" title="文档助手" aria-label="文档助手">
          <Notebook theme="outline" size={15} strokeWidth={3} fill="#646a73" />
        </button>
        <button type="button" title="帮助" aria-label="帮助">
          <Help theme="outline" size={15} strokeWidth={3} fill="#646a73" />
        </button>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          editor={editor}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeContextMenu}
        />
      )}

      {slashMenuVisible && (
        <SlashMenu
          editor={editor}
          position={slashMenuPos}
          query={slashQuery}
          onClose={() => setSlashMenuVisible(false)}
        />
      )}

      {blockTools.visible && !readOnly && (
        <div className="block-inline-tools" style={{ top: blockTools.top, left: blockTools.left }}>
          {blockTools.isEmpty && blockTools.type === 'paragraph' ? (
            <button
              className="block-add-btn"
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => {
                setPlusHovered(true);
                setSlashMenuPos({ top: blockTools.top + 30, left: blockTools.left });
                setSlashQuery('');
                setSlashMenuVisible(true);
              }}
              onMouseLeave={() => setPlusHovered(false)}
              onClick={() => {
                editor.commands.focus();
                setSlashMenuPos({ top: blockTools.top + 30, left: blockTools.left });
                setSlashQuery('');
                setSlashMenuVisible(true);
              }}
              title="点击或悬浮添加内容"
              aria-label="插入内容"
            >
              <span className="block-add-btn-icon">
                <Plus theme="outline" size={13} strokeWidth={3} fill="currentColor" />
              </span>
            </button>
          ) : (
            <div 
              className="block-drag-group"
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={openBlockConfigMenu}
              onClick={openBlockConfigMenu}
              title="块配置"
            >
              {blockTools.type !== 'paragraph' && (
                <span className="block-type-icon">{getBlockIcon(blockTools.type)}</span>
              )}
              <span className="block-drag-handle">⋮⋮</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
