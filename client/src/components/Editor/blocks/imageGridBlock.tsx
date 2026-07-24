import { Node as TiptapNode } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import ImageBlockToolbar from '../media/ImageBlockToolbar';
import ImageCropOverlay from '../media/ImageCropOverlay';
import ImageViewer from '../media/ImageViewer';
import { normalizeImageAlign, type ImageAlign } from '../media/imageBlockUtils';
import { useImageBlockInteractions } from '../media/useImageBlockInteractions';
import { makeFeishuBlockId, readFeishuBlockId } from './feishuBlockId';
import { resolveGridColumnCount } from './imageGridDrag';
import './ImageGridBlock.less';

export interface ImageGridCell {
  src: string;
  alt?: string;
  align?: ImageAlign;
  caption?: string;
  captionVisible?: boolean;
  originalSrc?: string;
}

function blockDomAttrs(attrs: Record<string, unknown> | null | undefined) {
  const blockId = typeof attrs?.blockId === 'string' && attrs.blockId ? attrs.blockId : '';
  return blockId ? { id: blockId, 'data-block-id': blockId } : {};
}

function parseImagesAttr(raw: unknown): ImageGridCell[] {
  if (Array.isArray(raw)) {
    return raw
      .map(item => {
        if (!item || typeof item !== 'object') return null;
        const src = String((item as ImageGridCell).src || '').trim();
        if (!src) return null;
        const alt = String((item as ImageGridCell).alt || '').trim();
        const caption = String((item as ImageGridCell).caption || '');
        const originalSrc = String((item as ImageGridCell).originalSrc || '');
        return {
          src,
          ...(alt ? { alt } : {}),
          ...(caption ? { caption } : {}),
          ...((item as ImageGridCell).captionVisible ? { captionVisible: true } : {}),
          ...((item as ImageGridCell).align ? { align: normalizeImageAlign((item as ImageGridCell).align) } : {}),
          ...(originalSrc ? { originalSrc } : {}),
        };
      })
      .filter((item): item is ImageGridCell => Boolean(item));
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      return parseImagesAttr(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  return [];
}

function stringifyImagesAttr(images: ImageGridCell[]): string {
  return JSON.stringify(images.map(image => ({
    src: image.src,
    ...(image.alt ? { alt: image.alt } : {}),
    ...(image.caption ? { caption: image.caption } : {}),
    ...(image.captionVisible ? { captionVisible: true } : {}),
    ...(image.align ? { align: normalizeImageAlign(image.align) } : {}),
    ...(image.originalSrc ? { originalSrc: image.originalSrc } : {}),
  })));
}

function isBlankColumnChild(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.matches('img')) return false;
  if (el.matches('p, div, span')) {
    const text = (el.textContent || '').trim();
    const hasMedia = Boolean(el.querySelector('img, video, iframe, table'));
    return !text && !hasMedia;
  }
  return false;
}

function collectImagesFromColumnEl(col: Element): ImageGridCell[] | null {
  const images: ImageGridCell[] = [];
  for (const child of Array.from(col.children)) {
    if (child.matches('img')) {
      const src = child.getAttribute('src') || '';
      if (!src) return null;
      const alt = child.getAttribute('alt') || '';
      images.push(alt ? { src, alt } : { src });
      continue;
    }
    const nestedImg = child.querySelector(':scope > img, :scope img.feishu-image');
    if (nestedImg && child.children.length <= 2) {
      const src = nestedImg.getAttribute('src') || '';
      if (!src) return null;
      const alt = nestedImg.getAttribute('alt') || '';
      images.push(alt ? { src, alt } : { src });
      continue;
    }
    if (isBlankColumnChild(child)) continue;
    return null;
  }
  return images.length ? images : null;
}

/** 兼容旧导入：纯图分栏 HTML → 图片排版 attrs */
export function attrsFromImageOnlyColumns(element: HTMLElement): { images: ImageGridCell[]; columnCount: number } | false {
  const wraps = Array.from(element.querySelectorAll(':scope > [data-local-column], :scope > .feishu-columns-block__col-wrap'));
  if (wraps.length < 2) return false;
  const perColumn = wraps.map(wrap => {
    const col = wrap.querySelector('.feishu-columns-block__col') || wrap;
    return collectImagesFromColumnEl(col);
  });
  if (perColumn.some(images => !images?.length)) return false;
  const images: ImageGridCell[] = [];
  const maxRows = Math.max(...perColumn.map(column => column!.length));
  for (let row = 0; row < maxRows; row += 1) {
    for (let col = 0; col < perColumn.length; col += 1) {
      const image = perColumn[col]![row];
      if (image) images.push(image);
    }
  }
  if (images.length < 2) return false;
  return { images, columnCount: wraps.length };
}

function attrsFromImageGridElement(element: HTMLElement): { images: ImageGridCell[]; columnCount: number } {
  const raw = element.getAttribute('data-images');
  if (raw) {
    const parsed = parseImagesAttr(raw);
    if (parsed.length) {
      const colsAttr = Number(element.getAttribute('data-cols'));
      const columnCount = Number.isFinite(colsAttr) && colsAttr > 0
        ? Math.min(6, Math.max(1, Math.round(colsAttr)))
        : Math.min(3, Math.max(2, parsed.length));
      return { images: parsed, columnCount };
    }
  }

  const cells = Array.from(element.querySelectorAll(
    ':scope > .feishu-image-grid__cell img, :scope > img, '
    + ':scope .feishu-image-grid__surface .feishu-image-grid__cell img, '
    + ':scope .feishu-image-grid__cell img.feishu-image-grid__img',
  ));
  const images = cells
    .map(img => {
      const src = img.getAttribute('src') || '';
      if (!src) return null;
      const alt = img.getAttribute('alt') || '';
      return alt ? { src, alt } : { src };
    })
    .filter((item): item is ImageGridCell => Boolean(item));
  const colsAttr = Number(element.getAttribute('data-cols'));
  const columnCount = Number.isFinite(colsAttr) && colsAttr > 0
    ? Math.min(6, Math.max(1, Math.round(colsAttr)))
    : Math.min(3, Math.max(2, images.length));
  return { images, columnCount };
}

function resolveImageLoadState(img: HTMLImageElement | null): 'loading' | 'loaded' | 'error' {
  if (!img) return 'loading';
  if (img.complete) return img.naturalWidth > 0 ? 'loaded' : 'error';
  return 'loading';
}

function GridCellImage({
  src,
  alt,
  imageRef,
  align,
}: {
  src: string;
  alt: string;
  imageRef?: MutableRefObject<HTMLImageElement | null>;
  align?: ImageAlign;
}) {
  const localRef = useRef<HTMLImageElement>(null);
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'error'>(() => resolveImageLoadState(null));
  const [reloadNonce, setReloadNonce] = useState(0);

  const syncLoadState = (img: HTMLImageElement | null) => {
    setLoadState(resolveImageLoadState(img));
  };

  const setMergedRef = (el: HTMLImageElement | null) => {
    (localRef as MutableRefObject<HTMLImageElement | null>).current = el;
    if (imageRef) (imageRef as MutableRefObject<HTMLImageElement | null>).current = el;
    syncLoadState(el);
  };

  useEffect(() => {
    syncLoadState(localRef.current);
  }, [src, reloadNonce]);

  return (
    <>
      <img
        key={`${src}:${reloadNonce}`}
        ref={setMergedRef}
        className={`feishu-image-grid__img is-${loadState}`}
        src={src}
        alt={alt}
        style={align ? { objectPosition: `${normalizeImageAlign(align)} center` } : undefined}
        draggable={false}
        onLoad={() => setLoadState('loaded')}
        onError={() => setLoadState('error')}
      />
      {loadState === 'loaded' ? null : (
        <div className={`feishu-image-grid__load-state feishu-image-grid__load-state--${loadState}`}>
          {loadState === 'loading' ? (
            <>
              <span className="feishu-image-grid__load-spinner" aria-hidden />
              <span>图片加载中</span>
            </>
          ) : (
            <>
              <span>图片加载失败</span>
              <button
                type="button"
                onMouseDown={event => event.preventDefault()}
                onClick={event => {
                  event.stopPropagation();
                  setReloadNonce(value => value + 1);
                }}
              >
                重新加载
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}

function ActiveGridCellChrome({
  image,
  editor,
  getPos,
  blockId,
  cellImageRef,
  updateImage,
  ensureBlockId,
}: {
  image: ImageGridCell;
  editor: NodeViewProps['editor'];
  getPos: NodeViewProps['getPos'];
  blockId: string;
  cellImageRef: MutableRefObject<HTMLImageElement | null>;
  updateImage: (patch: Record<string, unknown>) => void;
  ensureBlockId: (id: string) => void;
}) {
  const align = normalizeImageAlign(image.align);
  const {
    captionRef,
    showCaption,
    hasCrop,
    isCropping,
    isViewerOpen,
    cropRect,
    setCropRect,
    focusCaption,
    toggleCrop,
    handleBoundsChange,
    setAlign,
    openViewer,
    closeViewer,
    download,
    resetImage,
  } = useImageBlockInteractions({
    editor,
    getPos,
    updateAttributes: updateImage,
    attrs: image as unknown as Record<string, unknown>,
    src: image.src,
    fileName: image.alt || 'image',
    imageRef: cellImageRef,
  });

  return (
    <>
      <ImageBlockToolbar
        editor={editor}
        align={align}
        onAlignChange={setAlign}
        onCaptionClick={focusCaption}
        onCropClick={toggleCrop}
        onResetClick={resetImage}
        onPreviewClick={openViewer}
        onDownloadClick={download}
        isCropping={isCropping}
        hasCrop={hasCrop}
        documentId={(editor as any).__documentId}
        blockId={blockId}
        onEnsureBlockId={ensureBlockId}
      />
      {isCropping && image.src ? (
        <ImageCropOverlay
          imageRef={cellImageRef}
          crop={cropRect}
          onCropChange={setCropRect}
          onBoundsChange={handleBoundsChange}
        />
      ) : null}
      {showCaption ? (
        <textarea
          ref={captionRef}
          className="feishu-media-caption feishu-image-grid__caption"
          placeholder="添加描述"
          rows={Math.max(1, String(image.caption || '').split('\n').length)}
          value={image.caption || ''}
          onChange={event => updateImage({ caption: event.target.value })}
          onBlur={event => {
            if (!event.target.value.trim()) updateImage({ captionVisible: false });
          }}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          onMouseDown={event => event.stopPropagation()}
          data-no-marquee-selection="true"
        />
      ) : null}
      {isViewerOpen ? (
        <ImageViewer
          src={image.src}
          alt={image.alt || ''}
          fileName={image.alt || 'image'}
          onClose={closeViewer}
        />
      ) : null}
    </>
  );
}

function GridCellFigure({
  image,
  index,
  isActive,
  editor,
  getPos,
  blockId,
  updateImage,
  ensureBlockId,
  onSelect,
}: {
  image: ImageGridCell;
  index: number;
  isActive: boolean;
  editor: NodeViewProps['editor'];
  getPos: NodeViewProps['getPos'];
  blockId: string;
  updateImage: (patch: Record<string, unknown>) => void;
  ensureBlockId: (id: string) => void;
  onSelect: (index: number) => void;
}) {
  const imageRef = useRef<HTMLImageElement>(null);
  const wasActiveOnPointerDown = useRef(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  return (
    <figure
      className={`feishu-image-grid__cell${isActive ? ' is-active' : ''}`}
      onMouseDown={event => {
        if ((event.target as Element).closest(
          'a, button, textarea, .docx-menu-container, .docx-menu-wrapper, .feishu-image-crop-layer, .feishu-image-resize-handle',
        )) return;
        event.preventDefault();
        event.stopPropagation();
        window.getSelection()?.removeAllRanges();
        wasActiveOnPointerDown.current = isActive;
        onSelect(index);
      }}
      onClick={event => {
        if ((event.target as Element).closest(
          'a, button, textarea, .docx-menu-container, .docx-menu-wrapper, .feishu-image-crop-layer, .feishu-image-resize-handle',
        )) return;
        if (wasActiveOnPointerDown.current && !document.body.classList.contains('feishu-block-dragging')) {
          setIsViewerOpen(true);
        }
      }}
    >
      <GridCellImage
        src={image.src}
        alt={image.alt || ''}
        imageRef={imageRef}
        align={image.align}
      />
      {isActive ? (
        <ActiveGridCellChrome
          image={image}
          editor={editor}
          getPos={getPos}
          blockId={blockId}
          cellImageRef={imageRef}
          updateImage={updateImage}
          ensureBlockId={ensureBlockId}
        />
      ) : null}
      {isActive ? (
        <>
          <span className="feishu-image-resize-handle feishu-image-resize-handle--nw" aria-hidden />
          <span className="feishu-image-resize-handle feishu-image-resize-handle--ne" aria-hidden />
          <span className="feishu-image-resize-handle feishu-image-resize-handle--sw" aria-hidden />
          <span className="feishu-image-resize-handle feishu-image-resize-handle--se" aria-hidden />
        </>
      ) : null}
      {isViewerOpen ? (
        <ImageViewer
          src={image.src}
          alt={image.alt || ''}
          fileName={image.alt || 'image'}
          onClose={() => setIsViewerOpen(false)}
        />
      ) : null}
    </figure>
  );
}

function ImageGridBlockView({ node, selected, editor, getPos, updateAttributes }: NodeViewProps) {
  const images = parseImagesAttr(node.attrs.images);
  const columnCount = resolveGridColumnCount(Number(node.attrs.columnCount) || 2, images.length);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!selected) setActiveIndex(null);
  }, [selected]);

  useEffect(() => {
    const clearInactiveCell = () => {
      if (!editor.isActive('localImageGridBlock')) setActiveIndex(null);
    };
    const clearOnEditorBlur = () => setActiveIndex(null);
    editor.on('selectionUpdate', clearInactiveCell);
    editor.on('blur', clearOnEditorBlur);
    return () => {
      editor.off('selectionUpdate', clearInactiveCell);
      editor.off('blur', clearOnEditorBlur);
    };
  }, [editor]);

  useEffect(() => {
    const storedColumnCount = Number(node.attrs.columnCount) || 2;
    if (images.length > 1 && columnCount !== storedColumnCount) {
      updateAttributes({ columnCount });
    }
  }, [columnCount, images.length, node.attrs.columnCount, updateAttributes]);

  // attrs 丢失时尝试从 data-images / 子 img 恢复（避免「加载成功但空白」）
  useEffect(() => {
    if (images.length > 0) return;
    const pos = typeof getPos === 'function' ? getPos() : null;
    if (typeof pos !== 'number') return;
    const wrapper = editor.view.nodeDOM(pos);
    if (!(wrapper instanceof HTMLElement)) return;
    const raw = wrapper.getAttribute('data-images');
    const recovered = raw ? parseImagesAttr(raw) : attrsFromImageGridElement(wrapper).images;
    if (!recovered.length) return;
    updateAttributes({
      images: recovered,
      columnCount: Math.max(1, Math.min(6, Number(wrapper.getAttribute('data-cols')) || columnCount)),
    });
  }, [columnCount, editor, getPos, images.length, updateAttributes]);

  const selectBlock = (index?: number) => {
    const pos = typeof getPos === 'function' ? getPos() : null;
    if (typeof pos === 'number') {
      editor.chain().focus().setNodeSelection(pos).run();
    }
    if (typeof index === 'number') setActiveIndex(index);
  };

  const blockId = readFeishuBlockId(node.attrs) || '';
  const ensureBlockId = (id: string) => {
    if (!id || blockId === id) return;
    updateAttributes({ blockId: id });
  };
  const updateImage = (index: number, patch: Record<string, unknown>) => {
    const nextImages = images.map((image, imageIndex) => (
      imageIndex === index ? { ...image, ...patch } as ImageGridCell : image
    ));
    updateAttributes({ images: stringifyImagesAttr(nextImages) });
  };

  // 根节点始终写 data-images，避免 NodeView 序列化/autosave 丢 attrs
  const imagesAttr = stringifyImagesAttr(images);

  return (
    <NodeViewWrapper
      className={`feishu-image-grid${selected ? ' is-selected' : ''}`}
      data-local-block="image-grid"
      data-cols={columnCount}
      data-images={imagesAttr}
      {...blockDomAttrs(node.attrs)}
      contentEditable={false}
      onMouseDown={(event: React.MouseEvent<HTMLElement>) => {
        if ((event.target as Element).closest('a, button')) return;
        event.preventDefault();
        window.getSelection()?.removeAllRanges();
        if (!blockId) updateAttributes({ blockId: makeFeishuBlockId('localImageGridBlock') });
        selectBlock();
      }}
      style={{ ['--feishu-image-grid-cols' as string]: String(columnCount) }}
    >
      <div className="feishu-image-grid__surface">
        {images.map((image, index) => (
          <GridCellFigure
            key={`${image.src}-${index}`}
            image={image}
            index={index}
            isActive={selected && activeIndex === index}
            editor={editor}
            getPos={getPos}
            blockId={blockId}
            updateImage={patch => updateImage(index, patch)}
            ensureBlockId={ensureBlockId}
            onSelect={selectBlock}
          />
        ))}
      </div>
    </NodeViewWrapper>
  );
}

export const LocalImageGridBlock = TiptapNode.create({
  name: 'localImageGridBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  priority: 1000,
  addAttributes() {
    return {
      // 用 JSON 字符串存，避免 TipTap/PM 对 object/array attrs 在部分序列化路径丢数据
      images: {
        default: '[]',
        parseHTML: element => {
          const parsed = attrsFromImageGridElement(element as HTMLElement).images;
          return stringifyImagesAttr(parsed);
        },
        renderHTML: attributes => {
          const images = parseImagesAttr(attributes.images);
          return { 'data-images': stringifyImagesAttr(images) };
        },
      },
      columnCount: {
        default: 2,
        parseHTML: element => {
          const raw = Number(element.getAttribute('data-cols'));
          return Number.isFinite(raw) && raw > 0 ? Math.min(6, Math.max(1, Math.round(raw))) : 2;
        },
        renderHTML: attributes => ({
          'data-cols': String(Math.max(1, Math.min(6, Number(attributes.columnCount) || 2))),
        }),
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'div[data-local-block="image-grid"]',
        getAttrs: element => {
          if (!(element instanceof HTMLElement)) return false;
          const attrs = attrsFromImageGridElement(element);
          if (attrs.images.length < 1) return false;
          return {
            images: stringifyImagesAttr(attrs.images),
            columnCount: attrs.columnCount,
          };
        },
      },
      {
        // 旧文档：纯图 columns 升级为图片排版（优先于 localColumnsBlock）
        tag: 'div[data-local-block="columns"]',
        priority: 60,
        getAttrs: element => {
          if (!(element instanceof HTMLElement)) return false;
          const attrs = attrsFromImageOnlyColumns(element);
          if (!attrs) return false;
          return {
            images: stringifyImagesAttr(attrs.images),
            columnCount: attrs.columnCount,
          };
        },
      },
    ];
  },
  renderHTML({ HTMLAttributes, node }) {
    const images = parseImagesAttr(node.attrs.images);
    const columnCount = Math.max(1, Math.min(6, Number(node.attrs.columnCount) || 2));
    return [
      'div',
      {
        ...HTMLAttributes,
        'data-local-block': 'image-grid',
        'data-cols': String(columnCount),
        'data-images': stringifyImagesAttr(images),
        class: 'feishu-image-grid',
      },
      ...images.map(image => [
        'figure',
        { class: 'feishu-image-grid__cell' },
        ['img', { class: 'feishu-image', src: image.src, alt: image.alt || '' }],
      ]),
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageGridBlockView);
  },
});
