export function selectProductIds(
  visibleIds,
  selectedIds,
  productId,
  shiftKey,
  lastSelectedId,
) {
  const index = visibleIds.indexOf(productId);
  const lastIndex = lastSelectedId ? visibleIds.indexOf(lastSelectedId) : -1;
  const idsToToggle =
    shiftKey && index >= 0 && lastIndex >= 0
      ? visibleIds.slice(
          Math.min(index, lastIndex),
          Math.max(index, lastIndex) + 1,
        )
      : [productId];

  if (!shiftKey && selectedIds.includes(productId)) {
    return selectedIds.filter((id) => id !== productId);
  }
  return [...new Set([...selectedIds, ...idsToToggle])];
}

export function toggleVisibleSelection(visibleIds, selectedIds) {
  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  return allSelected ? [] : [...visibleIds];
}

export function clearHiddenSelections(selectedIds, visibleIds) {
  const visible = new Set(visibleIds);
  return selectedIds.filter((id) => visible.has(id));
}

export function getDescendantKeys(rows, key) {
  const row = rows.find((candidate) => candidate.key === key);
  if (!row) return [];
  if (row.type === "size") return [row.key];
  return rows
    .filter((candidate) =>
      candidate.key === key || candidate.parentKey === key ||
      (row.type === "product" && candidate.productKey === row.productKey),
    )
    .map((candidate) => candidate.key);
}

export function toggleRowSelection(rows, selectedKeys, key, shiftKey = false, lastKey = null) {
  const row = rows.find((candidate) => candidate.key === key);
  if (!row) return selectedKeys;
  if (shiftKey && lastKey) {
    const start = rows.findIndex((candidate) => candidate.key === lastKey);
    const end = rows.findIndex((candidate) => candidate.key === key);
    if (start >= 0 && end >= 0) {
      const range = rows.slice(Math.min(start, end), Math.max(start, end) + 1);
      return [...new Set([...selectedKeys, ...range.map((candidate) => candidate.key)])];
    }
  }
  const descendants = getDescendantKeys(rows, key);
  const selected = new Set(selectedKeys);
  const shouldDeselect = descendants.every((descendant) => selected.has(descendant));
  descendants.forEach((descendant) =>
    shouldDeselect ? selected.delete(descendant) : selected.add(descendant),
  );
  return [...selected];
}

export function selectRowsInRange(rows, selectedKeys, firstKey, lastKey, additive = false) {
  const first = rows.findIndex((row) => row.key === firstKey);
  const last = rows.findIndex((row) => row.key === lastKey);
  if (first < 0 || last < 0) return additive ? selectedKeys : [];
  const range = rows.slice(Math.min(first, last), Math.max(first, last) + 1).map((row) => row.key);
  return additive ? [...new Set([...selectedKeys, ...range])] : range;
}
