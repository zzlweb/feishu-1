import { useCallback } from 'react';
import type { Document } from '../../../types';
import { clearDocumentDraft } from './documentDraft';
import type { RecoverableDocumentDraft } from './documentRecovery';
import type { DocumentPatch } from './useDocumentSaveQueue';

interface UseDocumentDraftRecoveryActionsOptions {
  documentId?: string;
  recoverableDraft: RecoverableDocumentDraft | null;
  setRecoverableDraft: (draft: RecoverableDocumentDraft | null) => void;
  setDocument: (document: Document | null) => void;
  enqueueSave: (patch: DocumentPatch) => void;
  onDiscarded?: () => void;
}

/**
 * 恢复草稿的两个终态集中在会话层，避免页面分别维护存储清理和服务端版本还原。
 */
export function useDocumentDraftRecoveryActions({
  documentId,
  recoverableDraft,
  setRecoverableDraft,
  setDocument,
  enqueueSave,
  onDiscarded,
}: UseDocumentDraftRecoveryActionsOptions) {
  const retryRecoveredDraft = useCallback(() => {
    if (!recoverableDraft) return;
    enqueueSave(recoverableDraft.draft.patch);
    setRecoverableDraft(null);
  }, [enqueueSave, recoverableDraft, setRecoverableDraft]);

  const discardRecoveredDraft = useCallback(() => {
    if (!recoverableDraft || !documentId) return;
    clearDocumentDraft(window.localStorage, documentId);
    setDocument(recoverableDraft.serverDocument);
    setRecoverableDraft(null);
    onDiscarded?.();
  }, [
    documentId,
    onDiscarded,
    recoverableDraft,
    setDocument,
    setRecoverableDraft,
  ]);

  return {
    retryRecoveredDraft,
    discardRecoveredDraft,
  };
}
