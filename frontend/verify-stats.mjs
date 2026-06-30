import { chromium } from '@playwright/test';
const ADMIN_SECRET = 'p_QiFhAEsCsQfM7WWlCs8lJq9W1mxIeF1Fweg1dg9do';
const BASE = 'https://duckshort.cc';
const SS = '/tmp/verify-stats-out';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

console.log('Step 1: Login');
await page.goto(BASE + '/admin');
await page.fill('input[type="password"]', ADMIN_SECRET);
await page.keyboard.press('Enter');
await page.waitForSelector('text=ADMIN DASHBOARD', { timeout: 12000 });
await page.screenshot({ path: SS + '/01-dashboard.png' });
console.log('  -> dashboard visible');

console.log('Step 2: Click first STATS button');
const statsBtn = page.locator('button', { hasText: 'STATS' }).first();
await statsBtn.waitFor({ timeout: 8000 });
await statsBtn.click();

console.log('Step 3: Wait for fetch+render (3s)');
await page.waitForTimeout(3000);
await page.screenshot({ path: SS + '/02-stats-panel.png' });

const hasVisits = await page.locator('text=/TOTAL CLICKS|TOTAL VISITS|clicks/i').first().isVisible().catch(() => false);
const hasCountries = await page.locator('text=/COUNTRIES|COUNTRY/i').first().isVisible().catch(() => false);
const hasReferrers = await page.locator('text=/REFERR/i').first().isVisible().catch(() => false);
const stillLoading = await page.locator('text=LOADING TAB').isVisible().catch(() => false);
console.log('  -> hasVisits=' + hasVisits + ' hasCountries=' + hasCountries + ' hasReferrers=' + hasReferrers + ' stillLoading=' + stillLoading);

console.log('Step 4 (probe): back to links, click STATS again');
await page.locator('button').filter({ hasText: /^links$/i }).first().click();
await page.waitForTimeout(600);
await page.locator('button', { hasText: 'STATS' }).first().waitFor({ timeout: 5000 });
await page.locator('button', { hasText: 'STATS' }).first().click();
await page.waitForTimeout(3000);
await page.screenshot({ path: SS + '/03-second-stats.png' });
const hasVisits2 = await page.locator('text=/TOTAL CLICKS|TOTAL VISITS|clicks/i').first().isVisible().catch(() => false);
console.log('  -> second click hasVisits=' + hasVisits2);

console.log('Console errors: ' + (errors.length ? errors.join(' | ') : 'none'));
await browser.close();

const pass = hasVisits && !stillLoading && hasVisits2;
console.log('\nVERDICT: ' + (pass ? 'PASS' : 'FAIL'));
