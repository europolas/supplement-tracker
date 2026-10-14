import { test, expect } from '@playwright/test';
async function add(page, name = 'My supplement') {
  await page.getByRole('link', { name: 'Supplements', exact: true }).click();
  await page.locator('#supplement-form [name="name"]').fill(name);
  await page.locator('#supplement-form [name="amount"]').fill('My label amount');
  await page.locator('#supplement-form [name="time"]').fill('08:30');
  await page.locator('#supplement-form button').click();
  await expect(page.locator('#supplement-list')).toContainText(name);
}
test('English foundation keeps full-height layout and real records/completion across reloads', async ({ page }) => {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await expect(page.locator('html')).toHaveAttribute('lang','en');
  await expect(page.locator('#today-empty')).toBeVisible();
  const layout=await page.evaluate(()=>({bottom:document.querySelector('main').getBoundingClientRect().bottom,height:innerHeight,scroll:getComputedStyle(document.querySelector('main')).scrollbarWidth}));
  expect(layout.bottom).toBe(layout.height);expect(layout.scroll).toBe('none');
  await add(page,'My <b>supplement</b>');
  await page.getByRole('link',{name:'Today',exact:true}).click();
  await page.getByRole('button',{name:'Mark as taken',exact:true}).click();
  await expect(page.locator('#today-progress')).toHaveText('1 of 1 taken today');
  await page.reload();await expect(page.locator('#today-progress')).toHaveText('1 of 1 taken today');
  await expect(page.locator('#today-list b')).toHaveCount(0);
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await expect(page.locator('#today-progress')).toHaveText('0 of 1 taken today');expect(errors).toEqual([]);
});
test('Lithuanian and theme persist while an unsaved supplement name survives translation', async ({ page }) => {
  await page.goto('/');await page.getByRole('link',{name:'Supplements',exact:true}).click();
  await page.locator('#supplement-form [name="name"]').fill('Unfinished entry');
  await page.getByRole('link',{name:'Settings',exact:true}).click();
  await page.locator('[name="language"]').selectOption('lt');await page.locator('[name="theme"]').selectOption('light');
  await page.locator('#settings-form button').click();
  await expect(page.locator('html')).toHaveAttribute('lang','lt');
  await page.getByRole('link',{name:'Papildai',exact:true}).click();
  await expect(page.locator('#supplement-form [name="name"]')).toHaveValue('Unfinished entry');
  await expect(page.locator('#supplement-form')).toContainText('Papildo pavadinimas');
  await page.reload();await expect(page.locator('html')).toHaveAttribute('lang','lt');await expect(page.locator('html')).toHaveAttribute('data-theme','light');
});
test('archive requires confirmation and removes a supplement from the active routine', async ({ page }) => {
  await page.goto('/');await add(page);
  await page.getByRole('button',{name:'Archive',exact:true}).click();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.locator('#supplement-list li')).toHaveCount(1);
  await page.getByRole('button',{name:'Archive',exact:true}).click();await page.getByRole('button',{name:'Confirm',exact:true}).click();
  await expect(page.locator('#supplement-list li')).toHaveCount(0);
  await page.reload();await expect(page.locator('#supplement-empty')).toBeVisible();
});
test('installed shell and existing routine remain usable offline', async ({ page, context }) => {
  await page.goto('/');await add(page);
  await page.getByRole('link',{name:'Today',exact:true}).click();
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);await page.reload();
  await expect(page.locator('#today-list')).toContainText('My supplement');
  await page.getByRole('button',{name:'Mark as taken',exact:true}).click();
  await expect(page.locator('#today-progress')).toHaveText('1 of 1 taken today');
});
