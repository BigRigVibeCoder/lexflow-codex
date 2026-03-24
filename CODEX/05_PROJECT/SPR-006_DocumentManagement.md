---
id: SPR-006
title: "Document Management Sprint"
type: sprint
status: PLANNING
owner: architect
agents: [frontend]
tags: [sprint, phase-4, documents, upload, local-storage]
related: [BCK-001, SPR-003, GOV-008]
created: 2026-03-24
updated: 2026-03-24
version: 1.0.0
---

> **BLUF:** File upload, storage, and management. Local disk storage per GOV-008 (no cloud storage). Upload with drag-and-drop, category tagging, PDF viewer, cross-matter search. End state: users can upload, organize, view, and search documents across all matters.

# SPR-006: Document Management

**Phase:** 4 — Document Management
**Target:** 4-8 hours (AI-agent pace)
**Agent:** Frontend only
**Dependencies:** SPR-003 complete (matter schema exists for document linking)

---

## ⚠️ Mandatory Compliance — Every Task

| Governance Doc | Sprint Requirement |
|:---------------|:-------------------|
| **GOV-001** | TSDoc on upload service, document router, viewer component. |
| **GOV-002** | Unit tests for upload validation. Integration tests for upload/download. |
| **GOV-003** | TypeScript strict. File type validation. |
| **GOV-004** | Upload size limits enforced (50MB max). Unsupported file type → structured error. |
| **GOV-005** | Branch: `feature/SPR-006-TXXX-description`. |
| **GOV-006** | Document upload/download/delete logged with file metadata. |
| **GOV-008** | Files stored at `/var/lexflow/documents/`. No cloud storage. |

---

## Frontend Agent Tasks (lexflow-frontend)

### T-055: Document DB Schema + Drizzle
- **Branch:** `feature/SPR-006-T055-document-schema`
- **Dependencies:** T-007
- **Deliverable:**
  - `documents` table: id, matterId (FK), title, description, category (enum: pleading, correspondence, medical_record, billing, evidence, court_order, other), originalFilename, storedFilename (UUID-based), mimeType, sizeBytes, uploadedBy (FK users), tags (text array), createdAt, updatedAt
  - `document_access_log` table: id, documentId, userId, action (view/download/delete), timestamp
- **Acceptance:** Migrations run. FK to matters enforced.
- **Status:** [ ] Not Started

### T-056V: Upload Service (Local Disk)
- **Branch:** `feature/SPR-006-T056V-upload-service`
- **Dependencies:** T-055, T-010
- **Deliverable:**
  - `src/lib/document-storage.ts` — local disk storage at `/var/lexflow/documents/`
  - UUID-based filenames to prevent collisions
  - File type whitelist: pdf, doc, docx, xls, xlsx, jpg, png, txt
  - Max upload size: 50MB
  - Multer middleware configured for multipart/form-data
  - Cleanup: orphaned files cron (daily check for DB entries without files)
- **Acceptance:** Upload stores file to `/var/lexflow/documents/<uuid>`. Path stored in DB.
- **Status:** [ ] Not Started

### T-057V: Document tRPC Router (Local)
- **Branch:** `feature/SPR-006-T057V-document-router`
- **Dependencies:** T-055, T-056V, T-010
- **Deliverable:**
  - `upload` — accept multipart, store file, create DB record
  - `download` — serve file from disk with correct Content-Type
  - `list` — paginated, filterable by matter, category, tags
  - `update` — title, description, category, tags
  - `delete` — soft delete (mark as deleted, keep file for retention period)
  - Access logging on view/download
- **Acceptance:** Full document lifecycle from API. Deletion is soft.
- **Status:** [ ] Not Started

### T-058V: Document Upload Component
- **Branch:** `feature/SPR-006-T058V-upload-component`
- **Dependencies:** T-057V
- **Deliverable:**
  - Drag-and-drop upload zone (shadcn/ui)
  - Category selector dropdown
  - Upload progress bar
  - Multi-file upload support
  - File type validation (client-side + server-side)
- **Acceptance:** Drag file → category → upload → progress → success.
- **Status:** [ ] Not Started

### T-059: Document List UI
- **Branch:** `feature/SPR-006-T059-document-list-ui`
- **Dependencies:** T-057V
- **Deliverable:**
  - Filterable DataTable: filename, category badge, size, uploaded by, date
  - Filter by category, date range
  - Download button, view button (opens viewer)
  - Bulk actions: delete selected
- **Acceptance:** Table renders. Filters work. Download triggers file download.
- **Status:** [ ] Not Started

### T-060: Medical Record Viewer
- **Branch:** `feature/SPR-006-T060-pdf-viewer`
- **Dependencies:** T-057V
- **Deliverable:**
  - In-app PDF viewer (react-pdf or similar)
  - Page navigation (prev/next)
  - Zoom controls
  - Fullscreen toggle
  - Opens in modal or dedicated page
- **Acceptance:** PDF renders inline. Navigation works. Non-PDF files show download link.
- **Status:** [ ] Not Started

### T-061: Document Metadata Editor
- **Branch:** `feature/SPR-006-T061-metadata-editor`
- **Dependencies:** T-057V
- **Deliverable:**
  - Inline editing for title, description, tags
  - Category change dropdown
  - Auto-save with debounce
- **Acceptance:** Edit title inline → saves. Add/remove tags works.
- **Status:** [ ] Not Started

### T-062: Global Document Search
- **Branch:** `feature/SPR-006-T062-document-search`
- **Dependencies:** T-057V
- **Deliverable:**
  - Cross-matter document search by title, description, tags
  - Search results with matter context
  - Quick navigation to document detail
- **Acceptance:** Search "medical" → returns medical records across all matters.
- **Status:** [ ] Not Started

---

## Sprint Checklist

| Task | Agent | Status | Branch | Audited |
|:-----|:------|:-------|:-------|:--------|
| T-055 | Frontend | [ ] | `feature/SPR-006-T055-document-schema` | [ ] |
| T-056V | Frontend | [ ] | `feature/SPR-006-T056V-upload-service` | [ ] |
| T-057V | Frontend | [ ] | `feature/SPR-006-T057V-document-router` | [ ] |
| T-058V | Frontend | [ ] | `feature/SPR-006-T058V-upload-component` | [ ] |
| T-059 | Frontend | [ ] | `feature/SPR-006-T059-document-list-ui` | [ ] |
| T-060 | Frontend | [ ] | `feature/SPR-006-T060-pdf-viewer` | [ ] |
| T-061 | Frontend | [ ] | `feature/SPR-006-T061-metadata-editor` | [ ] |
| T-062 | Frontend | [ ] | `feature/SPR-006-T062-document-search` | [ ] |

---

## Sprint Completion Criteria

- [ ] All 8 tasks pass acceptance criteria
- [ ] Upload/download/view cycle works end-to-end
- [ ] PDF viewer renders medical records inline
- [ ] Document search returns cross-matter results
- [ ] File storage uses local disk per GOV-008
- [ ] All GOV compliance checks pass
- [ ] All tests pass: `npm run lint && npm run typecheck && npm run test`
