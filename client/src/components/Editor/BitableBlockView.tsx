import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { SelGlyphChevronDown } from '../../icons/selectionToolbarGlyphs';
import { SlashGlyphBitableGrid, SlashGlyphGallery, SlashGlyphGantt } from '../../icons/slashMenuGlyphs';
import {
  addView,
  attachmentFromUpload,
  createGalleryConfig,
  createRecord,
  getActiveView,
  getAttachments,
  getGanttConfig,
  getGalleryConfig,
  groupRecords,
  parseBaseTable,
  selectCoverAttachment,
  serializeBaseTable,
  valueText,
  visibleRecords,
  type AttachmentValue,
  type BaseField,
  type BaseRecord,
  type BaseTable,
  type BaseView,
  type CellValue,
  type GalleryViewConfig,
  type GanttViewConfig,
} from './bitableModel';
import './BitableBlock.less';

const DAY_MS = 24 * 60 * 60 * 1000;

function readDate(value: CellValue): Date | null {
  const raw = valueText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function offsetDate(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
}

function daysBetween(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

function formatMonth(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function ViewIcon({ type, size = 16, fill = '#646a73' }: { type: BaseView['type']; size?: number; fill?: string }) {
  if (type === 'gallery') return <SlashGlyphGallery size={size} fill={fill} />;
  if (type === 'gantt') return <SlashGlyphGantt size={size} fill={fill} />;
  if (type === 'kanban') return <SlashGlyphBitableGrid size={size} fill={fill} />;
  return <SlashGlyphBitableGrid size={size} fill={fill} />;
}

type GlyphProps = { size?: number };

function svgProps(size: number) {
  return { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', xmlns: 'http://www.w3.org/2000/svg' } as const;
}

const ToolGlyphSettings = ({ size = 18 }: GlyphProps) => (
  <svg {...svgProps(size)}><path d="m4.328 19.734-.31-.34a10.91 10.91 0 0 1-2.386-4.146l-.135-.436L3.545 12 1.497 9.188l.135-.436a10.91 10.91 0 0 1 2.385-4.147l.311-.339 3.442.377 1.398-3.187.448-.101A10.843 10.843 0 0 1 12 1.09c.809 0 1.607.089 2.384.264l.448.1 1.398 3.188 3.442-.377.31.34a10.91 10.91 0 0 1 2.386 4.146l.135.436L20.455 12l2.048 2.812-.135.436a10.91 10.91 0 0 1-2.385 4.147l-.311.339-3.442-.377-1.398 3.187-.448.101a10.848 10.848 0 0 1-4.768 0l-.448-.1-1.398-3.188-3.442.377Zm3.485-2.21a1.488 1.488 0 0 1 1.525.881l1.12 2.554a9.05 9.05 0 0 0 3.084 0l1.12-2.554a1.488 1.488 0 0 1 1.524-.881l2.755.3c.665-.8 1.19-1.71 1.547-2.69l-1.644-2.258a1.488 1.488 0 0 1 0-1.752l1.644-2.258a9.091 9.091 0 0 0-1.547-2.69l-2.755.3a1.488 1.488 0 0 1-1.524-.881l-1.12-2.554a9.053 9.053 0 0 0-3.084 0l-1.12 2.554a1.488 1.488 0 0 1-1.525.881l-2.754-.3a9.09 9.09 0 0 0-1.548 2.69l1.645 2.258c.38.522.38 1.23 0 1.752l-1.644 2.258c.358.98.882 1.89 1.547 2.69l2.754-.3ZM12 16.545c-2.502 0-4.528-2.036-4.528-4.545 0-2.51 2.026-4.545 4.528-4.545S16.528 9.49 16.528 12 14.502 16.545 12 16.545Zm0-1.818c1.496 0 2.71-1.22 2.71-2.727A2.719 2.719 0 0 0 12 9.273 2.719 2.719 0 0 0 9.29 12 2.719 2.719 0 0 0 12 14.727Z" fill="currentColor"/></svg>
);
const ToolGlyphGantt = ({ size = 18 }: GlyphProps) => (
  <svg {...svgProps(size)}><path d="M4 4h16v7h2V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8v-2H4V4Z" fill="currentColor"/><path d="M15.5 21.425a.552.552 0 0 1-.507-.211 4.672 4.672 0 0 1-.675-1.296.553.553 0 0 1 .084-.5l.408-.56a.963.963 0 0 0 0-1.134l-.345-.474a.553.553 0 0 1-.077-.523c.193-.5.47-.963.82-1.369a.553.553 0 0 1 .482-.18l.539.058a.962.962 0 0 0 .986-.57l.22-.503a.552.552 0 0 1 .398-.328 4.59 4.59 0 0 1 1.588-.024c.186.03.339.158.414.33l.23.524a.963.963 0 0 0 .987.571l.64-.07c.18-.02.361.043.48.18.329.378.594.807.787 1.27a.553.553 0 0 1-.073.535l-.417.573a.962.962 0 0 0 0 1.133l.483.664a.55.55 0 0 1 .08.514 4.673 4.673 0 0 1-.643 1.191.552.552 0 0 1-.507.21l-.83-.09a.963.963 0 0 0-.988.57l-.35.8a.552.552 0 0 1-.43.334 4.6 4.6 0 0 1-1.312-.02.552.552 0 0 1-.414-.33l-.343-.784a.963.963 0 0 0-.987-.57l-.727.08Zm3.196-1.449c.85 0 1.54-.696 1.54-1.555 0-.86-.69-1.556-1.54-1.556-.851 0-1.54.696-1.54 1.556 0 .859.689 1.555 1.54 1.555ZM6.5 11a1 1 0 1 0 0 2H14a1 1 0 1 0 0-2H6.5ZM9 8a1 1 0 0 1 1-1h7a1 1 0 1 1 0 2h-7a1 1 0 0 1-1-1Zm-1 7a1 1 0 1 0 0 2h3a1 1 0 1 0 0-2H8Z" fill="currentColor"/></svg>
);
const ToolGlyphFilter = ({ size = 18 }: GlyphProps) => (
  <svg {...svgProps(size)}><path d="m13 11.5 4.573-3.201a1 1 0 0 0 .427-.82V4a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v3.48a1 1 0 0 0 .427.819L6 11.5v7.181a2 2 0 0 0 1.212 1.838l4.394 1.884a1 1 0 0 0 1.394-.92V11.5Zm-5-1.041-5-3.5V4h13v2.959l-5 3.5v9.508L8 18.68v-8.22Z" fill="currentColor"/><path d="M15 14a1 1 0 0 1 1-1h5a1 1 0 1 1 0 2h-5a1 1 0 0 1-1-1Zm1 3a1 1 0 1 0 0 2h3a1 1 0 1 0 0-2h-3Z" fill="currentColor"/></svg>
);
const ToolGlyphGroup = ({ size = 18 }: GlyphProps) => (
  <svg {...svgProps(size)}><path d="M10 9a1 1 0 0 1 1-1h6.5a1 1 0 1 1 0 2H11a1 1 0 0 1-1-1Zm1 5a1 1 0 1 0 0 2h6.5a1 1 0 1 0 0-2H11ZM8.25 9a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm-1.5 7.25a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z" fill="currentColor"/><path d="M3.5 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h17a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2h-17Zm17 2v16h-17V4h17Z" fill="currentColor"/></svg>
);
const ToolGlyphSort = ({ size = 18 }: GlyphProps) => (
  <svg {...svgProps(size)}><path d="M17 1.333h-1.803s-.419.137-.498.343l-3.664 9.598a.533.533 0 0 0 .498.724h.978a.533.533 0 0 0 .5-.347l.664-1.785h4.841l.663 1.786c.078.21.277.348.5.348h.987a.533.533 0 0 0 .498-.724l-3.666-9.6A.533.533 0 0 0 17 1.333Zm.725 6.4h-3.264l1.605-4.316h.05l1.61 4.316Zm-6.175 6.4c0-.294.238-.533.533-.533h8.522c.295 0 .534.239.534.534v.703c0 .154-.067.3-.183.402l-6.068 5.298h5.717c.295 0 .534.24.534.534v1.063a.533.533 0 0 1-.534.533h-8.522a.533.533 0 0 1-.534-.534v-.973c0-.154.067-.3.183-.402l5.763-5.027h-5.412a.533.533 0 0 1-.534-.534v-1.063Zm-8.923 2.534h2.705V3.2c0-.294.238-.533.533-.533h.933c.295 0 .534.239.534.533v19.16a.533.533 0 0 1-.965.314l-4-5.499a.32.32 0 0 1 .26-.508Z" fill="currentColor"/></svg>
);
const ToolGlyphComment = ({ size = 18 }: GlyphProps) => (
  <svg {...svgProps(size)}><path d="M7 11a1 1 0 0 1 1-1h8a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1Z" fill="currentColor"/><path d="M2 5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v11.5a2 2 0 0 1-2 2h-3.812a.5.5 0 0 0-.33.124l-2.541 2.224a2 2 0 0 1-2.634 0l-2.542-2.224a.5.5 0 0 0-.329-.124H4a2 2 0 0 1-2-2V5Zm2 0v11.5h3.812a2.5 2.5 0 0 1 1.646.619L12 19.343l2.542-2.224a2.5 2.5 0 0 1 1.646-.619H20V5H4Z" fill="currentColor"/></svg>
);
const ToolGlyphShare = ({ size = 18 }: GlyphProps) => (
  <svg {...svgProps(size)}><path d="M22 3a1 1 0 0 0-1-1h-7a1 1 0 0 0 0 2h4.586l-6.293 6.293a1 1 0 0 0 1.414 1.414L20 5.414V10a1 1 0 1 0 2 0V3Z" fill="currentColor"/><path d="M4 5h6v2H4v13h16v-5.5h2V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" fill="currentColor"/></svg>
);

const FieldTypeGlyphText = ({ size = 14 }: GlyphProps) => (
  <svg {...svgProps(size)}><path d="M5 18 9.5 6h1L15 18M6.6 14h6.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M16 9h4M18 9v9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
);
const FieldTypeGlyphSelect = ({ size = 14 }: GlyphProps) => (
  <svg {...svgProps(size)}><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6"/><path d="m8.5 12 2.4 2.4L15.5 9.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
);
const FieldTypeGlyphDate = ({ size = 14 }: GlyphProps) => (
  <svg {...svgProps(size)}><rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M4 9h16M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
);
const FieldTypeGlyphAttachment = ({ size = 14 }: GlyphProps) => (
  <svg {...svgProps(size)}><path d="M20 12.5 12.5 20a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7.5-7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
);
const FieldTypeGlyphNumber = ({ size = 14 }: GlyphProps) => (
  <svg {...svgProps(size)}><path d="M9 4 7 20M17 4l-2 16M5 9h15M4 15h15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
);
const FieldLockGlyph = ({ size = 12 }: GlyphProps) => (
  <svg {...svgProps(size)}><rect x="5" y="10.5" width="14" height="9.5" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" strokeWidth="1.6"/></svg>
);

function fieldTypeGlyph(type: BaseField['type'], size = 14) {
  if (type === 'single_select' || type === 'multi_select' || type === 'checkbox') return <FieldTypeGlyphSelect size={size} />;
  if (type === 'date' || type === 'created_time' || type === 'updated_time') return <FieldTypeGlyphDate size={size} />;
  if (type === 'attachment') return <FieldTypeGlyphAttachment size={size} />;
  if (type === 'number' || type === 'formula') return <FieldTypeGlyphNumber size={size} />;
  return <FieldTypeGlyphText size={size} />;
}

function blockAttrs(attrs: Record<string, unknown>) {
  const id = typeof attrs.blockId === 'string' ? attrs.blockId : '';
  return id ? { id, 'data-block-id': id } : {};
}

function updateRecord(table: BaseTable, recordId: string, update: (record: BaseRecord) => BaseRecord): BaseTable {
  return { ...table, records: table.records.map(record => record.id === recordId ? update(record) : record) };
}

function updateView(table: BaseTable, viewId: string, update: (view: BaseView) => BaseView): BaseTable {
  return { ...table, views: table.views.map(view => view.id === viewId ? update(view) : view) };
}

function withUpdatedValue(record: BaseRecord, fieldId: string, value: CellValue): BaseRecord {
  return { ...record, updatedAt: new Date().toISOString(), fields: { ...record.fields, [fieldId]: value } };
}

function isPreviewImage(attachment: AttachmentValue | undefined) {
  return Boolean(attachment?.mimeType.startsWith('image/') && (attachment.thumbnailUrl || attachment.previewUrl || attachment.url));
}

function FileBadge({ attachment }: { attachment: AttachmentValue }) {
  const kind = attachment.mimeType.startsWith('video/') ? 'VIDEO' : attachment.extension.toUpperCase() || 'FILE';
  return (
    <div className="base-gallery-file-fallback">
      <strong>{kind}</strong>
      <span>{attachment.name}</span>
    </div>
  );
}

function FieldDisplay({ field, value }: { field: BaseField; value: CellValue }) {
  const text = valueText(value);
  if (!text) return null;
  if (field.type === 'single_select') return <span className="base-cell-tag">{text}</span>;
  if (field.type === 'checkbox') return <span>{value ? '已完成' : '未完成'}</span>;
  if (field.type === 'attachment') return <span>{(value as AttachmentValue[]).length} 个附件</span>;
  return <span>{text}</span>;
}

const GRID_INDEX_WIDTH = 52;
const GRID_FIELD_WIDTH = 180;
const GRID_PRIMARY_WIDTH = 220;
const GRID_TAIL_WIDTH = 28;
const GRID_HEADER_HEIGHT = 36;
const GRID_ROW_HEIGHT = 34;
const GRID_ADD_ROW_HEIGHT = 36;

function BitableCanvasGrid({
  table,
  activeView,
  records,
  changeCell,
  pickFiles,
  addRecord,
  openRecord,
  selectBlock,
}: {
  table: BaseTable;
  activeView: BaseView;
  records: BaseRecord[];
  changeCell: (recordId: string, fieldId: string, value: CellValue) => void;
  pickFiles: (recordId: string, fieldId?: string) => void;
  addRecord: () => void;
  openRecord: (recordId: string) => void;
  selectBlock: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const fields = useMemo(
    () => table.fields.filter(field => !(activeView.hiddenFieldIds || []).includes(field.id)),
    [activeView.hiddenFieldIds, table.fields],
  );
  const baseColumns = useMemo(() => fields.map(field => ({
    field,
    width: field.id === table.primaryFieldId ? GRID_PRIMARY_WIDTH : GRID_FIELD_WIDTH,
  })), [fields, table.primaryFieldId]);
  const minContentWidth = GRID_INDEX_WIDTH + baseColumns.reduce((sum, column) => sum + column.width, 0) + GRID_TAIL_WIDTH;
  const contentWidth = Math.max(viewportWidth, minContentWidth);
  const extraWidth = Math.max(0, contentWidth - minContentWidth);
  const baseFieldWidth = baseColumns.reduce((sum, column) => sum + column.width, 0);
  const columns = useMemo(() => {
    if (extraWidth <= 0 || baseFieldWidth <= 0) return baseColumns;
    return baseColumns.map(column => ({
      ...column,
      width: column.width + Math.round((column.width / baseFieldWidth) * extraWidth),
    }));
  }, [baseColumns, baseFieldWidth, extraWidth]);
  const contentHeight = GRID_HEADER_HEIGHT + records.length * GRID_ROW_HEIGHT + GRID_ADD_ROW_HEIGHT;

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const measure = () => setViewportWidth(viewport.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(contentWidth * ratio));
    canvas.height = Math.max(1, Math.round(contentHeight * ratio));
    canvas.style.width = `${contentWidth}px`;
    canvas.style.height = `${contentHeight}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, contentWidth, contentHeight);
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 1;

    const drawLine = (fromX: number, fromY: number, toX: number, toY: number) => {
      ctx.beginPath();
      ctx.moveTo(fromX + 0.5, fromY + 0.5);
      ctx.lineTo(toX + 0.5, toY + 0.5);
      ctx.stroke();
    };
    const drawText = (raw: string, x: number, y: number, width: number, color = '#1f2329', font = '13px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif') => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, width, GRID_ROW_HEIGHT);
      ctx.clip();
      ctx.fillStyle = color;
      ctx.font = font;
      let label = raw || '';
      while (label && ctx.measureText(label).width > width - 18) label = label.slice(0, -1);
      if (label !== raw && label.length > 1) label = `${label.slice(0, -1)}...`;
      ctx.fillText(label, x + 10, y + GRID_ROW_HEIGHT / 2);
      ctx.restore();
    };

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, contentWidth, contentHeight);
    ctx.fillStyle = '#f7f8fa';
    ctx.fillRect(0, 0, contentWidth, GRID_HEADER_HEIGHT);
    ctx.fillStyle = '#fafbfc';
    ctx.fillRect(0, 0, GRID_INDEX_WIDTH, contentHeight);
    ctx.fillRect(contentWidth - GRID_TAIL_WIDTH, 0, GRID_TAIL_WIDTH, contentHeight);
    ctx.strokeStyle = '#eff0f1';

    drawLine(0, GRID_HEADER_HEIGHT, contentWidth, GRID_HEADER_HEIGHT);
    let x = GRID_INDEX_WIDTH;
    columns.forEach(({ field, width }) => {
      drawLine(x, 0, x, contentHeight);
      drawText(field.name, x, 1, width, '#646a73', '500 12px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif');
      x += width;
    });
    drawLine(x, 0, x, contentHeight);
    drawLine(contentWidth - GRID_TAIL_WIDTH, 0, contentWidth - GRID_TAIL_WIDTH, contentHeight);

    records.forEach((record, rowIndex) => {
      const y = GRID_HEADER_HEIGHT + rowIndex * GRID_ROW_HEIGHT;
      drawLine(0, y + GRID_ROW_HEIGHT, contentWidth, y + GRID_ROW_HEIGHT);
      drawText(String(rowIndex + 1), 0, y, GRID_INDEX_WIDTH, '#8f959e');
      let cellX = GRID_INDEX_WIDTH;
      columns.forEach(({ field, width }) => {
        const attachments = field.type === 'attachment' ? getAttachments(record, field.id) : [];
        const value = field.type === 'attachment'
          ? (attachments.length ? `${attachments.length} 个附件` : '+ 添加附件')
          : valueText(record.fields[field.id]);
        drawText(value, cellX, y, width);
        cellX += width;
      });
    });

    const addY = GRID_HEADER_HEIGHT + records.length * GRID_ROW_HEIGHT;
    drawLine(0, addY, contentWidth, addY);
    drawText('+ 添加记录', GRID_INDEX_WIDTH, addY, contentWidth - GRID_INDEX_WIDTH - GRID_TAIL_WIDTH, '#646a73');
  }, [columns, contentHeight, contentWidth, records]);

  return (
    <div className="base-grid-scroll base-grid-canvas-scroll" ref={viewportRef}>
      <div className="base-grid-table base-grid-canvas-view" role="grid" style={{ width: contentWidth, height: contentHeight }}>
        <canvas ref={canvasRef} className="base-grid-canvas" role="presentation" aria-hidden="true" />
        <div className="faster-dom-over-layer base-grid-over-layer">
          {records.map((record, rowIndex) => {
            const top = GRID_HEADER_HEIGHT + rowIndex * GRID_ROW_HEIGHT;
            let left = GRID_INDEX_WIDTH;
            return (
              <div className="base-grid-overlay-row" key={record.id}>
                <button
                  type="button"
                  className="base-grid-index base-grid-overlay-index"
                  style={{ left: 0, top, width: GRID_INDEX_WIDTH, height: GRID_ROW_HEIGHT }}
                  onClick={() => openRecord(record.id)}
                >
                  {rowIndex + 1}
                </button>
                {columns.map(({ field, width }) => {
                  const currentLeft = left;
                  left += width;
                  if (field.type === 'attachment') {
                    const attachments = getAttachments(record, field.id);
                    return (
                      <button
                        type="button"
                        className="base-grid-attachment base-grid-overlay-control"
                        key={field.id}
                        style={{ left: currentLeft, top, width, height: GRID_ROW_HEIGHT }}
                        onClick={() => pickFiles(record.id, field.id)}
                      >
                        {attachments.length ? `${attachments.length} 个附件` : '+ 添加附件'}
                      </button>
                    );
                  }
                  return (
                    <input
                      key={field.id}
                      className="base-grid-overlay-control"
                      style={{ left: currentLeft, top, width, height: GRID_ROW_HEIGHT }}
                      value={valueText(record.fields[field.id])}
                      onChange={event => changeCell(record.id, field.id, event.target.value)}
                    />
                  );
                })}
                <button
                  type="button"
                  className="feishu-bitable-block__tail base-grid-overlay-tail"
                  style={{ left: contentWidth - GRID_TAIL_WIDTH, top, width: GRID_TAIL_WIDTH, height: GRID_ROW_HEIGHT }}
                  aria-label="select table block"
                  onClick={selectBlock}
                />
              </div>
            );
          })}
          <button
            type="button"
            className="base-grid-add-row base-grid-overlay-add"
            style={{
              left: GRID_INDEX_WIDTH,
              top: GRID_HEADER_HEIGHT + records.length * GRID_ROW_HEIGHT,
              width: contentWidth - GRID_INDEX_WIDTH - GRID_TAIL_WIDTH,
              height: GRID_ADD_ROW_HEIGHT,
            }}
            onClick={addRecord}
          >
            + 添加记录
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BitableBlockView({ node, updateAttributes, selected, editor, getPos }: NodeViewProps) {
  const parsedTable = useMemo(() => parseBaseTable(node.attrs), [node.attrs.model, node.attrs.columns, node.attrs.rows, node.attrs.covers, node.attrs.view]);
  const tableRef = useRef(parsedTable);
  tableRef.current = parsedTable;
  const table = parsedTable;
  const activeView = getActiveView(table);
  const records = visibleRecords(table, activeView);
  const galleryConfig = getGalleryConfig(table, activeView);
  const ganttConfig = getGanttConfig(table, activeView);
  const groups = groupRecords(table, activeView, records);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showCreateViewMenu, setShowCreateViewMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [detailRecordId, setDetailRecordId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const [dropActive, setDropActive] = useState(false);
  const [ganttDraft, setGanttDraft] = useState<{ recordId: string; start: string; end: string } | null>(null);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const ganttDraftRef = useRef<{ recordId: string; start: string; end: string } | null>(null);
  const ganttDragRef = useRef<{
    recordId: string;
    mode: 'move' | 'start' | 'end';
    pointerId: number;
    originX: number;
    start: Date;
    end: Date;
  } | null>(null);
  const selectionAnchorRef = useRef<string | null>(null);
  const viewMenuRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const commit = (next: BaseTable) => {
    tableRef.current = next;
    const view = getActiveView(next);
    updateAttributes({
      model: serializeBaseTable(next),
      title: next.name,
      view: view.type === 'gallery' || view.type === 'gantt' ? view.type : 'grid',
    });
  };

  const mutate = (operation: (current: BaseTable) => BaseTable) => commit(operation(tableRef.current));

  useEffect(() => {
    if (!node.attrs.model) commit(parsedTable);
  }, []); // migrate legacy nodes once on mount

  useEffect(() => {
    if (!showViewMenu && !showSettings) return;
    const outside = (event: globalThis.MouseEvent) => {
      if (!(event.target instanceof Node)) return;
      if (viewMenuRef.current?.contains(event.target) || settingsRef.current?.contains(event.target)) return;
      if (event.target instanceof Element && event.target.closest('.base-viewbar__tools')) return;
      setShowViewMenu(false);
      setShowCreateViewMenu(false);
      setShowSettings(false);
    };
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [showViewMenu, showSettings]);

  useEffect(() => {
    if (detailRecordId && !table.records.some(record => record.id === detailRecordId)) setDetailRecordId(null);
  }, [detailRecordId, table.records]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setSelectedIds(new Set());
      selectionAnchorRef.current = null;
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const setView = (viewId: string) => {
    mutate(current => ({ ...current, activeViewId: viewId }));
    setShowViewMenu(false);
    setShowCreateViewMenu(false);
    setShowSettings(false);
  };

  const createView = (type: 'grid' | 'gallery' | 'gantt' | 'kanban') => {
    mutate(current => addView(current, type));
    setShowViewMenu(false);
    setShowCreateViewMenu(false);
    setShowSettings(type === 'gallery');
  };

  const setGalleryConfig = (patch: Partial<GalleryViewConfig>) => {
    if (activeView.type !== 'gallery' || activeView.locked) return;
    mutate(current => updateView(current, activeView.id, view => ({
      ...view,
      config: { ...getGalleryConfig(current, view), ...patch },
    })));
  };

  const setGanttConfig = (patch: Partial<GanttViewConfig>) => {
    if (activeView.type !== 'gantt' || activeView.locked) return;
    mutate(current => updateView(current, activeView.id, view => ({
      ...view,
      config: { ...getGanttConfig(current, view), ...patch },
    })));
  };

  const addRecord = (initialTitle = '未命名记录') => {
    const record = createRecord(table.id, table.fields, table.primaryFieldId, initialTitle);
    if (activeView.type === 'gallery' && galleryConfig.groupByFieldId) {
      record.fields[galleryConfig.groupByFieldId] = '';
    }
    if (activeView.type === 'gantt' && ganttConfig.startDateFieldId && ganttConfig.endDateFieldId) {
      const start = new Date();
      record.fields[ganttConfig.startDateFieldId] = dateValue(start);
      record.fields[ganttConfig.endDateFieldId] = dateValue(offsetDate(start, 3));
    }
    mutate(current => ({ ...current, records: [...current.records, record] }));
    setDetailRecordId(record.id);
    return record.id;
  };

  const changeCell = (recordId: string, fieldId: string, value: CellValue) => {
    mutate(current => updateRecord(current, recordId, record => withUpdatedValue(record, fieldId, value)));
  };

  const removeRecords = (recordIds: string[], requireConfirm = false) => {
    if (requireConfirm && !window.confirm(`确认删除 ${recordIds.length} 条记录？`)) return false;
    mutate(current => ({ ...current, records: current.records.filter(record => !recordIds.includes(record.id)) }));
    setSelectedIds(new Set());
    return true;
  };

  const addField = () => {
    if (activeView.locked) return;
    const id = `fld_text_${Date.now().toString(36)}`;
    const existing = tableRef.current.fields.filter(field => /^字段/.test(field.name)).length;
    const field: BaseField = { id, name: `字段 ${existing + 1}`, type: 'text' };
    mutate(current => ({
      ...current,
      fields: [...current.fields, field],
      records: current.records.map(record => ({ ...record, fields: { ...record.fields, [id]: '' } })),
    }));
  };

  const ensureAttachmentField = () => {
    const existing = tableRef.current.fields.find(field => field.type === 'attachment');
    if (existing) return existing.id;
    const field: BaseField = { id: `fld_attachment_${Date.now().toString(36)}`, name: '附件', type: 'attachment' };
    mutate(current => {
      const fields = [...current.fields, field];
      return {
        ...current,
        fields,
        records: current.records.map(record => ({ ...record, fields: { ...record.fields, [field.id]: [] } })),
        views: current.views.map(view => view.type === 'gallery'
          ? { ...view, config: { ...createGalleryConfig(fields, current.primaryFieldId), ...view.config, coverFieldId: field.id } }
          : view),
      };
    });
    return field.id;
  };

  const uploadAttachment = (recordId: string, file: File, requestedFieldId?: string) => {
    const fieldId = requestedFieldId || galleryConfig.coverFieldId || ensureAttachmentField();
    const localUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
    const pending = attachmentFromUpload(file, localUrl, 1);
    changeCell(recordId, fieldId, [...getAttachments(tableRef.current.records.find(record => record.id === recordId)!, fieldId), pending]);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/uploads');
    xhr.upload.onprogress = event => {
      if (!event.lengthComputable) return;
      const progress = Math.max(1, Math.min(98, Math.round(event.loaded / event.total * 100)));
      mutate(current => updateRecord(current, recordId, record => withUpdatedValue(record, fieldId,
        getAttachments(record, fieldId).map(item => item.id === pending.id ? { ...item, uploadProgress: progress } : item))));
    };
    xhr.onload = () => {
      try {
        const response = JSON.parse(xhr.responseText || '{}');
        if (xhr.status < 200 || xhr.status >= 300 || response.code !== 0) throw new Error(response.message || '上传失败');
        const uploaded = response.data as { name: string; size: number; type: string; url: string };
        mutate(current => updateRecord(current, recordId, record => withUpdatedValue(record, fieldId,
          getAttachments(record, fieldId).map((item): AttachmentValue => item.id === pending.id
            ? {
                ...item,
                name: uploaded.name,
                size: uploaded.size,
                mimeType: uploaded.type,
                url: uploaded.url,
                thumbnailUrl: uploaded.type.startsWith('image/') ? uploaded.url : undefined,
                uploadStatus: 'success',
                uploadProgress: 100,
              }
            : item))));
      } catch (error) {
        mutate(current => updateRecord(current, recordId, record => withUpdatedValue(record, fieldId,
          getAttachments(record, fieldId).map((item): AttachmentValue => item.id === pending.id
            ? { ...item, uploadStatus: 'failed', error: error instanceof Error ? error.message : '上传失败' }
            : item))));
      } finally {
        if (localUrl) URL.revokeObjectURL(localUrl);
      }
    };
    const form = new FormData();
    form.append('file', file);
    xhr.send(form);
  };

  const onDropFiles = (event: DragEvent, recordId?: string) => {
    const files = Array.from(event.dataTransfer.files);
    if (!files.length) return;
    event.preventDefault();
    event.stopPropagation();
    setDropActive(false);
    const targetRecordId = recordId || addRecord(files[0].name.replace(/\.[^.]+$/, ''));
    files.forEach(file => uploadAttachment(targetRecordId, file));
  };

  const pickFiles = (recordId: string, fieldId?: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*,video/*,application/pdf,*/*';
    input.onchange = () => Array.from(input.files || []).forEach(file => uploadAttachment(recordId, file, fieldId));
    input.click();
  };

  const cardClick = (event: MouseEvent, recordId: string) => {
    if (event.shiftKey && selectionAnchorRef.current) {
      const first = records.findIndex(record => record.id === selectionAnchorRef.current);
      const last = records.findIndex(record => record.id === recordId);
      if (first >= 0 && last >= 0) {
        const [start, end] = first < last ? [first, last] : [last, first];
        setSelectedIds(new Set(records.slice(start, end + 1).map(record => record.id)));
        return;
      }
    }
    if (event.ctrlKey || event.metaKey) {
      setSelectedIds(current => {
        const next = new Set(current);
        if (next.has(recordId)) next.delete(recordId); else next.add(recordId);
        return next;
      });
      selectionAnchorRef.current = recordId;
      return;
    }
    selectionAnchorRef.current = recordId;
    setDetailRecordId(recordId);
  };

  const selectBlock = () => {
    const pos = typeof getPos === 'function' ? getPos() : null;
    if (typeof pos !== 'number') return;
    editor.chain().focus().setNodeSelection(pos).run();
    window.getSelection()?.removeAllRanges();
  };

  useEffect(() => {
    if (!selected) return;
    window.getSelection()?.removeAllRanges();
  }, [selected]);

  const renderCover = (record: BaseRecord) => {
    const attachments = getAttachments(record, galleryConfig.coverFieldId);
    const cover = selectCoverAttachment(attachments);
    if (isPreviewImage(cover)) {
      return <img loading="lazy" src={cover!.thumbnailUrl || cover!.previewUrl || cover!.url} alt="" style={{ objectFit: galleryConfig.coverFit, objectPosition: galleryConfig.coverPosition || 'center' }} />;
    }
    if (cover) return <FileBadge attachment={cover} />;
    return (
      <div className="base-gallery-empty-cover">
        <span>▧</span>
        {!galleryConfig.coverFieldId ? <small>选择附件字段作为封面</small> : null}
      </div>
    );
  };

  const renderGallery = () => (
    <div
      className={`base-gallery-surface${dropActive ? ' is-drop-active' : ''}`}
      onDragOver={event => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        setDropActive(true);
      }}
      onDragLeave={() => setDropActive(false)}
      onDrop={event => onDropFiles(event)}
    >
      {groups.map(group => (
        <section className="base-gallery-group" key={group.key || 'all'}>
          {group.label && (
            <button
              type="button"
              className="base-gallery-group__header"
              onClick={() => setCollapsedGroups(current => {
                const next = new Set(current);
                if (next.has(group.key)) next.delete(group.key); else next.add(group.key);
                return next;
              })}
            >
              <span>{collapsedGroups.has(group.key) ? '▸' : '▾'}</span>
              {group.label}
              <em>{group.records.length}</em>
            </button>
          )}
          {!collapsedGroups.has(group.key) && (
            <div className={`base-gallery-grid size-${galleryConfig.cardSize}`}>
              {group.records.map(record => {
                const rawTitle = valueText(record.fields[galleryConfig.titleFieldId || table.primaryFieldId]);
                const title = rawTitle || '未命名记录';
                const attachments = getAttachments(record, galleryConfig.coverFieldId);
                return (
                  <article
                    key={record.id}
                    className={`base-gallery-card${selectedIds.has(record.id) ? ' is-selected' : ''}`}
                    onClick={event => cardClick(event, record.id)}
                    onDragOver={event => event.preventDefault()}
                    onDrop={event => onDropFiles(event, record.id)}
                  >
                    {galleryConfig.emptyCoverMode !== 'hide-cover' && (
                      <div className={`base-gallery-card__cover ratio-${galleryConfig.cardAspectRatio.replace(':', '-')}`}>
                        {renderCover(record)}
                        {attachments.length > 1 && galleryConfig.showAttachmentCount && <span className="base-gallery-count">{attachments.length}</span>}
                        {selectCoverAttachment(attachments)?.mimeType.startsWith('video/') && <span className="base-gallery-video">▶</span>}
                      </div>
                    )}
                    <div className="base-gallery-card__body">
                      <strong className={`base-gallery-card__title${rawTitle ? '' : ' is-placeholder'}`}>{title}</strong>
                      {galleryConfig.visibleFieldIds.map(fieldId => {
                        const field = table.fields.find(item => item.id === fieldId);
                        if (!field) return null;
                        const value = record.fields[field.id];
                        if (!galleryConfig.showEmptyFields && !valueText(value)) return null;
                        return (
                          <div className="base-gallery-card__field" key={field.id}>
                            {galleryConfig.showFieldNames && <label>{field.name}</label>}
                            <FieldDisplay field={field} value={value} />
                          </div>
                        );
                      })}
                    </div>
                    {galleryConfig.showRecordActions && (
                      <button
                        type="button"
                        className="base-gallery-card__delete"
                        aria-label="删除记录"
                        onClick={event => {
                          event.stopPropagation();
                          removeRecords([record.id], true);
                        }}
                      >
                        ×
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ))}
      {records.length === 0 && (
        <div className="base-gallery-empty">
          <span>暂无记录</span>
          <button type="button" onClick={() => addRecord()}>新建记录</button>
        </div>
      )}
      {records.length > 0 && (
        <button type="button" className="base-gallery-add-record" onClick={() => addRecord()}>+ 添加记录</button>
      )}
    </div>
  );

  const renderCanvasGrid = () => (
    <BitableCanvasGrid
      table={table}
      activeView={activeView}
      records={records}
      changeCell={changeCell}
      pickFiles={pickFiles}
      addRecord={() => { addRecord(); }}
      openRecord={setDetailRecordId}
      selectBlock={selectBlock}
    />
  );

  const renderGrid = () => {
    const visibleFields = table.fields.filter(field => !(activeView.hiddenFieldIds || []).includes(field.id));
    const blankRows = Array.from({ length: Math.max(0, 7 - records.length) }, (_, index) => records.length + index + 1);

    return (
      <div className="base-grid-shell">
        <div className="base-grid-scroll">
          <table className="base-grid-table">
            <thead>
              <tr>
                <th className="base-grid-index"><span className="base-grid-checkbox" aria-hidden /></th>
                {visibleFields.map(field => (
                  <th key={field.id} data-field-type={field.type}>
                    <span className="base-grid-field-head">
                      {field.id === table.primaryFieldId && <span className="base-grid-field-lock" aria-hidden><FieldLockGlyph size={11} /></span>}
                      <span className="base-grid-field-icon" aria-hidden>{fieldTypeGlyph(field.type, 13)}</span>
                      <span className="base-grid-field-name">{field.name}</span>
                      <span className="base-grid-field-chevron" aria-hidden><SelGlyphChevronDown size={11} fill="currentColor" /></span>
                    </span>
                  </th>
                ))}
                <th className="base-grid-add-field" onClick={() => addField()} title="添加字段"><span aria-hidden>+</span></th>
              </tr>
            </thead>
            <tbody>
              {records.map((record, index) => (
                <tr key={record.id}>
                  <td className="base-grid-index"><button type="button" onClick={() => setDetailRecordId(record.id)}>{index + 1}</button></td>
                  {visibleFields.map(field => (
                    <td key={field.id} data-field-type={field.type}>
                      {field.type === 'attachment' ? (
                        <button type="button" className="base-grid-attachment" onClick={() => pickFiles(record.id, field.id)}>
                          {getAttachments(record, field.id).length ? `${getAttachments(record, field.id).length} 个附件` : '+ 添加附件'}
                        </button>
                      ) : field.type === 'single_select' ? (
                        <button type="button" className="base-grid-select-value" onClick={() => setDetailRecordId(record.id)}>
                          <FieldDisplay field={field} value={record.fields[field.id]} />
                        </button>
                      ) : (
                        <input
                          value={valueText(record.fields[field.id])}
                          onChange={event => changeCell(record.id, field.id, event.target.value)}
                        />
                      )}
                    </td>
                  ))}
                  <td className="feishu-bitable-block__tail" onClick={selectBlock} />
                </tr>
              ))}
              {blankRows.map(rowNumber => (
                <tr className="base-grid-blank-row base-grid-add-row" key={`blank-${rowNumber}`}>
                  <td className="base-grid-index">{rowNumber}</td>
                  {visibleFields.map(field => <td key={field.id} data-field-type={field.type} />)}
                  <td className="feishu-bitable-block__tail" onClick={selectBlock} />
                </tr>
              ))}
              <tr className="base-grid-add-row base-grid-add-control-row">
                <td colSpan={visibleFields.length + 2}>
                  <button type="button" onClick={() => addRecord()}>+</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="base-grid-footer">{Math.max(7, records.length)} 条记录⌄</div>
      </div>
    );
  };

  const ganttScrollRef = useRef<HTMLDivElement>(null);

  const ganttDates = records.flatMap(record => {
    const start = readDate(record.fields[ganttConfig.startDateFieldId || '']);
    const end = readDate(record.fields[ganttConfig.endDateFieldId || '']);
    return start && end && daysBetween(start, end) >= 0 ? [start, end] : [];
  });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ganttExtent = [...ganttDates, today];
  const ganttOrigin = offsetDate(new Date(Math.min(...ganttExtent.map(date => date.getTime()))), -10);
  const ganttLimit = offsetDate(new Date(Math.max(...ganttExtent.map(date => date.getTime()))), 60);
  const ganttDays = Array.from({ length: Math.max(120, daysBetween(ganttOrigin, ganttLimit) + 30) }, (_, index) => offsetDate(ganttOrigin, index));
  const ganttMonthSpans = ganttDays.reduce<Array<{ key: string; label: string; days: number }>>((items, day) => {
    const key = `${day.getFullYear()}-${day.getMonth()}`;
    const last = items[items.length - 1];
    if (last?.key === key) last.days += 1;
    else items.push({ key, label: formatMonth(day), days: 1 });
    return items;
  }, []);

  const scrollToToday = () => {
    const container = ganttScrollRef.current;
    if (!container) return;
    const todayCellIndex = daysBetween(ganttOrigin, today);
    const todayLeft = todayCellIndex * ganttConfig.dayWidth;
    container.scrollLeft = todayLeft - container.clientWidth / 2 + (ganttConfig.dayWidth / 2);
  };

  const scrollTimeline = (direction: 'left' | 'right') => {
    const container = ganttScrollRef.current;
    if (!container) return;
    const scrollAmount = container.clientWidth * 0.6;
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  useEffect(() => {
    if (activeView.type === 'gantt') {
      const timer = setTimeout(scrollToToday, 120);
      return () => clearTimeout(timer);
    }
  }, [activeView.type, ganttConfig.dayWidth]);

  const toggleRecordSelection = (recordId: string) => {
    setSelectedIds(current => {
      const next = new Set(current);
      if (next.has(recordId)) next.delete(recordId); else next.add(recordId);
      return next;
    });
  };

  const toggleAllRecordSelection = () => {
    if (selectedIds.size === records.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(records.map(r => r.id)));
    }
  };

  const draftGanttAt = (drag: NonNullable<typeof ganttDragRef.current>, clientX: number) => {
    const delta = Math.round((clientX - drag.originX) / ganttConfig.dayWidth);
    let start = drag.start;
    let end = drag.end;
    if (drag.mode === 'move') {
      start = offsetDate(start, delta);
      end = offsetDate(end, delta);
    } else if (drag.mode === 'start') {
      start = offsetDate(start, Math.min(delta, daysBetween(start, end)));
    } else {
      end = offsetDate(end, Math.max(delta, -daysBetween(start, end)));
    }
    return { recordId: drag.recordId, start: dateValue(start), end: dateValue(end) };
  };

  const commitGanttDraft = (draft: { recordId: string; start: string; end: string } | null) => {
    if (!draft || !ganttConfig.startDateFieldId || !ganttConfig.endDateFieldId) return;
    mutate(current => updateRecord(current, draft.recordId, record => {
      const next = withUpdatedValue(record, ganttConfig.startDateFieldId!, draft.start);
      return withUpdatedValue(next, ganttConfig.endDateFieldId!, draft.end);
    }));
  };

  const finishGanttDragAt = (clientX: number) => {
    const drag = ganttDragRef.current;
    if (!drag) return;
    const draft = draftGanttAt(drag, clientX);
    ganttDragRef.current = null;
    ganttDraftRef.current = null;
    setGanttDraft(null);
    commitGanttDraft(draft);
  };

  const startGanttDrag = (event: ReactPointerEvent<HTMLElement>, record: BaseRecord, mode: 'move' | 'start' | 'end') => {
    if (activeView.locked || !ganttConfig.startDateFieldId || !ganttConfig.endDateFieldId) return;
    const start = readDate(record.fields[ganttConfig.startDateFieldId]);
    const end = readDate(record.fields[ganttConfig.endDateFieldId]);
    if (!start || !end) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    ganttDragRef.current = { recordId: record.id, mode, pointerId: event.pointerId, originX: event.clientX, start, end };
    const draft = { recordId: record.id, start: dateValue(start), end: dateValue(end) };
    ganttDraftRef.current = draft;
    setGanttDraft(draft);
    const pointerId = event.pointerId;
    const handleMove = (moveEvent: PointerEvent) => {
      const drag = ganttDragRef.current;
      if (!drag || drag.pointerId !== pointerId) return;
      const nextDraft = draftGanttAt(drag, moveEvent.clientX);
      ganttDraftRef.current = nextDraft;
      setGanttDraft(nextDraft);
    };
    const handleUp = (upEvent: PointerEvent) => {
      const drag = ganttDragRef.current;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
      if (!drag || drag.pointerId !== pointerId) return;
      finishGanttDragAt(upEvent.clientX);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  };

  const startGanttMouseDrag = (event: MouseEvent<HTMLElement>, record: BaseRecord, mode: 'move' | 'start' | 'end') => {
    if (activeView.locked || !ganttConfig.startDateFieldId || !ganttConfig.endDateFieldId) return;
    const start = readDate(record.fields[ganttConfig.startDateFieldId]);
    const end = readDate(record.fields[ganttConfig.endDateFieldId]);
    if (!start || !end) return;
    event.preventDefault();
    event.stopPropagation();
    ganttDragRef.current = { recordId: record.id, mode, pointerId: -1, originX: event.clientX, start, end };
    const handleMove = (moveEvent: globalThis.MouseEvent) => {
      const drag = ganttDragRef.current;
      if (!drag) return;
      const nextDraft = draftGanttAt(drag, moveEvent.clientX);
      ganttDraftRef.current = nextDraft;
      setGanttDraft(nextDraft);
    };
    const handleUp = (upEvent: globalThis.MouseEvent) => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      finishGanttDragAt(upEvent.clientX);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  const moveGanttDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = ganttDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const draft = draftGanttAt(drag, event.clientX);
    ganttDraftRef.current = draft;
    setGanttDraft(draft);
  };

  const endGanttDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = ganttDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    if (event.clientX === drag.originX) return;
    finishGanttDragAt(event.clientX);
  };

  const scheduleRecordAt = (recordId: string, start: Date) => {
    if (!ganttConfig.startDateFieldId || !ganttConfig.endDateFieldId || activeView.locked) return;
    mutate(current => updateRecord(current, recordId, record => {
      const next = withUpdatedValue(record, ganttConfig.startDateFieldId!, dateValue(start));
      return withUpdatedValue(next, ganttConfig.endDateFieldId!, dateValue(offsetDate(start, 3)));
    }));
  };

  const renderGantt = () => {
    const isAllSelected = records.length > 0 && selectedIds.size === records.length;
    return (
      <div className="base-gantt">
        <div className="base-gantt__toolbar">
          <div className="base-gantt__toolbar-left">
            <span className="base-gantt__month-label">{ganttMonthSpans[0]?.label || formatMonth(today)}</span>
          </div>
          <div className="base-gantt__toolbar-right">
            <div className="base-gantt__scale">
              <button type="button" className={ganttConfig.dayWidth >= 55 ? 'is-active' : ''} onClick={() => setGanttConfig({ dayWidth: 60 })}>周</button>
              <button type="button" className={ganttConfig.dayWidth >= 35 && ganttConfig.dayWidth < 55 ? 'is-active' : ''} onClick={() => setGanttConfig({ dayWidth: 40 })}>月</button>
              <button type="button" className={ganttConfig.dayWidth >= 20 && ganttConfig.dayWidth < 35 ? 'is-active' : ''} onClick={() => setGanttConfig({ dayWidth: 24 })}>季</button>
              <button type="button" className={ganttConfig.dayWidth < 20 ? 'is-active' : ''} onClick={() => setGanttConfig({ dayWidth: 12 })}>年</button>
            </div>
            <div className="base-gantt__nav">
              <button type="button" className="base-gantt__nav-btn" onClick={scrollToToday}>今天</button>
              <button type="button" className="base-gantt__nav-arrow" onClick={() => scrollTimeline('left')} title="向左滚动">‹</button>
              <button type="button" className="base-gantt__nav-arrow" onClick={() => scrollTimeline('right')} title="向右滚动">›</button>
            </div>
          </div>
        </div>

        <div className="base-gantt__scroll" ref={ganttScrollRef}>
          <div className="base-gantt__container" style={{ minWidth: 'max-content', position: 'relative' }}>
            
            {/* Timeline Header Row */}
            <div className="base-gantt__header">
              
              {/* Left sticky pane for metadata */}
              <div className={`base-gantt__left-pane ${leftPanelCollapsed ? 'is-collapsed' : ''}`}>
                <div className="base-gantt__col base-gantt__col--checkbox">
                  <input type="checkbox" checked={isAllSelected} onChange={toggleAllRecordSelection} />
                </div>
                <div className="base-gantt__col base-gantt__col--index">#</div>
                <div className="base-gantt__col base-gantt__col--name base-gantt__record-column">
                  <span>任务名</span>
                  <button type="button" className="base-gantt__collapse-btn" onClick={() => setLeftPanelCollapsed(true)} title="折叠左侧面板">«</button>
                </div>
              </div>

              {/* Right pane scrollable timeline header */}
              <div className="base-gantt__timeline-head" style={{ width: ganttDays.length * ganttConfig.dayWidth }}>
                <div className="base-gantt__months">
                  {ganttMonthSpans.map(month => <span key={month.key} style={{ width: month.days * ganttConfig.dayWidth }}>{month.label}</span>)}
                </div>
                <div className="base-gantt__days">
                  {ganttDays.map(day => {
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    return (
                      <span key={dateValue(day)} className={`${dateValue(day) === dateValue(today) ? 'is-today' : ''} ${isWeekend ? 'is-weekend' : ''}`} style={{ width: ganttConfig.dayWidth }}>
                        {day.getDate()}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* If Left Panel is Collapsed, render an expand tab */}
            {leftPanelCollapsed && (
              <button type="button" className="base-gantt__expand-btn" onClick={() => setLeftPanelCollapsed(false)} title="展开左侧面板">
                »
              </button>
            )}

            {/* Timeline Today Vertical Line */}
            <div 
              className="base-gantt__today-line" 
              style={{ 
                left: (leftPanelCollapsed ? 0 : 260) + daysBetween(ganttOrigin, today) * ganttConfig.dayWidth + ganttConfig.dayWidth / 2,
              }} 
            />

            {/* Timeline Lanes / Rows */}
            <div className="base-gantt__rows">
              {records.map((record, index) => {
                const title = valueText(record.fields[ganttConfig.titleFieldId || table.primaryFieldId]) || '未命名记录';
                const draft = ganttDraft?.recordId === record.id ? ganttDraft : null;
                const start = readDate(draft?.start ?? record.fields[ganttConfig.startDateFieldId || '']);
                const end = readDate(draft?.end ?? record.fields[ganttConfig.endDateFieldId || '']);
                const scheduled = Boolean(start && end && daysBetween(start, end) >= 0);
                const durationDays = scheduled ? daysBetween(start!, end!) + 1 : 0;
                
                return (
                  <div className="base-gantt__row" key={record.id}>
                    {/* Left sticky columns */}
                    <div className={`base-gantt__left-pane ${leftPanelCollapsed ? 'is-collapsed' : ''}`}>
                      <div className="base-gantt__col base-gantt__col--checkbox">
                        <input type="checkbox" checked={selectedIds.has(record.id)} onChange={() => toggleRecordSelection(record.id)} />
                      </div>
                      <div className="base-gantt__col base-gantt__col--index" onClick={() => setDetailRecordId(record.id)}>{index + 1}</div>
                      <div className="base-gantt__col base-gantt__col--name base-gantt__record" onClick={() => setDetailRecordId(record.id)}>
                        <div className="base-gantt__title-text">{title}</div>
                      </div>
                    </div>

                    {/* Right timeline cell lane */}
                    <div
                      className={`base-gantt__timeline base-gantt__lane${scheduled ? '' : ' is-unscheduled'}`}
                      style={{ width: ganttDays.length * ganttConfig.dayWidth }}
                      onClick={event => {
                        if (scheduled || (event.target instanceof Element && event.target.closest('.base-gantt__schedule'))) return;
                        const clientLeft = event.currentTarget.getBoundingClientRect().left;
                        const cell = Math.max(0, Math.min(ganttDays.length - 1, Math.floor((event.clientX - clientLeft) / ganttConfig.dayWidth)));
                        scheduleRecordAt(record.id, ganttDays[cell]);
                      }}
                      title={scheduled ? undefined : '点击日期设置排期'}
                    >
                      {ganttDays.map(day => {
                        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                        return (
                          <span 
                            key={dateValue(day)} 
                            className={`${dateValue(day) === dateValue(today) ? 'is-today' : ''} ${isWeekend ? 'is-weekend' : ''}`} 
                            style={{ width: ganttConfig.dayWidth }} 
                          />
                        );
                      })}
                      {scheduled ? (
                        <div
                          className="base-gantt__bar"
                          data-record-id={record.id}
                          style={{
                            left: daysBetween(ganttOrigin, start!) * ganttConfig.dayWidth + 3,
                            width: (daysBetween(start!, end!) + 1) * ganttConfig.dayWidth - 6,
                          }}
                          onPointerDown={event => startGanttDrag(event, record, 'move')}
                          onPointerMove={moveGanttDrag}
                          onPointerUp={endGanttDrag}
                          onPointerCancel={endGanttDrag}
                          onMouseDown={event => startGanttMouseDrag(event, record, 'move')}
                          onMouseUp={event => finishGanttDragAt(event.clientX)}
                        >
                          <i className="base-gantt__resize base-gantt__resize--start" onPointerDown={event => startGanttDrag(event, record, 'start')} />
                          <div className="base-gantt__bar-content">
                            <span className="base-gantt__bar-title">{title}</span>
                            <span className="base-gantt__bar-duration">{durationDays}天</span>
                          </div>
                          <i className="base-gantt__resize base-gantt__resize--end" onPointerDown={event => startGanttDrag(event, record, 'end')} />
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="base-gantt__schedule"
                          style={{ left: daysBetween(ganttOrigin, today) * ganttConfig.dayWidth + 5 }}
                          onClick={() => scheduleRecordAt(record.id, today)}
                        >+ 设置排期</button>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {/* Bottom empty row/add row for Left Pane */}
              <div className="base-gantt__add-row base-gantt__row--add">
                <div className={`base-gantt__left-pane ${leftPanelCollapsed ? 'is-collapsed' : ''}`}>
                  <button type="button" className="base-gantt__quick-add-btn" onClick={() => addRecord()} title="快速添加记录">
                    +
                  </button>
                </div>
                <div className="base-gantt__timeline" style={{ width: ganttDays.length * ganttConfig.dayWidth }} />
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  };

  const renderKanban = () => {
    // Find first single-select field to group by
    const selectFields = table.fields.filter(field => field.type === 'single_select');
    const kanbanField = selectFields[0] || table.fields[0];
    
    if (!kanbanField) return <div className="base-kanban-empty">请先创建单选字段以使用看板视图</div>;

    // Columns: choices from the select field, plus "Uncategorized" (未分类)
    const choices = kanbanField.options?.choices || [];
    const columns = [
      ...choices.map(choice => ({
        id: choice.id,
        name: choice.name,
        color: choice.color,
        value: choice.name
      })),
      { id: 'uncategorized', name: '未分类', color: '#8f959e', value: '' }
    ];

    const moveCard = (recordId: string, direction: 'left' | 'right') => {
      const record = table.records.find(r => r.id === recordId);
      if (!record) return;
      const currentValue = valueText(record.fields[kanbanField.id]);
      const currentIdx = columns.findIndex(col => col.value === currentValue);
      if (currentIdx === -1) return;
      let nextIdx = currentIdx + (direction === 'left' ? -1 : 1);
      if (nextIdx < 0) nextIdx = columns.length - 1;
      if (nextIdx >= columns.length) nextIdx = 0;
      const targetColumn = columns[nextIdx];
      changeCell(recordId, kanbanField.id, targetColumn.value);
    };

    const addRecordToColumn = (statusValue: string) => {
      const recordId = addRecord();
      if (statusValue) {
        changeCell(recordId, kanbanField.id, statusValue);
      }
    };

    return (
      <div className="base-kanban">
        <div className="base-kanban__board">
          {columns.map(column => {
            const columnRecords = records.filter(record => {
              const val = valueText(record.fields[kanbanField.id]);
              return column.id === 'uncategorized' ? !val : val === column.value;
            });

            return (
              <div className="base-kanban__column" key={column.id}>
                <header className="base-kanban__column-header" style={{ borderTop: `3px solid ${column.color}` }}>
                  <span className="base-kanban__column-title-tag" style={{ backgroundColor: `${column.color}15`, color: column.color }}>
                    {column.name}
                  </span>
                  <span className="base-kanban__column-count">{columnRecords.length}</span>
                </header>

                <div className="base-kanban__column-cards">
                  {columnRecords.map(record => {
                    const title = valueText(record.fields[galleryConfig.titleFieldId || table.primaryFieldId]) || '未命名记录';
                    return (
                      <div className="base-kanban__card" key={record.id} onClick={() => setDetailRecordId(record.id)}>
                        <div className="base-kanban__card-header">
                          <strong className="base-kanban__card-title">{title}</strong>
                        </div>
                        <div className="base-kanban__card-fields">
                          {galleryConfig.visibleFieldIds.map(fieldId => {
                            const field = table.fields.find(item => item.id === fieldId);
                            if (!field || field.id === kanbanField.id) return null;
                            const value = record.fields[field.id];
                            if (!valueText(value)) return null;
                            return (
                              <div className="base-kanban__card-field" key={field.id}>
                                <label>{field.name}:</label>
                                <FieldDisplay field={field} value={value} />
                              </div>
                            );
                          })}
                        </div>
                        <div className="base-kanban__card-actions" onClick={e => e.stopPropagation()}>
                          <button type="button" className="base-kanban__card-action-btn" onClick={() => moveCard(record.id, 'left')} title="左移">‹</button>
                          <button type="button" className="base-kanban__card-action-btn base-kanban__card-action-btn--delete" onClick={() => removeRecords([record.id], true)} title="删除">×</button>
                          <button type="button" className="base-kanban__card-action-btn" onClick={() => moveCard(record.id, 'right')} title="右移">›</button>
                        </div>
                      </div>
                    );
                  })}
                  {columnRecords.length === 0 && (
                    <div className="base-kanban__column-empty">暂无记录</div>
                  )}
                </div>

                <button type="button" className="base-kanban__add-card-btn" onClick={() => addRecordToColumn(column.value)}>
                  + 添加记录
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const selectedRecord = table.records.find(record => record.id === detailRecordId);

  return (
    <NodeViewWrapper
      className={`feishu-bitable-block feishu-base-block${selected ? ' is-selected' : ''}${showSettings || showViewMenu ? ' is-panel-open' : ''}`}
      {...blockAttrs(node.attrs)}
      data-base-view-type={activeView.type}
      contentEditable={false}
    >
      <header className="base-viewbar bitable-toolbar-doc" data-no-marquee-selection="true">
        <span className="base-viewbar__source" aria-hidden>✦</span>
        <span className="base-viewbar__app">{table.name}</span>
        <span className="base-viewbar__divider" />
        <div className="base-view-switcher" ref={viewMenuRef}>
          <button
            type="button"
            className={`base-viewbar__current${showViewMenu ? ' is-open' : ''}`}
            onClick={() => {
              setShowViewMenu(open => !open);
              setShowCreateViewMenu(false);
            }}
          >
            <span className="base-viewbar__view-icon" aria-hidden data-view-icon={activeView.type}>
              <ViewIcon type={activeView.type} />
            </span>
            <span className="base-viewbar__title">
              {activeView.name}
              {activeView.locked ? ' 🔒' : ''}
            </span>
            <span className="base-viewbar__chevron" aria-hidden>
              <SelGlyphChevronDown size={12} fill="currentColor" />
            </span>
          </button>
          {showViewMenu && (
            <div className="base-view-menu">
              {table.views.map(view => (
                <button
                  type="button"
                  className={view.id === activeView.id ? 'is-active' : ''}
                  key={view.id}
                  onClick={() => setView(view.id)}
                >
                  <span aria-hidden data-view-icon={view.type}><ViewIcon type={view.type} /></span>{view.name}
                </button>
              ))}
              <div className="base-view-menu__create">
                <button type="button" className="base-view-menu__new" onClick={() => setShowCreateViewMenu(open => !open)}>
                  <span aria-hidden>+</span>新建<span aria-hidden>▸</span>
                </button>
                {showCreateViewMenu && (
                  <div className="base-view-create-menu">
                    <button type="button" onClick={() => createView('grid')}><span aria-hidden>▦</span>表格视图</button>
                    <button type="button" onClick={() => createView('gallery')}><span aria-hidden>▧</span>画册视图</button>
                    <button type="button" onClick={() => createView('gantt')}><span aria-hidden>☷</span>甘特图</button>
                    <button type="button" onClick={() => createView('kanban')}><span aria-hidden>📋</span>看板视图</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {selectedIds.size > 0 && <button type="button" className="base-selection-delete base-danger" onClick={() => removeRecords(Array.from(selectedIds), true)}>删除已选 {selectedIds.size} 项</button>}
        <div className="base-viewbar__tools">
          <button type="button" className={`base-viewbar__tool${showSettings ? ' is-active' : ''}`} aria-label="设置" title="视图设置" onClick={() => setShowSettings(open => !open)}><ToolGlyphSettings /></button>
          {activeView.type === 'gantt' && <button type="button" className="base-viewbar__tool" aria-label="甘特图设置" title="甘特图设置" onClick={() => setShowSettings(true)}><ToolGlyphGantt /></button>}
          <button type="button" className="base-viewbar__tool" aria-label="筛选" title="筛选" onClick={() => setShowSettings(true)}><ToolGlyphFilter /></button>
          <button type="button" className="base-viewbar__tool" aria-label="分组" title="分组" onClick={() => setShowSettings(true)}><ToolGlyphGroup /></button>
          <button type="button" className="base-viewbar__tool base-viewbar__tool--active" aria-label="排序" title="排序" onClick={() => setShowSettings(true)}><ToolGlyphSort /></button>
          <span className="base-viewbar__tool-sep" aria-hidden />
          <button type="button" className="base-viewbar__tool" aria-label="评论" title="评论"><ToolGlyphComment /></button>
          <span className="base-viewbar__tool-sep" aria-hidden />
          <button type="button" className="base-viewbar__tool" aria-label="分享" title="在新窗口打开"><ToolGlyphShare /></button>
        </div>
      </header>
      <div className="base-view-content" data-no-marquee-selection="true">
        {activeView.type === 'gallery' ? renderGallery() : activeView.type === 'gantt' ? renderGantt() : activeView.type === 'kanban' ? renderKanban() : renderGrid()}
      </div>
      {showSettings && activeView.type === 'gallery' && (
        <GallerySettings
          table={table}
          view={activeView}
          config={galleryConfig}
          panelRef={settingsRef}
          onClose={() => setShowSettings(false)}
          onConfig={setGalleryConfig}
          onTable={mutate}
        />
      )}
      {showSettings && activeView.type === 'gantt' && (
        <GanttSettings
          table={table}
          view={activeView}
          config={ganttConfig}
          panelRef={settingsRef}
          onClose={() => setShowSettings(false)}
          onConfig={setGanttConfig}
          onTable={mutate}
        />
      )}
      {showSettings && (activeView.type === 'grid' || activeView.type === 'kanban') && (
        <GridSettings
          table={table}
          view={activeView}
          panelRef={settingsRef}
          onClose={() => setShowSettings(false)}
          onTable={mutate}
        />
      )}
      {selectedRecord && createPortal(
        <RecordDetail
          table={table}
          record={selectedRecord}
          onClose={() => setDetailRecordId(null)}
          onChange={changeCell}
          onDelete={() => {
            if (removeRecords([selectedRecord.id], true)) setDetailRecordId(null);
          }}
          onUpload={pickFiles}
          onRemoveAttachment={(fieldId, attachmentId) => changeCell(selectedRecord.id, fieldId, getAttachments(selectedRecord, fieldId).filter(item => item.id !== attachmentId))}
        />,
        document.body,
      )}
    </NodeViewWrapper>
  );
}

function GallerySettings({
  table,
  view,
  config,
  panelRef,
  onClose,
  onConfig,
  onTable,
}: {
  table: BaseTable;
  view: BaseView;
  config: GalleryViewConfig;
  panelRef: RefObject<HTMLDivElement>;
  onClose: () => void;
  onConfig: (patch: Partial<GalleryViewConfig>) => void;
  onTable: (update: (table: BaseTable) => BaseTable) => void;
}) {
  const attachmentFields = table.fields.filter(field => field.type === 'attachment');
  return (
    <aside ref={panelRef} className="base-settings" data-no-marquee-selection="true" data-floating-panel="true">
      <header><strong>自定义卡片</strong><button type="button" onClick={onClose}>×</button></header>
      <label>视图名称<input value={view.name} disabled={view.locked} onChange={event => onTable(current => updateView(current, view.id, item => ({ ...item, name: event.target.value })))} /></label>
      <label>搜索记录<input disabled={view.locked} placeholder="搜索记录" value={String(config.search || '')} onChange={event => onConfig({ search: event.target.value })} /></label>
      <label>封面字段
        <select value={config.coverFieldId || ''} disabled={view.locked} onChange={event => onConfig({ coverFieldId: event.target.value || undefined })}>
          <option value="">不设置封面</option>
          {attachmentFields.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}
        </select>
      </label>
      {!attachmentFields.length && (
        <div className="base-settings__hint">
          当前没有附件字段，卡片将使用默认封面。
          <button type="button" disabled={view.locked} onClick={() => onTable(current => {
            const id = `fld_attachment_${Date.now().toString(36)}`;
            const field: BaseField = { id, name: '附件', type: 'attachment' };
            return {
              ...current,
              fields: [...current.fields, field],
              records: current.records.map(record => ({ ...record, fields: { ...record.fields, [id]: [] } })),
              views: current.views.map(item => item.id === view.id ? { ...item, config: { ...config, coverFieldId: id } } : item),
            };
          })}>创建附件字段</button>
        </div>
      )}
      <div className="base-settings__row">
        <label>封面展示<select disabled={view.locked} value={config.coverFit} onChange={event => onConfig({ coverFit: event.target.value as 'cover' | 'contain' })}><option value="cover">填充</option><option value="contain">完整显示</option></select></label>
        <label>卡片尺寸<select disabled={view.locked} value={config.cardSize} onChange={event => onConfig({ cardSize: event.target.value as GalleryViewConfig['cardSize'] })}><option value="small">小</option><option value="medium">中</option><option value="large">大</option></select></label>
      </div>
      <label>卡片比例<select disabled={view.locked} value={config.cardAspectRatio} onChange={event => onConfig({ cardAspectRatio: event.target.value as GalleryViewConfig['cardAspectRatio'] })}><option value="1:1">1:1</option><option value="4:3">4:3</option><option value="16:9">16:9</option><option value="auto">自动</option></select></label>
      <label>标题字段<select disabled={view.locked} value={config.titleFieldId || table.primaryFieldId} onChange={event => onConfig({ titleFieldId: event.target.value })}>{table.fields.filter(field => field.type !== 'attachment').map(field => <option key={field.id} value={field.id}>{field.name}</option>)}</select></label>
      <fieldset>
        <legend>卡片显示字段</legend>
        {table.fields.filter(field => field.id !== config.titleFieldId && field.id !== config.coverFieldId).map(field => (
          <label className="base-check" key={field.id}>
            <input type="checkbox" disabled={view.locked} checked={config.visibleFieldIds.includes(field.id)} onChange={event => onConfig({ visibleFieldIds: event.target.checked ? [...config.visibleFieldIds, field.id] : config.visibleFieldIds.filter(id => id !== field.id) })} />
            {field.name}
          </label>
        ))}
      </fieldset>
      <div className="base-settings__row">
        <label className="base-check"><input type="checkbox" disabled={view.locked} checked={config.showFieldNames} onChange={event => onConfig({ showFieldNames: event.target.checked })} />显示字段名</label>
        <label className="base-check"><input type="checkbox" disabled={view.locked} checked={config.showEmptyFields} onChange={event => onConfig({ showEmptyFields: event.target.checked })} />显示空字段</label>
      </div>
      <label>分组字段<select disabled={view.locked} value={config.groupByFieldId || ''} onChange={event => onConfig({ groupByFieldId: event.target.value || undefined })}><option value="">不分组</option>{table.fields.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}</select></label>
      <label>排序字段<select disabled={view.locked} value={view.sorts?.[0]?.fieldId || ''} onChange={event => {
        if (view.locked) return;
        onTable(current => updateView(current, view.id, item => ({ ...item, sorts: event.target.value ? [{ fieldId: event.target.value, direction: item.sorts?.[0]?.direction || 'asc' }] : [] })));
      }}>
        <option value="">不排序</option>{table.fields.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}
      </select></label>
      {view.sorts?.length ? <button type="button" disabled={view.locked} className="base-settings__direction" onClick={() => {
        if (view.locked) return;
        onTable(current => updateView(current, view.id, item => ({ ...item, sorts: [{ ...item.sorts![0], direction: item.sorts![0].direction === 'asc' ? 'desc' : 'asc' }] })));
      }}>{view.sorts[0].direction === 'asc' ? '升序' : '降序'}</button> : null}
      <label>筛选字段<select disabled={view.locked} value={view.filters?.[0]?.fieldId || ''} onChange={event => {
        if (view.locked) return;
        onTable(current => updateView(current, view.id, item => ({ ...item, filters: event.target.value ? [{ id: 'primary-filter', fieldId: event.target.value, operator: 'contains', value: item.filters?.[0]?.value || '' }] : [] })));
      }}>
        <option value="">不筛选</option>{table.fields.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}
      </select></label>
      {view.filters?.length ? <input disabled={view.locked} placeholder="包含内容" value={view.filters[0].value || ''} onChange={event => {
        if (view.locked) return;
        onTable(current => updateView(current, view.id, item => ({ ...item, filters: [{ ...item.filters![0], value: event.target.value }] })));
      }} /> : null}
      <footer>
        <button type="button" onClick={() => onTable(current => updateView(current, view.id, item => ({ ...item, locked: !item.locked })))}>{view.locked ? '解锁视图' : '锁定视图'}</button>
      </footer>
    </aside>
  );
}

function GanttSettings({
  table,
  view,
  config,
  panelRef,
  onClose,
  onConfig,
  onTable,
}: {
  table: BaseTable;
  view: BaseView;
  config: GanttViewConfig;
  panelRef: RefObject<HTMLDivElement>;
  onClose: () => void;
  onConfig: (patch: Partial<GanttViewConfig>) => void;
  onTable: (update: (table: BaseTable) => BaseTable) => void;
}) {
  const dateFields = table.fields.filter(field => field.type === 'date');
  return (
    <aside ref={panelRef} className="base-settings" data-no-marquee-selection="true" data-floating-panel="true">
      <header><strong>甘特设置</strong><button type="button" onClick={onClose}>×</button></header>
      <label>视图名称<input value={view.name} disabled={view.locked} onChange={event => onTable(current => updateView(current, view.id, item => ({ ...item, name: event.target.value })))} /></label>
      <label>搜索记录<input disabled={view.locked} placeholder="搜索记录" value={String(config.search || '')} onChange={event => onConfig({ search: event.target.value })} /></label>
      <label>任务名称字段
        <select disabled={view.locked} value={config.titleFieldId || table.primaryFieldId} onChange={event => onConfig({ titleFieldId: event.target.value })}>
          {table.fields.filter(field => field.type !== 'attachment').map(field => <option key={field.id} value={field.id}>{field.name}</option>)}
        </select>
      </label>
      <div className="base-settings__row">
        <label>开始日期
          <select disabled={view.locked} value={config.startDateFieldId || ''} onChange={event => onConfig({ startDateFieldId: event.target.value })}>
            {dateFields.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}
          </select>
        </label>
        <label>结束日期
          <select disabled={view.locked} value={config.endDateFieldId || ''} onChange={event => onConfig({ endDateFieldId: event.target.value })}>
            {dateFields.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}
          </select>
        </label>
      </div>
      <label>时间刻度
        <select disabled={view.locked} value={config.dayWidth} onChange={event => onConfig({ dayWidth: Number(event.target.value) })}>
          <option value={60}>周</option>
          <option value={40}>月</option>
          <option value={24}>季</option>
        </select>
      </label>
      <label>排序字段<select disabled={view.locked} value={view.sorts?.[0]?.fieldId || ''} onChange={event => {
        if (view.locked) return;
        onTable(current => updateView(current, view.id, item => ({ ...item, sorts: event.target.value ? [{ fieldId: event.target.value, direction: item.sorts?.[0]?.direction || 'asc' }] : [] })));
      }}>
        <option value="">不排序</option>{table.fields.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}
      </select></label>
      <footer>
        <button type="button" onClick={() => onTable(current => updateView(current, view.id, item => ({ ...item, locked: !item.locked })))}>{view.locked ? '解锁视图' : '锁定视图'}</button>
      </footer>
    </aside>
  );
}

function GridSettings({
  table,
  view,
  panelRef,
  onClose,
  onTable,
}: {
  table: BaseTable;
  view: BaseView;
  panelRef: RefObject<HTMLDivElement>;
  onClose: () => void;
  onTable: (update: (table: BaseTable) => BaseTable) => void;
}) {
  const search = String((view.config as { search?: string }).search || '');
  const hidden = new Set(view.hiddenFieldIds || []);
  return (
    <aside ref={panelRef} className="base-settings" data-no-marquee-selection="true" data-floating-panel="true">
      <header><strong>视图设置</strong><button type="button" onClick={onClose}>×</button></header>
      <label>视图名称<input value={view.name} disabled={view.locked} onChange={event => onTable(current => updateView(current, view.id, item => ({ ...item, name: event.target.value })))} /></label>
      <label>搜索记录<input disabled={view.locked} placeholder="搜索记录" value={search} onChange={event => onTable(current => updateView(current, view.id, item => ({ ...item, config: { ...item.config, search: event.target.value } })))} /></label>
      <fieldset>
        <legend>显示字段</legend>
        {table.fields.map(field => (
          <label className="base-check" key={field.id}>
            <input
              type="checkbox"
              disabled={view.locked || field.id === table.primaryFieldId}
              checked={!hidden.has(field.id)}
              onChange={event => onTable(current => updateView(current, view.id, item => {
                const next = new Set(item.hiddenFieldIds || []);
                if (event.target.checked) next.delete(field.id); else next.add(field.id);
                return { ...item, hiddenFieldIds: Array.from(next) };
              }))}
            />
            {field.name}
          </label>
        ))}
      </fieldset>
      <label>排序字段<select disabled={view.locked} value={view.sorts?.[0]?.fieldId || ''} onChange={event => {
        if (view.locked) return;
        onTable(current => updateView(current, view.id, item => ({ ...item, sorts: event.target.value ? [{ fieldId: event.target.value, direction: item.sorts?.[0]?.direction || 'asc' }] : [] })));
      }}>
        <option value="">不排序</option>{table.fields.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}
      </select></label>
      {view.sorts?.length ? <button type="button" disabled={view.locked} className="base-settings__direction" onClick={() => {
        if (view.locked) return;
        onTable(current => updateView(current, view.id, item => ({ ...item, sorts: [{ ...item.sorts![0], direction: item.sorts![0].direction === 'asc' ? 'desc' : 'asc' }] })));
      }}>{view.sorts[0].direction === 'asc' ? '升序' : '降序'}</button> : null}
      <label>筛选字段<select disabled={view.locked} value={view.filters?.[0]?.fieldId || ''} onChange={event => {
        if (view.locked) return;
        onTable(current => updateView(current, view.id, item => ({ ...item, filters: event.target.value ? [{ id: 'primary-filter', fieldId: event.target.value, operator: 'contains', value: item.filters?.[0]?.value || '' }] : [] })));
      }}>
        <option value="">不筛选</option>{table.fields.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}
      </select></label>
      {view.filters?.length ? <input disabled={view.locked} placeholder="包含内容" value={view.filters[0].value || ''} onChange={event => {
        if (view.locked) return;
        onTable(current => updateView(current, view.id, item => ({ ...item, filters: [{ ...item.filters![0], value: event.target.value }] })));
      }} /> : null}
      <footer>
        <button type="button" onClick={() => onTable(current => updateView(current, view.id, item => ({ ...item, locked: !item.locked })))}>{view.locked ? '解锁视图' : '锁定视图'}</button>
      </footer>
    </aside>
  );
}

function RecordDetail({
  table,
  record,
  onClose,
  onChange,
  onDelete,
  onUpload,
  onRemoveAttachment,
}: {
  table: BaseTable;
  record: BaseRecord;
  onClose: () => void;
  onChange: (recordId: string, fieldId: string, value: CellValue) => void;
  onDelete: () => void;
  onUpload: (recordId: string, fieldId?: string) => void;
  onRemoveAttachment: (fieldId: string, attachmentId: string) => void;
}) {
  const title = valueText(record.fields[table.primaryFieldId]) || '未命名记录';
  return (
    <div className="base-detail-mask" data-no-marquee-selection="true" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="base-detail">
        <header><h3>{title}</h3><button type="button" onClick={onClose}>×</button></header>
        <div className="base-detail__fields">
          {table.fields.map(field => (
            <div className="base-detail__field" key={field.id}>
              <label>{field.name}</label>
              {field.type === 'attachment' ? (
                <>
                  <div className="base-detail__attachments">
                    {getAttachments(record, field.id).map(attachment => (
                      <div key={attachment.id} className="base-detail__attachment">
                        {isPreviewImage(attachment) ? <img src={attachment.thumbnailUrl || attachment.url} alt="" /> : <FileBadge attachment={attachment} />}
                        <span>{attachment.name}</span>
                        {attachment.uploadStatus === 'uploading' && <progress max={100} value={attachment.uploadProgress || 0} />}
                        {attachment.uploadStatus === 'failed' && <em>上传失败</em>}
                        <button type="button" onClick={() => onRemoveAttachment(field.id, attachment.id)}>删除</button>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="base-detail__upload" onClick={() => onUpload(record.id, field.id)}>+ 上传附件</button>
                </>
              ) : (
                <input value={valueText(record.fields[field.id])} onChange={event => onChange(record.id, field.id, event.target.value)} />
              )}
            </div>
          ))}
        </div>
        <footer>
          <span>创建于 {new Date(record.createdAt).toLocaleString()}</span>
          <button type="button" className="base-danger" onClick={onDelete}>删除记录</button>
        </footer>
      </aside>
    </div>
  );
}
