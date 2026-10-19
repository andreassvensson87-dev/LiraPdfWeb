import test from "node:test";
import assert from "node:assert/strict";
import { validateDocumentState } from "../src/model/document-validation.js";
import { createDocumentEditor } from "../src/editor/document-editor.js";

const line = {
  id: "line",
  type: "line",
  page: 1,
  points: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ],
  color: "#123456",
  width: 1,
  fontSize: 12,
};
test("native document validation has no serialized-project envelope and rejects malformed records", () => {
  assert.doesNotThrow(() =>
    validateDocumentState({ entities: [line], scales: {} }),
  );
  for (const state of [
    null,
    { entities: [null], scales: {} },
    { entities: [{ ...line, type: "toString" }], scales: {} },
    { entities: [{ ...line, points: [null, { x: 0, y: 0 }] }], scales: {} },
    { entities: [], scales: [] },
    { entities: [], scales: { invalid: 1 } },
  ])
    assert.throws(() => validateDocumentState(state));
});
test("document edits validate entity, scale and rotation page references before changing history", () => {
  const session = {
    state: { entities: [], scales: {} },
    undoStack: [],
    redoStack: [],
    pageCount: 1,
  };
  const editor = createDocumentEditor(session),
    original = structuredClone(session);
  for (const state of [
    { entities: [{ ...line, page: 2 }], scales: {} },
    { entities: [], scales: { 2: 1 } },
    { entities: [], scales: {}, rotations: { 2: 90 } },
  ]) {
    assert.throws(() => editor.commit(state), /sidor/);
    assert.deepEqual(session, original);
  }
});
