import { chromium } from '@playwright/test';

const catalogueDocument = {
  id: 'catalogue-sticky-layout-e2e',
  title: 'Catalogue layout',
  content: '<h2 data-heading-id="heading-0" data-block-id="heading-0">Section 1</h2><p>Content Content Content</p>',
  author: 'E2E',
  created_at: '2026-07-14T00:00:00.000Z',
  updated_at: '2026-07-14T00:00:00.000Z',
  is_template: 0,
  parent_id: null,
  cover_url: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',
  icon: '',
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 720 } });
await page.route('**/api/documents/catalogue-sticky-layout-e2e/comments', route =>
  route.fulfill({ json: { code: 0, data: [] } }),
);
await page.route('**/api/documents/catalogue-sticky-layout-e2e', route =>
  route.fulfill({ json: { code: 0, data: catalogueDocument } }),
);
await page.goto('http://127.0.0.1:5174/doc/catalogue-sticky-layout-e2e', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const info = await page.evaluate(() => {
  const ws = document.querySelector('.doc-page-workspace');
  const pageEl = document.querySelector('.doc-page');
  const body = document.querySelector('.doc-page-body');
  const loading = document.querySelector('.doc-page-loading');
  const style = ws ? getComputedStyle(ws) : null;
  return {
    url: location.href,
    title: document.title,
    hasLoading: Boolean(loading),
    hasDocPage: Boolean(pageEl),
    hasBody: Boolean(body),
    hasWorkspace: Boolean(ws),
    wsDisplay: style?.display,
    wsVisibility: style?.visibility,
    wsOpacity: style?.opacity,
    wsRect: ws ? ws.getBoundingClientRect() : null,
    pageRect: pageEl ? pageEl.getBoundingClientRect() : null,
    bodyRect: body ? body.getBoundingClientRect() : null,
    bodyText: document.body.innerText.slice(0, 400),
  };
});
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: 'test-results/debug-catalogue.png', fullPage: true });
await browser.close();
