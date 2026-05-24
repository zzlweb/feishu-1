import type { Editor } from '@tiptap/react';
import { NodeSelection } from '@tiptap/pm/state';
import { getMediaUploadFile } from './mediaUploadRegistry';

export type ImageAlign = 'left' | 'center' | 'right';

export type ImageBlockAction = 'crop' | 'focusCaption';

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RenderedImageBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const IMAGE_BLOCK_ACTION_EVENT = 'feishu-image-block-action';

export function dispatchImageBlockAction(action: ImageBlockAction) {
  window.dispatchEvent(new CustomEvent(IMAGE_BLOCK_ACTION_EVENT, { detail: { action } }));
}

export function normalizeImageAlign(raw: unknown): ImageAlign {
  if (raw === 'left' || raw === 'right') return raw;
  return 'center';
}

export function shouldShowImageCaption(attrs: Record<string, unknown>): boolean {
  if (attrs.captionVisible === true || attrs.captionVisible === 'true') return true;
  return String(attrs.caption || '').trim().length > 0;
}

export function isImageBlockNode(node: { type: { name: string }; attrs: Record<string, unknown> }): boolean {
  if (node.type.name === 'image') return true;
  if (node.type.name === 'localFileBlock') {
    return String(node.attrs.mediaKind || '') === 'image';
  }
  return false;
}

export function isImageBlockActive(editor: Editor): boolean {
  if (editor.isActive('image')) return true;
  if (!editor.isActive('localFileBlock')) return false;
  const attrs = editor.getAttributes('localFileBlock');
  return String(attrs.mediaKind || '') === 'image';
}

export function isImageNodeSelection(editor: Editor): boolean {
  const { selection } = editor.state;
  if (!(selection instanceof NodeSelection)) return false;
  return isImageBlockNode(selection.node);
}

export function getImageBlockRange(editor: Editor): { from: number; to: number; node: { type: { name: string }; attrs: Record<string, unknown> } } | null {
  const { selection } = editor.state;
  if (selection instanceof NodeSelection && isImageBlockNode(selection.node)) {
    return { from: selection.from, to: selection.from + selection.node.nodeSize, node: selection.node };
  }
  const { $from } = selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (isImageBlockNode(node)) {
      return { from: $from.before(d), to: $from.after(d), node };
    }
  }
  return null;
}

export function getImageAlignFromEditor(editor: Editor): ImageAlign {
  const block = getImageBlockRange(editor);
  if (!block) return 'center';
  return normalizeImageAlign(block.node.attrs.align);
}

export function setImageAlignOnEditor(editor: Editor, align: ImageAlign): boolean {
  const block = getImageBlockRange(editor);
  if (!block) return false;
  editor
    .chain()
    .focus()
    .setNodeSelection(block.from)
    .updateAttributes(block.node.type.name, { align })
    .run();
  return true;
}

export function setImageCaptionVisibleOnEditor(editor: Editor, visible = true): boolean {
  const block = getImageBlockRange(editor);
  if (!block) return false;
  editor
    .chain()
    .focus()
    .setNodeSelection(block.from)
    .updateAttributes(block.node.type.name, { captionVisible: visible })
    .run();
  return true;
}

export function syncImageNodeSelection(editor: Editor, blockEl: HTMLElement | null): boolean {
  if (!blockEl?.isConnected || !editor.view.dom.contains(blockEl)) return false;
  const target =
    blockEl.classList.contains('feishu-image-block-wrap') || blockEl.classList.contains('feishu-file-block--image')
      ? blockEl
      : (blockEl.closest('.feishu-image-block-wrap, .feishu-file-block--image') as HTMLElement | null);
  if (!target) return false;
  try {
    const pos = editor.view.posAtDOM(target, 0);
    editor.chain().focus().setNodeSelection(pos).run();
    return true;
  } catch {
    return false;
  }
}

export function getRenderedImageBounds(img: HTMLImageElement): RenderedImageBounds {
  const clientWidth = img.clientWidth;
  const clientHeight = img.clientHeight;
  const naturalWidth = img.naturalWidth;
  const naturalHeight = img.naturalHeight;
  if (!clientWidth || !clientHeight || !naturalWidth || !naturalHeight) {
    return { x: 0, y: 0, width: clientWidth, height: clientHeight };
  }

  const objectFit = window.getComputedStyle(img).objectFit || 'fill';
  if (objectFit === 'contain') {
    const scale = Math.min(clientWidth / naturalWidth, clientHeight / naturalHeight);
    const width = naturalWidth * scale;
    const height = naturalHeight * scale;
    return {
      x: (clientWidth - width) / 2,
      y: (clientHeight - height) / 2,
      width,
      height,
    };
  }

  return { x: 0, y: 0, width: clientWidth, height: clientHeight };
}

export function scaleCropRectToNatural(
  crop: CropRect,
  displayWidth: number,
  displayHeight: number,
  naturalWidth: number,
  naturalHeight: number,
): CropRect {
  if (!displayWidth || !displayHeight || !naturalWidth || !naturalHeight) {
    return clampCropRect({ x: 0, y: 0, width: naturalWidth, height: naturalHeight }, naturalWidth, naturalHeight);
  }
  const scaleX = naturalWidth / displayWidth;
  const scaleY = naturalHeight / displayHeight;
  return clampCropRect({
    x: Math.round(crop.x * scaleX),
    y: Math.round(crop.y * scaleY),
    width: Math.round(crop.width * scaleX),
    height: Math.round(crop.height * scaleY),
  }, naturalWidth, naturalHeight);
}

export function clampCropRect(crop: CropRect, maxWidth: number, maxHeight: number): CropRect {
  if (!maxWidth || !maxHeight) return crop;
  const width = Math.max(1, Math.min(crop.width, maxWidth));
  const height = Math.max(1, Math.min(crop.height, maxHeight));
  const x = Math.max(0, Math.min(crop.x, maxWidth - width));
  const y = Math.max(0, Math.min(crop.y, maxHeight - height));
  return { x, y, width, height };
}

export function isNearlyFullCrop(crop: CropRect, bounds: { width: number; height: number }): boolean {
  return (
    crop.x <= 1
    && crop.y <= 1
    && Math.abs(crop.width - bounds.width) <= 2
    && Math.abs(crop.height - bounds.height) <= 2
  );
}

function resolveImageFetchUrl(src: string): string {
  if (!src) return src;
  if (src.startsWith('blob:') || src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) {
    return src;
  }
  return src.startsWith('/') ? src : `/${src}`;
}

async function waitForImageElement(img: HTMLImageElement): Promise<void> {
  if (typeof img.decode === 'function') {
    try {
      await img.decode();
    } catch {
      // fall through
    }
  }
  if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) return;
  await new Promise<void>((resolve, reject) => {
    const onLoad = () => {
      cleanup();
      if (img.naturalWidth > 0 && img.naturalHeight > 0) resolve();
      else reject(new Error('图片尺寸无效'));
    };
    const onError = () => {
      cleanup();
      reject(new Error('图片加载失败'));
    };
    const cleanup = () => {
      img.removeEventListener('load', onLoad);
      img.removeEventListener('error', onError);
    };
    img.addEventListener('load', onLoad);
    img.addEventListener('error', onError);
  });
}

async function loadImageSourceBlob(src: string, uploadId?: string): Promise<Blob> {
  const sourceFile = uploadId ? getMediaUploadFile(uploadId) : undefined;
  if (sourceFile) return sourceFile;

  const fetchUrl = resolveImageFetchUrl(src);
  const response = await fetch(fetchUrl, { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw new Error(`图片加载失败 (${response.status})`);
  const blob = await response.blob();
  if (!blob.size) throw new Error('图片数据为空');
  return blob;
}

async function cropImageBitmapToBlob(bitmap: ImageBitmap, crop: CropRect): Promise<Blob> {
  const clamped = clampCropRect(crop, bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = clamped.width;
  canvas.height = clamped.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建裁剪画布');
  ctx.drawImage(
    bitmap,
    clamped.x,
    clamped.y,
    clamped.width,
    clamped.height,
    0,
    0,
    clamped.width,
    clamped.height,
  );
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('裁剪失败，无法导出图片'));
      }, 'image/png');
    } catch (error) {
      reject(error instanceof Error ? error : new Error('裁剪失败，无法导出图片'));
    }
  });
}

async function cropLoadedImageElementToBlob(img: HTMLImageElement, crop: CropRect): Promise<Blob> {
  const clamped = clampCropRect(crop, img.naturalWidth, img.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = clamped.width;
  canvas.height = clamped.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建裁剪画布');
  ctx.drawImage(
    img,
    clamped.x,
    clamped.y,
    clamped.width,
    clamped.height,
    0,
    0,
    clamped.width,
    clamped.height,
  );
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('裁剪失败，无法导出图片'));
      }, 'image/png');
    } catch (error) {
      reject(error instanceof Error ? error : new Error('裁剪失败，无法导出图片'));
    }
  });
}

export function uploadImageBlob(blob: Blob, fileName = 'cropped.png'): Promise<{ url: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/uploads');
    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300 && json.code === 0) {
          resolve(json.data);
        } else {
          reject(new Error(json.message || `上传失败 (${xhr.status})`));
        }
      } catch (error) {
        reject(error instanceof Error ? error : new Error('上传失败'));
      }
    };
    xhr.onerror = () => reject(new Error('网络错误，上传失败'));
    const form = new FormData();
    form.append('file', new File([blob], fileName, { type: blob.type || 'image/png' }));
    xhr.send(form);
  });
}

export interface ApplyCropOptions {
  uploadId?: string;
}

export async function applyCropFromImageElement(
  img: HTMLImageElement,
  crop: CropRect,
  displayWidth: number,
  displayHeight: number,
  src: string,
  options: ApplyCropOptions = {},
): Promise<string> {
  await waitForImageElement(img);

  let naturalWidth = img.naturalWidth;
  let naturalHeight = img.naturalHeight;
  let outputBlob: Blob;
  let primaryError: unknown;

  const naturalCrop = () => scaleCropRectToNatural(crop, displayWidth, displayHeight, naturalWidth, naturalHeight);

  try {
    const sourceBlob = await loadImageSourceBlob(src, options.uploadId);
    const bitmap = await createImageBitmap(sourceBlob);
    naturalWidth = bitmap.width;
    naturalHeight = bitmap.height;
    try {
      outputBlob = await cropImageBitmapToBlob(bitmap, naturalCrop());
    } finally {
      bitmap.close();
    }
  } catch (error) {
    primaryError = error;
    naturalWidth = img.naturalWidth;
    naturalHeight = img.naturalHeight;
    if (!naturalWidth || !naturalHeight) {
      throw new Error(primaryError instanceof Error ? primaryError.message : '裁剪失败');
    }
    try {
      outputBlob = await cropLoadedImageElementToBlob(img, naturalCrop());
    } catch {
      throw new Error(primaryError instanceof Error ? primaryError.message : '裁剪失败');
    }
  }

  if (src.startsWith('blob:') || src.startsWith('data:')) {
    return URL.createObjectURL(outputBlob);
  }

  const result = await uploadImageBlob(outputBlob);
  const cacheBust = `t=${Date.now()}`;
  return result.url.includes('?') ? `${result.url}&${cacheBust}` : `${result.url}?${cacheBust}`;
}
