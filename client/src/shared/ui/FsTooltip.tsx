import type { ReactNode } from 'react';

export function FsTooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="fs-tooltip" data-tooltip={label}>
      {children}
    </span>
  );
}

