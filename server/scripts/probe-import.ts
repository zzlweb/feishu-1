import { config as loadEnv } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { importFeishuPublicUrl } from '../src/feishuPublicImporter';

loadEnv({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

async function main() {
  const url = 'https://qcntpn5n60jv.feishu.cn/wiki/H58uwRchYi7889k6dnJcVoMMnO5';
  const r = await importFeishuPublicUrl(url);
  console.log('title:', r.title);
  console.log('quality:', r.importQuality);
  console.log('warnings:', r.warnings);
  console.log('unsupported:', r.unsupportedBlocks);
  console.log('content length:', r.content.length);
  console.log('has bitable:', r.content.includes('data-local-block="bitable"'));
  console.log('has dashboard:', r.content.includes('data-local-block="dashboard"'));
  console.log('has columns:', r.content.includes('feishu-columns-node'));
  console.log('has taskList:', r.content.includes('data-type="taskList"'));
  console.log('preview:\n', r.content.slice(0, 3000));
}

main().catch(console.error);
