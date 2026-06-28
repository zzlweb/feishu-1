import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';
import { importFeishuPublicUrl } from '../src/feishuPublicImporter';

loadEnv({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const dbPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'db.json');
const targetId = process.argv[2] || '5510eea8-7dfa-4e59-8b61-f8a65d9c24cb';
const url = 'https://qcntpn5n60jv.feishu.cn/wiki/H58uwRchYi7889k6dnJcVoMMnO5';

async function main() {
  const imported = await importFeishuPublicUrl(url);
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const doc = db.documents.find((item: { id: string }) => item.id === targetId);
  if (!doc) {
    console.error('Document not found:', targetId);
    process.exit(1);
  }
  doc.title = imported.title;
  doc.content = imported.content;
  doc.updated_at = new Date().toISOString();
  doc.read_only = 0;
  doc.icon = '';
  if (imported.importMetadata) doc.import_metadata = JSON.stringify(imported.importMetadata);
  fs.writeFileSync(dbPath, `${JSON.stringify(db, null, 2)}\n`, 'utf8');
  console.log('Updated document:', targetId);
  console.log('Quality:', imported.importQuality);
  console.log('Warnings:', imported.warnings);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
