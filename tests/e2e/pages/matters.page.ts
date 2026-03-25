import { type Page, expect } from '@playwright/test';

/**
 * Matters Page Object Model
 *
 * Source: src/app/(dashboard)/matters/page.tsx + matters/new/page.tsx
 * Routes: /matters (list), /matters/new (5-step wizard)
 *
 * List testids: matter-list-page, new-matter-btn (Link to /matters/new), matter-search, matter-table
 * Wizard testids: matter-wizard, step-1..step-5, client-select, matter-title,
 *   accident-date, description, fee-type, ins-carrier, submit-matter, next-btn, back-btn
 *
 * Wizard flow: Step 1 (Select Client) → Step 2 (Case Details) →
 *   Step 3 (Fee Arrangement) → Step 4 (Insurance) → Step 5 (Review + Submit)
 *
 * Refs: SPR-003 (Matter Management)
 */
export class MattersPage {
  constructor(private page: Page) {}

  /** Navigate to matters list */
  async goto(): Promise<void> {
    await this.page.goto('/matters');
  }

  /** Click "New Matter" — Link navigates to /matters/new */
  async clickNewMatter(): Promise<void> {
    await this.page.locator('[data-testid="new-matter-btn"]').click();
    await this.page.waitForURL('**/matters/new**', { timeout: 10_000 });
  }

  /** Step 1: Select/enter a client */
  async selectClient(clientSearch: string): Promise<void> {
    await expect(this.page.locator('[data-testid="step-1"]')).toBeVisible({ timeout: 5_000 });
    await this.page.locator('[data-testid="client-select"]').fill(clientSearch);
  }

  /** Click Next to advance wizard */
  async clickNext(): Promise<void> {
    await this.page.locator('[data-testid="next-btn"]').click();
    await this.page.waitForTimeout(500);
  }

  /** Step 2: Fill case details */
  async fillCaseDetails(data: {
    title: string;
    accidentDate?: string;
    description?: string;
  }): Promise<void> {
    await expect(this.page.locator('[data-testid="step-2"]')).toBeVisible({ timeout: 5_000 });
    await this.page.locator('[data-testid="matter-title"]').fill(data.title);
    if (data.accidentDate) {
      await this.page.locator('[data-testid="accident-date"]').fill(data.accidentDate);
    }
    if (data.description) {
      await this.page.locator('[data-testid="description"]').fill(data.description);
    }
  }

  /** Step 5: Submit the matter */
  async submitMatter(): Promise<void> {
    await expect(this.page.locator('[data-testid="step-5"]')).toBeVisible({ timeout: 5_000 });
    await this.page.locator('[data-testid="submit-matter"]').click();
  }

  /** Full wizard flow: select client → fill details → skip optional steps → submit */
  async createMatterViaWizard(data: {
    clientSearch: string;
    title: string;
    description?: string;
  }): Promise<void> {
    // Step 1: Select Client
    await this.selectClient(data.clientSearch);
    await this.clickNext();

    // Step 2: Case Details
    await this.fillCaseDetails({ title: data.title, description: data.description });
    await this.clickNext();

    // Step 3: Fee Arrangement — accept defaults
    await this.clickNext();

    // Step 4: Insurance — skip
    await this.clickNext();

    // Step 5: Review + Submit
    await this.submitMatter();
  }

  /** Get count of matter rows in the table */
  async getMatterCount(): Promise<number> {
    const rows = this.page.locator('[data-testid="matter-table"] tbody tr');
    return await rows.count();
  }

  /** Verify the matters list page is loaded */
  async verifyLoaded(): Promise<void> {
    await expect(this.page.locator('[data-testid="matter-list-page"]'))
      .toBeVisible({ timeout: 10_000 });
  }
}
