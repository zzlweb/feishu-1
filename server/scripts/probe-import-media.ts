import { config as loadEnv } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { importFeishuPublicUrl } from '../src/feishuPublicImporter';

loadEnv({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

async function main() {
  const url = process.argv[2] || 'https://yunyinghui.feishu.cn/wiki/ZBOnwdpFciwS2bkl9TkcKlihnFg';
  const imported = await importFeishuPublicUrl(url);
  const out = {
    title: imported.title,
    quality: imported.importQuality,
    assetCount: imported.assetCount,
    warnings: imported.warnings.filter(w => /资源下载|media|403|400|404|素材/.test(w)),
    imageTags: (imported.content.match(/<img\b/g) || []).length,
    staticUploads: (imported.content.match(/\/static\/uploads\//g) || []).length,
    qrPlaceholders: (imported.content.match(/variant.:.qr|扫描二维码加入群聊|docx-image--qr/g) || []).length,
  };
  const outPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'probe-import-out.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
  console.log(`wrote ${outPath}`);
  console.log(`title=${out.title} quality=${out.quality} assets=${out.assetCount} imgs=${out.imageTags} uploads=${out.staticUploads}`);
  console.log(`warnings=${out.warnings.length}`);
  out.warnings.slice(0, 10).forEach(w => console.log(`- ${w}`));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
