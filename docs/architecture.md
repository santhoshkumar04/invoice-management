# Architecture

## System overview

Invoice Manager is a pnpm TypeScript monorepo with a mobile client, API server, PostgreSQL database, and private filesystem storage for invoice PDF documents.

```text
┌──────────────────────────────────────┐
│         Expo React Native App        │
│                                      │
│  Expo Router                         │
│  Admin / Technician route groups     │
│  React Query hooks                   │
│  Zustand authentication state        │
│  Feature screens and components      │
└──────────────────┬───────────────────┘
                   │ HTTP API
                   ▼
┌──────────────────────────────────────┐
│              Fastify API             │
│                                      │
│  Authentication and authorization   │
│  Customers                           │
│  Invoices / Payments / Adjustments   │
│  Invoice Documents                   │
│  Organizations / Users               │
│  Reports                             │
└──────────────────┬───────────────────┘
                   │
          ┌────────┴─────────┐
          ▼                  ▼
┌──────────────────┐  ┌────────────────────┐
│   PostgreSQL     │  │ Private PDF storage│
│   Drizzle ORM    │  │ Local filesystem   │
│   Migrations     │  │ Configurable root  │
└──────────────────┘  └────────────────────┘
```

## Technology choices

- **TypeScript** is used across the monorepo.
- **pnpm workspaces** manage apps and shared packages.
- **Fastify** provides the HTTP API.
- **PostgreSQL** stores application data.
- **Drizzle ORM** defines schemas and migrations and performs database operations.
- **Expo / React Native / Expo Router** power the mobile application.
- **TanStack React Query** manages remote data fetching, caching, and mutations.
- **React Hook Form and Zod** are used for form state and validation.
- **Vitest** is used for API tests.

## Layers and responsibilities

### Mobile client

- Route files define navigable screens.
- Feature components render domain-specific UI.
- Hooks encapsulate queries and mutations.
- API modules call backend endpoints through the shared API client.
- React Query invalidation refreshes dependent invoice, payment, adjustment, and document views after mutations.

### API server

- Routes define HTTP contracts and pre-handler authorization.
- Validation schemas parse and validate request payloads.
- Services implement business rules and database operations.
- Drizzle schema files describe PostgreSQL tables.
- File-storage services manage private PDF bytes separately from database metadata.

### Persistence

- PostgreSQL stores organizations, users, customers, invoices, line items, financial records, document metadata, audit logs, and related entities.
- Invoice PDF bytes are stored in a configurable private filesystem directory.
- Invoice payment writes use a transaction and invoice-row locking to prevent concurrent overpayment.

## Repository layout

```text
invoice-management/
├── apps/
│   ├── api/
│   │   └── src/
│   │       ├── db/
│   │       │   └── schema/
│   │       └── modules/
│   │           ├── auth/
│   │           ├── customers/
│   │           ├── invoice-documents/
│   │           ├── invoices/
│   │           ├── organizations/
│   │           ├── reports/
│   │           └── users/
│   └── mobile/
│       ├── app/
│       │   ├── (admin)/
│       │   ├── (technician)/
│       │   └── invoice/
│       └── src/
│           ├── components/
│           ├── hooks/
│           └── lib/
├── packages/
│   ├── config/
│   ├── shared/
│   ├── types/
│   └── validation/
└── docs/
```

The exact contents may evolve. Use the current checkout as the source of truth.
