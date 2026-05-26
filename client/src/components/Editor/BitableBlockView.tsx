import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';
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

function ViewIcon({ type }: { type: BaseView['type'] }) {
  if (type === 'gallery') return <SlashGlyphGallery size={15} />;
  if (type === 'gantt') return <SlashGlyphGantt size={15} />;
  return <SlashGlyphBitableGrid size={15} />;
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

  const createView = (type: 'grid' | 'gallery' | 'gantt') => {
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
    if (typeof pos === 'number') editor.chain().focus().setNodeSelection(pos).run();
  };

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
                const title = valueText(record.fields[galleryConfig.titleFieldId || table.primaryFieldId]) || '未命名记录';
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
                      <strong className="base-gallery-card__title">{title}</strong>
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

  const renderGrid = () => (
    <div className="base-grid-scroll">
      <table className="base-grid-table">
        <thead>
          <tr>
            <th className="base-grid-index">#</th>
            {table.fields.filter(field => !(activeView.hiddenFieldIds || []).includes(field.id)).map(field => <th key={field.id}>{field.name}</th>)}
            <th className="feishu-bitable-block__tail" onClick={selectBlock} />
          </tr>
        </thead>
        <tbody>
          {records.map((record, index) => (
            <tr key={record.id}>
              <td className="base-grid-index"><button type="button" onClick={() => setDetailRecordId(record.id)}>{index + 1}</button></td>
              {table.fields.filter(field => !(activeView.hiddenFieldIds || []).includes(field.id)).map(field => (
                <td key={field.id}>
                  {field.type === 'attachment' ? (
                    <button type="button" className="base-grid-attachment" onClick={() => pickFiles(record.id, field.id)}>
                      {getAttachments(record, field.id).length ? `${getAttachments(record, field.id).length} 个附件` : '+ 添加附件'}
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
          <tr className="base-grid-add-row">
            <td colSpan={table.fields.length + 2}>
              <button type="button" onClick={() => addRecord()}>+ 添加记录</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  const ganttDates = records.flatMap(record => {
    const start = readDate(record.fields[ganttConfig.startDateFieldId || '']);
    const end = readDate(record.fields[ganttConfig.endDateFieldId || '']);
    return start && end && daysBetween(start, end) >= 0 ? [start, end] : [];
  });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ganttExtent = [...ganttDates, today];
  const ganttOrigin = offsetDate(new Date(Math.min(...ganttExtent.map(date => date.getTime()))), -2);
  const ganttLimit = offsetDate(new Date(Math.max(...ganttExtent.map(date => date.getTime()))), 14);
  const ganttDays = Array.from({ length: Math.max(22, daysBetween(ganttOrigin, ganttLimit) + 3) }, (_, index) => offsetDate(ganttOrigin, index));
  const ganttMonthSpans = ganttDays.reduce<Array<{ key: string; label: string; days: number }>>((items, day) => {
    const key = `${day.getFullYear()}-${day.getMonth()}`;
    const last = items[items.length - 1];
    if (last?.key === key) last.days += 1;
    else items.push({ key, label: formatMonth(day), days: 1 });
    return items;
  }, []);

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
  };

  const moveGanttDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = ganttDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const delta = Math.round((event.clientX - drag.originX) / ganttConfig.dayWidth);
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
    const draft = { recordId: drag.recordId, start: dateValue(start), end: dateValue(end) };
    ganttDraftRef.current = draft;
    setGanttDraft(draft);
  };

  const endGanttDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = ganttDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const draft = ganttDraftRef.current;
    ganttDragRef.current = null;
    ganttDraftRef.current = null;
    setGanttDraft(null);
    if (!draft || !ganttConfig.startDateFieldId || !ganttConfig.endDateFieldId) return;
    mutate(current => updateRecord(current, draft.recordId, record => {
      const next = withUpdatedValue(record, ganttConfig.startDateFieldId!, draft.start);
      return withUpdatedValue(next, ganttConfig.endDateFieldId!, draft.end);
    }));
  };

  const scheduleRecordAt = (recordId: string, start: Date) => {
    if (!ganttConfig.startDateFieldId || !ganttConfig.endDateFieldId || activeView.locked) return;
    mutate(current => updateRecord(current, recordId, record => {
      const next = withUpdatedValue(record, ganttConfig.startDateFieldId!, dateValue(start));
      return withUpdatedValue(next, ganttConfig.endDateFieldId!, dateValue(offsetDate(start, 3)));
    }));
  };

  const renderGantt = () => (
    <div className="base-gantt">
      <div className="base-gantt__toolbar">
        <div className="base-gantt__legend">
          任务排期
        </div>
        <div className="base-gantt__scale">
          <button type="button" className={ganttConfig.dayWidth >= 48 ? 'is-active' : ''} onClick={() => setGanttConfig({ dayWidth: 60 })}>周</button>
          <button type="button" className={ganttConfig.dayWidth >= 30 && ganttConfig.dayWidth < 48 ? 'is-active' : ''} onClick={() => setGanttConfig({ dayWidth: 40 })}>月</button>
          <button type="button" className={ganttConfig.dayWidth < 30 ? 'is-active' : ''} onClick={() => setGanttConfig({ dayWidth: 24 })}>季</button>
        </div>
      </div>
      <div className="base-gantt__scroll">
        <div className="base-gantt__header">
          <div className="base-gantt__record-column"><span className="base-gantt__field-icon">A</span>任务名</div>
          <div className="base-gantt__timeline-head" style={{ width: ganttDays.length * ganttConfig.dayWidth }}>
            <div className="base-gantt__months">
              {ganttMonthSpans.map(month => <span key={month.key} style={{ width: month.days * ganttConfig.dayWidth }}>{month.label}</span>)}
            </div>
            <div className="base-gantt__days">
              {ganttDays.map(day => (
                <span key={dateValue(day)} className={dateValue(day) === dateValue(today) ? 'is-today' : ''} style={{ width: ganttConfig.dayWidth }}>
                  {day.getDate()}
                </span>
              ))}
            </div>
          </div>
        </div>
        {records.map(record => {
          const title = valueText(record.fields[ganttConfig.titleFieldId || table.primaryFieldId]) || '未命名记录';
          const draft = ganttDraft?.recordId === record.id ? ganttDraft : null;
          const start = readDate(draft?.start ?? record.fields[ganttConfig.startDateFieldId || '']);
          const end = readDate(draft?.end ?? record.fields[ganttConfig.endDateFieldId || '']);
          const scheduled = Boolean(start && end && daysBetween(start, end) >= 0);
          return (
            <div className="base-gantt__row" key={record.id}>
              <button type="button" className="base-gantt__record" onClick={() => setDetailRecordId(record.id)}>
                {title}
              </button>
              <div
                className={`base-gantt__timeline base-gantt__lane${scheduled ? '' : ' is-unscheduled'}`}
                style={{ width: ganttDays.length * ganttConfig.dayWidth }}
                onClick={event => {
                  if (scheduled || (event.target instanceof Element && event.target.closest('.base-gantt__schedule'))) return;
                  const cell = Math.max(0, Math.min(ganttDays.length - 1, Math.floor((event.clientX - event.currentTarget.getBoundingClientRect().left) / ganttConfig.dayWidth)));
                  scheduleRecordAt(record.id, ganttDays[cell]);
                }}
                title={scheduled ? undefined : '点击日期设置排期'}
              >
                {ganttDays.map(day => <span key={dateValue(day)} className={dateValue(day) === dateValue(today) ? 'is-today' : ''} style={{ width: ganttConfig.dayWidth }} />)}
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
                  >
                    <i className="base-gantt__resize base-gantt__resize--start" onPointerDown={event => startGanttDrag(event, record, 'start')} />
                    <span>{title}</span>
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
        <button type="button" className="base-gantt__add" onClick={() => addRecord()}>+ 添加记录</button>
      </div>
    </div>
  );

  const selectedRecord = table.records.find(record => record.id === detailRecordId);

  return (
    <NodeViewWrapper
      className={`feishu-bitable-block feishu-base-block${selected ? ' is-selected' : ''}`}
      {...blockAttrs(node.attrs)}
      data-base-view-type={activeView.type}
      contentEditable={false}
    >
      <header className="base-viewbar" data-no-marquee-selection="true">
        <span className="base-viewbar__source" aria-hidden>✦</span>
        <span className="base-viewbar__app">{table.name}</span>
        <span className="base-viewbar__divider" />
        <div className="base-view-switcher" ref={viewMenuRef}>
          <button type="button" className="base-viewbar__current" onClick={() => {
            setShowViewMenu(open => !open);
            setShowCreateViewMenu(false);
          }}>
            <span aria-hidden data-view-icon={activeView.type}><ViewIcon type={activeView.type} /></span>{activeView.name}{activeView.locked && ' 🔒'}<span aria-hidden>⌄</span>
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
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="base-viewbar__actions">
          <button type="button" className="base-viewbar__action-btn" aria-label="添加记录" onClick={() => addRecord()}>+</button>
          {activeView.type === 'gallery' && <button type="button" className="base-viewbar__action-btn" aria-label="画册设置" onClick={() => setShowSettings(open => !open)}>⚙</button>}
          {activeView.type === 'gantt' && <button type="button" className="base-viewbar__action-btn" aria-label="甘特设置" onClick={() => setShowSettings(open => !open)}>⚙</button>}
        </div>
        {selectedIds.size > 0 && <button type="button" className="base-selection-delete base-danger" onClick={() => removeRecords(Array.from(selectedIds), true)}>删除已选 {selectedIds.size} 项</button>}
      </header>
      <div className="base-view-content" data-no-marquee-selection="true">
        {activeView.type === 'gallery' ? renderGallery() : activeView.type === 'gantt' ? renderGantt() : renderGrid()}
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
