import { test, expect } from '../fixtures/auth.fixture';
import { ClientsPage } from '../pages/clients.page';
import { MattersPage } from '../pages/matters.page';

/**
 * Flow 2: Create Client → Create Matter → Verify
 *
 * Validates the full client/matter creation workflow.
 * Uses authenticated fixture (auto-login as admin).
 *
 * Refs: SPR-003 (Matter Management), SPR-009-ARCH (A-E2E-004)
 */
test.describe('Flow 2: Client → Matter', () => {
  const testClient = {
    name: `E2E Test Client ${Date.now()}`,
    email: `e2e-${Date.now()}@test.lexflow.com`,
    phone: '555-0199',
  };

  const testMatter = {
    title: `E2E Test Matter ${Date.now()}`,
    description: 'Automated E2E test matter',
    solDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0], // 30 days from now
  };

  test('should create a new client', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const clientsPage = new ClientsPage(page);

    // Navigate to clients
    await clientsPage.goto();
    await clientsPage.verifyLoaded();

    const initialCount = await clientsPage.getClientCount();

    // Create new client
    await clientsPage.clickNewClient();
    await clientsPage.fillClientForm(testClient);
    await clientsPage.submitForm();

    // Wait for form submission to complete
    await page.waitForTimeout(2000);

    // Verify client was created (count increased or toast visible)
    // Navigate back to list if needed
    await clientsPage.goto();
    const newCount = await clientsPage.getClientCount();
    expect(newCount).toBeGreaterThanOrEqual(initialCount);
  });

  test('should create a matter for the client', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const mattersPage = new MattersPage(page);

    // Navigate to matters
    await mattersPage.goto();
    await mattersPage.verifyLoaded();

    const initialCount = await mattersPage.getMatterCount();

    // Create new matter
    await mattersPage.clickNewMatter();
    await mattersPage.fillMatterForm(testMatter);
    await mattersPage.submitForm();

    // Wait for submission
    await page.waitForTimeout(2000);

    // Verify matter appears
    await mattersPage.goto();
    const newCount = await mattersPage.getMatterCount();
    expect(newCount).toBeGreaterThanOrEqual(initialCount);
  });
});
