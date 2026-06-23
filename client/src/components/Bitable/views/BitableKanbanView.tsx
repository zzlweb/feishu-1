import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { valueText, type BaseField, type BaseRecord, type BaseTable, type CellValue, type GalleryViewConfig } from '../model/bitableModel';
import { FieldDisplay, resolveBitableBleedRightEdge } from '../shared/BitableViewShared';

const KANBAN_DOC_WIDTH = 860;
const KANBAN_COLUMN_WIDTH = 276;
const KANBAN_COLUMN_GAP = 16;
const KANBAN_CREATE_GROUP_WIDTH = 146;
const KANBAN_EDGE_MARGIN = 72;

export interface BitableKanbanViewProps {
  table: BaseTable;
  config: GalleryViewConfig;
  records: BaseRecord[];
  selectedRecordId?: string | null;
  locked?: boolean;
  addRecordToColumn: (statusValue: string) => void;
  changeRecordStatus: (recordId: string, statusValue: string) => void;
  openRecord: (recordId: string) => void;
  removeRecords: (recordIds: string[], requireConfirm?: boolean) => boolean;
  addGroup: () => void;
  renameGroup: (choiceId: string, name: string) => void;
  deleteGroup: (choiceId: string) => void;
}

function getStatusField(table: BaseTable, config?: GalleryViewConfig): BaseField | null {
  if (config?.groupByFieldId) {
    const field = table.fields.find(item => item.id === config.groupByFieldId);
    if (field?.type === 'single_select') return field;
  }
  return table.fields.find(field => field.type === 'single_select') ?? null;
}

function resolveKanbanContentWidth(columnCount: number): number {
  if (columnCount <= 0) return KANBAN_CREATE_GROUP_WIDTH;
  return columnCount * KANBAN_COLUMN_WIDTH
    + columnCount * KANBAN_COLUMN_GAP
    + KANBAN_CREATE_GROUP_WIDTH;
}

function syncKanbanDocAlign(block: HTMLElement) {
  const editorContainer = block.closest<HTMLElement>('.editor-container');
  if (editorContainer) {
    const paddingLeft = Number.parseFloat(getComputedStyle(editorContainer).paddingLeft) || 0;
    block.style.setProperty('--bitable-doc-align-shift', `${paddingLeft}px`);
  } else {
    block.style.setProperty('--bitable-doc-align-shift', '0px');
  }
  block.style.setProperty('--bitable-kanban-width', `${KANBAN_DOC_WIDTH}px`);
}

function stop(event: MouseEvent) {
  event.stopPropagation();
}

export function BitableKanbanView({
  table,
  config,
  records,
  selectedRecordId = null,
  locked = false,
  addRecordToColumn,
  changeRecordStatus,
  openRecord,
  removeRecords,
  addGroup,
  renameGroup,
  deleteGroup,
}: BitableKanbanViewProps) {
  const dragMovedRef = useRef(false);
  const [draggingRecordId, setDraggingRecordId] = useState<string | null>(null);
  const [dropStatus, setDropStatus] = useState<string | null>(null);
  const [menuChoiceId, setMenuChoiceId] = useState<string | null>(null);
  const [cardMenu, setCardMenu] = useState<{ recordId: string; left: number; top: number } | null>(null);
  const [renamingChoiceId, setRenamingChoiceId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const cardMenuRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const scrollLeftRef = useRef(0);
  const anchorWidthRef = useRef(0);
  const layoutOriginRef = useRef({ blockLeft: 0, bleedLeft: 0 });
  const prevScrollLeftForLayoutRef = useRef(0);
  const thumbDragRef = useRef<{
    startX: number;
    startScrollLeft: number;
    maxScrollLeft: number;
    travel: number;
  } | null>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [thumbDragging, setThumbDragging] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [layoutCaps, setLayoutCaps] = useState({
    anchor: 0,
    maxBleedWidth: 0,
    trackWidth: 0,
    shiftMax: 0,
    panScrollMax: 0,
  });

  const statusField = getStatusField(table, config);
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
  const boardContentWidth = useMemo(
    () => resolveKanbanContentWidth(choices.length),
    [choices.length],
  );
  const boardWidth = Math.max(KANBAN_DOC_WIDTH, boardContentWidth, viewportWidth);
  const { anchor, maxBleedWidth, trackWidth, shiftMax, panScrollMax } = layoutCaps;
  const baseScrollWidth = trackWidth || anchor || viewportWidth;
  const wideLimit = maxBleedWidth || baseScrollWidth;
  const restingDisplayWidth = anchor > 0
    ? Math.min(
      baseScrollWidth || wideLimit,
      Math.max(anchor, Math.min(boardWidth, baseScrollWidth || boardWidth)),
    )
    : viewportWidth;
  const maxScrollLeft = Math.max(0, boardWidth - baseScrollWidth);
  const blockShift = Math.min(shiftMax, scrollLeft);
  const displayWidth = scrollLeft > 0
    ? Math.min(
      wideLimit,
      Math.max(restingDisplayWidth, Math.min(boardWidth, baseScrollWidth + blockShift)),
    )
    : restingDisplayWidth;
  const panAmount = Math.max(0, scrollLeft - blockShift);
  const scrollTrackWidth = baseScrollWidth;
  const effectiveMaxScrollLeft = thumbDragging && thumbDragRef.current
    ? thumbDragRef.current.maxScrollLeft
    : maxScrollLeft;

  const hScrollMetrics = useMemo(() => {
    const currentTrackWidth = scrollTrackWidth > 0 ? scrollTrackWidth : viewportWidth;
    if (currentTrackWidth <= 0 || effectiveMaxScrollLeft <= 0) {
      return { trackWidth: currentTrackWidth, thumbWidth: 0, thumbLeft: 0, travel: 0 };
    }
    const virtualScrollWidth = currentTrackWidth + effectiveMaxScrollLeft;
    let thumbWidth = Math.max(48, Math.round((currentTrackWidth * currentTrackWidth) / virtualScrollWidth));
    thumbWidth = Math.min(thumbWidth, Math.max(48, currentTrackWidth - 48));
    const travel = Math.max(0, currentTrackWidth - thumbWidth);
    const thumbLeft = travel > 0 ? (scrollLeft / effectiveMaxScrollLeft) * travel : 0;
    return { trackWidth: currentTrackWidth, thumbWidth, thumbLeft, travel };
  }, [effectiveMaxScrollLeft, scrollLeft, scrollTrackWidth, viewportWidth]);

  const applyScrollLeft = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(next, maxScrollLeft));
    scrollLeftRef.current = clamped;
    setScrollLeft(clamped);
  }, [maxScrollLeft]);

  const syncLayoutCaps = useCallback(() => {
    const root = rootRef.current;
    const block = root?.closest<HTMLElement>('.feishu-bitable-block');
    if (!root || !block) {
      setViewportWidth(root?.clientWidth ?? 0);
      return;
    }

    syncKanbanDocAlign(block);

    const blockLeftNow = block.getBoundingClientRect().left;

    if (scrollLeftRef.current <= 0 || !anchorWidthRef.current) {
      anchorWidthRef.current = Math.max(
        KANBAN_DOC_WIDTH,
        block.getBoundingClientRect().width
          || block.parentElement?.clientWidth
          || root.clientWidth,
      );
      layoutOriginRef.current = { blockLeft: blockLeftNow, bleedLeft: blockLeftNow };
    }

    const anchorWidth = anchorWidthRef.current;
    const { blockLeft } = layoutOriginRef.current;
    const rightEdge = resolveBitableBleedRightEdge(block, KANBAN_EDGE_MARGIN);
    const pageMain = block.closest<HTMLElement>('.doc-page-main');
    const catalogueRail = pageMain?.querySelector<HTMLElement>('.doc-page-catalogue-rail');
    const railRect = catalogueRail?.getBoundingClientRect();
    const railVisible = Boolean(
      catalogueRail
      && railRect
      && railRect.width > 1
      && getComputedStyle(catalogueRail).display !== 'none',
    );
    const railRight = railVisible && railRect ? railRect.right : 0;
    const safeLeft = Math.max(
      KANBAN_EDGE_MARGIN,
      railRight ? railRight + 8 : 0,
    );
    const nextMaxBleedWidth = Math.max(
      KANBAN_DOC_WIDTH,
      KANBAN_CREATE_GROUP_WIDTH,
      rightEdge - safeLeft,
    );
    const nextShiftMax = Math.max(0, blockLeft - safeLeft);
    const nextTrackWidth = Math.max(
      KANBAN_DOC_WIDTH,
      nextMaxBleedWidth - nextShiftMax,
    );
    const nextPanScrollMax = Math.max(0, boardWidth - nextMaxBleedWidth);
    const nextMaxScrollLeft = Math.max(0, boardWidth - nextTrackWidth);

    block.style.setProperty('--bitable-bleed-left', `${safeLeft}px`);
    block.style.setProperty('--bitable-block-left', `${blockLeft}px`);
    block.style.setProperty('--bitable-anchor-width', `${anchorWidth}px`);
    block.style.setProperty('--bitable-anchor-scroll-width', `${nextTrackWidth}px`);
    block.classList.toggle('is-grid-hscroll-active', nextMaxScrollLeft > 0);

    setLayoutCaps({
      anchor: anchorWidth,
      maxBleedWidth: nextMaxBleedWidth,
      trackWidth: nextTrackWidth,
      shiftMax: nextShiftMax,
      panScrollMax: nextPanScrollMax,
    });
    setViewportWidth(Math.max(KANBAN_DOC_WIDTH, anchorWidth));
  }, [boardWidth]);

  useEffect(() => {
    const block = rootRef.current?.closest<HTMLElement>('.feishu-bitable-block');
    if (!block) return;
    block.style.setProperty('--bitable-display-width', `${displayWidth}px`);
    block.style.setProperty('--bitable-block-shift', `${blockShift}px`);
    block.classList.toggle(
      'is-grid-bleed-active',
      blockShift > 0 || displayWidth > anchor + 1 || panScrollMax > 0,
    );
    block.dispatchEvent(new CustomEvent('bitable-grid-scroll', { bubbles: true }));
  }, [anchor, blockShift, displayWidth, panScrollMax]);

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
    if (scrollLeft <= 0 && prevScrollLeftForLayoutRef.current > 0) {
      layoutOriginRef.current = { blockLeft: 0, bleedLeft: 0 };
      syncLayoutCaps();
    }
    prevScrollLeftForLayoutRef.current = scrollLeft;
  }, [scrollLeft, syncLayoutCaps]);

  useEffect(() => {
    if (scrollLeftRef.current > maxScrollLeft) {
      applyScrollLeft(maxScrollLeft);
    }
  }, [applyScrollLeft, maxScrollLeft]);

  useEffect(() => {
    if (!cardMenu) return undefined;
    const handlePointerDown = (event: globalThis.MouseEvent) => {
      const target = event.target;
      if (target instanceof Node && cardMenuRef.current?.contains(target)) return;
      setCardMenu(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCardMenu(null);
    };
    document.addEventListener('mousedown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [cardMenu]);

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
    const rect = trackRef.current?.getBoundingClientRect();
    const travel = rect ? Math.max(1, rect.width - hScrollMetrics.thumbWidth) : Math.max(1, hScrollMetrics.travel);
    thumbDragRef.current = {
      startX: event.clientX,
      startScrollLeft: scrollLeftRef.current,
      maxScrollLeft,
      travel,
    };
    setThumbDragging(true);
  };

  const handleThumbPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = thumbDragRef.current;
    if (!drag || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    if (drag.maxScrollLeft <= 0) return;
    const deltaScroll = ((event.clientX - drag.startX) / drag.travel) * drag.maxScrollLeft;
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
    <div className={`base-kanban${config.cardLayoutMode === 'compact' ? ' is-compact' : ''}${thumbDragging ? ' is-hscroll-dragging' : ''}`} ref={rootRef}>
      <div className="base-kanban__scroll">
        <div
          className="base-kanban__board"
          role="list"
          aria-label="看板"
          style={{
            ['--kanban-column-width' as string]: `${KANBAN_COLUMN_WIDTH}px`,
            width: boardContentWidth,
            transform: panAmount > 0 ? `translate3d(${-panAmount}px, 0, 0)` : undefined,
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
                    const rawTitle = valueText(record.fields[config.titleFieldId || table.primaryFieldId]);
                    const title = rawTitle || '未命名记录';
                    return (
                      <article
                        className={`base-kanban__card${draggingRecordId === record.id ? ' is-dragging' : ''}${selectedRecordId === record.id ? ' is-selected' : ''}`}
                        key={record.id}
                        draggable={!locked}
                        onDragStart={event => {
                          dragMovedRef.current = true;
                          setDraggingRecordId(record.id);
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData('text/plain', record.id);
                        }}
                        onDragEnd={() => {
                          setDraggingRecordId(null);
                          setDropStatus(null);
                        }}
                        onMouseDown={stop}
                        onClick={() => {
                          if (dragMovedRef.current) {
                            dragMovedRef.current = false;
                            return;
                          }
                          openRecord(record.id);
                        }}
                        onContextMenu={event => {
                          event.preventDefault();
                          event.stopPropagation();
                          setCardMenu({ recordId: record.id, left: event.clientX, top: event.clientY });
                        }}
                      >
                        <strong className={`base-kanban__card-title${rawTitle ? '' : ' is-empty'}`}>{title}</strong>
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
      {cardMenu && createPortal(
        <div
          ref={cardMenuRef}
          className="base-kanban__card-menu"
          style={{ left: cardMenu.left, top: cardMenu.top }}
          onMouseDown={stop}
        >
          <button type="button" onClick={() => { openRecord(cardMenu.recordId); setCardMenu(null); }}>查看详情</button>
          <button
            type="button"
            className="is-danger"
            disabled={locked}
            onClick={() => {
              removeRecords([cardMenu.recordId]);
              setCardMenu(null);
            }}
          >
            删除记录
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}
