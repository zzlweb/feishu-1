import { getAttachments, selectCoverAttachment, valueText, type BaseRecord, type BaseTable, type GalleryViewConfig } from './bitableModel';
import { FieldDisplay, FileBadge, isPreviewImage } from './BitableViewShared';

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
  onDropFiles: (event: React.DragEvent, recordId?: string) => void;
  setDropActive: (active: boolean) => void;
  cardClick: (event: React.MouseEvent, recordId: string) => void;
  removeRecords: (recordIds: string[], requireConfirm?: boolean) => boolean;
  addRecord: () => void;
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
}: BitableGalleryViewProps) {
  const renderCover = (record: BaseRecord) => {
    const attachments = getAttachments(record, config.coverFieldId);
    const cover = selectCoverAttachment(attachments);
    if (isPreviewImage(cover)) {
      return <img loading="lazy" src={cover!.thumbnailUrl || cover!.previewUrl || cover!.url} alt="" style={{ objectFit: config.coverFit, objectPosition: config.coverPosition || 'center' }} />;
    }
    if (cover) return <FileBadge attachment={cover} />;
    return (
      <div className="base-gallery-empty-cover">
        <span aria-hidden>▧</span>
        {!config.coverFieldId ? <small>选择附件字段作为封面</small> : null}
      </div>
    );
  };

  return (
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
            <div className={`base-gallery-grid size-${config.cardSize}`}>
              {group.records.map(record => {
                const rawTitle = valueText(record.fields[config.titleFieldId || table.primaryFieldId]);
                const title = rawTitle || '未命名记录';
                const attachments = getAttachments(record, config.coverFieldId);
                return (
                  <article
                    key={record.id}
                    className={`base-gallery-card${selectedIds.has(record.id) ? ' is-selected' : ''}`}
                    onClick={event => cardClick(event, record.id)}
                    onDragOver={event => event.preventDefault()}
                    onDrop={event => onDropFiles(event, record.id)}
                  >
                    {config.emptyCoverMode !== 'hide-cover' && (
                      <div className={`base-gallery-card__cover ratio-${config.cardAspectRatio.replace(':', '-')}`}>
                        {renderCover(record)}
                        {attachments.length > 1 && config.showAttachmentCount && <span className="base-gallery-count">{attachments.length}</span>}
                        {selectCoverAttachment(attachments)?.mimeType.startsWith('video/') && <span className="base-gallery-video">▶</span>}
                      </div>
                    )}
                    <div className="base-gallery-card__body">
                      <strong className={`base-gallery-card__title${rawTitle ? '' : ' is-placeholder'}`}>{title}</strong>
                      {config.visibleFieldIds.map(fieldId => {
                        const field = table.fields.find(item => item.id === fieldId);
                        if (!field) return null;
                        const value = record.fields[field.id];
                        if (!config.showEmptyFields && !valueText(value)) return null;
                        return (
                          <div className="base-gallery-card__field" key={field.id}>
                            {config.showFieldNames && <label>{field.name}</label>}
                            <FieldDisplay field={field} value={value} />
                          </div>
                        );
                      })}
                    </div>
                    {config.showRecordActions && (
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
}
