import { useCallback, useEffect, useRef, useState } from 'react';
import { getDocument } from '../../../api/documents';
import type { Document } from '../../../types';
import {
  resolveDocumentRecovery,
  type RecoverableDocumentDraft,
} from './documentRecovery';

interface UseDocumentLoadSessionOptions {
  documentId?: string;
  onMissing: () => void;
  onLoaded?: () => void;
}

/**
 * 文档会话的读取边界：处理路由切换竞争、Abort、草稿恢复和缺失文档跳转。
 * 页面只消费 document/loading/recovery 状态，不能再自行实现一套加载规则。
 */
export function useDocumentLoadSession({
  documentId,
  onMissing,
  onLoaded,
}: UseDocumentLoadSessionOptions) {
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoverableDraft, setRecoverableDraft] = useState<RecoverableDocumentDraft | null>(null);
  const requestSequenceRef = useRef(0);
  const onMissingRef = useRef(onMissing);
  const onLoadedRef = useRef(onLoaded);
  onMissingRef.current = onMissing;
  onLoadedRef.current = onLoaded;

  const reload = useCallback(async (signal?: AbortSignal) => {
    if (!documentId) {
      setDocument(null);
      setRecoverableDraft(null);
      setLoading(false);
      return;
    }

    const requestId = ++requestSequenceRef.current;
    setLoading(true);
    setDocument(null);
    setRecoverableDraft(null);
    try {
      const response = await getDocument(documentId, { signal });
      if (signal?.aborted || requestId !== requestSequenceRef.current) return;

      if (response.code !== 0 || !response.data) {
        onMissingRef.current();
        return;
      }

      const recovery = resolveDocumentRecovery(window.localStorage, response.data);
      setDocument(recovery.document);
      setRecoverableDraft(recovery.recoverableDraft);
      onLoadedRef.current?.();
    } finally {
      if (requestId === requestSequenceRef.current) setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    const controller = new AbortController();
    void reload(controller.signal);
    return () => controller.abort();
  }, [reload]);

  return {
    document,
    setDocument,
    loading,
    recoverableDraft,
    setRecoverableDraft,
    reload,
  };
}
