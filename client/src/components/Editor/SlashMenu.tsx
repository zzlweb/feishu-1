import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Editor } from '@tiptap/react';
import { IconChevronMenuEnd } from '../../icons/feishuDoc';
import { SLASH_SECTIONS, itemMatchesQuery } from './slashMenuConfig';
import './SlashMenu.less';

interface Props {
  editor: Editor;
  position: { top: number; left: number };
  query: string;
  onClose: () => void;
  onBeforeSelect?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  /** fixed：跟随输入 `/` 时的视口坐标；anchored：作为加号子元素，在触发器下方展开 */
  variant?: 'fixed' | 'anchored';
}

export default function SlashMenu({ editor, position, query, onClose, onBeforeSelect, onMouseEnter, onMouseLeave, variant = 'fixed' }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const filteredSections = SLASH_SECTIONS.map(s => ({
    ...s,
    items: s.items.filter(item => itemMatchesQuery(item, query)),
  })).filter(s => s.items.length > 0);

  const allItems = filteredSections.flatMap(s => s.items);

  useEffect(() => {
    if (allItems.length === 0) {
      onClose();
    }
  }, [allItems.length, onClose]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  useEffect(() => {
    if (menuRef.current) {
      const active = menuRef.current.querySelector('.slash-item.active, .slash-basic-cell.active') as HTMLElement;
      active?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIdx]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx(i => Math.min(i + 1, Math.max(0, allItems.length - 1)));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onBeforeSelect?.();
        allItems[activeIdx]?.action(editor);
        onClose();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [allItems, activeIdx, editor, onBeforeSelect, onClose]);

  if (allItems.length === 0) {
    return null;
  }

  let globalIdx = 0;

  const gridStroke = 1.65;
  const listStroke = 1.55;

  return (
    <div
      className={`slash-menu slash-menu-feishu ${variant === 'anchored' ? 'slash-menu--anchored' : ''}`}
      ref={menuRef}
      style={variant === 'anchored' ? undefined : { top: position.top, left: position.left }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {filteredSections.map(section => (
        <div
          key={section.title}
          className={`slash-section slash-section--${section.layout}${section.gridMuted ? ' slash-section--grid-muted' : ''}`}
        >
          <div className="slash-section-title">{section.title}</div>
          {section.layout === 'grid' ? (
            <div className="slash-basic-grid">
              {section.items.map(item => {
                const idx = globalIdx++;
                const Icon = item.Icon;
                const tint = item.iconColor ?? '#1f2329';
                return (
                  <button
                    key={`${section.title}-${item.label}`}
                    type="button"
                    className={`slash-basic-cell ${idx === activeIdx ? 'active' : ''}`}
                    title={item.label}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onMouseDown={e => {
                      e.preventDefault();
                      onBeforeSelect?.();
                      item.action(editor);
                      onClose();
                    }}
                  >
                    <span className="slash-basic-cell-icon" style={{ '--slash-icon-tint': tint } as CSSProperties}>
                      <Icon size={18} strokeWidth={gridStroke} fill={tint} />
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            section.items.map(item => {
              const idx = globalIdx++;
              const Icon = item.Icon;
              const tint = item.iconColor ?? '#1f2329';
              return (
                <div
                  key={`${section.title}-${item.label}`}
                  className={`slash-item ${idx === activeIdx ? 'active' : ''}`}
                  role="button"
                  tabIndex={0}
                  title={item.label}
                  onMouseEnter={() => setActiveIdx(idx)}
                  onMouseDown={e => {
                    e.preventDefault();
                    onBeforeSelect?.();
                    item.action(editor);
                    onClose();
                  }}
                >
                  <span className="slash-icon-wrap" style={{ '--slash-icon-tint': tint } as CSSProperties}>
                    <Icon size={18} strokeWidth={listStroke} fill={tint} />
                  </span>
                  <span className="slash-label">{item.label}</span>
                  {item.hasArrow && (
                    <span className="slash-arrow" aria-hidden>
                      <IconChevronMenuEnd size={14} color="#8f959e" />
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      ))}
    </div>
  );
}
