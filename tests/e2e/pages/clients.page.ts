import { type Page, expect } from '@playwright/test';

/**
 * Clients Page Object Model
 *
 * Refs: SPR-003 (Matter Management — client creation)
 */
export class ClientsPage {
  constructor(private page: Page) {}

  /** Navigate to clients list */
  async goto(): Promise<void> {
    await this.page.goto('/clients');
  }

  /** Click "New Client" button */
  async clickNewClient(): Promise<void> {
    const newBtn = this.page.locator(
      '[data-testid="new-client"], button:has-text("New Client"), button:has-text("Add Client"), a:has-text("New Client")'
    ).first();
    await newBtn.click();
  }

  /** Fill the client creation form */
  async fillClientForm(data: {
    name: string;
    email: string;
    phone: string;
  }): Promise<void> {
    await this.page.locator(
      '[data-testid="client-name"], input[name="name"], input[placeholder*="name" i]'
    ).first().fill(data.name);

    await this.page.locator(
      '[data-testid="client-email"], input[name="email"], input[type="email"]'
    ).first().fill(data.email);

    await this.page.locator(
      '[data-testid="client-phone"], input[name="phone"], input[type="tel"]'
    ).first().fill(data.phone);
  }

  /** Submit the client form */
  async submitForm(): Promise<void> {
    const submitBtn = this.page.locator(
      '[data-testid="submit-client"], button[type="submit"], button:has-text("Create"), button:has-text("Save")'
    ).first();
    await submitBtn.click();
  }

  /** Get count of clients in the list */
  async getClientCount(): Promise<number> {
    const rows = this.page.locator(
      '[data-testid*="client-row"], table tbody tr, [class*="client-item"]'
    );
    return await rows.count();
  }

  /** Click on a client by name */
  async openClient(name: string): Promise<void> {
    await this.page.locator(`text=${name}`).first().click();
  }

  /** Verify the client list page is loaded */
  async verifyLoaded(): Promise<void> {
    await expect(this.page.locator('h1, h2, [data-testid="clients-heading"]').first())
      .toBeVisible({ timeout: 10_000 });
  }
}
