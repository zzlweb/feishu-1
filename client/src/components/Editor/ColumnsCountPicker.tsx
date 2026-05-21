import { useState } from 'react';
import { MAX_COLUMNS, MIN_COLUMNS } from './columnsHelpers';
import './ColumnsCountPicker.less';

interface Props {
  onPick: (columnCount: number) => void;
}

/** 飞书分栏选择器固定展示 5 根栏条，对应 1～5 栏 */
const PICKER_BAR_COUNT = MAX_COLUMNS;
const DEFAULT_COUNT = 3;

export default function ColumnsCountPicker({ onPick }: Props) {
  const [hoverCount, setHoverCount] = useState(0);
  const displayCount = hoverCount || DEFAULT_COUNT;

  const handlePick = (count: number) => {
    const picked = hoverCount || count;
    onPick(Math.max(MIN_COLUMNS, Math.min(MAX_COLUMNS, picked)));
  };

  return (
    <div className="columns-count-picker">
      <div className="columns-count-picker__head">
        <span className="columns-count-picker__title">选择栏数</span>
        <span className="columns-count-picker__size">{displayCount}</span>
      </div>
      <div
        className="columns-count-picker__bars"
        onMouseLeave={() => setHoverCount(0)}
      >
        {Array.from({ length: PICKER_BAR_COUNT }, (_, index) => {
          const count = index + 1;
          const isActive = count <= displayCount;
          return (
            <button
              key={count}
              type="button"
              className={`columns-count-picker__bar${isActive ? ' is-active' : ''}`}
              aria-label={`${count} 栏`}
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
