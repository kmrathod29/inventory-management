import assert from "node:assert/strict";
import test from "node:test";
import {
  clearHiddenSelections,
  selectProductIds,
  toggleVisibleSelection,
  toggleRowSelection,
  selectRowsInRange,
} from "./selection.js";

const hierarchy = [
  { key: "product:p1", type: "product", productKey: "product:p1" },
  { key: "base:p1:b1", type: "base", productKey: "product:p1", parentKey: "product:p1" },
  { key: "size:p1:b1:v1", type: "size", productKey: "product:p1", parentKey: "base:p1:b1" },
  { key: "size:p1:b1:v2", type: "size", productKey: "product:p1", parentKey: "base:p1:b1" },
];

test("selects and deselects one visible product", () => {
  assert.deepEqual(selectProductIds(["a", "b"], [], "a", false, null), ["a"]);
  assert.deepEqual(selectProductIds(["a", "b"], ["a"], "a", false, null), []);
});

test("select all and deselect all operate on visible rows", () => {
  assert.deepEqual(toggleVisibleSelection(["a", "b"], []), ["a", "b"]);
  assert.deepEqual(toggleVisibleSelection(["a", "b"], ["a", "b", "hidden"]), []);
});

test("shift selection includes the visible range", () => {
  assert.deepEqual(
    selectProductIds(["a", "b", "c", "d"], ["b"], "d", true, "b"),
    ["b", "c", "d"],
  );
});

test("hidden selections are cleared after filtering", () => {
  assert.deepEqual(clearHiddenSelections(["a", "hidden"], ["a"]), ["a"]);
});

test("product and base selection follows the row hierarchy", () => {
  assert.deepEqual(toggleRowSelection(hierarchy, [], "product:p1"), hierarchy.map((row) => row.key));
  assert.deepEqual(toggleRowSelection(hierarchy, [], "base:p1:b1"), ["base:p1:b1", "size:p1:b1:v1", "size:p1:b1:v2"]);
  assert.deepEqual(toggleRowSelection(hierarchy, [], "size:p1:b1:v1"), ["size:p1:b1:v1"]);
  assert.deepEqual(toggleRowSelection(hierarchy, hierarchy.map((row) => row.key), "product:p1"), []);
});

test("hierarchy range selection can replace or extend selection", () => {
  assert.deepEqual(
    selectRowsInRange(hierarchy, [], "base:p1:b1", "size:p1:b1:v2"),
    ["base:p1:b1", "size:p1:b1:v1", "size:p1:b1:v2"],
  );
  assert.deepEqual(
    selectRowsInRange(hierarchy, ["product:p1"], "base:p1:b1", "size:p1:b1:v1", true),
    ["product:p1", "base:p1:b1", "size:p1:b1:v1"],
  );
});
