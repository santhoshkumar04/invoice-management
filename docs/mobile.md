# Mobile application

## Stack

- React Native
- Expo
- Expo Router
- TypeScript
- TanStack React Query
- React Hook Form
- Zod
- Zustand-based authentication state

## App identity

- Display name: `Invoice Manager`
- Expo slug: `invoice-manager`
- Android application ID: `com.invoicemanager.invoicemanager`
- Typed Expo Router routes are enabled.

## Route areas

The known navigation areas include:

```text
app/
├── (admin)/
│   ├── dashboard
│   ├── invoices
│   ├── invoice-create
│   ├── invoice-edit
│   ├── customers
│   ├── customer-create
│   ├── customer-edit
│   ├── customer/[id]
│   ├── team
│   ├── team-create
│   ├── team-manage
│   ├── profile
│   ├── settings
│   └── reports
├── (technician)/
│   ├── dashboard
│   ├── create-invoice
│   ├── history
│   └── profile
├── invoice/
│   └── [id]/
│       └── pdf-preview
├── index
├── modal
└── not-found
```

The exact route filenames and registrations are maintained in `apps/mobile/app`.

## Components and feature modules

Invoice-specific components include:

- `src/components/invoices/InvoiceDetailScreen.tsx`
- `src/components/invoices/InvoicePdfPreviewScreen.tsx`

Known hooks:

- `src/hooks/use-customers.ts`
- `src/hooks/use-invoices.ts`
- `src/hooks/use-organization.ts`
- `src/hooks/use-profile.ts`
- `src/hooks/use-reports.ts`

Known API/helper files:

- `src/lib/api-client.ts`
- `src/lib/auth-api.ts`
- `src/lib/auth-storage.ts`
- `src/lib/customers-api.ts`
- `src/lib/invoices-api.ts`
- `src/lib/organizations-api.ts`
- `src/lib/profile-api.ts`
- `src/lib/reports-api.ts`
- `src/lib/technicians-api.ts`
- `src/lib/invoice-pdf.ts`
- `src/lib/invoice-pdf-old.ts`
- `src/lib/amount-in-words.ts`

## Data fetching and mutations

- Screens consume feature-specific React Query hooks.
- Hooks call module-specific API functions.
- API functions use the shared API client.
- Mutations invalidate related query keys so invoice detail, invoice lists, payment history, adjustment history, and other dependent views can refresh.

## PDF workflow

The invoice detail screen shows document history and download/share actions. The PDF preview flow can upload the generated PDF to the API document history.

## Authentication navigation

The root navigator was adjusted during development to remain mounted while session restoration is in progress. An auth-aware index redirect and loading overlay are used to avoid changing the navigator tree during startup. Recheck device behavior on the current build.
