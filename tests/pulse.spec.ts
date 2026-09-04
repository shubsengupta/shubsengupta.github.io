import { test, expect } from '@playwright/test';

test('pulse renders and responds', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#pulse-svg .day')).toHaveCount(371);

  const active = page.locator('#pulse-svg .day:has([data-source])').last();
  const date = (await active.getAttribute('data-date'))!;
  await active.hover();
  const dayNum = String(new Date(date + 'T00:00:00Z').getUTCDate());
  await expect(page.locator('#pulse-readout')).toContainText(` ${dayNum} ·`);

  await page.locator('.src[data-source="cio"]').click();
  await expect(page.locator('#pulse-svg [data-source="cio"]')).toHaveCount(0);

  await page.locator('.step[data-step="1"]').click();
  await expect(page.locator('#pulse-year')).toHaveText(String(new Date().getUTCFullYear() - 1));

  await page.locator('#pulse-svg').focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#pulse-svg .day.focus')).toHaveCount(1);
});

test('career strip picks a year and tooltip follows hover', async ({ page }) => {
  await page.goto('/');
  await page.locator('.yr[data-year="2019"]').click();
  await expect(page.locator('#pulse-year')).toHaveText('2019');
  await expect(page.locator('#pulse-readout')).toContainText('2019');
  await expect(page.locator('#pulse-svg [data-source="vidyard"]').first()).toBeAttached();
  const active = page.locator('#pulse-svg .day:has([data-source])').last();
  await active.hover();
  await expect(page.locator('#pulse-tip')).toBeVisible();
  await expect(page.locator('#pulse-tip')).toContainText('Vidyard');
});

test('agent signals: stats, tick lane and model band', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#st-prs')).not.toHaveText('0');
  await expect(page.locator('#st-agent')).toContainText('%');
  await expect(page.locator('#pulse-svg .ai').first()).toBeAttached();
  await expect(page.locator('.strip-full .models .seg').first()).toBeAttached();
  await page.locator('.src[data-source="agent"]').click();
  await expect(page.locator('#pulse-svg .ai')).toHaveCount(0);
});

test('writing is wired but empty', async ({ page }) => {
  await page.goto('/writing/');
  await expect(page.getByText('nothing here yet')).toBeVisible();
  const rss = await page.request.get('/rss.xml');
  expect(rss.status()).toBe(200);
});
