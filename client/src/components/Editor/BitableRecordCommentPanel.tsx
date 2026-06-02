import { useEffect, useRef, useState } from 'react';
import { DEFAULT_RECORD_OPERATOR, formatHistoryTime, type BaseRecord, type RecordComment } from './bitableModel';

export interface BitableRecordCommentPanelProps {
  record: BaseRecord;
  recordIndex: number;
  locked?: boolean;
  onClose: () => void;
  onSubmit: (content: string) => void;
}

const GlyphMore = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M5.5 11.75a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 0 1 3.5 0Zm8.225 0a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 0 1 3.5 0Zm8.275 0a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 0 1 3.5 0Z" fill="currentColor" />
  </svg>
);

const GlyphImage = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" aria-hidden>
    <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="9" cy="10" r="1.5" fill="currentColor" />
    <path d="M6 17l4.5-4.5 3 3L18 11l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function CommentItem({ comment }: { comment: RecordComment }) {
  return (
    <article className="bitable-record-comment-item">
      <div className="bitable-record-comment-item__avatar" aria-hidden>
        {comment.author.slice(0, 1)}
      </div>
      <div className="bitable-record-comment-item__body">
        <div className="bitable-record-comment-item__meta">
          <strong>{comment.author}</strong>
          <span>{formatHistoryTime(comment.createdAt)}</span>
        </div>
        <p>{comment.content}</p>
      </div>
    </article>
  );
}

export function BitableRecordCommentPanel({
  record,
  recordIndex,
  locked = false,
  onClose,
  onSubmit,
}: BitableRecordCommentPanelProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState('');
  const comments = record.comments ?? [];

  useEffect(() => {
    setDraft('');
    inputRef.current?.focus();
  }, [record.id]);

  const submit = () => {
    const content = draft.trim();
    if (!content || locked) return;
    onSubmit(content);
    setDraft('');
    inputRef.current?.focus();
  };

  return (
    <aside className="bitable-record-comment-panel" data-no-marquee-selection="true" data-floating-panel="true">
      <header className="bitable-record-comment-panel__header">
        <strong>记录 {recordIndex + 1}</strong>
        <button type="button" className="bitable-record-comment-panel__more" aria-label="更多">
          <GlyphMore />
        </button>
      </header>

      <div className="bitable-record-comment-panel__body">
        {comments.length ? (
          <div className="bitable-record-comment-panel__list">
            {comments.map(comment => (
              <CommentItem key={comment.id} comment={comment} />
            ))}
          </div>
        ) : (
          <div className="bitable-record-comment-panel__empty">
            <div className="bitable-record-comment-panel__composer-preview">
              <div className="bitable-record-comment-item__avatar" aria-hidden>
                {DEFAULT_RECORD_OPERATOR.slice(0, 1)}
              </div>
              <span>{DEFAULT_RECORD_OPERATOR}</span>
            </div>
          </div>
        )}
      </div>

      <footer className="bitable-record-comment-panel__footer">
        <div className="bitable-record-comment-panel__input-wrap">
          <textarea
            ref={inputRef}
            className="bitable-record-comment-panel__input"
            value={draft}
            disabled={locked}
            placeholder="输入评论"
            rows={1}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
          />
          <button type="button" className="bitable-record-comment-panel__attach" aria-label="添加图片" disabled={locked}>
            <GlyphImage />
          </button>
        </div>
        {draft.trim() ? (
          <button
            type="button"
            className="bitable-record-comment-panel__submit"
            disabled={locked}
            onClick={submit}
          >
            发送
          </button>
        ) : null}
      </footer>
    </aside>
  );
}
