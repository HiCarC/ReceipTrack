import { test, expect } from '@playwright/test';

test.describe('groups flow', () => {
  test('creates a group and adds an expense', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Groups' }).click();
    await expect(page.getByText('E2E Dinner Club')).toBeVisible();

    const groupButton = page.getByTestId('group-item', { hasText: 'E2E Dinner Club' }).first();
    await groupButton.click();
    await expect(page.getByTestId('group-header')).toBeVisible();
    await page.getByText('Balances', { exact: true }).click();
    await page.getByRole('button', { name: /add expense/i }).click();

    await page.getByPlaceholder('0.00').fill('42');
    await page.getByPlaceholder('What is this for?').fill('Gas');
    await page.locator('input[type="date"]').fill('2026-01-03');
    await page.getByRole('button', { name: /^save$/i }).click();

    await page.getByRole('button', { name: 'Expenses' }).click();
    await expect(page.getByText('Gas')).toBeVisible();
  });
});
