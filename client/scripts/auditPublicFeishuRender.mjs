import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const repoRoot = path.resolve(process.cwd(), '..');
const docsPath = path.resolve(repoRoot, 'docs/public-feishu-docs.json');
const serverAuditPath = path.resolve(repoRoot, 'docs/public-feishu-import-audit.json');
const reportPath = path.resolve(repoRoot, 'docs/public-feishu-render-audit.json');

const publicDocs = JSON.parse(fs.readFileSync(docsPath, 'utf8'));
const serverAudit = fs.existsSync(serverAuditPath)
  ? JSON.parse(fs.readFileSync(serverAuditPath, 'utf8'))
  : { rows: [] };
const serverRowsByUrl = new Map((serverAudit.rows || []).map(row => [row.url, row]));

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function detectSourceHints(text) {
  const hints = [];
  const rules = [
    ['doc-nav', /首页|新人必逛|关于我|目录|导航/],
    ['group-card', /加入群聊|群名片|社群|交流群|加入/],
    ['bitable', /多维表格|表格视图|画册视图|看板|甘特/],
    ['dashboard', /仪表盘|图表|统计|占比/],
    ['table', /字段|记录|行|列|公式|附件|人员/],
    ['callout', /💡|📌|❗|注意|提示|写在前面/],
    ['link-card', /https?:\/\/|链接|资源|教程|课程/],
    ['image', /图片|截图|示例图/],
    ['comment', /评论|交流/],
  ];
  rules.forEach(([name, pattern]) => {
    if (pattern.test(text)) hints.push(name);
  });
  return hints;
}

function compareWithImport(url, sourceTextLength, sourceHints) {
  const imported = serverRowsByUrl.get(url);
  if (!imported || imported.status !== 'ok') return ['server-import-missing'];
  const gaps = [];
  const importedLength = imported.textLength || 0;
  const importedComponents = new Set((imported.componentStats || []).map(stat => stat.name));
  if (sourceTextLength >= 300 && importedLength < sourceTextLength * 0.35) gaps.push('content-coverage-low');
  sourceHints.forEach(hint => {
    if (hint === 'callout' && !importedComponents.has('highlight')) gaps.push('highlight');
    else if (hint === 'group-card' && !importedComponents.has('group-card')) gaps.push('group-card');
    else if (hint === 'link-card' && !importedComponents.has('link-card') && !importedComponents.has('embed-card')) gaps.push('link-card');
    else if (hint === 'doc-nav' && !importedComponents.has('doc-nav')) gaps.push('doc-nav');
    else if (hint === 'bitable' && !importedComponents.has('bitable')) gaps.push('bitable');
    else if (hint === 'dashboard' && !importedComponents.has('dashboard')) gaps.push('dashboard');
    else if (hint === 'table' && !importedComponents.has('table') && !importedComponents.has('bitable')) gaps.push('table');
  });
  return Array.from(new Set(gaps));
}

async function auditPage(browser, doc, index) {
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  try {
    await page.goto(doc.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(8000);
    const data = await page.evaluate(() => {
      const text = document.body?.innerText || '';
      const title = document.querySelector('h1')?.textContent || document.title || '';
      const headings = Array.from(document.querySelectorAll('h1,h2,h3'))
        .map(item => item.textContent?.trim())
        .filter(Boolean)
        .slice(0, 20);
      return {
        title,
        text,
        lines: text.split(/\n+/).map(item => item.trim()).filter(Boolean).slice(0, 500),
        headings,
        url: location.href,
      };
    });
    const text = normalizeText(data.text);
    const sourceHints = detectSourceHints(text);
    return {
      index,
      title: doc.title,
      url: doc.url,
      category: doc.category,
      status: 'ok',
      renderedUrl: data.url,
      renderedTitle: normalizeText(data.title),
      renderedTextLength: text.replace(/\s/g, '').length,
      headings: data.headings,
      sourceHints,
      importGaps: compareWithImport(doc.url, text.replace(/\s/g, '').length, sourceHints),
      renderedLines: data.lines,
      textSample: text.slice(0, 500),
    };
  } catch (error) {
    return {
      index,
      title: doc.title,
      url: doc.url,
      category: doc.category,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await page.close();
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const rows = [];
  try {
    for (let index = 0; index < publicDocs.length; index += 1) {
      const row = await auditPage(browser, publicDocs[index], index + 1);
      rows.push(row);
      const gaps = row.importGaps?.length ? ` gaps=${row.importGaps.join(',')}` : '';
      console.log(`${row.index}. ${row.title}: ${row.status} rendered=${row.renderedTextLength || 0}${gaps}`);
    }
  } finally {
    await browser.close();
  }

  const summary = {
    total: rows.length,
    ok: rows.filter(row => row.status === 'ok').length,
    failed: rows.filter(row => row.status === 'failed').length,
    lowCoverage: rows.filter(row => row.importGaps?.includes('content-coverage-low')).length,
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(reportPath, `${JSON.stringify({ summary, rows }, null, 2)}\n`, 'utf8');
  console.log(`report=${path.relative(repoRoot, reportPath)}`);
}

await main();
