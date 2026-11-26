# Development setup

## Prerequisites

- Node.js (development environment used `v22.14.0`)
- pnpm (development environment used `12.21.0`)
- PostgreSQL
- Android Studio/emulator or a physical Android device for Android testing
- Expo-compatible development environment

Package manifests and the lockfile are authoritative for the versions currently required.

## Install

From the repository root:

```powershell
pnpm install
```

## Environment

Create the API and mobile environment files expected by the current source. Use `.env.example` files if present.

Known environment variables:

| Variable | Scope | Purpose |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | Mobile | API base URL exposed to the Expo client |
| `INVOICE_DOCUMENT_STORAGE_DIR` | API | Private invoice PDF storage root |

Default document storage directory:

```text
./storage/invoice-documents
```

The API also requires database and authentication configuration. Check the API environment schema and examples for exact variable names and required values.

Do not commit secrets. Do not expose private API secrets through `EXPO_PUBLIC_*` variables.

## Start development

The root workspace has used:

```powershell
pnpm dev:api
pnpm dev:mobile
```

Verify current script names in the root `package.json`.

For Windows PowerShell, `pnpm.cmd` can be used explicitly:

```powershell
pnpm.cmd --filter api exec tsc --noEmit
pnpm.cmd --filter mobile exec tsc --noEmit
```

## Database setup

Typical development sequence:

1. Start PostgreSQL.
2. Configure API database environment variables.
3. Run the Drizzle migrations using the API package script.
4. Seed an initial Admin if needed and supported by the current seed script.
5. Start the API.
6. Start the mobile app with the correct API URL.

The API package has included Drizzle migration/Studio scripts and a `seed:admin` script. Inspect `apps/api/package.json` for exact commands and arguments.

## Useful workspace commands

These root commands have been recorded:

```powershell
pnpm build
pnpm typecheck
pnpm test
```

Use the current root and package manifests as the definitive source for available scripts.
