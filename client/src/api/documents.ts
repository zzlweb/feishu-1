import type { Document, ApiResponse, Comment, Template } from '../types';
import { readApiPayload } from './http';

const BASE_URL = '/api';
const REQUEST_TIMEOUT_MS = 10000;

async function request<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE_URL}${url}`, {
      headers: { 'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json; charset=utf-8' },
      signal: controller.signal,
      ...options,
    });

    const body = await readApiPayload<T>(res);
    if (!res.ok) {
      return {
        code: body.code ?? res.status,
        message: body.message || `请求失败 (${res.status})`,
      };
    }

    return body as ApiResponse<T>;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { code: -1, message: '请求超时，请确认后端服务已启动' };
    }
    return {
      code: -1,
      message: error instanceof Error ? error.message : '网络请求失败',
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

// Documents
export const getDocuments = () => request<Document[]>('/documents');

export const getDocument = (id: string) => request<Document>(`/documents/${id}`);

export const createDocument = (data?: Partial<Document>) =>
  request<Document>('/documents', {
    method: 'POST',
    body: JSON.stringify(data || {}),
  });

export const updateDocument = (id: string, data: Partial<Document>) =>
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

// Comments
export const getComments = (docId: string, blockId?: string) =>
  request<Comment[]>(`/documents/${docId}/comments${blockId ? `?block_id=${encodeURIComponent(blockId)}` : ''}`);

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
