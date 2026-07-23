import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const corpusPath = path.resolve(testDir, '../../../docs/public-feishu-docs.json');

interface CorpusEntry {
  title: string;
  url: string;
  category?: string;
}

const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8')) as CorpusEntry[];
const uniqueUrls = new Set(corpus.map(entry => entry.url));
const invalidUrls = corpus.filter(entry => {
  try {
    const url = new URL(entry.url);
    return url.protocol !== 'https:'
      || !(/^[\w-]+\.feishu\.cn$/i.test(url.hostname) || /^[\w-]+\.larksuite\.com$/i.test(url.hostname));
  } catch {
    return true;
  }
});
if (corpus.length < 20 || uniqueUrls.size !== corpus.length || invalidUrls.length > 0) {
  throw new Error(
    `真实飞书语料必须至少包含 20 条、URL 不重复且仅限 HTTPS 飞书域名；当前条数=${corpus.length}，唯一 URL=${uniqueUrls.size}，非法 URL=${invalidUrls.length}`,
  );
}
// 默认只跑前 2 条打通链路；全量：FEISHU_LIVE_FULL=1
const fullCorpus = process.env.FEISHU_LIVE_FULL === '1';
const pilotLimit = Number(process.env.FEISHU_LIVE_PILOT_LIMIT || (fullCorpus ? '0' : '2'));
const entries = pilotLimit > 0 ? corpus.slice(0, pilotLimit) : corpus;

function assertNotFixtureSuccess(payload: {
  import_quality?: string;
  warnings?: string[];
  source_name?: string;
  import_metadata?: { notes?: string[] } | string | null;
}) {
  const warnings = Array.isArray(payload.warnings) ? payload.warnings.join('\n') : '';
  const notesRaw = payload.import_metadata;
  const notes = typeof notesRaw === 'string'
    ? notesRaw
    : Array.isArray(notesRaw?.notes)
      ? notesRaw!.notes!.join('\n')
      : '';
  const blob = `${warnings}\n${notes}\n${payload.source_name || ''}`;
  if (/fixture|本地样例|本地高保真|sample fixture/i.test(blob)) {
    throw new Error(`拒绝假成功：导入结果疑似本地 fixture/样例。detail=${blob.slice(0, 240)}`);
  }
}

for (const entry of entries) {
  test(`live certify: ${entry.title}`, async ({ page, request }) => {
    test.setTimeout(180_000);

    const browserErrors: string[] = [];
    page.on('pageerror', error => browserErrors.push(error.message));
    let documentId: string | null = null;

    try {
      const importResponse = await request.post('/api/documents/import-url', {
        data: {
          url: entry.url,
          author: 'Feishu Live Cert',
        },
        timeout: 90_000,
      });

      expect(
        importResponse.ok(),
        `import-url failed for ${entry.url}: ${importResponse.status()} ${await importResponse.text()}`,
      ).toBeTruthy();

      const imported = await importResponse.json();
      expect(imported.code).toBe(0);
      expect(imported.data?.document?.id).toBeTruthy();
      assertNotFixtureSuccess(imported.data);

      documentId = imported.data.document.id as string;
      const title = String(imported.data.document.title || '');
      const content = String(imported.data.document.content || '');
      expect(content.length).toBeGreaterThan(20);
      expect(title.length).toBeGreaterThan(0);
      expect(['full', 'partial', 'fallback']).toContain(imported.data.import_quality);

      await page.goto(`/doc/${documentId}`);
      const editor = page.locator('.ProseMirror');
      await expect(editor).toBeVisible({ timeout: 30_000 });

      const paragraph = page.locator('.ProseMirror p').first();
      await expect(paragraph).toBeVisible();

      const saveWait = page.waitForResponse(response =>
        response.url().includes(`/api/documents/${documentId}`)
        && response.request().method() === 'PUT'
        && response.ok(),
        { timeout: 45_000 },
      );

      await paragraph.click();
      await page.keyboard.press('End');
      await page.keyboard.type(' [live-cert]');
      await saveWait;

      const tableHost = page.locator('.feishu-table-host, .tableWrapper').first();
      if (await tableHost.count()) {
        const cell = page.locator('td[data-table-cell="true"], .feishu-table td').first();
        if (await cell.count()) {
          await cell.dblclick().catch(async () => cell.click());
          await page.keyboard.type('T');
        }
      }

      const image = page.locator('.ProseMirror img, .feishu-image').first();
      if (await image.count()) {
        await image.hover({ timeout: 5_000 }).catch(() => undefined);
      }

      await page.reload();
      await expect(page.locator('.ProseMirror')).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('.ProseMirror')).toContainText('[live-cert]', { timeout: 15_000 });

      expect(browserErrors, `browser errors: ${browserErrors.join(' | ')}`).toEqual([]);
    } finally {
      // 即使导入后的编辑、刷新或断言失败，也不能把认证文档遗留在测试库。
      if (documentId) {
        const deleted = await request.delete(`/api/documents/${documentId}`).catch(() => null);
        if (deleted && !deleted.ok()) {
          console.warn(`live cleanup failed for ${documentId}: ${deleted.status()}`);
        }
      }
    }
  });
}
