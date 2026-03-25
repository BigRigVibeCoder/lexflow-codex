import { type Page, expect } from '@playwright/test';

/**
 * Dashboard Page Object Model
 *
 * Encapsulates selectors and actions for the main dashboard.
 * Refs: SPR-002 (post-login landing), SPR-003 (KPI widgets)
 */
export class DashboardPage {
  constructor(private page: Page) {}

  /** Navigate to dashboard */
  async goto(): Promise<void> {
    await this.page.goto('/dashboard');
  }

  /** Verify the dashboard has loaded with expected elements */
  async verifyLoaded(): Promise<void> {
    // Wait for dashboard-specific content
    await this.page.waitForURL('**/dashboard**', { timeout: 10_000 });

    // Look for navigation sidebar or dashboard heading
    const dashboard = this.page.locator(
      '[data-testid="dashboard-page"], [data-testid="dashboard"], h1, [role="main"]'
    ).first();
    await expect(dashboard).toBeVisible({ timeout: 10_000 });
  }

  /** Get KPI card elements */
  async getKpiCards(): Promise<number> {
    // Look for stat/KPI cards — common patterns in dashboard UIs
    const cards = this.page.locator(
      '[data-testid*="kpi"], [data-testid*="stat"], .stat-card, [class*="card"]'
    );
    return await cards.count();
  }

  /** Check if navigation sidebar is visible */
  async isSidebarVisible(): Promise<boolean> {
    const sidebar = this.page.locator(
      '[data-testid="sidebar"], nav, [role="navigation"]'
    ).first();
    return await sidebar.isVisible();
  }

  /** Click logout */
  async logout(): Promise<void> {
    // Look for logout button/link
    const logoutBtn = this.page.locator(
      '[data-testid="logout"], button:has-text("Logout"), button:has-text("Sign Out"), a:has-text("Logout")'
    ).first();
    await logoutBtn.click();
    // Wait for redirect to login after signout
    await this.page.waitForURL('**/login**', { timeout: 15_000 });
  }
}
