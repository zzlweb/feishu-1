import { useEffect, useRef, useState } from 'react';
import { BitableFieldTypePicker } from './BitableFieldTypePicker';
import { BitableSelectDefaultPicker, BitableSelectOptionsEditor } from './BitableSelectFieldEditor';
import { fieldTypeGlyph } from './bitableFieldTypeIcons';
import { fieldTypeLabel } from './bitableFieldTypes';
import type { BaseField, BaseFieldType, CellValue, SelectChoice } from './bitableModel';

export interface CreateFieldInput {
  name: string;
  type: BaseFieldType;
  defaultValue?: CellValue;
  options?: { choices?: SelectChoice[] };
}

export interface UpdateFieldInput {
  name: string;
  type: BaseFieldType;
  defaultValue?: CellValue;
  options?: { choices?: SelectChoice[] };
}

const FIELD_RECOMMENDS: Array<{ label: string; name: string; type: BaseFieldType }> = [
  { label: '任务周期', name: '任务周期', type: 'date' },
  { label: '任务优先级', name: '任务优先级', type: 'single_select' },
  { label: '负责人员', name: '负责人员', type: 'user' },
  { label: '相关文档', name: '相关文档', type: 'attachment' },
  { label: '任务进度', name: '任务进度', type: 'single_select' },
];

export function emptyDefaultValue(type: BaseFieldType): CellValue {
  if (type === 'attachment') return [];
  if (type === 'checkbox') return false;
  if (type === 'number') return 0;
  if (type === 'multi_select') return [];
  return '';
}

function isSelectFieldType(type: BaseFieldType) {
  return type === 'single_select' || type === 'multi_select';
}

function supportsTextDefault(type: BaseFieldType) {
  return type === 'text' || type === 'url' || type === 'email' || type === 'phone' || type === 'number';
}

function normalizeChoices(choices: SelectChoice[]) {
  return choices
    .map(choice => ({ ...choice, name: choice.name.trim() }))
    .filter(choice => choice.name);
}

function parseSelectDefaultValue(type: BaseFieldType, value?: CellValue): string | string[] {
  if (type === 'multi_select') {
    if (Array.isArray(value) && typeof value[0] !== 'object') return value as string[];
    return [];
  }
  if (typeof value === 'string') return value;
  return '';
}

function GlyphChevronRight({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GlyphInfo({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 10v6M12 8h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function FieldForm({
  initialName,
  initialType = 'text',
  initialDefaultValue,
  initialChoices = [],
  mode,
  showRecommendations,
  onCancel,
  onConfirm,
}: {
  initialName: string;
  initialType?: BaseFieldType;
  initialDefaultValue?: CellValue;
  initialChoices?: SelectChoice[];
  mode: 'add' | 'edit';
  showRecommendations: boolean;
  onCancel: () => void;
  onConfirm: (input: CreateFieldInput | UpdateFieldInput) => void;
}) {
  const titleRef = useRef<HTMLInputElement>(null);
  const typeTriggerRef = useRef<HTMLButtonElement>(null);
  const [title, setTitle] = useState(initialName);
  const [fieldType, setFieldType] = useState<BaseFieldType>(initialType);
  const [defaultValue, setDefaultValue] = useState(initialDefaultValue == null ? '' : String(initialDefaultValue));
  const [choices, setChoices] = useState<SelectChoice[]>(() => [...initialChoices]);
  const [selectDefault, setSelectDefault] = useState<string | string[]>(() => parseSelectDefaultValue(initialType, initialDefaultValue));
  const [showTypePicker, setShowTypePicker] = useState(false);

  useEffect(() => {
    titleRef.current?.focus();
    if (mode === 'edit') titleRef.current?.select();
  }, [mode]);

  const applyRecommend = (name: string, type: BaseFieldType) => {
    setTitle(name);
    setFieldType(type);
    setDefaultValue('');
    setSelectDefault(type === 'multi_select' ? [] : '');
    setChoices([]);
    setShowTypePicker(false);
  };

  const handleFieldTypeChange = (type: BaseFieldType) => {
    const wasSelect = isSelectFieldType(fieldType);
    const nextSelect = isSelectFieldType(type);
    setFieldType(type);
    setDefaultValue('');
    setSelectDefault(type === 'multi_select' ? [] : '');
    if (!wasSelect && nextSelect) setChoices([]);
    if (!nextSelect) setChoices([]);
    setShowTypePicker(false);
  };

  const handleChoicesChange = (nextChoices: SelectChoice[]) => {
    setChoices(nextChoices);
    const validNames = new Set(normalizeChoices(nextChoices).map(choice => choice.name));
    if (fieldType === 'single_select') {
      if (typeof selectDefault === 'string' && selectDefault && !validNames.has(selectDefault)) {
        setSelectDefault('');
      }
      return;
    }
    if (fieldType === 'multi_select' && Array.isArray(selectDefault)) {
      setSelectDefault(selectDefault.filter(name => validNames.has(name)));
    }
  };

  const handleConfirm = () => {
    const name = title.trim();
    if (!name) {
      titleRef.current?.focus();
      return;
    }
    const payload: CreateFieldInput = { name, type: fieldType };
    if (isSelectFieldType(fieldType)) {
      const validChoices = normalizeChoices(choices);
      payload.options = { choices: validChoices };
      if (fieldType === 'single_select' && typeof selectDefault === 'string' && selectDefault) {
        payload.defaultValue = selectDefault;
      } else if (fieldType === 'multi_select' && Array.isArray(selectDefault) && selectDefault.length) {
        payload.defaultValue = selectDefault;
      }
    } else if (supportsTextDefault(fieldType) && defaultValue.trim()) {
      payload.defaultValue = fieldType === 'number' ? Number(defaultValue) || 0 : defaultValue.trim();
    }
    onConfirm(payload);
  };

  return (
    <div
      className={`base-field-popover-new${mode === 'edit' ? ' base-field-popover-new--edit' : ''}`}
      data-e2e={mode === 'edit' ? 'bitable-edit-field-popover' : 'bitable-add-field-popover'}
      data-no-marquee-selection="true"
      data-floating-panel="true"
      role="dialog"
      aria-label={mode === 'edit' ? '修改字段/列' : '新增字段'}
      onMouseDown={event => event.stopPropagation()}
    >
      <div className="base-field-popover-new__scroll">
        <div className="base-field-popover-new__body">
          <label className="base-b-field-label">
            <span className="base-b-field-label__text">标题</span>
            <input
              ref={titleRef}
              className="base-b-field-input"
              type="text"
              maxLength={1000}
              placeholder={initialName || '请输入字段标题'}
              value={title}
              onChange={event => setTitle(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleConfirm();
                }
              }}
            />
          </label>

          <div className="base-b-select-field-type">
            <span className="base-b-field-label__text base-b-select-field-type__heading">字段类型</span>
            <div className="base-b-field-wrapper">
              <div className="base-b-field-type-anchor">
                <button
                  ref={typeTriggerRef}
                  type="button"
                  className={`base-b-field-type base-b-field-type--picker-trigger base-b-field-type--basic${showTypePicker ? ' is-active' : ''}`}
                  aria-expanded={showTypePicker}
                  aria-haspopup="listbox"
                  onClick={() => setShowTypePicker(open => !open)}
                >
                  <span className="base-b-field-type__left">
                    <span className="base-b-field-type__icon" aria-hidden>{fieldTypeGlyph(fieldType, 16)}</span>
                    <span className="base-b-field-type__name">{fieldTypeLabel(fieldType)}</span>
                  </span>
                  <span className="base-b-field-type__arrow" aria-hidden><GlyphChevronRight /></span>
                </button>
                <BitableFieldTypePicker
                  anchorRef={typeTriggerRef}
                  open={showTypePicker}
                  selectedType={fieldType}
                  onClose={() => setShowTypePicker(false)}
                  onSelect={handleFieldTypeChange}
                />
              </div>
              <button
                type="button"
                className="base-b-field-type base-b-field-type--shortcut"
                onClick={() => window.alert('字段捷径功能即将推出。')}
              >
                <span className="base-b-field-type__left">
                  <span>探索字段捷径</span>
                  <span className="base-b-field-type__info" aria-hidden><GlyphInfo /></span>
                </span>
                <span className="base-b-field-type__arrow" aria-hidden><GlyphChevronRight /></span>
              </button>
            </div>
          </div>

          {isSelectFieldType(fieldType) && (
            <BitableSelectOptionsEditor choices={choices} onChange={handleChoicesChange} />
          )}

          {isSelectFieldType(fieldType) ? (
            <BitableSelectDefaultPicker
              fieldType={fieldType}
              choices={choices}
              value={selectDefault}
              onChange={setSelectDefault}
            />
          ) : supportsTextDefault(fieldType) ? (
            <label className="base-b-field-label base-b-field-label--default">
              <span className="base-b-field-label__text">
                默认值
                <span className="base-b-field-label__info" title="新建记录时自动填入" aria-hidden><GlyphInfo /></span>
              </span>
              <input
                className="base-b-field-input"
                type={fieldType === 'number' ? 'number' : 'text'}
                placeholder="请输入内容"
                value={defaultValue}
                onChange={event => setDefaultValue(event.target.value)}
              />
            </label>
          ) : null}

          {showRecommendations && (
            <div className="base-field-recommend-list">
              <h2 className="base-field-recommend-list__title">推荐</h2>
              <div className="base-field-recommend-list__items">
                {FIELD_RECOMMENDS.map(item => (
                  <button
                    key={item.label}
                    type="button"
                    className="base-field-recommend-list__item"
                    onClick={() => applyRecommend(item.name, item.type)}
                  >
                    <span className="base-field-recommend-list__icon" aria-hidden>{fieldTypeGlyph(item.type, 16)}</span>
                    <span className="base-field-recommend-list__text">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="base-field-popover-new__footer">
        <button type="button" className="base-field-popover-new__btn base-field-popover-new__btn--ghost" onClick={onCancel}>
          取消
        </button>
        <button type="button" className="base-field-popover-new__btn base-field-popover-new__btn--primary" onClick={handleConfirm}>
          确定
        </button>
      </div>
    </div>
  );
}

export function BitableAddFieldPopover({
  defaultName,
  onCancel,
  onConfirm,
}: {
  defaultName: string;
  onCancel: () => void;
  onConfirm: (input: CreateFieldInput) => void;
}) {
  return (
    <FieldForm
      initialName={defaultName}
      mode="add"
      showRecommendations
      onCancel={onCancel}
      onConfirm={input => onConfirm(input)}
    />
  );
}

export function BitableEditFieldPopover({
  field,
  onCancel,
  onConfirm,
}: {
  field: BaseField;
  onCancel: () => void;
  onConfirm: (input: UpdateFieldInput) => void;
}) {
  return (
    <FieldForm
      initialName={field.name}
      initialType={field.type}
      initialDefaultValue={field.defaultValue}
      initialChoices={field.options?.choices ?? []}
      mode="edit"
      showRecommendations={false}
      onCancel={onCancel}
      onConfirm={input => onConfirm(input)}
    />
  );
}

export function buildNewFieldPayload(input: CreateFieldInput): {
  id: string;
  field: BaseField;
  defaultValue: CellValue;
} {
  const id = `fld_${input.type}_${Date.now().toString(36)}`;
  const field: BaseField = { id, name: input.name.trim(), type: input.type, defaultValue: input.defaultValue };
  if (input.type === 'single_select' || input.type === 'multi_select') {
    field.options = { choices: input.options?.choices ?? [] };
  }
  const defaultValue = input.defaultValue ?? emptyDefaultValue(input.type);
  return { id, field, defaultValue };
}
