import { valueText, type BaseField, type CellValue } from '../model/bitableModel';
import { FieldDisplay } from './BitableViewShared';

export interface BitableCardFieldProps {
  field: BaseField;
  value: CellValue;
  showFieldName?: boolean;
  showEmptyValue?: boolean;
  variant?: 'gallery' | 'kanban';
}

interface FieldVisualMeta {
  icon: string;
  className: string;
}

export function getFieldVisualMeta(field: BaseField): FieldVisualMeta {
  if (field.type === 'checkbox') return { icon: '☑', className: 'is-checkbox' };
  if (field.type === 'date') return { icon: '▣', className: 'is-date' };
  if (field.type === 'created_time' || field.type === 'updated_time') return { icon: '▣', className: 'is-date' };
  if (field.type === 'number') return { icon: '#', className: 'is-number' };
  if (field.type === 'formula') return { icon: 'ƒx', className: 'is-formula' };
  if (field.type === 'single_select') return { icon: '⊙', className: 'is-select' };
  if (field.type === 'multi_select') return { icon: '☷', className: 'is-select' };
  if (field.type === 'attachment') return { icon: '▧', className: 'is-attachment' };
  if (field.type === 'user' || field.type === 'created_by' || field.type === 'updated_by') return { icon: 'U', className: 'is-user' };
  if (field.type === 'url') return { icon: '↗', className: 'is-url' };
  if (field.type === 'phone') return { icon: '☎', className: 'is-phone' };
  if (field.type === 'email') return { icon: '@', className: 'is-email' };
  if (field.type === 'lookup' || field.type === 'relation') return { icon: '⛓', className: 'is-relation' };
  return { icon: 'A=', className: 'is-text' };
}

export function shouldRenderCardField(value: CellValue, showEmptyValue = false): boolean {
  return showEmptyValue || Boolean(valueText(value));
}

export function BitableCardField({
  field,
  value,
  showFieldName = false,
  showEmptyValue = false,
  variant = 'gallery',
}: BitableCardFieldProps) {
  if (!shouldRenderCardField(value, showEmptyValue)) return null;
  const meta = getFieldVisualMeta(field);
  const isEmpty = !valueText(value);

  return (
    <div className={`base-card-field base-card-field--${variant} ${meta.className}`}>
      <span className="base-card-field__icon" aria-hidden>{meta.icon}</span>
      {showFieldName ? <label className="base-card-field__label">{field.name}</label> : null}
      <div className="base-card-field__value">
        <FieldDisplay field={field} value={value} />
        {showEmptyValue && isEmpty ? <span className="base-card-field__empty">-</span> : null}
      </div>
    </div>
  );
}
