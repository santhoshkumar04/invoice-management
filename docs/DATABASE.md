# Database

## Database technology

- PostgreSQL
- Drizzle ORM
- Drizzle schema definitions and migrations

Five migrations were recorded during an earlier development checkpoint. Verify the current migration directory for the latest count.

## Known schema files

```text
apps/api/src/db/schema/
├── audit-logs.ts
├── customers.ts
├── enums.ts
├── invoice-adjustments.ts
├── invoice-documents.ts
├── invoice-items.ts
├── invoice-sequences.ts
├── invoice-snapshots.ts
├── invoices.ts
├── organizations.ts
├── payments.ts
├── refresh-sessions.ts
├── service-catalog.ts
└── users.ts
```

## Domain areas

| Domain | Schema area |
|---|---|
| Organization | `organizations.ts` |
| Users and sessions | `users.ts`, `refresh-sessions.ts` |
| Customers | `customers.ts` |
| Invoices | `invoices.ts`, `invoice-items.ts` |
| Invoice numbering | `invoice-sequences.ts` |
| Invoice snapshots | `invoice-snapshots.ts` |
| Payments | `payments.ts` |
| Adjustments | `invoice-adjustments.ts` |
| Invoice document metadata | `invoice-documents.ts` |
| Audit trail | `audit-logs.ts` |
| Shared enums | `enums.ts` |
| Service catalog | `service-catalog.ts` |

## Data ownership and scoping

The current product scope is a single organization. Organization-scoped operations must enforce ownership in the API/service layer.

Technician reporting is additionally scoped to invoices created by the authenticated Technician.

## Financial data rules

- Currency: INR.
- Amount validation maximum: `999999999999.99`.
- Financial inputs allow at most two decimal places.
- Payment totals and adjusted invoice totals are validated by the invoice service.
- Payment creation uses a transaction and invoice-row lock.

## Migrations

Use the scripts declared in `apps/api/package.json` for migration generation, migration execution, and Drizzle Studio. Exact command names can change and should not be duplicated from memory; inspect the current package manifest.

Do not use destructive reset commands against a database containing data that must be retained.

## Source of truth

This document lists the known schema inventory, not a substitute for the Drizzle definitions. Use the schema and migration files for exact columns, indexes, constraints, foreign keys, and relationships.
