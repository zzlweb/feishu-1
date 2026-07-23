import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';
import { importFeishuPublicUrl } from '../src/feishuPublicImporter';
import type { TemplateRecord } from '../src/database';

loadEnv({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

interface CorpusEntry {
  title: string;
  url: string;
  category?: string;
  features?: string;
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');
const corpusPath = path.resolve(repoRoot, 'docs/public-feishu-docs.json');
const dbPath = path.resolve(scriptDir, '../data/db.json');

function templateIdFromUrl(sourceUrl: string) {
  const token = new URL(sourceUrl).pathname.split('/').filter(Boolean).pop() || 'unknown';
  return `tpl-feishu-corpus-${token}`;
}

function parseLimitArg() {
  const arg = process.argv.find(item => item.startsWith('--limit='));
  if (!arg) return 0;
  const value = Number(arg.split('=')[1]);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

async function main() {
  const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8')) as CorpusEntry[];
  const limit = parseLimitArg();
  const entries = limit > 0 ? corpus.slice(0, limit) : corpus;

  if (entries.length === 0) {
    throw new Error('语料为空，无法导入模板');
  }

  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8')) as {
    documents: unknown[];
    comments: unknown[];
    templates: TemplateRecord[];
  };

  const importedIds = new Set<string>();
  const results: Array<{
    title: string;
    url: string;
    templateId: string;
    quality: string;
    warnings: number;
    ok: boolean;
    error?: string;
  }> = [];

  for (const [index, entry] of entries.entries()) {
    const templateId = templateIdFromUrl(entry.url);
    process.stdout.write(`[${index + 1}/${entries.length}] 导入模板：${entry.title}\n`);
    try {
      const imported = await importFeishuPublicUrl(entry.url.trim());
      const template: TemplateRecord = {
        id: templateId,
        title: imported.title || entry.title,
        content: imported.content,
        author: '飞书语料库',
        created_at: new Date().toISOString(),
      };

      db.templates = (db.templates || []).filter(item => item.id !== templateId);
      db.templates.unshift(template);
      importedIds.add(templateId);

      results.push({
        title: template.title,
        url: entry.url,
        templateId,
        quality: imported.importQuality,
        warnings: imported.warnings.length,
        ok: true,
      });
      process.stdout.write(`  ✓ ${template.title} (${imported.importQuality}, warnings=${imported.warnings.length})\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        title: entry.title,
        url: entry.url,
        templateId,
        quality: 'failed',
        warnings: 0,
        ok: false,
        error: message,
      });
      process.stderr.write(`  ✗ ${entry.title}: ${message}\n`);
    }
  }

  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');

  const okCount = results.filter(item => item.ok).length;
  const failCount = results.length - okCount;
  process.stdout.write(`\n完成：成功 ${okCount}，失败 ${failCount}，模板总数 ${db.templates.length}\n`);
  if (failCount > 0) process.exitCode = 1;
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
