import type { Document } from '../../../types';
import {
  clearDocumentDraft,
  isDocumentDraftNewer,
  readDocumentDraft,
  type StoredDocumentDraft,
} from './documentDraft';

type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface RecoverableDocumentDraft {
  draft: StoredDocumentDraft;
  serverDocument: Document;
}

export interface DocumentRecoveryResolution {
  document: Document;
  recoverableDraft: RecoverableDocumentDraft | null;
}

/**
 * 统一文档加载后的草稿决策：
 * - 仅恢复更新于服务端版本且可编辑文档的草稿；
 * - 服务端只读或已过期的草稿会被清理；
 * - 不在页面组件里隐式合并会话状态。
 */
export function resolveDocumentRecovery(
  storage: DraftStorage,
  document: Document,
): DocumentRecoveryResolution {
  const draft = readDocumentDraft(storage, document.id);
  if (!draft || document.read_only || !isDocumentDraftNewer(draft, document)) {
    if (draft) clearDocumentDraft(storage, document.id);
    return { document, recoverableDraft: null };
  }

  return {
    document: { ...document, ...draft.patch },
    recoverableDraft: {
      draft,
      serverDocument: document,
    },
  };
}
