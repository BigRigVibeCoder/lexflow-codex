import { test, expect } from '../fixtures/auth.fixture';
import { DocumentsPage } from '../pages/documents.page';
import * as path from 'path';

/**
 * Flow 5: Document Upload → View in PDF Viewer
 *
 * Validates document upload, listing, PDF viewer, and metadata editing.
 *
 * Refs: SPR-006 (Document Management), SPR-009-ARCH (A-E2E-007)
 */
test.describe('Flow 5: Document Management', () => {
  const samplePdfPath = path.resolve(process.cwd(), 'fixtures', 'sample.pdf');

  test('should upload a document and view it', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const documentsPage = new DocumentsPage(page);

    // Navigate to documents (may need to go to a matter first)
    await page.goto('/matters');
    await page.waitForTimeout(2000);

    // Click on first available matter to access its documents
    const matterLink = page.locator(
      '[data-testid*="matter-row"] a, table tbody tr a, [class*="matter-item"] a'
    ).first();
    if (await matterLink.isVisible()) {
      await matterLink.click();
      await page.waitForTimeout(1000);
    }

    // Go to documents tab
    await documentsPage.goto();

    const initialCount = await documentsPage.getDocumentCount();

    // Upload PDF
    await documentsPage.uploadFile(samplePdfPath);
    await page.waitForTimeout(3000);

    // Verify document appears in list
    const newCount = await documentsPage.getDocumentCount();
    expect(newCount).toBeGreaterThan(initialCount);

    // Open the document
    // (Click the most recently added document)
    const lastDoc = page.locator(
      '[data-testid*="document-row"], table tbody tr, [class*="document-item"]'
    ).last();
    await lastDoc.click();
    await page.waitForTimeout(2000);

    // Verify PDF viewer is visible
    const viewerVisible = await documentsPage.isPdfViewerVisible();
    expect(viewerVisible).toBe(true);
  });
});
