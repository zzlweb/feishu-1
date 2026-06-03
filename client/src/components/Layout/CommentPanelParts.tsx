import type { ReactNode, RefObject } from 'react';

interface CommentPanelShellProps {
  id: string;
  active?: boolean;
  type?: string;
  children: ReactNode;
}

interface CommentRailProps {
  title: string;
  className?: string;
  panelsClassName?: string;
  panelsRef?: RefObject<HTMLDivElement>;
  onClose: () => void;
  children: ReactNode;
}

interface CommentPanelHeaderProps {
  quoteLabel: string;
  title?: string;
  onQuoteClick?: () => void;
  controls?: ReactNode;
}

interface CommentPanelReplyProps {
  id?: string;
  author: string;
  time?: string;
  content?: string;
  resolved?: boolean;
  actions?: ReactNode;
  children?: ReactNode;
}

interface CommentPanelComposerProps {
  open: boolean;
  value: string;
  placeholder?: string;
  idlePlaceholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  onOpen: () => void;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  onAttach?: () => void;
}

export const CommentPanelMoreGlyph = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M5.5 11.75a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 0 1 3.5 0Zm8.225 0a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 0 1 3.5 0Zm8.275 0a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 0 1 3.5 0Z" fill="currentColor" />
  </svg>
);

export const CommentPanelImageGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="m10.141 17.988-4.275-.01a.3.3 0 0 1-.212-.512l4.133-4.133a.4.4 0 0 1 .566 0l1.907 1.907 5.057-5.057a.4.4 0 0 1 .683.283V17.7a.3.3 0 0 1-.3.3h-7.476a.301.301 0 0 1-.083-.012ZM4 22c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h16c1.1 0 2 .9 2 2v16c0 1.1-.9 2-2 2H4Zm0-2h16V4H4v16ZM6 6h3v3H6V6Z" fill="currentColor" />
  </svg>
);

export function CommentRail({ title, className = '', panelsClassName = '', panelsRef, onClose, children }: CommentRailProps) {
  return (
    <div className={['comment-sidebar-positioned', className].filter(Boolean).join(' ')} aria-label="评论">
      <div className="comment-sidebar-pos__header">
        <span className="comment-sidebar-pos__header-left">
          <span className="comment-sidebar-pos__title">{title}</span>
        </span>
        <button type="button" className="comment-sidebar-pos__close" onClick={onClose} title="关闭" aria-label="关闭">
          <svg className="comment-sidebar-pos__close-icon" width="1em" height="1em" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="m13.058 6.472 5.637 5.636-5.944 5.943-.835.84a1 1 0 1 0 1.419 1.409l.663-.667 6.818-6.818a1 1 0 0 0 0-1.414l-6.472-6.473-1.012-1.013a1 1 0 0 0-1.416 1.41l1.142 1.147Z" fill="currentColor" />
            <path d="m4.15 6.472 5.637 5.636-5.943 5.943-.836.84A1 1 0 1 0 4.427 20.3l.663-.667 6.818-6.818a1 1 0 0 0 0-1.414L5.436 4.928 4.424 3.915a1 1 0 0 0-1.415 1.41L4.15 6.472Z" fill="currentColor" />
          </svg>
        </button>
      </div>
      <div ref={panelsRef} className={['comment-sidebar-pos__panels', panelsClassName].filter(Boolean).join(' ')}>
        {children}
      </div>
    </div>
  );
}

export function CommentPanelShell({ id, active = false, type = '0', children }: CommentPanelShellProps) {
  return (
    <div className={`comment-panel js-panel-card${active ? ' comment-panel--active' : ''}`} data-id={id} data-comment-type={type}>
      {children}
    </div>
  );
}

export function CommentPanelHeader({ quoteLabel, title, onQuoteClick, controls }: CommentPanelHeaderProps) {
  const interactive = Boolean(onQuoteClick);
  return (
    <div className="comment-panel__header comment-panel__header-v2">
      <div className="comment-panel__header-quote">
        <span
          className="comment-panel__quote-text"
          title={title || quoteLabel}
          onClick={onQuoteClick}
          onKeyDown={event => {
            if (!interactive) return;
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onQuoteClick?.();
            }
          }}
          role={interactive ? 'link' : undefined}
          tabIndex={interactive ? 0 : undefined}
        >
          {quoteLabel}
        </span>
      </div>
      {controls}
    </div>
  );
}

export function CommentPanelReply({
  id,
  author,
  time,
  content,
  resolved = false,
  actions,
  children,
}: CommentPanelReplyProps) {
  return (
    <div className={`comment-panel__reply${resolved ? ' comment-panel__reply--resolved' : ''}`} key={id}>
      <div className="comment-panel__reply-main">
        <div className="comment-panel__avatar" aria-hidden>{author.charAt(0)}</div>
        <div className="comment-panel__reply-main-right">
          <div className="comment-panel__reply-info-row">
            <div className="comment-panel__reply-info-text">
              <span className="comment-panel__reply-info-name">{author}</span>
              {time ? <span className="comment-panel__reply-info-time">{time}</span> : null}
            </div>
            {actions ? <div className="comment-panel__reply-actions">{actions}</div> : null}
          </div>
          {children || <div className="comment-panel__reply-content">{content}</div>}
        </div>
      </div>
    </div>
  );
}

export function CommentPanelComposer({
  open,
  value,
  placeholder = '回复',
  idlePlaceholder = '回复',
  disabled = false,
  autoFocus = false,
  submitLabel = '回复',
  cancelLabel = '取消',
  onOpen,
  onChange,
  onSubmit,
  onCancel,
  onAttach,
}: CommentPanelComposerProps) {
  const submit = () => {
    if (!value.trim() || disabled) return;
    onSubmit();
  };

  return (
    <div className="comment-panel__textarea card-panel-textarea">
      {open ? (
        <div className="comment-panel__textarea-inner">
          <div className="comment-panel__textarea-main-wrapper">
            <div className="comment-panel__textarea-main">
              <textarea
                className="comment-panel__textarea-editor"
                value={value}
                placeholder={placeholder}
                rows={1}
                autoFocus={autoFocus}
                disabled={disabled}
                onChange={event => onChange(event.target.value)}
                onInput={event => {
                  const ta = event.currentTarget;
                  ta.style.height = 'auto';
                  ta.style.height = `${Math.min(Math.max(ta.scrollHeight, 32), 120)}px`;
                }}
                onKeyDown={event => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    submit();
                    return;
                  }
                  if (event.key === 'Escape') onCancel?.();
                }}
              />
              <div className="comment-panel__textarea-operation">
                <div className="comment-panel__textarea-operation-inner">
                  <div className="comment-panel__textarea-image-select">
                    <span className="comment-panel__textarea-image-icon" aria-hidden>
                      <CommentPanelImageGlyph />
                    </span>
                    <button type="button" tabIndex={-1} className="comment-panel__textarea-file-hitbox" aria-label="插入图片" onClick={onAttach} disabled={disabled} />
                  </div>
                </div>
              </div>
            </div>
          </div>
          {value.trim().length > 0 && (
            <div className="comment-panel__textarea-actions">
              {onCancel ? <button type="button" className="comment-panel__textarea-btn-cancel" onClick={onCancel}>{cancelLabel}</button> : null}
              <button type="button" className="comment-panel__textarea-btn-submit" disabled={disabled} onClick={submit}>{submitLabel}</button>
            </div>
          )}
        </div>
      ) : (
        <div
          className="comment-panel__textarea-inner comment-panel__textarea-inner--idle"
          onClick={onOpen}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onOpen();
            }
          }}
          tabIndex={0}
          aria-label={idlePlaceholder}
        >
          <div className="comment-panel__textarea-main-wrapper">
            <div className="comment-panel__textarea-main comment-panel__textarea-main--idle">
              <span className="comment-panel__textarea-placeholder">{idlePlaceholder}</span>
              <div className="comment-panel__textarea-operation">
                <div className="comment-panel__textarea-operation-inner">
                  <div className="comment-panel__textarea-image-select">
                    <span className="comment-panel__textarea-image-icon" aria-hidden>
                      <CommentPanelImageGlyph />
                    </span>
                    <button type="button" tabIndex={-1} className="comment-panel__textarea-file-hitbox" aria-label="插入图片" onClick={event => { event.stopPropagation(); onOpen(); }} disabled={disabled} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
