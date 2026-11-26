# Backend and API

## Backend stack

- Node.js
- TypeScript
- Fastify
- PostgreSQL
- Drizzle ORM
- Vitest integration tests

## Module boundaries

### Auth

Authentication is handled by a dedicated API module. Consult the current auth routes, service, and environment validation for the exact token strategy, expiry, refresh behavior, and endpoint contract.

### Customers

Provides organization-scoped customer operations used by invoice workflows.

### Invoices

The invoices module owns:

- Invoice creation, listing, detail, and updates.
- Invoice items.
- Payment creation and history.
- Adjustment creation and history.
- Invoice financial rules and validation.

Payments and adjustments intentionally remain within this module.

### Invoice documents

Stores PDF metadata in PostgreSQL and PDF bytes in private filesystem storage. Access is authorized against the invoice and organization.

### Organizations

Provides organization data and settings.

### Reports

Provides overview/report endpoints and role-specific filtering.

### Users

Provides user/team operations.

## Confirmed API contracts

### Payments

| Method | Path | Access |
|---|---|---|
| `POST` | `/invoices/:id/payments` | Admin |
| `GET` | `/invoices/:id/payments` | Admin, Technician, subject to invoice authorization |

### Adjustments

| Method | Path | Access |
|---|---|---|
| `POST` | `/invoices/:id/adjustments` | Admin |
| `GET` | `/invoices/:id/adjustments` | Admin, Technician, subject to invoice authorization |

### Invoice documents

| Method | Path | Access |
|---|---|---|
| `POST` | `/invoices/{invoiceId}/documents?copyType={copyType}` | Admin |
| `GET` | Invoice document history route | Admin, Technician, subject to invoice authorization |
| `GET` | `/invoice-documents/{documentId}/download` | Admin, Technician, subject to invoice authorization |

The exact document-history route and all other auth/customer/invoice/organization/user/report paths must be verified in the current Fastify route files. They are not guessed in this document.

## Payment request validation

The payment creation schema enforces:

- ISO date.
- Positive finite amount.
- Maximum amount `999999999999.99`.
- Maximum two decimal places.
- Method enum: `cash`, `bank_transfer`, `upi`, `cheque`, `card`, `other`.
- Optional nullable reference number, max 150 characters.
- Optional notes, max 2,000 characters.

## Adjustment request validation

The adjustment creation schema enforces:

- Type: `credit` or `debit`.
- Positive finite amount.
- Maximum amount `999999999999.99`.
- Maximum two decimal places.
- Required reason, 5–250 characters.
- Optional nullable notes, max 2,000 characters.

## Report contract

The mobile/API report type is:

```ts
interface OverviewReport {
  period: ReportPeriod;
  dateBasis: {
    invoiceMetrics: "invoiceDate";
    collections: "paymentDate";
  };
  invoiceCount: number;
  billedTotal: string;
  collectedTotal: string;
  outstandingTotal: string;
}
```

The overview endpoint allows Admin and Technician. Technician report filters scope invoice and collection metrics to invoices created by the authenticated technician.

## Service integrity

Payment creation runs in a database transaction and locks the invoice row while validating and updating the balance. This protects against concurrent requests that could otherwise overpay the same invoice.

Financial operations are audit logged.
