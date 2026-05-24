import fs from 'fs';
import path from 'path';

export interface DocumentRecord {
  id: string;
  title: string;
  content: string;
  author: string;
  created_at: string;
  updated_at: string;
  is_template: number;
  parent_id: string | null;
  cover_url: string;
  icon: string;
}

export interface CommentRecord {
  id: string;
  document_id: string;
  block_id: string;
  thread_id?: string;
  parent_id?: string;
  message_id?: string;
  content: string;
  author: string;
  position_from: number;
  position_to: number;
  created_at: string;
  updated_at: string;
  resolved: number;
  status?: 'open' | 'resolved' | 'deleted' | 'anchor_lost';
  visibility?: 'public' | 'private';
  quote?: string;
  anchor_type?: 'text-range' | 'block' | 'image' | 'video' | 'file' | 'table-cell' | 'table-range' | 'document';
  anchor_json?: string;
  mentioned_user_ids?: string;
  private_visible_user_ids?: string;
  deleted_at?: string;
  resolved_at?: string;
  resolved_by?: string;
  is_edited?: number;
}

export interface TemplateRecord {
  id: string;
  title: string;
  content: string;
  author: string;
  created_at: string;
}

interface Database {
  documents: DocumentRecord[];
  comments: CommentRecord[];
  templates: TemplateRecord[];
}

const dbPath = process.env.FEISHU_DOC_DB_PATH || path.join(__dirname, '..', 'data', 'db.json');
const dataDir = path.dirname(dbPath);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function loadDb(): Database {
  try {
    if (fs.existsSync(dbPath)) {
      const raw = fs.readFileSync(dbPath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch { /* ignore */ }
  return { documents: [], comments: [], templates: [] };
}

function saveDb(db: Database) {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
}

function nowStr() {
  return new Date().toISOString();
}

// ---- Documents ----

export function getAllDocuments(): DocumentRecord[] {
  const db = loadDb();
  return db.documents
    .filter(d => d.is_template === 0)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
}

export function getDocumentById(id: string): DocumentRecord | undefined {
  const db = loadDb();
  return db.documents.find(d => d.id === id);
}

export function createDocumentRecord(doc: Partial<DocumentRecord> & { id: string }): DocumentRecord {
  const db = loadDb();
  const now = nowStr();
  const newDoc: DocumentRecord = {
    id: doc.id,
    title: doc.title ?? '',
    content: doc.content || '',
    author: doc.author || '张正亮',
    created_at: now,
    updated_at: now,
    is_template: 0,
    parent_id: doc.parent_id || null,
    cover_url: doc.cover_url || '',
    icon: doc.icon || '',
  };
  db.documents.push(newDoc);
  saveDb(db);
  return newDoc;
}

export function updateDocumentRecord(id: string, updates: Partial<DocumentRecord>): DocumentRecord | undefined {
  const db = loadDb();
  const idx = db.documents.findIndex(d => d.id === id);
  if (idx === -1) return undefined;
  const doc = db.documents[idx];
  if (updates.title !== undefined) doc.title = updates.title;
  if (updates.content !== undefined) doc.content = updates.content;
  if (updates.icon !== undefined) doc.icon = updates.icon;
  if (updates.cover_url !== undefined) doc.cover_url = updates.cover_url;
  if (updates.parent_id !== undefined) doc.parent_id = updates.parent_id;
  doc.updated_at = nowStr();
  db.documents[idx] = doc;
  saveDb(db);
  return doc;
}

export function deleteDocumentById(id: string): boolean {
  const db = loadDb();
  const before = db.documents.length;
  db.documents = db.documents.filter(d => d.id !== id);
  db.comments = db.comments.filter(c => c.document_id !== id);
  saveDb(db);
  return db.documents.length < before;
}

// ---- Comments ----

export function getCommentsByDocId(docId: string): CommentRecord[] {
  const db = loadDb();
  return db.comments
    .filter(c => c.document_id === docId)
    .map(c => ({
      ...c,
      block_id: c.block_id || '',
      thread_id: c.thread_id || c.block_id || c.id,
      message_id: c.message_id || c.id,
      status: c.status || (c.resolved ? 'resolved' : 'open'),
      visibility: c.visibility || 'public',
      updated_at: c.updated_at || c.created_at,
    }))
    .sort((a, b) => Number(a.resolved) - Number(b.resolved) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

export function createCommentRecord(comment: CommentRecord): CommentRecord {
  const db = loadDb();
  db.comments.push(comment);
  saveDb(db);
  return comment;
}

export function updateCommentRecord(commentId: string, updates: Partial<CommentRecord>): CommentRecord | undefined {
  const db = loadDb();
  const idx = db.comments.findIndex(c => c.id === commentId);
  if (idx === -1) return undefined;
  const comment = db.comments[idx];
  if (updates.content !== undefined) comment.content = updates.content;
  if (updates.resolved !== undefined) {
    comment.resolved = updates.resolved;
    comment.status = updates.resolved ? 'resolved' : 'open';
    comment.resolved_at = updates.resolved ? nowStr() : '';
    comment.resolved_by = updates.resolved ? (updates.resolved_by || comment.resolved_by || comment.author) : '';
  }
  if (updates.status !== undefined) comment.status = updates.status;
  if (updates.visibility !== undefined) comment.visibility = updates.visibility;
  if (updates.anchor_json !== undefined) comment.anchor_json = updates.anchor_json;
  if (updates.quote !== undefined) comment.quote = updates.quote;
  if (updates.deleted_at !== undefined) comment.deleted_at = updates.deleted_at;
  if (updates.is_edited !== undefined) comment.is_edited = updates.is_edited;
  comment.updated_at = nowStr();
  db.comments[idx] = comment;
  saveDb(db);
  return { ...comment, block_id: comment.block_id || '', updated_at: comment.updated_at || comment.created_at };
}

export function deleteCommentRecord(docId: string, commentId: string): boolean {
  const db = loadDb();
  const idx = db.comments.findIndex(c => c.id === commentId && c.document_id === docId);
  if (idx === -1) return false;
  db.comments.splice(idx, 1);
  saveDb(db);
  return true;
}

// ---- Templates ----

export function getAllTemplates(): TemplateRecord[] {
  const db = loadDb();
  return db.templates.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function createTemplateRecord(template: TemplateRecord): TemplateRecord {
  const db = loadDb();
  db.templates.push(template);
  saveDb(db);
  return template;
}
