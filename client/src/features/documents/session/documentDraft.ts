import type { Document } from '../../../types';
import type { DocumentPatch } from './useDocumentSaveQueue';

const DRAFT_PREFIX = 'feishu-document-draft:v1:';
const MAX_DRAFT_BYTES = 10 * 1024 * 1024;

type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface StoredDocumentDraft {
  schemaVersion: 1;
  documentId: string;
  baseVersion: number;
  updatedAt: string;
  patch: DocumentPatch;
}

function keyFor(documentId: string) {
  return `${DRAFT_PREFIX}${documentId}`;
}

function normalizePatch(value: unknown): DocumentPatch | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const patch: DocumentPatch = {};
  for (const field of ['title', 'content', 'icon', 'cover_url'] as const) {
    if (typeof source[field] === 'string') patch[field] = source[field];
  }
  if (Array.isArray(source.collapsed_heading_ids) && source.collapsed_heading_ids.every(id => typeof id === 'string')) {
    patch.collapsed_heading_ids = source.collapsed_heading_ids;
  }
  return Object.keys(patch).length ? patch : null;
}

export function readDocumentDraft(storage: DraftStorage, documentId: string): StoredDocumentDraft | null {
  try {
    const raw = storage.getItem(keyFor(documentId));
    if (!raw || raw.length > MAX_DRAFT_BYTES) return null;
    const value = JSON.parse(raw) as Partial<StoredDocumentDraft>;
    const patch = normalizePatch(value.patch);
    if (value.schemaVersion !== 1 || value.documentId !== documentId || !patch) return null;
    if (!Number.isFinite(value.baseVersion) || typeof value.updatedAt !== 'string') return null;
    return {
      schemaVersion: 1,
      documentId,
      baseVersion: Math.max(1, Number(value.baseVersion)),
      updatedAt: value.updatedAt,
      patch,
    };
  } catch {
    return null;
  }
}

export function writeDocumentDraft(
  storage: DraftStorage,
  documentId: string,
  baseVersion: number,
  patch: DocumentPatch,
) {
  if (!documentId || Object.keys(patch).length === 0) return;
  const draft: StoredDocumentDraft = {
    schemaVersion: 1,
    documentId,
    baseVersion: Math.max(1, baseVersion),
    updatedAt: new Date().toISOString(),
    patch,
  };
  try {
    storage.setItem(keyFor(documentId), JSON.stringify(draft));
  } catch {
    // Storage may be unavailable or full; network saving remains the primary path.
  }
}

export function clearDocumentDraft(storage: DraftStorage, documentId: string) {
  try {
    storage.removeItem(keyFor(documentId));
  } catch {
    // Ignore unavailable storage.
  }
}

export function isDocumentDraftNewer(draft: StoredDocumentDraft, document: Pick<Document, 'id' | 'updated_at'>) {
  if (draft.documentId !== document.id) return false;
  const draftTime = Date.parse(draft.updatedAt);
  const serverTime = Date.parse(document.updated_at);
  return Number.isFinite(draftTime) && (!Number.isFinite(serverTime) || draftTime > serverTime);
}
