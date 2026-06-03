import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { valueText, type BaseField, type BaseRecord, type BaseTable, type CellValue, type GalleryViewConfig } from './bitableModel';
import { FieldDisplay } from './BitableViewShared';

const KANBAN_COLUMN_WIDTH = 257;
const KANBAN_COLUMN_GAP = 8;
const KANBAN_CREATE_GROUP_WIDTH = 146;
const KANBAN_EDGE_MARGIN = 72;

export interface BitableKanbanViewProps {
  table: BaseTable;
  config: GalleryViewConfig;
  records: BaseRecord[];
  locked?: boolean;
  addRecordToColumn: (statusValue: string) => void;
  changeRecordStatus: (recordId: string, statusValue: string) => void;
  openRecord: (recordId: string) => void;
  addGroup: () => void;
  renameGroup: (choiceId: string, name: string) => void;
  deleteGroup: (choiceId: string) => void;
}

function getStatusField(table: BaseTable): BaseField | null {
  return table.fields.find(field => field.type === 'single_select') ?? null;
}

function stop(event: MouseEvent) {
  event.stopPropagation();
}

export function BitableKanbanView({
  table,
  config,
  records,
  locked = false,
  addRecordToColumn,
  changeRecordStatus,
  openRecord,
  addGroup,
  renameGroup,
  deleteGroup,
}: BitableKanbanViewProps) {
  const [draggingRecordId, setDraggingRecordId] = useState<string | null>(null);
  const [dropStatus, setDropStatus] = useState<string | null>(null);
  const [menuChoiceId, setMenuChoiceId] = useState<string | null>(null);
  const [renamingChoiceId, setRenamingChoiceId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const scrollLeftRef = useRef(0);
  const anchorWidthRef = useRef(0);
  const layoutOriginRef = useRef({ blockLeft: 0, bleedLeft: 0 });
  const thumbDragRef = useRef<{ startX: number; startScrollLeft: number } | null>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [thumbDragging, setThumbDragging] = useState(false);
  const [layoutCaps, setLayoutCaps] = useState({
    anchor: 0,
    maxBleedWidth: 0,
    trackWidth: 0,
    shiftMax: 0,
  });

  const statusField = getStatusField(table);
  const choices = statusField?.options?.choices ?? [];

  const recordsByStatus = useMemo(() => {
    const grouped = new Map<string, BaseRecord[]>();
    choices.forEach(choice => grouped.set(choice.name, []));
    records.forEach(record => {
      const status = valueText(record.fields[statusField?.id || '']);
      if (!grouped.has(status)) grouped.set(status, []);
      grouped.get(status)?.push(record);
    });
    return grouped;
  }, [choices, records, statusField?.id]);

  const visibleFieldIds = config.visibleFieldIds.filter(fieldId => fieldId !== statusField?.id && fieldId !== table.primaryFieldId);
  const contentWidth = choices.length * KANBAN_COLUMN_WIDTH
    + choices.length * KANBAN_COLUMN_GAP
    + KANBAN_CREATE_GROUP_WIDTH;
  const { anchor, maxBleedWidth, trackWidth, shiftMax } = layoutCaps;
  const baseScrollWidth = trackWidth || anchor;
  const wideLimit = maxBleedWidth || baseScrollWidth;
  const restingDisplayWidth = anchor > 0
    ? Math.min(
      baseScrollWidth || wideLimit,
      Math.max(anchor, Math.min(contentWidth, baseScrollWidth || contentWidth)),
    )
    : 0;
  const maxScrollLeft = Math.max(0, contentWidth - baseScrollWidth);
  const blockShift = Math.min(shiftMax, scrollLeft);
  const displayWidth = scrollLeft > 0
    ? Math.min(
      wideLimit,
      Math.max(restingDisplayWidth, Math.min(contentWidth, baseScrollWidth + blockShift)),
    )
    : restingDisplayWidth;
  const panAmount = Math.max(0, scrollLeft - shiftMax);
  const hScrollMetrics = useMemo(() => {
    const currentTrackWidth = baseScrollWidth || displayWidth;
    if (currentTrackWidth <= 0 || maxScrollLeft <= 0) {
      return { trackWidth: currentTrackWidth, thumbWidth: 0, thumbLeft: 0, travel: 0 };
    }
    const virtualScrollWidth = currentTrackWidth + maxScrollLeft;
    let thumbWidth = Math.max(48, Math.round((currentTrackWidth * currentTrackWidth) / virtualScrollWidth));
    thumbWidth = Math.min(thumbWidth, Math.max(48, currentTrackWidth - 48));
    const travel = Math.max(0, currentTrackWidth - thumbWidth);
    const thumbLeft = travel > 0 ? (scrollLeft / maxScrollLeft) * travel : 0;
    return { trackWidth: currentTrackWidth, thumbWidth, thumbLeft, travel };
  }, [baseScrollWidth, displayWidth, maxScrollLeft, scrollLeft]);

  const applyScrollLeft = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(next, maxScrollLeft));
    scrollLeftRef.current = clamped;
    setScrollLeft(clamped);
  }, [maxScrollLeft]);

  const syncLayoutCaps = useCallback(() => {
    const root = rootRef.current;
    const block = root?.closest<HTMLElement>('.feishu-bitable-block');
    if (!root || !block) return;
    const commentRail = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--comment-rail-width'),
    ) || 0;
    const blockLeftNow = block.getBoundingClientRect().left;
    const bleedHost = block.closest<HTMLElement>('.doc-page-workspace')
      ?? block.closest<HTMLElement>('.editor-container')
      ?? block.parentElement;
    const bleedLeftNow = bleedHost?.getBoundingClientRect().left ?? blockLeftNow;

    if (scrollLeftRef.current <= 0) {
      anchorWidthRef.current = block.getBoundingClientRect().width
        || block.parentElement?.clientWidth
        || root.clientWidth;
      layoutOriginRef.current = { blockLeft: blockLeftNow, bleedLeft: bleedLeftNow };
    } else if (!anchorWidthRef.current) {
      anchorWidthRef.current = block.getBoundingClientRect().width
        || block.parentElement?.clientWidth
        || root.clientWidth;
      layoutOriginRef.current = { blockLeft: blockLeftNow, bleedLeft: bleedLeftNow };
    }

    const anchorWidth = anchorWidthRef.current;
    const { blockLeft, bleedLeft } = layoutOriginRef.current;
    const nextMaxBleedWidth = Math.max(
      KANBAN_CREATE_GROUP_WIDTH,
      window.innerWidth - commentRail - KANBAN_EDGE_MARGIN * 2,
    );
    const wideLeft = Math.max(bleedLeft, (window.innerWidth - commentRail - nextMaxBleedWidth) / 2);
    const nextShiftMax = Math.max(0, blockLeft - wideLeft);
    const nextTrackWidth = Math.max(KANBAN_CREATE_GROUP_WIDTH, nextMaxBleedWidth - nextShiftMax);

    block.style.setProperty('--bitable-display-width', `${displayWidth || anchorWidth}px`);
    block.style.setProperty('--bitable-block-shift', `${blockShift}px`);
    block.style.setProperty('--bitable-bleed-left', `${wideLeft}px`);
    block.style.setProperty('--bitable-anchor-width', `${anchorWidth}px`);
    block.style.setProperty('--bitable-anchor-scroll-width', `${nextTrackWidth}px`);
    block.classList.toggle('is-grid-hscroll-active', contentWidth > nextTrackWidth);
    block.classList.toggle('is-grid-bleed-active', blockShift > 0 || contentWidth > nextTrackWidth);

    setLayoutCaps({
      anchor: anchorWidth,
      maxBleedWidth: nextMaxBleedWidth,
      trackWidth: nextTrackWidth,
      shiftMax: nextShiftMax,
    });
  }, [blockShift, contentWidth, displayWidth]);

  useEffect(() => {
    syncLayoutCaps();
    const onResize = () => {
      layoutOriginRef.current = { blockLeft: 0, bleedLeft: 0 };
      anchorWidthRef.current = 0;
      syncLayoutCaps();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [syncLayoutCaps]);

  useEffect(() => {
    const block = rootRef.current?.closest<HTMLElement>('.feishu-bitable-block');
    if (!block) return;
    block.style.setProperty('--bitable-display-width', `${displayWidth || anchor}px`);
    block.style.setProperty('--bitable-block-shift', `${blockShift}px`);
    block.classList.toggle('is-grid-bleed-active', blockShift > 0 || contentWidth > baseScrollWidth);
  }, [anchor, baseScrollWidth, blockShift, contentWidth, displayWidth]);

  useEffect(() => {
    if (scrollLeftRef.current > maxScrollLeft) {
      applyScrollLeft(maxScrollLeft);
    }
  }, [applyScrollLeft, maxScrollLeft]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      const delta = event.shiftKey
        ? event.deltaY
        : (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : 0);
      if (!delta || maxScrollLeft <= 0) return;
      event.preventDefault();
      applyScrollLeft(scrollLeftRef.current + delta);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [applyScrollLeft, maxScrollLeft]);

  const handleTrackPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (maxScrollLeft <= 0 || trackRef.current == null) return;
    if ((event.target as HTMLElement).classList.contains('base-kanban-hscroll__thumb')) return;
    const rect = trackRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const clickX = event.clientX - rect.left;
    const { thumbWidth, travel } = hScrollMetrics;
    const effectiveTravel = travel > 0 ? travel : Math.max(1, rect.width - thumbWidth);
    const nextLeft = Math.max(0, Math.min(clickX - thumbWidth / 2, effectiveTravel));
    applyScrollLeft((nextLeft / effectiveTravel) * maxScrollLeft);
  };

  const handleThumbPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (maxScrollLeft <= 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    thumbDragRef.current = { startX: event.clientX, startScrollLeft: scrollLeftRef.current };
    setThumbDragging(true);
  };

  const handleThumbPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = thumbDragRef.current;
    if (!drag || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || maxScrollLeft <= 0) return;
    const effectiveTravel = Math.max(1, rect.width - hScrollMetrics.thumbWidth);
    const deltaScroll = ((event.clientX - drag.startX) / effectiveTravel) * maxScrollLeft;
    applyScrollLeft(drag.startScrollLeft + deltaScroll);
  };

  const finishThumbDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    thumbDragRef.current = null;
    setThumbDragging(false);
  };

  const startRename = (choiceId: string, currentName: string) => {
    setMenuChoiceId(null);
    setRenamingChoiceId(choiceId);
    setRenameDraft(currentName);
  };

  const commitRename = () => {
    const choiceId = renamingChoiceId;
    const nextName = renameDraft.trim();
    if (choiceId && nextName) renameGroup(choiceId, nextName);
    setRenamingChoiceId(null);
    setRenameDraft('');
  };

  const onCardDrop = (event: DragEvent<HTMLElement>, statusValue: string) => {
    event.preventDefault();
    const recordId = event.dataTransfer.getData('text/plain') || draggingRecordId;
    setDropStatus(null);
    setDraggingRecordId(null);
    if (!recordId || locked) return;
    changeRecordStatus(recordId, statusValue);
  };

  if (!statusField) {
    return (
      <div className="base-kanban-empty">
        <strong>需要单选字段</strong>
        <span>创建一个单选字段后即可使用看板视图。</span>
      </div>
    );
  }

  if (choices.length === 0) {
    return (
      <div className="base-kanban-empty">
        <strong>暂无分组</strong>
        <span>为单选字段添加选项后即可生成看板列。</span>
      </div>
    );
  }

  return (
    <div className={`base-kanban${thumbDragging ? ' is-hscroll-dragging' : ''}`} ref={rootRef}>
      <div className="base-kanban__scroll">
        <div
          className="base-kanban__board"
          role="list"
          aria-label="看板"
          style={{
            width: contentWidth,
            transform: panAmount ? `translate3d(${-panAmount}px, 0, 0)` : undefined,
          }}
        >
          {choices.map(choice => {
            const columnRecords = recordsByStatus.get(choice.name) ?? [];
            const isMenuOpen = menuChoiceId === choice.id;
            const isRenaming = renamingChoiceId === choice.id;

            return (
              <section
                key={choice.id}
                className={`base-kanban__column${dropStatus === choice.name ? ' is-drop-target' : ''}`}
                style={{ ['--kanban-accent' as string]: choice.color }}
                onDragOver={event => {
                  if (locked) return;
                  event.preventDefault();
                  setDropStatus(choice.name);
                }}
                onDragLeave={() => setDropStatus(current => current === choice.name ? null : current)}
                onDrop={event => onCardDrop(event, choice.name)}
                role="listitem"
              >
                <header className="base-kanban__column-header">
                  <div className="base-kanban__column-title-wrap">
                    {isRenaming ? (
                      <input
                        className="base-kanban__column-title-input"
                        value={renameDraft}
                        onChange={event => setRenameDraft(event.target.value)}
                        onBlur={commitRename}
                        onKeyDown={event => {
                          if (event.key === 'Enter') commitRename();
                          if (event.key === 'Escape') {
                            setRenamingChoiceId(null);
                            setRenameDraft('');
                          }
                        }}
                        onClick={stop}
                        autoFocus
                      />
                    ) : (
                      <span className="base-kanban__column-title">{choice.name}</span>
                    )}
                    <span className="base-kanban__column-count">{columnRecords.length}</span>
                  </div>
                  <div className="base-kanban__column-actions">
                    <button
                      type="button"
                      className="base-kanban__column-action"
                      aria-label={`在 ${choice.name} 下新建记录`}
                      disabled={locked}
                      onClick={() => addRecordToColumn(choice.name)}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="base-kanban__column-action"
                      aria-label={`${choice.name} 更多操作`}
                      onClick={() => setMenuChoiceId(current => current === choice.id ? null : choice.id)}
                    >
                      ...
                    </button>
                    {isMenuOpen && (
                      <div className="base-kanban__column-menu" onMouseDown={stop}>
                        <button type="button" disabled={locked} onClick={() => startRename(choice.id, choice.name)}>重命名分组</button>
                        <button type="button" disabled={locked} onClick={() => addRecordToColumn(choice.name)}>新建记录</button>
                        <button type="button" className="is-danger" disabled={locked} onClick={() => deleteGroup(choice.id)}>删除分组</button>
                      </div>
                    )}
                  </div>
                </header>

                <div className="base-kanban__column-cards">
                  {columnRecords.map(record => {
                    const title = valueText(record.fields[config.titleFieldId || table.primaryFieldId]) || '未命名记录';
                    return (
                      <article
                        className={`base-kanban__card${draggingRecordId === record.id ? ' is-dragging' : ''}`}
                        key={record.id}
                        draggable={!locked}
                        onDragStart={event => {
                          setDraggingRecordId(record.id);
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData('text/plain', record.id);
                        }}
                        onDragEnd={() => {
                          setDraggingRecordId(null);
                          setDropStatus(null);
                        }}
                        onClick={() => openRecord(record.id)}
                      >
                        <strong className="base-kanban__card-title">{title}</strong>
                        {visibleFieldIds.map(fieldId => {
                          const field = table.fields.find(item => item.id === fieldId);
                          if (!field) return null;
                          const value = record.fields[fieldId];
                          if (!config.showEmptyFields && !valueText(value)) return null;
                          return (
                            <div className="base-kanban__card-field" key={field.id}>
                              {config.showFieldNames && <label>{field.name}</label>}
                              <FieldDisplay field={field} value={value as CellValue} />
                              {config.showEmptyFields && !valueText(value) && <span className="base-kanban__empty-value">空</span>}
                            </div>
                          );
                        })}
                      </article>
                    );
                  })}

                  {columnRecords.length === 0 && (
                    <button
                      type="button"
                      className="base-kanban__empty-card"
                      disabled={locked}
                      onClick={() => addRecordToColumn(choice.name)}
                    >
                      未命名记录
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  className="base-kanban__column-add"
                  aria-label={`在 ${choice.name} 下添加记录`}
                  disabled={locked}
                  onClick={() => addRecordToColumn(choice.name)}
                >
                  +
                </button>
              </section>
            );
          })}
          <button type="button" className="base-kanban__create-group" disabled={locked} onClick={addGroup}>
            <span>+</span>
            新建分组
          </button>
        </div>
      </div>
      <div className={`base-kanban-hscroll${maxScrollLeft > 0 ? ' is-active' : ''}`}>
        <div
          ref={trackRef}
          className="base-kanban-hscroll__track"
          style={hScrollMetrics.trackWidth > 0 ? { width: hScrollMetrics.trackWidth } : undefined}
          onPointerDown={handleTrackPointerDown}
        >
          {maxScrollLeft > 0 && (
            <div
              className={`base-kanban-hscroll__thumb${thumbDragging ? ' is-dragging' : ''}`}
              style={{
                width: hScrollMetrics.thumbWidth,
                transform: `translate3d(${hScrollMetrics.thumbLeft}px, 0, 0)`,
              }}
              onPointerDown={handleThumbPointerDown}
              onPointerMove={handleThumbPointerMove}
              onPointerUp={finishThumbDrag}
              onPointerCancel={finishThumbDrag}
            />
          )}
        </div>
      </div>
    </div>
  );
}
