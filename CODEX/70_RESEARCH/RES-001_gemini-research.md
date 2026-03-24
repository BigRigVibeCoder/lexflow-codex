# LexFlow — Research Brief for DarkGravity Researcher

## Project Definition

LexFlow is a **single-tenant legal practice management application** built for one personal injury law firm (~10+ staff: attorneys, paralegals, legal assistants, bookkeeper). It is **not** a SaaS product. There are no multi-tenant features, no subscriber billing, no marketing pages, and no onboarding funnels. This is a bespoke, behind-the-firewall application deployed on **Google Cloud Platform (GCP)** to replace the firm's Clio subscription and eliminate recurring monthly fees.

### What This Is NOT
- Not a SaaS platform sold to multiple firms
- Not a Clio replacement product for the market
- Not a multi-tenant application
- No Stripe payment processing integration
- No Airtable/n8n/Make workflow automation
- No CRM or lead-generation pipeline
- No bolted-on AI drafting tools

### What This IS
A clean, modern, single-purpose legal practice management app that gives one injury law firm the core Clio features they actually use — matter management, time tracking, billing, trust accounting, and document storage — without the monthly SaaS tax.

---

## Target Firm Profile

| Attribute | Value |
|:--|:--|
| Practice Area | Personal Injury |
| Firm Size | ~10+ staff |
| Roles | Managing Partner, Attorneys (3-5), Paralegals (2-3), Legal Assistants (1-2), Bookkeeper (1) |
| Current Software | Clio Manage |
| Deployment | Single-tenant, GCP-hosted |
| Users | Internal firm staff only (no external client logins in V1) |

---

## Feature Priorities

### P0 — Must Have (V1 Launch)

**1. Matter & Contact Management**
The relational core of the application. Every entity — time entries, documents, invoices, trust transactions — ties back to a Matter. Requirements:
- Client → Matter relational model (one client, many matters)
- Matter dashboard with status, key dates, assigned attorney, case value
- Contact database with conflict-of-interest search (indexed full-text search across all historical contacts and matters)
- Custom fields for personal injury specifics: accident date, statute of limitations, insurance carrier, policy limits, medical provider tracking
- Matter lifecycle stages: Intake → Active Investigation → Demand → Litigation → Settlement → Closed

**2. Time Tracking & Billing**
The revenue engine. Attorneys bill hourly; some matters are contingency (track time for fee petitions). Requirements:
- Persistent floating timer accessible from every screen
- Time entries linked to matters with activity codes and narrative descriptions
- Bulk time entry for end-of-day catch-up
- Invoice generation from unbilled time entries
- Invoice PDF export with firm letterhead
- Payment recording (manual — check, ACH, wire; no online payment processing)
- Accounts receivable aging reports
- Attorney productivity reports (hours billed, collected, realization rate)

**3. Trust Accounting (IOLTA)**
Ethical and regulatory requirement — cannot be skipped or simplified. Requirements:
- Separate trust ledger per client matter
- Trust deposits and disbursements with mandatory memo fields
- Hard database constraint: trust balance can NEVER go negative (overdraft prevention at the data layer, not just UI validation)
- Three-way reconciliation report: bank balance vs. book balance vs. individual client ledgers
- Trust transaction audit trail (immutable — no edits, only reversing entries)
- Monthly trust account statement generation per client

### P1 — Important (V1 or Fast Follow)

**4. Document Storage**
Attach files to matters with basic organization. Requirements:
- Drag-and-drop file upload linked to matters
- Folder structure per matter (Correspondence, Medical Records, Pleadings, Discovery, Settlement)
- File versioning (prevent accidental overwrites of finalized documents)
- Cloud storage backend (GCS bucket or equivalent)
- Search across document names and metadata

### P2 — Nice to Have (V2)

**5. Client Portal**
Read-only secure portal for clients to view their case status and download shared documents. Not needed for V1.

**6. Task Workflows**
Task assignment, deadline tracking, and Kanban-style matter stage visualization. Useful but not critical for launch.

---

## Technology Stack — Research Directives

The DarkGravity researcher should investigate the **current state-of-the-art** for each layer of this application and provide specific, opinionated technology recommendations with justification.

### Frontend

**Current direction: Next.js 15 (App Router) with React 19**

Research questions:
- What is the latest stable Next.js version and its production readiness for a data-heavy internal tool?
- Is the App Router + Server Components model appropriate for a CRUD-heavy legal management app, or would a client-side SPA (Vite + React Router) be faster to build?
- What is the best React component library for a data-dense legal dashboard? Evaluate: **shadcn/ui**, **Radix UI**, **Mantine**, **Ant Design**, or **TanStack Table** for the heavy table/grid views
- Best approach for real-time UI updates (optimistic updates, server actions, SWR/React Query)
- Form handling strategy for complex legal forms (React Hook Form, Zod validation, or alternatives)
- What CSS/styling approach is optimal? Tailwind CSS v4, CSS Modules, or styled-components?

### Backend & Database

**Current direction: Supabase (PostgreSQL) — but evaluate single-tenant alternatives**

Research questions:
- For a **single-tenant app on GCP**, is Supabase Cloud still the right choice, or should we use **Cloud SQL (PostgreSQL)** directly with a custom API layer?
- Evaluate: **Supabase self-hosted on GCP** vs **Supabase Cloud** vs **bare PostgreSQL + Prisma/Drizzle ORM**
- What is the best ORM for Next.js in 2026? Compare **Prisma**, **Drizzle**, and **Supabase client SDK** for type safety, migration management, and developer experience
- Row Level Security: still valuable in single-tenant for role-based access (attorney vs paralegal vs bookkeeper), or overkill?
- What is the best approach for the IOLTA trust ledger? Evaluate PostgreSQL CHECK constraints, triggers, and application-layer validation
- Database migration strategy: Prisma Migrate, Drizzle Kit, or raw SQL migrations?

### Authentication & Authorization

Research questions:
- For a single-tenant internal app, evaluate: **Supabase Auth**, **NextAuth.js (Auth.js)**, **Clerk**, **Lucia Auth**, or simple **JWT + bcrypt**
- RBAC model: how to implement role-based access (Admin, Attorney, Paralegal, ReadOnly) efficiently
- MFA requirements for legal applications (ABA ethical rules on data protection)

### File Storage

Research questions:
- **Google Cloud Storage (GCS)** vs **Supabase Storage** vs **S3-compatible** for document attachments
- Signed URL approach for secure file access
- File size limits and upload strategies for large legal documents (medical records, discovery packages)

### Deployment & Infrastructure

**Target: Google Cloud Platform (GCP)**

Research questions:
- Best GCP deployment strategy for a Next.js app: **Cloud Run**, **GKE**, **App Engine**, or **Compute Engine**?
- CI/CD pipeline: GitHub Actions → Cloud Build → Cloud Run (or equivalent)
- Database hosting: **Cloud SQL** vs **AlloyDB** vs **Supabase Cloud**
- Cost estimation for a single-tenant app serving ~10-20 concurrent users
- Monitoring and logging: Cloud Logging, Error Reporting, Uptime Checks

### Testing Strategy

Research questions:
- End-to-end testing framework: **Playwright** vs **Cypress** for legal workflow testing
- API testing approach for the trust accounting logic (critical path — must be bulletproof)
- Component testing: **Vitest** + **React Testing Library** or alternatives

---

## Competitive Intelligence

The researcher should analyze the following Clio features and document exactly what LexFlow needs to replicate vs what can be safely ignored:

### Replicate (Core Value)
1. **Centralized Matter Hub** — Single dashboard per matter with all related data
2. **Time Tracking** — Ubiquitous timer, bulk entry, activity codes
3. **Billing & Invoicing** — Invoice generation, payment tracking, A/R reports
4. **Trust Accounting** — IOLTA compliance with overdraft prevention
5. **Document Management** — File attachment, versioning, organized storage
6. **Role-Based Access** — Attorneys see everything, paralegals see assigned matters, bookkeeper sees financials only

### Intentionally Exclude
1. **Multi-firm tenancy** — Single firm, no tenant isolation needed
2. **CRM / Client Intake Pipeline** — No lead gen, no marketing funnels
3. **Online Payment Processing** — No Stripe, no credit card, no payment portals
4. **Bidirectional Accounting Sync** — No QuickBooks/Xero integration (export-only if needed)
5. **Workflow Automation Platform** — No Airtable/n8n/Make integration
6. **AI Drafting Tools** — Use external tools (Spellbook, Copilot) instead
7. **Per-Seat Licensing Logic** — Firm owns the app, unlimited users
8. **Mobile App** — Desktop-first, responsive web is sufficient for V1

---

## Key Constraints

1. **Speed of delivery** — Get the firm operational as fast as possible. Prefer batteries-included frameworks over bespoke solutions.
2. **Single-tenant simplicity** — No multi-tenant complexity. One database, one deployment, one firm.
3. **Trust accounting correctness** — This is the one area where we cannot cut corners. IOLTA compliance is a regulatory requirement with potential disbarment consequences.
4. **GCP deployment** — All infrastructure must run on Google Cloud Platform.
5. **Demonstration quality** — The app should look and feel professional. This is a showcase of what a custom-built legal tool can be.

---

## Research Output Expectations

The researcher should produce:
1. **Technology stack recommendation** with specific versions and justification for each choice
2. **Competitive feature analysis** — what Clio does well vs where LexFlow can be simpler
3. **Architecture pattern recommendation** — monorepo structure, API patterns, state management
4. **IOLTA compliance research** — specific regulatory requirements for trust accounting in the target jurisdiction
5. **GCP deployment architecture** — specific services, estimated costs, CI/CD approach
6. **Risk analysis** — what could go wrong and how to mitigate

---

## Source Material

This research brief is derived from a comprehensive analysis of Clio's architecture, feature set, and market positioning. Key sources include:
- Clio product documentation and feature pages (clio.com)
- G2 user reviews of Clio Manage (g2.com)
- Reddit discussions from r/LawFirm and r/Lawyertalk on Clio pain points
- American Bar Association technology competence guidelines
- Clio Legal Trends Reports (anonymized industry telemetry)
- Next.js, Supabase, and GCP official documentation
- SaaS boilerplate analysis (MakerKit, Supabase templates)
