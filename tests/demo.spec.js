// tests/demo.spec.js
/**
 * EventPulse — Full E2E Demo Flow
 * ════════════════════════════════
 * Uses a test-seed API endpoint to create an already-approved organizer,
 * bypassing the admin-approval registration gate.
 *
 * Matches actual HTML structure:
 *   - author-login.html: #author-email, #author-password, #login-btn
 *   - dashboard.html: sidebar go('section'), #mo modal, #m-name, #m-date,
 *                     #m-cat, #m-loc, #m-att, #mok, #org-name, #qa-event-sel
 *   - attendance.html: #form-state, #att-name, #att-roll, #submit-btn, #success-state
 */

const { test, expect } = require('@playwright/test');
const path  = require('path');
const fs    = require('fs');

// ── Unique test credentials ────────────────────────────────────────────────
const TS         = Date.now();
const TEST_EMAIL = `e2e${TS}@eventpulse.test`;
const TEST_PASS  = 'Demo1234!';
const TEST_NAME  = 'E2E Test Organizer';
const EVENT_NAME = `E2E Workshop ${TS}`;

// ── Helpers ────────────────────────────────────────────────────────────────
async function safeClick(page, selector) {
  const el = page.locator(selector).first();
  await el.waitFor({ state: 'visible', timeout: 15000 });
  await el.scrollIntoViewIfNeeded();
  await el.click();
}

// ══════════════════════════════════════════════════════════════════════════
test('EventPulse Full Demo Flow', async ({ page, request }) => {
  // Debug: log browser API errors only
  page.on('pageerror', err => console.log(`[PageError]: ${err.message}`));
  page.on('response', res => {
    if (!res.ok() && res.url().includes('/api/')) {
      console.log(`[API Fail] ${res.status()} ${res.url()}`);
    }
  });

  // ── STEP 0: Seed approved organizer via test API ───────────────────────
  await test.step('0 · Seed approved organizer account', async () => {
    const res = await request.post('/api/v1/test/seed-organizer', {
      data: { name: TEST_NAME, email: TEST_EMAIL, password: TEST_PASS },
    });
    expect(res.status(), `Seed failed: ${await res.text()}`).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    console.log(`[Test] Seeded organizer: ${body.data.email}`);
  });

  // ── STEP 1: Homepage ───────────────────────────────────────────────────
  await test.step('1 · Open homepage', async () => {
    await page.goto('/');
    await expect(page).toHaveTitle(/EventPulse/i);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);
  });

  // ── STEP 2: Login as the seeded organizer ─────────────────────────────
  await test.step('2 · Login as organizer', async () => {
    await page.goto('/author-login.html');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#author-email')).toBeVisible({ timeout: 10000 });

    await page.fill('#author-email',    TEST_EMAIL);
    await page.fill('#author-password', TEST_PASS);
    await page.waitForTimeout(300);

    await page.click('#login-btn');

    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard.html', { timeout: 25000 });
    await page.waitForLoadState('networkidle');
  });

  // ── STEP 3: Verify dashboard loaded ───────────────────────────────────
  await test.step('3 · Dashboard loaded, organizer info visible', async () => {
    await expect(page).toHaveURL(/dashboard\.html/);
    await page.locator('#org-name').waitFor({ state: 'visible', timeout: 15000 });
    const orgName = await page.locator('#org-name').textContent();
    expect(orgName?.trim()).toBeTruthy();
    await expect(page.locator('#stat-responses')).toBeVisible();
    await page.waitForTimeout(600);
  });

  // ── STEP 4: Create event from dashboard modal ─────────────────────────
  await test.step('4 · Create new event with attendance enabled', async () => {
    await safeClick(page, '#create-event-btn');

    // Modal overlay #mo should get class .open
    await page.locator('#mo.open').waitFor({ state: 'visible', timeout: 10000 });

    // Fill form fields (rendered dynamically into #mbody)
    await page.locator('#m-name').fill(EVENT_NAME);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    await page.locator('#m-date').fill(dateStr);
    await page.locator('#m-cat').selectOption('Workshop');
    await page.locator('#m-loc').fill('Main Auditorium');

    // Ensure attendance checkbox is checked
    const attChk = page.locator('#m-att');
    if (!(await attChk.isChecked())) await attChk.check();

    await page.waitForTimeout(300);
    await safeClick(page, '#mok');

    // Wait for modal to close
    await page.locator('#mo.open').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
  });

  // ── STEP 5: Verify event in Events section ────────────────────────────
  await test.step('5 · Event appears in Events section', async () => {
    await page.evaluate(() => go('events'));
    await page.waitForTimeout(600);

    const evGrid = page.locator('#ev-grid');
    await evGrid.waitFor({ state: 'visible', timeout: 10000 });

    const eventEl = evGrid.locator(`text=${EVENT_NAME}`).first();
    await eventEl.waitFor({ timeout: 10000 });
    await expect(eventEl).toBeVisible();
  });

  // ── STEP 6: Get attendance URL for the created event ──────────────────
  let attendanceUrl;
  await test.step('6 · Get attendance URL from backend API', async () => {
    const res = await page.request.get('/api/v1/events');
    const body = await res.json();
    const events = body?.data?.events || body?.data || [];
    const evt = events.find(e => e.title === EVENT_NAME);
    expect(evt, `Event "${EVENT_NAME}" not found in API`).toBeTruthy();

    // Use the pre-signed attendanceLink if available (has JWT token)
    attendanceUrl = evt.attendanceLink
      ? `http://localhost:5000${evt.attendanceLink}`
      : `http://localhost:5000/attendance.html?eventId=${evt._id}`;

    console.log(`[Test] Attendance URL: ${attendanceUrl}`);
    expect(attendanceUrl).toContain('eventId');

    // Show QR attendance panel in dashboard
    await page.evaluate(() => go('qr-attendance'));
    await page.waitForTimeout(500);

    const sel = page.locator('#qa-event-sel');
    await sel.waitFor({ state: 'visible', timeout: 8000 });

    // Select event by its _id
    await page.evaluate((id) => {
      const s = document.getElementById('qa-event-sel');
      if (s) { s.value = id; s.dispatchEvent(new Event('change')); }
    }, evt._id);

    // Wait for QR content panel to become visible (attendance is enabled)
    await page.locator('#qa-content').waitFor({ state: 'visible', timeout: 12000 });
    await page.waitForTimeout(600);
  });

  // ── STEP 7: Submit attendance via the QR link ─────────────────────────
  await test.step('7 · Submit attendance via QR form', async () => {
    await page.goto(attendanceUrl);
    await page.waitForLoadState('networkidle');

    // Wait for form state to appear
    await page.locator('#form-state').waitFor({ state: 'visible', timeout: 20000 });
    await expect(page.locator('#event-name')).toBeVisible();

    await page.fill('#att-name', 'Test Student');
    await page.fill('#att-roll', 'CS2024001');
    await page.waitForTimeout(300);

    await page.click('#submit-btn');

    // Wait for success state
    await page.locator('#success-state').waitFor({ state: 'visible', timeout: 15000 });
    await expect(page.locator('#success-name')).toContainText('Test Student');
    await page.waitForTimeout(800);
  });

  // ── STEP 8: Back to dashboard ─────────────────────────────────────────
  await test.step('8 · Dashboard shows updated attendance', async () => {
    await page.goto('/dashboard.html');
    await page.waitForLoadState('networkidle');
    await page.locator('#org-name').waitFor({ state: 'visible', timeout: 15000 });

    await page.evaluate(() => go('qr-attendance'));
    await page.waitForTimeout(800);
  });

  // ── STEP 9: Reports section ───────────────────────────────────────────
  await test.step('9 · Navigate to Reports section', async () => {
    await page.evaluate(() => go('reports'));
    await page.waitForTimeout(600);

    const grid = page.locator('#rp-grid');
    await grid.waitFor({ state: 'visible', timeout: 10000 });
    await expect(page.locator('#reports-mini-stats')).toBeVisible();
    await page.waitForTimeout(400);
  });

  // ── STEP 10: Download report ──────────────────────────────────────────
  await test.step('10 · Download report CSV', async () => {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      page.locator('.bp').filter({ hasText: 'Download' }).first().click(),
    ]);
    const fname = download.suggestedFilename();
    expect(fname).toMatch(/\.(csv|txt)$/i);
    const savePath = path.join('test-results', fname || 'report.csv');
    fs.mkdirSync('test-results', { recursive: true });
    await download.saveAs(savePath);
    await page.waitForTimeout(400);
  });

  // ── STEP 11: Logout ────────────────────────────────────────────────────
  await test.step('11 · Logout clears session', async () => {
    await page.evaluate(() => {
      if (typeof logout === 'function') logout();
      else {
        localStorage.removeItem('ep_token');
        localStorage.removeItem('ep_organizer');
        window.location.href = '/author-login.html';
      }
    });

    await page.waitForURL(/login\.html|author-login\.html|index\.html|\/$/, { timeout: 15000 });

    const token = await page.evaluate(() => localStorage.getItem('ep_token'));
    expect(token).toBeNull();
    await page.waitForTimeout(600);
  });

  // ── CLEANUP: Remove seeded test data ──────────────────────────────────
  await test.step('Cleanup · Remove seeded test organizer', async () => {
    const res = await request.delete('/api/v1/test/cleanup-organizer', {
      data: { email: TEST_EMAIL },
    });
    expect(res.ok()).toBe(true);
  });
});
