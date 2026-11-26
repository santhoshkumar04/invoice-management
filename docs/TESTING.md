# Testing and validation

## Test tooling

The API uses Vitest integration tests.

Primary invoice integration test file:

```text
apps/api/src/modules/invoices/invoices.integration.test.ts
```

## Confirmed development results

The following results were reported during development:

| Area | Reported result |
|---|---|
| Invoice payments and adjustments integration tests | 38 passed, 80 skipped |
| Invoice documents integration tests | 11 passed, 107 skipped |
| API TypeScript check after invoice-document work | Passed |
| Mobile TypeScript check after invoice-document work | Passed |
| Reports period filters | Manually tested and confirmed |

These are historical results, not a guarantee about the current working tree. Re-run tests after code changes and before release.

## Focused payment and adjustment tests

```powershell
cmd.exe /c "pnpm --filter api exec vitest run src/modules/invoices/invoices.integration.test.ts -t ""Invoice payments|Invoice adjustments"" --reporter=verbose"
```

Reported result:

```text
Test Files  1 passed (1)
     Tests  38 passed | 80 skipped (118)
```

Coverage includes role restrictions, history access, partial/full payments, audit logs, amount precision, overpayment prevention, draft/cancelled invoice rejection, concurrent payment protection, credit/debit adjustments, adjustment history, and adjusted-balance rules.

## Invoice document tests

The invoice document integration suite was reported as:

```text
11 passed | 107 skipped | 118 total
```

Coverage includes authentication/authorization, upload validation, document history, download access, and document storage behavior.

## TypeScript checks

```powershell
pnpm.cmd --filter api exec tsc --noEmit
pnpm.cmd --filter mobile exec tsc --noEmit
```

## Full validation

The root workspace has used:

```powershell
pnpm test
pnpm typecheck
pnpm build
```

Verify that these scripts still exist in the current root `package.json`.

## Warnings observed

A PostgreSQL deprecation warning appeared during a test run:

```text
DeprecationWarning: Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0.
```

It did not fail the reported tests. Investigate it against the current database access flow and PostgreSQL client version.
