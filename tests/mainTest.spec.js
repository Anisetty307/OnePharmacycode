
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test, expect } from '@playwright/test';
import * as XLSX from 'xlsx';

const sessionStoragePath = resolve(
  process.cwd(),
  'authentications/sessionStorage.json',
);
const suppliersWorkbookPath = resolve(
  process.cwd(),
  'tests/testData/suppliers.xlsx',
);

test('change payment mode for a purchase', async ({ page }) => {
  test.setTimeout(310_000);

  const workbook = XLSX.readFile(suppliersWorkbookPath);
  const supplierSheet = workbook.Sheets[workbook.SheetNames[0]];
  const suppliers = XLSX.utils.sheet_to_json(supplierSheet, { defval: '' });
  const supplierNames = suppliers
    .filter((row) => String(row.Updated ?? '').trim().toUpperCase() === 'Y')
    .map((row) => String(row.Supplier ?? '').trim())
    .filter(Boolean);
  if (supplierNames.length === 0) {
    throw new Error(
      'tests/testData/suppliers.xlsx must have at least one supplier with Updated set to Y.',
    );
  }

  let sessionStorageState;
  try {
    sessionStorageState = JSON.parse(
      await readFile(sessionStoragePath, 'utf8'),
    );
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
    throw new Error(
      'No saved sessionStorage was found. Run tests/login.spec.js once to save the authenticated session.',
      { cause: error },
    );
  }

  await page.addInitScript((state) => {
    for (const [key, value] of Object.entries(state)) {
      window.sessionStorage.setItem(key, value);
    }
  }, sessionStorageState);

  await page.goto('https://ros.1pharmacy.io/bill-entry/draft/1');
  await expect(page).toHaveURL(/\/bill-entry\/draft\/1(?:[/?#]|$)/);

  await page.getByRole('link', { name: /Purchase/ }).click();
  await page.getByRole('link', { name: 'Purchase History' }).click();
  await page.getByRole('button', { name: 'Change Shop' }).click();
    await page.getByRole('combobox', { name: 'Select Store' }).click();

  //await page.getByRole('button', { name: 'Clear' }).click();
 //await page.getByRole('combobox', { name: 'Select Store' }).click();
  await page.getByRole('option', { name: 'CENTRAL MEDICAL STORES WAREHOUSE' }).click();
   // await page.waitForTimeout(10000);
   // await page.pause();

const viewbutton=await page.getByRole("button",{name:'View By Bills'}).last();
await expect(viewbutton).toBeVisible();
await expect(viewbutton).toBeEnabled();

await viewbutton.click();
 //await page.getByRole('option', { name: 'All' }).click();

  //await page.getByRole("button",{name:'View By Bills'}).nth(8);
 //await page.getByRole('option', { name: 'All' }).click();
 await page.getByRole('option', { name: 'Pending' }).click();
  await page.getByRole('button', { name: /28\/Oct-03\/Nov/ }).click();
  await page.getByRole('combobox').first().selectOption('8');
  await page.getByRole('button', { name: '1' }).nth(1).click();
  await page.getByRole('button', { name: '30' }).nth(2).click();
  await page.getByRole('button', { name: 'Apply' }).click();
 await page.pause();
  const resultsTable = page.locator('table');
  await expect(resultsTable).toBeVisible();
  const searchBox = page.getByRole('textbox', { name: 'Search' });
  await expect(searchBox).toBeVisible();

  for (const supplier of supplierNames) {
    await searchBox.fill('');
    await searchBox.fill(supplier);
    await expect(searchBox).toHaveValue(supplier);
    await searchBox.press('Enter');

    const matchingRows = page.getByRole('row').filter({ hasText: supplier });
    let previousTableText = '';
    let stableSince = Date.now();

    try {
      await expect
        .poll(
          async () => {
            const tableText = await resultsTable.innerText();
            const isLoading = await page.getByRole('progressbar').isVisible();
            if (tableText !== previousTableText) {
              previousTableText = tableText;
              stableSince = Date.now();
            }
            return (
              !isLoading &&
              tableText.toLowerCase().includes(supplier.toLowerCase()) &&
              Date.now() - stableSince >= 1_000
            );
          },
          { timeout: 60_000, intervals: [250, 500, 1_000] },
        )
        .toBe(true);
    } catch (error) {
      try {
        await searchBox.fill('');
      } catch {
        // The page or search box may have been re-rendered or the session expired.
      }
      console.warn(
        `Supplier "${supplier}" is not available in the search results. Moving to the next supplier.`,
      );
      continue;
    }

    await expect(matchingRows.first()).toBeVisible();
    await expect(
      matchingRows.first().getByLabel('Change Payment Mode'),
    ).toBeVisible();

    const initialMatchingRowCount = await matchingRows.count();
    if (initialMatchingRowCount === 0) {
      console.warn(
        `Supplier "${supplier}" matched no rows after search. Moving to the next supplier.`,
      );
      continue;
    }

    for (let i = 0; i < initialMatchingRowCount; i++) {
      const row = matchingRows.first();
      await expect(row).toBeVisible();
      const rowId = (await row.locator('td').first().innerText()).trim();
      const processedRow = page
        .getByRole('row')
        .filter({ has: page.getByText(rowId, { exact: true }) });
      await row.getByLabel('Change Payment Mode').click();

      const rtgsOption = page.getByRole('menuitem', { name: 'RTGS/NEFT' });
      await expect(rtgsOption).toBeVisible({ timeout: 30_000 });
      await rtgsOption.click();

      const paymentButton = page.getByRole('button', { name: 'Payment' });
      await expect(paymentButton).toBeVisible();
      await expect(paymentButton).toBeEnabled();
      await paymentButton.click();

      const payableAmountMessage = page.getByText('Payable Amount should greater than 0');
      if (await payableAmountMessage.isVisible()) {
        await paymentButton.click();
      }

      await expect(page.getByText('Payment marked as received')).toBeVisible({
        timeout: 30_000,
      });
      await expect(processedRow).toBeHidden({ timeout: 60_000 });
      await expect(page.getByRole('progressbar')).toBeHidden({ timeout: 60_000 });
    }


    console.log(`Supplier completed: ${supplier}`);
  }
});