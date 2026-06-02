import { useEffect, useMemo, useRef, useState } from 'react';
import { fieldTypeGlyph } from './BitableViewShared';
import {
  getAttachments,
  valueText,
  type BaseField,
  type BaseRecord,
  type BaseTable,
  type BaseView,
  type CellValue,
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
}

function fieldPlaceholder(field: BaseField) {
  if (field.type === 'single_select' || field.type === 'multi_select') return '请选择选项';
  if (field.type === 'relation') return '请选择记录';
  return '请输入内容';
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
  const editorClass = `bitable-card-edit-cell-editor-${field.type === 'single_select' ? 'SingleSelect' : field.type === 'multi_select' ? 'MultiSelect' : field.type === 'relation' ? 'SingleLink' : 'Text'}`;

  if (field.type === 'checkbox') {
    return (
      <div className={editorClass}>
        <div className="b-field-label__editor">
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
      </div>
    );
  }

  if (field.type === 'single_select') {
    const choices = field.options?.choices ?? [];
    const current = valueText(value);
    return (
      <div className={editorClass}>
        <div className="b-field-label__editor">
          <select
            className="bitable-card-field-input bitable-card-field-select"
            value={current}
            disabled={disabled}
            onChange={event => onChange(event.target.value)}
          >
            <option value="">{fieldPlaceholder(field)}</option>
            {choices.map((choice: SelectChoice) => (
              <option key={choice.id} value={choice.name}>{choice.name}</option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  if (field.type === 'attachment') {
    const count = getAttachments(record, field.id).length;
    return (
      <div className={editorClass}>
        <div className="b-field-label__editor">
          <div className="bitable-card-field-readonly">{count ? `${count} 个附件` : '暂无附件'}</div>
        </div>
      </div>
    );
  }

  if (field.type === 'date') {
    return (
      <div className={editorClass}>
        <div className="b-field-label__editor">
          <input
            className="bitable-card-field-input"
            type="date"
            value={valueText(value)}
            disabled={disabled}
            placeholder={fieldPlaceholder(field)}
            onChange={event => onChange(event.target.value)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={editorClass}>
      <div className="b-field-label__editor">
        <input
          className="bitable-card-field-input"
          type="text"
          value={valueText(value)}
          disabled={disabled}
          placeholder={fieldPlaceholder(field)}
          onChange={event => onChange(event.target.value)}
        />
      </div>
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

export function BitableRecordCardModal({
  table,
  activeView,
  record,
  records,
  locked = false,
  onClose,
  onChange,
  onNavigate,
}: BitableRecordCardModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<'detail' | 'history'>('detail');
  const [hiddenExpanded, setHiddenExpanded] = useState(false);

  const hiddenFieldIds = new Set(activeView.hiddenFieldIds || []);
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

  useEffect(() => {
    contentRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, record.id]);

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
            <div className="bitable-card-modal-header-v2-navbar__mid">
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
            <div className="bitable-card-modal-header-v2-navbar__gap" />
            <div className="bitable-card-modal-header-v2-navbar__right">
              <button type="button" data-e2e="bitable-card-modal-toolbar-more" className="bitable-card-modal-header-v2-btn" aria-label="更多">
                <span className="universe-icon"><GlyphMore /></span>
              </button>
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
                            className={`card_edit_hide_toggle${hiddenExpanded ? '' : ' is_collapsed'}`}
                            onClick={() => setHiddenExpanded(current => !current)}
                          >
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
                        <button type="button" className="card_edit_add_field_content" disabled={locked}>
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
                    <p>暂无历史记录</p>
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
