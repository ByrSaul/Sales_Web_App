import { expect, test } from '@playwright/test';
import { installMockApi } from './mockApi';

test.beforeEach(async ({ page }) => { await installMockApi(page); });

test('@smoke authenticates without Microsoft and completes the operational context', async ({ page }) => {
  const pageErrors: string[] = []; page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/login');
  expect(pageErrors).toEqual([]);
  await expect(page).toHaveURL(/\/company$/);
  await expect(page.getByRole('heading', { name: 'Favor seleccione la empresa' })).toBeVisible();
  await page.getByRole('button', { name: /Empresa E2E A/ }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: /Vendedor E2E/ }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('heading', { name: /Bienvenido/ })).toBeVisible();
});

test('@smoke supports direct SPA navigation without real credentials or Backend', async ({ page }) => {
  const pageErrors: string[] = []; page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/pedidos');
  expect(pageErrors).toEqual([]);
  await expect(page).toHaveURL(/\/company$/);
  await expect(page.getByText('Empresa E2E A')).toBeVisible();
});
