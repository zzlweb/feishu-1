import { expect, test, type Page, type Route } from '@playwright/test';

const importedDocument = {
  id: 'import-cancel-e2e',
  title: '取消后重新导入成功',
  content: '<h1>重新导入成功</h1>',
  author: 'E2E',
  created_at: '2026-07-22T00:00:00.000Z',
  updated_at: '2026-07-22T00:00:00.000Z',
  is_template: 0,
  parent_id: null,
  cover_url: '',
  icon: '',
};

const importResult = {
  document: importedDocument,
  source_name: 'cancel-retry.md',
  asset_count: 0,
  warnings: [],
  import_quality: 'full',
};

async function routeHome(page: Page) {
  await page.route('**/api/documents/templates/list', route =>
    route.fulfill({ json: { code: 0, data: [] } }),
  );
  await page.route('**/api/documents', route =>
    route.fulfill({ json: { code: 0, data: [] } }),
  );
}

async function safelyFulfill(route: Route) {
  try {
    await route.fulfill({ json: { code: 0, data: importResult } });
  } catch {
    // The first intercepted request is expected to be gone after the browser aborts it.
  }
}

test('cancelled local import closes immediately and a new import can succeed', async ({ page }) => {
  await routeHome(page);
  let attempts = 0;
  await page.route('**/api/documents/import', async route => {
    attempts += 1;
    if (attempts === 1) {
      await new Promise(resolve => setTimeout(resolve, 1_000));
    }
    await safelyFulfill(route);
  });

  await page.goto('/');
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: 'cancel-first.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# should be cancelled'),
  });

  const progressDialog = page.locator('.t-dialog').filter({ hasText: '正在导入本地文件' });
  await expect(progressDialog).toBeVisible();
  await progressDialog.getByRole('button', { name: '取消导入', exact: true }).click();
  await expect(progressDialog).toBeHidden();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('导入文件结果', { exact: true })).toHaveCount(0);

  await fileInput.setInputFiles({
    name: 'cancel-retry.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# retry succeeds'),
  });
  await expect(page.getByText('导入文件结果', { exact: true })).toBeVisible();
  await expect(page.getByText('取消后重新导入成功', { exact: true })).toBeVisible();
  expect(attempts).toBe(2);
});

test('URL import blocks duplicate submit, cancels on close, and remains reusable', async ({ page }) => {
  await routeHome(page);
  let attempts = 0;
  await page.route('**/api/documents/import-url', async route => {
    attempts += 1;
    if (attempts === 1) {
      await new Promise(resolve => setTimeout(resolve, 1_000));
    }
    await safelyFulfill(route);
  });

  await page.goto('/');
  await page.getByRole('button', { name: /飞书导入/ }).click();
  let dialog = page.locator('.t-dialog').filter({ hasText: '导入飞书文档' });
  const input = dialog.getByPlaceholder('https://xxx.feishu.cn/wiki/...');
  await input.fill('https://example.feishu.cn/wiki/cancel-first');
  await dialog.getByRole('button', { name: '开始导入', exact: true }).click();
  await expect(input).toBeDisabled();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  expect(attempts).toBe(1);
  await dialog.getByRole('button', { name: '取消导入', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/$/);

  await page.getByRole('button', { name: /飞书导入/ }).click();
  dialog = page.locator('.t-dialog').filter({ hasText: '导入飞书文档' });
  await dialog.getByPlaceholder('https://xxx.feishu.cn/wiki/...').fill('https://example.feishu.cn/wiki/retry');
  await dialog.getByRole('button', { name: '开始导入', exact: true }).click();
  await expect(dialog.getByText('取消后重新导入成功', { exact: true })).toBeVisible();
  expect(attempts).toBe(2);
});
