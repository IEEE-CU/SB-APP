// NEW-06 / AUD-035: creating an announcement from the UI.
//
// Before the fix the form sent { title, content, priority }, with no targetAudience, so every
// attempt answered 400 "Invalid target audience" and the user saw "Failed to save announcement".
// The form now offers the audiences the caller may use (administrator: all members, a society,
// leadership; anyone else: their own society) and sends targetAudience (+ societyId for SOCIETY).
// The backend stays authoritative; the 403 cases are covered by announcement-create.integration.
import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { disposableAdmin, OLD_PASSWORD, signIn, target, TEST_PASSWORD, USERS, watchApi } from './support';

const here = path.dirname(fileURLToPath(import.meta.url));
const nodeRequire = createRequire(import.meta.url);
const { withDatabase } = nodeRequire(path.resolve(here, '../../../backend/test/integration/helpers/target.js'));

const stamp = (label: string) => `ann-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const storedByTitle = (title: string) =>
  withDatabase(target, (db: any) => db.collection('announcements').find({ title }).toArray());

async function fillAndPublish(page: import('@playwright/test').Page, title: string) {
  await page.goto('/announcements/new');
  await page.getByPlaceholder(/Call for Papers/).fill(title);
  await page.getByPlaceholder(/Write broadcast message/).fill('Body written in the browser');
}

test.describe.configure({ mode: 'serial' });

test.describe('announcement creation', () => {
  test('an administrator can publish to all members, to a society and to leadership', async ({ page }) => {
    const admin = await disposableAdmin('announce');
    const apiLog = watchApi(page);
    await signIn(page, admin.email, OLD_PASSWORD);
    const societyA = target.ready.fixtures.societies.A.id;

    const audience = page.getByLabel('Audience');
    await fillAndPublish(page, 'placeholder');
    await expect(audience.locator('option')).toHaveText(['All members', 'A specific society', 'Leadership']);

    const cases: { label: string; value: string; societyId?: string }[] = [
      { label: 'all', value: 'ALL' },
      { label: 'society', value: 'SOCIETY', societyId: societyA },
      { label: 'leadership', value: 'LEADERSHIP' },
    ];
    for (const c of cases) {
      const title = stamp(c.label);
      await fillAndPublish(page, title);
      await audience.selectOption(c.value);
      if (c.societyId) await page.getByLabel(/^Society/).selectOption(c.societyId);
      await page.getByRole('button', { name: 'Publish Broadcast' }).click();
      await expect(page).toHaveURL(/\/announcements$/);

      const [doc] = await storedByTitle(title);
      expect(doc.targetAudience).toBe(c.value);
      expect(String(doc.societyId ?? '')).toBe(c.societyId ?? '');
      expect(String(doc.createdBy)).toBe(admin.id);
    }

    const posts = apiLog.requests.filter((r) => r.method === 'POST' && r.path === '/api/v1/announcements');
    expect(posts).toHaveLength(3);
    expect(posts.every((p) => JSON.parse(p.body ?? '{}').targetAudience)).toBe(true);
    expect(apiLog.responses.filter((r) => r.path === '/api/v1/announcements' && r.status >= 400)).toEqual([]);
  });

  test('a society chair is offered only their own society and can publish to it', async ({ page }) => {
    const apiLog = watchApi(page);
    await signIn(page, USERS.chairA.email, TEST_PASSWORD);
    const societyA = target.ready.fixtures.societies.A.id;
    const title = stamp('chair');

    await fillAndPublish(page, title);
    await expect(page.getByLabel('Audience').locator('option')).toHaveText(['My society']);
    await expect(page.getByLabel(/^Society/)).toHaveCount(0);
    await page.getByRole('button', { name: 'Publish Broadcast' }).click();
    await expect(page).toHaveURL(/\/announcements$/);

    const [doc] = await storedByTitle(title);
    expect(doc.targetAudience).toBe('SOCIETY');
    expect(String(doc.societyId)).toBe(societyA);
    expect(String(doc.createdBy)).toBe(target.ready.fixtures.users.chairA.id);

    const post = apiLog.requests.find((r) => r.method === 'POST' && r.path === '/api/v1/announcements');
    expect(JSON.parse(post!.body!)).toMatchObject({ targetAudience: 'SOCIETY', societyId: societyA });
    expect(apiLog.responses.filter((r) => r.path === '/api/v1/announcements' && r.status >= 400)).toEqual([]);
  });
});
