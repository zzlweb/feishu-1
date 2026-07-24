import { config as loadEnv } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  createFeishuApiClient,
  getFeishuApiConfigFromEnv,
  getFeishuMediaApiConfigFromEnv,
  type FeishuApiConfig,
} from '../src/import/feishuApiClient';

loadEnv({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const tokens = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
    'YhR2bRmBfo8LTQxdgoPcSRzsnth',
    'TOBDbx2NGoczrzXCASDcFyHgnUh',
  ];

async function probe(label: string, config: FeishuApiConfig | null) {
  if (!config) {
    console.log(`[${label}] NO CONFIG`);
    return;
  }
  const client = createFeishuApiClient(config);
  const token = await client.getTenantAccessToken();
  console.log(`[${label}] appId=${config.appId} tokenPrefix=${token.slice(0, 10)}`);

  for (const fileToken of tokens) {
    const url = `https://open.feishu.cn/open-apis/drive/v1/medias/${encodeURIComponent(fileToken)}/download`;
    const variants: Array<[string, HeadersInit]> = [
      ['auth-only', { Authorization: `Bearer ${token}` }],
      ['auth-accept-octet', { Authorization: `Bearer ${token}`, Accept: '*/*' }],
      ['auth-json-ctype', {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json; charset=utf-8',
      }],
    ];

    for (const [name, headers] of variants) {
      const res = await fetch(url, { method: 'GET', headers });
      const ct = res.headers.get('content-type') || '';
      let preview = '';
      if (!res.ok || /json|text/i.test(ct)) {
        preview = (await res.text()).slice(0, 500);
      } else {
        preview = `binary bytes=${(await res.arrayBuffer()).byteLength}`;
      }
      console.log(`[${label}] download ${fileToken} (${name}) status=${res.status} ct=${ct}`);
      console.log(preview);
    }

    const tmpUrl = `https://open.feishu.cn/open-apis/drive/v1/medias/batch_get_tmp_download_url?file_tokens=${encodeURIComponent(fileToken)}`;
    const tmpRes = await fetch(tmpUrl, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    console.log(`[${label}] tmp ${fileToken} status=${tmpRes.status}`);
    console.log((await tmpRes.text()).slice(0, 500));
  }
}

async function main() {
  await probe('MAIN', getFeishuApiConfigFromEnv());
  const media = getFeishuMediaApiConfigFromEnv();
  const main = getFeishuApiConfigFromEnv();
  if (media && main && (media.appId !== main.appId || media.appSecret !== main.appSecret)) {
    await probe('MEDIA', media);
  } else {
    console.log('[MEDIA] same as MAIN or missing');
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
