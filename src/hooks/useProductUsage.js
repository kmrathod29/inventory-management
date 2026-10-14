import { useMemo } from "react";
import { normalize } from "../utils/fuzzySearch";

// Derives per-product usage stats from the already-loaded `customers` data
// (each customer has bills[], each bill has products[] = bill_items rows).
// No extra API calls. Powers the search ranking (frequently sold / recently
// used) and the "remembered" Base/Size defaults in the Add Product flow.
//
// Returns a Map keyed by normalized product name:
//   { frequency, lastDate, lastBase, lastSize }
export function useProductUsage(customers) {
  return useMemo(() => {
    const map = new Map();
    if (!Array.isArray(customers)) return map;

    for (const customer of customers) {
      for (const bill of customer.bills || []) {
        const date = bill.date || "";
        for (const item of bill.products || []) {
          // bill_items rows are snake_case; be tolerant of camelCase too.
          const key = normalize(item.product_name ?? item.productName);
          if (!key) continue;

          const entry = map.get(key) || {
            frequency: 0,
            lastDate: "",
            lastBase: "",
            lastSize: "",
          };

          entry.frequency += parseFloat(item.quantity) || 0;

          // Track the most recently used base/size for this product.
          if (date >= entry.lastDate) {
            const base = item.base ?? item.base_name ?? "";
            const size = item.bucket_size ?? item.bucketSize ?? "";
            entry.lastDate = date;
            entry.lastBase = base != null ? String(base) : "";
            entry.lastSize = size != null && size !== "" ? String(size) : "";
          }

          map.set(key, entry);
        }
      }
    }

    return map;
  }, [customers]);
}
