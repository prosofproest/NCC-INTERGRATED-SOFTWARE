# NCC Data Collection & Organization System

Enterprise information management system for the National Cadet Corps (NCC).

## Tech Stack
- **Framework**: Next.js (App Router, Turbopack)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: Firebase Authentication + Custom Role Claims + HTTP-Only Session Cookies
- **Database**: Cloud Firestore (Sole source of truth)
- **Document Storage**: Google Drive API (Shared Drive)
- **Spreadsheet Processing**: ExcelJS (Import/Export only)
- **Deployment**: Firebase App Hosting

---

## Authentication & Role Architecture

The system enforces strict server-side role resolution with three distinct roles:
- **`admin`**: Full system administration, user management, and dynamic field schema control.
- **`cto`**: Care Taker Officer portal with cadet search, inspection, targeted data requests, and exports.
- **`cadet`**: Cadet single master record portal for profile review, document submission, and change requests.

Login is unified through a single form (`/login`). Users never choose their role; roles are determined server-side from custom claims and Firestore profiles.

---

## Initial Setup & Admin Bootstrap

### 1. Environment Configuration
Ensure `.env.local` is populated with the required keys (see [`.env.example`](./.env.example)):
- Firebase Client SDK configuration (`NEXT_PUBLIC_FIREBASE_*`)
- Firebase Admin SDK credentials (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`)
- SMTP transport credentials (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`)
- Initial seed admin email (`SEED_ADMIN_EMAIL`)

### 2. Run the One-Time Admin Bootstrap
To initialize the first Administrator account and assign the `admin` custom claim:

```bash
# Automated creation with a secure temporary password:
npm run seed:admin

# Or with a custom initial password:
npm run seed:admin -- "YourInitialPassword123!"
```

**What this script does:**
1. Checks if a Firebase Auth user already exists matching `SEED_ADMIN_EMAIL`.
2. If not found, creates the user with the specified or generated temporary password.
3. Sets the immutable Firebase Auth custom claim `{ role: 'admin' }`.
4. Creates/updates the user record in the Firestore `users` collection.
5. If created with a temporary password, flags `mustChangePassword: true` so the admin is prompted to set a permanent password upon first login.

---

## Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts local Next.js development server at `http://localhost:3000` |
| `npm run build` | Compiles optimized production build |
| `npm run start` | Starts production server |
| `npm run lint` | Runs ESLint analysis across codebase |
| `npm run seed:admin` | Bootstraps initial Administrator account using `SEED_ADMIN_EMAIL` |
