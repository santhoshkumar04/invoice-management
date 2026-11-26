# Operations and deployment

## Mobile build and Android export

The Expo app uses this Android application ID:

```text
com.invoicemanager.invoicemanager
```

An Android export was run during development with:

```powershell
pnpm.cmd --filter mobile exec expo export --platform android
```

An Expo export is not equivalent to a signed, store-ready Android App Bundle or APK. Configure and verify the release build and signing process separately before distribution.

Check `apps/mobile/package.json` for current Expo scripts.

## Invoice document storage

The API supports:

```dotenv
INVOICE_DOCUMENT_STORAGE_DIR=./storage/invoice-documents
```

If unset, the default is `./storage/invoice-documents`.

For production, configure a private persistent storage location. Ensure the directory is not publicly served and is included in the organization’s backup/recovery plan. If the deployment platform uses ephemeral filesystems, local storage must be replaced or mounted on durable storage before relying on it for production documents.

## Environment configuration

The mobile app has been observed loading `.env` and exporting:

```dotenv
EXPO_PUBLIC_API_URL=...
```

The exact API database and authentication variable names must be taken from the current environment schema and `.env.example` files.

## Deployment verification

Before production release:

1. Run the full test suite.
2. Run API and mobile TypeScript checks.
3. Build the API and mobile applications.
4. Verify production database migrations.
5. Confirm database backups and restore procedures.
6. Confirm private PDF storage persistence and backup.
7. Confirm HTTPS, secrets, logging, and monitoring.
8. Test Admin and Technician authorization using separate accounts.
9. Test payment and adjustment edge cases.
10. Test invoice PDF upload/download on the actual deployment target.

## Operational warnings from development

- A PostgreSQL client deprecation warning was observed during a test run when `client.query()` was called while the client was already executing a query. It did not fail the reported tests.
- An Expo Router `ROUTE_NAMES_CHANGED` warning was encountered during earlier authentication/session restoration work. The root navigator was adjusted to remain mounted during restoration. Recheck navigation and session restoration on the current build.
