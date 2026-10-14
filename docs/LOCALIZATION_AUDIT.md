# Localization audit: Nepal to India

## Architecture and data flow

StockWise 3.0.3 is an offline Electron 38 / React 19 / Vite 8 desktop application. Renderer pages in `src/pages` call a `window.db` bridge; the Electron main process loads `src/Backend/server.js`, which uses `better-sqlite3`, service modules and versioned SQL migrations. The working database is SQLite (`src/Database/inventory.db` in development and app user data when packaged). `package.json` exposes `dev`, `build`, `build:win`, `build:linux`, `lint`, and Node test runner scripts.

Typical sales flow: Billing UI (`BillDialog`) validates and constructs a bill payload -> Electron database bridge/service (`customersBills.js`) -> `businessFlows.js` validates, inserts bill and line items and adjusts stock -> SQLite `bills`, `bill_items`, `bill_activity`, `base_stock` -> finance/analytics service queries -> renderer tables/charts and PDF/portable export (`dataExport.js`). Purchases/imports flow through Expenses UI -> `expensesAnalytics.js` and `businessFlows.js` -> `expenses`, `expense_items` and stock. Settings use JSON profiles in `settingsProfiles.js` / `appConfig.js`.

## Findings and affected areas

| Area | Finding | Main files |
|---|---|---|
| Regional defaults | Nepal locale and NPR are hardcoded in formatter options and UI labels. No central regional configuration exists. | `src/pages/{Analytics,Finances}/**`, `src/pages/Billing/**`, `src/pages/Inventory/**`, `src/Backend/dataExport.js`, `src/utils` |
| Calendar | Custom Bikram Sambat date picker and converter drive transaction entry and display; database stores ISO-like text dates. | `src/components/NepaliDatePicker.jsx`, `src/utils/nepaliDate.js`, all billing/finance date consumers |
| Billing/tax | Legacy bill types `default`, `pan`, `vat`; VAT-specific validation defaults to 13%, PAN is treated as a bill type. There is no GST registration, HSN/GSTIN/place-of-supply or CGST/SGST/IGST model. | `src/Backend/validation.js`, `src/Backend/migrations.js`, `src/Backend/services/customersBills.js`, `src/pages/Billing/**`, `src/Backend/dataExport.js` |
| Financial periods | Yearly analytics begin January 1. Date helpers use host-local time and some `toISOString()` conversions, which can shift calendar dates. | `src/Backend/services/expensesAnalytics.js`, `src/utils/dateUtils.js` |
| Inventory | Product model uses `bucket_size` and base variants; there is no explicit unit, pack conversion, category, movement ledger, or landing-cost distinction. Import and sale stock changes are present. | `src/Backend/migrations.js`, `src/Backend/businessFlows.js`, inventory pages/services |
| Finance | REAL monetary values; bill totals, amount paid and due coexist. Analytics include all bills without a void/cancel filter and subtract tax from gross, while outstanding is summed by customer. Import expenses and operating expenses are represented by expense type. | `src/Backend/services/expensesAnalytics.js`, `src/Backend/businessFlows.js`, `src/Backend/services/customersBills.js` |
| Profile/validation | Settings have shop name/address/telephone and legacy TPIN/VAT defaults. Customer phone/address are plain text; no India address/GSTIN/PAN validation. | `src/Backend/appConfig.js`, `src/Backend/services/settingsProfiles.js`, `src/Backend/validation.js` |
| Exports | PDF generation contains NPR, VAT Invoice, PAN and Rs/Ps text; export timestamps use host locale. | `src/Backend/dataExport.js` |
| Tests/docs | Existing Node tests cover migrations, validation, stock flows and backups; no Indian locale, GST, FY boundary or migration-preservation coverage. README describes legacy workflow and database path. | `src/**/*.test.js`, `README.md` |

## Data safety assessment

Schema versions 1–4 contain unqualified numeric monetary values, legacy bill type and optional JSON invoice data. The repository includes `src/Database/inventory.db` and a separate root `inventory - Copy.db`; these may contain real records. No currency code, calendar system, or per-record tax context is stored. Dates in database columns are text, while legacy invoice JSON may contain additional date fields. Therefore it is unsafe to convert historical amounts to INR or reinterpret dates. Keep existing rows and legacy bill types intact; new business defaults and explicit currency/tax metadata should be added additively. Inspect and back up the actual production database before any financial migration.

## Implementation plan

1. Centralize India regional defaults, INR formatting, Gregorian ISO date parsing/display, Asia/Kolkata business date, and April–March FY helpers.
2. Make default transaction entry Gregorian and update rendered currency/date uses through shared utilities; keep legacy conversion helpers isolated for historical display only.
3. Add additive schema/config support for India business profile and new Indian document/tax metadata without mutating historical NPR/VAT records.
4. Correct FY boundaries and date construction in analytics; inspect current stock/payment lifecycle and avoid claiming unsupported return/refund/GST capabilities.
5. Update exports and documentation; run existing test suite, lint and production build and record actual results.

## Constraints and unresolved inputs

## Database inspection evidence

Read-only inspection with the system `sqlite3` tool found `src/Database/inventory.db` at schema version 4 (1 product, 1 customer, 1 bill, no expenses) and `inventory - Copy.db` at schema version 0 (33 products, 11 customers, 11 bills, 29 expenses). Counts are not evidence that either database is demo data. The native `better-sqlite3` module could not be loaded by active Node, so row-level date/currency review and app migrations were not attempted.

## Changes completed in this pass

Added `src/utils/regional.js`, Gregorian date entry/display, India number/currency presentation, Asia/Kolkata business-day defaults, and April–March analytics boundaries. No database schema or records were changed. The findings above describe the baseline; see `CHANGELOG.md` and `TEST_REPORT.md` for implemented scope and verification.

GST applicability/rates, registration and composition status, numbering series, inter-state place-of-supply treatment, credit notes/returns, and historical currency/calendar identity require business-owner/accountant configuration. Do not infer rates from names or represent output as legally certified. The present schema cannot prove whether stored legacy dates are Gregorian or converted from BS, nor whether monetary amounts are NPR or already INR.
