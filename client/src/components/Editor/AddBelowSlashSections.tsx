import { Fragment, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { IconChevronMenuEnd } from '../../icons/feishuDoc';
import { SLASH_SECTIONS, type SlashMenuItem } from './slashMenuConfig';
import TableGridPicker from './TableGridPicker';
import ColumnsCountPicker from './ColumnsCountPicker';
import TemplatePicker from './TemplatePicker';
import ButtonTypePicker from './ButtonTypePicker';
import { computeSubmenuFlyoutPosition } from './contextSubmenuFlyout';
import type { Template } from '../../types';
import type { ButtonActionType } from './slashMenuConfig';

const GRID_STROKE = 1.65;
const LIST_STROKE = 1.55;

interface Props {
  onPickItem: (sectionTitle: string, item: SlashMenuItem) => void;
  onPickTable: (rows: number, cols: number) => void;
  onPickColumns: (columnCount: number) => void;
  onPickTemplate?: (template: Template) => void;
  onPickButton?: (type: ButtonActionType) => void;
}

export default function AddBelowSlashSections({
  onPickItem,
  onPickTable,
  onPickColumns,
  onPickTemplate,
  onPickButton,
}: Props) {
  const [activeSubmenu, setActiveSubmenu] = useState<{
    kind: 'tableGrid' | 'columnsCount' | 'templateList' | 'buttonType';
    rect: DOMRect;
  } | null>(null);

  const openSubmenu = (kind: 'tableGrid' | 'columnsCount' | 'templateList' | 'buttonType', el: HTMLElement) => {
    setActiveSubmenu({ kind, rect: el.getBoundingClientRect() });
  };

  const submenuPosition = activeSubmenu
    ? computeSubmenuFlyoutPosition({
        trigger: activeSubmenu.rect,
        panelWidth: activeSubmenu.kind === 'tableGrid' ? 304 : activeSubmenu.kind === 'columnsCount' ? 184 : activeSubmenu.kind === 'buttonType' ? 230 : 264,
        panelHeight: activeSubmenu.kind === 'tableGrid' ? 334 : activeSubmenu.kind === 'columnsCount' ? 164 : activeSubmenu.kind === 'buttonType' ? 144 : 340,
        gap: 8,
        pad: 8,
      })
    : null;

  const handlePickTable = (rows: number, cols: number) => {
    setActiveSubmenu(null);
    queueMicrotask(() => onPickTable(rows, cols));
  };

  const handlePickColumns = (columnCount: number) => {
    setActiveSubmenu(null);
    queueMicrotask(() => onPickColumns(columnCount));
  };

  return (
    <Fragment>
      {SLASH_SECTIONS.map(section => (
        <div
          key={section.title}
          className={`slash-section slash-section--${section.layout}${section.gridMuted ? ' slash-section--grid-muted' : ''}`}
        >
          <div className="slash-section-title">{section.title}</div>
          {section.layout === 'grid' ? (
            <div className="slash-basic-grid">
              {section.items.map(item => {
                const Icon = item.Icon;
                const tint = item.iconColor ?? '#1f2329';
                return (
                  <button
                    key={`${section.title}-${item.label}`}
                    type="button"
                    className="slash-basic-cell"
                    title={item.label}
                    onMouseDown={e => {
                      e.preventDefault();
                      onPickItem(section.title, item);
                    }}
                  >
                    <span className="slash-basic-cell-icon" style={{ '--slash-icon-tint': tint } as CSSProperties}>
                      <Icon size={18} strokeWidth={GRID_STROKE} fill={tint} />
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            section.items.map(item => {
              const Icon = item.Icon;
              const tint = item.iconColor ?? '#1f2329';
              const isTableGrid = item.submenu === 'tableGrid';
              const isColumnsCount = item.submenu === 'columnsCount';
              const isTemplateList = item.submenu === 'templateList';
              const isButtonType = item.submenu === 'buttonType';
              const hasSubmenu = isTableGrid || isColumnsCount || isTemplateList || isButtonType;
              return (
                <div
                  key={`${section.title}-${item.label}`}
                  className={`slash-item${hasSubmenu ? ' slash-item--has-submenu' : ''}`}
                  role="button"
                  tabIndex={0}
                  title={item.label}
                  onMouseEnter={e => {
                    if (isTableGrid) openSubmenu('tableGrid', e.currentTarget);
                    else if (isColumnsCount) openSubmenu('columnsCount', e.currentTarget);
                    else if (isTemplateList) openSubmenu('templateList', e.currentTarget);
                    else if (isButtonType) openSubmenu('buttonType', e.currentTarget);
                    else setActiveSubmenu(null);
                  }}
                  onMouseDown={e => {
                    e.preventDefault();
                    if (!hasSubmenu) onPickItem(section.title, item);
                  }}
                >
                  <span className="slash-icon-wrap" style={{ '--slash-icon-tint': tint } as CSSProperties}>
                    <Icon size={18} strokeWidth={LIST_STROKE} fill={tint} />
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
      {activeSubmenu && submenuPosition && createPortal(
        <div
          className="slash-submenu-portal"
          style={{
            position: 'fixed',
            left: submenuPosition.left,
            top: submenuPosition.top,
            zIndex: 10080,
          }}
          onMouseDown={e => e.preventDefault()}
        >
          {activeSubmenu.kind === 'tableGrid' ? (
            <div className="slash-table-grid-flyout is-portal">
              <TableGridPicker onPick={handlePickTable} />
            </div>
          ) : activeSubmenu.kind === 'columnsCount' ? (
            <div className="slash-columns-count-flyout is-portal">
              <ColumnsCountPicker onPick={handlePickColumns} />
            </div>
          ) : activeSubmenu.kind === 'templateList' ? (
            <div className="slash-template-flyout is-portal">
              <TemplatePicker
                onPick={template => {
                  onPickTemplate?.(template);
                }}
              />
            </div>
          ) : (
            <div className="slash-button-type-flyout is-portal">
              <ButtonTypePicker
                onPickType={type => onPickButton?.(type)}
                onPick={() => setActiveSubmenu(null)}
              />
            </div>
          )}
        </div>,
        document.body,
      )}
    </Fragment>
  );
}
