import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { fieldTypeGlyph } from './bitableFieldTypeIcons';
import { filterFieldTypeGroups, type FieldTypeGroupDef } from './bitableFieldTypes';
import type { BaseFieldType } from '../model/bitableModel';
import { useAnchoredFloatingPosition } from '../../Editor/shared/floatingPanel';

function GlyphSearch({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M16.473 17.887A9.46 9.46 0 0 1 10.5 20a9.5 9.5 0 1 1 9.5-9.5 9.46 9.46 0 0 1-2.113 5.973l3.773 3.773a.996.996 0 0 1-.007 1.407.996.996 0 0 1-1.407.007l-3.773-3.773ZM18 10.5a7.5 7.5 0 1 0-15 0 7.5 7.5 0 0 0 15 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

function GlyphClear({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 23C5.925 23 1 18.075 1 12S5.925 1 12 1s11 4.925 11 11-4.925 11-11 11Zm3.874-16.635L12 10.239 8.126 6.365a1.245 1.245 0 1 0-1.761 1.76L10.239 12l-3.874 3.874a1.245 1.245 0 1 0 1.76 1.761L12 13.761l3.874 3.874a1.245 1.245 0 1 0 1.761-1.76L13.761 12l3.874-3.874a1.245 1.245 0 1 0-1.76-1.761Z"
        fill="currentColor"
      />
    </svg>
  );
}

function GlyphDone({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9.218 17.41 19.83 6.796a.99.99 0 1 1 1.389 1.415c-3.545 3.425-4.251 4.105-11.419 11.074a.997.997 0 0 1-1.375.017c-1.924-1.8-3.709-3.567-5.573-5.428a.999.999 0 0 1 1.414-1.415l4.95 4.95Z"
        fill="currentColor"
      />
    </svg>
  );
}

const PANEL_WIDTH = 240;

function FieldTypeGroupList({
  groups,
  selectedType,
  onSelect,
}: {
  groups: FieldTypeGroupDef[];
  selectedType: BaseFieldType;
  onSelect: (type: BaseFieldType) => void;
}) {
  return (
    <>
      {groups.map(group => (
        <div key={group.id} className="base-b-field-options-list__wrapper">
          <div className="base-b-field-options-list__group">
            <span>{group.label}</span>
          </div>
          {group.options.map(option => {
            const selected = option.type === selectedType;
            return (
              <button
                key={option.type}
                type="button"
                role="option"
                aria-selected={selected}
                className={`base-b-field-option-list__item${selected ? ' selected' : ''}`}
                onClick={() => onSelect(option.type)}
              >
                <span className="base-b-field-option-icon" aria-hidden>{fieldTypeGlyph(option.type, 16)}</span>
                <span className="base-b-field-option-text">{option.label}</span>
                {option.isNew && (
                  <span className="base-b-field-option-badge" aria-label="新功能">New</span>
                )}
                {selected && (
                  <span className="base-b-field-option-selected-icon" aria-hidden><GlyphDone size={16} /></span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </>
  );
}

export function BitableFieldTypePicker({
  anchorRef,
  open,
  selectedType,
  onClose,
  onSelect,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  selectedType: BaseFieldType;
  onClose: () => void;
  onSelect: (type: BaseFieldType) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const position = useAnchoredFloatingPosition(anchorRef, panelRef, open, {
    placement: 'right-start',
    fallbackWidth: PANEL_WIDTH,
    fallbackHeight: 480,
    pad: 12,
    gap: 4,
    minMaxHeight: 160,
  });
  const filteredGroups = filterFieldTypeGroups(query);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    searchRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    const onMouseDown = (event: globalThis.MouseEvent) => {
      if (!(event.target instanceof Node)) return;
      if (panelRef.current?.contains(event.target)) return;
      if (anchorRef.current?.contains(event.target)) return;
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [anchorRef, onClose, open]);

  if (!open) return null;

  return createPortal(
    <div
      ref={panelRef}
      className="base-b-field-type-picker-portal"
      style={{ top: position.top, left: position.left, visibility: position.visibility }}
      data-floating-panel="true"
      data-no-marquee-selection="true"
      role="presentation"
      onMouseDown={event => event.stopPropagation()}
    >
      <div className="base-b-field-option-panel">
        <div className="base-b-field-option-search">
          <span className="base-b-field-option-search__prefix" aria-hidden><GlyphSearch /></span>
          <input
            ref={searchRef}
            className="base-b-field-option-search__input"
            type="text"
            placeholder="搜索"
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
          {query && (
            <button
              type="button"
              className="base-b-field-option-search__clear"
              aria-label="清除搜索"
              onClick={() => {
                setQuery('');
                searchRef.current?.focus();
              }}
            >
              <GlyphClear />
            </button>
          )}
        </div>
        <div className="base-b-field-options">
          <div className="base-b-field-option-list" style={{ maxHeight: position.maxHeight - 48 }}>
            {filteredGroups.length ? (
              <FieldTypeGroupList groups={filteredGroups} selectedType={selectedType} onSelect={onSelect} />
            ) : (
              <div className="base-b-field-option-empty">无匹配字段类型</div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
