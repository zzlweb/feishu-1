import { useEffect, useState } from 'react';
import {
  CommentPanelComposer,
  CommentPanelHeader,
  CommentPanelMoreGlyph,
  CommentPanelReply,
  CommentPanelShell,
} from '../Layout/CommentPanelParts';
import { DEFAULT_RECORD_OPERATOR, formatHistoryTime, type BaseRecord, type RecordComment } from './bitableModel';

export interface BitableRecordCommentPanelProps {
  record: BaseRecord;
  recordIndex: number;
  cardTop?: number;
  locked?: boolean;
  onSubmit: (content: string) => void;
}

function CommentItem({ comment }: { comment: RecordComment }) {
  return (
    <CommentPanelReply
      id={comment.id}
      author={comment.author}
      time={formatHistoryTime(comment.createdAt)}
      content={comment.content}
      actions={(
        <button type="button" className="comment-panel__icon-btn" title="更多" aria-label="更多">
          <CommentPanelMoreGlyph />
        </button>
      )}
    />
  );
}

export function BitableRecordCommentPanel({
  record,
  recordIndex,
  cardTop = 0,
  locked = false,
  onSubmit,
}: BitableRecordCommentPanelProps) {
  const [draft, setDraft] = useState('');
  const comments = record.comments ?? [];

  useEffect(() => {
    setDraft('');
  }, [record.id]);

  const submit = () => {
    const content = draft.trim();
    if (!content || locked) return;
    onSubmit(content);
    setDraft('');
  };

  return (
    <div
      className="comment-panel-wrapper bitable-record-comment-panel__wrapper"
      style={{ transform: `translate3d(0px, ${Math.max(0, cardTop)}px, 0px)` }}
    >
      <div className="bitable-record-comment-panel__card">
        <CommentPanelShell id={record.id} type="record">
          <CommentPanelHeader
            quoteLabel={`记录 ${recordIndex + 1}`}
            title={`记录 ${recordIndex + 1}`}
            controls={(
              <div className="comment-panel-controls">
                <button type="button" className="comment-panel-controls__btn" title="更多" aria-label="更多">
                  <CommentPanelMoreGlyph />
                </button>
              </div>
            )}
          />

          <div className="comment-panel__reply-list">
            {comments.length ? (
              comments.map(comment => (
                <CommentItem key={comment.id} comment={comment} />
              ))
            ) : (
              <div className="comment-panel__reply bitable-record-comment-panel__empty-reply">
                <div className="comment-panel__reply-main">
                  <div className="comment-panel__avatar" aria-hidden>
                    {DEFAULT_RECORD_OPERATOR.slice(0, 1)}
                  </div>
                  <div className="comment-panel__reply-main-right">
                    <div className="comment-panel__reply-info-row">
                      <div className="comment-panel__reply-info-text">
                        <span className="comment-panel__reply-info-name">{DEFAULT_RECORD_OPERATOR}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <CommentPanelComposer
            open
            value={draft}
            placeholder="输入评论"
            idlePlaceholder="输入评论"
            submitLabel="发送"
            disabled={locked}
            autoFocus
            onOpen={() => undefined}
            onChange={setDraft}
            onSubmit={submit}
            onCancel={() => setDraft('')}
          />
        </CommentPanelShell>
      </div>
    </div>
  );
}
