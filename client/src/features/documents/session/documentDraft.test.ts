import { describe, expect, it } from 'vitest';
import { clearDocumentDraft, isDocumentDraftNewer, readDocumentDraft, writeDocumentDraft } from './documentDraft';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

describe('document draft storage', () => {
  it('round-trips a versioned document patch', () => {
    const storage = memoryStorage();
    writeDocumentDraft(storage, 'doc-1', 4, { title: '本地标题', content: '<p>草稿</p>' });
    const draft = readDocumentDraft(storage, 'doc-1');
    expect(draft?.baseVersion).toBe(4);
    expect(draft?.patch).toEqual({ title: '本地标题', content: '<p>草稿</p>' });
    clearDocumentDraft(storage, 'doc-1');
    expect(readDocumentDraft(storage, 'doc-1')).toBeNull();
  });

  it('rejects corrupt and cross-document drafts', () => {
    const storage = memoryStorage();
    storage.setItem('feishu-document-draft:v1:doc-1', '{broken');
    expect(readDocumentDraft(storage, 'doc-1')).toBeNull();
    writeDocumentDraft(storage, 'doc-1', 1, { content: '<p>x</p>' });
    expect(readDocumentDraft(storage, 'doc-2')).toBeNull();
  });

  it('only restores drafts newer than the server document', () => {
    const draft = {
      schemaVersion: 1 as const,
      documentId: 'doc-1',
      baseVersion: 1,
      updatedAt: '2026-07-21T10:00:00.000Z',
      patch: { content: '<p>draft</p>' },
    };
    expect(isDocumentDraftNewer(draft, { id: 'doc-1', updated_at: '2026-07-21T09:00:00.000Z' })).toBe(true);
    expect(isDocumentDraftNewer(draft, { id: 'doc-1', updated_at: '2026-07-21T11:00:00.000Z' })).toBe(false);
  });
});
