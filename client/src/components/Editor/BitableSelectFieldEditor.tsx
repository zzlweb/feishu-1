import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { BaseFieldType, SelectChoice } from './bitableModel';
import { useAnchoredFloatingPosition } from './floatingPanel';

export const SELECT_OPTION_COLORS = [
  '#dee8ff',
  '#f8e6c2',
  '#c7effb',
  '#fddbd5',
  '#d9f5e3',
  '#ede2fe',
  '#fff3cd',
  '#e8eaed',
  '#ffcfc9',
  '#b7eb8f',
];

export function createSelectChoice(colorIndex = 0): SelectChoice {
  const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return {
    id: `opt_${stamp}`,
    name: '',
    color: SELECT_OPTION_COLORS[colorIndex % SELECT_OPTION_COLORS.length],
  };
}

function GlyphAdd({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 2a1 1 0 0 0-1 1v8H3a1 1 0 1 0 0 2h8v8a1 1 0 1 0 2 0v-8h8a1 1 0 1 0 0-2h-8V3a1 1 0 0 0-1-1Z" fill="currentColor" />
    </svg>
  );
}

function GlyphDrag({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8.25 6.5a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5Zm0 7.25a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5Zm1.75 5.5a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 0 1 3.5 0ZM14.753 6.5a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5ZM16.5 12a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 0 1 3.5 0Zm-1.747 9a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function GlyphClose({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5.636 5.636a1 1 0 0 0 0 1.414l4.95 4.95-4.95 4.95a1 1 0 1 0 1.414 1.414l4.95-4.95 4.95 4.95a1 1 0 0 0 1.414-1.414L13.414 12l4.95-4.95a1 1 0 0 0-1.415-1.414L12 10.586l-4.95-4.95a1 1 0 0 0-1.413 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

function GlyphChevronDown({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m3.414 7.086-.707.707a1 1 0 0 0 0 1.414l7.778 7.778a2 2 0 0 0 2.829 0l7.778-7.778a1 1 0 0 0 0-1.414l-.707-.707a1 1 0 0 0-1.415 0l-7.07 7.07-7.072-7.07a1 1 0 0 0-1.414 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

function GlyphHelp({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 2C5.925 23 1 18.075 1 12S5.925 1 12 1s11 4.925 11 11-4.925 11-11 11Zm-1-6a1 1 0 1 1 2 0 1 1 0 0 1-2 0ZM8.05 9.282a5.17 5.17 0 0 1 .039-.28c.195-1.085.689-1.883 1.481-2.394.62-.405 1.383-.608 2.288-.608 1.189 0 2.176.288 2.962.864.787.575 1.18 1.428 1.18 2.558 0 .693-.17 1.277-.513 1.752-.2.287-.584.655-1.152 1.103l-.56.44c-.305.24-.507.52-.607.84a2.742 2.742 0 0 0-.072.486.5.5 0 0 1-.498.457h-1.12a.5.5 0 0 1-.498-.546c.065-.696.134-1.136.207-1.321.137-.344.49-.74 1.058-1.188l.575-.455c.19-.144 1.166-.831 1.166-1.44 0-.608-.106-.832-.412-1.166-.305-.333-.993-.44-1.613-.44-.61 0-1.132.161-1.387.572-.118.19-.215.393-.284.6a2.097 2.097 0 0 0-.073.307.5.5 0 0 1-.493.415H8.547a.5.5 0 0 1-.497-.556Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ColorPicker({
  color,
  onChange,
}: {
  color: string;
  onChange: (color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const position = useAnchoredFloatingPosition(anchorRef, panelRef, open, {
    placement: 'bottom-start',
    fallbackWidth: 160,
    fallbackHeight: 48,
    pad: 8,
    gap: 4,
  });

  useEffect(() => {
    if (!open) return;
    const close = (event: globalThis.MouseEvent) => {
      if (!(event.target instanceof Node)) return;
      if (panelRef.current?.contains(event.target)) return;
      if (anchorRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="base-b-select-option-color"
        style={{ backgroundColor: color }}
        aria-label="选择颜色"
        onClick={() => setOpen(value => !value)}
      >
        <span className="base-b-select-option-color__icon" aria-hidden><GlyphChevronDown size={10} /></span>
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          className="base-b-select-color-panel"
          style={{
            top: position.top,
            left: position.left,
            visibility: position.visibility,
          }}
          data-floating-panel="true"
          onMouseDown={event => event.stopPropagation()}
        >
          {SELECT_OPTION_COLORS.map(item => (
            <button
              key={item}
              type="button"
              className={`base-b-select-color-swatch${item === color ? ' is-active' : ''}`}
              style={{ backgroundColor: item }}
              aria-label={`颜色 ${item}`}
              onClick={() => {
                onChange(item);
                setOpen(false);
              }}
            />
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

export function BitableSelectOptionsEditor({
  choices,
  onChange,
}: {
  choices: SelectChoice[];
  onChange: (choices: SelectChoice[]) => void;
}) {
  const focusIdRef = useRef<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const dragIndexRef = useRef<number | null>(null);

  useEffect(() => {
    if (!focusIdRef.current) return;
    inputRefs.current[focusIdRef.current]?.focus();
    focusIdRef.current = null;
  }, [choices.length]);

  const addChoice = () => {
    const next = createSelectChoice(choices.length);
    focusIdRef.current = next.id;
    onChange([...choices, next]);
  };

  const updateChoice = (id: string, patch: Partial<SelectChoice>) => {
    onChange(choices.map(choice => (choice.id === id ? { ...choice, ...patch } : choice)));
  };

  const removeChoice = (id: string) => {
    onChange(choices.filter(choice => choice.id !== id));
  };

  const moveChoice = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= choices.length || to >= choices.length) return;
    const next = [...choices];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div className="base-b-select-options">
      <div className="base-b-select-options__header">
        <span className="base-b-select-options__title">选项内容</span>
        <label className="base-b-select-options__ref">
          <input
            type="checkbox"
            onChange={() => window.alert('引用选项功能即将推出。')}
          />
          <span>引用选项</span>
          <span className="base-b-select-options__ref-help" title="引用其他表的选项" aria-hidden><GlyphHelp /></span>
        </label>
      </div>
      <div className="base-b-select-options__editor">
        <div className={`base-b-select-options__add-row${choices.length ? ' has-items' : ''}`}>
          <button
            type="button"
            className="base-b-select-options__add"
            onClick={addChoice}
          >
            <GlyphAdd />
            <span>添加选项</span>
          </button>
        </div>
        {choices.length > 0 && (
          <ul className="base-b-select-options__list">
            {choices.map((choice, index) => (
              <li
                key={choice.id}
                className="base-b-select-options__item"
                draggable
                onDragStart={() => { dragIndexRef.current = index; }}
                onDragOver={event => event.preventDefault()}
                onDrop={() => {
                  if (dragIndexRef.current == null) return;
                  moveChoice(dragIndexRef.current, index);
                  dragIndexRef.current = null;
                }}
                onDragEnd={() => { dragIndexRef.current = null; }}
              >
                <span className="base-b-select-options__drag" aria-hidden><GlyphDrag /></span>
                <ColorPicker color={choice.color} onChange={color => updateChoice(choice.id, { color })} />
                <input
                  ref={node => { inputRefs.current[choice.id] = node; }}
                  className="base-b-select-options__input"
                  type="text"
                  maxLength={1000}
                  placeholder="请输入选项"
                  value={choice.name}
                  onChange={event => updateChoice(choice.id, { name: event.target.value })}
                />
                <button
                  type="button"
                  className="base-b-select-options__remove"
                  aria-label="删除选项"
                  onClick={() => removeChoice(choice.id)}
                >
                  <GlyphClose />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function BitableSelectDefaultPicker({
  fieldType,
  choices,
  value,
  onChange,
}: {
  fieldType: BaseFieldType;
  choices: SelectChoice[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const position = useAnchoredFloatingPosition(triggerRef, panelRef, open, {
    placement: 'bottom-start',
    fallbackWidth: 296,
    fallbackHeight: 228,
    matchAnchorWidth: true,
    pad: 8,
    gap: 4,
    minMaxHeight: 120,
  });

  const namedChoices = choices.filter(choice => choice.name.trim());
  const filtered = namedChoices.filter(choice => choice.name.toLowerCase().includes(query.trim().toLowerCase()));
  const isMulti = fieldType === 'multi_select';
  const selectedNames = isMulti
    ? (Array.isArray(value) ? value : value ? [value] : [])
    : (typeof value === 'string' && value ? [value] : []);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const onMouseDown = (event: globalThis.MouseEvent) => {
      if (!(event.target instanceof Node)) return;
      if (panelRef.current?.contains(event.target)) return;
      if (triggerRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  const displayText = () => {
    if (!selectedNames.length) return '请选择选项';
    if (isMulti) return selectedNames.join('、');
    return selectedNames[0];
  };

  const toggleOption = (name: string) => {
    if (isMulti) {
      const next = selectedNames.includes(name)
        ? selectedNames.filter(item => item !== name)
        : [...selectedNames, name];
      onChange(next);
      return;
    }
    onChange(name);
    setOpen(false);
  };

  return (
    <div className="base-b-select-default">
      <div className="base-b-select-default__label">
        <span>默认值</span>
        <span className="base-b-field-label__info" title="新建记录时自动填入" aria-hidden>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 2C5.925 23 1 18.075 1 12S5.925 1 12 1s11 4.925 11 11-4.925 11-11 11Zm-1-7.5v-4a1 1 0 1 1 0-2h1.004c.55 0 .998.445.998.996.003 1.668-.002 3.336-.002 5.004h.5a1 1 0 1 1 0 2h-3a1 1 0 1 1 0-2h.5Zm1-7a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"
              fill="currentColor"
            />
          </svg>
        </span>
      </div>
      <button
        ref={triggerRef}
        type="button"
        className={`base-b-select-default__trigger${open ? ' is-open' : ''}`}
        onClick={() => setOpen(value => !value)}
      >
        <span className={selectedNames.length ? '' : 'base-b-select-default__placeholder'}>{displayText()}</span>
        <span className="base-b-select-default__arrow" aria-hidden><GlyphChevronDown /></span>
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          className="base-b-select-default-panel"
          style={{ top: position.top, left: position.left, width: position.width, maxHeight: position.maxHeight, visibility: position.visibility }}
          data-floating-panel="true"
          onMouseDown={event => event.stopPropagation()}
        >
          <input
            className="base-b-select-default-panel__search"
            type="text"
            placeholder="查找选项"
            maxLength={1000}
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
          <div className="base-b-select-default-panel__list">
            {filtered.length ? filtered.map(choice => {
              const selected = selectedNames.includes(choice.name);
              return (
                <button
                  key={choice.id}
                  type="button"
                  className={`base-b-select-default-panel__item${selected ? ' is-selected' : ''}`}
                  onClick={() => toggleOption(choice.name)}
                >
                  <span className="base-b-select-default-panel__dot" style={{ backgroundColor: choice.color }} />
                  <span className="base-b-select-default-panel__text">{choice.name}</span>
                  {selected && <span className="base-b-select-default-panel__check">✓</span>}
                </button>
              );
            }) : (
              <div className="base-b-select-default-panel__empty">没有选项</div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
