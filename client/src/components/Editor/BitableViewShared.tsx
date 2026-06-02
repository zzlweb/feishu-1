import { useCallback, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import * as React from 'react';
import { SelGlyphChevronDown } from '../../icons/selectionToolbarGlyphs';
import { FieldLockGlyph, fieldTypeGlyph } from './bitableFieldTypeIcons';
import { getAttachments, valueText, type AttachmentValue, type BaseField, type BaseRecord, type CellValue } from './bitableModel';

export { FieldLockGlyph, fieldTypeGlyph };

type GlyphProps = { size?: number };

function svgProps(size: number) {
  return { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', xmlns: 'http://www.w3.org/2000/svg' } as const;
}

function GridMenuGlyph({ children }: { children: React.ReactNode }) {
  return <span className="base-grid-field-menu__icon" aria-hidden>{children}</span>;
}

const GridMenuGlyphEdit = ({ size = 16 }: GlyphProps) => (
  <svg {...svgProps(size)}><path d="M14.5 4.5 19 9l-9.5 9.5H5v-4.5L14.5 4.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M12.5 6.5l3 3" stroke="currentColor" strokeWidth="1.5" /></svg>
);

const GridMenuGlyphInfo = ({ size = 16 }: GlyphProps) => (
  <svg {...svgProps(size)}><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" /><path d="M12 10v5M12 8h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
);

const GridMenuGlyphCopy = ({ size = 16 }: GlyphProps) => (
  <svg {...svgProps(size)}><rect x="8" y="8" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" /><path d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.5" /></svg>
);

const GridMenuGlyphHide = ({ size = 16 }: GlyphProps) => (
  <svg {...svgProps(size)}><path d="M3 8.5c2.2 3.3 5.2 5 9 5s6.8-1.7 9-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><path d="m5 12 2.5-2.5M10 13.5l.8-3M14 13.5l-.8-3M19 12l-2.5-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
);

const GridMenuGlyphInsertLeft = ({ size = 16 }: GlyphProps) => (
  <svg {...svgProps(size)}><path d="M19 12H8M11 8l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

const GridMenuGlyphInsertRight = ({ size = 16 }: GlyphProps) => (
  <svg {...svgProps(size)}><path d="M5 12h11M13 8l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

const GridMenuGlyphSortAsc = ({ size = 16 }: GlyphProps) => (
  <svg {...svgProps(size)}><path d="M8 16V8l-3 3M16 8v8M13 11l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

const GridMenuGlyphSortDesc = ({ size = 16 }: GlyphProps) => (
  <svg {...svgProps(size)}><path d="M8 8v8l-3-3M16 16V8M13 13l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

const GridMenuGlyphGroup = ({ size = 16 }: GlyphProps) => (
  <svg {...svgProps(size)}><rect x="4" y="5" width="7" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" /><rect x="13" y="5" width="7" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" /><rect x="4" y="13" width="7" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" /><rect x="13" y="13" width="7" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" /></svg>
);

const GridMenuGlyphFilter = ({ size = 16 }: GlyphProps) => (
  <svg {...svgProps(size)}><path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
);

const GridMenuGlyphDelete = ({ size = 16 }: GlyphProps) => (
  <svg {...svgProps(size)}><path d="M5 7h14M10 11v6M14 11v6M8 7l.5-2h7l.5 2M7 7l1 13h8l1-13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

export const GRID_FIELD_MENU_ICONS = {
  rename: GridMenuGlyphEdit,
  description: GridMenuGlyphInfo,
  duplicate: GridMenuGlyphCopy,
  hide: GridMenuGlyphHide,
  insertLeft: GridMenuGlyphInsertLeft,
  insertRight: GridMenuGlyphInsertRight,
  sortAsc: GridMenuGlyphSortAsc,
  sortDesc: GridMenuGlyphSortDesc,
  group: GridMenuGlyphGroup,
  filter: GridMenuGlyphFilter,
  delete: GridMenuGlyphDelete,
} as const;

export function GridFieldMenuIcon({ name }: { name: keyof typeof GRID_FIELD_MENU_ICONS }) {
  const Icon = GRID_FIELD_MENU_ICONS[name];
  return (
    <GridMenuGlyph>
      <Icon size={16} />
    </GridMenuGlyph>
  );
}

export function FieldDisplay({ field, value }: { field: BaseField; value: CellValue }) {
  const text = valueText(value);
  if (!text) return null;
  if (field.type === 'single_select') return <span className="base-cell-tag">{text}</span>;
  if (field.type === 'checkbox') return <span>{value ? '已完成' : '未完成'}</span>;
  if (field.type === 'attachment') return <span>{(value as AttachmentValue[]).length} 个附件</span>;
  return <span>{text}</span>;
}

export function isPreviewImage(attachment: AttachmentValue | undefined) {
  return Boolean(attachment?.mimeType.startsWith('image/') && (attachment.thumbnailUrl || attachment.previewUrl || attachment.url));
}

export function FileBadge({ attachment }: { attachment: AttachmentValue }) {
  const kind = attachment.mimeType.startsWith('video/') ? 'VIDEO' : attachment.extension.toUpperCase() || 'FILE';
  return (
    <div className="base-gallery-file-fallback">
      <strong>{kind}</strong>
      <span>{attachment.name}</span>
    </div>
  );
}

const PRIMARY_FIELD_LOCK_TIP = '索引列：用来标识每条记录。不能被删除、移动或隐藏';

export function useBitablePortalTooltip() {
  const anchorRef = useRef<any>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const showTip = useCallback(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ left: rect.left + rect.width / 2, top: rect.top });
  }, []);

  const hideTip = useCallback(() => setPos(null), []);

  const bind = {
    ref: anchorRef,
    onMouseEnter: showTip,
    onMouseLeave: hideTip,
    onFocus: showTip,
    onBlur: hideTip,
  };

  const renderTip = (tip: string, className?: string) => pos && createPortal(
    <div
      className={`bitable-portal-tooltip${className ? ` ${className}` : ''}`}
      role="tooltip"
      style={{ left: pos.left, top: pos.top }}
    >
      {tip}
    </div>,
    document.body,
  );

  return { bind, renderTip };
}

function GridFieldLockWithTooltip() {
  const { bind, renderTip } = useBitablePortalTooltip();
  return (
    <>
      <span
        {...bind}
        className="base-grid-field-lock"
        aria-label={PRIMARY_FIELD_LOCK_TIP}
        tabIndex={0}
      >
        <FieldLockGlyph size={14} />
      </span>
      {renderTip(PRIMARY_FIELD_LOCK_TIP)}
    </>
  );
}

export function RecordCardExpandGlyph({ size = 14 }: GlyphProps) {
  return (
    <svg {...svgProps(size)} aria-hidden>
      <rect x="4" y="6" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 12h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function GridFieldHeader({
  field,
  primaryFieldId,
  isMenuOpen,
  onMenuClick,
}: {
  field: BaseField;
  primaryFieldId: string;
  isMenuOpen?: boolean;
  onMenuClick?: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <span className="base-grid-field-head">
      {field.id === primaryFieldId && <GridFieldLockWithTooltip />}
      <span className="base-grid-field-icon" aria-hidden>{fieldTypeGlyph(field.type, 16)}</span>
      <span className="base-grid-field-name">{field.name}</span>
      <button
        type="button"
        className={`base-grid-field-chevron${isMenuOpen ? ' is-open' : ''}`}
        aria-label={`${field.name} 字段菜单`}
        aria-expanded={Boolean(isMenuOpen)}
        onClick={event => {
          event.preventDefault();
          event.stopPropagation();
          onMenuClick?.(event);
        }}
      >
        <SelGlyphChevronDown size={14} fill="currentColor" />
      </button>
    </span>
  );
}

export function attachmentCellLabel(record: BaseRecord, fieldId: string) {
  const count = getAttachments(record, fieldId).length;
  return count ? `${count} 个附件` : '+ 添加附件';
}
