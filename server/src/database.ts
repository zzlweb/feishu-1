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
  content: string;
  author: string;
  position_from: number;
  position_to: number;
  created_at: string;
  resolved: number;
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

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'db.json');

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
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function createCommentRecord(comment: CommentRecord): CommentRecord {
  const db = loadDb();
  db.comments.push(comment);
  saveDb(db);
  return comment;
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
