import assert from "node:assert/strict";
import test from "node:test";
import { formatCurrency, formatDate, getBusinessDateISO, getFinancialYearRange, getFinancialYearStart, REGIONAL_DEFAULTS } from "./regional.js";

test("regional defaults and currency use Indian conventions", () => {
  assert.equal(REGIONAL_DEFAULTS.countryCode, "IN");
  assert.match(formatCurrency(125000), /₹\s?1,25,000\.00/);
});

test("Gregorian dates render DD-MM-YYYY without shifting ISO date-only values", () => {
  assert.equal(formatDate("2026-10-13"), "13-10-2026");
});

test("business date is computed in Asia/Kolkata", () => {
  assert.equal(getBusinessDateISO(new Date("2026-03-31T19:00:00.000Z")), "2026-04-01");
});

test("financial years span April through March", () => {
  assert.deepEqual(getFinancialYearRange("2026-03-31"), { start: "2025-04-01", endExclusive: "2026-04-01", label: "2025-26" });
  assert.deepEqual(getFinancialYearRange("2026-04-01"), { start: "2026-04-01", endExclusive: "2027-04-01", label: "2026-27" });
  assert.equal(getFinancialYearStart("2027-02-01"), "2026-04-01");
});
