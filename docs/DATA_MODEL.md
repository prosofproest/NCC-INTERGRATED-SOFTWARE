# NCC Data Collection & Organization System — Database Schema & Data Model Specification

## 1. Architectural Philosophy & Master Data Principles

The database architecture is grounded in three non-negotiable principles:
1. **Single Source of Truth**: Cloud Firestore is the sole authoritative store for all cadet records, field definitions, document metadata, requests, and audit history.
2. **Permanent-ID Relational Integrity**: Every primary entity is identified by an immutable, permanent ID (e.g. `CADET_0001`, `FIELD_00127`, `CAT_001`). Relational references between collections strictly use these permanent IDs. Changing user attributes (such as names, phone numbers, emails, college roll numbers, or regimental enrollment numbers) never mutate the relational key.
3. **Decoupled Binary Storage vs. Metadata**: Google Shared Drive stores binary files and folder trees; Firestore stores all indexing, ownership, and verification metadata.

---

## 2. Collection Schemas & Entity Definitions

### 2.1 Collection: `cadets`
- **Primary Document ID**: Permanent `cadetId` (e.g., `CADET_0001`)
- **Description**: Master cadet record containing core regimental identifiers and dynamic data field values.

```typescript
interface CadetRecord {
  cadetId: string;                   // Primary Key (e.g. "CADET_0001")
  userId: string;                    // Foreign Key -> users/{uid}
  email: string;                     // Primary institutional/contact email
  fullName: string;                  // Official cadet full name
  enrollmentNo: string | null;       // Official regimental code (e.g. "KAR/23/SDF/..."); null if pending
  rank: string;                      // e.g. "Cadet", "Corporal", "Sergeant", "CSUO"
  unit: string;                      // e.g. "1 Karnataka Air Sqn NCC"
  wing: "Army" | "Navy" | "Air";     // NCC Service Wing
  status: "active" | "passed_out" | "inactive" | "suspended";
  driveFolderId: string | null;      // Google Shared Drive folder ID: [CADET_0001]_[Name]
  driveFolderName?: string;          // Human-readable folder name
  dynamicData: Record<string, any>;  // Keyed by Field ID (e.g. { "FIELD_00127": "O+", "FIELD_00042": 178 })
  completionPercentage: number;      // 0 - 100 calculated profile completion score
  createdAt: string;                 // ISO 8601 timestamp
  updatedAt: string;                 // ISO 8601 timestamp
}
```

---

### 2.2 Collection: `categories`
- **Primary Document ID**: Permanent `categoryId` (e.g., `CAT_001`)
- **Description**: Groupings for organizing dynamic profile fields into intuitive sections.

```typescript
interface CategoryDefinition {
  categoryId: string;   // Primary Key (e.g. "CAT_001")
  name: string;         // e.g. "Personal Information", "Academic Details", "Regimental Info"
  description: string;  // Detailed explanation of category contents
  sortOrder: number;    // Display order in forms and dashboards
  isSystem: boolean;    // System-critical categories cannot be deleted
  isActive: boolean;    // Soft-deactivation flag
  createdAt: string;    // ISO 8601 timestamp
  updatedAt: string;    // ISO 8601 timestamp
}
```

---

### 2.3 Collection: `fields`
- **Primary Document ID**: Permanent `fieldId` (e.g., `FIELD_00001`, `FIELD_00127`)
- **Description**: Dynamic field schemas defined and managed by administrators.

```typescript
interface FieldDefinition {
  fieldId: string;      // Primary Key (e.g. "FIELD_00127")
  categoryId: string;   // Foreign Key -> categories/{categoryId}
  label: string;        // Human-readable field label (e.g. "Blood Group")
  type: "text" | "number" | "date" | "select" | "multiselect" | "boolean" | "file" | "textarea";
  options?: string[];   // Predefined choices for select / multiselect
  validation: {
    required: boolean;
    min?: number;
    max?: number;
    pattern?: string;            // Regex validation string
    allowedMimeTypes?: string[]; // MIME types if type == "file"
    maxFileSizeMb?: number;      // Max file size in MB if type == "file"
  };
  permissions: {
    cadetEditable: boolean;      // If false, cadet must submit a Change Request to alter value
    ctoVisible: boolean;         // Authorized for CTO viewing
    ctoExportable: boolean;      // Authorized for CTO export
  };
  sortOrder: number;    // Order of field rendering within its category
  isActive: boolean;    // Soft-deactivation flag (historical values remain preserved)
  createdAt: string;    // ISO 8601 timestamp
  updatedAt: string;    // ISO 8601 timestamp
}
```

---

### 2.4 Collection: `documents`
- **Primary Document ID**: Permanent `documentId` (e.g., `DOC_00001`)
- **Description**: Metadata and verification tracking for all files uploaded by cadets.

```typescript
interface CadetDocumentMetadata {
  documentId: string;           // Primary Key (e.g. "DOC_00001")
  cadetId: string;              // Foreign Key -> cadets/{cadetId}
  categoryId: string;           // Foreign Key -> categories/{categoryId}
  fieldId?: string;             // Optional Foreign Key -> fields/{fieldId}
  title: string;                // Document name (e.g. "Aadhaar Card Copy", "10th Marksheet")
  fileName: string;             // Original file name (e.g. "aadhaar_front.pdf")
  mimeType: string;             // Verified MIME type (e.g. "application/pdf")
  sizeBytes: number;            // File size in bytes
  driveFolderId: string;        // Google Shared Drive folder ID
  driveFileId: string;          // Google Drive binary file ID
  version: number;              // Incremental version number
  status: "active" | "archived" | "superseded";
  uploadDate: string;           // ISO 8601 timestamp
  uploadedBy: string;           // Foreign Key -> users/{uid}
  verificationStatus: "pending" | "verified" | "rejected";
  verifiedBy?: string;          // Foreign Key -> users/{uid} (Admin)
  verifiedAt?: string;          // ISO 8601 timestamp
  rejectionReason?: string;     // Reason given by reviewer if rejected
  createdAt: string;            // ISO 8601 timestamp
  updatedAt: string;            // ISO 8601 timestamp
}
```

---

### 2.5 Collection: `data_requests`
- **Primary Document ID**: Permanent `requestId` (e.g., `REQ_00001`)
- **Description**: Targeted data collection campaigns initiated by Admin or CTO.

```typescript
interface DataRequest {
  requestId: string;           // Primary Key (e.g. "REQ_00001")
  title: string;               // Campaign title (e.g. "Annual Training Camp Medical Update")
  purpose: string;             // Justification and usage notes
  requestedBy: string;         // Foreign Key -> users/{uid}
  requesterRole: "admin" | "cto";
  targetCadetIds: string[] | "all"; // Array of Cadet IDs or "all" for all active cadets
  requiredFieldIds: string[];  // Array of Field IDs required from each cadet
  deadline?: string;           // Optional submission deadline (ISO 8601)
  status: "draft" | "open" | "closed";
  cadetResponses: Record<string, {  // Keyed by Cadet ID
    status: "pending" | "completed";
    completedAt?: string;
    cadetName?: string;
  }>;
  createdAt: string;           // ISO 8601 timestamp
  updatedAt: string;           // ISO 8601 timestamp
}
```

---

### 2.6 Collection: `change_requests`
- **Primary Document ID**: Permanent `changeRequestId` (e.g., `CR_00001`)
- **Description**: Requests submitted by cadets to update protected/locked master fields.

```typescript
interface ChangeRequest {
  changeRequestId: string;    // Primary Key (e.g. "CR_00001")
  cadetId: string;            // Foreign Key -> cadets/{cadetId}
  fieldId: string;            // Foreign Key -> fields/{fieldId}
  fieldLabel: string;         // Snapshot of field label at request time
  oldValue: any;              // Previous field value
  newValue: any;              // Requested new value
  reason: string;             // Cadet's explanation for change
  status: "pending" | "approved" | "rejected";
  requestedBy: string;        // Foreign Key -> users/{uid} (Cadet)
  requestedAt: string;        // ISO 8601 timestamp
  reviewedBy?: string;        // Foreign Key -> users/{uid} (Admin)
  reviewedAt?: string;        // ISO 8601 timestamp
  reviewerComments?: string;  // Admin explanation or guidance
  createdAt: string;          // ISO 8601 timestamp
  updatedAt: string;          // ISO 8601 timestamp
}
```

---

### 2.7 Collection: `audit_logs` (Strictly Append-Only)
- **Primary Document ID**: Permanent `logId` (e.g., `LOG_0000001`)
- **Description**: Immutable system-wide trail of all privileged actions and data mutations.

```typescript
interface AuditLogEntry {
  logId: string;              // Primary Key (e.g. "LOG_0000001")
  actorId: string;            // Foreign Key -> users/{uid} or "system"
  actorEmail: string;         // Email of user who performed action
  actorRole: "admin" | "cto" | "cadet" | "system";
  action: string;             // Event code (e.g. "CADET_CREATED", "DOCUMENT_VERIFIED")
  entityType: "cadet" | "field" | "category" | "document" | "data_request" | "change_request" | "user" | "system";
  entityId: string;           // Primary identifier of affected record
  previousState?: Record<string, any> | null; // Snapshot before mutation
  newState?: Record<string, any> | null;      // Snapshot after mutation
  metadata?: Record<string, any>;             // Context (e.g. batch size, query params)
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;          // ISO 8601 timestamp
}
```

---

### 2.8 Collection: `users`
- **Primary Document ID**: Firebase Auth `uid`
- **Description**: System user account linking authentication identities to roles and cadet records.

```typescript
interface UserProfile {
  uid: string;                // Primary Key (Firebase Auth UID)
  email: string;              // Normalized email address
  name?: string;              // User display name
  role: "admin" | "cto" | "cadet";
  cadetId?: string;           // Foreign Key -> cadets/{cadetId} (Present for cadet role)
  mustChangePassword: boolean;// Enforces first-time password reset
  createdAt: string;          // ISO 8601 timestamp
  updatedAt: string;          // ISO 8601 timestamp
}
```

---

### 2.9 Internal System Collections (Server-Side Only)
1. **`system_counters`**:
   - `id`: Entity name (e.g. `cadet`, `field`, `category`, `document`, `data_request`, `change_request`, `audit_log`).
   - `currentSequence`: Integer counter incremented atomically in transactions.
2. **`system_otps`**:
   - `id`: Normalized email address.
   - `hashedOtp`: HMAC-SHA256 hash of the one-time code.
   - `expiresAt`: Timestamp (10 minutes validity).
   - `attempts`: Counter tracking invalid attempts (max 5).
   - `lastRequestedAt`: Timestamp enforcing 60s request cooldown.

---

## 3. Entity Relationship Diagram

```
                    ┌─────────────────┐
                    │      users      │
                    │   (uid: PK)     │
                    └────────┬────────┘
                             │ 1:1 (for cadets)
                             ▼
┌──────────────────┐ 1:N    ┌─────────────────┐ 1:N    ┌─────────────────┐
│    categories    ├───────►│     cadets      ├───────►│    documents    │
│ (categoryId: PK) │        │  (cadetId: PK)  │        │ (documentId: PK)│
└────────┬─────────┘        └────────┬────────┘        └─────────────────┘
         │ 1:N                       │ 1:N
         ▼                           ▼
┌──────────────────┐        ┌─────────────────┐
│      fields      │        │ change_requests │
│  (fieldId: PK)   │        │ (changeReqId: PK│
└──────────────────┘        └─────────────────┘
         │                           ▲
         │ 1:N                       │
         └───────────────────────────┘
```
