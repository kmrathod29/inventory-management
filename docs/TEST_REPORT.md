# Test report

## Executed

- `npm run build` — passed; Vite renderer and Electron main bundles built.
- `npm test` — 60 tests discovered, 29 passed and 31 failed. The failures that require SQLite fail because the installed `better-sqlite3` binary targets Node ABI 139 while the active Node 22 runtime requires ABI 127. Pure validation/auth/selection and the new regional tests passed. Database lifecycle tests therefore remain unverified.
- `npm run lint` — failed on existing findings in `src/components/ErrorBoundary.jsx`: unused `error` and undefined `process`. No localization files were reported.
- Read-only database inspection with system `sqlite3` — development DB version 4 with 1 product/customer/bill; root copy version 0 with 33 products, 11 customers, 11 bills and 29 expenses.

## Not verified

GST documents/tax, Indian address/GSTIN/PAN validation, stock unit conversions, returns/refunds, split payments, invoice concurrency, export/PDF visual output, and migration preservation were not implemented or exercised. No database migration was applied. Before relying on SQLite test results, rebuild/install `better-sqlite3` for the active Node ABI or run tests using the repository's supported Electron runtime.
