# Features and roles

## Product scope

The current stated scope is a single-organization invoice management application with two operational roles:

- Admin
- Technician

The configured currency is INR (₹).

## Admin capabilities

The Admin mobile area includes dashboard, invoices, customers, team, profile, organization settings, and reports.

Confirmed Admin workflows:

- Create and manage customers.
- Create, view, and manage invoices.
- Record payments against eligible invoices.
- Create credit/debit invoice adjustments.
- Upload generated invoice PDF files into server-side document history.
- View payment and adjustment history.
- Access organization reports.
- Use team and organization management screens.

## Technician capabilities

The Technician mobile area includes dashboard, invoice creation, invoice history, and profile. Shared invoice detail and PDF preview routes are also used.

Confirmed Technician workflows:

- Create invoices.
- View their invoice history.
- View permitted invoice details.
- View payment and adjustment history for accessible invoices.
- View/download/share invoice documents for accessible invoices.
- Access overview reporting scoped to invoices created by that Technician.

Technicians cannot record payments or create invoice adjustments.

## Customer management

Customer functionality includes:

- Customer listing.
- Customer creation and editing.
- Customer detail view.
- Contact and billing information.
- Business/tax identifiers and notes.

Validation rules established during implementation:

- Customer name is required and must be 2–200 characters.
- Country is required.
- Company, contact person, email, mobile, address, city, state, tax/vendor identifiers, and notes are optional.
- Email is validated when supplied.
- Optional values are trimmed.
- Email is normalized to lowercase.
- GSTIN and PAN values are normalized to uppercase.

## Invoice management

Invoice functionality includes:

- Invoice listing and history.
- Invoice creation and editing.
- Invoice detail view.
- Invoice line items.
- PDF generation and preview.
- Payment recording and payment history.
- Credit/debit adjustments and adjustment history.
- Stored invoice document history.

## Payments

Payments belong to the invoices module.

- Admin creates payments.
- Admin and Technician can view payment history for an authorized invoice.
- History is ordered newest first.
- Payment details include date, amount, method, optional reference number, and optional notes.
- Supported methods: `cash`, `bank_transfer`, `upi`, `cheque`, `card`, `other`.
- Amounts must be positive, finite, within the validation maximum, and have no more than two decimal places.
- Overpayment is rejected.
- Draft and cancelled invoices cannot receive payments.
- A fully paid invoice cannot receive another payment.

## Adjustments

Adjustments belong to the invoices module.

- Admin creates adjustments.
- Admin and Technician can view adjustment history for an authorized invoice.
- Types: `credit` and `debit`.
- A reason is required and must be 5–250 characters.
- Optional notes are supported.
- Amounts must be positive, finite, within the validation maximum, and have no more than two decimal places.
- A credit cannot reduce the adjusted invoice total below the amount already paid.
- A debit can increase the total and reopen an invoice that had previously been paid.
- Subsequent payment validation uses the adjusted invoice total.

## Reports

The Admin reports screen supports:

- This month
- Last month
- Financial year
- All time

The overview contains invoice count, billed total, collected total, outstanding total, and period/date-basis metadata.

Date basis:
- Invoice metrics use `invoiceDate`.
- Collections use `paymentDate`.

Technician reporting is filtered to invoices created by the authenticated Technician.

The Technician dashboard uses:
- All-time invoice count for “My invoices”.
- Current-month billed total for “This month”.
