import { config as loadEnv } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createFeishuApiClient, getFeishuApiConfigFromEnv } from '../src/import/feishuApiClient';

loadEnv({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

async function main() {
  const config = getFeishuApiConfigFromEnv();
  if (!config) throw new Error('missing config');
  const client = createFeishuApiClient(config);
  const token = await client.getTenantAccessToken();
  const fileToken = process.argv[2] || 'AIolbOpQMokZAFxPEQkcyvKxnee';
  const url = `https://open.feishu.cn/open-apis/drive/v1/medias/${encodeURIComponent(fileToken)}/download`;
  const concurrency = Number(process.argv[3] || 40);
  const jobs = Array.from({ length: concurrency }, async (_, i) => {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const body = (await res.text()).slice(0, 160);
    return { i, status: res.status, body };
  });
  const results = await Promise.all(jobs);
  const counts = results.reduce<Record<string, number>>((map, item) => {
    map[String(item.status)] = (map[String(item.status)] || 0) + 1;
    return map;
  }, {});
  const outPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'probe-concurrent.json');
  fs.writeFileSync(outPath, JSON.stringify({ fileToken, concurrency, counts, sample: results.slice(0, 8) }, null, 2));
  console.log(JSON.stringify({ fileToken, concurrency, counts, sample: results.slice(0, 5) }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
