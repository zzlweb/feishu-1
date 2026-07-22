import { expect, test, type Page } from '@playwright/test';

const editableDocument = {
  id: 'shell-editable-e2e',
  title: '可编辑文档',
  content: '<p>可编辑正文</p>',
  author: 'E2E',
  created_at: '2026-07-22T00:00:00.000Z',
  updated_at: '2026-07-22T00:00:00.000Z',
  is_template: 0,
  parent_id: null,
  cover_url: '',
  icon: '',
  read_only: 0,
  version: 1,
  schema_version: 1,
};

const readOnlyDocument = {
  ...editableDocument,
  id: 'shell-readonly-e2e',
  title: '权限只读文档',
  read_only: 1,
  content: `<p>只读正文</p><div data-local-block="bitable" data-title="只读表格" data-view="grid" data-columns='["标题"]' data-rows='[["记录 1"]]'></div>`,
};

async function routeDocument(page: Page, document: typeof editableDocument) {
  await page.route(`**/api/documents/${document.id}/comments`, route =>
    route.fulfill({ json: { code: 0, data: [] } }),
  );
  await page.route(`**/api/documents/${document.id}`, route =>
    route.fulfill({ json: { code: 0, data: document } }),
  );
}

test('home hides unsupported sharing chrome and opens rows from the keyboard', async ({ page }) => {
  await page.route('**/api/documents/templates/list', route =>
    route.fulfill({ json: { code: 0, data: [] } }),
  );
  await page.route('**/api/documents', route =>
    route.fulfill({ json: { code: 0, data: [editableDocument] } }),
  );
  await routeDocument(page, editableDocument);

  await page.goto('/');
  await expect(page.getByRole('button', { name: '联系人' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '通知' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '应用' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '与我共享' })).toHaveCount(0);

  const row = page.getByRole('link', { name: '打开文档：可编辑文档' });
  await row.focus();
  await expect(row).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/doc\/shell-editable-e2e$/);
});

test('user reading mode can toggle without weakening document permissions', async ({ page }) => {
  await routeDocument(page, editableDocument);
  await page.goto('/doc/shell-editable-e2e');

  const mode = page.locator('.btn-edit-mode');
  await expect(mode).toContainText('编辑');
  await expect(page.locator('.ProseMirror')).toHaveAttribute('contenteditable', 'true');
  await mode.click();
  await expect(mode).toContainText('阅读');
  await expect(page.locator('.ProseMirror')).toHaveAttribute('contenteditable', 'false');
  await mode.click();
  await expect(mode).toContainText('编辑');
  await expect(page.locator('.ProseMirror')).toHaveAttribute('contenteditable', 'true');
  await expect(page.getByText('已保存', { exact: true })).toBeVisible();
  await expect(page.getByText('已保存到云端', { exact: true })).toHaveCount(0);
});

test('server-enforced read-only cannot be switched back to edit mode', async ({ page }) => {
  await routeDocument(page, readOnlyDocument);
  await page.goto('/doc/shell-readonly-e2e');

  const mode = page.locator('.btn-edit-mode');
  await expect(mode).toContainText('只读');
  await expect(mode).toBeDisabled();
  await expect(mode).toHaveAttribute('title', '此文档由来源权限设为只读');
  await expect(page.locator('.ProseMirror')).toHaveAttribute('contenteditable', 'false');
  await expect(page.locator('.base-grid-add-field-column__header')).toBeDisabled();
  await expect(page.getByRole('button', { name: '置顶' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '通知' })).toHaveCount(0);
});

test('a slow previous document response cannot replace the current route', async ({ page }) => {
  const slowDocument = {
    ...editableDocument,
    id: 'shell-race-slow-e2e',
    title: '慢文档 A',
    content: '<p>不应出现的 A 正文</p>',
  };
  const currentDocument = {
    ...editableDocument,
    id: 'shell-race-current-e2e',
    title: '当前文档 B',
    content: '<p>应保留的 B 正文</p>',
  };
  await page.route('**/api/documents/shell-race-slow-e2e/comments', async route => {
    await new Promise(resolve => setTimeout(resolve, 250));
    await route.fulfill({ json: { code: 0, data: [] } });
  });
  await page.route('**/api/documents/shell-race-slow-e2e', async route => {
    await new Promise(resolve => setTimeout(resolve, 250));
    await route.fulfill({ json: { code: 0, data: slowDocument } });
  });
  await routeDocument(page, currentDocument);

  const slowRequest = page.waitForRequest(request => request.url().endsWith('/api/documents/shell-race-slow-e2e'));
  await page.goto('/doc/shell-race-slow-e2e');
  await slowRequest;
  await page.evaluate(() => {
    window.history.pushState({}, '', '/doc/shell-race-current-e2e');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });

  await expect(page).toHaveURL(/\/doc\/shell-race-current-e2e$/);
  await expect(page.getByText('应保留的 B 正文')).toBeVisible();
  await page.waitForTimeout(350);
  await expect(page.getByText('应保留的 B 正文')).toBeVisible();
  await expect(page.getByText('不应出现的 A 正文')).toHaveCount(0);
});
