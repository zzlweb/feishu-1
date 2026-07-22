import type { Document, ApiResponse, Comment, ImportDocumentResult, Template } from '../types';
import { readApiPayload } from './http';

const BASE_URL = '/api';
const REQUEST_TIMEOUT_MS = 10000;
const IMPORT_URL_TIMEOUT_MS = 60000;

interface ApiRequestOptions extends RequestInit {
  timeoutMs?: number;
  timeoutMessage?: string;
}

async function request<T>(url: string, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
  const { timeoutMs = REQUEST_TIMEOUT_MS, timeoutMessage, signal: externalSignal, ...fetchOptions } = options || {};
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const abortFromCaller = () => controller.abort();
  externalSignal?.addEventListener('abort', abortFromCaller, { once: true });

  try {
    const res = await fetch(`${BASE_URL}${url}`, {
      headers: { 'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json; charset=utf-8' },
      signal: controller.signal,
      ...fetchOptions,
    });

    const body = await readApiPayload<T>(res);
    if (!res.ok) {
      return {
        code: body.code ?? res.status,
        message: body.message || `请求失败 (${res.status})`,
        data: body.data,
      };
    }

    return body as ApiResponse<T>;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (externalSignal?.aborted) return { code: -2, message: '操作已取消' };
      return { code: -1, message: timeoutMessage || '请求超时，请确认后端服务已启动' };
    }
    return {
      code: -1,
      message: error instanceof Error ? error.message : '网络请求失败',
    };
  } finally {
    window.clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', abortFromCaller);
  }
}

// Documents
export const getDocuments = () => request<Document[]>('/documents');

export const getDocument = (id: string, options?: { signal?: AbortSignal }) =>
  request<Document>(`/documents/${id}`, { signal: options?.signal });

export const createDocument = (data?: Partial<Document>) =>
  request<Document>('/documents', {
    method: 'POST',
    body: JSON.stringify(data || {}),
  });

export async function importDocumentFile(
  file: File,
  author?: string,
  options?: { signal?: AbortSignal; onProgress?: (progress: number) => void },
): Promise<ApiResponse<ImportDocumentResult>> {
  const form = new FormData();
  form.append('file', file);
  if (author) form.append('author', author);

  return new Promise(resolve => {
    const xhr = new XMLHttpRequest();
    let settled = false;
    const finish = (result: ApiResponse<ImportDocumentResult>) => {
      if (settled) return;
      settled = true;
      options?.signal?.removeEventListener('abort', handleAbort);
      resolve(result);
    };
    const handleAbort = () => {
      xhr.abort();
      finish({ code: -2, message: '导入已取消' });
    };

    xhr.open('POST', `${BASE_URL}/documents/import`);
    xhr.setRequestHeader('Accept', 'application/json; charset=utf-8');
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) options?.onProgress?.(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      let body: ApiResponse<ImportDocumentResult>;
      try {
        body = JSON.parse(xhr.responseText) as ApiResponse<ImportDocumentResult>;
      } catch {
        finish({ code: xhr.status || -1, message: '服务器返回了无法解析的导入结果' });
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        finish({ code: body.code ?? xhr.status, message: body.message || `导入失败 (${xhr.status})` });
        return;
      }
      options?.onProgress?.(100);
      finish(body);
    };
    xhr.onerror = () => finish({ code: -1, message: '网络请求失败，导入未完成' });
    xhr.onabort = () => finish({ code: -2, message: '导入已取消' });
    options?.signal?.addEventListener('abort', handleAbort, { once: true });
    if (options?.signal?.aborted) handleAbort();
    else xhr.send(form);
  });
}

export async function importDocumentUrl(
  url: string,
  options?: { author?: string; saveAsTemplate?: boolean; signal?: AbortSignal },
): Promise<ApiResponse<ImportDocumentResult>> {
  return request<ImportDocumentResult>('/documents/import-url', {
    method: 'POST',
    timeoutMs: IMPORT_URL_TIMEOUT_MS,
    timeoutMessage: '飞书导入耗时较长已超时，请确认文档已公开或后端飞书配置可用后重试',
    signal: options?.signal,
    body: JSON.stringify({
      url,
      author: options?.author,
      save_as_template: options?.saveAsTemplate ?? false,
    }),
  });
}

export type UpdateDocumentInput = Partial<Document> & { base_version?: number };

export const updateDocument = (id: string, data: UpdateDocumentInput) =>
  request<Document>(`/documents/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const deleteDocument = (id: string) =>
  request<void>(`/documents/${id}`, { method: 'DELETE' });

export const duplicateDocument = (id: string) =>
  request<Document>(`/documents/${id}/duplicate`, { method: 'POST' });

export const getTemplates = () => request<Template[]>('/documents/templates/list');

export const convertToChild = (id: string, parentId: string) =>
  request<Document>(`/documents/${id}/to-child`, {
    method: 'POST',
    body: JSON.stringify({ parent_id: parentId }),
  });

export const createChildDocument = (parentId: string, data?: Partial<Document>) =>
  request<Document>(`/documents/${parentId}/children`, {
    method: 'POST',
    body: JSON.stringify(data || {}),
  });

export const saveAsTemplate = (id: string) =>
  request<Template>(`/documents/${id}/save-as-template`, { method: 'POST' });

export const createTemplate = (data: Pick<Template, 'title' | 'content'> & Partial<Pick<Template, 'author'>>) =>
  request<Template>('/documents/templates', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const deleteTemplate = (id: string) =>
  request<void>(`/documents/templates/${id}`, { method: 'DELETE' });

// Comments
export const getComments = (docId: string, blockId?: string, options?: { signal?: AbortSignal }) =>
  request<Comment[]>(`/documents/${docId}/comments${blockId ? `?block_id=${encodeURIComponent(blockId)}` : ''}`, {
    signal: options?.signal,
  });

export const addComment = (docId: string, data: Partial<Comment>) =>
  request<Comment>(`/documents/${docId}/comments`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateComment = (docId: string, commentId: string, data: Partial<Comment>) =>
  request<Comment>(`/documents/${docId}/comments/${commentId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteComment = (docId: string, commentId: string) =>
  request<void>(`/documents/${docId}/comments/${commentId}`, { method: 'DELETE' });
