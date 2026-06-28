import { chromium } from '@playwright/test';

async function main() {
  const docId = process.argv[2] || '5510eea8-7dfa-4e59-8b61-f8a65d9c24cb';
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5175';
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });

  await page.goto(`${baseUrl}/doc/${docId}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);
  console.log('url:', page.url());
  console.log('editor:', await page.locator('.ProseMirror').count());
  console.log('bitable:', await page.locator('.feishu-base-block').count());
  console.log('errors:', errors.length ? errors.join('\n') : '(none)');
  await browser.close();
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
