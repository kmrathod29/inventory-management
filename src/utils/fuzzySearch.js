// Fuzzy / partial matching + ranking for the product search combobox.
// Case-insensitive, supports prefix, word-boundary, substring and subsequence
// ("fuzzy") matches. Pure functions so callers can wrap them in useMemo.

export function normalize(s) {
  return String(s ?? "").toLowerCase().trim();
}

// All query characters appear in order inside text. Rewards consecutive runs
// and earlier / denser matches. Returns a score, or null if not a subsequence.
function subsequenceScore(q, t) {
  let qi = 0;
  let score = 0;
  let lastMatch = -1;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += lastMatch === ti - 1 ? 2 : 1; // reward adjacency
      lastMatch = ti;
      qi++;
    }
  }
  if (qi < q.length) return null; // not all query chars consumed
  return score - t.length * 0.05; // prefer shorter, denser matches
}

// Returns a numeric score (higher = better) or null when there is no match.
export function fuzzyScore(query, text) {
  const q = normalize(query);
  const t = normalize(text);
  if (q === "") return 0;
  if (t === "") return null;

  if (t === q) return 1000;
  if (t.startsWith(q)) return 800 - (t.length - q.length);

  const wordStart = t.split(/[\s\-_/]+/).some((w) => w.startsWith(q));
  if (wordStart) return 600 - (t.length - q.length);

  const idx = t.indexOf(q);
  if (idx !== -1) return 400 - idx - (t.length - q.length) * 0.1;

  const sub = subsequenceScore(q, t);
  if (sub !== null) return 200 + sub;

  return null;
}

// Ranks products for the search box.
//   - Empty query:   frequency desc -> lastDate desc -> name asc
//   - With a query:  matchScore desc -> frequency desc -> lastDate desc -> name asc
// `usageMap` is the Map produced by useProductUsage (keyed by normalized name).
export function rankProducts(products, query, usageMap) {
  const q = normalize(query);
  const scored = [];

  for (const p of products) {
    let matchScore = 0;
    if (q !== "") {
      const s = fuzzyScore(q, p.name);
      if (s === null) continue; // drop non-matches
      matchScore = s;
    }
    const usage = usageMap?.get(normalize(p.name));
    scored.push({
      product: p,
      matchScore,
      frequency: usage?.frequency ?? 0,
      lastDate: usage?.lastDate ?? "",
    });
  }

  scored.sort((a, b) => {
    if (q !== "" && b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    if (b.frequency !== a.frequency) return b.frequency - a.frequency;
    if (a.lastDate !== b.lastDate) return a.lastDate > b.lastDate ? -1 : 1;
    return a.product.name.localeCompare(b.product.name);
  });

  return scored.map((s) => s.product);
}
