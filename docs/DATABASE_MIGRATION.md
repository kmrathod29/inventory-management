# Database migration and historical data safety

The app uses sequential SQLite migrations in `src/Backend/migrations.js` and `PRAGMA user_version`. Current schema version is 4. The repository contains at least two local database files; neither should be treated as disposable demo data without owner verification.

Historical monetary values are stored as SQLite REAL without currency code. Historical dates are TEXT and may be Gregorian ISO dates despite being displayed in Bikram Sambat. Legacy bill type and invoice JSON preserve some PAN/VAT context. A symbol/default change is not a currency conversion. No bulk conversion is safe without a verified source currency and date-calendar audit.

Before deploying migrations: close the app, create a verified SQLite backup using the app backup feature or SQLite backup API, record row counts and schema version, test on a copy, retain the original backup, and verify relations and totals. Add fields/tables only; do not rewrite values or delete records. Rollback means restoring the pre-migration backup because SQLite `ALTER TABLE` additions are not automatically reversible. Restore through the app's supported database restore flow and validate the database before reopening.

Production migration remains required only after the actual user data is inspected and its legacy currency/calendar context established. Keep historical records labeled as legacy context; do not combine currencies in totals.
