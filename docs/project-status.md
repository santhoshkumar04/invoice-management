# Project status

This document records implementation status that was explicitly confirmed during development conversations. It is not a substitute for checking the current Git working tree.

## Confirmed implemented areas

### Reports

- Admin reports screen exists at `apps/mobile/app/(admin)/reports.tsx`.
- Period filters: This month, Last month, Financial year, All time.
- Report hook and API integration exist.
- All four period filters were manually tested and confirmed.
- The overview endpoint permits Admin and Technician.
- Technician report results are scoped to invoices created by that Technician.

### Invoice documents

Backend files include:

- `apps/api/src/db/schema/invoice-documents.ts`
- `apps/api/src/modules/invoice-documents/invoice-document-storage.ts`
- `apps/api/src/modules/invoice-documents/invoice-documents.service.ts`
- `apps/api/src/modules/invoice-documents/invoice-documents.routes.ts`

Mobile integration includes:

- `apps/mobile/src/components/invoices/InvoiceDetailScreen.tsx`
- `apps/mobile/src/components/invoices/InvoicePdfPreviewScreen.tsx`
- Invoice document hooks in `apps/mobile/src/hooks/use-invoices.ts`
- API methods/types in `apps/mobile/src/lib/invoices-api.ts`
- Invoice detail and PDF preview routes under `apps/mobile/app/invoice/`

Reported validation:
- 11 invoice-document tests passed.
- API TypeScript check passed.
- Mobile TypeScript check passed.

### Payments and adjustments

- Payment and adjustment routes are part of the invoices module.
- Admin-only creation routes are implemented.
- Admin/Technician history routes are implemented with invoice authorization.
- Mobile payment and adjustment hooks/API integration exist.
- Invoice detail screen includes Admin payment and adjustment workflows.
- Payment creation uses a transaction and invoice row locking.
- Audit logging and financial validation are implemented.

Reported validation:
- 38 focused payment/adjustment integration tests passed.
- 80 tests were skipped by the focused test filter.

## Technician dashboard metrics

The Technician dashboard was being updated to replace placeholder statistics:

- “My invoices”: all-time invoice count.
- “This month”: billed total for invoices dated in the current month.

The dashboard change was supplied for application and then verification. Do not assume the change is present or that its TypeScript check passed until the current working tree is checked.

## Follow-ups and cautions

- Re-run all tests and type checks after the latest changes.
- Confirm the Technician dashboard implementation and UI on a device/emulator.
- Investigate the PostgreSQL client deprecation warning.
- Recheck Expo Router session-restoration behavior on the current build.
- Verify production persistence for invoice PDF storage.
- Verify all current API paths and environment variable names from source rather than assuming this documentation is exhaustive.
