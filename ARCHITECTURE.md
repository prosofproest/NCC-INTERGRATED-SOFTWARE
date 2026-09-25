# NCC Data Collection & Organization System — Architecture & Technical Foundation

## 1. System Mission & Core Purpose
The **NCC Data Collection & Organization System** is an enterprise-grade information management platform purpose-built for the National Cadet Corps (NCC). Its foundational mandate:
- **Collect Once, Store Permanently, Reuse Indefinitely**: Cadet information is captured once, validated rigorously, stored in a secure master record, and reused across all workflows.
- **Targeted Collection**: If required information is missing from a cadet's master record, the system requests only the missing fields—never re-asking for data already captured.
- **Strict Boundary of Concern**: The system is exclusively focused on cadet data collection, dynamic field schema management, document verification, role-based reporting, and secure import/export. It explicitly excludes event scheduling, attendance tracking, camp management, social chat, payments, or general college administration.

---

## 2. Confirmed Technology Stack

| Component | Technology | Rationale & Responsibility |
| :--- | :--- | :--- |
| **Framework** | **Next.js (App Router)** | Modern React server components, server actions, dynamic API routes, and optimized streaming UI. |
| **Language** | **TypeScript** | Strict type safety across database entities, API payloads, validation schemas, and UI components. |
| **Styling** | **Tailwind CSS** | Utility-first, responsive, accessible design system following clean Apple-inspired aesthetics. |
| **Authentication** | **Firebase Auth** | Secure session management, email/password and OTP flows, token validation. |
| **Database** | **Cloud Firestore** | NoSQL document database serving as the **single source of truth** for all entities, dynamic fields, and metadata. |
| **Backend & Compute** | **Firebase Cloud Functions / Server Functions** | Isolated server-side compute for privileged operations, document processing, and background workflows. |
| **Security Layer** | **Firestore Security Rules** | Granular server-enforced access control and data integrity rules protecting collections at the database layer. |
| **Document Storage** | **Google Drive API (Shared Drive)** | Cloud binary file storage mapped to cadet-specific directory structures (`[CadetID]_[Name]`). |
| **Spreadsheet Engine** | **ExcelJS** | High-performance, schema-validated spreadsheet generation and parsing for imports and exports. |
| **Hosting & Deployment**| **Firebase App Hosting** | Next.js-optimized, serverless deployment with automated CI/CD and managed SSL. |
| **Package Manager** | **npm** | Official, standardized package manager for all project dependency orchestration. |

---

## 3. Storage Separation & Source of Truth Architecture

```
                  ┌───────────────────────────────────────────────┐
                  │            THREE ROLE-BASED PANELS            │
                  │        (Admin  |  CTO  |  Cadet)              │
                  └───────────────────────┬───────────────────────┘
                                          │
                        Server-Side Authorization & API
                                          │
       ┌──────────────────────────────────┼──────────────────────────────────┐
       ▼                                  ▼                                  ▼
┌─────────────────────────┐   ┌───────────────────────────┐   ┌───────────────────────────┐
│     Cloud Firestore     │   │      Google Drive API     │   │          ExcelJS          │
│  SINGLE SOURCE OF TRUTH │   │   ORGANIZATIONAL STORAGE  │   │     IMPORT / EXPORT       │
├─────────────────────────┤   ├───────────────────────────┤   ├───────────────────────────┤
│ • Master Cadet Records  │   │ • Binary files & PDFs     │   │ • Batch cadet ingestion   │
│ • Dynamic Field Schemas │   │ • Shared Drive ownership  │   │ • Filtered data exports   │
│ • Document Metadata     │   │ • [CadetID]_[Name] folders│   │ • Schema-validated only   │
│ • Audit Logs & History  │   │ • NEVER stores metadata   │   │ • NEVER source of truth   │
│ • Auth & Role Mapping   │   │ • Accessed via Server API │   │ • Ephemeral processing    │
└─────────────────────────┘   └───────────────────────────┘   └───────────────────────────┘
```

1. **Cloud Firestore is the Sole Source of Truth**:
   All authoritative state—cadet profiles, custom field values, document verification statuses, data requests, change requests, and system configurations—lives in Cloud Firestore. No client panel, cache, or external spreadsheet may act as a primary record.
2. **Google Drive Stores Binary Files; Firestore Stores Metadata**:
   Google Drive (configured on a secure, organizationally owned Shared Drive) stores document files, photos, certificates, and submitted attachments. Firestore stores the corresponding metadata (`Document ID`, `Drive File ID`, `Drive Folder ID`, `MIME type`, `checksum`, `upload timestamp`, `verification status`, and `reviewer remarks`).
3. **Excel is Import/Export Only, Never a Database**:
   Excel workbooks serve strictly as input transport (batch cadet onboarding) and output transport (generating authorized reports for officers/CTOs). Ingestion parses, validates, and commits to Firestore in transactional batches. Export extracts fresh, authorized snapshots from Firestore. Neither the client nor the server ever relies on an Excel sheet as persistent state.

---

## 4. The Permanent-ID Model (Relational Core Principle)

A non-negotiable architectural rule of this system is that **human-readable identifiers (such as names, phone numbers, emails, or changing registration codes) must NEVER be used as relational database keys.**

Every primary entity is assigned an immutable, permanent identifier at creation:

| Entity | Identifier Format | Immutability Rule & Responsibility |
| :--- | :--- | :--- |
| **Cadet** | `Cadet ID` (e.g., `CADET_0001` or UUIDv4) | Generated once at cadet creation. Never changes, even if the cadet's name, email, phone, college roll number, or regimental enrollment number changes. All profile data, uploaded documents, change requests, audit logs, and data requests link to this key. |
| **Category** | `Category ID` (e.g., `CAT_001`) | Immutable identifier for dynamic profile groupings (e.g., Personal, Academic, NCC Regimental, Physical/Medical). |
| **Field** | `Field ID` (e.g., `FIELD_00127`) | Immutable identifier for dynamic data fields. Admin may change the field label, placeholder, or validation rule, but the `Field ID` remains constant so historical data is never severed or corrupted. |
| **Document** | `Document ID` (e.g., `DOC_00042`) | Permanent identifier for each tracked cadet file. Retains verification history and links directly to the Google Drive file object. |
| **Data Request** | `Data Request ID` (e.g., `REQ_0089`) | Tracks targeted data collection campaigns initiated by Admin or CTO, tracking which cadets have responded. |
| **Change Request**| `Change Request ID` (e.g., `CR_00312`) | Generated when a cadet requests a modification to a locked or restricted master field, awaiting Admin review/approval. |
| **Audit Log** | `Audit Log ID` (e.g., `LOG_009841`) | Append-only, sequential, immutable record capturing who performed what action, when, and with what diff. |

---

## 5. Role Model & Server-Determined Authorization

The application serves three distinct user roles with zero overlap in authority boundaries:

```
                            ┌────────────────────────┐
                            │   Single Login Form    │
                            │   (Email / Password)   │
                            └───────────┬────────────┘
                                        │
                                        ▼
                            ┌────────────────────────┐
                            │ Server-Side Auth Check │
                            │ & Custom Claims Lookup │
                            └───────────┬────────────┘
                                        │
             ┌──────────────────────────┼──────────────────────────┐
             ▼                          ▼                          ▼
      [ ADMIN ROLE ]              [ CTO ROLE ]              [ CADET ROLE ]
 • Complete System Control   • Read-only Cadet Search  • Access Own Profile Only
 • Field Schema Designer     • Filter & Export Data    • Respond to Data Requests
 • User & Role Provisioning  • Inspect Cadet Docs      • Submit Change Requests
 • Backup & Audit Management • "Jai Hind Sir" Greeting • "Jai Hind" Greeting
```

### Core Role Principles:
1. **Server-Determined Roles**: Users NEVER select their role at login. There is exactly one unified authentication gateway. Upon credentials verification, server-side functions evaluate the user's authoritative record in Firestore (and Firebase Auth custom claims) to determine privileges and redirect to the appropriate route (`/admin`, `/cto`, or `/cadet`).
2. **Zero-Trust Access**: Every server action, API route, and Firestore security rule independently verifies the session token and role claims. Client-side route protections exist solely for UX routing and never serve as a security boundary.
3. **Role Descriptions**:
   - **Administrator**: Complete control over system configuration, dynamic fields, cadet records, CTO accounts, document verification policies, data requests, audit logs, system health, and backups.
   - **CTO (Care Taker Officer)**: Senior military/cadet officer access with greeting (*"Jai Hind Sir"*). Authorized to search, filter, and inspect permitted cadet datasets, initiate targeted Data Requests, and export authorized reports. Cannot modify system settings, create Admin/CTO accounts, or alter database schemas. Every CTO search and export is logged to the audit trail.
   - **Cadet**: Access strictly confined to their individual master record. Cadets can view their status, complete missing information prompted by Data Requests, upload required documents, and submit Change Requests for administrator approval. Cadets can never view other cadets' data.

---

## 6. Top-Level Folder Structure Plan

The following structure represents the planned architectural layout for the codebase (to be scaffolded in subsequent stages):

```
ncc-integrated-software/
├── .env.example              # Environment variables template
├── .gitignore                # Git exclusions
├── ARCHITECTURE.md           # System architecture specification
├── README.md                 # Project documentation & setup instructions
├── next.config.ts            # Next.js configuration
├── tailwind.config.ts        # Tailwind design tokens & typography
├── tsconfig.json             # TypeScript compiler settings
│
├── docs/                     # Project specifications & manuals
│   └── spec.pdf              # Master specification document (Source of Truth)
│
├── public/                   # Static assets (favicons, logos, emblems)
│
├── src/
│   ├── app/                  # Next.js App Router (pages, layouts, route handlers)
│   │   ├── (auth)/           # Authentication routes (login, verify-otp, forgot-password)
│   │   ├── admin/            # Administrator panel routes (14 distinct modules)
│   │   ├── cto/              # CTO portal routes (cadet search, requests, exports)
│   │   ├── cadet/            # Cadet dashboard routes (profile, documents, requests)
│   │   ├── api/              # Secure backend API endpoints (webhooks, exports, upload signing)
│   │   ├── layout.tsx        # Global root layout with theme & font providers
│   │   └── page.tsx          # Gateway entrypoint & role-based redirector
│   │
│   ├── components/           # Reusable UI component library
│   │   ├── ui/               # Primitive design system (buttons, inputs, cards, badges)
│   │   ├── layout/           # Header, sidebar, shell, navigation components
│   │   ├── forms/            # Dynamic form generators, field inputs, validation hooks
│   │   ├── tables/           # Data tables with sorting, filtering, and pagination
│   │   ├── dialogs/          # Modal dialogs, confirmations, drawer sheets
│   │   └── notifications/    # Alert banners, toast providers, task prompts
│   │
│   ├── features/             # Domain-specific feature modules
│   │   ├── auth/             # Session management, OTP verification, password reset
│   │   ├── cadets/           # Cadet master records, profile views, dynamic rendering
│   │   ├── documents/        # File upload pipelines, Drive sync, verification engine
│   │   ├── data-requests/    # Targeted collection campaigns & response trackers
│   │   ├── change-requests/  # Cadet field edit submissions & admin approval queue
│   │   ├── imports/          # Excel batch cadet ingestion & schema validation
│   │   ├── exports/          # Excel report generation & authorized data extraction
│   │   ├── audit/            # Immutable audit logging & compliance viewer
│   │   ├── health/           # System health monitoring (DB, Auth, Drive, Jobs)
│   │   └── backups/          # Firestore and metadata backup workflows
│   │
│   ├── lib/                  # Core services, SDK initializations, and utilities
│   │   ├── firebase/         # Firebase Client SDK & Admin SDK initializations
│   │   ├── google-drive/     # Drive API client, folder manager, upload pipeline
│   │   ├── excel/            # ExcelJS template builders and row validators
│   │   ├── validation/       # Zod schemas for forms, fields, and API payloads
│   │   ├── authorization/    # Role check helpers, permission gates, claims logic
│   │   └── security/         # Encryption utilities, sanitization, rate limiting
│   │
│   └── types/                # Canonical TypeScript declarations
│       ├── cadet.ts          # Cadet master schema, status types
│       ├── fields.ts         # Dynamic Category and Field definitions
│       ├── document.ts       # Document metadata and verification types
│       ├── request.ts        # Data Request & Change Request interfaces
│       ├── audit.ts          # Audit Log schema & action enum
│       └── user.ts           # Auth user, session, and role types
│
├── functions/                # Firebase Cloud Functions (backend microservices)
│   ├── src/
│   │   ├── auth/             # Custom claims provisioning, user lifecycle hooks
│   │   ├── drive/            # Background Drive folder creation & cleanup
│   │   ├── mail/             # SMTP / OTP dispatch triggers
│   │   └── index.ts          # Cloud Functions entrypoint
│   ├── package.json
│   └── tsconfig.json
│
└── firestore.rules           # Declarative Firestore security rules
```

---

## 7. Development Discipline & Quality Standard

For every phase of implementation, the project adheres to the strict protocol:
$$\text{PLAN} \longrightarrow \text{IMPLEMENT} \longrightarrow \text{RUN} \longrightarrow \text{TEST} \longrightarrow \text{FIX} \longrightarrow \text{VERIFY} \longrightarrow \text{COMMIT}$$

- **Zero-Unverified Claims**: No module is labeled "production ready", "secure", or "complete" without concrete terminal execution, type checking (`tsc --noEmit`), lint verification, and functional proof.
- **Component Consistency**: Once UI patterns (Apple-inspired rounded cards, typography scale, buttons, modals, badges) are established, they are strictly reused rather than reinvented across screens.
