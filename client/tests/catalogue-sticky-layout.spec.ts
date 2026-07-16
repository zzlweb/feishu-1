import { expect, test } from '@playwright/test';

const headings = Array.from({ length: 36 }, (_, index) => (
  `<h2 data-heading-id="heading-${index}" data-block-id="heading-${index}">Section ${index + 1}</h2><p>${'Content '.repeat(24)}</p>`
)).join('');

const catalogueDocument = {
  id: 'catalogue-sticky-layout-e2e',
  title: 'Catalogue layout',
  content: headings,
  author: 'E2E',
  created_at: '2026-07-14T00:00:00.000Z',
  updated_at: '2026-07-14T00:00:00.000Z',
  is_template: 0,
  parent_id: null,
  cover_url: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',
  icon: '',
};

test('keeps the catalogue inside the workspace while scrolling and growing', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 720 });
  await page.route('**/api/documents/catalogue-sticky-layout-e2e/comments', route =>
    route.fulfill({ json: { code: 0, data: [] } }),
  );
  await page.route('**/api/documents/catalogue-sticky-layout-e2e', route =>
    route.fulfill({ json: { code: 0, data: catalogueDocument } }),
  );

  await page.goto('/doc/catalogue-sticky-layout-e2e');
  const workspace = page.locator('.doc-page-workspace');
  await expect(workspace).toBeVisible();

  const expandBtn = page.locator('.catalogue-collapse-btn');
  if (await expandBtn.isVisible()) {
    const listCount = await page.locator('.catalogue__list').count();
    if (listCount === 0) await expandBtn.click();
  }

  const catalogue = page.locator('.catalogue-aside');
  const rail = page.locator('.doc-page-catalogue-rail');
  await expect(rail).toBeVisible();
  await expect(catalogue).toBeVisible();

  await workspace.evaluate(element => element.scrollTo({ top: 500 }));
  await expect.poll(async () => workspace.evaluate(element => element.scrollTop)).toBeGreaterThan(400);

  const bounds = await page.evaluate(() => {
    const workspaceRect = document.querySelector('.doc-page-workspace')!.getBoundingClientRect();
    const railRect = document.querySelector('.doc-page-catalogue-rail')!.getBoundingClientRect();
    const catalogueRect = document.querySelector('.catalogue-aside')!.getBoundingClientRect();
    return {
      workspaceTop: workspaceRect.top,
      workspaceBottom: workspaceRect.bottom,
      catalogueTop: catalogueRect.top,
      catalogueBottom: catalogueRect.bottom,
      catalogueHeight: catalogueRect.height,
      railTop: railRect.top,
    };
  });
  expect(Math.abs(bounds.railTop - bounds.workspaceTop)).toBeLessThanOrEqual(2);
  expect(Math.abs(bounds.catalogueTop - bounds.workspaceTop)).toBeLessThanOrEqual(2);
  expect(bounds.catalogueBottom).toBeLessThanOrEqual(bounds.workspaceBottom + 2);

  const heightAfterGrowth = await catalogue.evaluate(element => {
    const list = element.querySelector('.catalogue__list');
    if (!list) return element.getBoundingClientRect().height;
    for (let index = 0; index < 40; index += 1) {
      const item = document.createElement('li');
      item.className = 'catalogue__list-item';
      item.textContent = `Late section ${index + 1}`;
      list.appendChild(item);
    }
    return element.getBoundingClientRect().height;
  });
  expect(Math.abs(heightAfterGrowth - bounds.catalogueHeight)).toBeLessThanOrEqual(1);
});