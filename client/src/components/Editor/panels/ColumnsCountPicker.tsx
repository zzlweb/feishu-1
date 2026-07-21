import { useEffect, useState } from 'react';
import { MAX_COLUMNS_PICKER, MIN_COLUMNS } from '../blocks/columnsHelpers';
import './ColumnsCountPicker.less';

interface Props {
  onPick: (columnCount: number) => void;
}

const PICKER_BAR_COUNT = MAX_COLUMNS_PICKER;

export default function ColumnsCountPicker({ onPick }: Props) {
  const [hoverCount, setHoverCount] = useState(MIN_COLUMNS);

  const handlePick = (count: number) => {
    const picked = hoverCount || count;
    onPick(Math.max(MIN_COLUMNS, Math.min(MAX_COLUMNS_PICKER, picked)));
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Enter') {
        handlePick(hoverCount);
        return;
      }
      const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
      setHoverCount(current => Math.max(MIN_COLUMNS, Math.min(MAX_COLUMNS_PICKER, current + delta)));
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [hoverCount]);

  return (
    <div className="columns-count-picker">
      <div className="columns-count-picker__head">
        <span className="columns-count-picker__title">选择栏数</span>
        <span className="columns-count-picker__size">{hoverCount}</span>
      </div>
      <div className="columns-count-picker__bars" role="listbox" aria-label={`选择栏数，当前 ${hoverCount} 栏`}>
        {Array.from({ length: PICKER_BAR_COUNT }, (_, index) => {
          const count = index + 1;
          const isActive = hoverCount > 0 && count <= hoverCount;
          return (
            <button
              key={count}
              type="button"
              className={`columns-count-picker__bar${isActive ? ' is-active' : ''}`}
              aria-label={`${count} 栏`}
              aria-selected={count === hoverCount}
              tabIndex={-1}
              onMouseEnter={() => setHoverCount(count)}
              onMouseDown={e => {
                e.preventDefault();
                e.stopPropagation();
                handlePick(count);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
