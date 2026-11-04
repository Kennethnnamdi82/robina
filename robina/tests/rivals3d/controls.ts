import { expect,type Page } from '@playwright/test';
const names: Record<string,string> = { 'TACTICAL / TOP-DOWN': 'tactical','ACTION / SIDE-VIEW': 'side','THIRD-PERSON / TPS': 'third','FIRST-PERSON / FPS': 'first' };
export async function selectPOV(page: Page,label: string) {
  const target = names[label] ?? label,state = page.getByTestId('three-state');
  for (let i = 0; i < 4; i++) { const before = await state.getAttribute('data-pov'); if (before === target) return; await page.getByRole('button',{ name: 'Cycle camera view' }).click(); await expect(state).not.toHaveAttribute('data-pov',before!); }
  await expect(state).toHaveAttribute('data-pov',target);
}
