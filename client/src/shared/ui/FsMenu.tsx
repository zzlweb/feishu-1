import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';

export const FsMenu = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function FsMenu({
  className = '',
  children,
  ...props
}, ref) {
  return <div {...props} ref={ref} role="menu" className={`fs-menu ${className}`.trim()}>{children}</div>;
});

export interface FsMenuItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  shortcut?: string;
  danger?: boolean;
}

export const FsMenuItem = forwardRef<HTMLButtonElement, FsMenuItemProps>(function FsMenuItem({
  icon,
  shortcut,
  danger = false,
  children,
  className = '',
  ...props
}, ref) {
  return (
    <button
      {...props}
      ref={ref}
      type={props.type ?? 'button'}
      role="menuitem"
      className={`fs-menu-item${danger ? ' fs-menu-item--danger' : ''} ${className}`.trim()}
    >
      {icon && <span className="fs-menu-item__icon" aria-hidden>{icon}</span>}
      <span className="fs-menu-item__label">{children}</span>
      {shortcut && <kbd className="fs-menu-item__shortcut">{shortcut}</kbd>}
    </button>
  );
});

