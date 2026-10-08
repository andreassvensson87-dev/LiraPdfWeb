import test from "node:test";
import assert from "node:assert/strict";
import { documentSnapshot, documentChanged } from "../src/document-state.js";

test("read-only PDFs remain unchanged after restoration adds empty rotation defaults", () => {
  const savedState = JSON.stringify({ entities: [], scales: {} });
  assert.equal(
    documentChanged({ entities: [], scales: {}, rotations: {} }, savedState),
    false,
  );
  assert.equal(
    documentChanged(
      { entities: [], scales: {}, rotations: { 1: 0 } },
      savedState,
    ),
    false,
  );
});

test("navigation and property insertion order do not count as edits", () => {
  const saved = {
    entities: [{ id: "a", points: [{ x: 2, y: 4 }] }],
    scales: { 1: 100, 2: 50 },
  };
  const state = {
    pageNo: 2,
    zoom: 2,
    pan: { x: 10, y: 30 },
    rotations: {},
    entities: [{ points: [{ y: 4, x: 2 }], id: "a" }],
    scales: { 2: 50, 1: 100 },
  };
  assert.equal(documentChanged(state, JSON.stringify(saved)), false);
});

test("actual edits mark a document dirty, undo and saving make it clean", () => {
  const original = { entities: [], scales: {} };
  const saved = documentSnapshot(original);
  for (const edited of [
    { entities: [{ id: "line", points: [{ x: 1, y: 2 }] }], scales: {} },
    { entities: [], scales: { 1: 100 } },
    { entities: [], scales: {}, rotations: { 1: 90 } },
  ]) {
    assert.equal(documentChanged(edited, saved), true);
    assert.equal(documentChanged(edited, documentSnapshot(edited)), false);
  }
  assert.equal(documentChanged(original, saved), false);
});

test("entity order affects drawing and invalid saved snapshots cannot silently discard edits", () => {
  const state = { entities: [{ id: "a" }, { id: "b" }], scales: {} };
  assert.equal(
    documentChanged(
      { ...state, entities: [...state.entities].reverse() },
      documentSnapshot(state),
    ),
    true,
  );
  assert.equal(documentChanged(state, "not json"), true);
});
