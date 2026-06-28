import { useCallback, useEffect, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  getAttachments,
  resolveGalleryVisibleFieldIds,
  selectCoverAttachment,
  valueText,
  type BaseRecord,
  type BaseTable,
  type GalleryViewConfig,
} from '../model/bitableModel';
import { BitableGalleryRecordContextMenu } from '../records/BitableGalleryRecordContextMenu';
import { BitableCardField } from '../shared/BitableCardField';
import { FileBadge, isPreviewImage } from '../shared/BitableViewShared';

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

function syncGalleryBleed(block: HTMLElement) {
  const editorContainer = block.closest<HTMLElement>('.editor-container');
  if (editorContainer) {
    const paddingLeft = Number.parseFloat(getComputedStyle(editorContainer).paddingLeft) || 0;
    block.style.setProperty('--bitable-doc-align-shift', `${paddingLeft}px`);
  } else {
    block.style.setProperty('--bitable-doc-align-shift', '0px');
  }
  block.style.setProperty('--bitable-block-shift', '0px');
}

function coverRatioClass(ratio: GalleryViewConfig['cardAspectRatio']) {
  if (ratio === '1:1') return 'ratio-1-1';
  if (ratio === '4:3') return 'ratio-4-3';
  if (ratio === '16:9') return 'ratio-16-9';
  if (ratio === 'auto') return 'ratio-auto';
  return 'ratio-4-3';
}

function gridSizeClass(cardSize: GalleryViewConfig['cardSize']) {
  if (cardSize === 'small') return 'size-small';
  if (cardSize === 'large') return 'size-large';
  return '';
}

function GalleryCardCover({
  record,
  config,
}: {
  record: BaseRecord;
  config: GalleryViewConfig;
}) {
  const attachments = getAttachments(record, config.coverFieldId);
  const cover = selectCoverAttachment(attachments);
  const coverStyle = {
    objectFit: config.coverFit,
    objectPosition: config.coverPosition || 'center',
  } as const;

  return (
    <>
      {isPreviewImage(cover) ? (
        <img
          loading="lazy"
          src={cover!.thumbnailUrl || cover!.previewUrl || cover!.url}
          alt=""
          style={coverStyle}
        />
      ) : cover ? (
        <FileBadge attachment={cover} />
      ) : (
        <div className="base-gallery-empty-cover">
          <span aria-hidden>▧</span>
          {!config.coverFieldId ? <small>选择附件字段作为封面</small> : null}
        </div>
      )}
      {attachments.length > 1 && config.showAttachmentCount ? (
        <span className="base-gallery-count">{attachments.length}</span>
      ) : null}
      {cover?.mimeType.startsWith('video/') ? <span className="base-gallery-video" aria-hidden>▶</span> : null}
    </>
  );
}

function stopPointer(event: ReactMouseEvent) {
  event.stopPropagation();
}

function GalleryCard({
  record,
  table,
  config,
  selected,
  onOpenRecord,
  onContextMenu,
  onDrop,
  onDragOver,
  showDelete,
  onDelete,
}: {
  record: BaseRecord;
  table: BaseTable;
  config: GalleryViewConfig;
  selected: boolean;
  onOpenRecord: (recordId: string) => void;
  onContextMenu: (event: ReactMouseEvent) => void;
  onDrop: (event: DragEvent) => void;
  onDragOver: (event: DragEvent) => void;
  showDelete: boolean;
  onDelete: (event: ReactMouseEvent) => void;
}) {
  const titleFieldId = config.titleFieldId || table.primaryFieldId;
  const rawTitle = valueText(record.fields[titleFieldId]);
  const title = rawTitle || '未命名记录';
  const hasCover = getAttachments(record, config.coverFieldId).length > 0;
  const hideCover = config.emptyCoverMode === 'hide-cover' && !hasCover;
  const visibleFieldIds = resolveGalleryVisibleFieldIds(table.fields, table.primaryFieldId, config);
  const isCompact = config.cardLayoutMode === 'compact';

  return (
    <article
      className={`base-gallery-card${selected ? ' is-selected' : ''}${isCompact ? ' is-compact' : ''}`}
      onMouseDown={stopPointer}
      onClick={event => {
        event.stopPropagation();
        onOpenRecord(record.id);
      }}
      onContextMenu={onContextMenu}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {!hideCover ? (
        <div className={`base-gallery-card__cover ${coverRatioClass(config.cardAspectRatio)}`.trim()}>
          <GalleryCardCover record={record} config={config} />
        </div>
      ) : null}
      <div className="base-gallery-card__body">
        <strong className={`base-gallery-card__title${rawTitle ? '' : ' is-placeholder'}`}>{title}</strong>
        {visibleFieldIds.map(fieldId => {
          const field = table.fields.find(item => item.id === fieldId);
          if (!field) return null;
          const value = record.fields[fieldId];
          return (
            <BitableCardField
              key={field.id}
              field={field}
              value={value}
              showFieldName={config.showFieldNames}
              showEmptyValue={config.showEmptyFields}
              variant="gallery"
            />
          );
        })}
      </div>
      {showDelete ? (
        <button
          type="button"
          className="base-gallery-card__delete"
          aria-label="删除记录"
          onClick={onDelete}
        >
          ×
        </button>
      ) : null}
    </article>
  );
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
  const menuRef = useRef<HTMLDivElement>(null);
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

  const openRecordMenu = useCallback((event: ReactMouseEvent, recordId: string) => {
    event.preventDefault();
    event.stopPropagation();
    onOpenRecord(recordId);
    setRecordMenu({ recordId, left: event.clientX, top: event.clientY });
  }, [onOpenRecord]);

  useEffect(() => {
    const surface = surfaceRef.current;
    const block = surface?.closest<HTMLElement>('.feishu-bitable-block');
    if (!surface || !block) return undefined;

    const syncGalleryLayout = () => {
      syncGalleryBleed(block);
    };

    syncGalleryLayout();
    const observer = new ResizeObserver(syncGalleryLayout);
    observer.observe(block);
    if (block.parentElement) observer.observe(block.parentElement);
    window.addEventListener('resize', syncGalleryLayout);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncGalleryLayout);
    };
  }, []);

  const toggleGroup = useCallback((groupKey: string) => {
    setCollapsedGroups(current => {
      const next = new Set(current);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }, [setCollapsedGroups]);

  const gridClassName = `base-gallery-grid ${gridSizeClass(config.cardSize)}`.trim();

  return (
    <div
      ref={surfaceRef}
      className={`base-gallery-surface${dropActive ? ' is-drop-active' : ''}`}
      onDragOver={event => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        setDropActive(true);
      }}
      onDragLeave={() => setDropActive(false)}
      onDrop={event => onDropFiles(event)}
    >
      {records.length === 0 ? (
        <div className="base-gallery-empty">
          <span>暂无记录</span>
          <button type="button" onClick={() => addRecord()}>新建记录</button>
        </div>
      ) : (
        groups.map(group => (
          <section key={group.key || 'all'} className="base-gallery-group">
            {group.label ? (
              <button
                type="button"
                className="base-gallery-group__header"
                onClick={() => toggleGroup(group.key)}
                aria-label={`${collapsedGroups.has(group.key) ? '展开' : '折叠'}${group.label}`}
              >
                <span aria-hidden>{collapsedGroups.has(group.key) ? '▸' : '▾'}</span>
                <span>{group.label}</span>
                <em>{group.records.length}</em>
              </button>
            ) : null}
            {!collapsedGroups.has(group.key) ? (
              <div className={gridClassName}>
                {group.records.map(record => (
                  <GalleryCard
                    key={record.id}
                    record={record}
                    table={table}
                    config={config}
                    selected={selectedIds.has(record.id)}
                    onOpenRecord={onOpenRecord}
                    onContextMenu={event => openRecordMenu(event, record.id)}
                    onDragOver={event => event.preventDefault()}
                    onDrop={event => onDropFiles(event, record.id)}
                    showDelete={config.showRecordActions}
                    onDelete={event => {
                      event.stopPropagation();
                      removeRecords([record.id], true);
                    }}
                  />
                ))}
              </div>
            ) : null}
          </section>
        ))
      )}

      {records.length > 0 ? (
        <button type="button" className="base-gallery-add-record" onClick={() => addRecord()}>
          + 添加记录
        </button>
      ) : null}

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
