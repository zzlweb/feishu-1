import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Button, Checkbox, Input, Popup, Select, Switch, Upload } from 'tdesign-react';
import { CalendarIcon } from 'tdesign-icons-react';
import type { PopupProps } from 'tdesign-react';
import { FLOATING_Z_INDEX } from '../../Editor/shared/floatingPanel';
import { fieldTypeGlyph, isPreviewImage } from '../shared/BitableViewShared';
import {
  DEFAULT_RECORD_OPERATOR,
  findSelectChoice,
  formatHistoryCellValue,
  formatHistoryTime,
  formatCardDateValue,
  getAttachments,
  textColorForBackground,
  valueText,
  type AttachmentValue,
  type BaseField,
  type BaseRecord,
  type BaseTable,
  type BaseView,
  type CellValue,
  type GalleryViewConfig,
  type RecordHistoryEntry,
  type SelectChoice,
} from '../model/bitableModel';

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
  onUploadAttachment?: (recordId: string, fieldId: string, files: File[]) => void;
}

function fieldPlaceholder(field: BaseField) {
  if (field.type === 'single_select' || field.type === 'multi_select') return '请选择选项';
  if (field.type === 'relation') return '请选择记录';
  if (field.type === 'date') return '年/月/日';
  return '请输入内容';
}

/** 卡片弹层 z-index 为 10060，TDesign 浮层需挂到 body 并抬高层级 */
const CARD_MODAL_POPUP_PROPS: PopupProps = {
  attach: () => document.body,
  zIndex: FLOATING_Z_INDEX.bitableModal,
};

const ATTACHMENT_PANEL_WIDTH = 360;
const ATTACHMENT_PANEL_HEIGHT = 240;
const CARD_MODAL_POPUP_MARGIN = 12;

function clampAttachmentPanelPosition(trigger: DOMRect, boundary?: DOMRect | null) {
  let left = trigger.right - ATTACHMENT_PANEL_WIDTH;
  let top = trigger.bottom + 4;
  const minLeft = boundary ? boundary.left + CARD_MODAL_POPUP_MARGIN : CARD_MODAL_POPUP_MARGIN;
  const maxLeft = boundary
    ? boundary.right - ATTACHMENT_PANEL_WIDTH - CARD_MODAL_POPUP_MARGIN
    : window.innerWidth - ATTACHMENT_PANEL_WIDTH - CARD_MODAL_POPUP_MARGIN;
  const minTop = boundary ? boundary.top + CARD_MODAL_POPUP_MARGIN : CARD_MODAL_POPUP_MARGIN;
  const maxTop = boundary
    ? boundary.bottom - ATTACHMENT_PANEL_HEIGHT - CARD_MODAL_POPUP_MARGIN
    : window.innerHeight - ATTACHMENT_PANEL_HEIGHT - CARD_MODAL_POPUP_MARGIN;
  left = Math.max(minLeft, Math.min(left, maxLeft));
  top = Math.max(minTop, Math.min(top, maxTop));
  return { left, top };
}

function formatCardDateDisplay(value: CellValue): string {
  const raw = valueText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const [year, month, day] = raw.split('-');
  return `${year}/${month}/${day}`;
}

function toNativeDateValue(value: CellValue): string {
  const raw = valueText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
}

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

function dateValueFromParts(year: number, monthIndex: number, day: number): string {
  return `${year}-${padDatePart(monthIndex + 1)}-${padDatePart(day)}`;
}

function parseDateParts(value: string): { year: number; monthIndex: number; day: number } | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  return Number.isFinite(year) && monthIndex >= 0 && monthIndex <= 11 && day >= 1 && day <= 31
    ? { year, monthIndex, day }
    : null;
}

function todayDateValue(): string {
  const today = new Date();
  return dateValueFromParts(today.getFullYear(), today.getMonth(), today.getDate());
}

function calendarCells(year: number, monthIndex: number, selectedValue: string) {
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const offsetFromMonday = (firstDay + 6) % 7;
  const todayValue = todayDateValue();
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(year, monthIndex, index - offsetFromMonday + 1);
    const dateValue = dateValueFromParts(date.getFullYear(), date.getMonth(), date.getDate());
    return {
      dateValue,
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === monthIndex,
      isSelected: dateValue === selectedValue,
      isToday: dateValue === todayValue,
    };
  });
}

function shiftedMonth(year: number, monthIndex: number, delta: number) {
  const date = new Date(year, monthIndex + delta, 1);
  return { year: date.getFullYear(), monthIndex: date.getMonth() };
}

/** 卡片弹层 stopPropagation 会阻断 TDesign 浮层的 document 关闭逻辑，需在 capture 阶段补一层 */
function useCardModalOutsideDismiss(
  open: boolean,
  onDismiss: () => void,
  rootRef: RefObject<HTMLElement | null>,
  overlayRefOrCheck?: RefObject<HTMLElement | null> | ((target: Node) => boolean),
) {
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (typeof overlayRefOrCheck === 'function') {
        if (overlayRefOrCheck(target)) return;
      } else if (overlayRefOrCheck?.current?.contains(target)) {
        return;
      }
      onDismiss();
    };
    document.addEventListener('mousedown', onPointerDown, true);
    return () => document.removeEventListener('mousedown', onPointerDown, true);
  }, [open, onDismiss, rootRef, overlayRefOrCheck]);
}

function isSelectDropdownTarget(target: Node) {
  return Boolean((target as Element).closest?.('.t-select__dropdown'));
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

const GlyphTrash = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v9h-2V9Zm4 0h2v9h-2V9ZM7 9h2v9H7V9Z" fill="currentColor" />
  </svg>
);

function formatAttachmentSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function getAttachmentPreviewUrl(attachment: AttachmentValue): string {
  if (!isPreviewImage(attachment)) return '';
  return attachment.thumbnailUrl || attachment.previewUrl || attachment.url || '';
}

function AttachmentPreviewChip({ attachment }: { attachment: AttachmentValue }) {
  const previewUrl = getAttachmentPreviewUrl(attachment);
  const isUploading = attachment.uploadStatus === 'uploading';
  const isFailed = attachment.uploadStatus === 'failed';

  if (previewUrl) {
    return (
      <div
        className={`bitable-card-attachment-preview${isFailed ? ' is-failed' : ''}${isUploading ? ' is-uploading' : ''}`}
        title={attachment.name}
      >
        <img src={previewUrl} alt={attachment.name} />
        {isUploading ? (
          <span className="bitable-card-attachment-preview__progress">{attachment.uploadProgress ?? 0}%</span>
        ) : null}
      </div>
    );
  }

  const kind = attachment.mimeType.startsWith('video/') ? 'VIDEO' : (attachment.extension || 'file').slice(0, 3).toUpperCase();
  return (
    <div
      className={`bitable-card-attachment-preview bitable-card-attachment-preview--file${isFailed ? ' is-failed' : ''}`}
      title={attachment.name}
    >
      <span>{kind}</span>
    </div>
  );
}

function AttachmentFileItem({ attachment }: { attachment: AttachmentValue }) {
  const statusText = attachment.uploadStatus === 'failed'
    ? attachment.error || '上传失败'
    : attachment.uploadStatus === 'uploading'
      ? `上传中 ${attachment.uploadProgress ?? 0}%`
      : formatAttachmentSize(attachment.size);

  return (
    <div className={`bitable-card-attachment-item${attachment.uploadStatus === 'failed' ? ' is-failed' : ''}`}>
      <span className="bitable-card-attachment-item__icon" aria-hidden>
        {(attachment.extension || 'file').slice(0, 3).toUpperCase()}
      </span>
      <span className="bitable-card-attachment-item__body">
        <span className="bitable-card-attachment-item__name">{attachment.name}</span>
        {statusText ? <span className="bitable-card-attachment-item__meta">{statusText}</span> : null}
      </span>
    </div>
  );
}

function AttachmentUploadPopover({
  field,
  record,
  disabled,
  onUpload,
  modalBoundaryRef,
}: {
  field: BaseField;
  record: BaseRecord;
  disabled?: boolean;
  onUpload?: (recordId: string, fieldId: string, files: File[]) => void;
  modalBoundaryRef?: RefObject<HTMLElement | null>;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState({ left: 0, top: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const attachments = getAttachments(record, field.id);
  const canUpload = !disabled && Boolean(onUpload);

  function closePanel() {
    setOpen(false);
    setIsDragging(false);
  }

  function openPanel(trigger: HTMLElement) {
    if (!canUpload) return;
    const boundary = modalBoundaryRef?.current?.getBoundingClientRect();
    setPanelPosition(clampAttachmentPanelPosition(trigger.getBoundingClientRect(), boundary));
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    popoverRef.current?.focus({ preventScroll: true });
  }, [open]);

  useCardModalOutsideDismiss(open, closePanel, rootRef, target => {
    if (popoverRef.current?.contains(target)) return true;
    if (target instanceof Element && target.closest('.bitable-card-attachment-add')) return true;
    return false;
  });

  function uploadFiles(files: File[]) {
    if (!files.length || !canUpload) return;
    onUpload?.(record.id, field.id, files);
    closePanel();
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    uploadFiles(Array.from(event.dataTransfer.files));
  }

  return (
    <div ref={rootRef} className="bitable-card-field-value bitable-card-field-value--attachment bitable-card-field-value--tdesign">
      <div className={`bitable-card-attachment-inline${open ? ' is-active' : ''}${attachments.length ? '' : ' is-empty'}`}>
        <div
          className="bitable-card-attachment-previews"
          onClick={() => {
            if (!attachments.length && canUpload && addButtonRef.current) {
              openPanel(addButtonRef.current);
            }
          }}
        >
          {attachments.length > 0 ? (
            attachments.map(attachment => (
              <AttachmentPreviewChip key={attachment.id} attachment={attachment} />
            ))
          ) : (
            <span className="bitable-card-attachment-empty bitable-card-field-placeholder">暂无附件</span>
          )}
        </div>
        <button
          ref={addButtonRef}
          type="button"
          className="bitable-card-attachment-add"
          disabled={!canUpload}
          aria-label="添加附件"
          aria-expanded={open}
          onMouseDown={event => event.stopPropagation()}
          onClick={event => {
            if (!canUpload) return;
            if (open) {
              closePanel();
              return;
            }
            openPanel(event.currentTarget);
          }}
        >
          +
        </button>
      </div>
      {open && createPortal(
        <div
          ref={popoverRef}
          tabIndex={-1}
          className={`bitable-card-attachment-popover-panel bitable-card-attachment-popover-panel--portal${isDragging ? ' is-dragging' : ''}`}
          style={{ left: panelPosition.left, top: panelPosition.top }}
          onMouseDown={event => event.stopPropagation()}
          onPaste={event => {
            const files = Array.from(event.clipboardData.files);
            if (files.length > 0) {
              event.preventDefault();
              uploadFiles(files);
            }
          }}
          onDragEnter={event => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={event => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
          }}
          onDragLeave={event => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false);
          }}
          onDrop={handleDrop}
        >
          {attachments.length > 0 && (
            <div className="bitable-card-attachment-list">
              {attachments.map(attachment => <AttachmentFileItem key={attachment.id} attachment={attachment} />)}
            </div>
          )}
          <div className="bitable-card-attachment-dropzone">
            <span>粘贴或拖拽至这里上传</span>
          </div>
          <Upload
            theme="custom"
            multiple
            autoUpload={false}
            accept="image/*,video/*,application/pdf,*/*"
            onSelectChange={files => {
              uploadFiles(files);
            }}
          >
            <Button
              type="button"
              variant="text"
              className="bitable-card-attachment-local"
            >
              + 添加本地文件
            </Button>
          </Upload>
        </div>,
        document.body,
      )}
    </div>
  );
}

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
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const displayValue = formatCardDateDisplay(value);
  const pickerValue = toNativeDateValue(value) || undefined;
  const selectedParts = parseDateParts(pickerValue || todayDateValue())!;
  const [viewMonth, setViewMonth] = useState(() => ({
    year: selectedParts.year,
    monthIndex: selectedParts.monthIndex,
  }));
  const days = useMemo(
    () => calendarCells(viewMonth.year, viewMonth.monthIndex, pickerValue || todayDateValue()),
    [pickerValue, viewMonth.monthIndex, viewMonth.year],
  );

  useEffect(() => {
    if (!open) return;
    const nextParts = parseDateParts(pickerValue || todayDateValue())!;
    setViewMonth({ year: nextParts.year, monthIndex: nextParts.monthIndex });
  }, [open, pickerValue]);

  useCardModalOutsideDismiss(open, () => setOpen(false), rootRef, target => {
    return panelRef.current?.contains(target) ?? false;
  });

  return (
    <div ref={rootRef} className="bitable-card-field-value bitable-card-field-value--tdesign bitable-card-field-value--date">
      <Popup
        visible={open}
        trigger="click"
        placement="bottom-left"
        showArrow={false}
        destroyOnClose={false}
        disabled={disabled}
        overlayClassName="bitable-card-date-popup bitable-card-date-popup--portal"
        overlayInnerStyle={{ padding: 0 }}
        attach={CARD_MODAL_POPUP_PROPS.attach}
        zIndex={CARD_MODAL_POPUP_PROPS.zIndex}
        content={(
          <div ref={panelRef} className="bitable-card-date-shell">
            <div className="bitable-card-date-calendar">
              <div className="bitable-card-date-calendar__header">
                <button
                  type="button"
                  className="bitable-card-date-calendar__title"
                  aria-label="当前月份"
                >
                  <span>{viewMonth.year}年 {viewMonth.monthIndex + 1}月</span>
                  <span className="bitable-card-date-calendar__title-arrow" aria-hidden><GlyphChevronDown /></span>
                </button>
                <div className="bitable-card-date-calendar__nav">
                  <button
                    type="button"
                    className="bitable-card-date-calendar__nav-btn"
                    aria-label="上个月"
                    onClick={() => setViewMonth(current => shiftedMonth(current.year, current.monthIndex, -1))}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="bitable-card-date-calendar__nav-btn"
                    aria-label="下个月"
                    onClick={() => setViewMonth(current => shiftedMonth(current.year, current.monthIndex, 1))}
                  >
                    ›
                  </button>
                </div>
              </div>
              <div className="bitable-card-date-calendar__weekdays" aria-hidden>
                {['一', '二', '三', '四', '五', '六', '日'].map(day => <span key={day}>{day}</span>)}
              </div>
              <div className="bitable-card-date-calendar__grid">
                {days.map(day => (
                  <button
                    key={day.dateValue}
                    type="button"
                    className={[
                      'bitable-card-date-calendar__day',
                      day.isCurrentMonth ? '' : 'is-outside',
                      day.isToday ? 'is-today' : '',
                      day.isSelected ? 'is-selected' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => {
                      onChange(day.dateValue);
                      setOpen(false);
                    }}
                  >
                    {day.day}
                  </button>
                ))}
              </div>
            </div>
            <div
              className="bitable-card-date-reminder"
              onMouseDown={event => event.stopPropagation()}
            >
              <span className="bitable-card-date-reminder__label">到期提醒</span>
              <span className="bitable-card-date-reminder__help" aria-hidden>?</span>
              <Switch
                size="small"
                disabled={disabled}
                value={reminderEnabled}
                onChange={setReminderEnabled}
              />
            </div>
          </div>
        )}
        onVisibleChange={visible => {
          if (disabled) return;
          setOpen(visible);
        }}
      >
        <div className="bitable-card-date-input-wrap">
          <Input
            className="bitable-card-tdesign-control"
            borderless
            readonly
            value={displayValue}
            disabled={disabled}
            placeholder={fieldPlaceholder(field)}
            suffixIcon={<CalendarIcon />}
          />
        </div>
      </Popup>
    </div>
  );
}

function SelectFieldEditor({
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
  const rootRef = useRef<HTMLDivElement>(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const choices = field.options?.choices ?? [];
  const isMultiple = field.type === 'multi_select';
  const current = isMultiple
    ? (Array.isArray(value) ? value : valueText(value) ? [valueText(value)] : [])
    : valueText(value);

  useCardModalOutsideDismiss(popupOpen, () => setPopupOpen(false), rootRef, isSelectDropdownTarget);

  return (
    <div ref={rootRef} className="bitable-card-field-value bitable-card-field-value--tdesign">
      <Select
        className="bitable-card-tdesign-control"
        borderless
        clearable
        disabled={disabled}
        multiple={isMultiple}
        options={choices.map(choice => ({ label: choice.name, value: choice.name }))}
        placeholder={fieldPlaceholder(field)}
        popupProps={CARD_MODAL_POPUP_PROPS}
        popupVisible={popupOpen}
        value={current}
        onChange={nextValue => onChange(isMultiple ? (Array.isArray(nextValue) ? nextValue.map(String) : []) : String(nextValue || ''))}
        onPopupVisibleChange={visible => setPopupOpen(visible)}
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
  onUploadAttachment,
  modalBoundaryRef,
}: {
  field: BaseField;
  record: BaseRecord;
  value: CellValue;
  disabled?: boolean;
  onChange: (value: CellValue) => void;
  onUploadAttachment?: (recordId: string, fieldId: string, files: File[]) => void;
  modalBoundaryRef?: RefObject<HTMLElement | null>;
}) {
  if (field.type === 'checkbox') {
    return (
      <div className="bitable-card-field-value bitable-card-field-value--tdesign">
        <Checkbox
          className="bitable-card-checkbox"
          checked={Boolean(value)}
          disabled={disabled}
          onChange={checked => onChange(Boolean(checked))}
        >
          {value ? '已完成' : '未完成'}
        </Checkbox>
      </div>
    );
  }

  if (field.type === 'single_select' || field.type === 'multi_select') {
    return (
      <SelectFieldEditor
        field={field}
        value={value}
        disabled={disabled}
        onChange={onChange}
      />
    );
  }

  if (field.type === 'attachment') {
    return (
      <AttachmentUploadPopover
        field={field}
        record={record}
        disabled={disabled}
        onUpload={onUploadAttachment}
        modalBoundaryRef={modalBoundaryRef}
      />
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
    <div className="bitable-card-field-value bitable-card-field-value--tdesign">
      <Input
        className="bitable-card-tdesign-control"
        borderless
        value={text}
        disabled={disabled}
        placeholder={fieldPlaceholder(field)}
        onChange={nextValue => onChange(String(nextValue))}
      />
    </div>
  );
}

function CardFieldRow({
  field,
  record,
  locked,
  onChange,
  onUploadAttachment,
  modalBoundaryRef,
}: {
  field: BaseField;
  record: BaseRecord;
  locked?: boolean;
  onChange: (value: CellValue) => void;
  onUploadAttachment?: (recordId: string, fieldId: string, files: File[]) => void;
  modalBoundaryRef?: RefObject<HTMLElement | null>;
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
        <span className="b-field-label__editor">
          <CardFieldEditor
            field={field}
            record={record}
            value={record.fields[field.id]}
            disabled={locked}
            onChange={onChange}
            onUploadAttachment={onUploadAttachment}
            modalBoundaryRef={modalBoundaryRef}
          />
        </span>
      </label>
    </div>
  );
}

const GlyphChangeArrow = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M21.707 11.293a1 1 0 0 1 0 1.414l-7 7a1 1 0 0 1-1.414-1.414L18.586 13H2a1 1 0 1 1 0-2h16.586l-5.293-5.293a1 1 0 0 1 1.414-1.414l7 7Z" fill="currentColor" />
  </svg>
);

function HistoryFieldContent({ children }: { children: ReactNode }) {
  return (
    <div className="bitable-records-history-table__cell__field-content">
      {children}
    </div>
  );
}

function resolveHistoryAttachment(
  attachment: AttachmentValue,
  currentAttachments: AttachmentValue[],
): AttachmentValue {
  const live = currentAttachments.find(item => item.id === attachment.id);
  if (!live) return attachment;
  return {
    ...attachment,
    mimeType: live.mimeType || attachment.mimeType,
    url: live.url || attachment.url,
    thumbnailUrl: live.thumbnailUrl || live.url || attachment.thumbnailUrl || attachment.url,
    previewUrl: live.previewUrl || attachment.previewUrl,
  };
}

function HistoryAttachmentThumb({ attachment }: { attachment: AttachmentValue }) {
  const [hasImageError, setHasImageError] = useState(false);
  const previewUrl = getAttachmentPreviewUrl(attachment);
  const kind = attachment.mimeType.startsWith('video/') ? 'VIDEO' : (attachment.extension || 'file').slice(0, 3).toUpperCase();

  if (!previewUrl || hasImageError) {
    return (
      <div className="bitable-attachment-item bitable-rh-attachment-cell__file" title={attachment.name}>
        {kind}
      </div>
    );
  }

  return (
    <div className="bitable-attachment-item bitable-rh-attachment-cell__image" title={attachment.name}>
      <img
        src={previewUrl}
        alt={attachment.name}
        className="bitable-attachment-item__image"
        onError={() => setHasImageError(true)}
      />
    </div>
  );
}

function HistoryAttachmentValue({
  value,
  fieldId,
  record,
}: {
  value: CellValue;
  fieldId: string;
  record: BaseRecord;
}) {
  const list = Array.isArray(value) && value.length && typeof value[0] === 'object'
    ? (value as AttachmentValue[])
    : [];
  const currentAttachments = getAttachments(record, fieldId);

  if (!list.length) {
    return (
      <HistoryFieldContent>
        <span className="bitable-records-history-table__cell__empty">-</span>
      </HistoryFieldContent>
    );
  }

  return (
    <HistoryFieldContent>
      <div className="bitable-rh-tags-cell bitable-rh-attachment-cell">
        {list.map(attachment => (
          <HistoryAttachmentThumb
            key={attachment.id}
            attachment={resolveHistoryAttachment(attachment, currentAttachments)}
          />
        ))}
      </div>
    </HistoryFieldContent>
  );
}

function HistoryValue({
  field,
  value,
  record,
}: {
  field: BaseField | undefined;
  value: CellValue;
  record: BaseRecord;
}) {
  if (field?.type === 'attachment') {
    return <HistoryAttachmentValue value={value} fieldId={field.id} record={record} />;
  }

  if (field?.type === 'date') {
    const formatted = formatCardDateValue(value);
    if (!formatted) {
      return (
        <HistoryFieldContent>
          <span className="bitable-records-history-table__cell__empty">-</span>
        </HistoryFieldContent>
      );
    }
    return (
      <HistoryFieldContent>
        <div className="bitable-rh-text bitable-rh-text__multi-line">{formatted}</div>
      </HistoryFieldContent>
    );
  }

  const text = formatHistoryCellValue(value);
  if (text === '-') {
    return (
      <HistoryFieldContent>
        <span className="bitable-records-history-table__cell__empty">-</span>
      </HistoryFieldContent>
    );
  }

  if (field?.type === 'single_select') {
    const choice = findSelectChoice(field, text);
    return (
      <HistoryFieldContent>
        <SelectTag choice={choice} label={choice?.name || text} />
      </HistoryFieldContent>
    );
  }

  return (
    <HistoryFieldContent>
      <div className="bitable-rh-text bitable-rh-text__multi-line bitable-rh-segment-cell">
        <span className="bitable-rh-segment-cell__seg">{text}</span>
      </div>
    </HistoryFieldContent>
  );
}

function CardHistoryTable({
  history,
  fields,
  record,
}: {
  history: RecordHistoryEntry[];
  fields: BaseField[];
  record: BaseRecord;
}) {
  const fieldMap = useMemo(() => new Map(fields.map(field => [field.id, field])), [fields]);

  if (!history.length) {
    return (
      <div className="bitable-records-history bitable-records-history--empty">
        <p>暂无历史记录</p>
        <div className="bitable-records-history-table__footer">
          <span>已经到底了</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bitable-records-history">
      <div className="bitable-records-history-table__container">
        <table className="bitable-records-history-table">
          <thead>
            <tr>
              <th className="history-date">时间</th>
              <th className="history-operator">操作人</th>
              <th>字段</th>
              <th className="history-change-content">变更前</th>
              <th aria-hidden />
              <th className="history-change-content">变更后</th>
            </tr>
          </thead>
          <tbody>
            {history.map(entry => {
              const field = fieldMap.get(entry.fieldId);
              const operatorName = entry.operatorName || DEFAULT_RECORD_OPERATOR;
              return (
                <tr key={entry.id} className="bitable-records-history-table__row">
                  <td className="history-date">
                    <span className="bitable-records-history-table__cell__date">{formatHistoryTime(entry.time)}</span>
                  </td>
                  <td className="history-operator">
                    <div className="b-user-tag bitable-records-history-table__cell__user">
                      <div className="b-user-tag-container">
                        <span className="b-user-tag-text">{operatorName}</span>
                        <span className="b-user-tag-avatar bitable-records-history-table__cell__user-avatar" aria-hidden>
                          {operatorName.slice(0, 1)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="bitable-records-history-table__cell__field">
                      <span className="bitable-records-history-table__cell__field-icon" aria-hidden>
                        {fieldTypeGlyph(field?.type ?? 'text', 14)}
                      </span>
                      <span className="bitable-records-history-table__cell__field-name">
                        {entry.fieldName || field?.name || '字段'}
                      </span>
                    </div>
                  </td>
                  <td className="history-change-content">
                    <HistoryValue field={field} value={entry.before} record={record} />
                  </td>
                  <td className="bitable-records-history-table__cell-arrow">
                    <span className="bitable-records-history-table__cell__change-icon" aria-hidden>
                      <GlyphChangeArrow />
                    </span>
                  </td>
                  <td className="history-change-content">
                    <HistoryValue field={field} value={entry.after} record={record} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="bitable-records-history-table__footer">
          <span>已经到底了</span>
        </div>
      </div>
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
  onUploadAttachment,
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
                            modalBoundaryRef={contentRef}
                            onChange={value => onChange(record.id, field.id, value)}
                            onUploadAttachment={onUploadAttachment}
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
                                  modalBoundaryRef={contentRef}
                                  onChange={value => onChange(record.id, field.id, value)}
                                  onUploadAttachment={onUploadAttachment}
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
                    <CardHistoryTable history={history} fields={table.fields} record={record} />
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
