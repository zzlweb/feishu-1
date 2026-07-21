import { useCallback, useEffect, useRef, useState } from 'react';
import { updateDocument, type UpdateDocumentInput } from '../../../api/documents';
import type { Document, DocumentSaveStatus } from '../../../types';

export type DocumentPatch = Pick<Partial<Document>,
  'title' | 'content' | 'icon' | 'cover_url' | 'collapsed_heading_ids'
>;

interface UseDocumentSaveQueueOptions {
  documentId?: string;
  version?: number;
  onSaved: (patch: DocumentPatch, document: Document) => void | Promise<void>;
  onConflict?: (serverDocument: Document) => void;
}

export function useDocumentSaveQueue({
  documentId,
  version,
  onSaved,
  onConflict,
}: UseDocumentSaveQueueOptions) {
  const [status, setStatus] = useState<DocumentSaveStatus>('idle');
  const pendingRef = useRef<DocumentPatch | null>(null);
  const runningRef = useRef(false);
  const blockedRef = useRef(false);
  const versionRef = useRef(Math.max(1, version || 1));
  const onSavedRef = useRef(onSaved);
  const onConflictRef = useRef(onConflict);
  onSavedRef.current = onSaved;
  onConflictRef.current = onConflict;

  useEffect(() => {
    pendingRef.current = null;
    runningRef.current = false;
    blockedRef.current = false;
    versionRef.current = Math.max(1, version || 1);
    setStatus('idle');
  }, [documentId]);

  useEffect(() => {
    if (!runningRef.current && !pendingRef.current && version) {
      versionRef.current = Math.max(versionRef.current, version);
    }
  }, [version]);

  const drain = useCallback(async () => {
    if (!documentId || runningRef.current || blockedRef.current) return;
    runningRef.current = true;

    while (pendingRef.current && !blockedRef.current) {
      const patch = pendingRef.current;
      pendingRef.current = null;
      setStatus('saving');
      const payload: UpdateDocumentInput = { ...patch, base_version: versionRef.current };
      const response = await updateDocument(documentId, payload);

      if (response.code === 0 && response.data) {
        versionRef.current = response.data.version;
        await onSavedRef.current(patch, response.data);
        continue;
      }

      pendingRef.current = { ...patch, ...(pendingRef.current || {}) };
      blockedRef.current = true;
      if (response.code === 409 && response.data) {
        setStatus('conflict');
        onConflictRef.current?.(response.data);
      } else {
        setStatus('error');
      }
    }

    runningRef.current = false;
    if (!pendingRef.current && !blockedRef.current) setStatus('saved');
  }, [documentId]);

  const enqueue = useCallback((patch: DocumentPatch) => {
    if (!documentId || Object.keys(patch).length === 0) return;
    pendingRef.current = { ...(pendingRef.current || {}), ...patch };
    if (!blockedRef.current) setStatus('dirty');
    void drain();
  }, [documentId, drain]);

  const retry = useCallback(() => {
    if (!pendingRef.current || status === 'conflict') return;
    blockedRef.current = false;
    setStatus('dirty');
    void drain();
  }, [drain, status]);

  return { status, enqueue, retry };
}

