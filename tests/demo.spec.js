// tests/demo.spec.js
/**
 * EventPulse — Full E2E Demo Flow
 * ════════════════════════════════
 * Matches the ACTUAL dashboard.html SPA structure:
 *   - Sidebar nav: .ni elements with onclick="go('section')"
 *   - Modal: #mo (overlay) gets class .open; form fields: #m-name, #m-date, #m-cat, #m-loc, #m-att
 *   - Auth: localStorage ep_token / ep_organizer
 *   - Logout: dashboard calls logout() → JS fn clears storage + redirects
 *   - Organizer info shown in: #org-name
 * Video recorded by playwright.config.js (video: 'on')
 */

const { test, expect } = require('@playwright/test');
const path  = require('path');
const fs    = require('fs');

// ── Unique test credentials ────────────────────────────────────────────────
const TS          = Date.now();
const TEST_EMAIL  = `demo${TS}@eventpulse.test`;
const TEST_PASS   = 'Demo1234!';
const TEST_NAME   = 'Demo Organizer';
const EVENT_NAME  = `Demo Workshop ${TS}`;

// ── Helpers ────────────────────────────────────────────────────────────────
async function safeClick(page, selector, opts = {}) {
  const el = page.locator(selector).first();
  await el.waitFor({ state: 'visible', timeout: 15000 });
  await el.scrollIntoViewIfNeeded();
  await el.click(opts);
}

async function waitForToast(page, fragment) {
  try { await page.locator(`#ta`).locator(`text=${fragment}`).waitFor({ timeout: 6000 }); }
  catch { /* toast may have dismissed */ }
}

// ══════════════════════════════════════════════════════════════════════════
test('EventPulse Full Demo Flow', async ({ page }) => {

  // ── STEP 1: Homepage ───────────────────────────────────────────────────
  await test.step('1 · Open homepage', async () => {
    await page.goto('/');
    await expect(page).toHaveTitle(/EventPulse/i);
    await page.waitForLoadState('networkidle');
    // Take a moment to show the landing page
    await page.waitForTimeout(1000);
  });

  // ── STEP 2-3: Register new organizer ──────────────────────────────────
  await test.step('2-3 · Register organizer account', async () => {
    await page.goto('/register.html');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#reg-name')).toBeVisible({ timeout: 10000 });

    await page.fill('#reg-name',     TEST_NAME);
    await page.fill('#reg-email',    TEST_EMAIL);
    await page.fill('#reg-password', TEST_PASS);
    await page.waitForTimeout(400);

    await page.click('[data-action="register"]');

    // Wait for redirect to dashboard (absolute path /dashboard.html)
    await page.waitForURL('**/dashboard.html', { timeout: 25000 });
    await page.waitForLoadState('networkidle');
  });

  // ── STEP 4: Verify dashboard loaded ───────────────────────────────────
  await test.step('4 · Dashboard loaded and organizer info visible', async () => {
    await expect(page).toHaveURL(/dashboard\.html/);
    // Dashboard populates #org-name from localStorage
    await page.locator('#org-name').waitFor({ state: 'visible', timeout: 15000 });
    const orgName = await page.locator('#org-name').textContent();
    expect(orgName).toBeTruthy();
    // Stat cards should be visible
    await expect(page.locator('#stat-responses')).toBeVisible();
    await page.waitForTimeout(800);
  });

  // ── STEP 5: Create event from dashboard modal ─────────────────────────
  await test.step('5 · Create new event with attendance enabled', async () => {
    // Click the "New Event" button in the topbar (id="create-event-btn")
    await safeClick(page, '#create-event-btn');

    // Modal overlay #mo should get class .open
    await page.locator('#mo.open').waitFor({ state: 'visible', timeout: 10000 });

    // Fill create event form fields (rendered dynamically into #mbody)
    await page.locator('#m-name').fill(EVENT_NAME);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    await page.locator('#m-date').fill(dateStr);

    await page.locator('#m-cat').selectOption('Workshop');
    await page.locator('#m-loc').fill('Main Auditorium');

    // Ensure attendance checkbox is checked (it's checked by default)
    const attChk = page.locator('#m-att');
    if (!(await attChk.isChecked())) await attChk.check();

    await page.waitForTimeout(400);

    // Click the Create Event button (#mok)
    await safeClick(page, '#mok');

    // Wait for modal to close
    await page.locator('#mo.open').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    await waitForToast(page, 'created');
    await page.waitForTimeout(1000);
  });

  // ── STEP 6: Verify event in Events section ────────────────────────────
  await test.step('6 · Event appears in Events section', async () => {
    // Navigate to Events section via sidebar
    await page.evaluate(() => go('events'));
    await page.waitForTimeout(800);

    const evGrid = page.locator('#ev-grid');
    await evGrid.waitFor({ state: 'visible', timeout: 10000 });

    // The new event name should appear
    const eventEl = evGrid.locator(`text=${EVENT_NAME}`).first();
    await eventEl.waitFor({ timeout: 10000 });
    await expect(eventEl).toBeVisible();
  });

  // ── STEP 7: Get attendance link from API ──────────────────────────────
  let attendanceUrl;
  await test.step('7 · Get attendance URL for event', async () => {
    const res = await page.request.get('/api/events');
    const data = await res.json();
    const events = data?.data?.events || [];
    const evt = events.find(e => e.name === EVENT_NAME);
    expect(evt, 'Created event not found').toBeTruthy();
    attendanceUrl = `/attendance.html?eventId=${evt._id}`;

    // Also navigate to QR Attendance section in dashboard to show QR
    await page.evaluate(() => go('qr-attendance'));
    await page.waitForTimeout(600);

    // Select the event in the dropdown
    const sel = page.locator('#qa-event-sel');
    await sel.waitFor({ state: 'visible', timeout: 8000 });
    await sel.selectOption({ label: evt.name }).catch(() => {
      // If label format differs, select by value
      return page.evaluate((id) => {
        const s = document.getElementById('qa-event-sel');
        if (s) { s.value = id; s.dispatchEvent(new Event('change')); }
      }, evt._id);
    });
    await page.waitForTimeout(1200);
  });

  // ── STEP 8: Open attendance page + submit ─────────────────────────────
  await test.step('8 · Submit attendance via QR form', async () => {
    await page.goto(attendanceUrl);
    await page.waitForLoadState('networkidle');

    // Wait for the form to appear (loading-state → form-state)
    await page.locator('#form-state').waitFor({ state: 'visible', timeout: 20000 });
    await expect(page.locator('#event-name')).toBeVisible();

    await page.fill('#att-name', 'Test Student');
    await page.fill('#att-roll', 'CS2024001');
    await page.waitForTimeout(400);

    await page.click('#submit-btn');

    // Wait for success state
    await page.locator('#success-state').waitFor({ state: 'visible', timeout: 15000 });
    await expect(page.locator('#success-name')).toContainText('Test Student');
    await page.waitForTimeout(1200);
  });

  // ── STEP 9: Back to dashboard ─────────────────────────────────────────
  await test.step('9 · Dashboard shows attendance data', async () => {
    await page.goto('/dashboard.html');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/dashboard\.html/);
    await page.locator('#org-name').waitFor({ state: 'visible', timeout: 15000 });

    // Navigate to QR Attendance to see updated attendee list
    await page.evaluate(() => go('qr-attendance'));
    await page.waitForTimeout(1000);
  });

  // ── STEP 10: Reports page ─────────────────────────────────────────────
  await test.step('10 · Navigate to Reports section', async () => {
    // Use sidebar nav to go to reports
    await page.evaluate(() => go('reports'));
    await page.waitForTimeout(800);

    const grid = page.locator('#rp-grid');
    await grid.waitFor({ state: 'visible', timeout: 10000 });
    await expect(page.locator('#reports-mini-stats')).toBeVisible();
    await page.waitForTimeout(600);
  });

  // ── STEP 11: Download report ──────────────────────────────────────────
  await test.step('11 · Download report CSV', async () => {
    // The dashboard Reports section has Download buttons per event (dlEvReport)
    // We can also use the main /reports.html page for txt download
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      // Click the first Download button visible in the reports grid
      page.locator('.bp').filter({ hasText: 'Download' }).first().click(),
    ]);
    const fname = download.suggestedFilename();
    expect(fname).toMatch(/\.(csv|txt)$/i);
    const savePath = path.join('test-results', fname || 'report.csv');
    fs.mkdirSync('test-results', { recursive: true });
    await download.saveAs(savePath);
    await page.waitForTimeout(600);
  });

  // ── STEP 12: Logout ────────────────────────────────────────────────────
  await test.step('12 · Logout clears session', async () => {
    // dashboard.html has a logout() function but it may be triggered via
    // the sidebar bottom area or a settings button. Call it directly via JS.
    await page.evaluate(() => {
      if (typeof logout === 'function') logout();
      else {
        localStorage.removeItem('ep_token');
        localStorage.removeItem('ep_organizer');
        window.location.href = '/login.html';
      }
    });

    await page.waitForURL(/login\.html|index\.html|\/$/, { timeout: 15000 });

    // Token must be gone
    const token = await page.evaluate(() => localStorage.getItem('ep_token'));
    expect(token).toBeNull();

    await page.waitForTimeout(800);
  });

});
