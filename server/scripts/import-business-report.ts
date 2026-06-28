import { config as loadEnv } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { importFeishuPublicUrl } from '../src/feishuPublicImporter';
import { createDocumentRecord } from '../src/database';

loadEnv({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

async function main() {
  const url = 'https://qcntpn5n60jv.feishu.cn/wiki/H58uwRchYi7889k6dnJcVoMMnO5';
  const imported = await importFeishuPublicUrl(url);
  const doc = createDocumentRecord({
    id: uuidv4(),
    title: imported.title,
    content: imported.content,
    author: '导入用户',
    icon: '📄',
    cover_url: imported.coverUrl || '',
    read_only: 0,
    import_metadata: imported.importMetadata ? JSON.stringify(imported.importMetadata) : '',
  });
  console.log('Document imported:', doc.id);
  console.log('Open:', `http://localhost:5175/doc/${doc.id}`);
  console.log('Quality:', imported.importQuality);
  console.log('Warnings:', imported.warnings);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
