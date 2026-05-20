import { useState } from 'react';
import { TABLE_GRID_MAX } from './tableInsert';
import './TableGridPicker.less';

interface Props {
  onPick: (rows: number, cols: number) => void;
}

const GRID_CELLS = Array.from({ length: TABLE_GRID_MAX * TABLE_GRID_MAX }, (_, i) => ({
  row: Math.floor(i / TABLE_GRID_MAX) + 1,
  col: (i % TABLE_GRID_MAX) + 1,
}));

/** 默认提示尺寸：未 hover 时把初始指引设为 3x3，避免误点 (1,1) 得到极小表格 */
const DEFAULT_PICK_ROWS = 3;
const DEFAULT_PICK_COLS = 3;

export default function TableGridPicker({ onPick }: Props) {
  const [hover, setHover] = useState({ rows: 0, cols: 0 });

  const displayRows = hover.rows || DEFAULT_PICK_ROWS;
  const displayCols = hover.cols || DEFAULT_PICK_COLS;

  const handlePick = (row: number, col: number) => {
    // 若用户未 hover 任何格子就直接 mouseDown（极少见），按默认 3x3 插入
    const finalRow = hover.rows ? row : Math.max(row, DEFAULT_PICK_ROWS);
    const finalCol = hover.cols ? col : Math.max(col, DEFAULT_PICK_COLS);
    onPick(finalRow, finalCol);
  };

  return (
    <div className="table-grid-picker">
      <div className="table-grid-picker__head">
        <span className="table-grid-picker__title">插入支持富文本的表格</span>
        {displayRows > 0 && displayCols > 0 && (
          <span className="table-grid-picker__size">
            {displayCols} × {displayRows}
          </span>
        )}
      </div>
      <div
        className="table-grid-picker__grid"
        onMouseLeave={() => setHover({ rows: 0, cols: 0 })}
      >
        {GRID_CELLS.map(({ row, col }) => {
          const isActive = row <= hover.rows && col <= hover.cols;
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
