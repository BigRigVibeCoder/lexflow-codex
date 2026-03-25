import { type Page, expect } from '@playwright/test';

/**
 * Dashboard Page Object Model
 *
 * Source: src/app/(dashboard)/dashboard/page.tsx + dashboard-shell.tsx
 * Verified testids: dashboard-page, dashboard-shell, sidebar, logout,
 *   nav-dashboard, nav-clients, nav-matters, nav-documents, nav-billing, nav-trust, nav-settings
 *   kpi-active-matters, kpi-upcoming-deadlines, kpi-total-clients, kpi-medical-bills
 *   recent-activity, matter-status-chart
 *
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
    await this.page.waitForURL('**/dashboard**', { timeout: 10_000 });
    const dashboard = this.page.locator('[data-testid="dashboard-page"]');
    await expect(dashboard).toBeVisible({ timeout: 10_000 });
  }

  /** Get KPI card count */
  async getKpiCards(): Promise<number> {
    const cards = this.page.locator('[data-testid^="kpi-"]');
    return await cards.count();
  }

  /** Check if navigation sidebar is visible */
  async isSidebarVisible(): Promise<boolean> {
    return await this.page.locator('[data-testid="sidebar"]').isVisible();
  }

  /** Click logout — signOut({ callbackUrl: '/login' }) */
  async logout(): Promise<void> {
    await this.page.locator('[data-testid="logout"]').click();
    // NextAuth signOut with callbackUrl: '/login' → redirect to /login
    await this.page.waitForURL('**/login**', { timeout: 15_000 });
  }

  /** Navigate via sidebar */
  async navigateTo(section: 'clients' | 'matters' | 'documents' | 'billing' | 'trust' | 'settings'): Promise<void> {
    await this.page.locator(`[data-testid="nav-${section}"]`).click();
    await this.page.waitForTimeout(1000);
  }
}
