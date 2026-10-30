import { expect, type Page } from '@playwright/test';
export const entry = '/tests/rivals/index.html';
export async function briefing(page: Page) {
  if (await page.getByRole('button', { name: 'START MISSION', exact: true }).isVisible()) return;
  if (await page.getByRole('button', { name: 'PLAY', exact: true }).isVisible()) await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  else { await page.getByRole('button', { name: /MISSIONS/ }).click(); await page.getByRole('button', { name: /VIEW BRIEFING/ }).click(); }
}
export async function start(page: Page, character?: string) {
  await briefing(page);
  if (character) await page.getByRole('button', { name: 'Select ' + character.toUpperCase() }).click();
  await page.getByRole('button', { name: 'START MISSION', exact: true }).click();
}
export async function enter(page: Page, character?: string) {
  await start(page, character);
  await expect(page.locator('.rivals-game-view')).toHaveAttribute('data-status', 'playing', { timeout: 90000 });
}
export async function leave(page: Page, reload = true) {
  if (await page.locator('.rivals-game-view').getAttribute('data-status') === 'playing') await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  await page.getByRole('button', { name: 'RETURN TO MAIN MENU', exact: true }).click();
  await page.getByRole('button', { name: 'EXIT / BACK', exact: true }).click();
  await page.getByRole('button', { name: 'CONFIRM', exact: true }).click();
  await expect(page.locator('canvas')).toHaveCount(0);
  if (reload) await page.goto(entry);
}
export async function restart(page: Page) {
  if (await page.locator('.rivals-game-view').getAttribute('data-status') === 'playing') await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  await page.getByRole('button', { name: 'RESTART MISSION', exact: true }).click();
  await page.getByRole('button', { name: 'RESTART', exact: true }).click();
  await expect(page.locator('.rivals-game-view')).toHaveAttribute('data-status', 'playing', { timeout: 90000 });
}
