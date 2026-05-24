import { useCallback, useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { MessagePlugin } from 'tdesign-react';
import {
  IMAGE_BLOCK_ACTION_EVENT,
  applyCropFromImageElement,
  isNearlyFullCrop,
  shouldShowImageCaption,
  type CropRect,
  type ImageAlign,
  type RenderedImageBounds,
} from './imageBlockUtils';
import { registerImageCropSession } from './imageCropSession';

type NodeViewPropsGetPos = (() => number | undefined) | boolean;

interface UseImageBlockInteractionsOptions {
  editor: Editor;
  getPos: NodeViewPropsGetPos;
  updateAttributes: (attrs: Record<string, unknown>) => void;
  attrs: Record<string, unknown>;
  src: string;
  isLocalFileBlock?: boolean;
  uploadId?: string;
}

export function useImageBlockInteractions({
  editor,
  getPos,
  updateAttributes,
  attrs,
  src,
  isLocalFileBlock = false,
  uploadId = '',
}: UseImageBlockInteractionsOptions) {
  const captionRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const cropRectRef = useRef<CropRect | null>(null);
  const boundsRef = useRef<RenderedImageBounds>({ x: 0, y: 0, width: 0, height: 0 });
  const isApplyingCropRef = useRef(false);
  const [isCropping, setIsCropping] = useState(false);
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const showCaption = shouldShowImageCaption(attrs);

  const setCropRectState = useCallback((next: CropRect | null) => {
    cropRectRef.current = next;
    setCropRect(next);
  }, []);

  const setNodeSelection = () => {
    const pos = typeof getPos === 'function' ? getPos() : null;
    if (typeof pos === 'number') editor.commands.setNodeSelection(pos);
  };

  const focusCaption = () => {
    updateAttributes({ captionVisible: true });
    setNodeSelection();
    window.requestAnimationFrame(() => captionRef.current?.focus());
  };

  const cancelCrop = useCallback(() => {
    setIsCropping(false);
    setCropRectState(null);
  }, [setCropRectState]);

  const handleCropConfirm = useCallback(async () => {
    if (!src || isApplyingCropRef.current) return false;
    const img = imageRef.current;
    const crop = cropRectRef.current;
    const bounds = boundsRef.current;
    if (!img || !crop || bounds.width <= 0 || bounds.height <= 0) return false;

    if (isNearlyFullCrop(crop, bounds)) {
      cancelCrop();
      return true;
    }

    isApplyingCropRef.current = true;
    try {
      const nextSrc = await applyCropFromImageElement(img, crop, bounds.width, bounds.height, src, { uploadId });
      const patch: Record<string, unknown> = isLocalFileBlock
        ? { url: nextSrc, previewUrl: nextSrc, localObjectUrl: '' }
        : { src: nextSrc };
      updateAttributes(patch);
      setIsCropping(false);
      setCropRectState(null);
      return true;
    } catch (error) {
      void MessagePlugin.error(error instanceof Error ? error.message : '裁剪失败');
      return false;
    } finally {
      isApplyingCropRef.current = false;
    }
  }, [cancelCrop, isLocalFileBlock, setCropRectState, src, updateAttributes, uploadId]);

  const toggleCrop = useCallback(async () => {
    if (!src) {
      void MessagePlugin.warning('图片尚未就绪，暂无法裁剪');
      return;
    }
    const img = imageRef.current;
    if (img && (!img.complete || !img.naturalWidth)) {
      try {
        await img.decode();
      } catch {
        void MessagePlugin.warning('图片尚未加载完成，请稍后再试');
        return;
      }
    }
    setNodeSelection();
    if (isCropping) {
      void handleCropConfirm();
      return;
    }
    setCropRectState(null);
    setIsCropping(true);
  }, [handleCropConfirm, isCropping, setCropRectState, src]);

  const setAlign = (align: ImageAlign) => updateAttributes({ align });

  const handleBoundsChange = useCallback((bounds: RenderedImageBounds) => {
    boundsRef.current = bounds;
  }, []);

  useEffect(() => {
    if (!isCropping) return undefined;

    const shouldSkipConfirmTarget = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;
      if (target.closest('.feishu-image-crop-layer')) return true;
      if (target.closest('.docx-menu-container, .docx-menu-wrapper')) return true;
      return false;
    };

    const unregister = registerImageCropSession({
      shouldSkipConfirmTarget,
      confirm: handleCropConfirm,
      cancel: cancelCrop,
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancelCrop();
      if (event.key === 'Enter') void handleCropConfirm();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      unregister();
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [cancelCrop, handleCropConfirm, isCropping]);

  useEffect(() => {
    const onAction = (event: Event) => {
      const detail = (event as CustomEvent<{ action?: string }>).detail;
      if (!detail?.action) return;
      if (typeof getPos !== 'function') return;
      const pos = getPos();
      if (typeof pos !== 'number') return;
      const { selection } = editor.state;
      if (selection.from !== pos) return;
      if (detail.action === 'crop') toggleCrop();
      if (detail.action === 'focusCaption') focusCaption();
    };
    window.addEventListener(IMAGE_BLOCK_ACTION_EVENT, onAction as EventListener);
    return () => window.removeEventListener(IMAGE_BLOCK_ACTION_EVENT, onAction as EventListener);
  });

  return {
    captionRef,
    imageRef,
    showCaption,
    isCropping,
    cropRect,
    setCropRect: setCropRectState,
    focusCaption,
    toggleCrop,
    cancelCrop,
    handleCropConfirm,
    handleBoundsChange,
    setAlign,
    setNodeSelection,
  };
}