import { test, expect } from '../fixtures/auth.fixture';
import { DashboardPage } from '../pages/dashboard.page';
import { MattersPage } from '../pages/matters.page';

/**
 * Flow 6: SOL Deadline — Create Matter with Date → Verify on Dashboard
 *
 * Source-verified against: matters/new/page.tsx (wizard),
 *   dashboard/page.tsx (kpi-upcoming-deadlines)
 *
 * Refs: SPR-003 (SOL tracking), SPR-009-ARCH (A-E2E-008)
 */
test.describe('Flow 6: SOL Deadline', () => {
  const ts = Date.now();

  test('should create matter with deadline via wizard', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const mattersPage = new MattersPage(page);

    // Navigate to matters and start wizard
    await mattersPage.goto();
    await mattersPage.verifyLoaded();
    await mattersPage.clickNewMatter();

    // Step 1: Select Client
    await mattersPage.selectClient('E2E Test');
    await mattersPage.clickNext();

    // Step 2: Case Details — fill title + accident date
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];
    await mattersPage.fillCaseDetails({
      title: `SOL Test Matter ${ts}`,
      accidentDate: futureDate,
      description: 'E2E SOL deadline test',
    });
    await mattersPage.clickNext();

    // Step 3: Fee Arrangement — accept defaults
    await mattersPage.clickNext();

    // Step 4: Insurance — skip
    await mattersPage.clickNext();

    // Step 5: Review + Submit
    await mattersPage.submitMatter();
    await page.waitForTimeout(2000);
  });

  test('should show deadline KPI on dashboard', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const dashboardPage = new DashboardPage(page);

    await dashboardPage.goto();
    await dashboardPage.verifyLoaded();

    // Verify "Upcoming Deadlines (7d)" KPI card exists
    await expect(page.locator('[data-testid="kpi-upcoming-deadlines"]')).toBeVisible();
  });
});
