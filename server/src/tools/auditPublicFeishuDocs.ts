import fs from 'fs';
import path from 'path';
import { importFeishuPublicUrl } from '../feishuPublicImporter';

interface PublicFeishuDoc {
  title: string;
  url: string;
  category: string;
  access?: string;
}

interface ComponentStat {
  name: string;
  count: number;
}

interface AuditRow {
  index: number;
  title: string;
  url: string;
  category: string;
  status: 'ok' | 'failed';
  importQuality?: string;
  importedTitle?: string;
  textLength?: number;
  componentStats?: ComponentStat[];
  unsupportedBlocks?: Array<{ type: string; reason: string }>;
  warnings?: string[];
  missingCoreComponents?: string[];
  error?: string;
}

const repoRoot = path.resolve(__dirname, '../../..');
const publicDocsPath = path.resolve(repoRoot, 'docs/public-feishu-docs.json');
const reportPath = path.resolve(repoRoot, 'docs/public-feishu-import-audit.json');

const componentPatterns: Array<[string, RegExp]> = [
  ['doc-nav', /data-local-block="doc-nav"/g],
  ['highlight', /data-type="highlight-block"/g],
  ['columns', /data-local-block="columns"/g],
  ['group-card', /data-kind="group"/g],
  ['link-card', /data-kind="link"/g],
  ['template-card', /data-kind="template"/g],
  ['embed-card', /data-local-block="embed"/g],
  ['bitable', /data-local-block="bitable"/g],
  ['dashboard', /data-local-block="dashboard"/g],
  ['table', /<table\b/g],
  ['image', /<img\b/g],
  ['code', /<pre><code/g],
  ['divider', /<hr\b/g],
  ['task-list', /data-type="taskItem"|data-type="taskList"/g],
];

function readPublicDocs() {
  return JSON.parse(fs.readFileSync(publicDocsPath, 'utf8')) as PublicFeishuDoc[];
}

function countPattern(content: string, pattern: RegExp) {
  return Array.from(content.matchAll(pattern)).length;
}

function componentStats(content: string): ComponentStat[] {
  return componentPatterns
    .map(([name, pattern]) => ({ name, count: countPattern(content, pattern) }))
    .filter(stat => stat.count > 0);
}

function textLength(content: string) {
  return content.replace(/<[^>]+>/g, '').replace(/\s+/g, '').length;
}

function missingCoreComponents(content: string, warnings: string[], unsupportedBlocks: Array<{ type: string; reason: string }> | undefined) {
  const missing = new Set<string>();
  const lowerWarnings = warnings.join('\n').toLowerCase();
  if (/群|chat_card|group/.test(lowerWarnings) && !/data-kind="group"/.test(content)) missing.add('group-card');
  if (/link_preview|链接预览/.test(lowerWarnings) && !/data-kind="link"/.test(content)) missing.add('link-card');
  if (/多维表格|bitable/.test(lowerWarnings) && !/data-local-block="bitable"/.test(content)) missing.add('bitable');
  if (/仪表盘|dashboard/.test(lowerWarnings) && !/data-local-block="dashboard"/.test(content)) missing.add('dashboard');
  unsupportedBlocks?.forEach(block => missing.add(block.type));
  return Array.from(missing);
}

async function auditOne(doc: PublicFeishuDoc, index: number): Promise<AuditRow> {
  try {
    const imported = await importFeishuPublicUrl(doc.url);
    const stats = componentStats(imported.content);
    return {
      index,
      title: doc.title,
      url: doc.url,
      category: doc.category,
      status: 'ok',
      importQuality: imported.importQuality,
      importedTitle: imported.title,
      textLength: textLength(imported.content),
      componentStats: stats,
      unsupportedBlocks: imported.unsupportedBlocks || [],
      warnings: imported.warnings,
      missingCoreComponents: missingCoreComponents(imported.content, imported.warnings, imported.unsupportedBlocks),
    };
  } catch (error) {
    return {
      index,
      title: doc.title,
      url: doc.url,
      category: doc.category,
      status: 'failed',
      error: error instanceof Error ? error.message : 'unknown error',
    };
  }
}

async function runWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>) {
  const results: R[] = [];
  let cursor = 0;
  async function runNext() {
    const current = cursor;
    cursor += 1;
    if (current >= items.length) return;
    results[current] = await worker(items[current], current + 1);
    await runNext();
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runNext));
  return results;
}

async function main() {
  const docs = readPublicDocs();
  const rows = await runWithConcurrency(docs, 3, auditOne);
  const summary = {
    total: rows.length,
    ok: rows.filter(row => row.status === 'ok').length,
    failed: rows.filter(row => row.status === 'failed').length,
    partial: rows.filter(row => row.importQuality === 'partial').length,
    fallback: rows.filter(row => row.importQuality === 'fallback').length,
    generatedAt: new Date().toISOString(),
  };
  const report = { summary, rows };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`Audited ${summary.total} public Feishu docs`);
  console.log(`ok=${summary.ok}, failed=${summary.failed}, partial=${summary.partial}, fallback=${summary.fallback}`);
  console.log(`report=${path.relative(repoRoot, reportPath)}`);
  rows.forEach(row => {
    const missing = row.missingCoreComponents?.length ? ` missing=${row.missingCoreComponents.join(',')}` : '';
    const status = row.status === 'ok' ? `${row.importQuality} components=${row.componentStats?.map(stat => `${stat.name}:${stat.count}`).join('|') || 'none'}` : row.error;
    console.log(`${row.index}. ${row.title}: ${status}${missing}`);
  });
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
