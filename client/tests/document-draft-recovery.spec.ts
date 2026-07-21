import { expect, test } from '@playwright/test';

const documentId = 'draft-recovery-e2e';
const serverDocument = {
  id: documentId,
  title: '服务端标题',
  content: '<p>服务端正文</p>',
  author: 'E2E',
  created_at: '2026-07-21T08:00:00.000Z',
  updated_at: '2026-07-21T09:00:00.000Z',
  is_template: 0,
  parent_id: null,
  cover_url: '',
  icon: '',
  version: 1,
  schema_version: 1,
};

function localDraft() {
  return {
    schemaVersion: 1,
    documentId,
    baseVersion: 1,
    updatedAt: '2099-07-21T10:00:00.000Z',
    patch: { title: '本地草稿标题', content: '<p>尚未上传的本地正文</p>' },
  };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ key, draft }) => localStorage.setItem(key, JSON.stringify(draft)), {
    key: `feishu-document-draft:v1:${documentId}`,
    draft: localDraft(),
  });
  await page.route(`**/api/documents/${documentId}/comments`, route =>
    route.fulfill({ json: { code: 0, data: [] } }),
  );
});

test('restores a newer local draft and clears it after a successful retry', async ({ page }) => {
  let savedContent = '';
  await page.route(`**/api/documents/${documentId}`, async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { code: 0, data: serverDocument } });
    const body = JSON.parse(route.request().postData() || '{}');
    savedContent = body.content || '';
    return route.fulfill({
      json: { code: 0, data: { ...serverDocument, ...body, version: 2, updated_at: '2099-07-21T10:01:00.000Z' } },
    });
  });

  await page.goto(`/doc/${documentId}`);
  await expect(page.locator('.ProseMirror')).toContainText('尚未上传的本地正文');
  await expect(page.getByText('已恢复一份尚未上传的本地草稿')).toBeVisible();
  await page.getByRole('button', { name: '立即保存' }).click();

  await expect.poll(() => savedContent).toContain('尚未上传的本地正文');
  await expect(page.getByText('已恢复一份尚未上传的本地草稿')).toHaveCount(0);
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), `feishu-document-draft:v1:${documentId}`)).toBeNull();
});

test('can discard the recovered draft and return to the server document', async ({ page }) => {
  await page.route(`**/api/documents/${documentId}`, route =>
    route.fulfill({ json: { code: 0, data: serverDocument } }),
  );

  await page.goto(`/doc/${documentId}`);
  await expect(page.locator('.ProseMirror')).toContainText('尚未上传的本地正文');
  await page.getByRole('button', { name: '放弃草稿' }).click();

  await expect(page.locator('.ProseMirror')).toContainText('服务端正文');
  await expect(page.locator('.ProseMirror')).not.toContainText('尚未上传的本地正文');
});
