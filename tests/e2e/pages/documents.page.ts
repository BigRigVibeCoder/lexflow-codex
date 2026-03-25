import { type Page, expect } from '@playwright/test';

/**
 * Documents Page Object Model
 *
 * Source: src/app/(dashboard)/documents/page.tsx
 * Route: /documents (list + search, NO upload on this page)
 *
 * testids: document-list-page, doc-search, category-filter, document-table
 *
 * NOTE: The documents list page does NOT have an upload form or file input.
 * Document upload may exist on matter-specific document tabs (not yet in main nav).
 *
 * Refs: SPR-006 (Document Management)
 */
export class DocumentsPage {
  constructor(private page: Page) {}

  /** Navigate to documents list */
  async goto(): Promise<void> {
    await this.page.goto('/documents');
  }

  /** Search for documents */
  async search(query: string): Promise<void> {
    await this.page.locator('[data-testid="doc-search"]').fill(query);
  }

  /** Filter by category */
  async filterByCategory(category: string): Promise<void> {
    await this.page.locator('[data-testid="category-filter"]').selectOption(category);
  }

  /** Get document count in the table */
  async getDocumentCount(): Promise<number> {
    const rows = this.page.locator('[data-testid="document-table"] tbody tr');
    return await rows.count();
  }

  /** Verify documents page loaded */
  async verifyLoaded(): Promise<void> {
    await expect(this.page.locator('[data-testid="document-list-page"]'))
      .toBeVisible({ timeout: 10_000 });
  }
}
