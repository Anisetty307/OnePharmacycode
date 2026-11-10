
// @ts-check
import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

test.use({ storageState: { cookies: [], origins: [] } });

const authDir = resolve(process.cwd(), 'authentications');

test('login to the application', async ({ page }) => {
  await page.goto('https://ros.1pharmacy.io/login');
  await page.getByRole('textbox', { name: 'Phone number' }).fill('8328034978');
  await page.getByRole('button', { name: 'Get OTP' }).click();
  await page.waitForTimeout(10000);

  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('https://ros.1pharmacy.io/bill-entry/draft/1');

  await mkdir(authDir, { recursive: true });
  await page.context().storageState({
    path: resolve(authDir, 'localStorageSession.json'),
  });
  const sessionStorageState = await page.evaluate(() =>
    Object.fromEntries(
      Array.from({ length: window.sessionStorage.length }, (_, index) => {
        const key = window.sessionStorage.key(index);
        return [key, key === null ? '' : window.sessionStorage.getItem(key) ?? ''];
      }),
    ),
  );
  await writeFile(
    resolve(authDir, 'sessionStorage.json'),
    JSON.stringify(sessionStorageState, null, 2),
    'utf8',
  );
});