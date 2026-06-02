import type { CSSProperties } from 'react';
import { useBitablePortalTooltip } from './BitableViewShared';

export function BitableGridCellExpand({
  style,
  onOpen,
}: {
  style: CSSProperties;
  onOpen: () => void;
}) {
  const { bind, renderTip } = useBitablePortalTooltip();
  return (
    <>
      <button
        {...bind}
        type="button"
        className="base-grid-cell-expand"
        style={style}
        aria-label="弹窗打开"
        onMouseDown={event => event.stopPropagation()}
        onClick={event => {
          event.stopPropagation();
          onOpen();
        }}
      >
        <span className="base-record-view-icon" aria-hidden />
      </button>
      {renderTip('弹窗打开')}
    </>
  );
}
