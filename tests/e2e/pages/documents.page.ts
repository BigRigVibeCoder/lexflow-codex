import { type Page, expect } from '@playwright/test';
import { resolve } from 'path';

/**
 * Documents Page Object Model
 *
 * Refs: SPR-006 (Document Management)
 */
export class DocumentsPage {
  constructor(private page: Page) {}

  /** Navigate to documents tab within a matter (or global documents) */
  async goto(): Promise<void> {
    // Navigate to the documents section — may be a tab within a matter
    const docsTab = this.page.locator(
      '[data-testid="documents-tab"], a:has-text("Documents"), button:has-text("Documents")'
    ).first();
    if (await docsTab.isVisible()) {
      await docsTab.click();
    } else {
      await this.page.goto('/documents');
    }
  }

  /** Upload a file via file input (handles drag-and-drop or file picker) */
  async uploadFile(filePath: string): Promise<void> {
    // Look for file input or upload button
    const fileInput = this.page.locator('input[type="file"]').first();
    const absolutePath = resolve(filePath);
    await fileInput.setInputFiles(absolutePath);

    // Wait for upload to complete — look for success indicator
    await this.page.waitForTimeout(2000);
  }

  /** Get document count in the list */
  async getDocumentCount(): Promise<number> {
    const docs = this.page.locator(
      '[data-testid*="document-row"], table tbody tr, [class*="document-item"]'
    );
    return await docs.count();
  }

  /** Click on a document to open PDF viewer */
  async openDocument(name: string): Promise<void> {
    await this.page.locator(`text=${name}`).first().click();
  }

  /** Check if PDF viewer is visible */
  async isPdfViewerVisible(): Promise<boolean> {
    const viewer = this.page.locator(
      '[data-testid="pdf-viewer"], iframe, embed, [class*="pdf"]'
    ).first();
    return await viewer.isVisible();
  }

  /** Edit document metadata */
  async editMetadata(data: { title?: string; category?: string }): Promise<void> {
    if (data.title) {
      const titleInput = this.page.locator(
        '[data-testid="document-title-edit"], input[name="title"]'
      ).first();
      await titleInput.clear();
      await titleInput.fill(data.title);
    }

    if (data.category) {
      const categorySelect = this.page.locator(
        '[data-testid="document-category"], select[name="category"]'
      ).first();
      await categorySelect.selectOption(data.category);
    }
  }

  /** Verify documents page loaded */
  async verifyLoaded(): Promise<void> {
    await expect(
      this.page.locator('h1, h2, h3, [data-testid="documents-heading"]').first()
    ).toBeVisible({ timeout: 10_000 });
  }
}
