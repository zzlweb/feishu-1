import { useEffect, useMemo, useRef, useState } from 'react';
import { fieldTypeGlyph } from './BitableViewShared';
import {
  DEFAULT_RECORD_OPERATOR,
  findSelectChoice,
  formatCardDateValue,
  formatHistoryCellValue,
  formatHistoryTime,
  getAttachments,
  textColorForBackground,
  valueText,
  type BaseField,
  type BaseRecord,
  type BaseTable,
  type BaseView,
  type CellValue,
  type GalleryViewConfig,
  type RecordHistoryEntry,
  type SelectChoice,
} from './bitableModel';

export interface BitableRecordCardModalProps {
  table: BaseTable;
  activeView: BaseView;
  record: BaseRecord;
  records: BaseRecord[];
  locked?: boolean;
  onClose: () => void;
  onChange: (recordId: string, fieldId: string, value: CellValue) => void;
  onNavigate: (recordId: string) => void;
  onDelete?: (recordId: string) => void;
  onAddField?: () => void;
}

function fieldPlaceholder(field: BaseField) {
  if (field.type === 'single_select' || field.type === 'multi_select') return '请选择选项';
  if (field.type === 'relation') return '请选择记录';
  if (field.type === 'date') return '年/月/日';
  return '请输入内容';
}

const GlyphUp = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M21.707 16.293a1 1 0 0 1-1.414 0L12 8l-8.293 8.293a1 1 0 0 1-1.414-1.414l8.293-8.293a2 2 0 0 1 2.828 0l8.293 8.293a1 1 0 0 1 0 1.414Z" fill="currentColor" />
  </svg>
);

const GlyphDown = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M2.293 7.707a1 1 0 0 1 1.414 0L12 16l8.293-8.293a1 1 0 1 1 1.414 1.414l-8.293 8.293a2 2 0 0 1-2.828 0L2.293 9.121a1 1 0 0 1 0-1.414Z" fill="currentColor" />
  </svg>
);

const GlyphMore = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M5.5 11.75a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 0 1 3.5 0Zm8.225 0a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 0 1 3.5 0Zm8.275 0a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 0 1 3.5 0Z" fill="currentColor" />
  </svg>
);

const GlyphClose = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M20.207 20.207a.99.99 0 0 0 .003-1.403L13.406 12l6.804-6.804a.99.99 0 0 0-.003-1.403.99.99 0 0 0-1.403-.003L12 10.594 5.196 3.79a.99.99 0 0 0-1.403.003.99.99 0 0 0-.003 1.403L10.594 12 3.79 18.804a.99.99 0 0 0 .003 1.403.99.99 0 0 0 1.403.003L12 13.406l6.804 6.804a.99.99 0 0 0 1.403-.003Z" fill="currentColor" />
  </svg>
);

const GlyphAdd = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M12 2a1 1 0 0 0-1 1v8H3a1 1 0 1 0 0 2h8v8a1 1 0 1 0 2 0v-8h8a1 1 0 1 0 0-2h-8V3a1 1 0 0 0-1-1Z" fill="currentColor" />
  </svg>
);

const GlyphChevronDown = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M2.293 7.707a1 1 0 0 1 1.414 0L12 16l8.293-8.293a1 1 0 1 1 1.414 1.414l-8.293 8.293a2 2 0 0 1-2.828 0L2.293 9.121a1 1 0 0 1 0-1.414Z" fill="currentColor" />
  </svg>
);

const GlyphCalendar = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" aria-hidden>
    <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const GlyphTrash = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v9h-2V9Zm4 0h2v9h-2V9ZM7 9h2v9H7V9Z" fill="currentColor" />
  </svg>
);

function SelectTag({ choice, label }: { choice: SelectChoice | null; label: string }) {
  const background = choice?.color || '#e8f0ff';
  const color = textColorForBackground(background);
  return (
    <span className="bitable-card-select-tag" style={{ backgroundColor: background, color }}>
      {label}
    </span>
  );
}

function DateFieldEditor({
  field,
  value,
  disabled,
  onChange,
}: {
  field: BaseField;
  value: CellValue;
  disabled?: boolean;
  onChange: (value: CellValue) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const display = formatCardDateValue(value);
  return (
    <div className="bitable-card-field-value bitable-card-field-value--date">
      <div className="bitable-card-date-display">
        {display ? (
          <span className="bitable-card-field-text">{display}</span>
        ) : (
          <span className="bitable-card-field-placeholder">{fieldPlaceholder(field)}</span>
        )}
        <button
          type="button"
          className="bitable-card-field-suffix bitable-card-date-trigger"
          aria-label={`选择${field.name}`}
          disabled={disabled}
          onClick={() => {
            const input = inputRef.current;
            if (!input) return;
            input.showPicker?.();
            input.focus();
          }}
        >
          <GlyphCalendar />
        </button>
      </div>
      <input
        ref={inputRef}
        className="bitable-card-date-native"
        type="date"
        value={valueText(value)}
        disabled={disabled}
        aria-label={field.name}
        onChange={event => onChange(event.target.value)}
      />
    </div>
  );
}

function CardFieldEditor({
  field,
  record,
  value,
  disabled,
  onChange,
}: {
  field: BaseField;
  record: BaseRecord;
  value: CellValue;
  disabled?: boolean;
  onChange: (value: CellValue) => void;
}) {
  if (field.type === 'checkbox') {
    return (
      <div className="bitable-card-field-value">
        <label className="bitable-card-field-checkbox">
          <input
            type="checkbox"
            checked={Boolean(value)}
            disabled={disabled}
            onChange={event => onChange(event.target.checked)}
          />
          <span>{value ? '已完成' : '未完成'}</span>
        </label>
      </div>
    );
  }

  if (field.type === 'single_select') {
    const choices = field.options?.choices ?? [];
    const current = valueText(value);
    const choice = current ? findSelectChoice(field, current) : null;
    return (
      <div className="bitable-card-field-value bitable-card-field-value--select">
        <div className="bitable-card-select-display">
          {current ? (
            <SelectTag choice={choice} label={current} />
          ) : (
            <span className="bitable-card-field-placeholder">{fieldPlaceholder(field)}</span>
          )}
          <span className="bitable-card-field-suffix" aria-hidden><GlyphChevronDown /></span>
        </div>
        <select
          className="bitable-card-select-native"
          value={current}
          disabled={disabled}
          aria-label={field.name}
          onChange={event => onChange(event.target.value)}
        >
          <option value="">{fieldPlaceholder(field)}</option>
          {choices.map((item: SelectChoice) => (
            <option key={item.id} value={item.name}>{item.name}</option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === 'attachment') {
    const count = getAttachments(record, field.id).length;
    return (
      <div className="bitable-card-field-value">
        <div className="bitable-card-field-readonly">{count ? `${count} 个附件` : '暂无附件'}</div>
      </div>
    );
  }

  if (field.type === 'date') {
    return (
      <DateFieldEditor
        field={field}
        value={value}
        disabled={disabled}
        onChange={onChange}
      />
    );
  }

  const text = valueText(value);
  return (
    <div className="bitable-card-field-value">
      <input
        className={`bitable-card-field-input${text ? '' : ' is-empty'}`}
        type="text"
        value={text}
        disabled={disabled}
        placeholder={fieldPlaceholder(field)}
        aria-label={field.name}
        onChange={event => onChange(event.target.value)}
      />
    </div>
  );
}

function CardFieldRow({
  field,
  record,
  locked,
  onChange,
}: {
  field: BaseField;
  record: BaseRecord;
  locked?: boolean;
  onChange: (value: CellValue) => void;
}) {
  return (
    <div className="base_record_card_field_editor_wrapper">
      <label className="b-field-label card-field-editor b-field-label--inline b-field-label--new-layout" data-field-id={field.id}>
        <span className="b-field-label__text">
          <div className="b-field-label__title bitable-layout-row bitable-field-item">
            <div className="icon bitable-field-icon">{fieldTypeGlyph(field.type, 16)}</div>
            <span className="bitable-field-name">{field.name}</span>
          </div>
        </span>
        <CardFieldEditor
          field={field}
          record={record}
          value={record.fields[field.id]}
          disabled={locked}
          onChange={onChange}
        />
      </label>
    </div>
  );
}

function HistoryValue({ field, value }: { field: BaseField | undefined; value: CellValue }) {
  const text = formatHistoryCellValue(value);
  if (text === '-') return <span className="bitable-card-history-value is-empty">-</span>;
  if (field?.type === 'single_select') {
    const choice = findSelectChoice(field, text);
    return <SelectTag choice={choice} label={text} />;
  }
  return <span className="bitable-card-history-value">{text}</span>;
}

function CardHistoryTable({
  history,
  fields,
}: {
  history: RecordHistoryEntry[];
  fields: BaseField[];
}) {
  const fieldMap = useMemo(() => new Map(fields.map(field => [field.id, field])), [fields]);

  if (!history.length) {
    return (
      <div className="bitable-card-history-empty">
        <p>暂无历史记录</p>
        <p className="bitable-card-history-end">已经到底了</p>
      </div>
    );
  }

  return (
    <div className="bitable-card-history">
      <table className="bitable-card-history-table">
        <thead>
          <tr>
            <th>时间</th>
            <th>操作人</th>
            <th>字段</th>
            <th>变更前</th>
            <th aria-hidden />
            <th>变更后</th>
          </tr>
        </thead>
        <tbody>
          {history.map(entry => {
            const field = fieldMap.get(entry.fieldId);
            return (
              <tr key={entry.id}>
                <td className="bitable-card-history-time">{formatHistoryTime(entry.time)}</td>
                <td className="bitable-card-history-operator">
                  <span className="bitable-card-history-avatar" aria-hidden>
                    {(entry.operatorName || DEFAULT_RECORD_OPERATOR).slice(0, 1)}
                  </span>
                  <span>{entry.operatorName || DEFAULT_RECORD_OPERATOR}</span>
                </td>
                <td className="bitable-card-history-field">
                  <span className="bitable-card-history-field-icon" aria-hidden>
                    {fieldTypeGlyph(field?.type ?? 'text', 14)}
                  </span>
                  <span>{entry.fieldName || field?.name || '字段'}</span>
                </td>
                <td className="bitable-card-history-before">
                  <HistoryValue field={field} value={entry.before} />
                </td>
                <td className="bitable-card-history-arrow" aria-hidden>→</td>
                <td className="bitable-card-history-after">
                  <HistoryValue field={field} value={entry.after} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="bitable-card-history-end">已经到底了</p>
    </div>
  );
}

export function BitableRecordCardModal({
  table,
  activeView,
  record,
  records,
  locked = false,
  onClose,
  onChange,
  onNavigate,
  onDelete,
  onAddField,
}: BitableRecordCardModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<'detail' | 'history'>('detail');
  const [hiddenExpanded, setHiddenExpanded] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const hiddenFieldIds = useMemo(() => {
    const hidden = new Set(activeView.hiddenFieldIds || []);
    if (activeView.type === 'kanban') {
      const config = activeView.config as GalleryViewConfig;
      const groupFieldId = config.groupByFieldId
        ?? table.fields.find(field => field.type === 'single_select')?.id;
      if (groupFieldId) hidden.add(groupFieldId);
    }
    return hidden;
  }, [activeView.config, activeView.hiddenFieldIds, activeView.type, table.fields]);
  const { visibleFields, hiddenFields } = useMemo(() => {
    const visible: BaseField[] = [];
    const hidden: BaseField[] = [];
    table.fields.forEach(field => {
      if (hiddenFieldIds.has(field.id)) hidden.push(field);
      else visible.push(field);
    });
    return { visibleFields: visible, hiddenFields: hidden };
  }, [hiddenFieldIds, table.fields]);

  const recordIndex = records.findIndex(item => item.id === record.id);
  const canPrev = recordIndex > 0;
  const canNext = recordIndex >= 0 && recordIndex < records.length - 1;
  const title = valueText(record.fields[table.primaryFieldId]) || '未命名记录';
  const history = record.history ?? [];

  useEffect(() => {
    contentRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, record.id]);

  useEffect(() => {
    setTab('detail');
    setHiddenExpanded(false);
    setMoreOpen(false);
  }, [record.id]);

  useEffect(() => {
    if (!moreOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!moreMenuRef.current?.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [moreOpen]);

  return (
    <div
      className="bitable-record-card-mask"
      data-no-marquee-selection="true"
      onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        ref={contentRef}
        id="BASE_CARD_MODAL_CONTENT_FOCUS_ID"
        className="bitable-record-card-content J-card-edit-modal bitable-record-card-content-old-layout bitable-card-modal-content-v2"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`记录：${title}`}
        onMouseDown={event => event.stopPropagation()}
      >
        <div className="bitable-card-modal-header-v2">
          <div className="bitable-card-modal-header-v2-navbar">
            <div className="bitable-card-modal-header-v2-navbar__left">
              <div className="bitable-card-modal-header-v2-switch-buttons">
                <button
                  type="button"
                  data-e2e="bitable-card-modal-toolbar-prev"
                  className="bitable-card-modal-header-v2-btn bitable-card-modal-header-v2-btn-prev"
                  disabled={!canPrev}
                  aria-label="上一条记录"
                  onClick={() => canPrev && onNavigate(records[recordIndex - 1].id)}
                >
                  <span className="universe-icon"><GlyphUp /></span>
                </button>
                <button
                  type="button"
                  data-e2e="bitable-card-modal-toolbar-next"
                  className="bitable-card-modal-header-v2-btn bitable-card-modal-header-v2-btn-next"
                  disabled={!canNext}
                  aria-label="下一条记录"
                  onClick={() => canNext && onNavigate(records[recordIndex + 1].id)}
                >
                  <span className="universe-icon"><GlyphDown /></span>
                </button>
              </div>
            </div>
            <div className="bitable-card-modal-header-v2-navbar__right">
              <div className="bitable-card-modal-more" ref={moreMenuRef}>
                <button
                  type="button"
                  data-e2e="bitable-card-modal-toolbar-more"
                  className={`bitable-card-modal-header-v2-btn${moreOpen ? ' is-active' : ''}`}
                  aria-label="更多"
                  aria-expanded={moreOpen}
                  onClick={() => setMoreOpen(current => !current)}
                >
                  <span className="universe-icon"><GlyphMore /></span>
                </button>
                {moreOpen && (
                  <div className="bitable-card-modal-more-menu">
                    <button
                      type="button"
                      className="bitable-card-modal-more-menu__item is-danger"
                      disabled={locked || !onDelete}
                      onClick={() => {
                        setMoreOpen(false);
                        onDelete?.(record.id);
                      }}
                    >
                      <span className="bitable-card-modal-more-menu__icon" aria-hidden><GlyphTrash /></span>
                      删除记录
                    </button>
                  </div>
                )}
              </div>
              <span className="bitable-card-modal-header-v2-btn-split-line" aria-hidden />
              <button
                type="button"
                data-e2e="bitable-card-modal-toolbar-close"
                className="bitable-card-modal-header-v2-btn bitable-card-modal-header-v2-btn-close"
                aria-label="关闭"
                onClick={onClose}
              >
                <span className="universe-icon"><GlyphClose /></span>
              </button>
            </div>
          </div>
        </div>

        <div className="bitable-record-card-content-container">
          <div className="bitable-record-card-content-record">
            <div className="bitable-card-modal-header-v2-title-container">
              <div className="bitable-layout-row bitable-layout-cross-center">
                <div className="bitable-card-modal-header-v2-title bitable-card-modal-header-v2-title--medium">
                  <div className="bitable-card-modal-header-v2-title-content bitable-card-modal-header-v2-title-content-notitle">
                    {title}
                  </div>
                </div>
              </div>
            </div>

            <div className="card-modal-widget-tabs">
              <div className="bitable-item-view-tabs" role="tablist">
                <div className="bitable-item-view-tabs__bar">
                  <button
                    type="button"
                    role="tab"
                    className={`bitable-item-view-tab${tab === 'detail' ? ' is-active' : ''}`}
                    aria-selected={tab === 'detail'}
                    onClick={() => setTab('detail')}
                  >
                    <span className="bitable-item-view-edit-tab-name">详情</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    className={`bitable-item-view-tab${tab === 'history' ? ' is-active' : ''}`}
                    aria-selected={tab === 'history'}
                    onClick={() => setTab('history')}
                  >
                    <span className="bitable-item-view-edit-tab-name">历史</span>
                  </button>
                  <span className={`bitable-item-view-tabs__ink${tab === 'history' ? ' is-history' : ''}`} aria-hidden />
                </div>
              </div>

              {tab === 'detail' ? (
                <div className="bitable-card-detail">
                  <div className="J-card-edit-modal-body J-card-edit-modal-body--padding-standard">
                    <div className="card-modal-body-wrap">
                      <div id="bitable-card-modal-form" className="b-field-form card-modal-form card-modal-form--new-layout">
                        {visibleFields.map(field => (
                          <CardFieldRow
                            key={field.id}
                            field={field}
                            record={record}
                            locked={locked}
                            onChange={value => onChange(record.id, field.id, value)}
                          />
                        ))}
                      </div>

                      {hiddenFields.length > 0 && (
                        <div className="card_edit_hide">
                          <button
                            type="button"
                            className={`card_edit_hide_toggle${hiddenExpanded ? ' is-expanded' : ''}`}
                            onClick={() => setHiddenExpanded(current => !current)}
                          >
                            <span className="card_edit_hide_toggle_chevron" aria-hidden><GlyphChevronDown /></span>
                            <span>{hiddenFields.length} 个隐藏字段</span>
                          </button>
                          {hiddenExpanded && (
                            <div className="card_edit_hide_fields">
                              {hiddenFields.map(field => (
                                <CardFieldRow
                                  key={field.id}
                                  field={field}
                                  record={record}
                                  locked={locked}
                                  onChange={value => onChange(record.id, field.id, value)}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="card_edit_add_field bitable-layout-row">
                        <button
                          type="button"
                          className="card_edit_add_field_content"
                          disabled={locked || !onAddField}
                          onClick={onAddField}
                        >
                          <span className="card_edit_add_field_icon" aria-hidden><GlyphAdd /></span>
                          新增字段
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bitable-card-detail bitable-card-detail--history">
                  <div className="J-card-edit-modal-body J-card-edit-modal-body--padding-standard">
                    <CardHistoryTable history={history} fields={table.fields} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
