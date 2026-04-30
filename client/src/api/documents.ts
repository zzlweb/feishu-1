import type { Document, ApiResponse, Comment, Template } from '../types';

const BASE_URL = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  return res.json();
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

export const convertToChild = (id: string, parentId: string) =>
  request<Document>(`/documents/${id}/to-child`, {
    method: 'POST',
    body: JSON.stringify({ parent_id: parentId }),
  });

export const saveAsTemplate = (id: string) =>
  request<Template>(`/documents/${id}/save-as-template`, { method: 'POST' });

// Comments
export const getComments = (docId: string) =>
  request<Comment[]>(`/documents/${docId}/comments`);

export const addComment = (docId: string, data: Partial<Comment>) =>
  request<Comment>(`/documents/${docId}/comments`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
