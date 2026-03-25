import { type Page, expect } from '@playwright/test';

/**
 * Matters Page Object Model
 *
 * Refs: SPR-003 (Matter Management — matter creation, SOL tracking)
 */
export class MattersPage {
  constructor(private page: Page) {}

  /** Navigate to matters list */
  async goto(): Promise<void> {
    await this.page.goto('/matters');
  }

  /** Click "New Matter" button */
  async clickNewMatter(): Promise<void> {
    const newBtn = this.page.locator(
      '[data-testid="new-matter-btn"], [data-testid="new-matter"], button:has-text("New Matter"), button:has-text("Add Matter"), a:has-text("New Matter")'
    ).first();
    await newBtn.click();
  }

  /** Fill the matter creation form */
  async fillMatterForm(data: {
    title: string;
    description?: string;
    type?: string;
    solDate?: string;
  }): Promise<void> {
    await this.page.locator(
      '[data-testid="matter-title"], input[name="title"], input[placeholder*="title" i]'
    ).first().fill(data.title);

    if (data.description) {
      await this.page.locator(
        '[data-testid="matter-description"], textarea[name="description"], textarea'
      ).first().fill(data.description);
    }

    if (data.solDate) {
      await this.page.locator(
        '[data-testid="matter-sol-date"], input[name="solDate"], input[type="date"]'
      ).first().fill(data.solDate);
    }
  }

  /** Submit the matter form */
  async submitForm(): Promise<void> {
    const submitBtn = this.page.locator(
      '[data-testid="submit-matter"], button[type="submit"], button:has-text("Create"), button:has-text("Save")'
    ).first();
    await submitBtn.click();
  }

  /** Get count of matters in the list */
  async getMatterCount(): Promise<number> {
    const rows = this.page.locator(
      '[data-testid*="matter-row"], table tbody tr, [class*="matter-item"]'
    );
    return await rows.count();
  }

  /** Verify the matters list page is loaded */
  async verifyLoaded(): Promise<void> {
    await expect(this.page.locator('h1, h2, [data-testid="matters-heading"]').first())
      .toBeVisible({ timeout: 10_000 });
  }
}
