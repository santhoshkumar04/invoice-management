# Security

This document records security controls confirmed in the implementation and additional deployment checks to perform.

## Authentication and authorization

- API routes authenticate requests and enforce role permissions.
- Admin-only mutations are enforced by backend route pre-handlers.
- Customer, invoice, and invoice-document operations are organization scoped.
- Technician report data is restricted to invoices created by the authenticated Technician.
- Mobile UI visibility is not a security boundary; the API must continue to enforce every permission.

## Financial integrity

- Payment and adjustment payloads are validated server-side.
- Amounts must be positive and finite.
- Financial amounts allow no more than two decimal places.
- Payment amount validation has a maximum of `999999999999.99`.
- Draft and cancelled invoices cannot receive payments.
- Overpayment is rejected.
- Payment creation uses a transaction and invoice row lock to protect against concurrent overpayment.
- Credit adjustments cannot reduce the invoice total below the amount already paid.
- Financial operations are audit logged.

## Invoice document security

Confirmed document controls:

- Files are stored in a private local storage directory, not a public static directory.
- Upload is Admin-only.
- Listing and download require authorized invoice/organization access.
- PDF MIME type is validated.
- File signature must begin with `%PDF-`.
- Maximum upload size is 10 MB.
- Filenames are handled safely.
- Unique file creation uses `wx`.
- File permissions are set to `0600`.
- SHA-256 checksums are recorded.
- Path traversal is guarded against.
- Newly written files are cleaned up if the database write fails.
- Download responses use safe attachment headers and `X-Content-Type-Options: nosniff`.

## Production security checklist

Verify these items for the actual deployment:

- HTTPS is enforced end to end.
- Secrets are stored in a secret manager or protected environment configuration.
- Production credentials are not committed to source control.
- Database access is restricted by network and least-privilege credentials.
- Database backups and restore procedures are tested.
- Invoice document storage is private, persistent, backed up, and access controlled.
- Logs do not expose tokens, credentials, or sensitive customer information.
- Rate limiting and abuse protections are configured where appropriate.
- Authentication/session expiry and refresh behavior match the intended security policy.
- Monitoring and incident response procedures are in place.

The checklist is a deployment verification list, not a claim that every item has already been configured.
