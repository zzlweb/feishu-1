import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

export interface FsButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'text' | 'danger';
  size?: 'small' | 'medium';
  loading?: boolean;
  icon?: ReactNode;
}

export const FsButton = forwardRef<HTMLButtonElement, FsButtonProps>(function FsButton({
  variant = 'secondary',
  size = 'medium',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}, ref) {
  return (
    <button
      {...props}
      ref={ref}
      type={props.type ?? 'button'}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`fs-button fs-button--${variant} fs-button--${size} ${className}`.trim()}
    >
      {loading ? <span className="fs-button__spinner" aria-hidden /> : icon}
      {children != null && <span className="fs-button__label">{children}</span>}
    </button>
  );
});

export interface FsIconButtonProps extends Omit<FsButtonProps, 'children'> {
  label: string;
  children: ReactNode;
}

export const FsIconButton = forwardRef<HTMLButtonElement, FsIconButtonProps>(function FsIconButton({
  label,
  children,
  className = '',
  ...props
}, ref) {
  return (
    <FsButton
      {...props}
      ref={ref}
      aria-label={label}
      className={`fs-icon-button ${className}`.trim()}
    >
      {children}
    </FsButton>
  );
});

