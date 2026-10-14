# India localization plan

Target defaults: India (`IN`), Gujarat, INR (`₹`), `en-IN`, `Asia/Kolkata`, Gregorian calendar, `DD/MM/YYYY`, 24-hour time, English and metric units.

Implementation follows the existing Electron/React/SQLite architecture. Shared utilities own currency and date presentation and financial-year boundaries. Existing database rows remain untouched because their currency/calendar is not encoded. New schema fields are additive and defaults apply only to new records/configuration. New GST behavior must be configurable and must not infer product rates. Preserve existing screens and flows while incrementally introducing Indian terminology and profile data.

Priorities: shared regional utility; date picker and display migration; April–March reporting; additive settings/schema; explicit inventory units and tax classification as future compatible fields; export updates; regression checks. Full GST computation, invoice numbering concurrency, returns, split payment ledger, unit conversions and immutable stock movement history need dedicated workflow/schema work and owner requirements before production claims.
