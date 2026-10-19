import test from "node:test";
import assert from "node:assert/strict";
import { createPropertyActions } from "../src/editor/property-actions.js";
import { createDocumentEditor } from "../src/editor/document-editor.js";

const line = (id) => ({
  id,
  type: "line",
  page: 1,
  points: [
    { x: 0, y: 0 },
    { x: 20, y: 0 },
  ],
  color: "#147b60",
  width: 1.2,
  fontSize: 12,
});

test("property edits go through validation/history and operate on selected entities only", () => {
  const session = {
    state: { entities: [line("first"), line("second")], scales: {} },
    undoStack: [],
    redoStack: [],
  };
  const editor = createDocumentEditor(session);
  const interaction = { selected: "first", selection: new Set(["first"]) };
  const actions = createPropertyActions({
    session,
    interaction,
    commit: editor.commit,
    canEdit: () => true,
  });
  actions.appearance({ width: 2.4 });
  assert.deepEqual(
    session.state.entities.map((entity) => entity.width),
    [2.4, 1.2],
  );
  assert.equal(session.undoStack.length, 1);
  assert.throws(() => actions.appearance({ width: -2 }));
  assert.equal(session.state.entities[0].width, 2.4);
  assert.equal(session.undoStack.length, 1);
  interaction.selection.add("second");
  actions.opacity(0.4);
  assert.deepEqual(
    session.state.entities.map((entity) => entity.opacity),
    [0.4, 0.4],
  );
  editor.history();
  assert.deepEqual(
    session.state.entities.map((entity) => entity.opacity),
    [undefined, undefined],
  );
});

test("property changes are ignored while the editor is busy", () => {
  const session = { state: { entities: [line("first")], scales: {} } };
  const actions = createPropertyActions({
    session,
    interaction: { selected: "first", selection: new Set(["first"]) },
    commit: () => assert.fail("Must not commit"),
    canEdit: () => false,
  });
  actions.appearance({ width: 2.4 });
  actions.opacity(0.5);
  assert.equal(session.state.entities[0].width, 1.2);
});
