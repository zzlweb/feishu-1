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
import './Editor.less';

const lowlight = createLowlight(common);

const normalizeTitle = (value: string) => value === '未命名文档' ? '' : value;

interface EditorProps {
  content: string;
  title: string;
  author: string;
  onSave: (data: { title?: string; content?: string }) => void;
  onHeadingsChange?: (headings: HeadingItem[]) => void;
  readOnly?: boolean;
}

export default function Editor({ content, title, author, onSave, onHeadingsChange, readOnly = false }: EditorProps) {
  const [docTitle, setDocTitle] = useState(normalizeTitle(title));
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [slashMenuVisible, setSlashMenuVisible] = useState(false);
  const [slashMenuPos, setSlashMenuPos] = useState({ top: 0, left: 0 });
  const [slashQuery, setSlashQuery] = useState('');
  const [blockTools, setBlockTools] = useState({ visible: false, top: 0, left: 0, type: 'paragraph', isEmpty: true });
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorAreaRef = useRef<HTMLDivElement>(null);

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
      setBlockTools(prev => ({ ...prev, visible: false }));
      return;
    }

    const { from, to } = editorInstance.state.selection;
    const node = editorInstance.state.doc.nodeAt(from);
    const isEmpty = (from === to && editorInstance.state.doc.textBetween(Math.max(0, from - 1), Math.min(editorInstance.state.doc.content.size, from + 1), ' ', '\0').trim() === '') && editorInstance.isActive('paragraph');

    const coords = editorInstance.view.coordsAtPos(from);
    const areaRect = editorAreaRef.current.getBoundingClientRect();
    const left = Math.max(areaRect.left - 40, 12);
    const top = Math.max(coords.top - 2, areaRect.top + 8);

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
        setBlockTools(prev => ({ ...prev, visible: false }));
      }
    }, 100);
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
    setDocTitle(normalizeTitle(title));
  }, [title]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(!readOnly);
      if (readOnly) {
        setBlockTools(prev => ({ ...prev, visible: false }));
      }
    }
  }, [readOnly, editor]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setDocTitle(newTitle);
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

  const closeContextMenu = () => setContextMenu(null);

  const openBlockConfigMenu = () => {
    editor?.commands.focus();
    setSlashMenuVisible(false);
    setContextMenu({ x: blockTools.left, y: blockTools.top + 30 });
  };

  const formatModifiedTime = () => '昨天修改';

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
    <div className="editor-wrap">
      <div className="editor-scroll">
        <div className="editor-container">
          {/* Title */}
          <input
            className="editor-title-input"
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
            <span className="meta-time">{formatModifiedTime()}</span>
          </div>

          {/* Content */}
          <div
            ref={editorAreaRef}
            className="editor-content-area"
            onContextMenu={handleContextMenu}
            onMouseMove={handleEditorMouseMove}
            onMouseLeave={handleEditorMouseLeave}
          >
            <EditorContent editor={editor} />
          </div>
        </div>

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
                setSlashMenuPos({ top: blockTools.top + 30, left: blockTools.left });
                setSlashQuery('');
                setSlashMenuVisible(true);
              }}
              onClick={() => {
                editor.commands.focus();
                setSlashMenuPos({ top: blockTools.top + 30, left: blockTools.left });
                setSlashQuery('');
                setSlashMenuVisible(true);
              }}
              title="点击或悬浮添加内容"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M11 11V5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/>
              </svg>
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
