# Changelog

## India localization foundation

- Added shared India regional defaults and INR currency/date/FY helpers.
- Replaced the Bikram Sambat entry control with a Gregorian date input. Existing ISO date text is retained and now displayed as DD/MM/YYYY.
- Changed analytics yearly period boundaries to 1 April and calculate business periods in Asia/Kolkata.
- Updated visible currency labels and the analytics, finance and export formatting to INR conventions.
- Historical database values and bill types were not converted or rewritten.

Compatibility: existing `default`, `pan` and `vat` billing records retain their historical interpretation. This release does not implement Indian GST computation or provide migration of historical currency/date meaning.
