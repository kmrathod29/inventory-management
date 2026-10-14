# StockWise Roadmap

This roadmap is intentionally focused on improvements that matter most for a small-business desktop inventory app. The goal is to improve usability, stability, operational control, and business readiness before expanding into broader platform features.

## Priority 1: Stability and data reliability

### Must do next
- [x] Add data validation and safer CRUD flows for products, bills, expenses, and customers
- [x] Add DB migration/versioning so schema changes are safe and repeatable
- [x] Add backup and restore flow for local SQLite data
- [x] Review and harden error handling around failed database or import actions
- [x] Add test coverage for core business flows: product add/edit/delete, bill creation, expense import
- [x] Improve settings and configuration handling for app defaults and local storage paths
- [x] Persist Default, PAN, and VAT bill types and VAT invoice metadata

### Why it matters
This app is already feature-rich enough to be useful, but reliability is the main factor that determines whether it becomes trusted business software.

---

## Priority 2: Operational business workflow

### High-value features
- [x] Batch product updates and bulk delete operations
- [ ] Inventory audit / stock count reconciliation
- [ ] Stock valuation report based on cost and current inventory value
- [ ] Better customer payment tracking with partial payments and outstanding aging
- [x] Tax-aware billing calculations and invoice totals
- [ ] Tax reporting and reconciliation (VAT collected, discounts, PAN/VAT bill-number sequences)
- [ ] Export options for sales, products, customers, and expenses (CSV / Excel)
- [ ] Printable invoice and receipt templates
- [ ] Search and filter improvements for products, bills, and customers

### Outcomes
These features improve day-to-day reliability and help local businesses use the app as an operational tool instead of just a product list.

---

## Priority 3: Reporting and decision support

### Important next layer
- [ ] Profit and loss summaries by time period
- [ ] Top-selling products and slow-moving inventory insights
- [ ] Customer purchase history and payment performance summaries
- [ ] Supplier / import cost analysis
- [ ] Dashboard customization with key business KPIs
- [ ] Better comparison views for monthly and yearly performance
- [ ] Filter sales and financial reports by Default, PAN, and VAT bill type

### Goal
Move from simple transaction recording to actionable business reporting.

---

## Priority 4: User workflow and UX

### Recommended improvements
- [ ] Better onboarding and first-run setup for new users
- [ ] Standardized dialogs and validation messages
- [ ] Quick actions for frequent tasks: duplicate, restore, export, delete
- [x] Theme and layout polish for desktop usability
- [ ] Keyboard shortcut documentation and better accessibility for form-heavy screens
- [ ] Add end-to-end UI tests for invoice creation/editing, stock changes, and sales reporting
- [ ] Track bill edit history and retain an audit trail for changes to totals, tax, and payment details

### Goal
Streamline repetitive actions and reduce mistakes during daily usage.

---

## Priority 5: Expansion only after foundation is strong

### Optional later
- [ ] Multi-user roles and permissions for shared store setups
- [ ] Optional cloud sync or encrypted backup
- [ ] API for external integrations
- [ ] E-commerce/order sync integrations
- [ ] Mobile-responsive or companion mobile views
- [ ] Supplier and purchase-order workflows

### Recommendation
These are valid long-term ideas, but they should come after the app is stable, tested, and trusted for daily local operations.

---

## Suggested execution order

### Phase 1: 0-2 months
- Data validation
- Backups and restore
- Migration support
- Better reporting basics
- Test coverage

### Phase 2: 2-4 months
- Bulk operations
- Tax and partial payment support
- Export and print improvements
- Customer aging and payment insights

### Phase 3: 4-6 months
- Multi-user readiness
- Advanced reports and dashboard customization
- Backup security and sync options

### Phase 4: 6+ months
- External integrations and API support
- Mobile or web companion workflows

---

## Current status

The project already has a solid base: a desktop app, local database storage, inventory management, billing, expenses, and analytics. The main remaining opportunities are stronger tax-aware reporting, auditable financial changes, and automated UI-level regression coverage for connected invoice workflows.

---

## Codebase review findings (October 2026)

The following findings came from a full review of the frontend, Electron main/preload layers, backend database access, migrations, validation, and utility code. They are intentionally limited to issues and improvements that are not already covered by the roadmap items above.

### Security and Electron boundaries

#### 1. Restrict the custom `app-image://` protocol to application-owned image files
- **What:** The protocol handler accepts a renderer-supplied absolute `path` query parameter and fetches it as a file URL.
- **Where:** `electron/main.js`, `protocol.handle("app-image", ...)` near the image protocol setup; `src/Backend/server.js`, `resolveImagePath`.
- **Why it matters:** Any compromised renderer or injected script could request arbitrary readable local files, turning the image protocol into a local file disclosure primitive. The backend also joins relative paths without enforcing that the result remains inside the configured data directory.
- **How hard:** Medium

#### 2. Validate and authorize every IPC sender and argument
- **What:** IPC handlers trust calls from the renderer and accept IDs, paths, profile data, settings, and database payloads without checking the sender window or enforcing a narrow argument contract at the IPC boundary.
- **Where:** `electron/main.js` handlers and `electron/preload.cjs` exposed API.
- **Why it matters:** Context isolation and a preload bridge reduce exposure, but a renderer compromise can still invoke destructive operations such as deleting bills, restoring backups, changing data directories, or copying arbitrary files. Sender checks and main-process argument validation provide defense in depth.
- **How hard:** Medium

#### 3. Make BrowserWindow security settings explicit
- **What:** The window relies on Electron defaults instead of explicitly declaring `contextIsolation`, `nodeIntegration`, `sandbox`, and navigation restrictions.
- **Where:** `electron/main.js`, `new BrowserWindow(...)`.
- **Why it matters:** Security-sensitive defaults can change across Electron upgrades, and unrestricted navigation or unexpected web contents can expand the attack surface of the preload bridge. Explicit settings make the security model auditable and prevent regressions.
- **How hard:** Easy

#### 4. Constrain file-copy and file-import paths in the main process
- **What:** `copyImageToDatabase` and `importProductsFromExcel` accept renderer-provided paths; only the UI file picker currently constrains normal use.
- **Where:** `electron/main.js` (`db:copyImage`, `db:importExcel`) and `src/Backend/server.js` (`copyImageToDatabase`, `importProductsFromExcel`).
- **Why it matters:** IPC callers can bypass the picker and cause reads or copies from arbitrary local paths. Image names are taken from `path.basename` without type/size limits, and import processing can consume unexpectedly large workbooks.
- **How hard:** Medium

### Data correctness and silent failure

#### 5. Do not silently ignore stock adjustments when a product, variant, or base is missing
- **What:** `adjustStock` returns without error when any lookup fails.
- **Where:** `src/Backend/businessFlows.js`, `adjustStock` near the stock update helper.
- **Why it matters:** A sale, import edit, or bill deletion can complete while inventory is not changed at all if historical item text no longer matches the catalog. This creates silent stock drift and misleading financial records.
- **How hard:** Medium

#### 6. Validate calendar dates rather than only checking that they are non-empty
- **What:** Bill and expense validation accepts any non-empty date string.
- **Where:** `src/Backend/validation.js`, `validateBillPayload` and `validateExpensePayload`.
- **Why it matters:** Invalid or non-ISO dates can be stored and later sort/filter inconsistently across SQLite, JavaScript `Date`, Nepali-date formatting, and analytics calculations. Bad dates can disappear from period reports without an explicit error.
- **How hard:** Easy

#### 7. Enforce relational integrity and uniqueness in SQLite
- **What:** The schema declares foreign keys but does not enable `PRAGMA foreign_keys = ON`, and important business uniqueness rules are enforced only in application code.
- **Where:** `src/Backend/server.js`, database opening; `src/Backend/migrations.js`, table definitions.
- **Why it matters:** SQLite will not enforce the declared relationships unless enabled per connection, so orphaned rows can be created by imports, future code, or direct database edits. Missing unique indexes also leave duplicate variants, bases, and invoice numbers possible under edge cases.
- **How hard:** Medium

#### 8. Guard persisted JSON parsing at all read boundaries
- **What:** Several reads call `JSON.parse` directly on database text.
- **Where:** `src/Backend/server.js` (`getCustomers`, analytics/reporting reads, and `getExpenseDetails`) and `src/pages/Billing/billing.jsx`.
- **Why it matters:** One malformed `invoice_data` value can reject an entire customer, sales, expense, or analytics load and leave the UI blank. Corruption should be reported with record context and handled without taking down unrelated records.
- **How hard:** Medium

#### 9. Prevent deletion operations from reporting success when no row was changed
- **What:** `deleteBaseStock` and `deleteVariant` do not verify that the requested record exists or that the delete affected a row.
- **Where:** `src/Backend/server.js` and `src/Backend/inventoryDeletes.js`.
- **Why it matters:** Stale UI state or repeated actions can appear successful even though no data changed, making recovery and user diagnosis difficult.
- **How hard:** Easy

### Performance and database access

#### 10. Replace N+1 queries in customer and analytics reads
- **What:** Customer loading queries bills and bill items separately for every customer; analytics then queries bill items and customers again for every result.
- **Where:** `src/Backend/server.js`, `getCustomers`, `getNetPosition`, `getTopProducts`, and `getTopCustomers`.
- **Why it matters:** Load time grows with the number of customers, bills, and line items rather than with a bounded number of queries. This will become noticeable for a real store history and can block the Electron main process.
- **How hard:** Medium

#### 11. Add indexes for the application’s recurring filters and joins
- **What:** There are no migration-created indexes for dates, foreign keys, invoice lookup, or stock lookups.
- **Where:** `src/Backend/migrations.js`; recurring queries in `src/Backend/server.js` and `src/Backend/businessFlows.js`.
- **Why it matters:** Period reports scan full bills/expenses tables, invoice-number checks scan and parse every import invoice, and product/base/stock lookups repeatedly search unindexed columns. Indexes would reduce latency without changing the UI.
- **How hard:** Easy

#### 12. Avoid `SELECT *` for renderer-facing and reporting queries
- **What:** Many database reads return every column even when only a small subset is used.
- **Where:** `src/Backend/server.js`, especially product, customer, bill, expense, and analytics reads.
- **Why it matters:** Unnecessary data is copied through the main process, serialized over IPC, and retained in renderer state. It increases memory usage and makes schema changes more likely to break consumers.
- **How hard:** Medium

### Frontend resilience and accessibility

#### 13. Add a top-level React error boundary with recovery UX
- **What:** There is no React error boundary around the routed application.
- **Where:** `src/main.jsx` and `src/App.jsx`.
- **Why it matters:** A rendering exception in a page, dialog, malformed record, or chart can unmount the entire app with no recovery action. A boundary should show a reload/retry message and log enough context for diagnosis.
- **How hard:** Medium

#### 14. Handle asynchronous image resolution failures and stale results
- **What:** `useResolvedImage` does not catch `resolveImagePath` failures and does not cancel or identify an in-flight request when the image path changes.
- **Where:** `src/hooks/resolvedImage.js`.
- **Why it matters:** A missing file or IPC failure produces an unhandled promise rejection, and a slower earlier lookup can overwrite the image for a newer product. The hook should fall back safely and ignore stale responses.
- **How hard:** Easy

#### 15. Make row-level actions keyboard accessible
- **What:** Expense rows are clickable only through a mouse `onClick`, and several dialog/close/action buttons lack explicit accessible names or keyboard behavior.
- **Where:** `src/pages/Finances/Components/ViewExpenses.jsx`, `src/pages/Finances/Components/SalesDetailDialog.jsx`, and related finance dialogs.
- **Why it matters:** Keyboard and assistive-technology users cannot reliably open records or identify icon-only actions. Interactive table rows should use buttons/links or implement equivalent keyboard semantics and focus handling.
- **How hard:** Medium

#### 16. Avoid index-based React keys for financial detail rows
- **What:** Sales detail items and recent activity rows use array indexes as keys.
- **Where:** `src/pages/Finances/Components/SalesDetailDialog.jsx` and `src/pages/Analytics/Components/ActivityRow.jsx` call sites.
- **Why it matters:** When data is refreshed, reordered, or filtered, React can reuse the wrong row DOM/state, causing misleading visual details in financial screens. Stable bill/item/activity identifiers should be propagated and used instead.
- **How hard:** Easy

### Maintainability and validation gaps

#### 17. Bound text and collection sizes at the backend boundary
- **What:** Product/customer names, notes, addresses, invoice metadata, and item arrays have little or no maximum-length/count validation.
- **Where:** `src/Backend/validation.js` and IPC-facing write functions.
- **Why it matters:** Very large payloads can freeze the renderer/main process, inflate the SQLite file, and make tables or invoices unusable. Explicit limits also prevent accidental malformed imports from creating pathological records.
- **How hard:** Easy

#### 18. Keep inventory updates tied to stable IDs instead of display names
- **What:** Bills and import items persist product/base names, and stock restoration later resolves those names back to the current catalog.
- **Where:** `src/Backend/businessFlows.js`, bill/expense item schemas in `src/Backend/migrations.js`, and stock adjustment helpers.
- **Why it matters:** Renaming a product or base, changing capitalization, or having duplicate historical text can make later edits/deletions adjust the wrong row or no row. Foreign-keyed product, variant, and base IDs would make stock accounting durable.
- **How hard:** Hard

#### 19. Remove or complete dead/duplicated data paths
- **What:** Stock and product writes exist in multiple overlapping implementations (`inventoryWrites.js`, `businessFlows.js`, and legacy server helpers), with different duplicate and lookup behavior.
- **Where:** `src/Backend/inventoryWrites.js`, `src/Backend/businessFlows.js`, and `src/Backend/server.js`.
- **Why it matters:** Future fixes can land in one path while another remains inconsistent, producing different behavior depending on which UI action invoked the write. Consolidating the canonical service layer reduces regression risk and simplifies testing.
- **How hard:** Hard
