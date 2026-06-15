import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MessagePlugin } from 'tdesign-react';
import { copyCurrentBlockLink } from './blockLink';
import { makeFeishuBlockId, readFeishuBlockId } from './feishuBlockId';

function blockDomAttrs(attrs: Record<string, unknown> | null | undefined) {
  const blockId = typeof attrs?.blockId === 'string' && attrs.blockId ? attrs.blockId : '';
  return blockId ? { id: blockId, 'data-block-id': blockId } : {};
}

const FORMULA_HELP_URL = 'https://katex.org/docs/supported.html';

const BLOCK_LINK_PATHS = [
  'M4.15 1.7h14.894a2 2 0 0 1 2 2v2.014h-2V3.7H4.15v14.895h2.543v2H4.15a2 2 0 0 1-2-2V3.7a2 2 0 0 1 2-2Zm17.57 5.954c1.9 1.594 2.296 4.415.703 6.313l-.443.528a1 1 0 1 1-1.532-1.286l.443-.528c.81-.965.687-2.536-.456-3.495-1.142-.959-2.71-.808-3.521.158l-2.487 2.963c-.638.761-.552 2.019.374 2.795l.675.567A1 1 0 1 1 14.19 17.2l-.675-.567c-1.683-1.412-2.04-3.919-.62-5.612l2.487-2.963c1.592-1.899 4.439-2 6.339-.405Zm-5.697 13.942c-1.593 1.898-4.44 1.999-6.34.404-1.9-1.594-2.294-4.415-.702-6.313l.443-.527a1 1 0 1 1 1.532 1.285l-.443.528c-.81.966-.687 2.537.456 3.495 1.143.96 2.711.808 3.521-.158l2.487-2.963c.639-.761.552-2.018-.373-2.795l-.676-.566a1 1 0 1 1 1.286-1.533l.675.567c1.683 1.412 2.04 3.92.62 5.613l-2.486 2.963Z',
];

const COMMENT_PATHS = [
  'M7 11a1 1 0 0 1 1-1h8a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1Z',
  'M2 5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v11.5a2 2 0 0 1-2 2h-3.812a.5.5 0 0 0-.33.124l-2.541 2.224a2 2 0 0 1-2.634 0l-2.542-2.224a.5.5 0 0 0-.329-.124H4a2 2 0 0 1-2-2V5Zm2 0v11.5h3.812a2.5 2.5 0 0 1 1.646.619L12 19.343l2.542-2.224a2.5 2.5 0 0 1 1.646-.619H20V5H4Z',
];

function renderFormulaContent(formula: string): { html: string; isRaw: boolean } {
  const trimmed = formula.trim();
  if (!trimmed) return { html: '', isRaw: false };
  try {
    const html = katex.renderToString(trimmed, {
      displayMode: false,
      throwOnError: true,
      strict: false,
    });
    return { html, isRaw: false };
  } catch {
    return { html: '', isRaw: true };
  }
}

function ToolbarIcon({ paths }: { paths: string[] }) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {paths.map((d, index) => (
        <path key={index} d={d} fill="currentColor" />
      ))}
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 2C5.925 23 1 18.075 1 12S5.925 1 12 1s11 4.925 11 11-4.925 11-11 11Zm-1-6a1 1 0 1 1 2 0 1 1 0 0 1-2 0ZM8.05 9.282a5.17 5.17 0 0 1 .039-.28c.195-1.085.689-1.883 1.481-2.394.62-.405 1.383-.608 2.288-.608 1.189 0 2.176.288 2.962.864.787.575 1.18 1.428 1.18 2.558 0 .693-.17 1.277-.513 1.752-.2.287-.584.655-1.152 1.103l-.56.44c-.305.24-.507.52-.607.84a2.742 2.742 0 0 0-.072.486.5.5 0 0 1-.498.457h-1.12a.5.5 0 0 1-.498-.546c.065-.696.134-1.136.207-1.321.137-.344.49-.74 1.058-1.188l.575-.455c.19-.144 1.166-.831 1.166-1.44 0-.608-.106-.832-.412-1.166-.305-.333-.993-.44-1.613-.44-.61 0-1.132.161-1.387.572-.118.19-.215.393-.284.6a2.097 2.097 0 0 0-.073.307.5.5 0 0 1-.493.415H8.547a.5.5 0 0 1-.497-.556Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function FormulaBlockView({ node, updateAttributes, selected, editor, getPos }: NodeViewProps) {
  const formula = String(node.attrs.formula || '');
  const hasFormula = formula.trim().length > 0;
  const isEditable = editor.isEditable;
  const [panelOpen, setPanelOpen] = useState(() => selected && isEditable && !hasFormula);
  const [panelPlacement, setPanelPlacement] = useState<'above' | 'below'>('below');
  const [draft, setDraft] = useState(formula);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!panelOpen) return;
    setDraft(formula);
    window.requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.textContent = formula;
      input.focus();
      const selection = window.getSelection();
      if (!selection) return;
      const range = document.createRange();
      range.selectNodeContents(input);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    });
  }, [formula, panelOpen]);

  useLayoutEffect(() => {
    if (!panelOpen) return;

    const updatePlacement = () => {
      const trigger = wrapperRef.current;
      const panel = panelRef.current;
      if (!trigger || !panel) return;
      const triggerRect = trigger.getBoundingClientRect();
      const panelHeight = panel.getBoundingClientRect().height;
      const spaceAbove = triggerRect.top - 12;
      const spaceBelow = window.innerHeight - triggerRect.bottom - 12;
      setPanelPlacement(spaceBelow >= panelHeight || spaceBelow >= spaceAbove ? 'below' : 'above');
    };

    updatePlacement();
    window.addEventListener('resize', updatePlacement);
    window.addEventListener('scroll', updatePlacement, true);
    return () => {
      window.removeEventListener('resize', updatePlacement);
      window.removeEventListener('scroll', updatePlacement, true);
    };
  }, [panelOpen]);

  const commitPanel = useCallback(() => {
    const next = (inputRef.current?.textContent ?? draft).trim();
    updateAttributes({ formula: next });
    setPanelOpen(false);
    window.requestAnimationFrame(() => editor.view.focus());
  }, [draft, editor, updateAttributes]);

  useEffect(() => {
    if (!panelOpen || !isEditable) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target) || wrapperRef.current?.contains(target)) return;
      commitPanel();
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [commitPanel, isEditable, panelOpen]);

  const selectThisBlock = () => {
    const pos = typeof getPos === 'function' ? getPos() : null;
    if (typeof pos === 'number') {
      editor.chain().focus().setNodeSelection(pos).run();
    }
  };

  const openPanel = () => {
    if (!isEditable) return;
    selectThisBlock();
    setPanelOpen(true);
  };

  const handleInput = () => {
    setDraft(inputRef.current?.textContent || '');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      commitPanel();
    }
  };

  const { html: formulaHtml, isRaw } = renderFormulaContent(formula);
  const blockId = readFeishuBlockId(node.attrs) || '';
  const documentId = String((editor as any).__documentId || '');

  const ensureBlockId = () => {
    const resolved = blockId || makeFeishuBlockId('localFormulaBlock');
    if (!blockId) updateAttributes({ blockId: resolved });
    return resolved;
  };

  const handleCopyLink = () => {
    ensureBlockId();
    void copyCurrentBlockLink(editor).then(url => {
      if (url) void MessagePlugin.success('已复制块链接');
    });
  };

  const handleComment = () => {
    const resolved = ensureBlockId();
    window.dispatchEvent(new CustomEvent('feishu-open-comment-sidebar', {
      detail: {
        documentId,
        blockId: resolved,
        threadId: resolved,
        anchorType: 'block',
      },
    }));
  };

  const showToolbar = hasFormula && !panelOpen && isEditable;

  return (
    <NodeViewWrapper
      className={`feishu-formula-editor${panelOpen ? ' is-configuring' : ''}${selected ? ' is-selected' : ''}${showToolbar ? ' has-toolbar' : ''}`}
      {...blockDomAttrs(node.attrs)}
      contentEditable={false}
    >
      {showToolbar && (
        <div className="docx-menu-container overlay-container block-toolbar__overlay slide-top" contentEditable={false} data-no-marquee-selection="true">
          <div
            className="panel-menu-item"
            data-name="copyAnchorLink"
            onMouseDown={event => event.preventDefault()}
            onClick={handleCopyLink}
          >
            <div className="menu-item-content">
              <div className="menu-icon universe-icon menu_ud_icon">
                <ToolbarIcon paths={BLOCK_LINK_PATHS} />
              </div>
            </div>
          </div>
          <div className="menu-divider-item" />
          <div
            className="comment-item panel-menu-item"
            data-name="comment"
            onMouseDown={event => event.preventDefault()}
            onClick={handleComment}
          >
            <div className="menu-item-content">
              <div className="menu-icon universe-icon menu_ud_icon">
                <ToolbarIcon paths={COMMENT_PATHS} />
              </div>
            </div>
          </div>
        </div>
      )}
      <div ref={wrapperRef} className="feishu-formula-editor__trigger">
        {hasFormula ? (
          <div
            className={`feishu-formula-block${isEditable ? ' feishu-formula-block--editable' : ''}`}
            onMouseDown={event => {
              if (isEditable) event.preventDefault();
            }}
            onClick={() => openPanel()}
            title={isEditable ? '点击编辑公式' : undefined}
          >
            {isRaw
              ? <span className="feishu-formula-block__text">{formula}</span>
              : <span className="feishu-formula-block__katex" dangerouslySetInnerHTML={{ __html: formulaHtml }} />}
          </div>
        ) : isEditable ? (
          <button
            type="button"
            className="feishu-formula-add-btn"
            onMouseDown={event => event.preventDefault()}
            onClick={openPanel}
          >
            添加 LaTeX 公式
          </button>
        ) : null}
      </div>
      {panelOpen && isEditable && (
        <div
          ref={panelRef}
          className={`equation-editor-popover equation-editor-popover--${panelPlacement}`}
          onMouseDown={event => event.stopPropagation()}
        >
          <div className="equation-editor-popover__content">
            <div className="editor-kit-equation-editor-wrapper">
              <div
                ref={inputRef}
                className="editor-kit-equation-editor-content"
                contentEditable
                suppressContentEditableWarning
                data-placeholder="请输入公式"
                onInput={handleInput}
                onKeyDown={handleKeyDown}
              />
            </div>
          </div>
          <div className="equation-editor-tips-wrapper">
            <div className="equation-esc-tips">按 ESC 完成输入</div>
            <a
              className="equation-editor-help"
              href={FORMULA_HELP_URL}
              target="_blank"
              rel="noopener noreferrer"
              onMouseDown={event => event.stopPropagation()}
            >
              <span className="equation-editor-help__icon">
                <HelpIcon />
              </span>
              <span>查看帮助文档</span>
            </a>
          </div>
        </div>
      )}
    </NodeViewWrapper>
  );
}
