import { test, expect } from '../fixtures/auth.fixture';
import { DocumentsPage } from '../pages/documents.page';

/**
 * Flow 5: Document Management — Navigate and Search
 *
 * Source-verified against: documents/page.tsx
 *
 * NOTE: The documents list page has search and category filter,
 * but NO upload functionality on this page.
 * Document upload is per-matter (not yet in the main documents list).
 *
 * Refs: SPR-006 (Document Management), SPR-009-ARCH (A-E2E-007)
 */
test.describe('Flow 5: Document Management', () => {
  test('should navigate to documents page and verify it loads', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const documentsPage = new DocumentsPage(page);

    // Navigate to documents
    await documentsPage.goto();
    await documentsPage.verifyLoaded();

    // Verify search input is present
    await expect(page.locator('[data-testid="doc-search"]')).toBeVisible();

    // Verify category filter is present
    await expect(page.locator('[data-testid="category-filter"]')).toBeVisible();

    // Verify document table is present
    await expect(page.locator('[data-testid="document-table"]')).toBeVisible();
  });

  test('should search and filter documents', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const documentsPage = new DocumentsPage(page);

    await documentsPage.goto();
    await documentsPage.verifyLoaded();

    // Try searching
    await documentsPage.search('test document');
    await page.waitForTimeout(1000);

    // Filter by category
    await documentsPage.filterByCategory('pleading');
    await page.waitForTimeout(1000);

    // Document table should still be visible
    await expect(page.locator('[data-testid="document-table"]')).toBeVisible();
  });
});
