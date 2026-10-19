import test from "node:test";
import assert from "node:assert/strict";
import { createDocumentEditor } from "../src/editor/document-editor.js";

const line = (id = "line") => ({
  id,
  type: "line",
  page: 1,
  points: [
    { x: 1, y: 2 },
    { x: 3, y: 4 },
  ],
  color: "#147b60",
  width: 1.2,
  fontSize: 12,
});
const session = () => ({
  state: { entities: [], scales: {} },
  undoStack: [],
  redoStack: [],
});

test("document edits validate atomically and do not retain caller-owned drafts", () => {
  const active = session(),
    editor = createDocumentEditor(active);
  const next = { entities: [line()], scales: {} };
  editor.commit(next);
  next.entities[0].points[0].x = 500;
  assert.equal(active.state.entities[0].points[0].x, 1);
  const before = structuredClone(active);
  const invalid = structuredClone(active.state);
  invalid.entities[0].points[0].x = NaN;
  assert.throws(() => editor.commit(invalid));
  assert.deepEqual(active, before);
});

test("undo and redo follow the active document session and branch correctly", () => {
  const active = session(),
    editor = createDocumentEditor(active);
  const first = { entities: [line("first")], scales: {} };
  editor.commit(first);
  const savedFirst = { ...active };
  Object.assign(active, session());
  editor.commit({ entities: [line("second")], scales: {} });
  editor.history();
  assert.equal(active.state.entities.length, 0);
  editor.history(true);
  assert.equal(active.state.entities[0].id, "second");
  Object.assign(active, savedFirst);
  editor.history();
  assert.equal(active.state.entities.length, 0);
  editor.commit({ entities: [line("third")], scales: {} });
  assert.equal(editor.history(true), null);
  assert.equal(active.state.entities[0].id, "third");
});

test("history limits snapshots and only content removal requires PDF redraw", () => {
  const active = session(),
    editor = createDocumentEditor(active, { historyLimit: 2 });
  for (let i = 1; i <= 3; i++)
    assert.equal(
      editor.commit({ entities: [line(String(i))], scales: {} }).redrawPdf,
      false,
    );
  assert.equal(active.undoStack.length, 2);
  const next = structuredClone(active.state);
  next.entities.push({ ...line("erase"), type: "pdfErase", eraseOffset: 0 });
  assert.equal(editor.commit(next).redrawPdf, true);
  assert.equal(editor.history().redrawPdf, true);
  assert.equal(editor.history(true).redrawPdf, true);
});
