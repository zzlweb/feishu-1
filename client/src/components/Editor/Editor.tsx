import { useEditor, EditorContent, NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type Editor as TipTapEditor, type NodeViewProps } from '@tiptap/react';
import { Mark, Node as TiptapNode } from '@tiptap/core';
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
import Image from '@tiptap/extension-image';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import { NodeSelection, Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { common, createLowlight } from 'lowlight';
import 'katex/dist/katex.min.css';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { MessagePlugin } from 'tdesign-react';
import ContextMenu from './menus/ContextMenu';
import BitableContextMenu from '../Bitable/BitableContextMenu';
import ImageContextMenu from './media/ImageContextMenu';
import TableContextMenu from './tables/TableContextMenu';
import { computeBlockPanelPosition, useHoverFloatingGroup } from './shared/floatingPanel';
import { computeTableBlockMenuPosition } from './tables/tableMenu';
import SlashMenu from './menus/SlashMenu';
import { SLASH_MENU_MAX_HEIGHT, SLASH_MENU_WIDTH, type ButtonActionType } from './menus/slashMenuConfig';
import SelectionBubble from './toolbars/SelectionBubble';
import ImageBlockToolbar from './media/ImageBlockToolbar';
import ImageCropOverlay from './media/ImageCropOverlay';
import { useImageBlockInteractions } from './media/useImageBlockInteractions';
import { getActiveImageCropSession } from './media/imageCropSession';
import { normalizeImageAlign, type ImageAlign } from './media/imageBlockUtils';
import { removeCommentHighlightsFromEditor } from './blocks/commentDocumentSync';
import { DOC_TITLE_CATALOGUE_ID, type HeadingItem } from '../../types';
import { HelpCircleIcon, BookOpenIcon } from 'tdesign-icons-react';
import { wrapIcon } from '../../icons/wrap';
import { parseJsonPayload, readApiPayload } from '../../api/http';
import { IconAddOutlined, IconDragOutlined } from '../../icons/feishuDoc';
import BlockGutterGlyph from './blocks/BlockGutterGlyph';
import EmojiPicker from './panels/EmojiPicker';
import { HighlightBlock } from './blocks/HighlightBlock';
import { DashboardChartBlock } from './blocks/DashboardChartBlock';
import { BlockIndent } from './blocks/blockIndent';
import { copyCurrentBlockLink, scrollToBlockFromHash } from './blocks/blockLink';
import { resolveListItemHighlightRect } from './blocks/blockDom';
import { normalizeHorizontalRulesOutOfLists } from './blocks/blockOperations';
import { resolveInlineBlockElementFromEditor, syncEditorSelectionToAnchoredBlock } from './blocks/blockAnchorSelection';
import { moveDraggableBlock, resolveBlockDomAtPoint, resolveDraggableBlockPos } from './blocks/feishuBlockDrag';
import { FeishuBlockBackspace } from './blocks/feishuBlockBackspace';
import { FeishuBoxSelectionKeyboard } from './blocks/feishuBoxSelectionKeyboard';
import {
  FeishuTrailingParagraph,
  findEmptyParagraphNearPoint,
  handleEditorBlankAreaClick,
  handleEditorBlankAreaDoubleClick,
} from './blocks/feishuTrailingParagraph';
import BoxBlockSelectionLayer from './blocks/FeishuBoxBlockSelection';
import { FeishuHeading, readHeadingId } from './blocks/feishuHeading';
import { FeishuBlockId, makeFeishuBlockId } from './blocks/feishuBlockId';
import { feishuTableExtensions } from './tables/feishuTable';
import { localColumnsExtensions } from './blocks/columnsExtensions';
import FeishuTableOverlay from './tables/FeishuTableOverlay';
import { CellSelection } from '@tiptap/pm/tables';
import {
  isCellSelectionInTableHost,
  resolveTableHostFromEditor,
  resolveTableHostFromElement,
} from './tables/tableDom';
import { selectTableNodeFromHost } from './tables/tableInsert';
import {
  getHeadingIdFromBlockEl,
  headingBlockHasChildren,
  syncAllHeadingCollapseStates,
} from './blocks/headingCollapse';
import { insertTableFromClipboardData } from './tables/tableInsert';
import { registerMediaUploadFile } from './media/mediaUploadRegistry';
import BitableBlockView from '../Bitable/BitableBlockView';
import './Editor.less';

const Notebook = wrapIcon(BookOpenIcon);
const Help = wrapIcon(HelpCircleIcon);

const lowlight = createLowlight(common);
const MEDIA_UPLOAD_EVENT = 'feishu-media-upload-action';
const MEDIA_UPLOAD_MAX_SIZE = 200 * 1024 * 1024;
const BLOCKED_FILE_EXTENSIONS = new Set(['exe', 'bat', 'cmd', 'sh', 'msi', 'com', 'scr', 'ps1']);
const mediaUploadFiles = new Map<string, { file: File; objectUrl?: string; controller?: AbortController }>();

function bitableToolTypeFromView(view: unknown) {
  if (view === 'gallery') return 'bitable-gallery';
  if (view === 'gantt') return 'bitable-gantt';
  if (view === 'kanban') return 'bitable-kanban';
  return 'bitable';
}

function bitableToolTypeFromElement(element: HTMLElement) {
  return bitableToolTypeFromView(element.getAttribute('data-base-view-type') || element.getAttribute('data-view'));
}

function isBitableToolType(type: string) {
  return type === 'bitable' || type === 'bitable-gallery' || type === 'bitable-gantt' || type === 'bitable-kanban';
}

function blockDomAttrs(attrs: Record<string, unknown> | null | undefined) {
  const blockId = typeof attrs?.blockId === 'string' && attrs.blockId ? attrs.blockId : '';
  return blockId ? { id: blockId, 'data-block-id': blockId } : {};
}

function createMediaId(prefix = 'media') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function getFileExtension(name: string) {
  const clean = name.split('?')[0] ?? name;
  const dot = clean.lastIndexOf('.');
  return dot >= 0 ? clean.slice(dot + 1).toLowerCase() : '';
}

function classifyMediaFile(file: File): 'image' | 'video' | 'audio' | 'document' | 'archive' | 'file' {
  const mime = file.type.toLowerCase();
  const ext = getFileExtension(file.name);
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'heic', 'heif'].includes(ext)) return 'image';
  if (mime.startsWith('video/') || ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) return 'video';
  if (mime.startsWith('audio/') || ['mp3', 'm4a', 'wav', 'ogg', 'webm'].includes(ext)) return 'audio';
  if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'csv'].includes(ext)) return 'document';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
  return 'file';
}

function canPreviewMedia(kind: string, mime = '') {
  return kind === 'image' || kind === 'video' || kind === 'audio' || mime === 'application/pdf';
}

function formatFileSize(size: number) {
  if (!size) return '0 KB';
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(2)} MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function stripFileExtension(name: string, extension = '') {
  const value = String(name || '').trim();
  if (!value || !extension) return value;
  const suffix = `.${extension}`;
  return value.toLowerCase().endsWith(suffix.toLowerCase()) ? value.slice(0, -suffix.length) : value;
}

function mediaIcon(kind: string, extension = '') {
  if (kind === 'image') return 'IMG';
  if (kind === 'video') return 'VID';
  if (kind === 'audio') return 'AUD';
  if (extension === 'pdf') return 'PDF';
  if (['doc', 'docx'].includes(extension)) return 'DOC';
  if (['xls', 'xlsx', 'csv'].includes(extension)) return 'XLS';
  if (['ppt', 'pptx'].includes(extension)) return 'PPT';
  if (kind === 'archive') return 'ZIP';
  return 'FILE';
}

type FileViewMode = 'text' | 'card' | 'preview';

function MediaToolbarIcon({ paths, rotate = false, iconClass = 'universe-icon' }: { paths: string[]; rotate?: boolean; iconClass?: string }) {
  return (
    <span className={iconClass} style={rotate ? { transform: 'rotate(90deg)' } : undefined} aria-hidden>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        {paths.map((path, index) => <path key={index} d={path} fill="currentColor" />)}
      </svg>
    </span>
  );
}

function MediaFileToolbar({
  editor,
  viewMode,
  canPreview,
  src,
  fileName,
  documentId,
  blockId,
  onViewModeChange,
  onEnsureBlockId,
  onActivateBlock,
  onFullscreen,
}: {
  editor: TipTapEditor;
  viewMode: FileViewMode;
  canPreview: boolean;
  src: string;
  fileName: string;
  documentId?: string;
  blockId?: string;
  onViewModeChange: (mode: FileViewMode) => void;
  onEnsureBlockId?: (id: string) => void;
  onActivateBlock?: () => void;
  onFullscreen?: () => void;
}) {
  const ensureLinkableBlock = () => {
    onActivateBlock?.();
    const resolved = blockId || makeFeishuBlockId('file');
    onEnsureBlockId?.(resolved);
    return resolved;
  };

  const handleDownload = () => {
    if (!src) return;
    const a = document.createElement('a');
    a.href = src;
    a.download = fileName || 'file';
    a.rel = 'noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleCopyLink = () => {
    ensureLinkableBlock();
    void copyCurrentBlockLink(editor).then(url => {
      if (url) MessagePlugin.success('已复制块链接');
    });
  };

  const handleShareLink = async () => {
    ensureLinkableBlock();
    const url = await copyCurrentBlockLink(editor);
    if (!url) return;
    if (navigator.share) {
      await navigator.share({ title: fileName || document.title, url });
      return;
    }
    MessagePlugin.success('已复制分享链接');
  };

  const openCommentSidebar = () => {
    onActivateBlock?.();
    const resolved = blockId || makeFeishuBlockId('file');
    onEnsureBlockId?.(resolved);
    window.dispatchEvent(new CustomEvent('feishu-open-comment-sidebar', {
      detail: {
        documentId,
        blockId: resolved,
        threadId: resolved,
        anchorType: 'block',
      },
    }));
  };

  const menuButton = ({
    name,
    paths,
    onClick,
    active = false,
    disabled = false,
    rotate = false,
    iconClass,
  }: {
    name: string;
    paths: string[];
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    rotate?: boolean;
    iconClass?: string;
  }) => (
    <button
      key={name}
      type="button"
      className={`panel-menu-item${active ? ' menu-item-actived' : ''}`}
      data-name={name}
      disabled={disabled}
      onMouseDown={event => event.preventDefault()}
      onClick={() => {
        if (!disabled) onClick();
      }}
    >
      <span className="menu-item-content">
        <span className="menu-icon">
          <MediaToolbarIcon paths={paths} rotate={rotate} iconClass={iconClass} />
        </span>
        <span className="menu-item-main-box-wrapper">
          <span className="menu-item-main-box" />
        </span>
      </span>
    </button>
  );

  return (
    <div className="docx-menu-container overlay-container block-toolbar__overlay slide-top feishu-file-view-toolbar" contentEditable={false} data-no-marquee-selection="true">
      {menuButton({ name: 'fullscreen', rotate: true, paths: ['M9 2a1 1 0 0 1 0 2H5.414l5.293 5.293a1 1 0 0 1-1.414 1.414L4 5.414V9a1 1 0 0 1-2 0V3a1 1 0 0 1 1-1h6Zm6 20a1 1 0 1 1 0-2h3.586l-5.293-5.293a1 1 0 0 1 1.414-1.414L20 18.586V15a1 1 0 1 1 2 0v6a1 1 0 0 1-1 1h-6Z'], onClick: () => onFullscreen?.(), disabled: !onFullscreen })}
      {menuButton({ name: 'download', paths: ['M20 18a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2a1 1 0 1 1 2 0v1h14v-1a1 1 0 0 1 1-1Zm-7-3.964 2.657-2.657a1 1 0 0 1 1.414 1.414c-1.414 1.415-2.828 2.83-4.244 4.244a1 1 0 0 1-1.412 0c-1.417-1.415-2.833-2.833-4.249-4.25a.993.993 0 0 1 .013-1.401.992.992 0 0 1 1.401-.013l2.42 2.42V3.5a1 1 0 1 1 2 0v10.536Z'], onClick: handleDownload, disabled: !src })}
      <div className="menu-divider-item" />
      {menuButton({ name: 'inline view', paths: ['M2 11a1 1 0 1 0 0 2h2a1 1 0 1 0 0-2H2Zm6 0a1 1 0 1 0 0 2h14a1 1 0 1 0 0-2H8Z'], active: viewMode === 'text', onClick: () => onViewModeChange('text') })}
      {menuButton({ name: 'card view', paths: ['M3 7.5h18c.552 0 1 .424 1 .948v7.104c0 .524-.448.948-1 .948H3c-.552 0-1-.424-1-.947V8.447c0-.524.448-.948 1-.948Zm1 2v5h16v-5H4ZM2.5 19h19c.275 0 .5.225.5.5v1c0 .275-.225.5-.5.5h-19a.501.501 0 0 1-.5-.5v-1c0-.275.225-.5.5-.5Zm0-16h19c.275 0 .5.225.5.5v1c0 .275-.225.5-.5.5h-19a.501.501 0 0 1-.5-.5v-1c0-.275.225-.5.5-.5Z'], active: viewMode === 'card', onClick: () => onViewModeChange('card') })}
      {menuButton({ name: 'preview view', paths: ['M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Zm2 0v9h14V5H5ZM4 19a1 1 0 1 0 0 2h16a1 1 0 1 0 0-2H4Z'], active: viewMode === 'preview', disabled: !canPreview, onClick: () => onViewModeChange('preview') })}
      <div className="menu-divider-item override-full-height" />
      {menuButton({ name: 'copyAnchorLink', paths: ['M4.15 1.7h14.894a2 2 0 0 1 2 2v2.014h-2V3.7H4.15v14.895h2.543v2H4.15a2 2 0 0 1-2-2V3.7a2 2 0 0 1 2-2Zm17.57 5.954c1.9 1.594 2.296 4.415.703 6.313l-.443.528a1 1 0 1 1-1.532-1.286l.443-.528c.81-.965.687-2.536-.456-3.495-1.142-.959-2.71-.808-3.521.158l-2.487 2.963c-.638.761-.552 2.019.374 2.795l.675.567A1 1 0 1 1 14.19 17.2l-.675-.567c-1.683-1.412-2.04-3.919-.62-5.612l2.487-2.963c1.592-1.899 4.439-2 6.339-.405Zm-5.697 13.942c-1.593 1.898-4.44 1.999-6.34.404-1.9-1.594-2.294-4.415-.702-6.313l.443-.527a1 1 0 1 1 1.532 1.285l-.443.528c-.81.966-.687 2.537.456 3.495 1.143.96 2.711.808 3.521-.158l2.487-2.963c.639-.761.552-2.018-.373-2.795l-.676-.566a1 1 0 1 1 1.286-1.533l.675.567c1.683 1.412 2.04 3.92.62 5.613l-2.486 2.963Z'], iconClass: 'universe-icon menu_ud_icon color-b-500', onClick: handleCopyLink })}
      {menuButton({ name: 'shareTextLink', paths: ['M21.5 5c0-.552-.473-1-1.055-1H3.555C2.974 4 2.5 4.448 2.5 5s.473 1 1.056 1h16.889c.582 0 1.055-.448 1.055-1Zm-9.617 6c.647 0 1.172.448 1.172 1s-.525 1-1.172 1h-8.21c-.648 0-1.173-.448-1.173-1s.525-1 1.173-1h8.21Zm-3.167 7c.648 0 1.173.448 1.173 1s-.525 1-1.173 1H3.673c-.648 0-1.173-.448-1.173-1s.525-1 1.173-1h5.043Zm9.077-8.242a1 1 0 0 1 1.415 0l3.535 3.535a1 1 0 0 1 0 1.415l-3.535 3.535a1 1 0 0 1-1.415-1.414l1.822-1.822c-1.819.07-3.162.64-4.065 1.543-.965.965-1.55 2.435-1.55 4.45a1 1 0 1 1-2 0c0-2.403.706-4.434 2.136-5.864 1.356-1.356 3.251-2.06 5.491-2.13l-1.834-1.834a1 1 0 0 1 0-1.414Z'], iconClass: 'universe-icon menu_ud_icon color-b-500', onClick: () => void handleShareLink() })}
      <div className="menu-divider-item" />
      {menuButton({ name: 'comment', paths: ['M7 11a1 1 0 0 1 1-1h8a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1Z', 'M2 5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v11.5a2 2 0 0 1-2 2h-3.812a.5.5 0 0 0-.33.124l-2.541 2.224a2 2 0 0 1-2.634 0l-2.542-2.224a.5.5 0 0 0-.329-.124H4a2 2 0 0 1-2-2V5Zm2 0v11.5h3.812a2.5 2.5 0 0 1 1.646.619L12 19.343l2.542-2.224a2.5 2.5 0 0 1 1.646-.619H20V5H4Z'], onClick: openCommentSidebar })}
    </div>
  );
}

function updateMediaBlockAttrs(editor: TipTapEditor, uploadId: string, attrs: Record<string, unknown>, addToHistory = false) {
  const { state, view } = editor;
  let tr = state.tr;
  let changed = false;
  state.doc.descendants((node, pos) => {
    if (node.type.name !== 'localFileBlock' || node.attrs.uploadId !== uploadId) return;
    tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs });
    changed = true;
    return false;
  });
  if (!changed) return false;
  if (!addToHistory) tr = tr.setMeta('addToHistory', false);
  view.dispatch(tr);
  return true;
}

function sanitizeEditorHtmlForSave(html: string) {
  if (typeof DOMParser === 'undefined') return html;
  const doc = new DOMParser().parseFromString(`<div data-editor-save-root="true">${html}</div>`, 'text/html');
  const root = doc.querySelector('[data-editor-save-root="true"]');
  if (!root) return html;

  root.querySelectorAll('[data-local-block="file"]').forEach(element => {
    Array.from(element.attributes).forEach(attribute => {
      if (attribute.name.toLowerCase().includes('localobjecturl')) {
        element.removeAttribute(attribute.name);
      }
    });
    element.querySelectorAll('[src^="blob:"]').forEach(media => media.removeAttribute('src'));
  });

  return root.innerHTML;
}

function uploadMediaFile(file: File, signal: AbortSignal, onProgress: (progress: number) => void) {
  return new Promise<{ name: string; size: number; type: string; url: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    signal.addEventListener('abort', abort, { once: true });
    xhr.open('POST', '/api/uploads');
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) onProgress(Math.max(1, Math.min(98, Math.round((event.loaded / event.total) * 100))));
    };
    xhr.onload = () => {
      signal.removeEventListener('abort', abort);
      try {
        const json = parseJsonPayload<{ name: string; size: number; type: string; url: string }>(xhr.responseText || '');
        if (xhr.status >= 200 && xhr.status < 300 && json.code === 0 && json.data) {
          resolve(json.data);
        } else {
          reject(new Error(json.message || `上传失败 (${xhr.status})`));
        }
      } catch (error) {
        reject(error instanceof Error ? error : new Error('上传失败'));
      }
    };
    xhr.onerror = () => {
      signal.removeEventListener('abort', abort);
      reject(new Error('网络错误，上传失败'));
    };
    xhr.onabort = () => {
      signal.removeEventListener('abort', abort);
      reject(new DOMException('上传已取消', 'AbortError'));
    };
    const form = new FormData();
    form.append('file', file);
    xhr.send(form);
  });
}

function createPendingMediaNode(file: File) {
  const uploadId = createMediaId('upload');
  const blockId = createMediaId('media');
  const extension = getFileExtension(file.name);
  const mediaKind = classifyMediaFile(file);
  const canUseLocalPreview = mediaKind === 'image' || mediaKind === 'video' || mediaKind === 'audio' || extension === 'pdf';
  const localObjectUrl = canUseLocalPreview ? URL.createObjectURL(file) : '';
  if (localObjectUrl) mediaUploadFiles.set(uploadId, { file, objectUrl: localObjectUrl });
  else mediaUploadFiles.set(uploadId, { file });
  registerMediaUploadFile(uploadId, file);
  return {
    uploadId,
    node: {
      type: 'localFileBlock',
      attrs: {
        id: blockId,
        uploadId,
        name: file.name,
        size: file.size,
        mime: file.type,
        extension,
        mediaKind,
        viewMode: mediaKind === 'image' || mediaKind === 'video' || mediaKind === 'audio' || extension === 'pdf' ? 'preview' : 'card',
        uploadStatus: 'local',
        uploadProgress: 0,
        localObjectUrl,
        errorMessage: '',
      },
    },
  };
}

function validateDroppedFile(file: File): string | null {
  const extension = getFileExtension(file.name);
  if (BLOCKED_FILE_EXTENSIONS.has(extension)) return '出于安全原因，暂不支持上传该类型文件';
  if (file.size > MEDIA_UPLOAD_MAX_SIZE) return '文件超过 200MB 限制';
  return null;
}

function startMediaUpload(editor: TipTapEditor, uploadId: string) {
  const task = mediaUploadFiles.get(uploadId);
  if (!task) {
    updateMediaBlockAttrs(editor, uploadId, { uploadStatus: 'failed', errorMessage: '本地文件已不可用' });
    return;
  }
  task.controller?.abort();
  const controller = new AbortController();
  mediaUploadFiles.set(uploadId, { ...task, controller });
  updateMediaBlockAttrs(editor, uploadId, { uploadStatus: 'uploading', uploadProgress: 1, errorMessage: '' });
  void uploadMediaFile(task.file, controller.signal, progress => {
    const blockStillExists = updateMediaBlockAttrs(editor, uploadId, { uploadStatus: 'uploading', uploadProgress: progress });
    if (!blockStillExists) controller.abort();
  }).then(result => {
    if (controller.signal.aborted) return;
    if (task.objectUrl) URL.revokeObjectURL(task.objectUrl);
    mediaUploadFiles.delete(uploadId);
    // 保留 mediaUploadRegistry 中的原始 File，便于后续裁剪无需重新 fetch
    const blockStillExists = updateMediaBlockAttrs(editor, uploadId, {
      uploadStatus: 'success',
      uploadProgress: 100,
      fileId: uploadId,
      url: result.url,
      previewUrl: result.url,
      localObjectUrl: '',
      name: result.name,
      size: result.size,
      mime: result.type,
      extension: getFileExtension(result.name),
      mediaKind: classifyMediaFile({ name: result.name, type: result.type } as File),
      errorMessage: '',
    });
    if (!blockStillExists) mediaUploadFiles.delete(uploadId);
  }).catch(error => {
    if (controller.signal.aborted) {
      updateMediaBlockAttrs(editor, uploadId, { uploadStatus: 'canceled', errorMessage: '已取消上传' });
      return;
    }
    updateMediaBlockAttrs(editor, uploadId, {
      uploadStatus: 'failed',
      errorMessage: error instanceof Error ? error.message : '上传失败',
    });
  });
}

function insertMediaFiles(editor: TipTapEditor, files: File[], insertPos?: number) {
  const valid = files.filter(file => file && !validateDroppedFile(file));
  const invalid = files.find(file => validateDroppedFile(file));
  const failedNodes = invalid
    ? [{
        type: 'localFileBlock',
        attrs: {
          id: createMediaId('media'),
          uploadId: createMediaId('upload'),
          name: invalid.name,
          size: invalid.size,
          mime: invalid.type,
          extension: getFileExtension(invalid.name),
          mediaKind: classifyMediaFile(invalid),
          viewMode: 'card',
          uploadStatus: 'failed',
          uploadProgress: 0,
          errorMessage: validateDroppedFile(invalid),
        },
      }]
    : [];
  const pending = valid.map(createPendingMediaNode);
  const nodes = [...pending.map(item => item.node), ...failedNodes];
  if (nodes.length === 0) return false;
  const pos = typeof insertPos === 'number' ? insertPos : editor.state.selection.from;
  editor.chain().focus().insertContentAt(pos, nodes).run();
  pending.forEach(item => startMediaUpload(editor, item.uploadId));
  return true;
}

const normalizeTitle = (value: string) => value === '未命名文档' ? '' : value;

const CommentHighlightMark = Mark.create({
  name: 'commentHighlight',
  inclusive: false,
  addAttributes() {
    return {
      threadId: {
        default: null,
        parseHTML: element => element.getAttribute('data-comment-thread-id'),
        renderHTML: attributes => attributes.threadId ? { 'data-comment-thread-id': attributes.threadId } : {},
      },
      blockId: {
        default: null,
        parseHTML: element => element.getAttribute('data-block-id') || element.getAttribute('id'),
        renderHTML: attributes => attributes.blockId ? { id: attributes.blockId, 'data-block-id': attributes.blockId } : {},
      },
      status: {
        default: 'open',
        parseHTML: element => element.getAttribute('data-comment-status') || 'open',
        renderHTML: attributes => ({ 'data-comment-status': attributes.status || 'open' }),
      },
      quote: {
        default: '',
        parseHTML: element => element.getAttribute('data-comment-quote') || '',
        renderHTML: attributes => attributes.quote ? { 'data-comment-quote': attributes.quote } : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-comment-thread-id]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      {
        ...HTMLAttributes,
        class: `feishu-comment-highlight${HTMLAttributes.class ? ` ${HTMLAttributes.class}` : ''}`,
      },
      0,
    ];
  },
});

function getRelatedNode(target: EventTarget | null): Node | null {
  return target instanceof Node ? target : null;
}

const BLOCK_TOOLS_OVERLAY_SELECTOR =
  '.block-inline-tools, .block-plus-menu-shell, .selection-bubble, .slash-menu, .slash-submenu-portal, .slash-table-grid-flyout, .slash-columns-count-flyout, .feishu-table-chrome, .feishu-table-chrome-mount, .context-menu, .context-submenu-flyout, .context-add-below-flyout, .feishu-columns-block__plus-menu-shell, .feishu-columns-block__col-wrap, .feishu-columns-block__add-hover-wrap, .feishu-columns-block__add-btn, .docx-menu-container, .docx-menu-wrapper.image-context-menu';

const PLUS_MENU_HOVER_BRIDGE_SELECTOR =
  '.block-inline-tools, .block-add-hover-wrap, .block-add-btn, .slash-submenu-portal, .slash-table-grid-flyout, .slash-columns-count-flyout, .slash-tooltip';

function isBlockToolsOverlayElement(element: Element | null): boolean {
  return Boolean(element?.closest(BLOCK_TOOLS_OVERLAY_SELECTOR));
}

/** 加号插入菜单：仅在与加号按钮/子菜单/tooltip 之间移动时保持打开，移入正文应关闭 */
function isPlusMenuHoverBridgeTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(PLUS_MENU_HOVER_BRIDGE_SELECTOR));
}

const CONTEXT_MENU_SHELL_SELECTOR =
  '.context-menu, .context-submenu-flyout, .context-add-below-flyout, .docx-menu-wrapper.image-context-menu, .docx-menu-wrapper.bitable-context-menu';

function isPointerInContextMenuShell(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(CONTEXT_MENU_SHELL_SELECTOR));
}

function isPointerInBlockToolsBridge(
  clientX: number,
  clientY: number,
  activeBlock: HTMLElement | null,
  areaEl: HTMLElement | null,
): boolean {
  if (!activeBlock?.isConnected || !areaEl) return false;
  const toolsEl = areaEl.querySelector('.block-inline-tools');
  if (!(toolsEl instanceof HTMLElement)) return false;
  const toolsRect = toolsEl.getBoundingClientRect();
  const blockRect = activeBlock.getBoundingClientRect();
  const bridgeLeft = Math.min(toolsRect.left, blockRect.left) - 6;
  const bridgeRight = blockRect.left + 14;
  const bridgeTop = Math.min(toolsRect.top, blockRect.top) - 8;
  const bridgeBottom = Math.max(toolsRect.bottom, blockRect.bottom) + 8;
  return (
    clientX >= bridgeLeft &&
    clientX <= bridgeRight &&
    clientY >= bridgeTop &&
    clientY <= bridgeBottom
  );
}

const BLOCK_CONTENT_SELECTOR = 'h1,h2,h3,h4,h5,h6,p,li,blockquote,pre';

function findBlockContentInColumn(columnEl: Element): HTMLElement | null {
  const inner = columnEl.querySelector(BLOCK_CONTENT_SELECTOR);
  return inner instanceof HTMLElement ? inner : null;
}

function normalizeLinkHref(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  if (/^(https?:|mailto:|tel:)/i.test(t)) return t;
  if (t.startsWith('//')) return `https:${t}`;
  if (t.startsWith('/') || t.startsWith('#')) return t;
  return `https://${t}`;
}

function computePageLinkPopPosition(editor: TipTapEditor): { top: number; left: number } {
  const gap = 8;
  const pad = 8;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 800;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 600;
  const approxPopW = Math.min(452, vw - 24);
  const approxPopH = 200;

  let coords: { top: number; bottom: number; left: number };
  try {
    coords = editor.view.coordsAtPos(editor.state.selection.head);
  } catch {
    return { top: pad, left: pad };
  }

  let top = coords.bottom + gap;
  if (top + approxPopH > vh - pad) {
    top = coords.top - approxPopH - gap;
  }
  if (top < pad) top = pad;

  let left = coords.left;
  left = Math.max(pad, Math.min(left, vw - pad - approxPopW));
  return { top, left };
}

const FeishuLink = Link.extend({
  addKeyboardShortcuts() {
    return {
      'Mod-k': () => {
        if (!this.editor.isEditable) return false;
        window.dispatchEvent(new CustomEvent('feishu-open-page-link-dialog'));
        return true;
      },
    };
  },
});

const CODE_BLOCK_LANGUAGES = [
  { label: 'Plain Text', value: 'plaintext' },
  { label: 'JavaScript', value: 'javascript' },
  { label: 'TypeScript', value: 'typescript' },
  { label: 'HTML', value: 'html' },
  { label: 'CSS', value: 'css' },
  { label: 'JSON', value: 'json' },
  { label: 'Python', value: 'python' },
  { label: 'Java', value: 'java' },
  { label: 'Go', value: 'go' },
  { label: 'SQL', value: 'sql' },
];

// ── Divider NodeView ──────────────────────────────────────────────────────────
function FeishuDividerView({ node, selected, getPos, editor }: NodeViewProps) {
  const handleClick = () => {
    if (typeof getPos === 'function') {
      const pos = getPos();
      (editor as any).commands.setNodeSelection(pos);
    }
  };
  return (
    <NodeViewWrapper
      as="div"
      className={`feishu-divider${selected ? ' feishu-divider--selected' : ''}`}
      {...blockDomAttrs(node.attrs)}
      contentEditable={false}
      onClick={handleClick}
    >
      <div className="feishu-divider__line" />
    </NodeViewWrapper>
  );
}

/** 使用官方 HorizontalRule（含 Markdown `---`/输入规则、`canInsertNode` 与安全插入光标逻辑），编辑器内用 NodeView 飞书样式替换 `<hr>` 展示 */
const FeishuHorizontalRule = HorizontalRule.extend({
  addNodeView() {
    return ReactNodeViewRenderer(FeishuDividerView);
  },

  onCreate() {
    normalizeHorizontalRulesOutOfLists(this.editor as TipTapEditor);
  },

  onUpdate() {
    normalizeHorizontalRulesOutOfLists(this.editor as TipTapEditor);
  },
});

function FeishuImageView({ node, updateAttributes, editor, getPos, selected }: NodeViewProps) {
  const align = normalizeImageAlign(node.attrs.align);
  const blockId = String(node.attrs.blockId || '');
  const src = String(node.attrs.src || '');
  const {
    captionRef,
    imageRef,
    showCaption,
    isCropping,
    cropRect,
    setCropRect,
    focusCaption,
    toggleCrop,
    handleBoundsChange,
    setAlign,
    setNodeSelection,
  } = useImageBlockInteractions({
    editor,
    getPos,
    updateAttributes,
    attrs: node.attrs,
    src,
  });

  const ensureBlockId = (id: string) => {
    if (!id || node.attrs.blockId === id) return;
    updateAttributes({ blockId: id });
  };

  return (
    <NodeViewWrapper
      className={`feishu-image-block-wrap feishu-image-block-wrap--${align}${selected ? ' is-selected' : ''}${isCropping ? ' is-cropping' : ''}`}
      {...blockDomAttrs(node.attrs)}
      contentEditable={false}
      onClick={setNodeSelection}
    >
      <ImageBlockToolbar
        editor={editor}
        align={align}
        onAlignChange={setAlign}
        onCaptionClick={focusCaption}
        onCropClick={toggleCrop}
        isCropping={isCropping}
        documentId={(editor as any).__documentId}
        blockId={blockId}
        onEnsureBlockId={ensureBlockId}
      />
      <div className={`feishu-image-block${selected ? ' is-selected' : ''}`}>
        <img
          ref={imageRef}
          className="feishu-image"
          src={src}
          alt={node.attrs.alt || ''}
          title={node.attrs.title || undefined}
          draggable={false}
        />
        {isCropping && src && (
          <ImageCropOverlay
            imageRef={imageRef}
            crop={cropRect}
            onCropChange={setCropRect}
            onBoundsChange={handleBoundsChange}
          />
        )}
      </div>
      {showCaption && (
        <input
          ref={captionRef}
          className="feishu-media-caption"
          placeholder="添加描述"
          value={node.attrs.caption || ''}
          onChange={e => updateAttributes({ caption: e.target.value })}
          onBlur={e => {
            if (!e.target.value.trim()) updateAttributes({ captionVisible: false });
          }}
          onMouseDown={e => e.stopPropagation()}
          data-no-marquee-selection="true"
        />
      )}
    </NodeViewWrapper>
  );
}

const FeishuImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: 'center',
        parseHTML: element => normalizeImageAlign(element.getAttribute('data-align')),
        renderHTML: attributes => ({ 'data-align': normalizeImageAlign(attributes.align) }),
      },
      caption: {
        default: '',
        parseHTML: element => element.getAttribute('data-caption') || '',
        renderHTML: attributes => {
          if (!attributes.caption) return {};
          return { 'data-caption': attributes.caption };
        },
      },
      captionVisible: {
        default: false,
        parseHTML: element => element.getAttribute('data-caption-visible') === 'true',
        renderHTML: attributes => {
          if (!attributes.captionVisible) return {};
          return { 'data-caption-visible': 'true' };
        },
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(FeishuImageView);
  },
});

function MediaFileBlockView({ node, updateAttributes, editor, getPos, selected }: NodeViewProps) {
  const attrs = node.attrs;
  const status = String(attrs.uploadStatus || 'success');
  const kind = String(attrs.mediaKind || classifyMediaFile({ name: attrs.name || '', type: attrs.mime || '' } as File));
  const extension = String(attrs.extension || getFileExtension(attrs.name || ''));
  const src = String(attrs.url || attrs.previewUrl || attrs.localObjectUrl || '');
  const progress = Math.max(0, Math.min(100, Number(attrs.uploadProgress || 0)));
  const viewMode = (['text', 'card', 'preview'].includes(String(attrs.viewMode)) ? String(attrs.viewMode) : (kind === 'image' ? 'preview' : 'card')) as FileViewMode;
  const isUploading = status === 'local' || status === 'uploading' || status === 'processing';
  const isFailed = status === 'failed' || status === 'canceled';
  const canPreview = Boolean(src && (canPreviewMedia(kind, attrs.mime) || extension === 'pdf'));
  const isImagePreview = kind === 'image' && viewMode === 'preview' && canPreview;
  const isFilePreview = kind !== 'image' && viewMode === 'preview' && canPreview;
  const isVideoPreview = kind === 'video' && viewMode === 'preview' && canPreview;
  const [videoActivated, setVideoActivated] = useState(false);
  const mediaPreviewRef = useRef<HTMLDivElement>(null);
  const align = normalizeImageAlign(attrs.align);
  const blockId = String(attrs.blockId || attrs.id || '');
  const {
    captionRef,
    imageRef,
    showCaption,
    isCropping,
    cropRect,
    setCropRect,
    focusCaption,
    toggleCrop,
    handleBoundsChange,
    setAlign,
    setNodeSelection,
  } = useImageBlockInteractions({
    editor,
    getPos,
    updateAttributes,
    attrs,
    src,
    isLocalFileBlock: true,
    uploadId: String(attrs.uploadId || ''),
  });
  const retryUpload = () => {
    window.dispatchEvent(new CustomEvent(MEDIA_UPLOAD_EVENT, { detail: { action: 'retry', uploadId: attrs.uploadId } }));
  };
  const cancelUpload = () => {
    window.dispatchEvent(new CustomEvent(MEDIA_UPLOAD_EVENT, { detail: { action: 'cancel', uploadId: attrs.uploadId } }));
    updateAttributes({ uploadStatus: 'canceled', errorMessage: '已取消上传' });
  };
  const copyLink = () => {
    if (attrs.url) void navigator.clipboard?.writeText(String(attrs.url));
  };
  const setViewMode = (mode: FileViewMode) => updateAttributes({ viewMode: mode });
  const deleteNode = () => {
    const pos = typeof getPos === 'function' ? getPos() : null;
    if (typeof pos !== 'number') return;
    editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
  };
  const ensureBlockId = (id: string) => {
    if (!id) return;
    const patch: Record<string, string> = {};
    if (attrs.blockId !== id) patch.blockId = id;
    if (attrs.id !== id) patch.id = id;
    if (Object.keys(patch).length) updateAttributes(patch);
  };

  return (
    <NodeViewWrapper
      as="div"
      className={`feishu-file-block feishu-file-block--${kind} feishu-file-block--${viewMode}${isImagePreview ? ` feishu-file-block--image-preview feishu-image-block-wrap feishu-image-block-wrap--${align}` : ''}${isVideoPreview ? ` feishu-file-block--video-preview feishu-image-block-wrap feishu-image-block-wrap--${align}` : ''}${selected ? ' is-selected' : ''}${isCropping ? ' is-cropping' : ''}`}
      data-local-block="file"
      data-upload-id={attrs.uploadId}
      data-upload-status={status}
      {...blockDomAttrs(attrs)}
      contentEditable={false}
      onClick={setNodeSelection}
    >
      {kind !== 'image' && (
        <MediaFileToolbar
          editor={editor}
          viewMode={viewMode}
          canPreview={canPreview}
          src={src}
          fileName={String(attrs.name || 'file')}
          documentId={(editor as any).__documentId}
          blockId={blockId}
          onViewModeChange={setViewMode}
          onEnsureBlockId={ensureBlockId}
          onActivateBlock={setNodeSelection}
          onFullscreen={viewMode === 'preview' && canPreview ? () => {
            const el = mediaPreviewRef.current;
            if (el?.requestFullscreen) void el.requestFullscreen();
          } : undefined}
        />
      )}
      {isImagePreview && (
        <ImageBlockToolbar
          editor={editor}
          align={align}
          onAlignChange={setAlign}
          onCaptionClick={focusCaption}
          onCropClick={toggleCrop}
          isCropping={isCropping}
          documentId={(editor as any).__documentId}
          blockId={blockId}
          onEnsureBlockId={ensureBlockId}
        />
      )}
      {viewMode === 'preview' && canPreview && (
        <div ref={mediaPreviewRef} className={`feishu-media-preview feishu-media-preview--${kind}`} data-no-marquee-selection="true">
          {kind === 'image' && (
            <>
              <img ref={imageRef} className="feishu-media-preview__image" src={src} alt={attrs.name || 'image'} draggable={false} />
              {isCropping && src && (
                <ImageCropOverlay
                  imageRef={imageRef}
                  crop={cropRect}
                  onCropChange={setCropRect}
                  onBoundsChange={handleBoundsChange}
                />
              )}
            </>
          )}
          {kind === 'video' && (
            <div className="feishu-media-preview__video-shell">
              <video
                className="feishu-media-preview__video"
                src={src}
                controls={videoActivated}
                preload="metadata"
                data-no-marquee-selection="true"
                onPlay={() => setVideoActivated(true)}
                onPause={() => setVideoActivated(false)}
              />
              <div className="feishu-media-preview__video-title">
                <span className="feishu-media-preview__video-file-icon">VID</span>
                <span>{stripFileExtension(String(attrs.name || '视频'), extension)}</span>
              </div>
              {!videoActivated && (
                <button
                  type="button"
                  className="feishu-media-preview__play"
                  aria-label="播放视频"
                  onMouseDown={event => event.preventDefault()}
                  onClick={event => {
                    setVideoActivated(true);
                    const video = event.currentTarget.closest('.feishu-media-preview')?.querySelector('video') as HTMLVideoElement | null;
                    void video?.play();
                  }}
                >
                  <span aria-hidden />
                </button>
              )}
            </div>
          )}
          {kind === 'audio' && <audio className="feishu-media-preview__audio" src={src} controls preload="metadata" data-no-marquee-selection="true" />}
          {extension === 'pdf' && <iframe className="feishu-media-preview__pdf" src={src} title={attrs.name || 'PDF'} sandbox="allow-same-origin allow-scripts" />}
          {isFilePreview && kind !== 'video' && (
            <div className="feishu-media-preview__meta">
              <span className="feishu-media-preview__file-icon">{mediaIcon(kind, extension)}</span>
              <span className="feishu-media-preview__name" title={attrs.name}>{attrs.name || '文件'}</span>
              <span className="feishu-media-preview__desc">
                {isUploading ? `上传中 ${progress}%` : isFailed ? (attrs.errorMessage || '上传失败') : formatFileSize(Number(attrs.size || 0))}
              </span>
              {isUploading && (
                <div className="feishu-media-progress" aria-label={`上传进度 ${progress}%`}>
                  <span style={{ width: `${progress}%` }} />
                </div>
              )}
              <div className="feishu-file-actions" data-no-marquee-selection="true">
                {isFailed && <button type="button" onMouseDown={e => e.preventDefault()} onClick={retryUpload}>重试</button>}
                {isUploading && <button type="button" onMouseDown={e => e.preventDefault()} onClick={cancelUpload}>取消</button>}
                {attrs.url && <button type="button" onMouseDown={e => e.preventDefault()} onClick={copyLink}>复制链接</button>}
                {attrs.url && <a href={attrs.url} download={attrs.name || 'file'} onMouseDown={e => e.stopPropagation()}>下载</a>}
                <button type="button" className="is-danger" onMouseDown={e => e.preventDefault()} onClick={deleteNode}>删除</button>
              </div>
            </div>
          )}
        </div>
      )}

      {viewMode === 'text' ? (
        <div className="feishu-file-text" title={attrs.name}>
          <span className="feishu-file-text__icon">{mediaIcon(kind, extension)}</span>
          <span className="feishu-file-text__name">{attrs.name || '文件'}</span>
          <span className="feishu-file-text__meta">{formatFileSize(Number(attrs.size || 0))}</span>
        </div>
      ) : !isImagePreview && !isFilePreview ? (
        <div className={`feishu-local-card feishu-local-card--file feishu-local-card--${kind}`}>
          <div className="feishu-local-card__icon">{mediaIcon(kind, extension)}</div>
          <div className="feishu-local-card__body">
            <div className="feishu-local-card__title" title={attrs.name}>{attrs.name || '文件'}</div>
            <div className="feishu-local-card__desc">
              {isUploading ? `上传中 ${progress}%` : isFailed ? (attrs.errorMessage || '上传失败') : `${formatFileSize(Number(attrs.size || 0))} · ${extension || attrs.mime || '文件'}`}
            </div>
            {isUploading && (
              <div className="feishu-media-progress" aria-label={`上传进度 ${progress}%`}>
                <span style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
          <div className="feishu-file-actions" data-no-marquee-selection="true">
            {isFailed && <button type="button" onMouseDown={e => e.preventDefault()} onClick={retryUpload}>重试</button>}
            {isUploading && <button type="button" onMouseDown={e => e.preventDefault()} onClick={cancelUpload}>取消</button>}
            {attrs.url && <button type="button" onMouseDown={e => e.preventDefault()} onClick={copyLink}>复制链接</button>}
            {attrs.url && <a href={attrs.url} download={attrs.name || 'file'} onMouseDown={e => e.stopPropagation()}>下载</a>}
            <button type="button" className="is-danger" onMouseDown={e => e.preventDefault()} onClick={deleteNode}>删除</button>
          </div>
        </div>
      ) : null}
      {kind === 'image' && showCaption && (
        <input
          ref={captionRef}
          className="feishu-media-caption"
          placeholder="添加描述"
          value={attrs.caption || ''}
          onChange={e => updateAttributes({ caption: e.target.value })}
          onBlur={e => {
            if (!e.target.value.trim()) updateAttributes({ captionVisible: false });
          }}
          onMouseDown={e => e.stopPropagation()}
          data-no-marquee-selection="true"
        />
      )}
    </NodeViewWrapper>
  );
}

const LocalFileBlock = TiptapNode.create({
  name: 'localFileBlock',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      id: { default: null },
      uploadId: { default: null },
      fileId: { default: '' },
      name: { default: '文件' },
      url: { default: '' },
      previewUrl: { default: '' },
      thumbnailUrl: { default: '' },
      localObjectUrl: { default: '' },
      size: { default: 0 },
      mime: { default: '' },
      extension: { default: '' },
      mediaKind: { default: 'file' },
      viewMode: { default: 'card' },
      uploadStatus: { default: 'success' },
      uploadProgress: { default: 100 },
      errorMessage: { default: '' },
      displayWidth: { default: null },
      displayHeight: { default: null },
      caption: { default: '' },
      captionVisible: {
        default: false,
        parseHTML: element => element.getAttribute('data-caption-visible') === 'true',
        renderHTML: attributes => {
          if (!attributes.captionVisible) return {};
          return { 'data-caption-visible': 'true' };
        },
      },
      align: {
        default: 'center',
        parseHTML: element => normalizeImageAlign(element.getAttribute('data-align')),
        renderHTML: attributes => ({ 'data-align': normalizeImageAlign(attributes.align) }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-local-block="file"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      {
        ...HTMLAttributes,
        'data-local-block': 'file',
        'data-upload-id': HTMLAttributes.uploadId,
        'data-upload-status': HTMLAttributes.uploadStatus,
        class: `feishu-file-block feishu-file-block--${HTMLAttributes.mediaKind || 'file'}`,
      },
      HTMLAttributes.name || '文件',
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(MediaFileBlockView);
  },
});

const LocalDivTableBlock = TiptapNode.create({
  name: 'localDivTableBlock',
  group: 'block',
  atom: true,
  addAttributes() {
    return { rows: { default: 3 }, cols: { default: 3 }, header: { default: false } };
  },
  parseHTML() {
    return [{ tag: 'div[data-local-block="div-table"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    const rows = Math.max(1, Number(HTMLAttributes.rows || 3));
    const cols = Math.max(1, Number(HTMLAttributes.cols || 3));
    const hasHeader = HTMLAttributes.header === true || HTMLAttributes.header === 'true';
    const tableRows = Array.from({ length: rows }, (_, rowIndex) => [
      'div',
      { class: 'feishu-div-table__row' },
      ...Array.from({ length: cols }, (_, colIndex) => [
        'div',
        { class: `feishu-div-table__cell${hasHeader && rowIndex === 0 ? ' feishu-div-table__cell--header' : ''}${colIndex === cols - 1 ? ' feishu-div-table__cell--last-col' : ''}${rowIndex === rows - 1 ? ' feishu-div-table__cell--last-row' : ''}` },
        ['span', { class: 'feishu-div-table__placeholder' }, ''],
      ]),
    ]);
    return ['div', { ...HTMLAttributes, 'data-local-block': 'div-table', class: 'feishu-div-table', style: `--feishu-table-cols:${cols}` }, ...tableRows];
  },
});

const LocalSyncBlock = TiptapNode.create({
  name: 'localSyncBlock',
  group: 'block',
  content: 'block+',
  addAttributes() {
    return {
      syncId: {
        default: null,
        parseHTML: element => element.getAttribute('data-sync-id'),
        renderHTML: attributes => ({ 'data-sync-id': attributes.syncId }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-local-block="sync"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    const syncId = HTMLAttributes.syncId || HTMLAttributes['data-sync-id'] || '';
    return ['div', { ...HTMLAttributes, 'data-local-block': 'sync', class: 'feishu-sync-block' }, ['div', { class: 'feishu-sync-block__label' }, syncId ? `同步块 · ${String(syncId).slice(-6)}` : '同步块'], ['div', { class: 'feishu-sync-block__content' }, 0]];
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('feishuSyncBlockMirror'),
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some(tr => tr.docChanged) || transactions.some(tr => tr.getMeta('feishuSyncBlockMirror'))) return null;
          let activeSyncId = '';
          const { $from } = newState.selection;
          for (let depth = $from.depth; depth > 0; depth -= 1) {
            const node = $from.node(depth);
            if (node.type.name === 'localSyncBlock') {
              activeSyncId = String(node.attrs.syncId || '');
              break;
            }
          }

          const groups = new Map<string, Array<{ pos: number; node: any }>>();
          newState.doc.descendants((node, pos) => {
            if (node.type.name !== 'localSyncBlock') return;
            const syncId = String(node.attrs.syncId || '');
            if (!syncId) return;
            const group = groups.get(syncId);
            if (group) group.push({ pos, node });
            else groups.set(syncId, [{ pos, node }]);
          });

          let tr = newState.tr;
          let changed = false;
          groups.forEach((items, syncId) => {
            if (items.length < 2) return;
            const source = (syncId === activeSyncId ? items.find(item => {
              const from = item.pos;
              const to = item.pos + item.node.nodeSize;
              return newState.selection.from >= from && newState.selection.from <= to;
            }) : null) ?? items[0];
            items.forEach(item => {
              if (item === source || item.node.content.eq(source.node.content)) return;
              tr = tr.replaceWith(
                item.pos,
                item.pos + item.node.nodeSize,
                item.node.type.create(item.node.attrs, source.node.content, item.node.marks),
              );
              changed = true;
            });
          });
          if (!changed) return null;
          tr.setMeta('feishuSyncBlockMirror', true);
          return tr;
        },
      }),
    ];
  },
});

function normalizeBlockUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  if (/^(https?:|mailto:|tel:)/i.test(t)) return t;
  if (t.startsWith('//')) return `https:${t}`;
  if (t.startsWith('/') || t.startsWith('#')) return t;
  return `https://${t}`;
}

const BUTTON_ACTION_LABELS: Record<ButtonActionType, string> = {
  link: '打开超链接',
  duplicate: '创建副本',
  follow: '关注文档更新',
};

function normalizeButtonActionType(raw: unknown): ButtonActionType {
  if (raw === 'duplicate' || raw === 'follow') return raw;
  return 'link';
}

type ButtonColorName =
  | 'red'
  | 'orange'
  | 'green'
  | 'wathet'
  | 'blue'
  | 'carmine'
  | 'purple'
  | 'neutral'
  | 'red-solid'
  | 'orange-solid'
  | 'green-solid'
  | 'wathet-solid'
  | 'blue-solid'
  | 'carmine-solid'
  | 'purple-solid'
  | 'neutral-solid';

const BUTTON_COLORS: Array<{ name: ButtonColorName; bg: string; text: string; border: string }> = [
  { name: 'red', bg: '#fde2e2', text: '#d83931', border: '#f8b4b4' },
  { name: 'orange', bg: '#fee7c8', text: '#de7802', border: '#f8c98b' },
  { name: 'green', bg: '#d9f5d6', text: '#2ea121', border: '#a9df9f' },
  { name: 'wathet', bg: '#d9f3fd', text: '#0797d9', border: '#a6ddf5' },
  { name: 'blue', bg: '#dfeaff', text: '#245bdb', border: '#8fb2ff' },
  { name: 'carmine', bg: '#f9d9ee', text: '#c5267a', border: '#efadd5' },
  { name: 'purple', bg: '#eadffb', text: '#7f3bf5', border: '#c7adf6' },
  { name: 'neutral', bg: '#eff0f1', text: '#646a73', border: '#d8dadf' },
  { name: 'red-solid', bg: '#f65a55', text: '#ffffff', border: '#f65a55' },
  { name: 'orange-solid', bg: '#ff9d2e', text: '#ffffff', border: '#ff9d2e' },
  { name: 'green-solid', bg: '#4cc94a', text: '#ffffff', border: '#4cc94a' },
  { name: 'wathet-solid', bg: '#1fb6e9', text: '#ffffff', border: '#1fb6e9' },
  { name: 'blue-solid', bg: '#336df4', text: '#ffffff', border: '#336df4' },
  { name: 'carmine-solid', bg: '#e83e9f', text: '#ffffff', border: '#e83e9f' },
  { name: 'purple-solid', bg: '#8b4cec', text: '#ffffff', border: '#8b4cec' },
  { name: 'neutral-solid', bg: '#2b3038', text: '#ffffff', border: '#2b3038' },
];

function normalizeButtonColor(raw: unknown): ButtonColorName {
  return BUTTON_COLORS.some(item => item.name === raw) ? raw as ButtonColorName : 'blue';
}

function getButtonColor(name: unknown) {
  return BUTTON_COLORS.find(item => item.name === normalizeButtonColor(name)) ?? BUTTON_COLORS[4];
}

function LocalButtonBlockView({ node, updateAttributes, selected, editor, getPos }: NodeViewProps) {
  const actionType = normalizeButtonActionType(node.attrs.actionType);
  const colorName = normalizeButtonColor(node.attrs.color);
  const color = getButtonColor(colorName);
  const text = node.attrs.text || '按钮';
  const url = node.attrs.url || '';
  const [panelOpen, setPanelOpen] = useState(() => selected && editor.isEditable);
  const [panelPlacement, setPanelPlacement] = useState<'above' | 'below'>('below');
  const [draftText, setDraftText] = useState(text);
  const [draftActionType, setDraftActionType] = useState<ButtonActionType>(actionType);
  const [draftUrl, setDraftUrl] = useState(url);
  const [draftColor, setDraftColor] = useState<ButtonColorName>(colorName);
  const previewButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLFormElement>(null);
  const documentId = String((editor as any).__documentId || '');
  const isFollowed = actionType === 'follow' && documentId
    ? window.localStorage.getItem(`feishu-follow-doc:${documentId}`) === 'true'
    : false;

  useEffect(() => {
    if (!panelOpen) return;
    setDraftText(text);
    setDraftActionType(actionType);
    setDraftUrl(url);
    setDraftColor(colorName);
  }, [actionType, colorName, panelOpen, text, url]);

  useLayoutEffect(() => {
    if (!panelOpen) return;

    const updatePlacement = () => {
      const trigger = previewButtonRef.current;
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
  }, [draftActionType, panelOpen]);

  const runButtonAction = async () => {
    const href = normalizeBlockUrl(url);
    if (actionType === 'link') {
      if (href) window.open(href, '_blank', 'noopener,noreferrer');
      else void MessagePlugin.warning('请先填写链接地址');
      return;
    }

    if (actionType === 'duplicate') {
      if (!documentId) {
        void MessagePlugin.warning('当前文档尚未保存，暂无法创建副本');
        return;
      }
      try {
        const res = await fetch(`/api/documents/${documentId}/duplicate`, { method: 'POST' });
        const json = await readApiPayload<{ id: string }>(res);
        if (!res.ok || json.code !== 0 || !json.data?.id) throw new Error(json.message || '创建副本失败');
        void MessagePlugin.success('已创建副本');
        window.open(`/doc/${json.data.id}`, '_blank', 'noopener,noreferrer');
      } catch (error) {
        void MessagePlugin.error(error instanceof Error ? error.message : '创建副本失败');
      }
      return;
    }

    if (!documentId) {
      void MessagePlugin.warning('当前文档尚未保存，暂无法关注');
      return;
    }
    const key = `feishu-follow-doc:${documentId}`;
    const next = window.localStorage.getItem(key) !== 'true';
    window.localStorage.setItem(key, String(next));
    void MessagePlugin.success(next ? '已关注文档更新' : '已取消关注');
  };

  const selectThisButton = () => {
    const pos = typeof getPos === 'function' ? getPos() : null;
    if (typeof pos === 'number') {
      editor.chain().focus().setNodeSelection(pos).run();
    }
  };

  const openPanel = () => {
    selectThisButton();
    setPanelOpen(true);
  };

  const confirmPanel = () => {
    if (draftActionType === 'link' && !draftUrl.trim()) {
      void MessagePlugin.warning('请填写链接地址');
      return;
    }
    const nextText = draftText.trim() || BUTTON_ACTION_LABELS[draftActionType];
    updateAttributes({
      text: nextText,
      actionType: draftActionType,
      url: draftActionType === 'link' ? draftUrl.trim() : '',
      color: draftColor,
    });
    setPanelOpen(false);
    window.requestAnimationFrame(() => editor.view.focus());
  };

  const cancelPanel = () => {
    setDraftText(text);
    setDraftActionType(actionType);
    setDraftUrl(url);
    setDraftColor(colorName);
    setPanelOpen(false);
    window.requestAnimationFrame(() => editor.view.focus());
  };

  const buttonStyle = {
    '--button-bg': color.bg,
    '--button-color': color.text,
    '--button-border': color.border,
  } as CSSProperties;

  return (
    <NodeViewWrapper
      className={`feishu-button-block feishu-button-block--${actionType}${panelOpen ? ' is-configuring' : ''}${selected ? ' is-selected' : ''}`}
      {...blockDomAttrs(node.attrs)}
      contentEditable={false}
    >
      <div className="feishu-button-block__preview">
        <button
          ref={previewButtonRef}
          type="button"
          className="feishu-action-button"
          style={buttonStyle}
          onMouseDown={event => event.preventDefault()}
          onClick={event => {
            if (!editor.isEditable) {
              void runButtonAction();
              return;
            }
            if (event.shiftKey || (actionType === 'link' && !url.trim())) {
              openPanel();
              return;
            }
            if (!selected) {
              selectThisButton();
              return;
            }
            void runButtonAction();
          }}
          title={editor.isEditable && url.trim() ? '首次点击选中按钮，再次点击执行；Shift + 点击编辑按钮' : undefined}
        >
          {text}
        </button>
      </div>
      {panelOpen && editor.isEditable && (
        <form
          ref={panelRef}
          className={`button-panel button-panel--${panelPlacement}`}
          onMouseDown={event => event.stopPropagation()}
          onSubmit={event => {
            event.preventDefault();
            confirmPanel();
          }}
        >
          <div className="button-panel__content">
            <label className="button-panel__form-item">
              <span className="button-panel__label">按钮文字</span>
              <input
                className="button-panel__input"
                value={draftText}
                placeholder="请输入按钮"
                autoFocus
                onChange={event => setDraftText(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Escape') cancelPanel();
                }}
              />
            </label>
            <div className="button-panel__form-item">
              <span className="button-panel__label">按钮颜色</span>
              <div className="docx-button-color-picker">
                {[BUTTON_COLORS.slice(0, 8), BUTTON_COLORS.slice(8)].map((group, index) => (
                  <div key={index} className="docx-button-color-picker__group">
                    {group.map(item => (
                      <button
                        key={item.name}
                        type="button"
                        className={`docx-button-color-picker__item${draftColor === item.name ? ' selected' : ''}`}
                        style={{ background: item.bg }}
                        aria-label={item.name}
                        onClick={() => setDraftColor(item.name)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <label className="button-panel__form-item">
              <span className="button-panel__label">执行操作</span>
              <select
                className="button-panel__select"
                value={draftActionType}
                onChange={event => {
                  const nextType = normalizeButtonActionType(event.target.value);
                  setDraftActionType(nextType);
                  if (!draftText.trim() || draftText === BUTTON_ACTION_LABELS[draftActionType]) {
                    setDraftText(BUTTON_ACTION_LABELS[nextType]);
                  }
                }}
              >
                <option value="link">打开超链接</option>
                <option value="duplicate">创建副本</option>
                <option value="follow">关注文档更新</option>
              </select>
            </label>
            {draftActionType === 'link' && (
              <label className="button-panel__form-item">
                <span className="button-panel__label">超链接地址</span>
                <input
                  className="button-panel__input"
                  value={draftUrl}
                  placeholder="请输入链接地址"
                  onChange={event => setDraftUrl(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Escape') cancelPanel();
                  }}
                />
              </label>
            )}
          </div>
          <div className="button-panel__footer">
            <button type="button" className="button-panel__btn button-panel__btn--cancel" onClick={cancelPanel}>取消</button>
            <button type="submit" className="button-panel__btn button-panel__btn--confirm">确定</button>
          </div>
        </form>
      )}
      <div className="feishu-button-block__form">
        <select
          className="feishu-block-field feishu-button-block__type"
          value={actionType}
          onChange={e => {
            const nextType = normalizeButtonActionType(e.target.value);
            updateAttributes({
              actionType: nextType,
              text: text === BUTTON_ACTION_LABELS[actionType] ? BUTTON_ACTION_LABELS[nextType] : text,
            });
          }}
        >
          <option value="link">打开超链接</option>
          <option value="duplicate">创建副本</option>
          <option value="follow">关注文档更新</option>
        </select>
        <input
          className="feishu-block-field"
          value={text}
          placeholder="按钮文字"
          onChange={e => updateAttributes({ text: e.target.value })}
        />
        {actionType === 'link' ? (
          <input
            className="feishu-block-field"
            value={url}
            placeholder="链接或页面地址"
            onChange={e => updateAttributes({ url: e.target.value })}
          />
        ) : (
          <span className="feishu-button-block__hint">
            {actionType === 'duplicate'
              ? '点击按钮会复制当前文档并打开副本'
              : isFollowed ? '当前文档已关注' : '点击按钮会关注当前文档更新'}
          </span>
        )}
      </div>
    </NodeViewWrapper>
  );
}

const LocalButtonBlock = TiptapNode.create({
  name: 'localButtonBlock',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      text: {
        default: '按钮',
        parseHTML: element => element.getAttribute('data-text') || element.textContent || '按钮',
        renderHTML: attributes => ({ 'data-text': attributes.text }),
      },
      actionType: {
        default: 'link',
        parseHTML: element => normalizeButtonActionType(element.getAttribute('data-action-type')),
        renderHTML: attributes => ({ 'data-action-type': normalizeButtonActionType(attributes.actionType) }),
      },
      url: {
        default: '',
        parseHTML: element => element.getAttribute('data-url') || '',
        renderHTML: attributes => ({ 'data-url': attributes.url }),
      },
      color: {
        default: 'blue',
        parseHTML: element => normalizeButtonColor(element.getAttribute('data-color')),
        renderHTML: attributes => ({ 'data-color': normalizeButtonColor(attributes.color) }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-local-block="button"]' }, { tag: 'button[data-local-block="button"]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const { text, url, actionType: rawActionType, color: rawColor } = node.attrs;
    const href = normalizeBlockUrl(String(url || ''));
    const actionType = normalizeButtonActionType(rawActionType);
    const color = getButtonColor(rawColor);
    const button = ['span', {
      class: 'feishu-action-button',
      style: `--button-bg: ${color.bg}; --button-color: ${color.text}; --button-border: ${color.border};`,
    }, text || '按钮'];
    return ['div', { ...HTMLAttributes, 'data-local-block': 'button', class: `feishu-button-block feishu-button-block--${actionType}` },
      actionType === 'link' && href
        ? ['a', { href, target: '_blank', rel: 'noopener noreferrer', class: 'feishu-button-block__link' }, button]
        : button,
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(LocalButtonBlockView);
  },
});

import { FormulaBlockView } from './blocks/FormulaBlockView';

const LocalFormulaBlock = TiptapNode.create({
  name: 'localFormulaBlock',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      formula: {
        default: '',
        parseHTML: element => element.getAttribute('data-formula') || element.textContent || '',
        renderHTML: attributes => ({ 'data-formula': attributes.formula || '' }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-local-block="formula"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', { ...HTMLAttributes, 'data-local-block': 'formula', class: 'feishu-formula-block' }, HTMLAttributes.formula || ''];
  },
  addNodeView() {
    return ReactNodeViewRenderer(FormulaBlockView);
  },
});

const LocalBitableBlock = TiptapNode.create({
  name: 'localBitableBlock',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      title: {
        default: '多维表格',
        parseHTML: element => element.getAttribute('data-title') || '多维表格',
        renderHTML: attributes => ({ 'data-title': attributes.title }),
      },
      columns: {
        default: '',
        parseHTML: element => element.getAttribute('data-columns') || '',
        renderHTML: attributes => ({ 'data-columns': attributes.columns }),
      },
      rows: {
        default: '',
        parseHTML: element => element.getAttribute('data-rows') || '',
        renderHTML: attributes => ({ 'data-rows': attributes.rows }),
      },
      view: {
        default: '',
        parseHTML: element => {
          const value = element.getAttribute('data-view');
          return value === 'gallery' || value === 'grid' || value === 'gantt' || value === 'kanban' ? value : '';
        },
        renderHTML: attributes => ({ 'data-view': ['gallery', 'gantt', 'kanban'].includes(attributes.view) ? attributes.view : 'grid' }),
      },
      covers: {
        default: '',
        parseHTML: element => element.getAttribute('data-covers') || '',
        renderHTML: attributes => ({ 'data-covers': attributes.covers || '' }),
      },
      model: {
        default: '',
        parseHTML: element => element.getAttribute('data-model') || '',
        renderHTML: attributes => ({ 'data-model': attributes.model || '' }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-local-block="bitable"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', { ...HTMLAttributes, 'data-local-block': 'bitable', class: 'feishu-bitable-block feishu-base-block' },
      ['div', { class: 'base-viewbar' }, HTMLAttributes.title || '多维表格'],
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(BitableBlockView);
  },
});

interface DocNavLink {
  label: string;
  href?: string;
}

function readDocNavLinks(value: unknown): DocNavLink[] {
  if (Array.isArray(value)) {
    const links: DocNavLink[] = [];
    value.forEach(item => {
      if (!item || typeof item !== 'object') return;
        const record = item as Record<string, unknown>;
        const label = typeof record.label === 'string' ? record.label.trim() : '';
        const href = typeof record.href === 'string' ? record.href.trim() : '';
      if (label) links.push(href ? { label, href } : { label });
    });
    return links;
  }
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    return readDocNavLinks(JSON.parse(value));
  } catch {
    return value
      .split('|')
      .map(label => label.trim())
      .filter(Boolean)
      .map(label => ({ label }));
  }
}

function LocalDocNavBlockView({ node, selected }: NodeViewProps) {
  const links = readDocNavLinks(node.attrs.links);
  return (
    <NodeViewWrapper
      className={`feishu-doc-nav${selected ? ' is-selected' : ''}`}
      data-local-block="doc-nav"
      contentEditable={false}
    >
      <span className="feishu-doc-nav__anchor" aria-hidden>🔗</span>
      <div className="feishu-doc-nav__links">
        {links.map((link, index) => (
          <span className="feishu-doc-nav__item" key={`${link.label}-${index}`}>
            {index > 0 && <span className="feishu-doc-nav__separator">|</span>}
            {link.href ? (
              <a className="feishu-doc-nav__link" href={normalizeBlockUrl(link.href)} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            ) : (
              <span className="feishu-doc-nav__link">{link.label}</span>
            )}
          </span>
        ))}
      </div>
    </NodeViewWrapper>
  );
}

const LocalDocNavBlock = TiptapNode.create({
  name: 'localDocNavBlock',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      links: {
        default: [],
        parseHTML: element => readDocNavLinks(element.getAttribute('data-links') || element.textContent || ''),
        renderHTML: attributes => ({ 'data-links': JSON.stringify(readDocNavLinks(attributes.links)) }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-local-block="doc-nav"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', { ...HTMLAttributes, 'data-local-block': 'doc-nav', class: 'feishu-doc-nav' }];
  },
  addNodeView() {
    return ReactNodeViewRenderer(LocalDocNavBlockView);
  },
});

const EMBED_KIND_META: Record<string, { icon: string; title: string; desc: string }> = {
  bitable: { icon: '▦', title: '多维表格', desc: '表格视图' },
  kanban: { icon: '▤', title: '看板', desc: '多维表格看板视图' },
  gantt: { icon: '↔', title: '甘特图', desc: '多维表格甘特视图' },
  gallery: { icon: '▧', title: '画册', desc: '多维表格画册视图' },
  board: { icon: '✎', title: '画板', desc: '白板内容' },
  mindmap: { icon: '◎', title: '思维导图', desc: '脑图内容' },
  flowchart: { icon: '◇', title: '流程图', desc: '流程图内容' },
  uml: { icon: 'U', title: 'UML 图', desc: 'UML 图内容' },
  mention: { icon: '@', title: '人员', desc: '@成员' },
  template: { icon: '▣', title: '模板', desc: '模板内容' },
  group: { icon: '💬', title: '社群', desc: '飞书群组' },
  subdoc: { icon: '↗', title: '子文档', desc: '页面链接' },
  image: { icon: '□', title: '图片', desc: '图片上传状态' },
  file: { icon: '⇩', title: '文件', desc: '文件上传状态' },
  embed: { icon: '+', title: '内容块', desc: '' },
};

function LocalEmbedBlockView({ node, updateAttributes, selected, editor, getPos }: NodeViewProps) {
  const kind = String(node.attrs.kind || 'embed');
  const meta = EMBED_KIND_META[kind] || EMBED_KIND_META.embed;
  const title = node.attrs.title || meta.title;
  const desc = node.attrs.desc || meta.desc;
  const href = node.attrs.href || '';
  const normalizedHref = normalizeBlockUrl(href);
  const isEditing = selected && editor.isEditable;
  const actionText = kind === 'group' || kind === 'chat_card' ? '加入' : '打开';
  const selectThisBlock = (event: React.MouseEvent) => {
    if ((event.target as Element).closest('input, button, a')) return;
    const pos = typeof getPos === 'function' ? getPos() : null;
    if (typeof pos === 'number') {
      editor.chain().focus().setNodeSelection(pos).run();
    }
  };

  return (
    <NodeViewWrapper
      className={`feishu-local-card feishu-local-card--${kind}${selected ? ' is-selected' : ''}`}
      data-local-block="embed"
      {...blockDomAttrs(node.attrs)}
      contentEditable={false}
      onMouseDown={selectThisBlock}
    >
      <div className="feishu-local-card__icon">{meta.icon}</div>
      <div className="feishu-local-card__body">
        {isEditing ? (
          <>
            <input
              className="feishu-local-card__title-input"
              value={title}
              placeholder={meta.title}
              onChange={e => updateAttributes({ title: e.target.value })}
            />
            <input
              className="feishu-local-card__desc-input"
              value={desc}
              placeholder={meta.desc}
              onChange={e => updateAttributes({ desc: e.target.value })}
            />
          </>
        ) : (
          <>
            <div className="feishu-local-card__title" title={title}>{title}</div>
            {desc && <div className="feishu-local-card__desc">{desc}</div>}
          </>
        )}
      </div>
      {isEditing && (kind === 'subdoc' || href) && (
        <input
          className="feishu-local-card__href-input"
          value={href}
          placeholder="/doc/..."
          onChange={e => updateAttributes({ href: e.target.value })}
        />
      )}
      {normalizedHref && (
        <a className="feishu-local-card__action" href={normalizedHref} target="_blank" rel="noreferrer">
          {actionText}
        </a>
      )}
    </NodeViewWrapper>
  );
}

const LocalEmbedBlock = TiptapNode.create({
  name: 'localEmbedBlock',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      title: {
        default: '内容块',
        parseHTML: element => element.getAttribute('data-title') || element.querySelector('.feishu-local-card__title')?.textContent || '内容块',
        renderHTML: attributes => ({ 'data-title': attributes.title }),
      },
      desc: {
        default: '',
        parseHTML: element => element.getAttribute('data-desc') || element.querySelector('.feishu-local-card__desc')?.textContent || '',
        renderHTML: attributes => ({ 'data-desc': attributes.desc }),
      },
      kind: {
        default: 'embed',
        parseHTML: element => element.getAttribute('data-kind') || 'embed',
        renderHTML: attributes => ({ 'data-kind': attributes.kind }),
      },
      href: {
        default: '',
        parseHTML: element => element.getAttribute('href') || element.getAttribute('data-href') || '',
        renderHTML: attributes => ({ 'data-href': attributes.href }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-local-block="embed"]' }, { tag: 'a[data-local-block="embed"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    const content = [['div', { class: 'feishu-local-card__icon' }, '＋'], ['div', { class: 'feishu-local-card__body' }, ['div', { class: 'feishu-local-card__title' }, HTMLAttributes.title || '内容块'], ['div', { class: 'feishu-local-card__desc' }, HTMLAttributes.desc || '']]];
    if (HTMLAttributes.href) {
      return ['a', { ...HTMLAttributes, href: HTMLAttributes.href, 'data-local-block': 'embed', class: `feishu-local-card feishu-local-card--link feishu-local-card--${HTMLAttributes.kind || 'embed'}` }, ...content];
    }
    return ['div', { ...HTMLAttributes, 'data-local-block': 'embed', class: `feishu-local-card feishu-local-card--${HTMLAttributes.kind || 'embed'}` }, ...content];
  },
  addNodeView() {
    return ReactNodeViewRenderer(LocalEmbedBlockView);
  },
});

// ── Code Block NodeView ───────────────────────────────────────────────────────
function FeishuCodeBlockView({ node, updateAttributes }: any) {
  const [wrap, setWrap] = useState(false);
  const language = node.attrs.language || 'plaintext';
  const copyCode = () => {
    void navigator.clipboard?.writeText(node.textContent || '');
  };

  return (
    <NodeViewWrapper className={`feishu-code-block${wrap ? ' feishu-code-block--wrap' : ''}`} {...blockDomAttrs(node.attrs)}>
      <div className="feishu-code-block__toolbar" contentEditable={false}>
        <span className="feishu-code-block__title">代码块</span>
        <div className="feishu-code-block__actions">
          <select
            className="feishu-code-block__language"
            value={language}
            onChange={e => updateAttributes({ language: e.target.value })}
          >
            {CODE_BLOCK_LANGUAGES.map(item => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
          <button type="button" className="feishu-code-block__action" onClick={() => setWrap(v => !v)}>
            自动换行
          </button>
          <button type="button" className="feishu-code-block__action" onClick={copyCode}>
            复制
          </button>
        </div>
      </div>
      <pre className="feishu-code-block__pre">
        <NodeViewContent as="code" className="feishu-code-block__content" />
      </pre>
    </NodeViewWrapper>
  );
}

const FeishuCodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(FeishuCodeBlockView);
  },
});

const editorExtensions = [
  StarterKit.configure({
    heading: false,
    codeBlock: false,
    horizontalRule: false,
  }),
  FeishuHeading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
  FeishuBlockId,
  CommentHighlightMark,
  FeishuHorizontalRule,
  FeishuCodeBlock.configure({ lowlight }),
  Underline,
  FeishuLink.configure({
    openOnClick: false,
    HTMLAttributes: { class: 'editor-link' },
  }),
  TaskList,
  TaskItem.configure({ nested: true }),
  FeishuImage.configure({
    inline: false,
    allowBase64: true,
    HTMLAttributes: { class: 'feishu-image' },
  }),
  LocalFileBlock,
  ...localColumnsExtensions,
  LocalDivTableBlock,
  ...feishuTableExtensions,
  LocalSyncBlock,
  LocalButtonBlock,
  LocalFormulaBlock,
  LocalBitableBlock,
  DashboardChartBlock,
  LocalDocNavBlock,
  LocalEmbedBlock,
  Placeholder.configure({
    includeChildren: false,
    showOnlyCurrent: false,
    placeholder: ({ node }) => {
      if (node.type.name === 'heading') {
        const level = typeof node.attrs.level === 'number' ? node.attrs.level : 2;
        return `H${level}`;
      }
      return '';
    },
  }),
  TextAlign.configure({
    types: ['heading', 'paragraph'],
  }),
  BlockIndent,
  TextStyle,
  Color,
  Highlight.configure({
    multicolor: true,
  }),
  HighlightBlock,
  FeishuBlockBackspace,
  FeishuTrailingParagraph,
  FeishuBoxSelectionKeyboard,
];

/** 从当前选区解析光标所在的块级 DOM（仅悬停「+」时用于行背景） */
function getBlockDomFromEditor(editorInstance: {
  view: { dom: HTMLElement; domAtPos: (pos: number) => { node: Node; offset: number }; nodeDOM?: (pos: number) => Node | null | undefined };
  state: { selection: { from: number } };
}): HTMLElement | null {
  const root = editorInstance.view.dom as HTMLElement;
  const from = editorInstance.state.selection.from;

  // For NodeSelection (atom nodes like divider), domAtPos may point to the root.
  // Use nodeDOM to directly get the NodeView DOM element.
  try {
    const nodeEl = editorInstance.view.nodeDOM?.(from);
    if (nodeEl instanceof Element && root.contains(nodeEl)) {
      const atomBlock = nodeEl.closest?.('.feishu-button-block, .feishu-formula-editor, .feishu-local-card, .feishu-bitable-block, .feishu-div-table, .feishu-file-block, .feishu-sync-block') as HTMLElement | null;
      if (atomBlock && root.contains(atomBlock)) return atomBlock;
      const divider = (nodeEl as HTMLElement).classList?.contains('feishu-divider')
        ? (nodeEl as HTMLElement)
        : (nodeEl.querySelector?.('.feishu-divider') as HTMLElement | null);
      if (divider) return divider;
    }
  } catch { /* ignore */ }

  const domAt = editorInstance.view.domAtPos(from);
  let n: Node | null = domAt.node;
  if (n.nodeType === Node.TEXT_NODE) n = (n as Text).parentElement;
  let el = n as HTMLElement | null;
  while (el && el !== root) {
    const feishuCodeBlock = el.closest?.('.feishu-code-block') as HTMLElement | null;
    if (feishuCodeBlock && root.contains(feishuCodeBlock)) return feishuCodeBlock;
    const highlightBlock = el.closest?.('.feishu-highlight-block') as HTMLElement | null;
    if (highlightBlock && root.contains(highlightBlock)) return highlightBlock;
    const dividerWrapper = el.closest?.('.feishu-divider') as HTMLElement | null;
    if (dividerWrapper && root.contains(dividerWrapper)) return dividerWrapper;
    const tableHost = resolveTableHostFromElement(el);
    if (tableHost && root.contains(tableHost)) return tableHost;
    const imageBlock = el.closest?.('.feishu-image-block-wrap, .feishu-file-block--image') as HTMLElement | null;
    if (imageBlock && root.contains(imageBlock)) return imageBlock;
    const tag = el.tagName?.toLowerCase() ?? '';
    if (/^(p|h[1-6]|blockquote|pre|hr)$/.test(tag)) return el;
    if (tag === 'li') return el;
    el = el.parentElement;
  }
  return null;
}

/**
 * ProseMirror `view.hasFocus()` 仅当 document.activeElement === 编辑器根节点时为 true。
 * 个别浏览器/场景下焦点落在 contenteditable 内部节点，导致块柄被误判隐藏。
 * TipTap 的 isFocused 及对 activeElement 的 contains 检测作为补充。
 */
function isEditorTypingFocused(editorInstance: {
  isFocused?: boolean;
  view?: { dom: HTMLElement; hasFocus: () => boolean };
}): boolean {
  if (editorInstance.isFocused) return true;
  const view = editorInstance.view;
  if (!view) return false;
  if (view.hasFocus()) return true;
  if (typeof document === 'undefined') return false;
  const ae = document.activeElement;
  return Boolean(ae && view.dom.contains(ae));
}

const CATALOGUE_IGNORED_HEADING_ANCESTORS = new Set([
  'blockquote',
  'highlightBlock',
  'listItem',
  'taskItem',
  'tableCell',
  'localColumnBlock',
]);

function isCatalogueHeading(state: any, pos: number, node: any): boolean {
  if (node.type.name !== 'heading') return false;
  const text = String(node.textContent ?? '').trim();
  if (!text) return false;
  const $pos = state.doc.resolve(pos);
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const ancestorName = $pos.node(depth).type.name;
    if (CATALOGUE_IGNORED_HEADING_ANCESTORS.has(ancestorName)) return false;
  }
  return true;
}

/** 侧栏块柄纵轴：标题与首行文字中线对齐，其它块用块级盒子垂直中心 */
/** 与 extractHeadings 一致：仅正文主线非空标题进目录；光标在标题内或所属正文上方最近一节 */
function resolveCatalogueActiveId(editorInstance: any): string | null {
  if (!editorInstance?.state) return null;
  const { state } = editorInstance;
  const from = state.selection.from;
  const $from = state.selection.$from;

  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (!isCatalogueHeading(state, $from.before(d), node)) continue;
    return readHeadingId(node.attrs) ?? null;
  }

  let lastId: string | null = null;
  state.doc.descendants((node: any, pos: number) => {
    if (pos >= from) return false;
    if (!isCatalogueHeading(state, pos, node)) return;
    lastId = readHeadingId(node.attrs);
  });
  return lastId;
}

function getBlockToolsAnchorTop(
  editorInstance: {
    view: {
      posAtDOM: (node: Node, offset: number) => number;
      coordsAtPos: (pos: number) => { top: number; bottom: number };
    };
  },
  blockEl: HTMLElement,
  areaRectTop: number,
): number {
  const rr = blockEl.getBoundingClientRect();
  const textSpan = measureTextBlockVerticalSpan(editorInstance, blockEl);
  if (textSpan) {
    const spanCenter = (textSpan.top + textSpan.bottom) / 2;
    if (
      Number.isFinite(spanCenter)
      && spanCenter >= rr.top - 12
      && spanCenter <= rr.bottom + 12
    ) {
      return spanCenter - areaRectTop;
    }
  }
  if (blockEl.classList.contains('feishu-code-block')) {
    const toolbar = blockEl.querySelector('.feishu-code-block__toolbar') as HTMLElement | null;
    const tr = toolbar?.getBoundingClientRect();
    if (tr) return tr.top + tr.height / 2 - areaRectTop;
  }
  if (blockEl.classList.contains('tableWrapper') || blockEl.classList.contains('feishu-table-host')) {
    return rr.top + 20 - areaRectTop;
  }
  if (blockEl.classList.contains('feishu-bitable-block')) {
    const viewbar = blockEl.querySelector('.base-viewbar') as HTMLElement | null;
    const viewbarRect = viewbar?.getBoundingClientRect();
    return viewbarRect
      ? viewbarRect.top + viewbarRect.height / 2 - areaRectTop
      : rr.top + 20 - areaRectTop;
  }
  if (
    blockEl.classList.contains('feishu-image-block-wrap')
    || blockEl.classList.contains('feishu-file-block--image')
  ) {
    return rr.top + 20 - areaRectTop;
  }
  return rr.top + rr.height / 2 - areaRectTop;
}

function readBitableBlockShift(blockEl: HTMLElement) {
  const raw = getComputedStyle(blockEl).getPropertyValue('--bitable-block-shift').trim();
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : 0;
}

function readBitableHeaderFollowX(blockEl: HTMLElement) {
  const followRaw = getComputedStyle(blockEl).getPropertyValue('--bitable-grid-header-follow-x').trim();
  if (followRaw) {
    const follow = Number.parseFloat(followRaw);
    if (Number.isFinite(follow)) return follow;
  }
  return readBitableBlockShift(blockEl);
}

function getBlockToolsAnchorLeft(blockEl: HTMLElement, areaRectLeft: number, columnContent: HTMLElement | null): number {
  if (columnContent) return columnContent.getBoundingClientRect().left - areaRectLeft;
  if (blockEl.classList.contains('feishu-bitable-block')) {
    const viewType = blockEl.getAttribute('data-base-view-type');
    const followX = readBitableHeaderFollowX(blockEl);
    if (viewType === 'gallery' || viewType === 'kanban') {
      const page = blockEl.querySelector('.base-viewbar__page') as HTMLElement | null;
      const anchorRect = page?.getBoundingClientRect() ?? blockEl.getBoundingClientRect();
      return anchorRect.left - areaRectLeft - followX;
    }
    const blockRect = blockEl.getBoundingClientRect();
    return blockRect.left - areaRectLeft - followX;
  }
  return 0;
}

const TEXT_BLOCK_HIGHLIGHT_TAGS = /^(p|h[1-6]|li|blockquote)$/;
function resolveBlockRowHighlightRect(
  _editorInstance: {
    view: {
      posAtDOM: (node: Node, offset: number) => number;
      coordsAtPos: (pos: number) => { top: number; bottom: number };
    };
  } | null | undefined,
  blockEl: HTMLElement,
  areaRect: DOMRect,
  columnContent: HTMLElement | null,
): { top: number; left: number; width: number; height: number } {
  const contentRight = columnContent?.isConnected
    ? columnContent.getBoundingClientRect().right
    : areaRect.right;

  if (blockEl.tagName.toLowerCase() === 'li') {
    const listRect = resolveListItemHighlightRect(blockEl, contentRight);
    return {
      top: listRect.top - areaRect.top,
      left: listRect.left - areaRect.left,
      width: listRect.width,
      height: listRect.height,
    };
  }

  const width = columnContent?.isConnected
    ? columnContent.getBoundingClientRect().width
    : areaRect.width;
  const left = columnContent?.isConnected
    ? columnContent.getBoundingClientRect().left - areaRect.left
    : 0;
  const blockRect = blockEl.getBoundingClientRect();
  return {
    top: blockRect.top - areaRect.top,
    left,
    width,
    height: blockRect.height,
  };
}

function measureTextBlockVerticalSpan(
  editorInstance: {
    view: {
      posAtDOM: (node: Node, offset: number) => number;
      coordsAtPos: (pos: number) => { top: number; bottom: number };
    };
  },
  blockEl: HTMLElement,
): { top: number; bottom: number } | null {
  if (!TEXT_BLOCK_HIGHLIGHT_TAGS.test(blockEl.tagName.toLowerCase())) return null;
  try {
    const { view } = editorInstance;
    const startPos = view.posAtDOM(blockEl, 0);
    const endPos = view.posAtDOM(blockEl, blockEl.childNodes.length);
    const startCoords = view.coordsAtPos(startPos);
    if (endPos <= startPos) {
      return { top: startCoords.top, bottom: startCoords.bottom };
    }
    const endCoords = view.coordsAtPos(endPos - 1);
    return {
      top: Math.min(startCoords.top, endCoords.top),
      bottom: Math.max(startCoords.bottom, endCoords.bottom),
    };
  } catch {
    return null;
  }
}

function computePlusMenuPosition(
  anchor: DOMRect,
  _menuW = SLASH_MENU_WIDTH,
  menuH = SLASH_MENU_MAX_HEIGHT,
  pad = 8,
  gap = 0,
): { top: number; left: number } {
  const vh = window.innerHeight;
  const left = anchor.left + gap;
  const visibleMenuH = Math.min(menuH, vh - pad * 2);
  const top = Math.max(
    pad,
    Math.min(anchor.top + anchor.height / 2 - visibleMenuH / 2, vh - pad - visibleMenuH),
  );
  return { top, left };
}

/** 默认封面图 URL（占位） */
const DEFAULT_COVER_URL = '/static/01.gif';

interface EditorProps {
  documentId: string;
  content: string;
  title: string;
  author: string;
  /** ISO 时间，用于展示「今天修改」等 */
  updatedAt?: string;
  /** 文档图标 emoji */
  icon?: string;
  /** 文档封面 URL */
  coverUrl?: string;
  /** 标题输入框展示用快照（可选，供父级等使用） */
  onTitleInputChange?: (displayTitle: string) => void;
  onSave: (data: { title?: string; content?: string; icon?: string; cover_url?: string }) => void;
  onHeadingsChange?: (headings: HeadingItem[]) => void;
  /** 侧栏目录高亮：文档标题焦点、正文光标所在章节 */
  onCatalogueActiveIdChange?: (id: string | null) => void;
  readOnly?: boolean;
  /** 当前折叠的标题 id 集合 */
  collapsedHeadingIds?: Set<string>;
  /** 切换标题折叠 */
  onToggleHeadingCollapse?: (headingId: string) => void;
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
  documentId,
  content,
  title,
  author,
  updatedAt,
  icon,
  coverUrl,
  onTitleInputChange,
  onSave,
  onHeadingsChange,
  onCatalogueActiveIdChange,
  readOnly = false,
  collapsedHeadingIds,
  onToggleHeadingCollapse,
}: EditorProps) {
  const [docTitle, setDocTitle] = useState(normalizeTitle(title));
  const [docIcon, setDocIcon] = useState(icon || '');
  const [docCover, setDocCover] = useState(coverUrl || '');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [titleHovered, setTitleHovered] = useState(false);
  const emojiPickerAnchorRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    variant: 'block' | 'table' | 'image' | 'bitable';
  } | null>(null);
  const [slashMenuVisible, setSlashMenuVisible] = useState(false);
  const [slashMenuPos, setSlashMenuPos] = useState({ top: 0, left: 0 });
  const [slashQuery, setSlashQuery] = useState('');
  const [slashMenuFromPlus, setSlashMenuFromPlus] = useState(false);
  const [slashMenuFromTableCellPlus, setSlashMenuFromTableCellPlus] = useState(false);
  const [pageLinkDialogVisible, setPageLinkDialogVisible] = useState(false);
  const [pageLinkPopPos, setPageLinkPopPos] = useState({ top: 0, left: 0 });
  const [pageLinkText, setPageLinkText] = useState('');
  const [pageLinkUrl, setPageLinkUrl] = useState('');
  const [fileDropState, setFileDropState] = useState<{
    visible: boolean;
    top: number;
    left: number;
    width: number;
    count: number;
    disabled?: boolean;
  } | null>(null);
  const [blockTools, setBlockTools] = useState({
    visible: false,
    top: 0,
    left: 0,
    type: 'paragraph',
    isEmpty: true,
    isInColumns: false,
  });
  const [activeTableHost, setActiveTableHost] = useState<HTMLElement | null>(null);
  const [tableHandleHovered, setTableHandleHovered] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEditorPointerRef = useRef<{ x: number; y: number } | null>(null);
  const contextMenuCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorAreaRef = useRef<HTMLDivElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const blockAddButtonRef = useRef<HTMLButtonElement>(null);
  const blockDragRowRef = useRef<HTMLButtonElement>(null);
  const tableHandleRef = useRef<HTMLButtonElement>(null);
  /** 「在下方添加」打开链接弹窗时在 confirm 用 insertContentAt */
  const pageLinkInsertPosRef = useRef<number | null>(null);
  const menuClosedAtRef = useRef<number>(0);
  /** 当前块工具对应的块 DOM */
  const activeBlockElRef = useRef<HTMLElement | null>(null);
  const [plusHovered, setPlusHovered] = useState(false);
  const [blockGutterHovered, setBlockGutterHovered] = useState(false);
  const [rowHighlightBand, setRowHighlightBand] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [blockDragIndicator, setBlockDragIndicator] = useState<{ top: number; left: number; width: number } | null>(null);
  const blockDragPreviewRef = useRef<HTMLElement | null>(null);
  const blockDragStateRef = useRef<{
    source: HTMLElement;
    startX: number;
    startY: number;
    dragging: boolean;
    dropTarget: HTMLElement | null;
    placement: 'before' | 'after';
  } | null>(null);

  const setBlockGutterHoveredState = useCallback((value: boolean) => {
    setBlockGutterHovered(value);
  }, []);

  const setPlusHoveredState = useCallback((value: boolean) => {
    setPlusHovered(value);
  }, []);
  const catalogueActiveCbRef = useRef<EditorProps['onCatalogueActiveIdChange']>(undefined);
  const editorRefForCatalogue = useRef<any>(null);
  catalogueActiveCbRef.current = onCatalogueActiveIdChange;

  /** 切换标题折叠状态 */
  const toggleHeadingCollapse = useCallback(() => {
    const blockEl = activeBlockElRef.current;
    const ed = editorRefForCatalogue.current;
    if (!blockEl || !onToggleHeadingCollapse || !ed) return;
    const headingId = getHeadingIdFromBlockEl(ed, blockEl);
    if (!headingId) return;
    onToggleHeadingCollapse(headingId);
  }, [onToggleHeadingCollapse]);

  const closeSlashMenu = useCallback(() => {
    setSlashMenuVisible(false);
    setSlashMenuFromPlus(false);
    setSlashMenuFromTableCellPlus(false);
  }, []);

  const openPlusMenu = useCallback(() => {
    if (readOnly) return;
    const btn = blockAddButtonRef.current;
    if (btn?.isConnected) {
      setSlashMenuPos(computePlusMenuPosition(btn.getBoundingClientRect()));
    }
    if (slashMenuVisible && slashMenuFromPlus) return;
      setContextMenu(null);
      setSlashMenuFromTableCellPlus(false);
      setPlusHoveredState(true);
    setSlashMenuFromPlus(true);
    setSlashQuery('');
    setSlashMenuVisible(true);
  }, [readOnly, setPlusHoveredState, slashMenuFromPlus, slashMenuVisible]);

  const cancelContextMenuClose = useCallback(() => {
    if (contextMenuCloseTimerRef.current) {
      clearTimeout(contextMenuCloseTimerRef.current);
      contextMenuCloseTimerRef.current = null;
    }
  }, []);

  const handleCatalogueTitleFocus = useCallback(() => {
    const cb = catalogueActiveCbRef.current;
    if (!cb) return;
    cb(docTitle.trim().length ? DOC_TITLE_CATALOGUE_ID : null);
  }, [docTitle]);

  const handleCatalogueTitleBlur = useCallback(() => {
    window.setTimeout(() => {
      const cb = catalogueActiveCbRef.current;
      if (!cb) return;
      const ae = document.activeElement;
      if (ae instanceof Element && ae.matches('.editor-title-input')) return;
      if (ae instanceof Element && ae.closest('.catalogue-aside')) return;
      const ed = editorRefForCatalogue.current;
      if (ed && isEditorTypingFocused(ed)) {
        cb(resolveCatalogueActiveId(ed));
      } else {
        cb(null);
      }
    }, 0);
  }, []);

  const getElementBlockInfo = useCallback((target: EventTarget | null) => {
    if (!editorAreaRef.current || !(target instanceof Element)) return null;
    const codeBlockWrapper = target.closest('.feishu-code-block') as HTMLElement | null;
    if (codeBlockWrapper && editorAreaRef.current.contains(codeBlockWrapper)) {
      return { element: codeBlockWrapper, type: 'codeBlock', isEmpty: false };
    }
    const highlightBlockWrapper = target.closest('.feishu-highlight-block') as HTMLElement | null;
    if (highlightBlockWrapper && editorAreaRef.current.contains(highlightBlockWrapper)) {
      return { element: highlightBlockWrapper, type: 'highlightBlock', isEmpty: false };
    }
    const dividerWrapper = target.closest('.feishu-divider') as HTMLElement | null;
    if (dividerWrapper && editorAreaRef.current.contains(dividerWrapper)) {
      return { element: dividerWrapper, type: 'hr', isEmpty: false };
    }
    const tableHost = resolveTableHostFromElement(target);
    if (tableHost && editorAreaRef.current.contains(tableHost)) {
      const cell = target instanceof Element ? target.closest('td, th') : null;
      const isEmpty = !cell?.textContent?.trim();
      return { element: tableHost, type: 'table', isEmpty };
    }
    const imageBlock = target.closest('.feishu-image-block-wrap, .feishu-file-block--image') as HTMLElement | null;
    if (imageBlock && editorAreaRef.current.contains(imageBlock)) {
      return { element: imageBlock, type: 'image', isEmpty: false };
    }
    const buttonBlock = target.closest('.feishu-button-block') as HTMLElement | null;
    if (buttonBlock && editorAreaRef.current.contains(buttonBlock)) {
      let type = 'button';
      if (buttonBlock.classList.contains('feishu-button-block--link')) type = 'button-link';
      else if (buttonBlock.classList.contains('feishu-button-block--duplicate')) type = 'button-duplicate';
      else if (buttonBlock.classList.contains('feishu-button-block--follow')) type = 'button-follow';
      return { element: buttonBlock, type, isEmpty: false };
    }
    const formulaBlock = target.closest('.feishu-formula-editor') as HTMLElement | null;
    if (formulaBlock && editorAreaRef.current.contains(formulaBlock)) {
      return { element: formulaBlock, type: 'formula', isEmpty: false };
    }
    const bitableBlock = target.closest('.feishu-bitable-block') as HTMLElement | null;
    if (bitableBlock && editorAreaRef.current.contains(bitableBlock)) {
      return { element: bitableBlock, type: bitableToolTypeFromElement(bitableBlock), isEmpty: false };
    }
    const dashboardBlock = target.closest('.feishu-dashboard-chart-block') as HTMLElement | null;
    if (dashboardBlock && editorAreaRef.current.contains(dashboardBlock)) {
      return { element: dashboardBlock, type: 'dashboard', isEmpty: false };
    }
    const divTableBlock = target.closest('.feishu-div-table') as HTMLElement | null;
    if (divTableBlock && editorAreaRef.current.contains(divTableBlock)) {
      return { element: divTableBlock, type: 'div-table', isEmpty: false };
    }
    const embedBlock = target.closest('.feishu-local-card') as HTMLElement | null;
    if (embedBlock && editorAreaRef.current.contains(embedBlock)) {
      return { element: embedBlock, type: 'embed', isEmpty: false };
    }
    const fileBlock = target.closest('.feishu-file-block') as HTMLElement | null;
    if (fileBlock && editorAreaRef.current.contains(fileBlock)) {
      return { element: fileBlock, type: 'file', isEmpty: false };
    }
    const syncBlock = target.closest('.feishu-sync-block') as HTMLElement | null;
    if (syncBlock && editorAreaRef.current.contains(syncBlock)) {
      return { element: syncBlock, type: 'sync', isEmpty: false };
    }
    const block = target.closest('h1,h2,h3,h4,h5,h6,p,li,blockquote,pre') as HTMLElement | null;
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
    if (editorInstance.isActive('highlightBlock')) return 'highlightBlock';
    if (editorInstance.isActive('horizontalRule')) return 'hr';
    if (editorInstance.isActive('table')) return 'table';
    if (editorInstance.isActive('image')) return 'image';
    if (editorInstance.isActive('localFileBlock')) {
      const attrs = editorInstance.getAttributes('localFileBlock');
      if (String(attrs.mediaKind || '') === 'image') return 'image';
      return 'file';
    }
    if (editorInstance.isActive('localFormulaBlock')) return 'formula';
    if (editorInstance.isActive('localButtonBlock')) return 'button';
    if (editorInstance.isActive('localBitableBlock')) {
      const attrs = editorInstance.getAttributes('localBitableBlock');
      return bitableToolTypeFromView(attrs.view);
    }
    if (editorInstance.isActive('localDivTableBlock')) return 'div-table';
    if (editorInstance.isActive('localEmbedBlock')) return 'embed';
    if (editorInstance.isActive('localSyncBlock')) return 'sync';
    return 'paragraph';
  }, []);

  const getColumnContentFromBlock = useCallback((block: HTMLElement | null) => {
    const columnContent = block?.closest('.feishu-columns-block__col') as HTMLElement | null;
    return columnContent?.isConnected ? columnContent : null;
  }, []);

  const updateBlockTools = useCallback((editorInstance: any) => {
    if (readOnly || !editorAreaRef.current) return;
    const selectedRow = getBlockDomFromEditor(editorInstance);
    const selectedIsEmptyParagraph = Boolean(
      selectedRow?.tagName.toLowerCase() === 'p'
      && (selectedRow.textContent ?? '').replace(/\u200b/g, '').trim() === '',
    );

    let row = activeBlockElRef.current;
    if (selectedIsEmptyParagraph && selectedRow?.isConnected) {
      row = selectedRow;
      activeBlockElRef.current = row;
    } else if (selectedRow && row?.isConnected && selectedRow !== row) {
      return;
    }

    if (!row?.isConnected) {
      row = selectedRow;
      if (!row?.isConnected) return;
      activeBlockElRef.current = row;
    }

    if (selectedRow && row && selectedRow !== row) return;

    const { from, to } = editorInstance.state.selection;
    const isEmpty = (from === to && editorInstance.state.doc.textBetween(Math.max(0, from - 1), Math.min(editorInstance.state.doc.content.size, from + 1), ' ', '\0').trim() === '') && editorInstance.isActive('paragraph');

    const areaRect = editorAreaRef.current.getBoundingClientRect();
    const top = getBlockToolsAnchorTop(editorInstance, row, areaRect.top);
    const columnContent = getColumnContentFromBlock(row);
    const left = getBlockToolsAnchorLeft(row, areaRect.left, columnContent);
    const blockType = row.classList.contains('feishu-bitable-block')
      ? bitableToolTypeFromElement(row)
      : getCurrentBlockType(editorInstance);

    setBlockTools(prev => {
      if (!prev.visible && !(isEmpty && blockType === 'paragraph')) return prev;
      return {
        ...prev,
        visible: true,
        top,
        left,
        type: blockType,
        isEmpty,
        isInColumns: Boolean(columnContent),
      };
    });
  }, [getColumnContentFromBlock, getCurrentBlockType, readOnly]);

  const hideBlockTools = useCallback(() => {
    activeBlockElRef.current = null;
    setBlockGutterHoveredState(false);
    setPlusHoveredState(false);
    setRowHighlightBand(null);
    setActiveTableHost(null);
    setTableHandleHovered(false);
    setBlockTools(prev => (prev.visible ? { ...prev, visible: false } : prev));
  }, [setBlockGutterHoveredState, setPlusHoveredState]);

  const closeBlockHoverFloatingGroup = useCallback(() => {
    closeSlashMenu();
    if (editorRefForCatalogue.current?.state.selection instanceof CellSelection) return;
    setContextMenu(null);
    setTableHandleHovered(false);
    setPlusHoveredState(false);
    hideBlockTools();
    setActiveTableHost(null);
  }, [closeSlashMenu, hideBlockTools, setPlusHoveredState]);

  const blockHoverFloatingGroup = useHoverFloatingGroup({
    refs: [
      editorAreaRef,
      blockAddButtonRef,
      blockDragRowRef,
      tableHandleRef,
      activeBlockElRef,
    ],
    selectors: BLOCK_TOOLS_OVERLAY_SELECTOR.split(',').map(selector => selector.trim()),
    closeDelay: 160,
    onClose: closeBlockHoverFloatingGroup,
  });

  const schedulePlusMenuClose = useCallback(
    (target: EventTarget | null) => {
      if (isPlusMenuHoverBridgeTarget(target)) return;
      blockHoverFloatingGroup.scheduleClose(null);
    },
    [blockHoverFloatingGroup],
  );

  const schedulePlusMenuOnlyClose = useCallback(
    (target: EventTarget | null) => {
      if (
        target instanceof Element
        && target.closest(
          '.block-add-hover-wrap, .block-add-btn, .block-plus-menu-shell, .slash-menu, .slash-submenu-portal, .slash-table-grid-flyout, .slash-columns-count-flyout',
        )
      ) {
        return;
      }
      window.setTimeout(() => {
        const hovered = document.querySelector(
          '.block-add-hover-wrap:hover, .block-add-btn:hover, .block-plus-menu-shell:hover, .slash-menu:hover, .slash-submenu-portal:hover, .slash-table-grid-flyout:hover, .slash-columns-count-flyout:hover',
        );
        if (hovered) return;
        closeSlashMenu();
        setPlusHoveredState(false);
      }, 140);
    },
    [closeSlashMenu, setPlusHoveredState],
  );

  const resolveHoveredBlockInfo = useCallback(
    (
      target: EventTarget | null,
      clientX?: number,
      clientY?: number,
    ): NonNullable<ReturnType<typeof getElementBlockInfo>> | 'keep' | null => {
      if (!(target instanceof Element)) return null;
      if (isBlockToolsOverlayElement(target)) return 'keep';

      const info = getElementBlockInfo(target);
      if (info) return info;

      const columnWrap = target.closest('.feishu-columns-block__col-wrap');
      if (columnWrap instanceof HTMLElement && editorAreaRef.current?.contains(columnWrap)) {
        const columnEl = columnWrap.querySelector('.feishu-columns-block__col');
        const innerBlock = columnEl ? findBlockContentInColumn(columnEl) : null;
        if (innerBlock) return getElementBlockInfo(innerBlock);
        return 'keep';
      }

      if (clientX != null && clientY != null) {
        const editorInstance = editorRefForCatalogue.current;
        if (editorInstance?.view?.dom instanceof HTMLElement) {
          const emptyParagraph = findEmptyParagraphNearPoint(editorInstance.view.dom, clientX, clientY);
          const infoAtEmptyParagraph = emptyParagraph ? getElementBlockInfo(emptyParagraph) : null;
          if (infoAtEmptyParagraph) return infoAtEmptyParagraph;
        }
        const posAtPoint = editorInstance?.view.posAtCoords({ left: clientX, top: clientY });
        if (posAtPoint) {
          try {
            const domAt = editorInstance.view.domAtPos(posAtPoint.pos);
            const node = domAt.node.nodeType === Node.TEXT_NODE
              ? domAt.node.parentElement
              : domAt.node;
            if (node instanceof Element) {
              const infoAtPoint = getElementBlockInfo(node);
              if (infoAtPoint) return infoAtPoint;
            }
          } catch {
            // Ignore invalid coordinates and keep the hover state unchanged.
          }
        }
      }
      return null;
    },
    [getElementBlockInfo],
  );

  const revealBlockToolsFromInfo = useCallback(
    (info: NonNullable<ReturnType<typeof getElementBlockInfo>>) => {
      const editorInstance = editorRefForCatalogue.current;
      if (readOnly || !editorAreaRef.current || !editorInstance) return;
      const areaRect = editorAreaRef.current.getBoundingClientRect();
      activeBlockElRef.current = info.element;
      setBlockGutterHoveredState(false);
      if (info.type === 'table') {
        setActiveTableHost(info.element);
      } else {
        setActiveTableHost(null);
        setTableHandleHovered(false);
        const { selection } = editorInstance.state;
        if (selection instanceof NodeSelection && selection.node.type.name === 'table') {
          try {
            const pos = editorInstance.view.posAtDOM(info.element, 0);
            editorInstance.chain().setTextSelection(Math.min(pos + 1, editorInstance.state.doc.content.size - 1)).run();
          } catch {
            editorInstance.commands.focus();
          }
        }
      }
      const centerY = getBlockToolsAnchorTop(editorInstance, info.element, areaRect.top);
      const columnContent = getColumnContentFromBlock(info.element);
      const left = getBlockToolsAnchorLeft(info.element, areaRect.left, columnContent);
      const selectedRow = getBlockDomFromEditor(editorInstance);
      const blockType = info.element.classList.contains('feishu-bitable-block')
        ? bitableToolTypeFromElement(info.element)
        : selectedRow && (selectedRow === info.element || info.element.contains(selectedRow))
          ? getCurrentBlockType(editorInstance)
          : info.type;
      setBlockTools({
        visible: true,
        top: centerY,
        left,
        type: blockType,
        isEmpty: info.isEmpty,
        isInColumns: Boolean(columnContent),
      });
    },
    [getColumnContentFromBlock, getCurrentBlockType, readOnly, setBlockGutterHoveredState],
  );

  /** 指针离开面板关闭菜单时，若未悬停在正文区则一并收起块柄 */
  const dismissContextMenuFromHover = useCallback(() => {
    cancelContextMenuClose();
    setContextMenu(null);
    setTableHandleHovered(false);
    menuClosedAtRef.current = Date.now();
    window.requestAnimationFrame(() => {
      const area = editorAreaRef.current;
      if (!area?.matches(':hover')) {
        hideBlockTools();
        return;
      }
      const pt = lastEditorPointerRef.current;
      if (!pt) return;
      const el = document.elementFromPoint(pt.x, pt.y);
      const resolved = resolveHoveredBlockInfo(el);
      if (resolved && resolved !== 'keep') {
        revealBlockToolsFromInfo(resolved);
        return;
      }
      if (!resolved) {
        setActiveTableHost(null);
      }
    });
  }, [cancelContextMenuClose, hideBlockTools, resolveHoveredBlockInfo, revealBlockToolsFromInfo]);

  const scheduleContextMenuClose = useCallback(() => {
    cancelContextMenuClose();
    contextMenuCloseTimerRef.current = setTimeout(() => {
      contextMenuCloseTimerRef.current = null;
      dismissContextMenuFromHover();
    }, 160);
  }, [cancelContextMenuClose, dismissContextMenuFromHover]);

  const handleEditorPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      lastEditorPointerRef.current = { x: e.clientX, y: e.clientY };
      if (readOnly || !editorAreaRef.current || !editorRefForCatalogue.current) return;
      if (slashMenuVisible && slashMenuFromPlus) return;
      if (contextMenu) return;

      const resolved = resolveHoveredBlockInfo(e.target, e.clientX, e.clientY);
      if (resolved === 'keep') return;
      if (!resolved) {
        if (blockHoverFloatingGroup.containsTarget(e.target)) {
          blockHoverFloatingGroup.cancelClose();
          return;
        }
        if (
          activeBlockElRef.current?.isConnected &&
          isPointerInBlockToolsBridge(
            e.clientX,
            e.clientY,
            activeBlockElRef.current,
            editorAreaRef.current,
          )
        ) {
          blockHoverFloatingGroup.cancelClose();
          return;
        }
        blockHoverFloatingGroup.scheduleClose(e.relatedTarget ?? null);
        return;
      }
      blockHoverFloatingGroup.cancelClose();
      revealBlockToolsFromInfo(resolved);
    },
    [blockHoverFloatingGroup, contextMenu, readOnly, resolveHoveredBlockInfo, revealBlockToolsFromInfo, slashMenuFromPlus, slashMenuVisible],
  );

  const handleEditorMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const next = getRelatedNode(e.relatedTarget);
      if (next && e.currentTarget.contains(next)) return;
      if (blockHoverFloatingGroup.containsTarget(next)) return;
      if (editorRefForCatalogue.current?.state.selection instanceof CellSelection) return;

      blockHoverFloatingGroup.scheduleClose(next);
    },
    [blockHoverFloatingGroup],
  );

  /** 指针离开整个编辑器外壳（含 Slash、右键菜单、块工具浮层）时收起面板 */
  const handleEditorWrapMouseLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const next = getRelatedNode(e.relatedTarget);
    if (next && e.currentTarget.contains(next)) return;
    if (blockHoverFloatingGroup.containsTarget(next)) return;
    if (next instanceof Element && next.closest('.selection-bubble')) return;
    if (next instanceof Element && next.closest('.slash-menu')) return;
    if (next instanceof Element && next.closest('.slash-submenu-portal')) return;
    if (next instanceof Element && next.closest('.slash-table-grid-flyout')) return;
    if (next instanceof Element && next.closest('.slash-columns-count-flyout')) return;
    if (next instanceof Element && next.closest('.feishu-table-chrome')) return;
    // 子菜单 Portal 在 body 下，移入浮层不应当作离开编辑器外壳
    if (next instanceof Element && next.closest('.context-submenu-flyout')) return;
    if (next instanceof Element && next.closest('.context-add-below-flyout')) return;
    if (next instanceof Element && next.closest('.context-menu')) return;
    if (editorRefForCatalogue.current?.state.selection instanceof CellSelection) return;
    if (slashMenuVisible && slashMenuFromPlus) {
      schedulePlusMenuClose(next);
      return;
    }
    if (contextMenu) return;
    blockHoverFloatingGroup.scheduleClose(next);
  }, [blockHoverFloatingGroup, contextMenu, schedulePlusMenuClose, slashMenuFromPlus, slashMenuVisible]);

  const editor = useEditor({
    extensions: editorExtensions,
    content: content || '<p></p>',
    editable: !readOnly,
    editorProps: {
      handleClick: (_view, _pos, event) => {
        const target = event.target instanceof Element
          ? event.target.closest('[data-comment-thread-id]')
          : null;
        const threadId = target?.getAttribute('data-comment-thread-id');
        const blockId = target?.getAttribute('data-block-id') || target?.getAttribute('id') || threadId;
        if (!threadId || !blockId) return false;
        window.dispatchEvent(
          new CustomEvent('feishu-open-comment-sidebar', {
            detail: { documentId, blockId, threadId, anchorType: 'text-range' },
          }),
        );
        return false;
      },
      handlePaste: (view, event) => {
        if (readOnly) return false;
        const activeEditor = editorRefForCatalogue.current;
        if (!activeEditor) return false;
        const files = Array.from(event.clipboardData?.files ?? []);
        if (files.length > 0) {
          event.preventDefault();
          return insertMediaFiles(activeEditor, files, view.state.selection.from);
        }
        return insertTableFromClipboardData(activeEditor, event.clipboardData);
      },
    },
    onCreate: ({ editor: ed }) => {
      ed.commands.fixTables();
      ed.view.dispatch(ed.state.tr.setMeta('feishu-normalize-block-ids', true));
    },
    onUpdate: ({ editor }) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        onSave({ content: sanitizeEditorHtmlForSave(editor.getHTML()) });
      }, 1000);
      extractHeadings(editor);

      const catCb = catalogueActiveCbRef.current;
      if (catCb && isEditorTypingFocused(editor)) {
        catCb(resolveCatalogueActiveId(editor));
      }

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
          setSlashMenuFromPlus(false);
          setSlashMenuFromTableCellPlus(false);
          (editor as any).__plusInsertRange = null;
          setSlashMenuVisible(true);
        } else {
          closeSlashMenu();
        }
      } else {
        closeSlashMenu();
      }

      updateBlockTools(editor);
    },
    onSelectionUpdate: ({ editor }) => {
      updateBlockTools(editor);
      const catCb = catalogueActiveCbRef.current;
      if (catCb && isEditorTypingFocused(editor)) {
        catCb(resolveCatalogueActiveId(editor));
      }
    },
    onFocus: ({ editor }) => {
      updateBlockTools(editor);
      const catCb = catalogueActiveCbRef.current;
      if (catCb && isEditorTypingFocused(editor)) {
        catCb(resolveCatalogueActiveId(editor));
      }
    },
    onBlur: ({ editor: ed }) => {
      setTimeout(() => {
        const ae = document.activeElement;
        if (ae instanceof Element && ae.closest('.selection-bubble')) return;
        const catCb = catalogueActiveCbRef.current;
        if (catCb) {
          const inTitle = ae instanceof Element && ae.matches('.editor-title-input');
          const inEd = ed && ae instanceof Element && ed.view.dom.contains(ae);
          const inCatalogue = ae instanceof Element && ae.closest('.catalogue-aside');
          if (!inTitle && !inEd && !inCatalogue) {
            catCb(null);
          }
        }
        if (!document.querySelector('.context-menu') && !document.querySelector('.slash-menu')) {
          setPlusHoveredState(false);
        }
      }, 0);
    },
  });

  editorRefForCatalogue.current = editor;

  /** 浅蓝行背景：仅 hover 块柄按钮区时显示（见 syncRowHighlightBand） */

  const syncRowHighlightBand = useCallback(() => {
    const show =
      !readOnly &&
      blockTools.visible &&
      blockGutterHovered;
    if (!show) {
      setRowHighlightBand(null);
      return;
    }
    const row = activeBlockElRef.current;
    const area = editorAreaRef.current;
    if (!row?.isConnected || !area) {
      setRowHighlightBand(null);
      return;
    }
    if (row.classList.contains('feishu-bitable-block')) {
      setRowHighlightBand(null);
      return;
    }
    const areaRect = area.getBoundingClientRect();
    const columnContent = getColumnContentFromBlock(row);
    const { top, left, width, height } = resolveBlockRowHighlightRect(
      editorRefForCatalogue.current,
      row,
      areaRect,
      columnContent,
    );
    setRowHighlightBand(prev =>
      prev && prev.top === top && prev.left === left && prev.width === width && prev.height === height
        ? prev
        : { top, left, width, height },
    );
  }, [
    readOnly,
    blockTools.visible,
    blockGutterHovered,
    getColumnContentFromBlock,
  ]);

  const syncRowHighlightBandRef = useRef(syncRowHighlightBand);
  syncRowHighlightBandRef.current = syncRowHighlightBand;

  const handleEditorPointerOver = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (readOnly || !editorAreaRef.current) return;

      if (!editorRefForCatalogue.current) return;
      if (slashMenuVisible && slashMenuFromPlus) return;
      if (contextMenu) return;

      const resolved = resolveHoveredBlockInfo(e.target, e.clientX, e.clientY);
      if (resolved === 'keep' || !resolved) return;
      revealBlockToolsFromInfo(resolved);
    },
    [contextMenu, readOnly, resolveHoveredBlockInfo, revealBlockToolsFromInfo, slashMenuFromPlus, slashMenuVisible],
  );

  const handleEditorContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly || !editor || !editorAreaRef.current) return;
    if (isBlockToolsOverlayElement(e.target as Element | null)) return;
    if ((e.target as Element).closest('.feishu-bitable-block')) return;

    const resolved = resolveHoveredBlockInfo(e.target);
    if (!resolved || resolved === 'keep') return;

    e.preventDefault();
    e.stopPropagation();
    cancelContextMenuClose();
    closeSlashMenu();
    setSlashMenuFromPlus(false);
    setSlashMenuFromTableCellPlus(false);
    revealBlockToolsFromInfo(resolved);
    activeBlockElRef.current = resolved.element;

    if (resolved.type === 'table') {
      setActiveTableHost(resolved.element);
      setTableHandleHovered(true);
      selectTableNodeFromHost(editor, resolved.element);
      setContextMenu({ x: e.clientX, y: e.clientY, variant: 'table' });
      return;
    }

    if (resolved.type === 'image') {
      try {
        const pos = editor.view.posAtDOM(resolved.element, 0);
        editor.commands.setNodeSelection(pos);
      } catch {
        editor.commands.focus();
      }
      setContextMenu({ x: e.clientX, y: e.clientY, variant: 'image' });
      return;
    }

    if (resolved.type === 'hr') {
      try {
        const pos = editor.view.posAtDOM(resolved.element, 0);
        editor.commands.setNodeSelection(pos);
      } catch {
        editor.commands.focus();
      }
    } else {
      syncEditorSelectionToAnchoredBlock(editor, resolved.element);
    }
    setContextMenu({ x: e.clientX, y: e.clientY, variant: 'block' });
  }, [
    cancelContextMenuClose,
    closeSlashMenu,
    editor,
    readOnly,
    resolveHoveredBlockInfo,
    revealBlockToolsFromInfo,
  ]);

  const beginBlockDrag = useCallback((event: React.PointerEvent<HTMLButtonElement>, sourceOverride?: HTMLElement) => {
    if (!editor || readOnly) return;
    const source = sourceOverride ?? activeBlockElRef.current;
    if (!source?.isConnected || !resolveDraggableBlockPos(editor, source)) return;

    event.preventDefault();
    event.stopPropagation();
    setContextMenu(null);
    setBlockGutterHoveredState(true);
    blockDragStateRef.current = {
      source,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
      dropTarget: null,
      placement: 'before',
    };

    const clearDragPreview = () => {
      blockDragPreviewRef.current?.remove();
      blockDragPreviewRef.current = null;
      document.body.classList.remove('feishu-block-dragging');
    };

    const syncDragPreview = (clientY: number) => {
      const area = editorAreaRef.current;
      if (!area) return;
      const sourceRect = source.getBoundingClientRect();
      const areaRect = area.getBoundingClientRect();
      let preview = blockDragPreviewRef.current;
      if (!preview) {
        preview = source.cloneNode(true) as HTMLElement;
        preview.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
        preview.querySelectorAll('.feishu-table-chrome-mount, .docx-menu-container').forEach(node => node.remove());
        preview.classList.add('block-drag-preview');
        preview.setAttribute('aria-hidden', 'true');
        preview.style.width = `${sourceRect.width}px`;
        area.appendChild(preview);
        blockDragPreviewRef.current = preview;
        document.body.classList.add('feishu-block-dragging');
      }
      preview.style.left = `${sourceRect.left - areaRect.left}px`;
      preview.style.top = `${clientY - areaRect.top + 12}px`;
    };

    const resolveDrop = (clientX: number, clientY: number) => {
      const dragState = blockDragStateRef.current;
      const area = editorAreaRef.current;
      if (!dragState || !area) return;

      const hitInfo = document.elementsFromPoint(clientX, clientY)
        .map(hit => resolveHoveredBlockInfo(hit, clientX, clientY))
        .find((candidate): candidate is NonNullable<ReturnType<typeof getElementBlockInfo>> =>
          Boolean(candidate && candidate !== 'keep'));

      const target = hitInfo?.element ?? resolveBlockDomAtPoint(editor, clientX, clientY);
      if (!target || target === dragState.source || !resolveDraggableBlockPos(editor, target)) {
        dragState.dropTarget = null;
        setBlockDragIndicator(null);
        return;
      }

      const targetRect = target.getBoundingClientRect();
      const areaRect = area.getBoundingClientRect();
      const columnContent = getColumnContentFromBlock(target);
      const indicatorRect = columnContent?.isConnected ? columnContent.getBoundingClientRect() : targetRect;
      const placement = clientY < targetRect.top + targetRect.height / 2 ? 'before' : 'after';
      dragState.dropTarget = target;
      dragState.placement = placement;
      setBlockDragIndicator({
        top: (placement === 'before' ? targetRect.top : targetRect.bottom) - areaRect.top,
        left: columnContent?.isConnected ? indicatorRect.left - areaRect.left : 0,
        width: columnContent?.isConnected ? indicatorRect.width : areaRect.width,
      });
    };

    const onMove = (moveEvent: PointerEvent) => {
      const dragState = blockDragStateRef.current;
      if (!dragState) return;
      const dx = Math.abs(moveEvent.clientX - dragState.startX);
      const dy = Math.abs(moveEvent.clientY - dragState.startY);
      if (!dragState.dragging && dx < 4 && dy < 4) return;
      if (!dragState.dragging) {
        setContextMenu(null);
        closeSlashMenu();
        setRowHighlightBand(null);
      }
      dragState.dragging = true;
      moveEvent.preventDefault();
      syncDragPreview(moveEvent.clientY);
      resolveDrop(moveEvent.clientX, moveEvent.clientY);
    };

    const finish = () => {
      const dragState = blockDragStateRef.current;
      document.removeEventListener('pointermove', onMove, true);
      document.removeEventListener('pointerup', finish, true);
      document.removeEventListener('pointercancel', finish, true);
      blockDragStateRef.current = null;
      setBlockDragIndicator(null);
      clearDragPreview();
      if (dragState?.dragging && dragState.dropTarget) {
        const moved = moveDraggableBlock(editor, dragState.source, dragState.dropTarget, dragState.placement);
        if (moved) {
          hideBlockTools();
        }
      }
    };

    document.addEventListener('pointermove', onMove, true);
    document.addEventListener('pointerup', finish, true);
    document.addEventListener('pointercancel', finish, true);
  }, [
    editor,
    closeSlashMenu,
    getColumnContentFromBlock,
    hideBlockTools,
    readOnly,
    resolveHoveredBlockInfo,
    setBlockGutterHoveredState,
  ]);

  const handleBlockToolsMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const next = getRelatedNode(e.relatedTarget);
      if (next && e.currentTarget.contains(next)) return;

      setBlockGutterHoveredState(false);

      if (isPointerInContextMenuShell(next)) return;
      if (next instanceof Element && next.closest('.slash-menu')) return;

      scheduleContextMenuClose();

      if (blockHoverFloatingGroup.containsTarget(next)) return;

      const resolved = resolveHoveredBlockInfo(next);
      if (resolved) return;

      if (slashMenuFromPlus) {
        schedulePlusMenuClose(next);
        return;
      }
      setPlusHoveredState(false);
      blockHoverFloatingGroup.scheduleClose(next);
    },
    [blockHoverFloatingGroup, resolveHoveredBlockInfo, scheduleContextMenuClose, schedulePlusMenuClose, setBlockGutterHoveredState, setPlusHoveredState, slashMenuFromPlus],
  );

  const handleEditorBlankClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly || !editor) return;
    if (slashMenuVisible || contextMenu) return;
    if (e.defaultPrevented) return;
    const target = e.target;
    const isEmptyParagraphTarget = target instanceof HTMLElement
      && target.matches('p')
      && (target.textContent ?? '').replace(/\u200b/g, '').trim() === '';
    if (
      target !== e.currentTarget
      && !(target instanceof Element && target.classList.contains('tiptap'))
      && !isEmptyParagraphTarget
    ) return;

    const handled = handleEditorBlankAreaClick(editor, e.clientX, e.clientY);
    if (!handled) return;

    window.requestAnimationFrame(() => {
      const row = getBlockDomFromEditor(editor);
      if (!row) return;
      const info = getElementBlockInfo(row);
      if (info?.isEmpty && info.type === 'paragraph') {
        revealBlockToolsFromInfo(info);
      }
    });
  }, [contextMenu, editor, getElementBlockInfo, readOnly, revealBlockToolsFromInfo, slashMenuVisible]);

  const handleEditorBlankDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly || !editor) return;
    if (slashMenuVisible || contextMenu) return;
    if (e.defaultPrevented) return;
    const target = e.target;
    const isEmptyParagraphTarget = target instanceof HTMLElement
      && target.matches('p')
      && (target.textContent ?? '').replace(/\u200b/g, '').trim() === '';
    if (
      target !== e.currentTarget
      && !(target instanceof Element && target.classList.contains('tiptap'))
      && !isEmptyParagraphTarget
    ) return;

    const handled = handleEditorBlankAreaDoubleClick(editor, e.clientX, e.clientY);
    if (!handled) return;

    window.requestAnimationFrame(() => {
      const row = getBlockDomFromEditor(editor);
      if (!row) return;
      const info = getElementBlockInfo(row);
      if (info?.isEmpty && info.type === 'paragraph') {
        revealBlockToolsFromInfo(info);
      }
    });
  }, [contextMenu, editor, getElementBlockInfo, readOnly, revealBlockToolsFromInfo, slashMenuVisible]);

  const hasDraggedFiles = (event: React.DragEvent<HTMLDivElement>) =>
    Array.from(event.dataTransfer?.types ?? []).includes('Files');

  const resolveDropPosition = useCallback((clientX: number, clientY: number) => {
    if (!editor || !editorAreaRef.current) return null;
    const coords = editor.view.posAtCoords({ left: clientX, top: clientY });
    const areaRect = editorAreaRef.current.getBoundingClientRect();
    const pos = coords?.pos ?? Math.max(0, editor.state.doc.content.size - 1);
    const dom = document.elementFromPoint(clientX, clientY);
    const targetBlock = dom instanceof Element
      ? (dom.closest('[data-local-block], h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,.tableWrapper,.feishu-table-host') as HTMLElement | null)
      : null;
    const rect = targetBlock?.getBoundingClientRect();
    const top = rect
      ? (clientY < rect.top + rect.height / 2 ? rect.top : rect.bottom)
      : Math.max(areaRect.top + 20, Math.min(clientY, areaRect.bottom - 20));
    return {
      pos,
      indicator: {
        top: top - areaRect.top,
        left: 0,
        width: areaRect.width,
      },
    };
  }, [editor]);

  const handleFileDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (readOnly || !editor || !hasDraggedFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    const target = event.target;
    const disabled = target instanceof Element && Boolean(target.closest(BLOCK_TOOLS_OVERLAY_SELECTOR));
    const resolved = resolveDropPosition(event.clientX, event.clientY);
    if (!resolved) return;
    setFileDropState({
      visible: true,
      top: resolved.indicator.top,
      left: resolved.indicator.left,
      width: resolved.indicator.width,
      count: event.dataTransfer.items?.length || event.dataTransfer.files?.length || 1,
      disabled,
    });
  }, [editor, readOnly, resolveDropPosition]);

  const clearFileDropState = useCallback(() => setFileDropState(null), []);

  const handleFileDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (readOnly || !editor || !hasDraggedFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    const target = event.target;
    if (target instanceof Element && target.closest(BLOCK_TOOLS_OVERLAY_SELECTOR)) {
      clearFileDropState();
      return;
    }
    const files = Array.from(event.dataTransfer.files ?? []);
    const resolved = resolveDropPosition(event.clientX, event.clientY);
    clearFileDropState();
    if (files.length === 0) return;
    insertMediaFiles(editor, files, resolved?.pos);
  }, [clearFileDropState, editor, readOnly, resolveDropPosition]);

  const extractHeadings = useCallback((editorInstance: any) => {
    if (!onHeadingsChange || !editorInstance) return;
    const headings: HeadingItem[] = [];
    editorInstance.state.doc.descendants((node: any, pos: number) => {
      if (!isCatalogueHeading(editorInstance.state, pos, node)) return;
      const text = String(node.textContent ?? '').trim();
      headings.push({
        level: node.attrs.level,
        text,
        id: readHeadingId(node.attrs) ?? `heading-pos-${pos}`,
      });
    });
    onHeadingsChange(headings);
  }, [onHeadingsChange]);

  useEffect(() => {
    if (editor) extractHeadings(editor);
  }, [editor, extractHeadings]);

  useEffect(() => {
    if (!editor) return;
    syncAllHeadingCollapseStates(editor, collapsedHeadingIds);
  }, [editor, collapsedHeadingIds]);

  useEffect(() => {
    if (!editor || !collapsedHeadingIds?.size) return;
    let rafId = 0;
    const resyncAfterDocChange = ({ transaction }: { transaction: { docChanged: boolean } }) => {
      if (!transaction.docChanged) return;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        syncAllHeadingCollapseStates(editor, collapsedHeadingIds);
      });
    };
    editor.on('update', resyncAfterDocChange);
    return () => {
      cancelAnimationFrame(rafId);
      editor.off('update', resyncAfterDocChange);
    };
  }, [editor, collapsedHeadingIds]);

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
    if (!editor) return;
    const scroll = () => {
      window.requestAnimationFrame(() => {
        scrollToBlockFromHash();
      });
    };
    scroll();
    window.addEventListener('hashchange', scroll);
    return () => window.removeEventListener('hashchange', scroll);
  }, [content, editor]);

  useEffect(() => {
    if (!editor) return;
    const onMediaAction = (event: Event) => {
      const detail = (event as CustomEvent<{ action?: string; uploadId?: string }>).detail;
      if (!detail?.uploadId) return;
      if (detail.action === 'retry') {
        startMediaUpload(editor, detail.uploadId);
      } else if (detail.action === 'cancel') {
        mediaUploadFiles.get(detail.uploadId)?.controller?.abort();
      }
    };
    window.addEventListener(MEDIA_UPLOAD_EVENT, onMediaAction as EventListener);
    return () => {
      window.removeEventListener(MEDIA_UPLOAD_EVENT, onMediaAction as EventListener);
      mediaUploadFiles.forEach(task => {
        task.controller?.abort();
        if (task.objectUrl) URL.revokeObjectURL(task.objectUrl);
      });
      mediaUploadFiles.clear();
    };
  }, [editor]);

  useEffect(() => {
    if (!editor || readOnly) return undefined;
    const onInsertMediaFiles = (event: Event) => {
      const detail = (event as CustomEvent<{ files?: File[]; insertAt?: number }>).detail;
      const files = Array.from(detail?.files ?? []).filter(file => file instanceof File);
      if (!files.length) return;
      insertMediaFiles(editor, files, detail?.insertAt);
    };
    window.addEventListener('feishu-insert-media-files', onInsertMediaFiles as EventListener);
    return () => window.removeEventListener('feishu-insert-media-files', onInsertMediaFiles as EventListener);
  }, [editor, readOnly]);

  useLayoutEffect(() => {
    if (editor) {
      (editor as any).__documentId = documentId;
      (editor as any).__author = author;
    }
  }, [author, documentId, editor]);

  useEffect(() => {
    const openPageLinkDialog = (ev: Event) => {
      if (!editor || readOnly) return;
      closeSlashMenu();
      const insertAt = (ev as CustomEvent<{ insertAt?: number }>).detail?.insertAt;
      pageLinkInsertPosRef.current = typeof insertAt === 'number' ? insertAt : null;
      const { from, to } = editor.state.selection;
      setPageLinkText(editor.state.doc.textBetween(from, to, '\n'));
      setPageLinkUrl('');
      setPageLinkPopPos(computePageLinkPopPosition(editor));
      setPageLinkDialogVisible(true);
    };
    window.addEventListener('feishu-open-page-link-dialog', openPageLinkDialog as EventListener);
    return () => window.removeEventListener('feishu-open-page-link-dialog', openPageLinkDialog as EventListener);
  }, [closeSlashMenu, editor, readOnly]);

  useEffect(() => {
    const openTableCellBlockMenu = (ev: Event) => {
      if (!editor || readOnly) return;
      const detail = (ev as CustomEvent<{ x?: number; y?: number; cursorPos?: number }>).detail ?? {};
      cancelContextMenuClose();
      closeSlashMenu();
      setSlashMenuFromTableCellPlus(false);

      const cursorPos = detail.cursorPos;
      if (typeof cursorPos === 'number') {
        const node = editor.state.doc.nodeAt(cursorPos);
        if (
          node
          && (
            node.isAtom
            || node.type.name === 'horizontalRule'
            || node.type.name === 'image'
            || node.type.name === 'localEmbedBlock'
            || node.type.name === 'localFileBlock'
          )
        ) {
          editor.chain().focus().setNodeSelection(cursorPos).run();
        } else {
          editor.chain().focus().setTextSelection(cursorPos).run();
        }
      } else {
        editor.commands.focus();
      }

      const inlineBlock = resolveInlineBlockElementFromEditor(editor);
      if (inlineBlock?.isConnected) {
        activeBlockElRef.current = inlineBlock;
      }

      const anchorX = typeof detail.x === 'number' ? detail.x : 24;
      const anchorY = typeof detail.y === 'number' ? detail.y : 24;
      const pos = computeBlockPanelPosition(new DOMRect(anchorX, anchorY, 1, 1));
      setContextMenu({ ...pos, variant: 'block' });
    };
    window.addEventListener('feishu-open-table-cell-block-menu', openTableCellBlockMenu as EventListener);
    return () => window.removeEventListener('feishu-open-table-cell-block-menu', openTableCellBlockMenu as EventListener);
  }, [cancelContextMenuClose, closeSlashMenu, editor, readOnly]);

  useEffect(() => {
    const openTableCellSlashMenu = (ev: Event) => {
      if (!editor || readOnly) return;
      const detail = (ev as CustomEvent<{ x?: number; y?: number }>).detail ?? {};
      setContextMenu(null);
      setSlashMenuFromPlus(false);
      setSlashMenuFromTableCellPlus(true);
      setSlashQuery('');
      setSlashMenuPos({
        left: typeof detail.x === 'number' ? detail.x : 0,
        top: typeof detail.y === 'number' ? detail.y : 0,
      });
      setSlashMenuVisible(true);
      editor.commands.focus();
    };
    window.addEventListener('feishu-open-table-cell-slash-menu', openTableCellSlashMenu as EventListener);
    return () => window.removeEventListener('feishu-open-table-cell-slash-menu', openTableCellSlashMenu as EventListener);
  }, [editor, readOnly]);

  useEffect(() => {
    setDocTitle(normalizeTitle(title));
  }, [title]);

  useEffect(() => {
    setDocIcon(icon || '');
  }, [icon]);

  useEffect(() => {
    setDocCover(coverUrl || '');
  }, [coverUrl]);

  const handleAddCover = useCallback(() => {
    setDocCover(DEFAULT_COVER_URL);
    onSave({ cover_url: DEFAULT_COVER_URL });
  }, [onSave]);

  const handleRemoveCover = useCallback(() => {
    setDocCover('');
    onSave({ cover_url: '' });
  }, [onSave]);

  const handleIconSelect = useCallback((emoji: string) => {
    setDocIcon(emoji);
    setShowEmojiPicker(false);
    setTitleHovered(false);
    onSave({ icon: emoji });
  }, [onSave]);

  const handleIconRemove = useCallback(() => {
    setDocIcon('');
    setShowEmojiPicker(false);
    setTitleHovered(false);
    onSave({ icon: '' });
  }, [onSave]);

  const closePageLinkDialog = useCallback(() => {
    setPageLinkDialogVisible(false);
    setPageLinkText('');
    setPageLinkUrl('');
    pageLinkInsertPosRef.current = null;
  }, []);

  const confirmPageLink = useCallback(() => {
    if (!editor) return;
    const href = normalizeLinkHref(pageLinkUrl);
    const text = pageLinkText.trim() || href;
    if (!href) return;
    const markContent = { type: 'text', text, marks: [{ type: 'link', attrs: { href } }] };
    const insertPos = pageLinkInsertPosRef.current;
    if (insertPos != null) {
      editor.chain().focus().insertContentAt(insertPos, { type: 'paragraph', content: [markContent] }).run();
      pageLinkInsertPosRef.current = null;
    } else {
      editor.chain().focus().insertContent(markContent).run();
    }
    closePageLinkDialog();
  }, [closePageLinkDialog, editor, pageLinkText, pageLinkUrl]);

  useEffect(() => {
    if (!pageLinkDialogVisible || !editor) return;
    const reposition = () => setPageLinkPopPos(computePageLinkPopPosition(editor));
    reposition();
    window.addEventListener('resize', reposition);
    document.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      document.removeEventListener('scroll', reposition, true);
    };
  }, [editor, pageLinkDialogVisible]);

  useEffect(() => {
    if (!pageLinkDialogVisible) return;
    let removed: (() => void) | null = null;
    const timer = window.setTimeout(() => {
      const handleOutside = (e: MouseEvent) => {
        const target = e.target as Element | null;
        if (target?.closest('.editor-page-link-pop')) return;
        if (target?.closest('.slash-menu')) return;
        closePageLinkDialog();
      };
      document.addEventListener('mousedown', handleOutside);
      removed = () => document.removeEventListener('mousedown', handleOutside);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      removed?.();
    };
  }, [closePageLinkDialog, pageLinkDialogVisible]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(!readOnly);
      if (readOnly) {
        setPlusHoveredState(false);
        setBlockTools(prev => ({ ...prev, visible: false }));
        closeSlashMenu();
      }
    }
  }, [readOnly, editor, closeSlashMenu]);

  useEffect(() => {
    if (!editor || readOnly) return;
    const handleRemoveCommentHighlights = (event: Event) => {
      const threadIds = (event as CustomEvent<{ threadIds?: string[] }>).detail?.threadIds;
      if (!threadIds?.length) return;
      if (!removeCommentHighlightsFromEditor(editor, threadIds)) return;
      onSave({ content: sanitizeEditorHtmlForSave(editor.getHTML()) });
    };
    window.addEventListener('feishu-remove-comment-highlights', handleRemoveCommentHighlights);
    return () => window.removeEventListener('feishu-remove-comment-highlights', handleRemoveCommentHighlights);
  }, [editor, onSave, readOnly]);

  useEffect(() => {
    if (!editor || readOnly) return undefined;

    const handleDocumentMouseDown = (event: MouseEvent) => {
      const session = getActiveImageCropSession();
      if (!session || session.shouldSkipConfirmTarget(event.target)) return;
      void session.confirm();
    };

    document.addEventListener('mousedown', handleDocumentMouseDown, true);
    return () => document.removeEventListener('mousedown', handleDocumentMouseDown, true);
  }, [editor, readOnly]);

  useLayoutEffect(() => {
    syncRowHighlightBand();
  }, [
    syncRowHighlightBand,
    blockTools.top,
    blockTools.type,
    blockTools.visible,
    blockGutterHovered,
  ]);

  useEffect(() => {
    const show =
      !readOnly &&
      blockTools.visible &&
      blockGutterHovered;
    if (!show) return;
    const handle = () => syncRowHighlightBandRef.current();
    window.addEventListener('resize', handle);
    document.addEventListener('scroll', handle, true);
    return () => {
      window.removeEventListener('resize', handle);
      document.removeEventListener('scroll', handle, true);
    };
  }, [
    readOnly,
    blockTools.visible,
    blockGutterHovered,
  ]);

  useEffect(() => {
    if (!blockTools.visible) setBlockGutterHoveredState(false);
  }, [blockTools.visible, setBlockGutterHoveredState]);

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

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
    setTableHandleHovered(false);
    menuClosedAtRef.current = Date.now();
  }, []);

  useLayoutEffect(() => {
    const host = activeTableHost;
    if (!host?.isConnected) return;
    const highlighted = tableHandleHovered || contextMenu?.variant === 'table';
    host.classList.toggle('is-table-block-active', highlighted);
    return () => {
      host.classList.remove('is-table-block-active');
    };
  }, [activeTableHost, tableHandleHovered, contextMenu?.variant]);

  useLayoutEffect(() => {
    const block = activeBlockElRef.current;
    if (!block?.isConnected || !block.classList.contains('feishu-bitable-block')) return;
    const highlighted =
      !readOnly &&
      blockTools.visible &&
      blockGutterHovered;
    block.classList.toggle('is-block-gutter-active', highlighted);
    return () => {
      block.classList.remove('is-block-gutter-active');
    };
  }, [
    readOnly,
    blockTools.visible,
    blockGutterHovered,
  ]);

  useEffect(() => {
    if (readOnly || !blockTools.visible || !isBitableToolType(blockTools.type)) return;
    const block = activeBlockElRef.current;
    if (!block?.isConnected || !block.classList.contains('feishu-bitable-block')) return;
    const onGridScroll = () => {
      const editorInstance = editorRefForCatalogue.current;
      if (editorInstance) updateBlockTools(editorInstance);
    };
    block.addEventListener('bitable-grid-scroll', onGridScroll);
    return () => block.removeEventListener('bitable-grid-scroll', onGridScroll);
  }, [blockTools.type, blockTools.visible, readOnly, updateBlockTools]);

  const openBlockConfigMenu = (options?: { skipCooldown?: boolean }) => {
    if (slashMenuVisible && slashMenuFromPlus) return;
    const isTableTarget = blockTools.type === 'table';
    const isImageTarget = blockTools.type === 'image';
    const isBitableTarget = isBitableToolType(blockTools.type);
    const openVariant = isTableTarget ? 'table' : isImageTarget ? 'image' : isBitableTarget ? 'bitable' : 'block';
    if (contextMenu?.variant === openVariant) {
      cancelContextMenuClose();
      return;
    }
    if (
      !options?.skipCooldown
      && !isTableTarget
      && !isImageTarget
      && Date.now() - menuClosedAtRef.current < 300
    ) {
      return;
    }
    cancelContextMenuClose();
    // Atom blocks must remain node-selected so block menu actions target the block itself.
    if (
      ['hr', 'button', 'button-link', 'button-duplicate', 'button-follow', 'formula', 'bitable', 'bitable-gallery', 'bitable-gantt', 'bitable-kanban', 'div-table', 'embed', 'file', 'sync'].includes(blockTools.type)
      && activeBlockElRef.current
      && editor
    ) {
      try {
        syncEditorSelectionToAnchoredBlock(editor, activeBlockElRef.current);
      } catch {
        editor.commands.focus();
      }
    } else if (blockTools.type === 'image' && activeBlockElRef.current && editor) {
      try {
        const pos = editor.view.posAtDOM(activeBlockElRef.current, 0);
        editor.commands.setNodeSelection(pos);
      } catch {
        editor.commands.focus();
      }
    } else if (blockTools.type === 'table' && editor) {
      const host = activeTableHost ?? activeBlockElRef.current;
      if (host) {
        setTableHandleHovered(true);
        selectTableNodeFromHost(editor, host);
      }
    } else {
      editor?.commands.focus();
    }
    closeSlashMenu();
    const tableBtn = blockTools.type === 'table' ? tableHandleRef.current : null;
    if (tableBtn?.isConnected) {
      const pos = computeTableBlockMenuPosition(tableBtn.getBoundingClientRect());
      setContextMenu({ ...pos, variant: 'table' });
      return;
    }
    const btn = blockDragRowRef.current;
    if (btn?.isConnected) {
      const pos = computeBlockPanelPosition(btn.getBoundingClientRect());
      setContextMenu({
        ...pos,
        variant: isImageTarget ? 'image' : isBitableTarget ? 'bitable' : 'block',
      });
      return;
    }
    const area = editorAreaRef.current;
    if (area) {
      const ar = area.getBoundingClientRect();
      setContextMenu({
        x: ar.left - 8,
        y: ar.top + blockTools.top + 30,
        variant: isImageTarget ? 'image' : isBitableTarget ? 'bitable' : 'block',
      });
    } else {
      setContextMenu({
        x: 24,
        y: blockTools.top + 30,
        variant: isImageTarget ? 'image' : isBitableTarget ? 'bitable' : 'block',
      });
    }
  };

  const handleBlockDragRowClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    if (!isBitableToolType(blockTools.type)) return;
    event.preventDefault();
    event.stopPropagation();
    openBlockConfigMenu({ skipCooldown: true });
  }, [blockTools.type, openBlockConfigMenu]);

  const focusPlusMenuTarget = useCallback(() => {
    const row = activeBlockElRef.current;
    if (!editor || !row?.isConnected) return;
    try {
      const pos = editor.view.posAtDOM(row, 0);
      const node = editor.state.doc.nodeAt(pos);
      if (node?.isBlock) {
        (editor as any).__plusInsertRange = { from: pos, to: pos + node.nodeSize };
      } else {
        (editor as any).__plusInsertRange = null;
      }
      editor.chain().focus(Math.min(pos + 1, editor.state.doc.content.size)).run();
    } catch {
      (editor as any).__plusInsertRange = null;
      editor.commands.focus();
    }
  }, [editor]);

  useEffect(() => () => cancelContextMenuClose(), [cancelContextMenuClose]);

  useEffect(() => {
    if (!contextMenu || readOnly) return;
    const updatePos = () => {
      const isTableMenu = contextMenu?.variant === 'table';
      const button = isTableMenu ? tableHandleRef.current : blockDragRowRef.current;
      if (!button?.isConnected) return;
      const nextRect = button.getBoundingClientRect();
      const next = isTableMenu
        ? computeTableBlockMenuPosition(nextRect)
        : computeBlockPanelPosition(nextRect);
      setContextMenu(prev => {
        if (!prev) return null;
        if (prev.x === next.x && prev.y === next.y) return prev;
        return { ...next, variant: prev.variant };
      });
    };
    updatePos();
    window.addEventListener('resize', updatePos);
    document.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      document.removeEventListener('scroll', updatePos, true);
    };
  }, [contextMenu, readOnly]);

  useEffect(() => {
    if (!slashMenuVisible || !slashMenuFromPlus || readOnly) return;
    const updatePos = () => {
      const button = blockAddButtonRef.current;
      if (!button?.isConnected) return;
      const next = computePlusMenuPosition(button.getBoundingClientRect());
      setSlashMenuPos(prev =>
        prev.left === next.left && prev.top === next.top ? prev : next,
      );
    };
    updatePos();
    window.addEventListener('resize', updatePos);
    document.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      document.removeEventListener('scroll', updatePos, true);
    };
  }, [slashMenuVisible, slashMenuFromPlus, readOnly]);

  useEffect(() => {
    if (!slashMenuVisible || !slashMenuFromTableCellPlus || readOnly) return;
    let closeTimer: ReturnType<typeof setTimeout> | null = null;
    const cancelClose = () => {
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
    };
    const scheduleClose = () => {
      cancelClose();
      closeTimer = setTimeout(() => {
        closeTimer = null;
        closeSlashMenu();
      }, 160);
    };
    const handlePointerMove = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        scheduleClose();
        return;
      }
      if (target.closest('.slash-menu, .slash-submenu-portal, .feishu-table-chrome__cell-handle')) {
        cancelClose();
        return;
      }
      scheduleClose();
    };
    document.addEventListener('pointermove', handlePointerMove, true);
    return () => {
      cancelClose();
      document.removeEventListener('pointermove', handlePointerMove, true);
    };
  }, [closeSlashMenu, readOnly, slashMenuFromTableCellPlus, slashMenuVisible]);

  if (!editor) return null;

  const isCurrentBlockHeading = /^h[1-6]$/.test(blockTools.type);
  const currentBlockHasChildren = isCurrentBlockHeading && headingBlockHasChildren(activeBlockElRef.current);
  const currentHeadingCatalogueId = isCurrentBlockHeading && activeBlockElRef.current
    ? getHeadingIdFromBlockEl(editor, activeBlockElRef.current)
    : null;
  const isCurrentBlockCollapsed = Boolean(
    currentHeadingCatalogueId && collapsedHeadingIds?.has(currentHeadingCatalogueId),
  );
  const isFeishuQuickstartPage = docTitle.includes('多维表格 快速入门指南');

  return (
    <div
      className={`editor-wrap${isFeishuQuickstartPage ? ' editor-wrap--feishu-quickstart' : ''}`}
      onMouseLeave={handleEditorWrapMouseLeave}
    >
      <div className="editor-scroll">
        <div className="editor-container" ref={editorContainerRef}>
          {/* Title area wrapper for hover detection */}
          <div
            className="editor-title-area"
            ref={emojiPickerAnchorRef}
            onMouseEnter={() => setTitleHovered(true)}
            onMouseLeave={(e) => {
              const next = getRelatedNode(e.relatedTarget);
              if (next && e.currentTarget.contains(next)) return;
              if (!showEmojiPicker) setTitleHovered(false);
            }}
          >
            {/* Hover meta bar: 添加图标 / 添加封面 — absolutely positioned in top padding */}
            {titleHovered && !readOnly && !showEmojiPicker && (
              <div className="page-block-header-top">
                <div className="doc-meta-entry-container">
                  <button
                    type="button"
                    className="doc-meta-entry"
                    onClick={() => { setShowEmojiPicker(true); }}
                  >
                    <span className="universe-icon">
                      <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20.376 13h2.023c.066-.49.101-.991.101-1.5 0-6.075-4.925-11-11-11s-11 4.925-11 11 4.925 11 11 11c.509 0 1.01-.035 1.5-.101v-2.023A9 9 0 1 1 20.376 13Z" fill="currentColor"/>
                        <path d="M14.5 8a1 1 0 0 0-1 1v1a1 1 0 1 0 2 0V9a1 1 0 0 0-1-1Zm-6 0a1 1 0 0 0-1 1v1a1 1 0 1 0 2 0V9a1 1 0 0 0-1-1Zm7.574 5.5h-1.459a.5.5 0 0 0-.389.185c-.114.142-.21.25-.285.323A3.489 3.489 0 0 1 11.5 15a3.488 3.488 0 0 1-2.428-.98 3.876 3.876 0 0 1-.298-.335.5.5 0 0 0-.389-.185H6.92a.354.354 0 0 0-.313.514A5.5 5.5 0 0 0 11.5 17a5.5 5.5 0 0 0 4.892-2.984.355.355 0 0 0-.318-.516ZM19 23a1 1 0 0 1-1-1v-2h-2a1 1 0 1 1 0-2h2v-2a1 1 0 1 1 2 0v2h2a1 1 0 1 1 0 2h-2v2a1 1 0 0 1-1 1Z" fill="currentColor"/>
                      </svg>
                    </span>
                    <span className="doc-meta-entry-text">{docIcon ? '修改图标' : '添加图标'}</span>
                  </button>
                </div>
                {!docCover && (
                  <div className="doc-meta-entry-container">
                    <button
                      type="button"
                      className="doc-meta-entry"
                      onClick={handleAddCover}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M6.76 11.993l-2.85-.007a.2.2 0 01-.142-.341l2.755-2.756a.267.267 0 01.378 0l1.27 1.272 3.373-3.372a.267.267 0 01.455.189V11.8a.2.2 0 01-.2.2H6.815a.203.203 0 01-.056-.008zm-4.095 2.674c-.733 0-1.333-.6-1.333-1.333V2.667c0-.733.6-1.333 1.333-1.333h10.667c.733 0 1.333.6 1.333 1.333v10.667c0 .733-.6 1.333-1.333 1.333H2.665zm0-1.333h10.667V2.667H2.665v10.667zM4 4.001h2v2h-2V4z" fill="#646A73"/>
                      </svg>
                      <span className="doc-meta-entry-text">添加封面</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Emoji picker popover */}
            {showEmojiPicker && (
              <EmojiPicker
                currentEmoji={docIcon || undefined}
                onSelect={handleIconSelect}
                onRemove={handleIconRemove}
                onClose={() => { setShowEmojiPicker(false); setTitleHovered(false); }}
              />
            )}

            {/* Icon display + Title */}
            <div className="editor-title-row">
              {docIcon && (
                <button
                  type="button"
                  className="editor-doc-icon"
                  onClick={() => !readOnly && setShowEmojiPicker(v => !v)}
                  title={readOnly ? undefined : '点击修改图标'}
                >
                  {docIcon}
                </button>
              )}
              <input
                className="editor-title-input"
                aria-label="文档标题"
                placeholder="请输入标题"
                value={docTitle}
                onChange={handleTitleChange}
                onKeyDown={handleTitleKeyDown}
                onFocus={handleCatalogueTitleFocus}
                onBlur={handleCatalogueTitleBlur}
                readOnly={readOnly}
              />
            </div>
          </div>

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
            onPointerOver={handleEditorPointerOver}
            onPointerMove={handleEditorPointerMove}
            onContextMenu={handleEditorContextMenu}
            onMouseLeave={handleEditorMouseLeave}
            onClick={handleEditorBlankClick}
            onDoubleClick={handleEditorBlankDoubleClick}
            onDragEnter={handleFileDragOver}
            onDragOver={handleFileDragOver}
            onDragLeave={event => {
              const next = getRelatedNode(event.relatedTarget);
              if (next && event.currentTarget.contains(next)) return;
              clearFileDropState();
            }}
            onDrop={handleFileDrop}
          >
            <EditorContent editor={editor} />
            {fileDropState?.visible && (
              <div
                className={`editor-file-drop-indicator${fileDropState.disabled ? ' is-disabled' : ''}`}
                style={{ top: fileDropState.top, left: fileDropState.left, width: fileDropState.width }}
                data-no-marquee-selection="true"
              >
                <span>{fileDropState.disabled ? '此处不能插入文件' : `释放以上传 ${fileDropState.count} 个文件`}</span>
              </div>
            )}
            {!readOnly && (
              <BoxBlockSelectionLayer
                editor={editor}
                editorAreaRef={editorAreaRef}
                editorContainerRef={editorContainerRef}
                readOnly={readOnly}
              />
            )}
            {(blockTools.visible || (slashMenuVisible && slashMenuFromPlus)) && !readOnly && blockTools.type !== 'table' && !(blockTools.isInColumns && blockTools.isEmpty && !(slashMenuVisible && slashMenuFromPlus)) && (
              <div
                className={`block-inline-tools${blockTools.isInColumns ? ' is-in-columns' : ''}`}
                style={{ top: blockTools.top, left: blockTools.left }}
                onPointerEnter={() => {
                  blockHoverFloatingGroup.cancelClose();
                  setBlockGutterHoveredState(true);
                }}
                onMouseLeave={handleBlockToolsMouseLeave}
              >
                {blockTools.isEmpty && blockTools.type === 'paragraph' ? (
                  <div
                    className="block-add-hover-wrap"
                    onPointerEnter={() => {
                      blockHoverFloatingGroup.cancelClose();
                      openPlusMenu();
                    }}
                    onMouseLeave={(e) => {
                      const next = getRelatedNode(e.relatedTarget);
                      if (slashMenuFromPlus) {
                        schedulePlusMenuOnlyClose(next);
                        return;
                      }
                      if (blockHoverFloatingGroup.containsTarget(next)) return;
                      setPlusHoveredState(false);
                    }}
                  >
                    <button
                      ref={blockAddButtonRef}
                      type="button"
                      className="block-add-btn"
                      onMouseDown={e => e.preventDefault()}
                      aria-label="插入内容"
                    >
                      <span className="block-add-btn-box">
                        <IconAddOutlined size={14} color="currentColor" />
                      </span>
                    </button>
                  </div>
                ) : (
                  <button
                    ref={blockDragRowRef}
                    type="button"
                    className="block-drag-row"
                    onMouseDown={e => e.preventDefault()}
                    onPointerDown={event => beginBlockDrag(event)}
                    onPointerEnter={blockTools.type === 'table' ? undefined : () => {
                      blockHoverFloatingGroup.cancelClose();
                      if (!isBitableToolType(blockTools.type)) {
                        openBlockConfigMenu({ skipCooldown: true });
                      }
                    }}
                    onClick={handleBlockDragRowClick}
                    onMouseLeave={(e) => {
                      const next = getRelatedNode(e.relatedTarget);
                      if (next && e.currentTarget.contains(next)) return;
                      if (isPointerInContextMenuShell(next)) return;
                      scheduleContextMenuClose();
                    }}
                    aria-label="块配置"
                  >
                    <div className="hover-drag-icon-wrapper">
                      <div className="hover-block-type-icon-container">
                        <span className="menu_ud_icon color-b-500">
                          <BlockGutterGlyph type={blockTools.type} />
                        </span>
                      </div>
                      <span className="drag-handle" aria-hidden>
                        <IconDragOutlined size={16} color="currentColor" />
                      </span>
                    </div>
                  </button>
                )}
                {currentBlockHasChildren && (
                  <button
                    type="button"
                    className={`heading-collapse-toggle${isCurrentBlockCollapsed ? ' heading-collapse-toggle--collapsed' : ''}${isCurrentBlockHeading ? ' color-b-500' : ''}`}
                    title={isCurrentBlockCollapsed ? '展开' : '收起'}
                    aria-label={isCurrentBlockCollapsed ? '展开' : '收起'}
                    onMouseDown={e => e.preventDefault()}
                    onClick={e => {
                      e.stopPropagation();
                      toggleHeadingCollapse();
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <path d="M6 3.5L11 8L6 12.5" fill="currentColor" />
                    </svg>
                  </button>
                )}
              </div>
            )}
            {!readOnly && editor && (() => {
              const host =
                activeTableHost?.isConnected
                  ? activeTableHost
                  : resolveTableHostFromEditor(editor);
              const pinTableChrome =
                tableHandleHovered
                || contextMenu?.variant === 'table'
                || (host?.isConnected ? isCellSelectionInTableHost(editor, host) : false);
              return host?.isConnected ? (
              <FeishuTableOverlay
                editor={editor}
                tableHost={host}
                handleRef={tableHandleRef}
                pinChrome={pinTableChrome}
                onTableHandleActiveChange={setTableHandleHovered}
                onOpenBlockMenu={() => openBlockConfigMenu({ skipCooldown: true })}
                onBlockDragStart={(event, source) => beginBlockDrag(event, source)}
                onScheduleCloseBlockMenu={scheduleContextMenuClose}
                onCancelCloseBlockMenu={cancelContextMenuClose}
              />
              ) : null;
            })()}
            {rowHighlightBand && blockTools.type !== 'table' && !isBitableToolType(blockTools.type) && (
              <div
                className="block-row-gutter-highlight-band"
                style={{
                  top: rowHighlightBand.top,
                  left: rowHighlightBand.left,
                  width: rowHighlightBand.width,
                  height: rowHighlightBand.height,
                  right: 'auto',
                }}
                aria-hidden
              />
            )}
            {blockDragIndicator && (
              <div
                className="block-drag-drop-indicator"
                style={{
                  top: blockDragIndicator.top,
                  left: blockDragIndicator.left,
                  width: blockDragIndicator.width,
                }}
              />
            )}
            {pageLinkDialogVisible && !readOnly && (
              <div
                className="editor-page-link-pop"
                style={{ top: pageLinkPopPos.top, left: pageLinkPopPos.left }}
              >
                <div className="editor-page-link-form">
                  <label className="editor-page-link-row">
                    <span className="editor-page-link-label">文本</span>
                    <input
                      className="editor-page-link-input"
                      type="text"
                      placeholder="输入文本"
                      value={pageLinkText}
                      onChange={e => setPageLinkText(e.target.value)}
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') confirmPageLink();
                        if (e.key === 'Escape') closePageLinkDialog();
                      }}
                    />
                  </label>
                  <div className="editor-page-link-row editor-page-link-row--with-action">
                    <label className="editor-page-link-url-field">
                      <span className="editor-page-link-label">链接</span>
                      <input
                        className="editor-page-link-input"
                        type="text"
                        placeholder="粘贴或输入链接"
                        value={pageLinkUrl}
                        onChange={e => setPageLinkUrl(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') confirmPageLink();
                          if (e.key === 'Escape') closePageLinkDialog();
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="editor-page-link-ok"
                      disabled={!normalizeLinkHref(pageLinkUrl)}
                      onClick={confirmPageLink}
                    >
                      确认
                    </button>
                  </div>
                </div>
              </div>
            )}
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

      {/* SelectionBubble 使用 tippy.js，会把 DOM portal 到 body。
          放在 editor-content-area 内会让 React 在 hover 触发条件渲染时
          以已被 tippy 搬走的 DOM 作为 insertBefore 参考节点而抛错。
          这里挂在 editor-wrap 末尾，与条件渲染的块工具/行高亮解耦。 */}
      {!readOnly && editor && (
        <SelectionBubble editor={editor} documentId={documentId} />
      )}

      {/* Context Menu */}
      {contextMenu?.variant === 'table' && (
        <TableContextMenu
          editor={editor}
          x={contextMenu.x}
          y={contextMenu.y}
          anchorRef={tableHandleRef}
          blockAnchorRef={activeBlockElRef}
          onClose={closeContextMenu}
          onHoverDismiss={dismissContextMenuFromHover}
          onMouseEnterCancel={cancelContextMenuClose}
        />
      )}
      {contextMenu?.variant === 'block' && (
        <ContextMenu
          editor={editor}
          x={contextMenu.x}
          y={contextMenu.y}
          anchorRef={blockDragRowRef}
          blockAnchorRef={activeBlockElRef}
          onClose={closeContextMenu}
          onHoverDismiss={dismissContextMenuFromHover}
          onMouseEnterCancel={cancelContextMenuClose}
        />
      )}
      {contextMenu?.variant === 'bitable' && (
        <BitableContextMenu
          editor={editor}
          x={contextMenu.x}
          y={contextMenu.y}
          anchorRef={blockDragRowRef}
          blockAnchorRef={activeBlockElRef}
          onClose={closeContextMenu}
          onHoverDismiss={dismissContextMenuFromHover}
          onMouseEnterCancel={cancelContextMenuClose}
        />
      )}
      {contextMenu?.variant === 'image' && (
        <ImageContextMenu
          editor={editor}
          x={contextMenu.x}
          y={contextMenu.y}
          anchorRef={blockDragRowRef}
          blockAnchorRef={activeBlockElRef}
          onClose={closeContextMenu}
          onHoverDismiss={dismissContextMenuFromHover}
          onMouseEnterCancel={cancelContextMenuClose}
        />
      )}

      {slashMenuVisible && !slashMenuFromPlus && (
        <SlashMenu
          editor={editor}
          position={slashMenuPos}
          query={slashQuery}
          onClose={closeSlashMenu}
          onBeforeSelect={() => editor.commands.focus()}
          onMouseEnter={slashMenuFromTableCellPlus ? () => blockHoverFloatingGroup.cancelClose() : undefined}
          onMouseLeave={slashMenuFromTableCellPlus ? closeSlashMenu : undefined}
        />
      )}
      {slashMenuVisible && slashMenuFromPlus && (
        <div
          className="block-plus-menu-shell"
          onPointerEnter={() => blockHoverFloatingGroup.cancelClose()}
          onPointerLeave={(e) => {
            schedulePlusMenuOnlyClose(getRelatedNode(e.relatedTarget));
          }}
        >
          <SlashMenu
            editor={editor}
            position={slashMenuPos}
            query=""
            onClose={closeSlashMenu}
            onBeforeSelect={focusPlusMenuTarget}
            onMouseEnter={() => {
              blockHoverFloatingGroup.cancelClose();
              setPlusHoveredState(true);
            }}
            onMouseLeave={schedulePlusMenuOnlyClose}
            anchorRef={blockAddButtonRef}
          />
        </div>
      )}

    </div>
  );
}
