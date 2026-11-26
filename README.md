# Invoice Manager

A role-based invoice management application built as a TypeScript monorepo. It consists of a Fastify API backed by PostgreSQL and Drizzle ORM, plus a React Native mobile application built with Expo and Expo Router.

The current product scope is a single organization with two roles: **Admin** and **Technician**. The configured business currency is **INR (₹)**.

## Features

- Authentication and role-aware mobile navigation.
- Customer management.
- Invoice creation, listing, details, and history.
- Invoice PDF generation, preview, upload, and document history.
- Payment recording and payment history.
- Credit/debit invoice adjustments and adjustment history.
- Admin reporting and Technician-scoped overview reporting.
- Organization, user, and team management areas.

## Technology stack

| Area | Technology |
|---|---|
| Language | TypeScript |
| Monorepo | pnpm workspaces |
| Backend | Node.js, Fastify |
| Database | PostgreSQL |
| ORM and migrations | Drizzle ORM |
| Mobile | React Native, Expo, Expo Router |
| Server state | TanStack React Query |
| Forms | React Hook Form |
| Validation | Zod |
| Tests | Vitest |

The package manifests and lockfile are the source of truth for installed versions. Development has used Node.js `v22.14.0` and pnpm `12.21.0`.

## Repository layout

```text
invoice-management/
├── apps/
│   ├── api/                 # Fastify API
│   └── mobile/              # Expo React Native application
├── packages/
│   ├── config/
│   ├── shared/
│   ├── types/
│   └── validation/
├── docs/                    # Project documentation
├── pnpm-workspace.yaml
└── package.json
```

## Quick start

### Prerequisites

- Node.js (development environment used v22.14.0)
- pnpm
- PostgreSQL
- Android Studio/emulator or a physical device for Android testing
- Expo-compatible development environment

### Install dependencies

```powershell
pnpm install
```

### Configure environment

Create the environment files required by the API and mobile apps. Use checked-in `.env.example` files if present and verify exact variable names against the current source.

Known variables:

| Variable | App | Purpose |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | Mobile | API base URL exposed to the Expo app |
| `INVOICE_DOCUMENT_STORAGE_DIR` | API | Private invoice PDF storage directory |

The default document storage path is `./storage/invoice-documents`.

The API also requires database and authentication configuration. Their exact variable names are intentionally not guessed here; check the API environment schema and examples.

> Never place server secrets in `EXPO_PUBLIC_*` variables. Expo public variables are bundled into the client application.

### Run locally

The root workspace has used these commands:

```powershell
pnpm dev:api
pnpm dev:mobile
```

Check the root `package.json` for the current script names. In Windows PowerShell, use `pnpm.cmd` if the pnpm shim is not resolved:

```powershell
pnpm.cmd --filter api exec tsc --noEmit
pnpm.cmd --filter mobile exec tsc --noEmit
```

## Roles at a glance

### Admin

- Manage customers and invoices.
- Manage team/user and organization settings areas.
- Record payments.
- Create credit/debit invoice adjustments.
- Upload invoice PDF documents.
- View reports and invoice financial history.

### Technician

- Create invoices and view their invoice history.
- View permitted invoice details and financial/document history.
- Access overview reporting scoped to invoices they created.
- Cannot record payments or create invoice adjustments.

Authorization is enforced by the API; mobile UI visibility is not the security boundary.

## Documentation

| Document | Contents |
|---|---|
| [Architecture](docs/architecture.md) | System design, layers, data flow, repository structure |
| [Features and roles](docs/features-and-roles.md) | Product workflows and role permissions |
| [Backend and API](docs/backend-and-api.md) | Backend modules and confirmed API contracts |
| [Database](docs/database.md) | Schema inventory and data model notes |
| [Mobile application](docs/mobile.md) | Expo app, navigation, hooks, and API integration |
| [Development setup](docs/development.md) | Local setup, environment, migrations, scripts |
| [Testing](docs/testing.md) | Test commands and historically confirmed results |
| [Security](docs/security.md) | Authorization, financial integrity, file handling |
| [Operations and deployment](docs/operations.md) | Build/export, storage, production readiness checks |
| [Project status](docs/project-status.md) | Confirmed implementation status and follow-ups |

## Important implementation notes

- Payments and adjustments are part of the invoices module; they are not separate top-level modules.
- Technician report data is scoped to invoices created by the authenticated technician.
- Invoice metrics use invoice date; collection metrics use payment date.
- Invoice PDF files are stored outside the public web root.
- Test results in the documentation are historical results from development sessions. Re-run checks against the current checkout before release.

## Project location used during development

```text
F:\Project\invoice-management
```

For exact endpoint paths, environment variables, schema columns, and package scripts, the checked-in source code and package manifests are authoritative.
