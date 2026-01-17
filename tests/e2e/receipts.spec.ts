import { test, expect } from '@playwright/test';

test.describe('receipts flow', () => {
  test('adds and deletes a manual receipt', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Receipts' }).click();
    await page.getByRole('button', { name: 'Scan receipt' }).click();
    await page.getByRole('button', { name: /enter manually/i }).click();

    await page.locator('#total').fill('25.50');
    await page.getByLabel(/merchant/i).fill('E2E Market');
    await page.getByLabel('Date').fill('2026-01-02');
    await page.getByRole('button', { name: /add item/i }).click();
    await page.getByPlaceholder('Item name').fill('Milk');
    await page.getByPlaceholder('0.00').nth(1).fill('2.50');
    await page.getByRole('button', { name: /save receipt/i }).click();

    await expect(page.getByText('Add Receipt')).toHaveCount(0);
    await page.getByRole('button', { name: 'Receipts' }).click();
    await expect(page.getByText('E2E Market')).toBeVisible();

    await page.getByText('E2E Market').click();
    await page.getByRole('button', { name: /delete receipt/i }).first().click();
    await page.getByRole('button', { name: /^delete$/i }).click();

    await expect(page.getByText('E2E Market')).toHaveCount(0);
  });
});
