import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dbPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const docId = process.argv[2];
const doc = docId
  ? db.documents.find((d: { id?: string }) => d.id === docId)
  : db.documents.find((d: { title?: string }) => d.title?.includes('业务经营'));
if (!doc) {
  console.log('doc not found');
  process.exit(0);
}
const matches = [...doc.content.matchAll(/data-model="([^"]+)"/g)];
for (const match of matches) {
  let table: { id?: string; name?: string; records?: Array<{ fields: Record<string, unknown> }> };
  try {
    table = JSON.parse(decodeURIComponent(match[1].replace(/&quot;/g, '"')));
  } catch {
    continue;
  }
  const rec = table.records?.find(r =>
    Object.values(r.fields).some(v => Array.isArray(v) && (v[0] as { name?: string })?.name === 'image.png'),
  );
  if (!rec) continue;
  const att = Object.values(rec.fields).find(v => Array.isArray(v) && (v[0] as { name?: string })?.name === 'image.png');
  console.log('table', table.id, table.name);
  console.log(JSON.stringify(att, null, 2));
}
