import { type Page, expect } from '@playwright/test';

/**
 * Clients Page Object Model
 *
 * Source: src/app/(dashboard)/clients/page.tsx + clients/new/page.tsx
 * Routes: /clients (list), /clients/new (create form)
 *
 * List testids: client-list-page, new-client-btn (Link to /clients/new), client-search, client-table
 * Form testids: new-client-page, firstName, lastName, email, phone, submit-client
 *
 * Refs: SPR-003 (Matter Management — client creation)
 */
export class ClientsPage {
  constructor(private page: Page) {}

  /** Navigate to clients list */
  async goto(): Promise<void> {
    await this.page.goto('/clients');
  }

  /** Click "New Client" — this is a Link that navigates to /clients/new */
  async clickNewClient(): Promise<void> {
    await this.page.locator('[data-testid="new-client-btn"]').click();
    await this.page.waitForURL('**/clients/new**', { timeout: 10_000 });
  }

  /** Fill the client creation form (on /clients/new) */
  async fillClientForm(data: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  }): Promise<void> {
    await this.page.locator('[data-testid="firstName"]').fill(data.firstName);
    await this.page.locator('[data-testid="lastName"]').fill(data.lastName);
    await this.page.locator('[data-testid="email"]').fill(data.email);
    await this.page.locator('[data-testid="phone"]').fill(data.phone);
  }

  /** Submit the client form */
  async submitForm(): Promise<void> {
    await this.page.locator('[data-testid="submit-client"]').click();
  }

  /** Get count of client rows in the table */
  async getClientCount(): Promise<number> {
    const rows = this.page.locator('[data-testid="client-table"] tbody tr');
    return await rows.count();
  }

  /** Verify the client list page is loaded */
  async verifyLoaded(): Promise<void> {
    await expect(this.page.locator('[data-testid="client-list-page"]'))
      .toBeVisible({ timeout: 10_000 });
  }
}
