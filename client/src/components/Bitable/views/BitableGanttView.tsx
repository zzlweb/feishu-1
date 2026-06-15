import { valueText, type BaseRecord, type BaseTable, type CellValue, type GanttViewConfig } from '../model/bitableModel';

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

function daysBetween(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

export interface GanttDraft {
  recordId: string;
  start: string;
  end: string;
}

export interface BitableGanttViewProps {
  table: BaseTable;
  config: GanttViewConfig;
  records: BaseRecord[];
  selectedIds: Set<string>;
  leftPanelCollapsed: boolean;
  today: Date;
  ganttOrigin: Date;
  ganttDays: Date[];
  ganttMonthSpans: Array<{ key: string; label: string; days: number }>;
  ganttDraft: GanttDraft | null;
  setLeftPanelCollapsed: (collapsed: boolean) => void;
  setGanttConfig: (patch: Partial<GanttViewConfig>) => void;
  toggleAllRecordSelection: () => void;
  toggleRecordSelection: (recordId: string) => void;
  scheduleRecordAt: (recordId: string, start: Date) => void;
  startGanttDrag: (event: React.PointerEvent<HTMLElement>, record: BaseRecord, mode: 'move' | 'start' | 'end') => void;
  moveGanttDrag: (event: React.PointerEvent<HTMLElement>) => void;
  endGanttDrag: (event: React.PointerEvent<HTMLElement>) => void;
  startGanttMouseDrag: (event: React.MouseEvent<HTMLElement>, record: BaseRecord, mode: 'move' | 'start' | 'end') => void;
  finishGanttDragAt: (clientX: number) => void;
  scrollToToday: () => void;
  scrollTimeline: (direction: 'left' | 'right') => void;
  addRecord: () => void;
  scrollRef: React.RefObject<HTMLDivElement>;
}

export function BitableGanttView({
  table,
  config,
  records,
  selectedIds,
  leftPanelCollapsed,
  today,
  ganttOrigin,
  ganttDays,
  ganttMonthSpans,
  ganttDraft,
  setLeftPanelCollapsed,
  setGanttConfig,
  toggleAllRecordSelection,
  toggleRecordSelection,
  scheduleRecordAt,
  startGanttDrag,
  moveGanttDrag,
  endGanttDrag,
  startGanttMouseDrag,
  finishGanttDragAt,
  scrollToToday,
  scrollTimeline,
  addRecord,
  scrollRef,
}: BitableGanttViewProps) {
  const isAllSelected = records.length > 0 && selectedIds.size === records.length;

  const timelineControls = (
    <div className="base-gantt__timeline-controls">
      <div className="base-gantt__scale">
        <button type="button" className={config.dayWidth >= 55 ? 'is-active' : ''} onClick={() => setGanttConfig({ dayWidth: 60 })}>周</button>
        <button type="button" className={config.dayWidth >= 35 && config.dayWidth < 55 ? 'is-active' : ''} onClick={() => setGanttConfig({ dayWidth: 40 })}>月</button>
        <button type="button" className={config.dayWidth >= 20 && config.dayWidth < 35 ? 'is-active' : ''} onClick={() => setGanttConfig({ dayWidth: 24 })}>季</button>
        <button type="button" className={config.dayWidth < 20 ? 'is-active' : ''} onClick={() => setGanttConfig({ dayWidth: 12 })}>年</button>
      </div>
      <div className="base-gantt__nav">
        <button type="button" className="base-gantt__nav-btn" onClick={scrollToToday}>今天</button>
        <button type="button" className="base-gantt__nav-arrow" onClick={() => scrollTimeline('left')} title="向左滚动">‹</button>
        <button type="button" className="base-gantt__nav-arrow" onClick={() => scrollTimeline('right')} title="向右滚动">›</button>
      </div>
    </div>
  );

  return (
    <div className="base-gantt">
      <div className="base-gantt__toolbar">
        <div className={`base-gantt__toolbar-spacer ${leftPanelCollapsed ? 'is-collapsed' : ''}`} />
        <div className="base-gantt__toolbar-controls">
          {timelineControls}
        </div>
      </div>

      <div className="base-gantt__scroll" ref={scrollRef}>
        <div className="base-gantt__container" style={{ minWidth: 'max-content', position: 'relative', ['--gantt-day-width' as string]: `${config.dayWidth}px` }}>
          <div className="base-gantt__header">
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

            <div className="base-gantt__timeline-head" style={{ width: ganttDays.length * config.dayWidth }}>
              <div className="base-gantt__months">
                {ganttMonthSpans.map(month => <span key={month.key} style={{ width: month.days * config.dayWidth }}>{month.label}</span>)}
              </div>
              <div className="base-gantt__days">
                {ganttDays.map(day => {
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  return (
                    <span key={dateValue(day)} className={`${dateValue(day) === dateValue(today) ? 'is-today' : ''} ${isWeekend ? 'is-weekend' : ''}`} style={{ width: config.dayWidth }}>
                      {day.getDate()}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          {leftPanelCollapsed && (
            <button type="button" className="base-gantt__expand-btn" onClick={() => setLeftPanelCollapsed(false)} title="展开左侧面板">
              »
            </button>
          )}

          <div
            className="base-gantt__today-line"
            style={{
              left: (leftPanelCollapsed ? 0 : 260) + daysBetween(ganttOrigin, today) * config.dayWidth + config.dayWidth / 2,
            }}
          />

          <div className="base-gantt__rows">
            {records.map((record, index) => {
              const title = valueText(record.fields[config.titleFieldId || table.primaryFieldId]) || '未命名记录';
              const draft = ganttDraft?.recordId === record.id ? ganttDraft : null;
              const start = readDate(draft?.start ?? record.fields[config.startDateFieldId || '']);
              const end = readDate(draft?.end ?? record.fields[config.endDateFieldId || '']);
              const scheduled = Boolean(start && end && daysBetween(start, end) >= 0);
              const durationDays = scheduled ? daysBetween(start!, end!) + 1 : 0;

              return (
                <div className="base-gantt__row" key={record.id}>
                  <div className={`base-gantt__left-pane ${leftPanelCollapsed ? 'is-collapsed' : ''}`}>
                    <div className="base-gantt__col base-gantt__col--checkbox">
                      <input type="checkbox" checked={selectedIds.has(record.id)} onChange={() => toggleRecordSelection(record.id)} />
                    </div>
                    <div className="base-gantt__col base-gantt__col--index">{index + 1}</div>
                    <div className="base-gantt__col base-gantt__col--name base-gantt__record">
                      <div className="base-gantt__title-text">{title}</div>
                    </div>
                  </div>

                  <div
                    className={`base-gantt__timeline base-gantt__lane${scheduled ? '' : ' is-unscheduled'}`}
                    style={{ width: ganttDays.length * config.dayWidth }}
                    onClick={event => {
                      if (scheduled || (event.target instanceof Element && event.target.closest('.base-gantt__schedule'))) return;
                      const clientLeft = event.currentTarget.getBoundingClientRect().left;
                      const cell = Math.max(0, Math.min(ganttDays.length - 1, Math.floor((event.clientX - clientLeft) / config.dayWidth)));
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
                          style={{ width: config.dayWidth }}
                        />
                      );
                    })}
                    {scheduled ? (
                      <div
                        className="base-gantt__bar"
                        data-record-id={record.id}
                        style={{
                          left: daysBetween(ganttOrigin, start!) * config.dayWidth + 3,
                          width: (daysBetween(start!, end!) + 1) * config.dayWidth - 6,
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
                        style={{ left: daysBetween(ganttOrigin, today) * config.dayWidth + 5 }}
                        onClick={() => scheduleRecordAt(record.id, today)}
                      >+ 设置排期</button>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="base-gantt__add-row base-gantt__row--add">
              <div className={`base-gantt__left-pane ${leftPanelCollapsed ? 'is-collapsed' : ''}`}>
                <button type="button" className="base-gantt__quick-add-btn" onClick={() => addRecord()} title="快速添加记录">
                  +
                </button>
              </div>
              <div className="base-gantt__timeline" style={{ width: ganttDays.length * config.dayWidth }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
