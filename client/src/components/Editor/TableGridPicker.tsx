import { useRef, useState } from 'react';
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
  const [hover, setHover] = useState({ rows: 0, cols: 0 });
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

  return (
    <div className="table-grid-picker">
      <div className="table-grid-picker__head">
        <span className="table-grid-picker__title">插入支持富文本的表格</span>
      </div>
      <div
        className="table-grid-picker__grid"
        onMouseLeave={() => setHover({ rows: 0, cols: 0 })}
      >
        {GRID_CELLS.map(({ row, col }) => {
          const isActive = hover.rows > 0 && hover.cols > 0 && row <= hover.rows && col <= hover.cols;
          return (
            <button
              key={`${row}-${col}`}
              type="button"
              className={`table-grid-picker__cell${isActive ? ' is-active' : ''}`}
              aria-label={`${col} 列 ${row} 行`}
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
