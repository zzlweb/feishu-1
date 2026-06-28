import { config as loadEnv } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createFeishuApiClient, getFeishuApiConfigFromEnv } from '../src/import/feishuApiClient';

loadEnv({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

async function main() {
  const config = getFeishuApiConfigFromEnv();
  if (!config) throw new Error('missing env');
  const client = createFeishuApiClient(config);
  const appToken = 'bascnuLz8b3ebSkahz7ggRDEPFe';
  const tableId = 'tblRHzA2YtYEPHae';
  const base = `/open-apis/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}`;
  const fields = await client.request<{ items?: unknown[] }>(`${base}/fields?page_size=50`);
  const records = await client.request<{ items?: unknown[] }>(`${base}/records?page_size=10`);
  console.log('fields:', JSON.stringify(fields.items?.map((f: any) => ({ id: f.field_id, name: f.field_name, type: f.type, ui_type: f.ui_type })), null, 2));
  for (const rec of records.items || []) {
    const r = rec as any;
    console.log('\nrecord', r.record_id, JSON.stringify(r.fields, null, 2));
  }
}

main().catch(console.error);
