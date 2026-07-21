import { useEffect, useRef, useState } from 'react';
import { TABLE_GRID_MAX } from './tableInsert';
import './TableGridPicker.less';

interface Props {
  onPick: (rows: number, cols: number) => void;
}

const GRID_CELLS = Array.from({ length: TABLE_GRID_MAX * TABLE_GRID_MAX }, (_, i) => ({
  row: Math.floor(i / TABLE_GRID_MAX) + 1,
  col: (i % TABLE_GRID_MAX) + 1,
}));

export default function TableGridPicker({ onPick }: Props) {
  const [hover, setHover] = useState({ rows: 1, cols: 1 });
  const pickingRef = useRef(false);

  const handlePick = (row: number, col: number) => {
    if (pickingRef.current) return;
    pickingRef.current = true;
    queueMicrotask(() => {
      try {
        onPick(row, col);
      } finally {
        pickingRef.current = false;
      }
    });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Enter') {
        handlePick(hover.rows, hover.cols);
        return;
      }
      setHover(current => ({
        rows: Math.max(1, Math.min(TABLE_GRID_MAX, current.rows + (event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0))),
        cols: Math.max(1, Math.min(TABLE_GRID_MAX, current.cols + (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0))),
      }));
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [hover.cols, hover.rows]);

  return (
    <div className="table-grid-picker">
      <div className="table-grid-picker__head">
        <span className="table-grid-picker__title">插入支持富文本的表格</span>
      </div>
      <div
        className="table-grid-picker__grid"
        role="grid"
        aria-label={`表格大小 ${hover.rows} 行 ${hover.cols} 列`}
      >
        {GRID_CELLS.map(({ row, col }) => {
          const isActive = hover.rows > 0 && hover.cols > 0 && row <= hover.rows && col <= hover.cols;
          return (
            <button
              key={`${row}-${col}`}
              type="button"
              className={`table-grid-picker__cell${isActive ? ' is-active' : ''}`}
              aria-label={`${col} 列 ${row} 行`}
              tabIndex={-1}
              onMouseEnter={() => setHover({ rows: row, cols: col })}
              onMouseDown={e => {
                e.preventDefault();
                e.stopPropagation();
                handlePick(row, col);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
