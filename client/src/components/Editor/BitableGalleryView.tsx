import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { getAttachments, selectCoverAttachment, valueText, type AttachmentValue, type BaseRecord, type BaseTable, type GalleryViewConfig } from './bitableModel';
import { BitableGalleryRecordContextMenu } from './BitableGalleryRecordContextMenu';
import { isPreviewImage } from './BitableViewShared';

export interface BitableGalleryGroup {
  key: string;
  label: string;
  records: BaseRecord[];
}

export interface BitableGalleryViewProps {
  table: BaseTable;
  config: GalleryViewConfig;
  groups: BitableGalleryGroup[];
  records: BaseRecord[];
  selectedIds: Set<string>;
  collapsedGroups: Set<string>;
  dropActive: boolean;
  setCollapsedGroups: (update: (current: Set<string>) => Set<string>) => void;
  onDropFiles: (event: DragEvent, recordId?: string) => void;
  setDropActive: (active: boolean) => void;
  cardClick: (event: MouseEvent, recordId: string) => void;
  removeRecords: (recordIds: string[], requireConfirm?: boolean) => boolean;
  addRecord: () => void;
  locked?: boolean;
  onInsertRecordLeft: (recordId: string) => void;
  onInsertRecordRight: (recordId: string) => void;
  onShareRecord: (recordId: string) => void;
  onCopyRecordLink: (recordId: string) => void;
  onDuplicateRecord: (recordId: string) => void;
  onOpenRecord: (recordId: string) => void;
  onOpenComment: (recordId: string) => void;
}

interface GalleryCardLayout {
  type: 'card';
  key: string;
  record: BaseRecord;
  x: number;
  y: number;
  width: number;
  height: number;
  coverHeight: number;
  deleteRect?: { x: number; y: number; width: number; height: number };
}

interface GalleryHeaderLayout {
  type: 'header';
  key: string;
  group: BitableGalleryGroup;
  x: number;
  y: number;
  width: number;
  height: number;
}

type GalleryLayoutItem = GalleryCardLayout | GalleryHeaderLayout;

const GALLERY_PADDING_X = 18;
const GALLERY_PADDING_TOP = 16;
const GALLERY_PADDING_BOTTOM = 16;
const GALLERY_GAP = 17;
const GALLERY_GROUP_GAP = 18;
const HEADER_HEIGHT = 34;
const HEADER_MARGIN_BOTTOM = 10;
const ADD_RECORD_HEIGHT = 28;
const ADD_RECORD_MARGIN_TOP = 8;
const ADD_RECORD_WIDTH = 118;
const EMPTY_HEIGHT = 176;

const CARD_WIDTH_BY_SIZE: Record<GalleryViewConfig['cardSize'], number> = {
  small: 188,
  medium: 258,
  large: 292,
};

/** 飞书画册默认列数：中号一行三列 */
const PREFERRED_COLUMNS_BY_SIZE: Record<GalleryViewConfig['cardSize'], number> = {
  small: 4,
  medium: 3,
  large: 2,
};

const MIN_CARD_WIDTH_BY_SIZE: Record<GalleryViewConfig['cardSize'], number> = {
  small: 140,
  medium: 168,
  large: 210,
};

function resolveGalleryColumns(usableWidth: number, cardSize: GalleryViewConfig['cardSize']) {
  const minWidth = MIN_CARD_WIDTH_BY_SIZE[cardSize] || MIN_CARD_WIDTH_BY_SIZE.medium;
  let columns = PREFERRED_COLUMNS_BY_SIZE[cardSize] || 3;
  while (columns > 1) {
    const cardWidth = Math.floor((usableWidth - (columns - 1) * GALLERY_GAP) / columns);
    if (cardWidth >= minWidth) return { columns, cardWidth };
    columns -= 1;
  }
  return { columns: 1, cardWidth: usableWidth };
}

const CARD_TITLE_BODY_HEIGHT = 56;
const CARD_FIELD_ROW_HEIGHT = 28;
const CARD_BODY_PADDING_X = 16;
const CARD_BODY_PADDING_TOP = 16;

function coverHeightFor(width: number, config: GalleryViewConfig) {
  if (config.emptyCoverMode === 'hide-cover') return 0;
  if (config.cardAspectRatio === '1:1') return width;
  if (config.cardAspectRatio === '16:9') return Math.round(width * 9 / 16);
  if (config.cardAspectRatio === 'auto') return 120;
  return Math.round(width * 160 / CARD_WIDTH_BY_SIZE.medium);
}

function getCoverUrl(attachment: AttachmentValue | undefined) {
  if (!isPreviewImage(attachment)) return '';
  return attachment?.thumbnailUrl || attachment?.previewUrl || attachment?.url || '';
}

function displayedFieldIds(record: BaseRecord, table: BaseTable, config: GalleryViewConfig) {
  return config.visibleFieldIds.filter(fieldId => {
    const field = table.fields.find(item => item.id === fieldId);
    if (!field) return false;
    return config.showEmptyFields || Boolean(valueText(record.fields[field.id]));
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawEllipsisText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) {
    ctx.fillText(text, x, y);
    return;
  }
  let next = text;
  while (next.length > 0 && ctx.measureText(`${next}…`).width > maxWidth) {
    next = next.slice(0, -1);
  }
  ctx.fillText(next ? `${next}…` : '…', x, y);
}

function drawWrappedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const words = Array.from(text);
  let line = '';
  let lineIndex = 0;
  for (const word of words) {
    const test = `${line}${word}`;
    if (line && ctx.measureText(test).width > maxWidth) {
      if (lineIndex === maxLines - 1) {
        drawEllipsisText(ctx, line, x, y + lineIndex * lineHeight, maxWidth);
        return;
      }
      ctx.fillText(line, x, y + lineIndex * lineHeight);
      line = word;
      lineIndex += 1;
    } else {
      line = test;
    }
  }
  if (line) drawEllipsisText(ctx, line, x, y + lineIndex * lineHeight, maxWidth);
}

function clipRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  roundRect(ctx, x, y, width, height, radius);
  ctx.clip();
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  fit: GalleryViewConfig['coverFit'],
  position: GalleryViewConfig['coverPosition'],
) {
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  if (!iw || !ih) return;

  const scale = fit === 'contain' ? Math.min(width / iw, height / ih) : Math.max(width / iw, height / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  let dx = x + (width - dw) / 2;
  let dy = y + (height - dh) / 2;
  if (position === 'top') dy = y;
  if (position === 'bottom') dy = y + height - dh;
  ctx.drawImage(image, dx, dy, dw, dh);
}

function drawVideoGlyph(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + 10);
  ctx.lineTo(x + 8, y + 5);
  ctx.closePath();
  ctx.fill();
}

function drawGalleryCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  items: GalleryLayoutItem[],
  table: BaseTable,
  config: GalleryViewConfig,
  selectedIds: Set<string>,
  collapsedGroups: Set<string>,
  imageCache: Map<string, HTMLImageElement>,
  recordsLength: number,
  addRect: { x: number; y: number; width: number; height: number } | null,
) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);

  for (const item of items) {
    if (item.type === 'header') {
      const collapsed = collapsedGroups.has(item.group.key);
      ctx.fillStyle = '#1f2329';
      ctx.font = '500 14px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(collapsed ? '▸' : '▾', item.x, item.y + item.height / 2);
      ctx.fillText(item.group.label, item.x + 22, item.y + item.height / 2);
      const countText = String(item.group.records.length);
      const countWidth = Math.ceil(ctx.measureText(countText).width) + 14;
      const countX = item.x + 22 + ctx.measureText(item.group.label).width + 8;
      ctx.fillStyle = '#f2f3f5';
      roundRect(ctx, countX, item.y + 8, countWidth, 18, 9);
      ctx.fill();
      ctx.fillStyle = '#646a73';
      ctx.font = '12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.fillText(countText, countX + 7, item.y + 17);
      continue;
    }

    const { record, x, y, width: cardWidth, height: cardHeight, coverHeight } = item;
    const isSelected = selectedIds.has(record.id);

    ctx.save();
    ctx.shadowColor = 'rgba(31, 35, 41, .08)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#fff';
    roundRect(ctx, x, y, cardWidth, cardHeight, 6);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = isSelected ? '#3370ff' : '#e6e8eb';
    ctx.lineWidth = isSelected ? 2 : 1;
    roundRect(ctx, x + 0.5, y + 0.5, cardWidth - 1, cardHeight - 1, 6);
    ctx.stroke();

    if (coverHeight > 0) {
      ctx.save();
      clipRoundedRect(ctx, x, y, cardWidth, coverHeight + 6, 6);
      ctx.fillStyle = '#f5f6f7';
      ctx.fillRect(x, y, cardWidth, coverHeight);
      const attachments = getAttachments(record, config.coverFieldId);
      const cover = selectCoverAttachment(attachments);
      const url = getCoverUrl(cover);
      const image = url ? imageCache.get(url) : undefined;
      if (image?.complete && image.naturalWidth > 0) {
        drawImageCover(ctx, image, x, y, cardWidth, coverHeight, config.coverFit, config.coverPosition || 'center');
      } else if (cover) {
        const kind = cover.mimeType.startsWith('video/') ? 'VIDEO' : cover.extension.toUpperCase() || 'FILE';
        ctx.fillStyle = '#eef3ff';
        roundRect(ctx, x + cardWidth / 2 - 28, y + coverHeight / 2 - 28, 56, 38, 5);
        ctx.fill();
        ctx.fillStyle = '#3370ff';
        ctx.font = '700 12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        drawEllipsisText(ctx, kind, x + cardWidth / 2 - 22, y + coverHeight / 2 - 9, 44);
        ctx.fillStyle = '#646a73';
        ctx.font = '12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        drawEllipsisText(ctx, cover.name, x + 24, y + coverHeight / 2 + 18, cardWidth - 48);
        ctx.textAlign = 'left';
      } else {
        ctx.fillStyle = '#a8abb2';
        ctx.font = '26px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('▧', x + cardWidth / 2, y + coverHeight / 2 - (config.coverFieldId ? 0 : 10));
        if (!config.coverFieldId) {
          ctx.fillStyle = '#8f959e';
          ctx.font = '12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
          ctx.fillText('选择附件字段作为封面', x + cardWidth / 2, y + coverHeight / 2 + 18);
        }
        ctx.textAlign = 'left';
      }
      if (attachments.length > 1 && config.showAttachmentCount) {
        const text = String(attachments.length);
        const badgeWidth = Math.max(22, Math.ceil(ctx.measureText(text).width) + 14);
        ctx.fillStyle = 'rgba(31, 35, 41, .62)';
        roundRect(ctx, x + cardWidth - badgeWidth - 9, y + coverHeight - 27, badgeWidth, 18, 9);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x + cardWidth - badgeWidth + 7 - 9, y + coverHeight - 18);
      }
      if (cover?.mimeType.startsWith('video/')) {
        ctx.fillStyle = 'rgba(31, 35, 41, .62)';
        roundRect(ctx, x + 9, y + coverHeight - 27, 25, 18, 9);
        ctx.fill();
        ctx.fillStyle = '#fff';
        drawVideoGlyph(ctx, x + 18, y + coverHeight - 22);
      }
      ctx.restore();
    }

    const bodyX = x + CARD_BODY_PADDING_X;
    const bodyY = y + coverHeight + CARD_BODY_PADDING_TOP;
    const rawTitle = valueText(record.fields[config.titleFieldId || table.primaryFieldId]);
    const title = rawTitle || '未命名记录';
    ctx.fillStyle = rawTitle ? '#1f2329' : '#bbbfc4';
    ctx.font = `${rawTitle ? '500' : '400'} 16px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.textBaseline = 'top';
    drawWrappedText(ctx, title, bodyX, bodyY, cardWidth - 32, 22, 2);

    let fieldY = bodyY + 50;
    ctx.font = '13px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    for (const fieldId of displayedFieldIds(record, table, config)) {
      const field = table.fields.find(item => item.id === fieldId);
      if (!field) continue;
      const text = valueText(record.fields[field.id]);
      const displayText = text || '空';
      ctx.fillStyle = '#646a73';
      const label = config.showFieldNames ? `${field.name} ` : '';
      if (config.showFieldNames) {
        ctx.fillStyle = '#8f959e';
        drawEllipsisText(ctx, label, bodyX, fieldY, 88);
        ctx.fillStyle = '#646a73';
        drawEllipsisText(ctx, displayText, bodyX + Math.min(88, ctx.measureText(label).width + 6), fieldY, cardWidth - 44 - 88);
      } else {
        drawEllipsisText(ctx, displayText, bodyX, fieldY, cardWidth - 32);
      }
      fieldY += CARD_FIELD_ROW_HEIGHT;
      if (fieldY > y + cardHeight - 18) break;
    }

    if (config.showRecordActions && item.deleteRect) {
      const rect = item.deleteRect;
      ctx.fillStyle = 'rgba(31, 35, 41, .62)';
      roundRect(ctx, rect.x, rect.y, rect.width, rect.height, 5);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '18px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('×', rect.x + rect.width / 2, rect.y + rect.height / 2 - 1);
      ctx.textAlign = 'left';
    }
  }

  if (recordsLength === 0) {
    ctx.fillStyle = '#8f959e';
    ctx.font = '14px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('暂无记录', width / 2, GALLERY_PADDING_TOP + EMPTY_HEIGHT / 2 - 18);
    ctx.strokeStyle = '#3370ff';
    ctx.strokeRect(width / 2 - 48.5, GALLERY_PADDING_TOP + EMPTY_HEIGHT / 2 + 4.5, 96, 32);
    ctx.fillStyle = '#3370ff';
    ctx.fillText('新建记录', width / 2, GALLERY_PADDING_TOP + EMPTY_HEIGHT / 2 + 21);
    ctx.textAlign = 'left';
  } else if (addRect) {
    ctx.fillStyle = '#646a73';
    ctx.font = '14px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('+ 添加记录', addRect.x + 10, addRect.y + addRect.height / 2);
  }
}

export function BitableGalleryView({
  table,
  config,
  groups,
  records,
  selectedIds,
  collapsedGroups,
  dropActive,
  setCollapsedGroups,
  onDropFiles,
  setDropActive,
  cardClick,
  removeRecords,
  addRecord,
  locked = false,
  onInsertRecordLeft,
  onInsertRecordRight,
  onShareRecord,
  onCopyRecordLink,
  onDuplicateRecord,
  onOpenRecord,
  onOpenComment,
}: BitableGalleryViewProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const imageCacheRef = useRef(new Map<string, HTMLImageElement>());
  const [surfaceWidth, setSurfaceWidth] = useState(720);
  const [imagePaintTick, forceImagePaint] = useState(0);
  const [recordMenu, setRecordMenu] = useState<{ recordId: string; left: number; top: number } | null>(null);

  const closeRecordMenu = useCallback(() => setRecordMenu(null), []);

  useEffect(() => {
    if (!recordMenu) return undefined;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Node && menuRef.current?.contains(target)) return;
      closeRecordMenu();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRecordMenu();
    };
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeRecordMenu, recordMenu]);

  const openRecordMenu = useCallback((event: MouseEvent, recordId: string) => {
    event.preventDefault();
    event.stopPropagation();
    cardClick(event, recordId);
    setRecordMenu({ recordId, left: event.clientX, top: event.clientY });
  }, [cardClick]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return undefined;
    const updateWidth = () => setSurfaceWidth(Math.max(320, Math.round(surface.clientWidth || 720)));
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(surface);
    return () => observer.disconnect();
  }, []);

  const layout = useMemo(() => {
    const usableWidth = Math.max(240, surfaceWidth - GALLERY_PADDING_X * 2);
    const { columns, cardWidth } = resolveGalleryColumns(usableWidth, config.cardSize);
    const coverHeight = coverHeightFor(cardWidth, config);
    let maxVisibleFieldRows = 0;
    records.forEach(record => {
      const count = displayedFieldIds(record, table, config).length;
      maxVisibleFieldRows = Math.max(maxVisibleFieldRows, count);
    });
    const bodyHeight = CARD_TITLE_BODY_HEIGHT + Math.min(maxVisibleFieldRows, 4) * CARD_FIELD_ROW_HEIGHT;
    const cardHeight = coverHeight + bodyHeight;
    const items: GalleryLayoutItem[] = [];
    let y = GALLERY_PADDING_TOP;

    groups.forEach((group, groupIndex) => {
      if (group.label) {
        items.push({ type: 'header', key: `header:${group.key || 'all'}`, group, x: GALLERY_PADDING_X, y, width: usableWidth, height: HEADER_HEIGHT });
        y += HEADER_HEIGHT + HEADER_MARGIN_BOTTOM;
      }
      if (!collapsedGroups.has(group.key)) {
        group.records.forEach((record, index) => {
          const col = index % columns;
          const row = Math.floor(index / columns);
          const x = GALLERY_PADDING_X + col * (cardWidth + GALLERY_GAP);
          const cardY = y + row * (cardHeight + GALLERY_GAP);
          const deleteRect = config.showRecordActions
            ? { x: x + cardWidth - 34, y: cardY + 8, width: 26, height: 26 }
            : undefined;
          items.push({ type: 'card', key: record.id, record, x, y: cardY, width: cardWidth, height: cardHeight, coverHeight, deleteRect });
        });
        if (group.records.length > 0) {
          y += Math.ceil(group.records.length / columns) * cardHeight + (Math.ceil(group.records.length / columns) - 1) * GALLERY_GAP;
        }
      }
      if (groupIndex < groups.length - 1) {
        y += GALLERY_GROUP_GAP;
      }
    });

    let addRect: { x: number; y: number; width: number; height: number } | null = null;
    let height: number;
    if (records.length === 0) {
      height = Math.max(400, GALLERY_PADDING_TOP + EMPTY_HEIGHT + GALLERY_PADDING_BOTTOM);
      addRect = { x: surfaceWidth / 2 - 48, y: GALLERY_PADDING_TOP + EMPTY_HEIGHT / 2 + 4, width: 96, height: 32 };
    } else {
      const addY = y + ADD_RECORD_MARGIN_TOP;
      addRect = { x: GALLERY_PADDING_X, y: addY, width: ADD_RECORD_WIDTH, height: ADD_RECORD_HEIGHT };
      height = Math.max(400, addY + ADD_RECORD_HEIGHT + GALLERY_PADDING_BOTTOM);
    }

    return {
      items,
      height,
      addRect,
    };
  }, [collapsedGroups, config, groups, records, surfaceWidth, table]);

  useEffect(() => {
    const urls = new Set<string>();
    for (const record of records) {
      const cover = selectCoverAttachment(getAttachments(record, config.coverFieldId));
      const url = getCoverUrl(cover);
      if (url) urls.add(url);
    }

    urls.forEach(url => {
      if (imageCacheRef.current.has(url)) return;
      const image = new Image();
      image.onload = () => forceImagePaint(value => value + 1);
      image.onerror = () => forceImagePaint(value => value + 1);
      image.src = url;
      imageCacheRef.current.set(url, image);
    });
  }, [config.coverFieldId, records]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(surfaceWidth * dpr);
    canvas.height = Math.round(layout.height * dpr);
    canvas.style.width = `${surfaceWidth}px`;
    canvas.style.height = `${layout.height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawGalleryCanvas(ctx, surfaceWidth, layout.height, layout.items, table, config, selectedIds, collapsedGroups, imageCacheRef.current, records.length, layout.addRect);
  }, [collapsedGroups, config, imagePaintTick, layout, records.length, selectedIds, surfaceWidth, table]);

  const toggleGroup = useCallback((groupKey: string) => {
    setCollapsedGroups(current => {
      const next = new Set(current);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }, [setCollapsedGroups]);

  const renderButtonStyle = (rect: { x: number; y: number; width: number; height: number }): CSSProperties => ({
    left: rect.x,
    top: rect.y,
    width: rect.width,
    height: rect.height,
  });

  return (
    <div
      ref={surfaceRef}
      className={`base-gallery-surface base-gallery-surface--canvas${dropActive ? ' is-drop-active' : ''}`}
      onDragOver={event => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        setDropActive(true);
      }}
      onDragLeave={() => setDropActive(false)}
      onDrop={event => onDropFiles(event)}
    >
      <div className="base-gallery-canvas-stage" style={{ height: layout.height }}>
        <canvas ref={canvasRef} className="base-gallery-canvas" />
        <div className="base-gallery-hit-layer" aria-hidden={false}>
          {layout.items.map(item => {
            if (item.type === 'header') {
              return (
                <button
                  key={item.key}
                  type="button"
                  className="base-gallery-canvas-header-hit"
                  style={renderButtonStyle(item)}
                  onClick={() => toggleGroup(item.group.key)}
                  aria-label={`${collapsedGroups.has(item.group.key) ? '展开' : '折叠'}${item.group.label}`}
                />
              );
            }
            return (
              <div key={item.key}>
                <button
                  type="button"
                  className={`base-gallery-canvas-card-hit${selectedIds.has(item.record.id) ? ' is-selected' : ''}`}
                  style={renderButtonStyle(item)}
                  onClick={event => cardClick(event, item.record.id)}
                  onContextMenu={event => openRecordMenu(event, item.record.id)}
                  onDragOver={event => event.preventDefault()}
                  onDrop={event => onDropFiles(event, item.record.id)}
                  aria-label={`打开${valueText(item.record.fields[config.titleFieldId || table.primaryFieldId]) || '未命名记录'}`}
                />
                {config.showRecordActions && item.deleteRect && (
                  <button
                    type="button"
                    className="base-gallery-canvas-delete-hit"
                    style={renderButtonStyle(item.deleteRect)}
                    aria-label="删除记录"
                    onClick={event => {
                      event.stopPropagation();
                      removeRecords([item.record.id], true);
                    }}
                  />
                )}
              </div>
            );
          })}
          {layout.addRect && (
            <button
              type="button"
              className="base-gallery-canvas-add-hit"
              style={renderButtonStyle(layout.addRect)}
              onClick={() => addRecord()}
              aria-label={records.length === 0 ? '新建记录' : '添加记录'}
            />
          )}
        </div>
      </div>
      {recordMenu && createPortal(
        <BitableGalleryRecordContextMenu
          menuRef={menuRef}
          left={recordMenu.left}
          top={recordMenu.top}
          locked={locked}
          onInsertLeft={() => {
            onInsertRecordLeft(recordMenu.recordId);
            closeRecordMenu();
          }}
          onInsertRight={() => {
            onInsertRecordRight(recordMenu.recordId);
            closeRecordMenu();
          }}
          onShare={() => {
            onShareRecord(recordMenu.recordId);
            closeRecordMenu();
          }}
          onCopyLink={() => {
            onCopyRecordLink(recordMenu.recordId);
            closeRecordMenu();
          }}
          onDuplicate={() => {
            onDuplicateRecord(recordMenu.recordId);
            closeRecordMenu();
          }}
          onViewDetails={() => {
            onOpenRecord(recordMenu.recordId);
            closeRecordMenu();
          }}
          onAddComment={() => {
            onOpenComment(recordMenu.recordId);
            closeRecordMenu();
          }}
          onDelete={() => {
            removeRecords([recordMenu.recordId]);
            closeRecordMenu();
          }}
        />,
        document.body,
      )}
    </div>
  );
}
