import fs from 'fs';
import path from 'path';
import {
  buildBusinessReportDocumentContent,
  getBusinessReportTemplateRecord,
} from '../src/fixtures/businessReportTemplate';

const dbPath = path.join(process.cwd(), 'data', 'db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

const template = getBusinessReportTemplateRecord();
const content = buildBusinessReportDocumentContent();
const targetDocId = '8172175a-74b4-4d64-b643-4f6b13772cdf';

db.templates = (db.templates || []).filter((item: { id: string }) => item.id !== template.id);
db.templates.unshift(template);

const docIndex = (db.documents || []).findIndex((item: { id: string }) => item.id === targetDocId);
if (docIndex >= 0) {
  db.documents[docIndex] = {
    ...db.documents[docIndex],
    title: '业务经营周报',
    content,
    updated_at: new Date().toISOString(),
  };
}

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
console.log('Updated template and document:', targetDocId);
