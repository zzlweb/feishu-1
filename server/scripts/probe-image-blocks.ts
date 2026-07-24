import { config as loadEnv } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createFeishuApiClient, getFeishuApiConfigFromEnv } from '../src/import/feishuApiClient';
import { fetchFeishuRawDocumentData } from '../src/import/feishuRawDocumentFetcher';

loadEnv({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

async function main() {
  const sourceUrl = process.argv[2] || 'https://yunyinghui.feishu.cn/wiki/ZBOnwdpFciwS2bkl9TkcKlihnFg';
  const config = getFeishuApiConfigFromEnv();
  if (!config) throw new Error('missing feishu config');
  const client = createFeishuApiClient(config);
  const raw = await fetchFeishuRawDocumentData(sourceUrl, { config, client, downloadMedia: false });
  const blocks = raw.document?.blocks || [];
  const images = blocks.filter(block => block.image || block.block_type === 27 || block.file);
  const sample = images.slice(0, 8).map(block => ({
    block_id: block.block_id,
    block_type: block.block_type,
    image: block.image,
    file: block.file,
  }));

  const token = await client.getTenantAccessToken();
  const results = [];
  for (const item of sample) {
    const fileToken = String(item.image?.token || item.file?.file_token || item.file?.token || '');
    if (!fileToken) continue;
    const url = `https://open.feishu.cn/open-apis/drive/v1/medias/${encodeURIComponent(fileToken)}/download`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const ct = res.headers.get('content-type') || '';
    const text = (!res.ok || /json|text/i.test(ct)) ? (await res.text()).slice(0, 300) : `binary=${(await res.arrayBuffer()).byteLength}`;
    results.push({ fileToken, status: res.status, ct, text, block_type: item.block_type, image: item.image });
  }

  const out = {
    title: raw.target.title,
    wikiNode: raw.target.wikiNode,
    imageBlockCount: images.length,
    sample,
    downloadResults: results,
  };
  const outPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'probe-image-blocks.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
  console.log(`wrote ${outPath}`);
  console.log(JSON.stringify({
    title: out.title,
    imageBlockCount: out.imageBlockCount,
    downloadResults: results.map(r => ({ token: r.fileToken, status: r.status, text: r.text.slice(0, 120) })),
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
